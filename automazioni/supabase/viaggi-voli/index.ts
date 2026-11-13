// Edge Function «viaggi-voli» (progetto Supabase «Alessandro») - uso PERSONALE di Alessandro.
// Cerca voli economici da Foggia (FOG) e Bari (BRI). Catena per ogni ricerca (origine, meta, data):
//   1) Motore Jarvis (Cloudflare Worker gratuito, comando /voli, legge Google Flights col browser);
//   2) SOLO se Jarvis fallisce o e' incerto: Firecrawl Alexandria (flights-google-com / flights/search_flights, 5 crediti a chiamata).
// Se Google dice chiaramente "nessun volo", il risultato e' "nessun volo" e Firecrawl NON viene chiamato.
// Ogni scheda ha il campo "fonte" ("jarvis" o "firecrawl"). Tetto di chiamate Firecrawl per ricerca: MAX_CHIAMATE.
// verify_jwt = false: protezione con header x-pin uguale alla secret VIAGGI_PIN. Niente dati salvati.
// Secrets: VIAGGI_PIN, JARVIS_URL, JARVIS_KEY (facoltativa), FIRECRAWL_API_KEY (riserva). Nessuna chiave nel codice.

const MAX_CHIAMATE = 12;          // tetto assoluto di chiamate Firecrawl per ricerca (12 x 5 = 60 crediti)
const MAX_RICERCHE = 12;          // tetto di combinazioni (aeroporto x meta x data) per ricerca
const CONCORRENZA_JARVIS = 2;     // browser Cloudflare in parallelo (piano gratuito: pochi)
const COSTO_FOGGIA_BARI = Number(Deno.env.get("COSTO_FOGGIA_BARI") ?? "15"); // stima auto/treno Foggia -> Bari, in euro
const AEROPORTI_OK = new Set(["FOG", "BRI"]);
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-pin, authorization, apikey",
  "Access-Control-Max-Age": "86400",
};
const risposta = (stato: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

const IATA = /^[A-Z]{3}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// confronto a tempo costante per il PIN
function uguali(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function chiamaFirecrawl(chiave: string, options: Record<string, unknown>): Promise<Any> {
  const r = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${chiave}`, "Content-Type": "application/json", "x-request-id": crypto.randomUUID() },
    body: JSON.stringify({ alexandria: { provider: "flights-google-com", capability: "flights/search_flights", options }, timeout: 60000 }),
    signal: AbortSignal.timeout(70000),
  });
  const testo = await r.text();
  let j: Any = null;
  try { j = JSON.parse(testo); } catch { /* resta null */ }
  if (!r.ok) {
    const msg = j?.error || testo.slice(0, 200);
    throw new Error(`Firecrawl ${r.status}: ${msg}`);
  }
  // la forma esatta della risposta REST non e' documentata nei dettagli: provo i percorsi piu' probabili
  const voce = j?.data?.alexandria?.[0] ?? j?.alexandria?.[0] ?? j?.data?.[0] ?? null;
  if (voce?.error) throw new Error(`Firecrawl: ${voce.error.message ?? voce.error.code ?? JSON.stringify(voce.error)}`);
  const dati = voce?.data ?? voce?.records ?? voce ?? j?.data;
  return dati?.data ?? dati; // a volte c'e' un livello in piu'
}

function ora(dt: string | undefined): number {
  const m = /T(\d{2}):(\d{2})/.exec(dt ?? "") ?? /(\d{1,2}):(\d{2})/.exec(dt ?? "");
  return m ? Number(m[1]) : -1;
}
function fasciaOk(dt: string | undefined, fascia: string): boolean {
  if (fascia === "qualsiasi") return true;
  const h = ora(dt);
  if (h < 0) return true;
  if (fascia === "mattina") return h >= 5 && h < 12;
  if (fascia === "pomeriggio") return h >= 12 && h < 18;
  if (fascia === "sera") return h >= 18 || h < 2;
  return true;
}

// trasforma la risposta Firecrawl in schede semplici
function schede(dati: Any, aeroporto: string, destinazione: string, data: string, direzione: "andata" | "ritorno", costoAcc = 0): Any[] {
  const voli: Any[] = Array.isArray(dati?.flights) ? dati.flights : [];
  return voli.map((v) => {
    const seg: Any[] = Array.isArray(v.segments) ? v.segments : [];
    const primo = seg[0] ?? {};
    const ultimo = seg[seg.length - 1] ?? {};
    const prezzo = Number(v?.price?.amount);
    return {
      fonte: "firecrawl",
      direzione,
      aeroporto_partenza: primo.origin ?? aeroporto,
      aeroporto_ricerca: aeroporto,
      destinazione: ultimo.destination ?? destinazione,
      data,
      prezzo: Number.isFinite(prezzo) ? prezzo : null,
      valuta: v?.price?.currency ?? "EUR",
      scali: v.stops ?? Math.max(0, seg.length - 1),
      durata_minuti: v.duration_minutes ?? null,
      partenza: primo.departure_local ?? null,
      arrivo: ultimo.arrival_local ?? null,
      compagnia: primo.airline_name ?? primo.airline ?? null,
      numero_volo: seg.map((s) => s.flight_number).filter(Boolean).join(" + "),
      segmenti: seg.map((s) => ({ compagnia: s.airline_name ?? s.airline, volo: s.flight_number, da: s.origin, a: s.destination, partenza: s.departure_local, arrivo: s.arrival_local })),
      selection: v.selection ?? null,
      search_url: dati?.search_url ?? null,
      nota_costo: costoAcc ? `Aggiungi circa ${costoAcc} € per arrivare a Bari da Foggia (stima auto/treno)` : null,
      costo_per_arrivare: costoAcc,
    };
  }).filter((s) => s.prezzo !== null);
}

// ---------- Motore Jarvis ----------
function giornoDopo(d: string): string { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); }

async function chiamaJarvis(da: string, a: string, data: string, adulti: number): Promise<Any> {
  const base = (Deno.env.get("JARVIS_URL") ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("JARVIS_URL non impostata");
  const k = Deno.env.get("JARVIS_KEY");
  const url = `${base}/voli?da=${da}&a=${a}&data=${data}&adulti=${adulti}` + (k ? `&k=${encodeURIComponent(k)}` : "");
  const r = await fetch(url, { signal: AbortSignal.timeout(75000) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(`Jarvis ${r.status}: ${j?.errore ?? "risposta non valida"}`);
  return j;
}

function schedeJarvis(j: Any, da: string, a: string, data: string, direzione: "andata" | "ritorno", costoAcc: number): Any[] {
  return (j.voli ?? []).map((v: Any) => {
    const arrData = v.arrivo_ora < v.partenza_ora ? giornoDopo(data) : data;
    return {
      fonte: "jarvis", direzione,
      aeroporto_partenza: da, aeroporto_ricerca: da, destinazione: a, data,
      prezzo: v.prezzo, valuta: "EUR", scali: v.scali, durata_minuti: v.durata_minuti,
      partenza: `${data}T${v.partenza_ora}`, arrivo: `${arrData}T${v.arrivo_ora}`,
      compagnia: v.compagnia || null, numero_volo: "", segmenti: [], selection: null,
      search_url: j.search_url ?? null,
      nota_costo: costoAcc ? `Aggiungi circa ${costoAcc} € per arrivare a Bari da Foggia (stima auto/treno)` : null,
      costo_per_arrivare: costoAcc,
    };
  }).filter((s: Any) => Number.isFinite(s.prezzo));
}

const contatori = { firecrawl: 0 };
const registro: string[] = [];

// Una ricerca: Jarvis prima, Firecrawl solo come riserva.
async function cercaUna(da: string, a: string, data: string, adulti: number, direzione: "andata" | "ritorno", costoAcc: number): Promise<{ voli: Any[]; fonte: string; avvisi: string[]; nessun: boolean }> {
  let motivo = "";
  let jarvisVoli: Any[] = [];
  try {
    const j = await chiamaJarvis(da, a, data, adulti);
    jarvisVoli = schedeJarvis(j, da, a, data, direzione, costoAcc);
    if (jarvisVoli.length) return { voli: jarvisVoli, fonte: "jarvis", avvisi: [], nessun: false };
    if (j.nessun_volo) return { voli: [], fonte: "jarvis", avvisi: [], nessun: true }; // Google lo dice chiaro: niente crediti
    motivo = "Jarvis ha letto la pagina ma non ha trovato voli ne' la frase 'nessun volo' (incerto)";
    registro.push(`[incerto] ${da}->${a} ${data}: ${motivo}. Testo pagina: ${(j.testo_pagina ?? "").slice(0, 200)}`);
  } catch (e) {
    motivo = (e as Error).message;
    registro.push(`[jarvis-fallito] ${da}->${a} ${data}: ${motivo}`);
  }
  // riserva Firecrawl
  const chiave = Deno.env.get("FIRECRAWL_API_KEY");
  if (!chiave) throw new Error(`${motivo}. Riserva Firecrawl non disponibile (manca FIRECRAWL_API_KEY).`);
  if (contatori.firecrawl >= MAX_CHIAMATE) throw new Error(`${motivo}. Tetto di ${MAX_CHIAMATE} chiamate Firecrawl raggiunto.`);
  contatori.firecrawl++;
  const dati = await chiamaFirecrawl(chiave, { origin: da, destination: a, departure_date: data, adults: adulti, currency: "EUR", market: "IT", limit: 15 });
  const fc = schede(dati, da, a, data, direzione, costoAcc);
  registro.push(`[confronto] ${da}->${a} ${data}: jarvis ${jarvisVoli.length} voli, firecrawl ${fc.length} voli (${motivo})`);
  return { voli: fc, fonte: "firecrawl", avvisi: (dati?.notices ?? []).map((n: Any) => typeof n === "string" ? n : JSON.stringify(n)), nessun: fc.length === 0 };
}

async function conConcorrenza<T, R>(lista: T[], n: number, f: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(lista.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => {
    while (i < lista.length) {
      const k = i++;
      try { out[k] = { status: "fulfilled", value: await f(lista[k]) }; } catch (e) { out[k] = { status: "rejected", reason: e }; }
    }
  }));
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return risposta(405, { errore: "Usa POST." });

  const pinGiusto = Deno.env.get("VIAGGI_PIN") ?? "";
  const pin = req.headers.get("x-pin") ?? "";
  if (!pinGiusto || !uguali(pin, pinGiusto)) return risposta(401, { errore: "PIN mancante o sbagliato." });

  contatori.firecrawl = 0; registro.length = 0;
  if (!Deno.env.get("JARVIS_URL") && !Deno.env.get("FIRECRAWL_API_KEY")) {
    return risposta(500, { errore: "Mancano i secrets: serve almeno JARVIS_URL (o FIRECRAWL_API_KEY come riserva)." });
  }

  let b: Any;
  try {
    const t = await req.text();
    if (t.length > 8000) return risposta(413, { errore: "Richiesta troppo grande." });
    b = JSON.parse(t);
  } catch { return risposta(400, { errore: "La richiesta non e' un JSON valido." }); }

  const adulti = Math.min(9, Math.max(1, Math.floor(Number(b.adulti) || 1)));
  const budget = b.budget_max ? Number(b.budget_max) : null;
  const fascia = ["mattina", "pomeriggio", "sera", "qualsiasi"].includes(b.fascia_oraria) ? b.fascia_oraria : "qualsiasi";
  const aeroporti: string[] = [...new Set<string>((Array.isArray(b.aeroporti) && b.aeroporti.length ? b.aeroporti : ["FOG", "BRI"]).map((x: unknown) => String(x).toUpperCase()))];
  if (aeroporti.some((a) => !AEROPORTI_OK.has(a))) return risposta(400, { errore: "Gli aeroporti ammessi sono FOG e BRI." });

  // ---- SECONDA FASE: ritorno dopo aver scelto un'andata ----
  if (b.fase === "ritorno") {
    const meta = String(b.destinazione ?? "").toUpperCase();
    const casa = String(b.aeroporto ?? "").toUpperCase();
    const dataAnd = String(b.data_andata ?? "");
    const dataRit = String(b.data_ritorno ?? "");
    if (!IATA.test(meta) || !AEROPORTI_OK.has(casa) || !DATA.test(dataAnd) || !DATA.test(dataRit)) {
      return risposta(400, { errore: "Per il ritorno servono destinazione, aeroporto (FOG o BRI), data_andata e data_ritorno (AAAA-MM-GG)." });
    }
    try {
      // il ritorno e' un volo di sola andata meta -> casa (Google Flights); i voli andata e ritorno si prezzano separati
      const r = await cercaUna(meta, casa, dataRit, adulti, "ritorno", 0);
      let ritorni = r.voli.filter((s) => fasciaOk(s.partenza, fascia) && (budget === null || s.prezzo! <= budget));
      ritorni.sort((x, y) => x.prezzo! - y.prezzo!);
      return risposta(200, { ritorni, fonte: r.fonte, nessun_volo: r.nessun, chiamate_firecrawl: contatori.firecrawl, crediti_stimati: contatori.firecrawl * 5, avvisi: r.avvisi, log: registro });
    } catch (e) {
      return risposta(502, { errore: `Ricerca del ritorno non riuscita. ${(e as Error).message}` });
    }
  }

  // ---- PRIMA FASE: andate ----
  const destinazioni: string[] = [...new Set<string>((Array.isArray(b.destinazioni) ? b.destinazioni : b.destinazione ? [b.destinazione] : []).map((x: unknown) => String(x).toUpperCase()))];
  const date: string[] = [...new Set<string>((Array.isArray(b.date_andata) ? b.date_andata : []).map((x: unknown) => String(x)))].slice(0, 3);
  if (!destinazioni.length || destinazioni.some((d) => !IATA.test(d))) return risposta(400, { errore: "Indica almeno una destinazione con codice IATA di 3 lettere (es. STN)." });
  if (!date.length || date.some((d) => !DATA.test(d))) return risposta(400, { errore: "Indica da 1 a 3 date di andata nel formato AAAA-MM-GG." });
  if (b.data_ritorno && !DATA.test(String(b.data_ritorno))) return risposta(400, { errore: "La data di ritorno deve essere AAAA-MM-GG." });

  const combinazioni: { da: string; a: string; d: string }[] = [];
  for (const da of aeroporti) for (const a of destinazioni) for (const d of date) combinazioni.push({ da, a, d });
  const saltate = Math.max(0, combinazioni.length - MAX_RICERCHE);
  const daFare = combinazioni.slice(0, MAX_RICERCHE);

  const esiti = await conConcorrenza(daFare, CONCORRENZA_JARVIS, (c) =>
    cercaUna(c.da, c.a, c.d, adulti, "andata", c.da === "FOG" ? COSTO_FOGGIA_BARI : 0).then((r) => ({ c, r })));

  let voli: Any[] = [];
  const problemi: string[] = [];
  const avvisi: string[] = [];
  const senzaVoli: string[] = [];
  const fonti = { jarvis: 0, firecrawl: 0 };
  esiti.forEach((e, i) => {
    const c = daFare[i];
    if (e.status === "fulfilled") {
      voli.push(...e.value.r.voli);
      if (e.value.r.fonte === "jarvis") fonti.jarvis++; else fonti.firecrawl++;
      if (e.value.r.nessun) senzaVoli.push(`${c.da}->${c.a} ${c.d}`);
      for (const n of e.value.r.avvisi) avvisi.push(`${c.da}->${c.a} ${c.d}: ${n}`);
    } else {
      problemi.push(`${c.da}->${c.a} ${c.d}: ${(e.reason as Error).message}`);
    }
  });

  if (problemi.length === daFare.length) {
    return risposta(502, { errore: "Nessuna ricerca e' riuscita.", dettagli: problemi.slice(0, 5), log: registro });
  }

  const prima = voli.length;
  voli = voli.filter((v) => fasciaOk(v.partenza, fascia));
  if (budget !== null) voli = voli.filter((v) => v.prezzo + v.costo_per_arrivare <= budget);
  voli.sort((x, y) => (x.prezzo + x.costo_per_arrivare) - (y.prezzo + y.costo_per_arrivare));

  return risposta(200, {
    voli: voli.slice(0, 60),
    totale_trovati: prima,
    costo_foggia_bari: COSTO_FOGGIA_BARI,
    ricerche_fatte: daFare.length,
    ricerche_per_fonte: fonti,
    chiamate_firecrawl: contatori.firecrawl,
    crediti_stimati: contatori.firecrawl * 5,
    ricerche_saltate_per_limite: saltate,
    senza_voli_quel_giorno: senzaVoli,
    problemi,
    avvisi,
    log: registro,
  });
});
