// Edge Function «questionario-ricevi» (progetto Supabase «Alessandro»).
// Riceve il Questionario Prima Call dalla pagina pubblica e lo salva nella tabella public.questionari.
// verify_jwt = false: la chiama una pagina pubblica. Protezioni: solo POST JSON, CORS solo dalle origini
// del questionario, corpo max 48 KB, campo trappola anti-bot, limite per IP, per numero e globale (30 l'ora), validazione.
// Chiavi: solo variabili d'ambiente della funzione (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY), mai nel codice.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINI = new Set([
  "https://alessandromauroworks.github.io",
]);
const MAX_BYTE = 48_000;
const LIMITE_IP_ORA = 5;        // invii per ora dallo stesso IP
const LIMITE_TEL_GIORNO = 3;    // invii in 24 ore dallo stesso numero
const LIMITE_GLOBALE_ORA = 30;  // questionari salvati in un'ora in tutto: ferma un attacco che cambia IP e numero a ogni invio
const SETTORI = new Set([
  "Concessionaria auto", "Agenzia immobiliare", "Patronato / CAF", "Studio dentistico",
  "Studio medico / poliambulatorio", "Dietista / nutrizionista", "Ristorante / pizzeria", "Bar / caffetteria",
  "Centro estetico", "Parrucchiere / barbiere", "Palestra / centro sportivo", "B&B / hotel / casa vacanze",
  "Studio commercialista", "Studio legale", "Officina / carrozzeria / autolavaggio", "Negozio / attività commerciale",
  "Fisioterapista / osteopata", "Impresa edile / artigiano", "Psicologo / psicoterapeuta", "Veterinario",
  "Farmacia / parafarmacia", "Scuola di danza / musica", "Agenzia viaggi", "Agenzia assicurativa", "Autoscuola",
  "Cantina / agriturismo", "Altra attività",
]);
// campi del questionario (versione v:1). Tutto il resto si scarta.
const CAMPI = ["v", "data", "s", "tipoAltro", "nome", "attivita", "citta", "tel", "ig", "sito", "ob", "obAltro", "team", "can", "str",
  "lav", "lavAltro", "prob", "probT", "no", "noT", "probAltro", "magia", "provato", "vocale", "tempi", "decide", "budget", "pag", "iva",
  "gest", "pk", "consenso"];

const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { "Vary": "Origin", "X-Content-Type-Options": "nosniff" };
  if (origin && ORIGINI.has(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "content-type";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}
const risposta = (stato: number, corpo: unknown, origin: string | null) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" } });

// il registro si scrive dopo aver risposto (EdgeRuntime.waitUntil): la risposta non aspetta il database
function log(esito: string, dettaglio = "") {
  const p = Promise.resolve(supa.from("questionari_log").insert({ esito: esito.slice(0, 40), dettaglio: dettaglio.slice(0, 300) })).catch(() => {});
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er && typeof er.waitUntil === "function") er.waitUntil(p);
}

// pulizia ricorsiva: solo stringhe corte, numeri, booleani, array e oggetti piccoli
function pulisci(x: unknown, prof = 0): unknown {
  if (prof > 4) return null;
  if (typeof x === "string") return x.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 600);
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "boolean" || x === null) return x;
  if (Array.isArray(x)) return x.slice(0, 40).map((v) => pulisci(v, prof + 1));
  if (typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>).slice(0, 40)) if (/^[A-Za-z]{1,20}$/.test(k)) o[k] = pulisci(v, prof + 1);
    return o;
  }
  return null;
}

