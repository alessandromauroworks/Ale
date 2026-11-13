// Prova locale di «questionario-ricevi» SENZA Supabase e senza rete: la funzione vera (index.ts) gira con un database finto in memoria.
// La lancia 10-dati-funzione.cjs con:  node --experimental-strip-types questionario/test/prova-funzione.mts <file-dati.json>
// Stampa righe PASS/FAIL come gli altri collaudi. Il file di dati contiene i «d» veri prodotti dalla pagina (per percorso).
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const qui = dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (n: string, c: boolean, x = "") => { console.log((c ? "PASS " : "FAIL ") + n + (x ? " " + x : "")); if (!c) fails++; };

// ---- database finto: tabelle in memoria, filtri eq / gte (anche «risposte->>chiave»), count head, insert, update
type Riga = Record<string, any>;
const db: Record<string, Riga[]> = { questionari: [], questionari_limiti: [], questionari_log: [] };
const campo = (r: Riga, c: string) => { const m = c.match(/^(\w+)->>(\w+)$/); return m ? (r[m[1]] && r[m[1]][m[2]] != null ? String(r[m[1]][m[2]]) : null) : r[c]; };
class Q {
  op = "select"; filtri: ((r: Riga) => boolean)[] = []; val: any = null; t: string; constructor(t: string) { this.t = t; }
  select() { this.op = "select"; return this; }
  insert(v: Riga) { this.op = "insert"; this.val = v; return this; }
  update(v: Riga) { this.op = "update"; this.val = v; return this; }
  eq(c: string, v: unknown) { this.filtri.push((r) => campo(r, c) === v); return this; }
  gte(c: string, v: string) { this.filtri.push((r) => String(campo(r, c)) >= v); return this; }
  then(ok: (x: any) => void, ko?: (e: unknown) => void) {
    try {
      const tab = db[this.t] ||= [];
      const scelte = () => tab.filter((r) => this.filtri.every((f) => f(r)));
      if (this.op === "insert") { tab.push({ id: tab.length + 1, creato_il: new Date().toISOString(), ...JSON.parse(JSON.stringify(this.val)) }); return ok({ error: null }); }
      if (this.op === "update") { scelte().forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(this.val)))); return ok({ error: null }); }
      return ok({ count: scelte().length, error: null });
    } catch (e) { return ko ? ko(e) : undefined; }
  }
}
(globalThis as any).__creaClient = () => ({ from: (t: string) => new Q(t) });
let gestore: ((r: Request) => Promise<Response>) | null = null;
(globalThis as any).Deno = { env: { get: (k: string) => ({ SUPABASE_URL: "http://finto", SUPABASE_SERVICE_ROLE_KEY: "chiave-finta-solo-per-la-prova-0123456789abcdef" } as Record<string, string>)[k] }, serve: (h: any) => { gestore = h; } };

const sorgente = readFileSync(join(qui, "../../automazioni/supabase/questionario-ricevi/index.ts"), "utf8")
  .replace(/^import \{ createClient \} from "jsr:@supabase\/supabase-js@2";$/m, "const createClient = (globalThis as any).__creaClient;");
const cartella = mkdtempSync(join(tmpdir(), "funzione-prova-"));
writeFileSync(join(cartella, "funzione.mts"), sorgente);
const F = await import(join(cartella, "funzione.mts"));
ok("la funzione si carica e registra il gestore", typeof gestore === "function");

const ORIG = "https://alessandromauroworks.github.io";
let ipN = 0;
const manda = async (corpo: unknown, o: { origin?: string; ip?: string } = {}) => {
  const r = await gestore!(new Request("http://finto/questionario-ricevi", { method: "POST", headers: { origin: o.origin ?? ORIG, "content-type": "application/json", "cf-connecting-ip": o.ip || "10.0.0." + (++ipN) }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }));
  return { stato: r.status, corpo: await r.json() };
};
const uguali = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const differenze = (a: any, b: any, p = "d", out: string[] = []) => {
  if (a && typeof a === "object") { if (!b || typeof b !== "object") { out.push(p); return out; } for (const k of Object.keys(a)) { if (!(k in b)) out.push(p + "." + k + " (scartata)"); else differenze(a[k], b[k], p + "." + k, out); } if (Array.isArray(a) && a.length !== b.length) out.push(p + " (lunghezza)"); }
  else if (a !== b) out.push(p + (typeof a === "string" ? " (" + a.length + " -> " + (typeof b === "string" ? b.length : b) + ")" : ""));
  return out;
};

// ---- 1. i dati veri della pagina passano la pulizia SENZA perdere niente
const percorsi = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, { d: Record<string, unknown>; codice: string; byte: number }>;
for (const [nome, p] of Object.entries(percorsi)) {
  const pul = F.risposteDa(p.d), diff = differenze(p.d, pul);
  ok(`pulizia senza perdite: ${nome}`, diff.length === 0, diff.slice(0, 6).join(", "));
  ok(`codice accettato dalla funzione: ${nome}`, F.CODICE_VALIDO.test(p.codice), p.codice.slice(0, 4) + " " + p.codice.length);
  ok(`corpo sotto i 48 KB della funzione: ${nome}`, p.byte <= 48_000, p.byte + " byte");
}

