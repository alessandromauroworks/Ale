// Edge Function "analizza-coda": collega la pagina del telefono alla tabella public.coda_analisi.
// Protezione: header x-codice uguale al segreto ANALIZZA_CODICE.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINI_OK = ["https://alessandromauroworks.github.io"];
const DOMINI_OK = [
  "instagram.com", "youtube.com", "youtu.be", "tiktok.com", "vm.tiktok.com",
  "facebook.com", "fb.watch", "x.com", "twitter.com", "threads.net",
];

function originePermessa(origin: string | null): string | null {
  if (!origin) return null;
  if (ORIGINI_OK.includes(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return null;
}

function intestazioni(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Headers": "content-type, x-codice",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const ok = originePermessa(origin);
  if (ok) h["Access-Control-Allow-Origin"] = ok;
  return h;
}

function risposta(corpo: unknown, stato: number, origin: string | null): Response {
  return new Response(JSON.stringify(corpo), { status: stato, headers: intestazioni(origin) });
}

// Confronto a tempo costante (non si scopre il codice dai tempi di risposta).
function uguali(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function linkValido(testo: unknown): string | null {
  if (typeof testo !== "string") return null;
  const t = testo.trim();
  if (t.length === 0 || t.length > 500) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const ok = DOMINI_OK.some((d) => host === d || host.endsWith("." + d));
  return ok ? t : null;
}

function idValido(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const COLONNE_ELENCO = "id, link, rifai, solo_video, stato, errore, creato_il, preso_il, finito_il, video_iphone, lavorato_da, cloud_nota";
const COLONNE_SENZA_REPORT = "id, link, rifai, solo_video, stato, errore, richiesto_da, creato_il, preso_il, finito_il";
const CARTELLA_VIDEO = "analizza-video";
const DURATA_LINK_SECONDI = 60 * 60; // i link per guardare/scaricare il video valgono un'ora

function nomeFile(v: unknown, riserva: string): string {
  const t = typeof v === "string" ? v.replace(/[^\w.\-]+/g, "_").slice(0, 80) : "";
  return t || riserva;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: intestazioni(origin) });
  }
  if (req.method !== "POST") {
    return risposta({ errore: "Metodo non consentito." }, 405, origin);
  }

  const segreto = Deno.env.get("ANALIZZA_CODICE");
  if (!segreto) {
    return risposta({ errore: "Codice non ancora impostato su Supabase (segreto ANALIZZA_CODICE)" }, 503, origin);
  }
  const codice = req.headers.get("x-codice") ?? "";
  if (!uguali(codice, segreto)) {
    // Ritardo di 1 secondo: rende inutile provare tanti codici.
    await new Promise((r) => setTimeout(r, 1000));
    return risposta({ errore: "Codice non corretto." }, 401, origin);
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return risposta({ errore: "Richiesta non valida." }, 400, origin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const chiave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chiave) {
    return risposta({ errore: "Servizio non configurato." }, 500, origin);
  }
  const db = createClient(url, chiave, { auth: { persistSession: false } });
  const guasto = () => risposta({ errore: "Qualcosa non ha funzionato, riprova tra poco." }, 500, origin);

  try {
    switch (corpo.azione) {
      case "ping": {
        // Il ponte sul PC manda un «battito» a ogni giro (ogni 30 s circa).
        // PC collegato = battito arrivato negli ultimi 2 minuti.
        const { data, error } = await db.from("ponte_stato").select("ultimo_battito").eq("id", 1).maybeSingle();
        if (error) return guasto();
        const ultimo = data?.ultimo_battito ? Date.parse(data.ultimo_battito as string) : 0;
        const ponteAttivo = Date.now() - ultimo < 2 * 60 * 1000;
        return risposta({ ok: true, ponte_attivo: ponteAttivo, ultimo_battito: data?.ultimo_battito ?? null }, 200, origin);
      }

      case "aggiungi": {
        const link = linkValido(corpo.link);
        if (!link) {
          return risposta({ errore: "Link non valido. Serve un link di Instagram, YouTube, TikTok, Facebook, X o Threads." }, 400, origin);
        }
        const { data, error } = await db.from("coda_analisi")
          .insert({ link, rifai: corpo.rifai === true, solo_video: corpo.solo_video === true,
                    stato: "in_attesa", richiesto_da: "telefono" })
          .select(COLONNE_SENZA_REPORT).single();
        if (error) return guasto();
        return risposta({ ok: true, riga: data }, 200, origin);
      }

      case "elenco": {
        let limite = Number(corpo.limite ?? 20);
        if (!Number.isFinite(limite) || limite < 1) limite = 20;
        limite = Math.min(Math.floor(limite), 50);
        const { data, error } = await db.from("coda_analisi")
          .select(COLONNE_ELENCO + ", report_presente:report")
          .order("creato_il", { ascending: false }).limit(limite);
        if (error) return guasto();
        // Non mandiamo il testo del report: solo se esiste.
        const righe = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
          const { report_presente, video_iphone, ...resto } = r;
          return { ...resto, ha_report: typeof report_presente === "string" && report_presente.length > 0,
                   ha_video: typeof video_iphone === "string" && video_iphone.length > 0 };
        });
        return risposta({ ok: true, righe }, 200, origin);
      }

      case "report": {
        const id = idValido(corpo.id);
        if (!id) return risposta({ errore: "Numero analisi non valido." }, 400, origin);
        const { data, error } = await db.from("coda_analisi").select("*").eq("id", id).maybeSingle();
        if (error) return guasto();
        if (!data) return risposta({ errore: "Analisi non trovata." }, 404, origin);
        // Link firmati (validi un'ora) per guardare e scaricare il video dalla cartella privata.
        const { video_originale, video_iphone, video_info, ...riga } = data as Record<string, unknown>;
        const info = (video_info ?? {}) as Record<string, unknown>;
        const firma = async (percorso: unknown, scarica?: string) => {
          if (typeof percorso !== "string" || !percorso) return null;
          const { data: f, error: e } = await db.storage.from(CARTELLA_VIDEO)
            .createSignedUrl(percorso, DURATA_LINK_SECONDI, scarica ? { download: scarica } : undefined);
          return e ? null : f.signedUrl;
        };
        const video = (video_originale || video_iphone) ? {
          anteprima: await firma(video_iphone || video_originale),
          originale: await firma(video_originale, nomeFile(info.nome_originale, "video_originale.mp4")),
          iphone: await firma(video_iphone, nomeFile(info.nome_iphone, "video_iphone.mp4")),
          stesso_file: video_originale === video_iphone,
          info,
        } : (info.nota ? { info } : null);
        return risposta({ ok: true, riga, video }, 200, origin);
      }

      case "riprova": {
        const id = idValido(corpo.id);
        if (!id) return risposta({ errore: "Numero analisi non valido." }, 400, origin);
        const { data, error } = await db.from("coda_analisi")
          .update({ stato: "in_attesa", errore: null, preso_il: null, finito_il: null, lavorato_da: null, cloud_nota: null })
          .eq("id", id).select(COLONNE_SENZA_REPORT).maybeSingle();
        if (error) return guasto();
        if (!data) return risposta({ errore: "Analisi non trovata." }, 404, origin);
        return risposta({ ok: true, riga: data }, 200, origin);
      }

      case "elimina": {
        // Toglie una riga dalla coda. Non quella che il PC sta analizzando in questo momento.
        const id = idValido(corpo.id);
        if (!id) return risposta({ errore: "Numero analisi non valido." }, 400, origin);
        const { data, error } = await db.from("coda_analisi")
          .delete().eq("id", id).neq("stato", "in_lavoro").select("id, video_originale, video_iphone");
        if (error) return guasto();
        if (!data || !data.length) {
          const { data: esiste } = await db.from("coda_analisi").select("id").eq("id", id).maybeSingle();
          if (esiste) return risposta({ errore: "Il PC ci sta lavorando adesso: aspetta che finisca, poi eliminalo." }, 409, origin);
          return risposta({ errore: "Analisi non trovata." }, 404, origin);
        }
        // Via anche i video di questa riga (se la cancellazione dei file non riesce, la riga resta tolta lo stesso).
        const file = [...new Set(data.flatMap((r: Record<string, unknown>) =>
          [r.video_originale, r.video_iphone].filter((x): x is string => typeof x === "string" && x.length > 0)))];
        if (file.length) await db.storage.from(CARTELLA_VIDEO).remove(file).catch(() => {});
        return risposta({ ok: true }, 200, origin);
      }

      default:
        return risposta({ errore: "Azione non riconosciuta." }, 400, origin);
    }
  } catch {
    return guasto();
  }
});