let chiaveHmac: Promise<CryptoKey> | null = null;   // importata una volta sola, non a ogni invio
async function impronta(testo: string): Promise<string> {
  chiaveHmac ??= crypto.subtle.importKey("raw", new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(-32)),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const chiave = await chiaveHmac;
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", chiave, new TextEncoder().encode(testo)));
  return Array.from(firma.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const permessa = !!origin && ORIGINI.has(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: permessa ? 204 : 403, headers: cors(origin) });
  if (req.method !== "POST") return risposta(405, { ok: false, errore: "metodo" }, origin);
  if (!permessa) { log("origine_rifiutata", String(origin || "nessuna").slice(0, 120)); return risposta(403, { ok: false, errore: "origine" }, origin); }
  if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return risposta(415, { ok: false, errore: "formato" }, origin);
  const dich = Number(req.headers.get("content-length") || "0");
  if (dich > MAX_BYTE) return risposta(413, { ok: false, errore: "troppo grande" }, origin);

  let corpo: Record<string, unknown>;
  try {
    const testo = await req.text();
    if (new TextEncoder().encode(testo).length > MAX_BYTE) return risposta(413, { ok: false, errore: "troppo grande" }, origin);
    corpo = JSON.parse(testo);
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new Error("non oggetto");
  } catch (_) { log("json_non_valido"); return risposta(400, { ok: false, errore: "json" }, origin); }

  // trappola anti-bot: campo nascosto che una persona non vede e lascia vuoto
  if (typeof corpo.hp !== "string" || corpo.hp.trim() !== "") { log("trappola_piena"); return risposta(400, { ok: false, errore: "rifiutato" }, origin); }

  const codice = typeof corpo.codice === "string" ? corpo.codice.trim() : "";
  if (!/^QC[12]\.[A-Za-z0-9_-]{20,39000}$/.test(codice)) { log("codice_non_valido"); return risposta(400, { ok: false, errore: "codice" }, origin); }

  const d0 = corpo.d as Record<string, unknown> | undefined;
  if (!d0 || typeof d0 !== "object" || Array.isArray(d0) || d0.v !== 1) { log("risposte_non_valide"); return risposta(400, { ok: false, errore: "risposte" }, origin); }
  const d: Record<string, unknown> = {};
  for (const k of CAMPI) if (k in d0) d[k] = pulisci(d0[k]);

  const str = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
  const settore = str(d.s, 80), nome = str(d.nome, 80), attivita = str(d.attivita, 80), tel = str(d.tel, 25);
  const cifre = tel.replace(/\D/g, "");
  const errori: string[] = [];
  if (!SETTORI.has(settore)) errori.push("settore");
  if (nome.length < 2) errori.push("nome");
  if (attivita.length < 2) errori.push("attivita");
  if (!/^[+0-9 ().\/-]{6,25}$/.test(tel) || cifre.length < 8 || cifre.length > 15) errori.push("telefono");
  const consenso = d.consenso as Record<string, unknown> | undefined;
  if (!consenso || typeof consenso !== "object" || typeof consenso.data !== "string") errori.push("consenso");
  if (errori.length) { log("validazione", errori.join(",")); return risposta(400, { ok: false, errore: "campi", campi: errori }, origin); }

  // limiti: per IP (impronta, mai l'IP in chiaro), per numero e globale
  // cf-connecting-ip lo scrive Cloudflare e non si può falsificare; x-forwarded-for solo se manca
  const ip = req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "sconosciuto";
  const chiaveIp = "ip:" + await impronta(ip);
  const unOraFa = new Date(Date.now() - 3600_000).toISOString(), ieri = new Date(Date.now() - 86400_000).toISOString();
  // i quattro controlli in una sola tornata parallela; il doppio invio = stesso numero e attività negli ultimi 10 minuti
  const dieciMin = new Date(Date.now() - 600_000).toISOString();
  const [{ count: nIp }, { count: nTel }, { count: nOra }, { count: doppi }] = await Promise.all([
    supa.from("questionari_limiti").select("id", { count: "exact", head: true }).eq("chiave", chiaveIp).gte("creato_il", unOraFa),
    supa.from("questionari").select("id", { count: "exact", head: true }).eq("telefono", tel).gte("creato_il", ieri),
    supa.from("questionari").select("id", { count: "exact", head: true }).gte("creato_il", unOraFa),
    supa.from("questionari").select("id", { count: "exact", head: true }).eq("telefono", tel).eq("attivita", attivita).gte("creato_il", dieciMin),
  ]);
  if ((nIp ?? 0) >= LIMITE_IP_ORA || (nTel ?? 0) >= LIMITE_TEL_GIORNO) { log("limite"); return risposta(429, { ok: false, errore: "troppi invii" }, origin); }
  if ((nOra ?? 0) >= LIMITE_GLOBALE_ORA) { log("limite_globale"); return risposta(429, { ok: false, errore: "troppi invii" }, origin); }
  const limite = Promise.resolve(supa.from("questionari_limiti").insert({ chiave: chiaveIp })).catch(() => {});   // conta anche il doppio invio, in parallelo al salvataggio
  if ((doppi ?? 0) > 0) { await limite; log("doppio_invio"); return risposta(200, { ok: true }, origin); }

  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    const { error } = await supa.from("questionari").insert({ settore, nome, attivita, telefono: tel, risposte: d, codice_qc1: codice });
    if (!error) { await limite; log("salvato"); return risposta(200, { ok: true }, origin); }
    if (tentativo === 3) { log("errore_db", error.message); break; }
    await new Promise((r) => setTimeout(r, 300 * tentativo));
  }
  await limite;
  return risposta(500, { ok: false, errore: "salvataggio" }, origin);
});
