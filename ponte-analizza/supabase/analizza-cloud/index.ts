// Edge Function "analizza-cloud": fa lavorare Analizza su GitHub Actions quando il PC e' spento.
//
// Azioni:
//   sveglia  (pg_cron, ogni minuto, senza codice): se c'e' lavoro per il cloud avvia il workflow
//            GitHub "analizza-cloud.yml". Al massimo un avvio ogni 4 minuti (lo decide il database),
//            quindi chiamarla da fuori non fa danni.
//   prendi   (dal workflow, con x-codice): prende un link e lo segna «in lavorazione».
//   fatto    (dal workflow, con x-codice): scrive il report nella riga.
//   rimanda  (dal workflow, con x-codice): il cloud non ce l'ha fatta, il link torna al PC.
//
// Segreti (Supabase, Edge Functions, Secrets):
//   ANALIZZA_CLOUD_CODICE   stesso valore del secret omonimo su GitHub
//   GITHUB_TOKEN_ANALIZZA   token GitHub fine-grained: solo repo Ale, permesso Actions = Read and write
import { createClient } from "npm:@supabase/supabase-js@2";

const REPO = "alessandromauroworks/Ale";
const WORKFLOW = "analizza-cloud.yml";
const RAMO = "main";
const MAX_REPORT = 200000;

function risposta(corpo: unknown, stato = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function uguali(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function idValido(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function testo(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

async function avviaWorkflow(): Promise<{ ok: boolean; motivo?: string }> {
  const token = Deno.env.get("GITHUB_TOKEN_ANALIZZA");
  if (!token) return { ok: false, motivo: "manca il segreto GITHUB_TOKEN_ANALIZZA" };
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "analizza-cloud",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: RAMO }),
  });
  await r.body?.cancel();
  return r.status === 204 ? { ok: true } : { ok: false, motivo: `GitHub ha risposto ${r.status}` };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return risposta({ errore: "Metodo non consentito." }, 405);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return risposta({ errore: "Richiesta non valida." }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const chiave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chiave) return risposta({ errore: "Servizio non configurato." }, 500);
  const db = createClient(url, chiave, { auth: { persistSession: false } });

  try {
    if (corpo.azione === "sveglia") {
      const { data: serve, error } = await db.rpc("analizza_cloud_sveglia");
      if (error) return risposta({ errore: "Database non raggiungibile." }, 500);
      if (!serve) return risposta({ ok: true, avviato: false });
      const esito = await avviaWorkflow();
      if (!esito.ok) {
        // l'avvio non e' partito: libero il turno, cosi' si riprova al prossimo minuto
        await db.from("ponte_stato").update({ ultimo_avvio_cloud: null }).eq("id", 1);
        console.log("Avvio del cloud non riuscito: " + esito.motivo);
        return risposta({ ok: false, avviato: false, motivo: esito.motivo }, 502);
      }
      return risposta({ ok: true, avviato: true });
    }

    // Da qui in poi solo il workflow GitHub, con il codice segreto.
    const segreto = Deno.env.get("ANALIZZA_CLOUD_CODICE");
    if (!segreto) return risposta({ errore: "Segreto ANALIZZA_CLOUD_CODICE non impostato." }, 503);
    if (!uguali(req.headers.get("x-codice") ?? "", segreto)) {
      await new Promise((r) => setTimeout(r, 1000));
      return risposta({ errore: "Codice non corretto." }, 401);
    }

    switch (corpo.azione) {
      case "prendi": {
        const { data, error } = await db.rpc("prendi_analisi_cloud");
        if (error) return risposta({ errore: "Database non raggiungibile." }, 500);
        const riga = Array.isArray(data) && data.length ? data[0] : null;
        return risposta({ ok: true, riga: riga ? { id: riga.id, link: riga.link } : null });
      }
      case "fatto": {
        const id = idValido(corpo.id);
        const report = testo(corpo.report, MAX_REPORT);
        if (!id || !report) return risposta({ errore: "Dati mancanti." }, 400);
        const { data, error } = await db.from("coda_analisi")
          .update({ stato: "fatto", report, errore: null, cloud_nota: null, finito_il: new Date().toISOString() })
          .eq("id", id).eq("stato", "in_lavoro").eq("lavorato_da", "cloud").select("id");
        if (error) return risposta({ errore: "Database non raggiungibile." }, 500);
        return risposta({ ok: true, aggiornato: (data ?? []).length > 0 });
      }
      case "rimanda": {
        const id = idValido(corpo.id);
        if (!id) return risposta({ errore: "Dati mancanti." }, 400);
        const motivo = testo(corpo.motivo, 500) || "Il cloud non ce l'ha fatta.";
        const { error } = await db.from("coda_analisi")
          .update({ stato: "in_attesa", preso_il: null, lavorato_da: null,
                    cloud_nota: motivo + " Lo fara' il PC quando lo accendi." })
          .eq("id", id).eq("stato", "in_lavoro").eq("lavorato_da", "cloud");
        if (error) return risposta({ errore: "Database non raggiungibile." }, 500);
        return risposta({ ok: true });
      }
      default:
        return risposta({ errore: "Azione non riconosciuta." }, 400);
    }
  } catch {
    return risposta({ errore: "Qualcosa non ha funzionato." }, 500);
  }
});