// ---- 2. pulizia: limiti e protezioni restano
const lungo = "😀".repeat(2500);
const t = F.pulisci(lungo) as string;
ok("testo lunghissimo: tagliato a 2000 caratteri veri, mai un'emoji a metà", Array.from(t).length === 2000 && !/[\ud800-\udbff](?![\udc00-\udfff])/.test(t));
ok("pezzo di emoji isolato tolto (non rompe jsonb)", F.pulisci("ab\ud83dcd") === "abcd");
ok("chiavi strane scartate (spazi, numeri, troppo lunghe)", uguali(F.pulisci({ "a b": 1, a1: 2, ["x".repeat(21)]: 3, buona: 4 }), { buona: 4 }));
ok("profondità oltre 4: null (d.pk.piani[].servizi[] a livello 4 resta)", uguali(F.pulisci({ a: { b: { c: { d: { e: 1 } } } } }), { a: { b: { c: { d: { e: null } } } } }));
ok("array oltre 40 elementi: tagliato", (F.pulisci(Array(60).fill(1)) as unknown[]).length === 40);
ok("campi sconosciuti di primo livello scartati", !("cattivo" in F.risposteDa({ v: 1, cattivo: "x", nome: "Anna" })));
ok("sessione non valida scartata", !("sessione" in F.risposteDa({ v: 1, sessione: "<script>" })) && F.risposteDa({ v: 1, sessione: "a".repeat(32) }).sessione === "a".repeat(32));
ok("codice: QC1 e QC2 sì, altri no", F.CODICE_VALIDO.test("QC1." + "A".repeat(30)) && F.CODICE_VALIDO.test("QC2." + "a_-9".repeat(10)) && !F.CODICE_VALIDO.test("QC3." + "A".repeat(30)) && !F.CODICE_VALIDO.test("QC2.corto") && !F.CODICE_VALIDO.test("QC2." + "A".repeat(30) + "="));

// ---- 3. il gestore intero, con il database finto
const base = (x: Record<string, unknown> = {}) => ({ v: 1, s: "Studio dentistico", nome: "Anna Prova", attivita: "Studio Rossi", tel: "+39 06 1234 5678", consenso: { v: "2026-11-08", data: "2026-11-13T10:00:00Z" }, ...x });
const pacco = (d: Record<string, unknown>) => ({ d, codice: "QC2." + "A".repeat(40), hp: "" });
const sesA = "a".repeat(32), sesB = "b".repeat(32);
let r = await manda(pacco(base({ sessione: sesA, problemi: "prima versione" })));
ok("primo invio salvato", r.stato === 200 && db.questionari.length === 1, JSON.stringify(r.corpo));
ok("telefono fisso con spazi e +39 accettato", db.questionari[0] && db.questionari[0].telefono === "+39 06 1234 5678");
r = await manda(pacco(base({ sessione: sesA, problemi: "versione completa" })));
ok("stessa sessione entro 10 minuti: aggiorna la stessa riga", r.stato === 200 && db.questionari.length === 1 && db.questionari[0].risposte.problemi === "versione completa");
r = await manda(pacco(base({ sessione: sesB, problemi: "SOVRASCRITTO DA UN ESTRANEO" })));
ok("estraneo con stesso telefono e attività ma altra sessione: NON sovrascrive", db.questionari[0].risposte.problemi === "versione completa" && db.questionari.length === 2);
r = await manda(pacco(base({ problemi: "senza sessione" })));
ok("invio senza sessione (pagina vecchia): riga nuova, nessuna sovrascrittura", db.questionari[0].risposte.problemi === "versione completa" && db.questionari.length === 3);
r = await manda(pacco(base({ sessione: sesA, problemi: "quarto" })));
ok("limite di 3 al giorno per numero ancora attivo", r.stato === 429);
r = await manda(pacco(base({ tel: "339 222 3333", v: 2 })));
ok("d.v diverso da 1: rifiutato", r.stato === 400 && r.corpo.errore === "risposte");
r = await manda({ ...pacco(base({ tel: "339 222 3334" })), codice: "QC9.xxxxxxxxxxxxxxxxxxxxxxxxx" });
ok("codice non valido: rifiutato", r.stato === 400 && r.corpo.errore === "codice");
r = await manda({ ...pacco(base({ tel: "339 222 3335" })), hp: "bot" });
ok("trappola anti-bot piena: rifiutato", r.stato === 400);
r = await manda(pacco(base({ tel: "339 222 3336" })), { origin: "https://cattivo.example" });
ok("origine non permessa: 403", r.stato === 403);
r = await manda(JSON.stringify({ ...pacco(base({ tel: "339 222 3337" })), riempi: "x".repeat(49_000) }));
ok("corpo oltre 48 KB: 413", r.stato === 413);
const lunghi = base({ tel: "339 222 3338", problemi: "è".repeat(1990) + "😀".repeat(10) });
r = await manda(pacco(lunghi));
const salvata = db.questionari[db.questionari.length - 1].risposte.problemi as string;
ok("problemi di 2000 caratteri con emoji salvati interi", r.stato === 200 && salvata === lunghi.problemi, String(Array.from(salvata || "").length));

console.log("FAILS", fails);
(globalThis as any).process.exitCode = fails ? 1 : 0;
