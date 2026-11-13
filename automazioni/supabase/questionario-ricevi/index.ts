// Edge Function «questionario-ricevi» (progetto Supabase «Alessandro»).
// Riceve il Questionario Prima Call dalla pagina pubblica e lo salva nella tabella public.questionari.
// verify_jwt = false: la chiama una pagina pubblica. Protezioni: solo POST JSON, CORS solo dalle origini
// del questionario, corpo max 48 KB, campo trappola anti-bot, limite per IP, per numero e globale (30 l'ora), validazione.
// Il doppio invio (entro 10 minuti) aggiorna la riga solo se arriva con la stessa «sessione» casuale creata dalla pagina.
// Prova locale senza Supabase: questionario/test/10-dati-funzione.cjs (usa prova-funzione.mts).
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
  "Cantina / agriturismo", "Impresa di servizi / pulizie / manutenzioni", "Studio tecnico (geometra, ingegnere, architetto)",
  "Trasporti / logistica / corrieri", "Consulente del lavoro / paghe", "Associazione / ente / cooperativa",
  "Privato (per me o la mia famiglia)", "Altra attività",
]);
// ==== INIZIO PULIZIA ====
// (blocco provato in locale da questionario/test/10-dati-funzione.cjs: niente Deno qui dentro)
// campi del questionario (versione v:1). Tutto il resto si scarta.
export const CAMPI = ["v", "data", "s", "tipoAltro", "nome", "attivita", "citta", "tel", "ig", "sito", "ob", "obAltro", "team", "can", "str",
  "lav", "lavAltro", "prob", "probT", "no", "noT", "probAltro", "magia", "provato", "vocale", "tempi", "decide", "budget", "pag", "iva",
  "gest", "pk", "consenso",
  // aggiunti con le versioni successive del questionario (ruolo, servizi, dettagli, mappa del lavoro, pacchetto, ecc.)
  "versione", "ruolo", "contatto", "email", "copiaEmail", "perConto", "telefono", "servizi", "tipoProblema", "dimensione", "segreteria",
  "problemi", "dettagli", "mappa", "flusso", "consigli", "pacchetto",
  // identificativo casuale della compilazione (lo crea la pagina e lo tiene nella bozza): serve solo per aggiornare il proprio doppio invio
  "sessione"];

// pulizia ricorsiva: solo stringhe, numeri, booleani, array e oggetti piccoli.
// I limiti sono quelli della pagina (campo più lungo: «problemi», 2000 caratteri; profondità usata: 4, in pk.piani[].servizi[]):
// così non si perde niente di ciò che una persona può scrivere. Il taglio conta i caratteri veri (emoji comprese),
// come la pagina, e non spezza mai un'emoji a metà (un pezzo di emoji rompe il salvataggio in jsonb).
export const MAX_TESTO = 2000, MAX_ELEMENTI = 40, MAX_CHIAVI = 40, MAX_PROF = 4;
export function pulisci(x: unknown, prof = 0): unknown {
  if (prof > MAX_PROF) return null;
  if (typeof x === "string") {
    const t = x.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, "");
    return t.length <= MAX_TESTO ? t : Array.from(t).slice(0, MAX_TESTO).join("");
  }
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "boolean" || x === null) return x;
  if (Array.isArray(x)) return x.slice(0, MAX_ELEMENTI).map((v) => pulisci(v, prof + 1));
  if (typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>).slice(0, MAX_CHIAVI)) if (/^[A-Za-z]{1,20}$/.test(k)) o[k] = pulisci(v, prof + 1);
    return o;
  }
  return null;
}
// risposte che si salvano: solo i CAMPI conosciuti, ripuliti
export function risposteDa(d0: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const k of CAMPI) if (k in d0) d[k] = pulisci(d0[k]);
  if (typeof d.sessione !== "string" || !SESSIONE_VALIDA.test(d.sessione)) delete d.sessione;
  return d;
}
export const SESSIONE_VALIDA = /^[a-f0-9]{32}$/;
export const CODICE_VALIDO = /^QC[12]\.[A-Za-z0-9_-]{20,39000}$/;
// ==== FINE PULIZIA ====

