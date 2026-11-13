// Edge Function «viaggi-itinerario» (progetto Supabase «Alessandro») - uso PERSONALE di Alessandro.
// Chiede a Claude (API Anthropic) un itinerario giorno per giorno. verify_jwt = false: protezione con header x-pin = secret VIAGGI_PIN.
// Secrets: ANTHROPIC_API_KEY, VIAGGI_PIN. Niente dati salvati.

const MODELLO = "claude-sonnet-5-5";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-pin, authorization, apikey",
  "Access-Control-Max-Age": "86400",
};
const risposta = (stato: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

function uguali(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const testo = (x: unknown, max: number) => String(x ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const DT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return risposta(405, { errore: "Usa POST." });

  const pinGiusto = Deno.env.get("VIAGGI_PIN") ?? "";
  if (!pinGiusto || !uguali(req.headers.get("x-pin") ?? "", pinGiusto)) return risposta(401, { errore: "PIN mancante o sbagliato." });

  const chiave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chiave) return risposta(500, { errore: "Manca la chiave ANTHROPIC_API_KEY nei secrets di Supabase." });

  // deno-lint-ignore no-explicit-any
  let b: any;
  try {
    const t = await req.text();
    if (t.length > 6000) return risposta(413, { errore: "Richiesta troppo grande." });
    b = JSON.parse(t);
  } catch { return risposta(400, { errore: "La richiesta non e' un JSON valido." }); }

  const citta = testo(b.citta, 80);
  const arrivo = testo(b.data_arrivo, 25);
  const partenza = testo(b.data_partenza, 25);
  if (!citta) return risposta(400, { errore: "Manca la citta." });
  if (!DT.test(arrivo) || !DT.test(partenza)) return risposta(400, { errore: "Data e ora di arrivo e partenza servono nel formato AAAA-MM-GGTHH:MM." });
  const giorni = Math.round((Date.parse(partenza.slice(0, 10)) - Date.parse(arrivo.slice(0, 10))) / 86400000) + 1;
  if (!(giorni >= 1 && giorni <= 10)) return risposta(400, { errore: "Il viaggio deve durare da 1 a 10 giorni." });
  const interessi = testo(b.interessi, 300);
  const budget = b.budget_giornaliero ? Number(b.budget_giornaliero) : null;

  const sistema = `Sei una guida di viaggio esperta. Scrivi in italiano semplice e chiaro, frasi corte.
Regole ferme:
- NON inventare nomi di locali (ristoranti, bar, hotel) e NON dare indirizzi. Per il cibo indica piatti tipici e il TIPO di locale dove mangiarli (es. "trattoria di quartiere", "mercato coperto").
- Per musei, chiese, monumenti e quartieri cita SOLO luoghi famosi e realmente esistenti.
- Ricorda di verificare orari e prezzi sul sito ufficiale: nei consigli scrivi "verifica orari sul sito ufficiale".
- Il primo e l'ultimo giorno vanno adattati agli orari del volo (arrivo e partenza): poco da fare se si arriva tardi o si parte presto, tieni conto del tempo per l'aeroporto.
- Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, con questa forma:
{"citta": string, "zona_consigliata": {"nome": string, "perche": string},
 "giorni": [{"giorno": number, "data": "AAAA-MM-GG", "titolo": string, "mattina": [string], "pomeriggio": [string], "sera": [string]}],
 "cosa_mangiare": {"piatti_tipici": [string], "tipi_di_locale": [string]},
 "esperienze_locali": [string],
 "consigli_pratici": {"dall_aeroporto": string, "biglietti": string, "orari_chiusura": string, "altro": [string]}}
Il numero di elementi in "giorni" deve essere esattamente ${giorni}.`;

  const utente = `Città: ${citta}
Arrivo: ${arrivo}
Partenza: ${partenza}
Giorni: ${giorni}
Interessi: ${interessi || "nessuno in particolare"}
Budget giornaliero (escluso alloggio): ${budget ? budget + " euro" : "non indicato"}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chiave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODELLO, max_tokens: 6000, system: sistema, messages: [{ role: "user", content: utente }] }),
      signal: AbortSignal.timeout(120000),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) return risposta(502, { errore: `Anthropic ${r.status}: ${j?.error?.message ?? "errore sconosciuto"}` });
    const t: string = (j?.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    const i = t.indexOf("{"), f = t.lastIndexOf("}");
    if (i < 0 || f < i) return risposta(502, { errore: "La risposta dell'IA non era nel formato giusto. Riprova." });
    try {
      const itinerario = JSON.parse(t.slice(i, f + 1));
      return risposta(200, { itinerario, avviso: "Verifica orari e prezzi sul sito ufficiale di ogni luogo." });
    } catch { return risposta(502, { errore: "L'IA ha risposto con un JSON rotto (forse troppo lungo). Riprova." }); }
  } catch (e) {
    return risposta(502, { errore: `Chiamata all'IA non riuscita: ${(e as Error).message}` });
  }
});
