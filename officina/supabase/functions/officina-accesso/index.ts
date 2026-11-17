// Accesso al pannello Officina con un codice di 6 cifre.
// Il controllo del codice e i blocchi stanno nella funzione SQL public.officina_controlla_codice.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGINI = ["https://alessandromauroworks.github.io", "http://localhost:8777"];

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  const h: Record<string, string> = { "Vary": "Origin" };
  if (ORIGINI.includes(o)) {
    h["Access-Control-Allow-Origin"] = o;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "content-type, apikey, authorization, x-client-info";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}
function rispondi(req: Request, stato: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return rispondi(req, 405, { errore: "metodo" });

  let codice = "";
  try {
    const b = await req.json();
    codice = typeof b?.codice === "string" ? b.codice : "";
  } catch (_) { /* resta vuoto */ }
  if (!/^\d{6}$/.test(codice)) return rispondi(req, 400, { errore: "formato" });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: r, error } = await admin.rpc("officina_controlla_codice", { p_codice: codice });
    if (error || !r) throw error || new Error("rpc");

    switch (r.esito) {
      case "formato": return rispondi(req, 400, { errore: "formato" });
      case "non_impostato": return rispondi(req, 503, { errore: "codice_non_impostato" });
      case "bloccato": return rispondi(req, 429, { errore: "bloccato", minuti: r.minuti });
      case "sbagliato": return rispondi(req, 401, { errore: "sbagliato", rimasti: r.rimasti });
      case "ok": break;
      default: throw new Error("esito");
    }

    const { data: link, error: e3 } = await admin.auth.admin.generateLink({ type: "magiclink", email: r.account });
    if (e3 || !link?.properties?.hashed_token) throw e3 || new Error("link");
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: ses, error: e4 } = await anon.auth.verifyOtp({
      token_hash: link.properties.hashed_token, type: "magiclink",
    });
    if (e4 || !ses?.session) throw e4 || new Error("sessione");
    return rispondi(req, 200, {
      access_token: ses.session.access_token,
      refresh_token: ses.session.refresh_token,
    });
  } catch (_) {
    return rispondi(req, 500, { errore: "interno" });
  }
});
