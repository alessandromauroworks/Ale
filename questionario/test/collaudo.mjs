// Lancia tutti i collaudi del questionario uno dopo l'altro e scrive il totale.
//   node questionario/test/collaudo.mjs            (avvia da solo un piccolo server sulla porta 8800)
//   node questionario/test/collaudo.mjs 06 08      (solo i collaudi che iniziano con 06 e 08)
// Con BASE_URL=http://localhost:PORTA usa un server già acceso (la cartella servita è la radice del repo).
// La rete esterna è sempre bloccata: nessun dato vero parte verso Supabase o WhatsApp.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const qui = dirname(fileURLToPath(import.meta.url));
const radice = resolve(qui, "../..");
const filtro = process.argv.slice(2);
const file = readdirSync(qui).filter((f) => /^\d\d-.*\.cjs$/.test(f) && (!filtro.length || filtro.some((x) => f.startsWith(x)))).sort();

let server = null;
let base = process.env.BASE_URL;
if (!base) {
  base = "http://localhost:8800";
  server = spawn("python3", ["-m", "http.server", "8800", "--bind", "127.0.0.1", "--directory", radice], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base + "/questionario/")).ok) break; } catch (_) { /* ancora spento */ } await new Promise((r) => setTimeout(r, 250)); }
}
const lancia = (nome) => new Promise((ok) => {
  let out = "";
  const p = spawn(process.execPath, [join(qui, nome)], { env: { ...process.env, BASE_URL: base }, cwd: qui });
  const tempo = setTimeout(() => { out += "\nFAIL tempo scaduto (15 minuti)\n"; p.kill("SIGKILL"); }, 15 * 60 * 1000);
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
  p.on("close", (codice) => { clearTimeout(tempo); ok({ out, codice }); });
});
let passati = 0, falliti = 0;
for (const nome of file) {
  const { out, codice } = await lancia(nome);
  const p = (out.match(/^PASS /gm) || []).length, f = (out.match(/^FAIL /gm) || []).length;
  const interrotto = codice !== 0 && f === 0;   // il collaudo si è fermato per un errore (non per un controllo fallito)
  passati += p; falliti += f + (interrotto ? 1 : 0);
  console.log(`${nome}: ${p} passati, ${f} falliti${interrotto ? ", INTERROTTO" : ""}`);
  for (const r of out.split("\n").filter((r) => /^FAIL /.test(r))) console.log("   " + r.slice(0, 300));
  if (interrotto) console.log("   " + out.split("\n").filter(Boolean).slice(-6).join("\n   ").slice(0, 800));
}
if (server) server.kill();
console.log(`\nTOTALE: ${passati + falliti} controlli, ${passati} passati, ${falliti} falliti`);
process.exit(falliti ? 1 : 0);
