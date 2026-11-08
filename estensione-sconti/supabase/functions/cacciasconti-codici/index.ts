// Edge Function Cacciasconti (BOZZA da controllare prima della distribuzione pubblica).
// POST  {domain, code, worked, saving_pct?}  -> salva una segnalazione anonima
// GET   ?domain=esempio.it                   -> max 20 codici con almeno 2 successi e tasso di successo >= 50% negli ultimi 30 giorni
// Segreti da impostare: CACCIASCONTI_SALE (testo casuale lungo, OBBLIGATORIO: senza, le segnalazioni rispondono 503); opzionale CACCIASCONTI_APIKEY (chiave anon dell'estensione).
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_BODY = 2048;
const MAX_ORA = 60;
const RE_DOMINIO = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
const RE_CODICE = /^[A-Z0-9-]{3,25}$/;
// Un codice entra nell'elenco pubblico solo con almeno 2 segnalazioni "funziona" e almeno il 50% di successi (contro l'avvelenamento con una sola segnalazione falsa).
const MIN_SUCCESSI = 2;
const MIN_TASSO = 50;

const CORS = {
  "access-control-allow-origin": "*", // l'estensione chiama da chrome-extension:// / moz-extension://
  "access-control-allow-headers": "content-type, apikey, authorization",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

async function sha256(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const dominioValido = (d: unknown): d is string =>
  typeof d === "string" && d.length > 0 && d.length <= 253 && RE_DOMINIO.test(d);

// Indirizzo del cliente per il limite di invii. x-forwarded-for lo scrive anche il cliente (il primo elemento si può inventare):
// vale l'ultimo elemento, aggiunto dal proxy più vicino; cf-connecting-ip (Cloudflare) se c'è.
export function ipCliente(req: Request): string {
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  if (cf) return cf;
  const xff = (req.headers.get("x-forwarded-for") || "").split(",").map((x) => x.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : "sconosciuto";
}

export async function gestisci(req: Request, db: any): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const chiave = Deno.env.get("CACCIASCONTI_APIKEY");
  if (chiave && req.headers.get("apikey") !== chiave) return json({ errore: "non autorizzato" }, 401);

  if (req.method === "GET") {
    const dominio = (new URL(req.url).searchParams.get("domain") || "").toLowerCase();
    if (!dominioValido(dominio)) return json({ errore: "dominio non valido" }, 400);
    const { data, error } = await db.from("cacciasconti_stats_30g").select("code,n_report,tasso_successo,ultimo_successo,sconto_medio_pct")
      .eq("domain", dominio).gte("n_successi", MIN_SUCCESSI).gte("tasso_successo", MIN_TASSO).order("tasso_successo", { ascending: false })
      .order("ultimo_successo", { ascending: false }).limit(20);
    if (error) return json({ errore: "errore del server" }, 500);
    return json({ codici: data });
  }

  if (req.method !== "POST") return json({ errore: "metodo non permesso" }, 405);
  // Senza il sale l'hash dell'IP sarebbe indovinabile: meglio non accettare segnalazioni.
  const sale = Deno.env.get("CACCIASCONTI_SALE");
  if (!sale) return json({ errore: "servizio non configurato" }, 503);
  const testo = await req.text();
  if (testo.length > MAX_BODY) return json({ errore: "richiesta troppo grande" }, 413);
  let b: any;
  try { b = JSON.parse(testo); } catch { return json({ errore: "JSON non valido" }, 400); }
  const dominio = typeof b.domain === "string" ? b.domain.toLowerCase() : "";
  const codice = typeof b.code === "string" ? b.code.toUpperCase() : "";
  const pct = b.saving_pct == null ? null : Number(b.saving_pct);
  if (!dominioValido(dominio) || !RE_CODICE.test(codice) || typeof b.worked !== "boolean" ||
      (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100))) return json({ errore: "dati non validi" }, 400);

  // Limite per ora: si salva solo l'hash di IP + sale del giorno (mai l'IP).
  const ip = ipCliente(req);
  const giorno = new Date().toISOString().slice(0, 10);
  const hash = await sha256(ip + "|" + giorno + "|" + sale);
  const { data: n, error: e1 } = await db.rpc("cacciasconti_conta", { p_hash: hash });
  if (e1) return json({ errore: "errore del server" }, 500);
  if (n > MAX_ORA) return json({ errore: "troppe segnalazioni, riprova più tardi" }, 429);

  const { error } = await db.from("cacciasconti_reports").insert({ domain: dominio, code: codice, worked: b.worked, saving_pct: pct });
  if (error) return json({ errore: "errore del server" }, 500);
  return json({ ok: true }, 201);
}

// Nell'Edge Runtime di Supabase la condizione "main" del modulo non è vera: il server parte sempre. `gestisci` resta esportata per le prove.
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
Deno.serve((req) => gestisci(req, db));