// ==== INIZIO EMAIL ====
// Copia delle risposte a chi la chiede. DORMIENTE: parte solo se esistono i secrets RESEND_API_KEY e MITTENTE_EMAIL
// (Supabase > Edge Functions > Secrets), se la persona ha spuntato la casella, ha dato l'email e il consenso.
// Non blocca e non rallenta il salvataggio (si lancia dopo, in background, timeout 5 s). Nel registro vanno solo esiti, mai dati personali.
const RISPOSTA_EMAIL = "alessandromauro.works@gmail.com";
const EMAIL_VALIDA = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[^\s@<>"',;]{2,}$/;
const escHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const testoBreve = (x: unknown, n = 300) => (typeof x === "string" ? x.replace(/[\r\n\t]+/g, " ").trim().slice(0, n) : "");
const elenco = (x: unknown, n = 10) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string").map((v) => testoBreve(v, 120)).filter(Boolean).slice(0, n) : []);
// Per il privato i servizi hanno nomi personali (stessi della pagina); le voci solo da azienda non si mostrano.
const NOMI_PRIVATO: [RegExp, string | null][] = [
  [/^Sito internet/, "Sito personale o portfolio"], [/^Gestionale fatto su misura/, "App o programma su misura"],
  [/^Gestionale \(/, null], [/^Automazioni/, "Automazioni personali"], [/^Assistente/, null], [/^Prenotazioni/, null], [/^Recensioni/, null],
  [/^Video e foto per l'attività/, "Video e foto per il mio progetto"],
];
export function nomiServizi(servizi: string[], privato: boolean): string[] {
  if (!privato) return servizi;
  return servizi.flatMap((v) => { const m = NOMI_PRIVATO.find(([re]) => re.test(v)); return m ? (m[1] ? [m[1]] : []) : [v]; });
}
export function costruisciEmail(d: Record<string, unknown>): { oggetto: string; testo: string; html: string } {
  const nome = testoBreve(d.nome, 80) || "";
  const privato = d.ruolo === "Privato";
  const pk = (d.pacchetto && typeof d.pacchetto === "object" ? d.pacchetto : {}) as Record<string, unknown>;
  const voci: [string, string][] = [];
  if (!privato && testoBreve(d.attivita, 80)) voci.push(["Attività", testoBreve(d.attivita, 80)]);
  if (testoBreve(d.s, 80)) voci.push(["Settore", testoBreve(d.s, 80)]);
  const serv = nomiServizi(elenco(d.servizi), privato);
  if (serv.length) voci.push(["Ti serve", serv.join("; ")]);
  if (testoBreve(d.problemi, 400)) voci.push(["I problemi che hai raccontato", testoBreve(d.problemi, 400)]);
  if (testoBreve(pk.standard, 60) || elenco(pk.suMisura).length) voci.push(["Pacchetto", testoBreve(pk.standard, 60) || "su misura: " + elenco(pk.suMisura).join(", ")]);
  voci.push(["Come vuoi essere ricontattato", testoBreve(d.contatto, 40) || "WhatsApp"]);
  const saluto = nome ? "Ciao " + nome + "," : "Ciao,";
  const parti = [
    saluto,
    "grazie per aver compilato il questionario: le tue risposte mi sono arrivate.",
    "Ecco un riepilogo breve:\n" + voci.map(([k, v]) => "- " + k + ": " + v).join("\n"),
    "Cosa succede adesso: leggo le risposte, preparo la call e ti ricontatto con il mezzo che hai scelto. Se vuoi aggiungere o correggere qualcosa, rispondi a questa email.",
    "I miei contatti: Alessandro Mauro, WhatsApp +39 339 405 2935, " + RISPOSTA_EMAIL + ".",
    "Se vuoi che cancelli le tue risposte, scrivimi a quell'indirizzo o su WhatsApp e lo faccio. Se non lavoriamo insieme le cancello comunque dopo 12 mesi.",
    "A presto,\nAlessandro",
  ];
  const testo = parti.join("\n\n");
  const html = parti.map((p) => "<p>" + escHtml(p).replace(/\n/g, "<br>") + "</p>").join("");
  return { oggetto: "Ho ricevuto le tue risposte", testo, html };
}
type Registra = (esito: string, dettaglio?: string) => void;
// non lancia mai errori: ogni problema finisce solo nel registro, senza dati personali
export async function inviaCopia(
  d: Record<string, unknown>, env: { RESEND_API_KEY?: string; MITTENTE_EMAIL?: string }, fetchFn: typeof fetch, registra: Registra,
): Promise<void> {
  try {
    const chiave = (env.RESEND_API_KEY || "").trim(), mittente = (env.MITTENTE_EMAIL || "").trim();
    if (!chiave || !mittente || !mittente.includes("@")) return registra("email_saltata", "senza_chiavi");
    const email = testoBreve(d.email, 254);
    if (d.copiaEmail !== true) return registra("email_saltata", "non_richiesta");
    if (!EMAIL_VALIDA.test(email)) return registra("email_saltata", "email_non_valida");
    const cons = d.consenso as Record<string, unknown> | undefined;
    if (!cons || typeof cons !== "object" || typeof cons.data !== "string") return registra("email_saltata", "senza_consenso");
    const { oggetto, testo, html } = costruisciEmail(d);
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
    try {
      const r = await fetchFn("https://api.resend.com/emails", {
        method: "POST", signal: ctl.signal,
        headers: { Authorization: "Bearer " + chiave, "Content-Type": "application/json" },
        body: JSON.stringify({ from: mittente.includes("<") ? mittente : "Alessandro Mauro <" + mittente + ">", to: [email], reply_to: RISPOSTA_EMAIL, subject: oggetto, text: testo, html }),
      });
      registra(r.ok ? "email_inviata" : "email_errore", r.ok ? "" : "stato " + r.status);
    } finally { clearTimeout(t); }
  } catch (e) {
    try { registra("email_errore", e instanceof Error && e.name === "AbortError" ? "timeout" : "rete"); } catch (_) { /* niente */ }
  }
}
// ==== FINE EMAIL ====

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
  if (!CODICE_VALIDO.test(codice)) { log("codice_non_valido"); return risposta(400, { ok: false, errore: "codice" }, origin); }

  const d0 = corpo.d as Record<string, unknown> | undefined;
  if (!d0 || typeof d0 !== "object" || Array.isArray(d0) || d0.v !== 1) { log("risposte_non_valide"); return risposta(400, { ok: false, errore: "risposte" }, origin); }
  const d = risposteDa(d0);

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
  // i quattro controlli in una sola tornata parallela; il doppio invio = stesso numero, stessa attività e STESSA sessione negli ultimi 10 minuti.
  // La sessione è un numero casuale che conosce solo la pagina di chi compila: chi sa solo telefono e nome dell'attività non può sovrascrivere.
  const sessione = typeof d.sessione === "string" ? d.sessione : "";
  const dieciMin = new Date(Date.now() - 600_000).toISOString();
  const [{ count: nIp }, { count: nTel }, { count: nOra }, { count: doppi }] = await Promise.all([
    supa.from("questionari_limiti").select("id", { count: "exact", head: true }).eq("chiave", chiaveIp).gte("creato_il", unOraFa),
    supa.from("questionari").select("id", { count: "exact", head: true }).eq("telefono", tel).gte("creato_il", ieri),
    supa.from("questionari").select("id", { count: "exact", head: true }).gte("creato_il", unOraFa),
    sessione
      ? supa.from("questionari").select("id", { count: "exact", head: true }).eq("telefono", tel).eq("attivita", attivita).eq("risposte->>sessione", sessione).gte("creato_il", dieciMin)
      : Promise.resolve({ count: 0 }),
  ]);
  if ((nIp ?? 0) >= LIMITE_IP_ORA || (nTel ?? 0) >= LIMITE_TEL_GIORNO) { log("limite"); return risposta(429, { ok: false, errore: "troppi invii" }, origin); }
  if ((nOra ?? 0) >= LIMITE_GLOBALE_ORA) { log("limite_globale"); return risposta(429, { ok: false, errore: "troppi invii" }, origin); }
  const limite = Promise.resolve(supa.from("questionari_limiti").insert({ chiave: chiaveIp })).catch(() => {});   // conta anche il doppio invio, in parallelo al salvataggio
  if ((doppi ?? 0) > 0) {
    // stessa compilazione negli ultimi 10 minuti: doppio tocco, oppure chi ha fatto la versione veloce e poi continua il questionario.
    // Non si crea una seconda riga: si aggiornano le risposte (valgono le ultime). Un errore qui non cambia la risposta.
    await Promise.resolve(supa.from("questionari").update({ settore, nome, risposte: d, codice_qc1: codice }).eq("telefono", tel).eq("attivita", attivita)
      .eq("risposte->>sessione", sessione).gte("creato_il", dieciMin)).catch(() => {});
    await limite; log("doppio_invio"); return risposta(200, { ok: true }, origin);
  }

  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    const { error } = await supa.from("questionari").insert({ settore, nome, attivita, telefono: tel, risposte: d, codice_qc1: codice });
    if (!error) {
      // copia per email: in background, dopo il salvataggio; non aspetta e non può farlo fallire
      const invio = inviaCopia(d, { RESEND_API_KEY: Deno.env.get("RESEND_API_KEY"), MITTENTE_EMAIL: Deno.env.get("MITTENTE_EMAIL") }, fetch, log).catch(() => {});
      // deno-lint-ignore no-explicit-any
      const er = (globalThis as any).EdgeRuntime;
      if (er && typeof er.waitUntil === "function") er.waitUntil(invio);
      await limite; log("salvato"); return risposta(200, { ok: true }, origin);
    }
    if (tentativo === 3) { log("errore_db", error.message); break; }
    await new Promise((r) => setTimeout(r, 300 * tentativo));
  }
  await limite;
  return risposta(500, { ok: false, errore: "salvataggio" }, origin);
});
