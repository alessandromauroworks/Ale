// Prova locale della copia per email di «questionario-ricevi» (Resend simulato, nessuna rete, nessun deploy).
// Si lancia con:  node --experimental-strip-types automazioni/supabase/prove/email.test.mts
// Legge il blocco tra «INIZIO EMAIL» e «FINE EMAIL» di ../questionario-ricevi/index.ts e lo prova con un fetch finto.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url));
const sorgente = readFileSync(join(qui, "../questionario-ricevi/index.ts"), "utf8");
const blocco = sorgente.slice(sorgente.indexOf("// ==== INIZIO EMAIL ===="), sorgente.indexOf("// ==== FINE EMAIL ===="));
const cartella = mkdtempSync(join(tmpdir(), "email-prova-"));
writeFileSync(join(cartella, "email.mts"), blocco);
const { costruisciEmail, inviaCopia } = await import(join(cartella, "email.mts"));
let fails = 0; const ok = (n: string, c: boolean, x = "") => { console.log((c ? "PASS " : "FAIL ") + n + (x ? " " + x : "")); if (!c) fails++; };
const d = { nome: "Anna <b>Prova</b>", attivita: "Studio <script>alert(1)</script>", s: "Studio dentistico", servizi: ["Sito internet nuovo o rifatto", "Automazioni (promemoria)"], problemi: "Telefono sempre occupato & \"clienti\" persi", contatto: "Email", email: "anna@azienda.it", copiaEmail: true, consenso: { v: "x", data: "2026-11-13" }, pacchetto: { standard: "solo-sito", suMisura: [] } };
const env = { RESEND_API_KEY: "re_test", MITTENTE_EMAIL: "info@esempio.it" };
const log: string[] = []; const reg = (e: string, dett = "") => log.push(e + ":" + dett);
// 1. invio ok
let chiamate: any[] = []; const fakeOk: any = async (u: string, o: any) => { chiamate.push([u, o]); return { ok: true, status: 200 }; };
await inviaCopia(d, env, fakeOk, reg);
ok("invia a Resend con Bearer e destinatario", chiamate.length === 1 && chiamate[0][0] === "https://api.resend.com/emails" && chiamate[0][1].headers.Authorization === "Bearer re_test" && JSON.parse(chiamate[0][1].body).to[0] === "anna@azienda.it");
const corpo = JSON.parse(chiamate[0][1].body);
ok("HTML con escape (niente tag dell'utente)", !corpo.html.includes("<script") && !corpo.html.includes("<b>Prova") && corpo.html.includes("&lt;script&gt;"));
ok("testo in italiano con contatti e cancellazione", /grazie/.test(corpo.text) && /339 405 2935/.test(corpo.text) && /cancelli le tue risposte/.test(corpo.text) && corpo.from.includes("info@esempio.it"));
ok("log: solo esito, nessun dato personale", log.join("|") === "email_inviata:" && !log.join().includes("anna"));
// 2. senza chiavi
log.length = 0; chiamate = []; await inviaCopia(d, {}, fakeOk, reg); ok("senza secrets: salta in silenzio", chiamate.length === 0 && log[0] === "email_saltata:senza_chiavi");
log.length = 0; await inviaCopia({ ...d, copiaEmail: false }, env, fakeOk, reg); ok("casella non spuntata: salta", chiamate.length === 0 && log[0] === "email_saltata:non_richiesta");
log.length = 0; await inviaCopia({ ...d, email: "non-valida" }, env, fakeOk, reg); ok("email non valida: salta", chiamate.length === 0 && log[0] === "email_saltata:email_non_valida");
log.length = 0; await inviaCopia({ ...d, email: "a@b.it\r\nBcc: x@y.it" }, env, fakeOk, reg); ok("email con a capo (iniezione): salta", chiamate.length === 0 && log[0] === "email_saltata:email_non_valida");
log.length = 0; await inviaCopia({ ...d, consenso: undefined }, env, fakeOk, reg); ok("senza consenso: salta", chiamate.length === 0 && log[0] === "email_saltata:senza_consenso");
// 3. errori: mai eccezioni
log.length = 0; const fake500: any = async () => ({ ok: false, status: 500 }); await inviaCopia(d, env, fake500, reg); ok("errore 500 solo nel log", log[0] === "email_errore:stato 500");
log.length = 0; const fakeRete: any = async () => { throw new Error("rete segreta anna@azienda.it"); }; await inviaCopia(d, env, fakeRete, reg); ok("errore di rete: log senza dettagli personali", log[0] === "email_errore:rete");
log.length = 0; const fakeLento: any = (_u: string, o: any) => new Promise((_r, rej) => { o.signal.addEventListener("abort", () => { const e = new Error("x"); e.name = "AbortError"; rej(e); }); });
const t0 = Date.now(); await inviaCopia(d, env, fakeLento, reg); const ms = Date.now() - t0; ok("timeout 5 s", log[0] === "email_errore:timeout" && ms >= 4900 && ms < 6500, ms + " ms");
const privato = costruisciEmail({ nome: "Luca", ruolo: "Privato", attivita: "Privato", s: "Privato (per me o la mia famiglia)", contatto: "Telefono (anche fisso)" });
ok("privato: niente riga Attività", !/Attività:/.test(privato.testo));
const privServ = costruisciEmail({ nome: "Luca", ruolo: "Privato", s: "Privato (per me o la mia famiglia)", servizi: ["Sito internet nuovo o rifatto", "Gestionale fatto su misura per noi", "Automazioni (promemoria, messaggi, documenti che si fanno da soli)", "Video e foto per l'attività", "Gestionale (clienti, appuntamenti, pagamenti, magazzino)", "Fogli Excel, Google Fogli o file CSV"] });
ok("privato: nomi dei servizi personali", /Ti serve: Sito personale o portfolio; App o programma su misura; Automazioni personali; Video e foto per il mio progetto; Fogli Excel/.test(privServ.testo), privServ.testo);
ok("privato: email senza parole aziendali", !/clienti|attività|titolare|pazienti|Gestionale/i.test(privServ.testo.replace("Fogli Excel, Google Fogli o file CSV", "")), privServ.testo);
const azienda = costruisciEmail({ nome: "Luca", ruolo: "Titolare o socio", servizi: ["Gestionale fatto su misura per noi"] });
ok("azienda: nomi dei servizi invariati", /Ti serve: Gestionale fatto su misura per noi/.test(azienda.testo));
console.log("FAILS", fails); if (fails) Deno_exit();
function Deno_exit() { (globalThis as any).process.exitCode = 1; }
