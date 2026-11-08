// Prova completa di Cacciasconti con Chromium vero e tre negozi finti.
// Uso: node test/run.js [--screenshot]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
global.self = global; require('../estrattore.js'); // per provare l'estrattore anche senza browser
const { crea } = require('./server');

const EXT = path.resolve(__dirname, '..');
const FOTO = process.argv.includes('--screenshot');
let ok = 0, ko = 0;
const verifica = (nome, cond, dettaglio) => {
  if (cond) { ok++; console.log('  PASS  ' + nome); }
  else { ko++; console.log('  FAIL  ' + nome + (dettaglio !== undefined ? '  -> ' + JSON.stringify(dettaglio) : '')); }
};
const http = require('http');
// Node non risolve *.localhost: ci colleghiamo a 127.0.0.1 con l'intestazione Host giusta
const leggiUrl = (u) => new Promise((ok, no) => { const x = new URL(u); http.get({ host: '127.0.0.1', port: x.port, path: x.pathname + x.search, headers: { host: x.host } }, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => ok(b)); }).on('error', no); });
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
async function finche(fn, ms, passo = 200) {
  const fine = Date.now() + ms;
  let v;
  while (Date.now() < fine) { try { v = await fn(); if (v) return v; } catch (e) {} await dorme(passo); }
  return v;
}

(async () => {
  const server = crea();
  await new Promise((r) => server.listen(0, r));
  const porta = server.address().port;
  const url = (h, p) => `http://${h}.localhost:${porta}${p}`;
  // Secondo server su un'altra porta e un altro nome: serve per i frame di un altro sito (cross-origin)
  const server2 = crea();
  await new Promise((r) => server2.listen(0, r));
  const porta2 = server2.address().port;
  const url2 = (h, p) => `http://${h}.localhost:${porta2}${p}`;

  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: ['--headless=new', '--no-proxy-server', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    viewport: { width: 1280, height: 800 }
  });
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
  const extId = new URL(sw.url()).host;
  console.log('Estensione caricata, id =', extId);
  const archivio = () => sw.evaluate(() => chrome.storage.local.get(['archivio', 'storico', 'nascosti']));
  const idScheda = (pattern) => sw.evaluate(async (p) => (await chrome.tabs.query({ url: p }))[0].id, pattern);
  const badge = (id) => sw.evaluate((i) => chrome.action.getBadgeText({ tabId: i }), id);
  const sessione = (id) => sw.evaluate(async (i) => (await chrome.storage.session.get('test_' + i))['test_' + i] || null, id);

  const util = await ctx.newPage();
  await util.goto(`chrome-extension://${extId}/domain.js`);
  const msgExt = (m) => util.evaluate((x) => new Promise((r) => chrome.runtime.sendMessage(x, r)), m);
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: true, maxCodici: 8 } }));

  async function attendiFine(id) {
    return finche(async () => { const s = await sessione(id); return s && s.concluso ? s : null; }, 120000, 300);
  }
  async function apriPopup(id) {
    const p = await ctx.newPage();
    await p.goto(`chrome-extension://${extId}/popup.html?tab=${id}`);
    return p;
  }
  const testoOverlay = (page) => page.evaluate(() => { const h = document.getElementById('cacciasconti-overlay'); return h ? h.shadowRoot.textContent : ''; });
  const testoScheda = (page) => page.evaluate(() => { const h = document.getElementById('cacciasconti-scheda'); return h ? h.shadowRoot.textContent : ''; });
  const conCodice = async (dom, code) => ((await archivio()).archivio[dom] || {})[code];

  // ================= (a) WooCommerce finto, con ricaricamento =================
  console.log('\n[a] WooCommerce finto (la pagina si ricarica a ogni codice)');
  const woo = await ctx.newPage();
  await woo.goto(url('woo', '/cart'));
  verifica('Cercatore: trova ESTATE20 nel testo della pagina', await finche(async () => await conCodice('woo.localhost', 'ESTATE20'), 8000));
  verifica('Cercatore: non salva parole come CODICE/PROMO/ESTATE', !(await conCodice('woo.localhost', 'ESTATE')) && !(await conCodice('woo.localhost', 'PROMO')));
  const idWoo = await idScheda('*://woo.localhost/*');
  const scheda = woo.locator('#cacciasconti-scheda');
  verifica('Scheda automatica compare con "codici da provare"', await finche(async () => (await testoScheda(woo)).includes('codici da provare'), 8000));
  verifica('Badge della barra = 8 codici', await finche(async () => (await badge(idWoo)) === '8', 5000), await badge(idWoo));
  const t0 = Date.now();
  await scheda.locator('#vai').click();
  const sW = await attendiFine(idWoo);
  console.log(`  (durata ${Math.round((Date.now() - t0) / 1000)} s)`);
  verifica('Test concluso con codice trovato', sW && sW.concluso.tipo === 'ok' && sW.concluso.code === 'ESTATE20', sW && sW.concluso);
  verifica('Il sito ha ESTATE20 applicato (stato server)', (await woo.evaluate(async () => (await (await fetch('/__stato')).json()).coupon)) === 'ESTATE20');
  verifica('Pannello sulla pagina mostra "Risparmi 20,00 € con ESTATE20"', await finche(async () => (await testoOverlay(woo)).includes('Risparmi 20,00 € con ESTATE20'), 5000), await testoOverlay(woo));
  if (FOTO) {
    fs.mkdirSync(path.join(EXT, 'store'), { recursive: true });
    await woo.screenshot({ path: path.join(EXT, 'store', 'schermata-2-risultato.png') });
  }
  await woo.reload();
  verifica('Totale corretto 84,90 € (100 - 20% + 4,90 spedizione)', (await woo.locator('.order-total').first().textContent()).includes('84,90'), await woo.locator('.order-total').first().textContent());
  const aW = (await archivio());
  verifica('Archivio: ESTATE20 funziona, risparmio 20,00', (await conCodice('woo.localhost', 'ESTATE20')).esito === 'ok' && (await conCodice('woo.localhost', 'ESTATE20')).sconto === 20);
  verifica('Archivio: SCONTO10 funziona, risparmio 10,00 (confrontato e scartato)', (await conCodice('woo.localhost', 'SCONTO10')).sconto === 10);
  const w10 = await conCodice('woo.localhost', 'WELCOME10');
  verifica('Archivio: WELCOME10 fallito con motivo "non valido"', w10.esito === 'ko' && w10.motivo === 'non valido', w10);
  verifica('Storico: risparmio salvato (ESTATE20, 20)', aW.storico.some((x) => x.dominio === 'woo.localhost' && x.codice === 'ESTATE20' && x.risparmio === 20), aW.storico);
  verifica('Riepilogo con "codici provati in N s"', sW.concluso.provati === 8 && sW.concluso.secondi >= 1, sW.concluso);

  // ================= (b) SPA stile React =================
  console.log('\n[b] Negozio SPA (campo che reagisce solo agli eventi input, risposta lenta)');
  const spa = await ctx.newPage();
  await spa.goto(url('spa', '/'));
  verifica('Cercatore: trova ESTATE20 (testo in inglese "With code ...")', await finche(async () => await conCodice('spa.localhost', 'ESTATE20'), 8000));
  const idSpa = await idScheda('*://spa.localhost/*');
  const schedaSpa = spa.locator('#cacciasconti-scheda');
  verifica('Scheda automatica compare', await finche(async () => (await testoScheda(spa)).includes('da provare'), 8000));
  await schedaSpa.locator('#x').click();
  verifica('Chiudendo la scheda (x) il sito viene nascosto per 24 ore', await finche(async () => (await archivio()).nascosti && (await archivio()).nascosti['spa.localhost'], 3000));
  verifica('Scheda sparita dalla pagina', (await spa.locator('#cacciasconti-scheda').count()) === 0);
  const pSpa = await apriPopup(idSpa);
  verifica('Popup: pulsante "Genera sconto" attivo', await finche(async () => !(await pSpa.locator('#genera').isDisabled()), 8000));
  verifica('Popup: elenco mostra ESTATE20', (await pSpa.locator('#lista').textContent()).includes('ESTATE20'));
  await pSpa.locator('#genera').click();
  const sS = await attendiFine(idSpa);
  verifica('Test concluso con ESTATE20 come migliore', sS && sS.concluso.tipo === 'ok' && sS.concluso.code === 'ESTATE20', sS && sS.concluso);
  verifica('Totale finale £ 1,000.00', (await spa.locator('[data-testid=total]').textContent()) === '£ 1,000.00', await spa.locator('[data-testid=total]').textContent());
  verifica('Archivio: ESTATE20 sconto 250', (await conCodice('spa.localhost', 'ESTATE20')).sconto === 250, await conCodice('spa.localhost', 'ESTATE20'));
  verifica('Archivio: SCONTO10 sconto 125', (await conCodice('spa.localhost', 'SCONTO10')).sconto === 125);
  const b10 = await conCodice('spa.localhost', 'BENVENUTO10');
  verifica('Archivio: BENVENUTO10 fallito ("non valido")', b10.esito === 'ko' && b10.motivo === 'non valido', b10);
  verifica('Popup mostra il risultato "Risparmi 250,00"', await finche(async () => (await pSpa.locator('#risultato').textContent()).includes('Risparmi 250,00'), 5000), await pSpa.locator('#risultato').textContent());
  verifica('Popup: codice fallito mostrato con motivo', (await pSpa.locator('#lista').textContent()).includes('Non funziona (non valido)'));
  verifica('Valuta: il popup mostra il risparmio in sterline "-250,00 £" (non in euro)', (await pSpa.locator('#lista').textContent()).includes('-250,00 £') && !(await pSpa.locator('#lista').textContent()).includes('250,00 €'), await pSpa.locator('#lista').textContent());
  await pSpa.locator('.scheda[data-s=risparmi]').click();
  verifica('Popup "Risparmi": elenco con ESTATE20 e totale', await finche(async () => { const t = await pSpa.locator('#s-risparmi').textContent(); return t.includes('ESTATE20') && t.includes('spa.localhost'); }, 3000));
  verifica('Totale risparmiato diviso per valuta: 20,00 € + 250,00 £ (non si sommano euro e sterline)', (await pSpa.locator('#totale').textContent()) === '20,00 € + 250,00 £', await pSpa.locator('#totale').textContent());
  // Esporta / importa
  const dump = await msgExt({ type: 'esporta' });
  verifica('Esporta: JSON con archivio e storico', dump.dati.app === 'Cacciasconti' && dump.dati.archivio['spa.localhost'].ESTATE20 && dump.dati.storico.length >= 2);
  await sw.evaluate(() => chrome.storage.local.remove(['archivio']));
  const imp = await msgExt({ type: 'importa', dati: dump.dati });
  verifica('Importa: archivio ripristinato', imp.ok && (await conCodice('spa.localhost', 'ESTATE20')).sconto === 250);
  if (FOTO) {
    await pSpa.locator('.scheda[data-s=codici]').click();
    await pSpa.setViewportSize({ width: 1280, height: 800 });
    await pSpa.addStyleTag({ content: 'html{background:linear-gradient(135deg,#d9f3e8,#b8e6d3);min-height:100vh}body{margin:60px auto;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25)}' });
    await pSpa.screenshot({ path: path.join(EXT, 'store', 'schermata-1-popup.png') });
  }
  await pSpa.close();

  // ================= (c) campo nascosto dietro "Hai un codice sconto?" =================
  console.log('\n[c] Campo nascosto dietro un link; il codice è scritto nella home');
  const hid = await ctx.newPage();
  await hid.goto(url('hid', '/'));
  verifica('Cercatore: trova ESTATE20 nella home (banner)', await finche(async () => await conCodice('hid.localhost', 'ESTATE20'), 8000));
  await hid.goto(url('hid', '/checkout'));
  const idHid = await idScheda('*://hid.localhost/checkout');
  verifica('Scheda automatica compare anche col campo nascosto', await finche(async () => (await testoScheda(hid)).includes('da provare'), 8000));
  verifica('Badge della barra = 8', await finche(async () => (await badge(idHid)) === '8', 5000), await badge(idHid));
  const pHid = await apriPopup(idHid);
  verifica('Popup: pulsante attivo (campo dietro il link)', await finche(async () => !(await pHid.locator('#genera').isDisabled()), 8000));
  await pHid.locator('#genera').click();
  const sH = await attendiFine(idHid);
  verifica('Test concluso con ESTATE20', sH && sH.concluso.tipo === 'ok' && sH.concluso.code === 'ESTATE20', sH && sH.concluso);
  verifica('Totale finale 160,00 €', (await hid.locator('#tot').textContent()) === '160,00 €', await hid.locator('#tot').textContent());
  verifica('Campi email/CAP/codice fiscale non toccati', (await hid.locator('[name=email]').inputValue()) === '' && (await hid.locator('[name=cap]').inputValue()) === '' && (await hid.locator('[name=codice_fiscale]').inputValue()) === '');
  const hf = await conCodice('hid.localhost', 'WELCOME10');
  verifica('Archivio: WELCOME10 fallito con motivo', hf.esito === 'ko' && hf.motivo === 'non valido', hf);
  verifica('Pannello sulla pagina: "Risparmi 40,00 € con ESTATE20"', await finche(async () => (await testoOverlay(hid)).includes('Risparmi 40,00 € con ESTATE20'), 5000), await testoOverlay(hid));
  await pHid.close();

  // ================= Seconda esecuzione: i codici falliti vengono saltati =================
  console.log('\n[d] Ordine e salto dei codici falliti da poco');
  const coda = await msgExt({ type: 'coda', dominio: 'spa.localhost' });
  verifica('Coda: ESTATE20 per primo (risparmio maggiore), poi SCONTO10', coda.coda[0] === 'ESTATE20' && coda.coda[1] === 'SCONTO10', coda.coda);
  verifica('Coda: WELCOME10 (fallito da meno di 7 giorni) saltato', !coda.coda.includes('WELCOME10'), coda.coda);
  const rip = await msgExt({ type: 'coda', dominio: 'spa.localhost', riprova: true });
  verifica('"Riprova tutti": WELCOME10 torna nella coda', rip.coda.includes('WELCOME10'), rip.coda);


  // ================= Aiuto per le prove rapide (un solo codice buono + uno sbagliato) =================
  async function provaRapida(urlPagina, dominio, opz = {}) {
    await sw.evaluate((d) => chrome.storage.local.get('archivio').then((r) => { const a = r.archivio || {}; delete a[d]; return chrome.storage.local.set({ archivio: a }); }), dominio);
    await sw.evaluate(() => chrome.storage.local.get('opzioni').then((r) => chrome.storage.local.set({ opzioni: Object.assign({}, r.opzioni, { usaComuni: false, maxCodici: 8 }) })));
    const page = await ctx.newPage();
    await page.goto(urlPagina);
    const id = await sw.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u).id, urlPagina);
    if (opz.manuali !== false) await msgExt({ type: 'aggiungi', dominio, codice: 'ESTATE20' });
    else await finche(async () => await conCodice(dominio, 'ESTATE20'), 10000);
    if (opz.fallito !== false && opz.manuali !== false) await msgExt({ type: 'aggiungi', dominio, codice: 'PROVA99' });
    const stato = await finche(async () => { const r = await msgExt({ type: 'statoTab', tabId: id }); return r && r.campo ? r : null; }, 12000, 300);
    const av = stato ? await msgExt({ type: 'avviaTab', tabId: id }) : null;
    const st = stato ? await attendiFine(id) : null;
    return { page, id, stato, av, st, buono: await conCodice(dominio, 'ESTATE20'), cattivo: await conCodice(dominio, 'PROVA99') };
  }
  const buonoOk = (r, sconto) => !!(r.st && r.st.concluso.tipo === 'ok' && r.st.concluso.code === 'ESTATE20' && r.buono && r.buono.esito === 'ok' && r.buono.sconto === sconto);

  // ================= (e) Robustezza: pulsante spento finché non c'è testo =================
  console.log('\n[e] Pulsante "Applica" spento finché il campo è vuoto (si accende dopo la scrittura)');
  const rDis = await provaRapida(url('dis', '/'), 'dis.localhost');
  verifica('Pulsante spento: codice trovato e applicato (-20,00)', buonoOk(rDis, 20), rDis.st && rDis.st.concluso);
  verifica('Pulsante spento: totale finale 80,00 €', (await rDis.page.locator('#tot').textContent()) === '80,00 €');
  verifica('Pulsante spento: codice sbagliato riconosciuto ("non valido")', rDis.cattivo && rDis.cattivo.esito === 'ko' && rDis.cattivo.motivo === 'non valido', rDis.cattivo);
  await rDis.page.close();

  // ================= (f) Pulsanti che non sono <button> =================
  console.log('\n[f] Pulsante fatto con <a>, <div role=button>, <span onclick>');
  for (const [v, nome] of [['a', '<a> senza ruolo'], ['div', '<div role=button>'], ['span', '<span onclick> (testo inglese "Apply")']]) {
    const r = await provaRapida(url('btn', '/?v=' + v), 'btn.localhost');
    verifica('Pulsante ' + nome + ': codice applicato (-20,00)', buonoOk(r, 20), r.st && r.st.concluso);
    verifica('Pulsante ' + nome + ': totale finale 80,00 €', (await r.page.locator('#tot').textContent()) === '80,00 €');
    await r.page.close();
  }

  // ================= (g) Campo e pulsante ricreati a ogni lettera =================
  console.log('\n[g] Il sito ridisegna il campo (il riferimento all\'elemento diventa vecchio)');
  const rRer = await provaRapida(url('rer', '/'), 'rer.localhost');
  verifica('Campo ridisegnato: codice trovato e applicato (-20,00)', buonoOk(rRer, 20), rRer.st && rRer.st.concluso);
  verifica('Campo ridisegnato: totale finale 80,00 €', (await rRer.page.locator('#tot').textContent()) === '80,00 €');
  verifica('Campo ridisegnato: codice sbagliato riconosciuto', rRer.cattivo && rRer.cattivo.esito === 'ko' && rRer.cattivo.motivo === 'non valido', rRer.cattivo);
  await rRer.page.close();

  // ================= (h) Shadow DOM aperti =================
  console.log('\n[h] Campo, pulsante, messaggio e totale dentro shadow DOM (anche annidati)');
  const rShd = await provaRapida(url('shd', '/'), 'shd.localhost');
  verifica('Shadow DOM: campo trovato, codice applicato (-20,00)', buonoOk(rShd, 20), rShd.st && rShd.st.concluso);
  verifica('Shadow DOM: totale finale 80,00 € (letto nel componente annidato)', (await rShd.page.locator('#t').textContent()) === '80,00 €');
  verifica('Shadow DOM: codice sbagliato riconosciuto', rShd.cattivo && rShd.cattivo.esito === 'ko' && rShd.cattivo.motivo === 'non valido', rShd.cattivo);
  await rShd.page.close();

  // ================= (i) Formati del totale =================
  console.log('\n[i] Formati del totale e prezzi vecchi barrati (base 1250, ESTATE20 = -250)');
  const FMT = [
    ['"€ 1.250,00"', '€'], ['"1 250,00 €" con spazi unificati', '€'], ['"1 250,00 €" con spazio normale', '€'], ['"EUR 1,250.00"', '€'],
    ['"CHF 1\'250.00"', 'CHF'], ['<del>vecchio</del> <ins>nuovo</ins>', '€'], ['nuovo, poi <s>vecchio</s> (vecchio per ultimo)', '€'],
    ['nuovo, poi vecchio barrato con CSS', '€'], ['"$1,250.00"', '$'], ['"1,250.00 GBP"', '£']
  ];
  for (let i = 0; i < FMT.length; i++) {
    const r = await provaRapida(url('fmt', '/?f=' + i), 'fmt.localhost', { fallito: false });
    verifica('Totale ' + FMT[i][0] + ': sconto 250 e valuta ' + FMT[i][1], buonoOk(r, 250) && r.buono.simbolo === FMT[i][1] && r.st.concluso.simbolo === FMT[i][1], { st: r.st && r.st.concluso, buono: r.buono });
    await r.page.close();
  }

  // ================= (l) Frame: campo coupon in un frame di un altro sito =================
  console.log('\n[l] Campo coupon dentro un iframe di un altro sito (host e porta diversi); totale e pannello nella pagina principale');
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8 } }));
  await msgExt({ type: 'aggiungi', dominio: 'fr.localhost', codice: 'ESTATE20' });
  await msgExt({ type: 'aggiungi', dominio: 'fr.localhost', codice: 'PROVA99' });
  const srcFrame = url2('cp', '/coupon');
  verifica('Il frame è davvero di un altro sito (origine diversa)', new URL(srcFrame).origin !== new URL(url('fr', '/')).origin);
  const fr = await ctx.newPage();
  await fr.goto(url('fr', '/?src=' + encodeURIComponent(srcFrame)));
  const idFr = await idScheda('*://fr.localhost/*');
  const stFr = await finche(async () => { const r = await msgExt({ type: 'statoTab', tabId: idFr }); return r && r.campo ? r : null; }, 12000, 300);
  verifica('Il fondo vede il campo coupon in un frame secondario', stFr && stFr.frame.length === 1 && stFr.frame[0] !== 0, stFr);
  verifica('Scheda "codici da provare" nella pagina principale (campo nel frame)', await finche(async () => (await testoScheda(fr)).includes('2 codici da provare'), 12000), await testoScheda(fr));
  verifica('Nessuna scheda dentro il frame', !(await fr.frames().find((f) => f.url().includes('/coupon')).evaluate(() => !!document.getElementById('cacciasconti-scheda'))));
  verifica('Badge della barra = 2', await finche(async () => (await badge(idFr)) === '2', 8000), await badge(idFr));
  const pFr = await apriPopup(idFr);
  verifica('Popup: "Genera sconto" attivo (campo nel frame)', await finche(async () => !(await pFr.locator('#genera').isDisabled()), 10000));
  await pFr.locator('#genera').click();
  const sFr = await attendiFine(idFr);
  verifica('Test concluso con ESTATE20 (-40,00)', sFr && sFr.concluso.tipo === 'ok' && sFr.concluso.code === 'ESTATE20' && sFr.concluso.sconto === 40, sFr && sFr.concluso);
  verifica('Il test ha lavorato nel frame (non nella pagina principale)', sFr && sFr.op && sFr.op.top === false, sFr && sFr.op);
  verifica('Totale nella pagina principale: 160,00 €', (await fr.locator('#tot').textContent()) === '160,00 €');
  verifica('Pannello "Risparmi 40,00 € con ESTATE20" nella pagina principale', await finche(async () => (await testoOverlay(fr)).includes('Risparmi 40,00 € con ESTATE20'), 6000), await testoOverlay(fr));
  verifica('Nessun pannello dentro il frame', !(await fr.frames().find((f) => f.url().includes('/coupon')).evaluate(() => !!document.getElementById('cacciasconti-overlay'))));
  verifica('Un solo pannello nella pagina', (await fr.locator('#cacciasconti-overlay').count()) === 1);
  const aFr = (await archivio()).archivio;
  verifica('Archivio sotto il sito principale (fr.localhost), non sotto quello del frame', aFr['fr.localhost'] && aFr['fr.localhost'].ESTATE20.esito === 'ok' && !aFr['cp.localhost'], Object.keys(aFr));
  verifica('Codice sbagliato riconosciuto dal messaggio del frame', aFr['fr.localhost'].PROVA99.esito === 'ko' && aFr['fr.localhost'].PROVA99.motivo === 'non valido', aFr['fr.localhost'].PROVA99);
  verifica('Popup mostra il risultato', await finche(async () => (await pFr.locator('#risultato').textContent()).includes('Risparmi 40,00'), 5000), await pFr.locator('#risultato').textContent());
  await pFr.close(); await fr.close();

  console.log('\n[m] Campo coupon in un iframe dello stesso sito (srcdoc, about:srcdoc)');
  const rFs = await provaRapida(url('fs', '/'), 'fs.localhost');
  verifica('Iframe srcdoc: campo trovato, codice applicato (-40,00)', buonoOk(rFs, 40), rFs.st && rFs.st.concluso);
  verifica('Iframe srcdoc: ha lavorato il frame, non la pagina', rFs.st && rFs.st.op && rFs.st.op.top === false, rFs.st && rFs.st.op);
  verifica('Iframe srcdoc: totale 160,00 €', (await rFs.page.locator('#tot').textContent()) === '160,00 €');
  verifica('Iframe srcdoc: pannello nella pagina principale', (await testoOverlay(rFs.page)).includes('Risparmi 40,00 € con ESTATE20'), await testoOverlay(rFs.page));
  verifica('Iframe srcdoc: codice sbagliato riconosciuto', rFs.cattivo && rFs.cattivo.esito === 'ko' && rFs.cattivo.motivo === 'non valido', rFs.cattivo);
  await rFs.page.close();

  console.log('\n[n] Campo coupon nella pagina, totale in un iframe di un altro sito');
  const rFt = await provaRapida(url('ft', '/?src=' + encodeURIComponent(url2('cp', '/totale'))), 'ft.localhost');
  verifica('Totale in un frame: codice applicato (-40,00)', buonoOk(rFt, 40), rFt.st && rFt.st.concluso);
  verifica('Totale in un frame: ha lavorato la pagina principale', rFt.st && rFt.st.op && rFt.st.op.top === true, rFt.st && rFt.st.op);
  verifica('Totale in un frame: il frame mostra 160,00 €', (await rFt.page.frames().find((f) => f.url().includes('/totale')).locator('#t').textContent()) === '160,00 €');
  verifica('Totale in un frame: codice sbagliato riconosciuto', rFt.cattivo && rFt.cattivo.esito === 'ko', rFt.cattivo);
  await rFt.page.close();

  // ================= (p) Markup simulato di Magento e PrestaShop (siti demo non raggiungibili dalla rete di prova) =================
  console.log('\n[p] Markup di Magento (Luma) e PrestaShop riprodotto in locale: campo nascosto dietro "Apply Discount Code" / "Have a promo code?"');
  const rMag = await provaRapida(url('mag', '/'), 'mag.localhost');
  verifica('Magento simulato: campo aperto, codice applicato (-20,00 $)', buonoOk(rMag, 20) && rMag.buono.simbolo === '$', rMag.st && rMag.st.concluso);
  verifica('Magento simulato: messaggio "is not valid" riconosciuto', rMag.cattivo && rMag.cattivo.esito === 'ko' && rMag.cattivo.motivo === 'non valido', rMag.cattivo);
  await rMag.page.close();
  const rPre = await provaRapida(url('pre', '/'), 'pre.localhost');
  verifica('PrestaShop simulato: campo aperto, codice applicato (-20,00 €)', buonoOk(rPre, 20) && rPre.buono.simbolo === '€', rPre.st && rPre.st.concluso);
  verifica('PrestaShop simulato: "voucher does not exist" riconosciuto', rPre.cattivo && rPre.cattivo.esito === 'ko' && rPre.cattivo.motivo === 'non valido', rPre.cattivo);
  await rPre.page.close();

  // ================= (u) Regressioni emerse dal WooCommerce VERO (versione a blocchi e cassa classica) =================
  console.log('\n[u] WooCommerce vero: carrello a blocchi, cassa classica, messaggio "does not exist"');
  const rWcb = await provaRapida(url('wcb', '/'), 'wcb.localhost');
  verifica('Blocchi: "Add coupons" dentro un heading si apre, codice applicato (-10,00 €)', buonoOk(rWcb, 10), rWcb.st && rWcb.st.concluso);
  verifica('Blocchi: il prodotto NON viene tolto dal carrello (mai cliccare "Remove ... from cart")', !(await rWcb.page.evaluate(() => window.__carrelloSvuotato === true)), rWcb.st && rWcb.st.concluso);
  verifica('Blocchi: "cannot be applied because it does not exist" = non valido (non "non applicabile")', rWcb.cattivo && rWcb.cattivo.esito === 'ko' && rWcb.cattivo.motivo === 'non valido', rWcb.cattivo);
  verifica('Blocchi: i codici si tolgono davvero tra una prova e l\'altra (non si ferma al primo)', !!(rWcb.st && rWcb.st.concluso && !rWcb.st.concluso.nota), rWcb.st && rWcb.st.concluso);
  verifica('Blocchi: totale finale = 40,00 € (50 - 20% = 40)', await rWcb.page.evaluate(() => /40,00/.test(document.querySelector('.wc-block-components-totals-footer-item').textContent)));
  await rWcb.page.close();
  const rWcc = await provaRapida(url('wcc', '/'), 'wcc.localhost');
  verifica('Cassa classica: interruttore "Click here to enter your code" (solo aria-label con "coupon") trovato e codice applicato (-6,00 €)', buonoOk(rWcc, 6), rWcc.st && rWcc.st.concluso);
  verifica('Cassa classica: "Coupon ... does not exist!" = non valido', rWcc.cattivo && rWcc.cattivo.esito === 'ko' && rWcc.cattivo.motivo === 'non valido', rWcc.cattivo);
  await rWcc.page.close();

  // ================= (o) Valute =================
  console.log('\n[o] Valute: €, $, £, CHF nell\'elenco dei codici e nei risparmi');
  const val = await ctx.newPage();
  await val.goto(url('valute', '/'));
  const idVal = await idScheda('*://valute.localhost/*');
  for (const [c, sc, sim] of [['CODICEUSD', 12.4, '$'], ['CODICEGBP', 5, '£'], ['CODICECHF', 8, 'CHF'], ['CODICEEUR', 3, 'EUR'], ['CODICEVECCHIO', 4, undefined]]) {
    await msgExt({ type: 'risultato', dominio: 'valute.localhost', codice: c, ok: true, sconto: sc, simbolo: sim });
  }
  await sw.evaluate(() => chrome.storage.local.set({ storico: [] }));
  for (const [c, r, sim] of [['CODICEUSD', 12.4, '$'], ['CODICEUSD', 3, 'USD'], ['CODICEGBP', 5, '£'], ['CODICECHF', 8, 'CHF'], ['CODICEEUR', 10, '€'], ['CODICEEUR', 5, 'EUR'], ['CODICEVECCHIO', 2, undefined]]) {
    await msgExt({ type: 'storico', dominio: 'valute.localhost', codice: c, risparmio: r, simbolo: sim });
  }
  const pVal = await apriPopup(idVal);
  const lVal = await finche(async () => { const t = await pVal.locator('#lista').textContent(); return t.includes('CODICEUSD') ? t : null; }, 5000);
  verifica('Elenco codici: dollari "-12,40 $"', lVal && lVal.includes('-12,40 $'), lVal);
  verifica('Elenco codici: sterline "-5,00 £"', lVal && lVal.includes('-5,00 £'), lVal);
  verifica('Elenco codici: franchi "-8,00 CHF"', lVal && lVal.includes('-8,00 CHF'), lVal);
  verifica('Elenco codici: "EUR" mostrato come "-3,00 €"', lVal && lVal.includes('-3,00 €'), lVal);
  verifica('Elenco codici: voce vecchia senza valuta mostrata in euro "-4,00 €"', lVal && lVal.includes('-4,00 €'), lVal);
  await pVal.locator('.scheda[data-s=risparmi]').click();
  const totVal = await finche(async () => { const t = await pVal.locator('#totale').textContent(); return t.includes('CHF') ? t : null; }, 5000);
  verifica('Totale risparmiato raggruppato per valuta', totVal === '17,00 € + 15,40 $ + 5,00 £ + 8,00 CHF', totVal);
  verifica('Elenco risparmi: ogni riga con la sua valuta', (await pVal.locator('#storico').textContent()).includes('12,40 $') && (await pVal.locator('#storico').textContent()).includes('8,00 CHF'), await pVal.locator('#storico').textContent());
  await pVal.close(); await val.close();
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: true, maxCodici: 8 } }));

  // ================= (q) Esploratore del negozio =================
  console.log('\n[q] Esploratore: pagine promo dello stesso negozio, robots.txt, una volta al giorno, fonti scelte dall\'utente');
  const prmGet = async () => JSON.parse(await leggiUrl(url('prm', '/__hits')));
  const prmAzzera = async () => { await leggiUrl(url('prm', '/__azzera')); };
  const pulisciSito = (d) => sw.evaluate((dom) => chrome.storage.local.get(['archivio', 'esplorati']).then((r) => { const a = r.archivio || {}, e = r.esplorati || {}; delete a[dom]; for (const k of Object.keys(e)) delete e[k]; return chrome.storage.local.set({ archivio: a, esplorati: e }); }), d);
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8, esplora: true, fonti: [] } }));
  await pulisciSito('prm.localhost'); await prmAzzera();
  const e1 = await msgExt({ type: 'esplora', dominio: 'prm.localhost', origin: url('prm', '').replace(/\/$/, ''), attendi: true });
  const h1 = await prmGet();
  verifica('Esploratore: trova il codice nella pagina /promo (sorgente "sito del negozio")', (await conCodice('prm.localhost', 'SPECIALE15') || {}).source === 'sito del negozio', await conCodice('prm.localhost', 'SPECIALE15'));
  verifica('Esploratore: segue il link "Offerte speciali" dalla home e trova LINKATO30', !!(await conCodice('prm.localhost', 'LINKATO30')), e1);
  verifica('Esploratore: /offerte è vietata da robots.txt, non viene scaricata e VIETATO25 non entra', !h1.hits.includes('/offerte') && !(await conCodice('prm.localhost', 'VIETATO25')), h1.hits);
  verifica('Esploratore: legge robots.txt e al massimo 8 pagine', h1.hits.includes('/robots.txt') && e1.pagine.length <= 8, e1.pagine.length);
  verifica('Esploratore: nessun cookie inviato (credenziali omesse)', h1.cookies.length === 0, h1.cookies);
  await prmAzzera();
  const e2 = await msgExt({ type: 'esplora', dominio: 'prm.localhost', origin: url('prm', '').replace(/\/$/, ''), attendi: true });
  verifica('Esploratore: una sola volta ogni 24 ore (seconda chiamata non scarica niente)', e2.saltato && (await prmGet()).hits.length === 0, e2);
  await pulisciSito('prm.localhost'); await prmAzzera();
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8, esplora: false, fonti: [] } }));
  const e3 = await msgExt({ type: 'esplora', dominio: 'prm.localhost', origin: url('prm', '').replace(/\/$/, ''), attendi: true });
  verifica('Esploratore: spento dalle opzioni non scarica niente', e3.saltato === 'spento' && (await prmGet()).hits.length === 0, e3);
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8, esplora: true, fonti: [] } }));
  await pulisciSito('rbx.localhost'); await prmAzzera();
  await msgExt({ type: 'esplora', dominio: 'rbx.localhost', origin: url('rbx', '').replace(/\/$/, ''), attendi: true });
  verifica('Esploratore: se robots.txt dà errore del server non scarica nessuna pagina', (await prmGet()).hits.every((x) => x === 'rbx/robots.txt') && !(await conCodice('rbx.localhost', 'NONDOVREI10')), (await prmGet()).hits);
  // partenza automatica quando la pagina ha il campo coupon
  await pulisciSito('prm.localhost'); await prmAzzera();
  const pPrm = await ctx.newPage();
  await pPrm.goto(url('prm', '/'));
  verifica('Esploratore: parte da solo quando la pagina ha il campo coupon', await finche(async () => (await prmGet()).hits.includes('/promo') && await conCodice('prm.localhost', 'SPECIALE15'), 15000), (await prmGet()).hits);
  await pPrm.close();
  // fonti aggiuntive
  await pulisciSito('prm.localhost'); await prmAzzera();
  await sw.evaluate((u) => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8, esplora: false, fonti: [{ url: u + '/lista-codici', dominio: 'prm.localhost' }, { url: u + '/privato', dominio: 'prm.localhost' }] } }), url('prm', '').replace(/\/$/, ''));
  const e4 = await msgExt({ type: 'esplora', dominio: 'prm.localhost', origin: url('prm', '').replace(/\/$/, ''), attendi: true });
  verifica('Fonti aggiuntive: una pagina scelta dall\'utente viene letta (FONTE40)', (await conCodice('prm.localhost', 'FONTE40') || {}).source === 'fonte indicata da te', e4);
  verifica('Fonti aggiuntive: la pagina vietata da robots.txt non viene letta (PRIVATO50)', !(await conCodice('prm.localhost', 'PRIVATO50')) && !(await prmGet()).hits.includes('/privato'), e4);
  const pOpz = await apriPopup(await idScheda('*://valute.localhost/*').catch(() => null) || idWoo);
  await pOpz.locator('.scheda[data-s=opzioni]').click();
  await pOpz.locator('#fonte-url').fill(url('prm', '/promo'));
  await pOpz.locator('#fonte-form button').click();
  verifica('Popup: si può aggiungere una fonte (sito ricavato dall\'indirizzo)', await finche(async () => (await pOpz.locator('#fonti').textContent()).includes('/promo'), 4000), await pOpz.locator('#fonti').textContent());
  await pOpz.close();
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: true, maxCodici: 8, esplora: false, fonti: [] } }));

  // ================= (r) Codici condivisi (anonimi) =================
  console.log('\n[r] Codici condivisi: spenti di base, accendibili; si invia solo sito, codice, esito, percentuale');
  const logCond = async () => JSON.parse(await leggiUrl(url('cond', '/__log')));
  const pOp2 = await apriPopup(idWoo);
  await pOp2.locator('.scheda[data-s=opzioni]').click();
  verifica('Condivisione: la casella c\'è, è spenta di base e si può accendere', (await pOp2.locator('#condividi').count()) === 1 && !(await pOp2.locator('#condividi').isChecked()) && !(await pOp2.locator('#condividi').isDisabled()));
  await pOp2.close();
  await leggiUrl(url('cond', '/__azzera'));
  await sw.evaluate((u) => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8, esplora: false, condividi: false, endpoint: u } }), url('cond', '/fn'));
  const rOff = await provaRapida(url('dis', '/'), 'dis.localhost', { manuali: false, fallito: false });
  verifica('Condivisione spenta: il test funziona e non parte nessuna chiamata', buonoOk(rOff, 20) && (await logCond()).length === 0, await logCond());
  await rOff.page.close();
  await sw.evaluate((u) => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8, esplora: false, condividi: true, endpoint: u } }), url('cond', '/fn'));
  const rOn = await provaRapida(url('dis', '/'), 'dis.localhost', { manuali: false, fallito: false });
  const lg = await finche(async () => { const l = await logCond(); return l.filter((x) => x.metodo === 'POST').length >= 2 ? l : null; }, 8000);
  const lgTutto = await logCond();
  verifica('Condivisione accesa: prima del test scarica i codici condivisi del sito', !!lg && lg.some((x) => x.metodo === 'GET' && x.dominio === 'dis.localhost'), { log: lgTutto, st: rOn.st && rOn.st.concluso, coda: rOn.st && rOn.st.coda, opz: (await sw.evaluate(() => chrome.storage.local.get('opzioni'))).opzioni });
  const cond25 = await conCodice('dis.localhost', 'CONDIV25');
  verifica('Condivisione accesa: CONDIV25 entra con sorgente "condivisi" e viene provato', cond25 && cond25.origine === 'condivisi' && cond25.esito === 'ko', cond25);
  const postOk = lg && lg.find((x) => x.metodo === 'POST' && x.corpo.code === 'ESTATE20');
  verifica('Condivisione accesa: invia solo domain, code, worked, saving_pct', postOk && JSON.stringify(Object.keys(postOk.corpo).sort()) === '["code","domain","saving_pct","worked"]' && postOk.corpo.domain === 'dis.localhost' && postOk.corpo.worked === true && postOk.corpo.saving_pct === 20, postOk);
  verifica('Condivisione accesa: segnala anche i codici che non funzionano', !!(lg && lg.find((x) => x.metodo === 'POST' && x.corpo.code === 'CONDIV25' && x.corpo.worked === false)), lg);
  verifica('Condivisione: nessun cookie inviato', !!lg && lg.every((x) => !x.cookie));
  await rOn.page.close();
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: true, maxCodici: 8, esplora: false, condividi: false, endpoint: null, fonti: [] } }));

  // ================= (v) Revisione 1.3.0 =================
  console.log('\n[v] Revisione indipendente: pulsante "rimuovi", IVA inclusa, messaggi, "da riprovare", doppio avvio, codici spazzatura, archivio, scadenze, cache');
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8, esplora: false, condividi: false } }));
  // Apre una pagina con i codici scritti a mano e aspetta il campo (senza avviare)
  async function apriPronta(urlPagina, dominio, codici) {
    await sw.evaluate((d) => chrome.storage.local.get('archivio').then((r) => { const a = r.archivio || {}; delete a[d]; return chrome.storage.local.set({ archivio: a }); }), dominio);
    const page = await ctx.newPage();
    await page.goto(urlPagina);
    const id = await sw.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u).id, urlPagina);
    for (const c of codici) await msgExt({ type: 'aggiungi', dominio, codice: c });
    const stato = await finche(async () => { const r = await msgExt({ type: 'statoTab', tabId: id }); return r && r.campo ? r : null; }, 12000, 300);
    return { page, id, stato };
  }

  // --- B2: il pulsante "rimuovi" non tocca mai le righe prodotto, nemmeno con parole da coupon nel testo
  const rRmv = await provaRapida(url('rmv', '/'), 'rmv.localhost');
  verifica('B2: riga prodotto con "Remove Mug Promo" (senza "from cart") e "Rimuovi Codice Sconto Mug": codice applicato (-10,00)', buonoOk(rRmv, 10), rRmv.st && rRmv.st.concluso);
  verifica('B2: il prodotto NON è stato tolto dal carrello', !(await rRmv.page.evaluate(() => window.__carrelloSvuotato === true)));
  verifica('B2: il codice si toglie davvero col suo pulsante (nessuna nota "non riesco a togliere")', !!(rRmv.st && rRmv.st.concluso && !rRmv.st.concluso.nota), rRmv.st && rRmv.st.concluso);
  verifica('B2: totale finale 40,00 €', (await rRmv.page.locator('#tot').textContent()) === '40,00 €');
  await rRmv.page.close();

  // --- OpenCart 4 vero: i pulsanti "Apply Coupon" / "Remove" stanno FUORI dal <form> (attributo form= e formaction)
  const rOc = await provaRapida(url('ocf', '/'), 'ocf.localhost');
  verifica('OpenCart 4: campo dietro "Use Coupon Code", pulsante fuori dal form (form="form-coupon"): codice applicato (-20,00)', buonoOk(rOc, 20), rOc.st && rOc.st.concluso);
  verifica('OpenCart 4: "Warning: Coupon is either invalid..." = non valido', rOc.cattivo && rOc.cattivo.esito === 'ko' && rOc.cattivo.motivo === 'non valido', rOc.cattivo);
  verifica('OpenCart 4: il codice si toglie col suo "Remove" (nessuna nota) e alla fine resta ESTATE20: 80,00 €', !!(rOc.st && rOc.st.concluso && !rOc.st.concluso.nota) && (await rOc.page.locator('#tot').textContent()) === '80,00 €', rOc.st && rOc.st.concluso);
  verifica('OpenCart 4: il "Remove" del PRODOTTO (solo title, formaction cart.remove, nome del prodotto con "sconto codice promo") non viene mai cliccato', !(await rOc.page.evaluate(() => window.__carrelloSvuotato === true)));
  await rOc.page.close();

  // --- B4: IVA inclusa, il totale non è l'importo dell'IVA
  const rVat = await provaRapida(url('vat', '/'), 'vat.localhost', { fallito: false });
  verifica('B4: WooCommerce classico, IVA inclusa "(include 18,03 € IVA)": sconto 20,00 (non la differenza dell\'IVA 3,61)', buonoOk(rVat, 20), { st: rVat.st && rVat.st.concluso, buono: rVat.buono });
  await rVat.page.close();
  const rVatB = await provaRapida(url('vat', '/?b=1'), 'vat.localhost', { fallito: false });
  verifica('B4: markup dei blocchi "Including 18,03 € in taxes" (classe tax-value anche sul totale): sconto 20,00', buonoOk(rVatB, 20), { st: rVatB.st && rVatB.st.concluso, buono: rVatB.buono });
  await rVatB.page.close();

  // --- I5/I6: "troppi tentativi" senza parole da errore; i codici "da riprovare" non diventano "ko"
  const rTro = await provaRapida(url('tro', '/'), 'tro.localhost');
  verifica('I5: "Troppi tentativi, riprova più tardi" (fuori da ogni parola da errore): ESTATE20 NON è ko ma "da riprovare"', rTro.buono && rTro.buono.esito === 'riprova' && rTro.buono.motivo === 'troppi tentativi', rTro.buono);
  verifica('I5: anche PROVA99 è "da riprovare", non "ko"', rTro.cattivo && rTro.cattivo.esito === 'riprova' && rTro.cattivo.motivo === 'troppi tentativi', rTro.cattivo);
  const cTro = await msgExt({ type: 'coda', dominio: 'tro.localhost' });
  verifica('I6: i codici "da riprovare" restano nella coda (non si saltano per 7 giorni)', cTro.coda.includes('ESTATE20') && cTro.coda.includes('PROVA99'), cTro.coda);
  await rTro.page.close();
  const rMin = await provaRapida(url('min', '/?t=50'), 'min.localhost', { fallito: false });
  verifica('I6: "Spesa minima di 100 €" = "da riprovare" con motivo "importo minimo" e totale del carrello (50)', rMin.buono && rMin.buono.esito === 'riprova' && rMin.buono.motivo === 'importo minimo' && rMin.buono.totaleAl === 50, rMin.buono);
  await rMin.page.close();
  const cMin = async (t, ripr) => (await msgExt({ type: 'coda', dominio: 'min.localhost', totale: t, riprova: ripr })).coda;
  verifica('I6: carrello uguale (50): "importo minimo" non si riprova', !(await cMin(50)).includes('ESTATE20'), await cMin(50));
  verifica('I6: carrello cresciuto (120): il codice torna in coda', (await cMin(120)).includes('ESTATE20'), await cMin(120));
  verifica('I6: "riprova tutti" lo include comunque', (await cMin(50, true)).includes('ESTATE20'));
  const pMin2 = await ctx.newPage();
  await pMin2.goto(url('min', '/?t=150'));
  const idMin2 = await sw.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u).id, url('min', '/?t=150'));
  await finche(async () => { const r = await msgExt({ type: 'statoTab', tabId: idMin2 }); return r && r.campo ? r : null; }, 12000, 300);
  await msgExt({ type: 'avviaTab', tabId: idMin2 });
  const sMin2 = await attendiFine(idMin2);
  const eMin2 = await conCodice('min.localhost', 'ESTATE20');
  verifica('I6: con il carrello da 150 il codice viene riprovato e funziona (-30,00)', sMin2 && sMin2.concluso.tipo === 'ok' && eMin2.esito === 'ok' && eMin2.sconto === 30, { c: sMin2 && sMin2.concluso, e: eMin2 });
  await pMin2.close();
  // "Da riprovare" non si invia ai condivisi: solo "funziona" o "non vale"
  await leggiUrl(url('cond', '/__azzera'));
  await sw.evaluate((u) => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8, esplora: false, condividi: true, endpoint: u } }), url('cond', '/fn'));
  await msgExt({ type: 'risultato', dominio: 'cnd.localhost', codice: 'MINIMO50', ok: false, motivo: 'importo minimo', totale: 10 });
  await msgExt({ type: 'risultato', dominio: 'cnd.localhost', codice: 'FALSO99', ok: false, motivo: 'non valido', totale: 10 });
  await dorme(800);
  const lgR = await logCond();
  verifica('I6: "importo minimo" NON viene segnalato ai codici condivisi, "non valido" sì', !lgR.some((x) => x.corpo && x.corpo.code === 'MINIMO50') && lgR.some((x) => x.corpo && x.corpo.code === 'FALSO99'), lgR);
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8, esplora: false, condividi: false, endpoint: null } }));

  // --- I7: messaggi estranei
  const rEst = await provaRapida(url('est', '/'), 'est.localhost');
  verifica('I7: "Prodotto aggiunto al carrello" + "Errore di rete..." fuori dal riquadro coupon: ESTATE20 funziona comunque (-20,00)', buonoOk(rEst, 20), { st: rEst.st && rEst.st.concluso, buono: rEst.buono });
  verifica('I7: "aggiunto al carrello" non conta come codice applicato: PROVA99 = ko "nessuna reazione"', rEst.cattivo && rEst.cattivo.esito === 'ko' && rEst.cattivo.motivo === 'nessuna reazione', rEst.cattivo);
  await rEst.page.close();

  // --- I8: doppio avvio
  const dbl = await apriPronta(url('dis', '/'), 'dis.localhost', ['ESTATE20', 'PROVA99']);
  const [av1, av2] = await Promise.all([msgExt({ type: 'avviaTab', tabId: dbl.id }), msgExt({ type: 'avviaTab', tabId: dbl.id })]);
  verifica('I8: due "Genera sconto" insieme: parte una sola prova', [av1, av2].filter((x) => x && x.ok).length === 1, [av1, av2]);
  const sDbl = await attendiFine(dbl.id);
  verifica('I8: nessun codice provato due volte, risultato corretto', sDbl && sDbl.concluso.tipo === 'ok' && new Set(sDbl.risultati.map((r) => r.code)).size === sDbl.risultati.length && sDbl.risultati.length === 2, sDbl && sDbl.risultati);
  await dbl.page.close();
  const dbl2 = await apriPronta(url('dis', '/'), 'dis.localhost', ['ESTATE20', 'PROVA99']);
  const [fr1, fr2] = await sw.evaluate((id) => Promise.all([chrome.tabs.sendMessage(id, { type: 'avvia' }, { frameId: 0 }), chrome.tabs.sendMessage(id, { type: 'avvia' }, { frameId: 0 })]), dbl2.id);
  verifica('I8: due messaggi "avvia" diretti allo stesso frame: il secondo è rifiutato subito', [fr1, fr2].filter((x) => x && x.ok).length === 1 && [fr1, fr2].some((x) => x && x.errore === 'Già in corso.'), [fr1, fr2]);
  await attendiFine(dbl2.id);
  await dbl2.page.close();

  // --- I9: codici spazzatura
  const pJnk = await ctx.newPage();
  await pJnk.goto(url('jnk', '/'));
  await finche(async () => await conCodice('jnk.localhost', 'SPRING25'), 8000);
  await dorme(500);
  const cJ = async (c) => await conCodice('jnk.localhost', c);
  verifica('I9: parole in elementi con classe promo/code ma senza cifra e senza contesto coupon NON si salvano (ITALIA, GERMANIA, NUOVO, ARRIVI)', !(await cJ('ITALIA')) && !(await cJ('GERMANIA')) && !(await cJ('NUOVO')) && !(await cJ('ARRIVI')), Object.keys((await archivio()).archivio['jnk.localhost'] || {}));
  verifica('I9: data-code="FRANCIA" e data-promo="OFFERTONE" senza cifra NON si salvano', !(await cJ('FRANCIA')) && !(await cJ('OFFERTONE')));
  verifica('I9: con una cifra (SPRING25) o con contesto coupon (FREEBIE, data-coupon SOMMER) si salvano', !!(await cJ('SPRING25')) && !!(await cJ('FREEBIE')) && !!(await cJ('SOMMER')));
  verifica('I9: i codici trovati solo dalla classe hanno la sorgente "pagina (classe)"', (await cJ('FREEBIE') || {}).source === 'pagina (classe)', await cJ('FREEBIE'));
  await pJnk.close();
  const ordine = await sw.evaluate(() => ordinaPerStato([{ code: 'CCC1', source: 'comune', esito: 'mai' }, { code: 'AAA1', source: 'pagina (classe)', esito: 'mai' }, { code: 'BBB1', source: 'manuale', esito: 'mai' }, { code: 'DDD1', source: 'pagina', esito: 'mai', trovato: 5 }]).map((e) => e.code));
  verifica('I9: ordine di prova: pagina > manuale > classe debole > comune', JSON.stringify(ordine) === '["DDD1","BBB1","AAA1","CCC1"]', ordine);

  // --- I9: pulizia dell'archivio
  const pot = await sw.evaluate(() => {
    const adesso = Date.now(), G = 24 * 3600 * 1000, a = {};
    a['grande.it'] = {};
    for (let i = 0; i < 30; i++) a['grande.it']['VECCHIO' + i] = { code: 'VECCHIO' + i, source: 'pagina', esito: 'mai', trovato: adesso - 100 * G };
    for (let i = 0; i < 70; i++) a['grande.it']['NUOVO' + i] = { code: 'NUOVO' + i, source: 'pagina', esito: 'mai', trovato: adesso - i * 1000 };
    for (let i = 0; i < 5; i++) a['grande.it']['BUONO' + i] = { code: 'BUONO' + i, source: 'funzionato', esito: 'ok', data: adesso - 90 * G, trovato: adesso - 120 * G };
    a['grande.it'].MIO1 = { code: 'MIO1', source: 'manuale', esito: 'mai', trovato: adesso - 200 * G };
    a['grande.it'].SCADUTO1 = { code: 'SCADUTO1', source: 'pagina', esito: 'mai', trovato: adesso, scade: adesso - 5 * G };
    for (let i = 0; i < 260; i++) a['sito' + i + '.it'] = { ['COD' + i]: { code: 'COD' + i, source: 'pagina', esito: i === 7 ? 'ok' : 'mai', data: i === 7 ? 1 : null, trovato: adesso - i * 1000 } };
    potatura(a);
    return { n: Object.keys(a['grande.it']).length, vecchi: Object.keys(a['grande.it']).filter((k) => k.startsWith('VECCHIO')).length, buoni: Object.keys(a['grande.it']).filter((k) => k.startsWith('BUONO')).length, mio: !!a['grande.it'].MIO1, scaduto: !!a['grande.it'].SCADUTO1, siti: Object.keys(a).length, sito7: !!a['sito7.it'], byte: JSON.stringify(a).length };
  });
  verifica('Archivio: al massimo 40 codici per sito', pot.n <= 40, pot);
  verifica('Archivio: via i codici di pagina mai provati da più di 60 giorni e quelli scaduti', pot.vecchi === 0 && !pot.scaduto, pot);
  verifica('Archivio: restano quelli che funzionano e quelli scritti a mano', pot.buoni === 5 && pot.mio, pot);
  verifica('Archivio: al massimo 200 siti, resta il sito con un codice che funziona', pot.siti <= 200 && pot.sito7, pot);
  verifica('Archivio: nel caso peggiore pesa meno di 1,5 MB (limite del browser 5-10 MB)', pot.byte < 1500000, pot.byte);

  // --- Scadenze scritte nella pagina
  const stu = new Set();
  const oggiT = new Date(2026, 10, 8).getTime();
  self.CS_dalTesto('Usa il codice SAVE20 scade il 30/11. Codice OLD10 valido fino al 01/11. Code UK25 expires Dec 5. Code PAST25 valid until October 31, 2026. Codice FINITO15 valido fino al 5 novembre 2026.', stu, oggiT);
  verifica('Scadenza (testo): "scade il 30/11" tenuto con la scadenza, "fino al 01/11" scartato (oggi 8/11/2026)', stu.has('SAVE20') && !stu.has('OLD10') && new Date(stu.scad.SAVE20).getDate() === 30, [...stu]);
  verifica('Scadenza (testo): "expires Dec 5" tenuto, "valid until October 31, 2026" e "fino al 5 novembre 2026" scartati', stu.has('UK25') && !stu.has('PAST25') && !stu.has('FINITO15'), [...stu]);
  const pExp = await ctx.newPage();
  await pExp.goto(url('exp', '/'));
  await finche(async () => await conCodice('exp.localhost', 'NUOVO30'), 8000);
  await dorme(400);
  verifica('Scadenza (pagina): codice "valido fino al 31/12/2020" non salvato', !(await conCodice('exp.localhost', 'VECCHIO10')));
  const nu30 = await conCodice('exp.localhost', 'NUOVO30');
  verifica('Scadenza (pagina): "valido fino al 31/12/2099" salvato con la scadenza', nu30 && nu30.scade > Date.UTC(2099, 0, 1), nu30);
  await pExp.close();
  await sw.evaluate(() => chrome.storage.local.get('archivio').then((r) => { const a = r.archivio; a['exp.localhost'].PASSATO10 = { code: 'PASSATO10', source: 'pagina', esito: 'mai', trovato: Date.now(), scade: Date.now() - 3 * 24 * 3600 * 1000 }; return chrome.storage.local.set({ archivio: a }); }));
  const cExp = await msgExt({ type: 'coda', dominio: 'exp.localhost' });
  verifica('Scadenza: un codice scaduto già salvato non entra nella coda, quello valido sì', !cExp.coda.includes('PASSATO10') && cExp.coda.includes('NUOVO30'), cExp.coda);

  // --- Cache dei selettori che hanno funzionato
  const selDis = (await sw.evaluate(() => chrome.storage.local.get('selettori'))).selettori || {};
  verifica('Cache: dopo un codice riuscito si ricordano campo e pulsante del sito (#c e #ap)', selDis['dis.localhost'] && selDis['dis.localhost'].input === '#c' && selDis['dis.localhost'].bottone === '#ap', selDis);
  const pSel0 = await ctx.newPage();
  await pSel0.goto(url('sel', '/'));
  await dorme(1500);
  const senzaCache = await msgExt({ type: 'statoTab', tabId: await sw.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u).id, url('sel', '/')) });
  verifica('Cache: senza selettore ricordato il campo anonimo (#zq, nessun indizio) NON viene trovato', senzaCache && !senzaCache.campo, senzaCache);
  await pSel0.close();
  await msgExt({ type: 'selSalva', dominio: 'sel.localhost', input: '#zq', bottone: '#go' });
  const rSel = await provaRapida(url('sel', '/'), 'sel.localhost');
  verifica('Cache: col selettore ricordato il campo anonimo si trova e il codice si applica (-20,00)', buonoOk(rSel, 20), rSel.st && rSel.st.concluso);
  await rSel.page.close();

  // --- Badge: coda vuota = nessun numero
  await msgExt({ type: 'badge', tabId: idWoo, dominio: 'vuoto.localhost', campo: true });
  verifica('Badge: coda vuota (nessun codice da provare) = nessun numero sull\'icona', (await badge(idWoo)) === '', await badge(idWoo));

  // --- Esploratore: "fatto oggi" si segna solo dopo uno scarico riuscito
  await sw.evaluate(() => chrome.storage.local.remove('esplorati'));
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 8, esplora: true, fonti: [] } }));
  await msgExt({ type: 'esplora', dominio: 'zzz.localhost', origin: url('zzz', '').replace(/\/$/, ''), attendi: true });
  const esp1 = (await sw.evaluate(() => chrome.storage.local.get('esplorati'))).esplorati || {};
  verifica('Esploratore: se la home non si scarica (404) NON si segna "fatto oggi" (si riprova alla prossima visita)', !esp1['sito:zzz.localhost'], esp1);
  await msgExt({ type: 'esplora', dominio: 'prm.localhost', origin: url('prm', '').replace(/\/$/, ''), attendi: true });
  const esp2 = (await sw.evaluate(() => chrome.storage.local.get('esplorati'))).esplorati || {};
  verifica('Esploratore: dopo uno scarico riuscito si segna "fatto oggi"', !!esp2['sito:prm.localhost'], esp2);
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: true, maxCodici: 8, esplora: false, condividi: false, endpoint: null, fonti: [] } }));

  // --- Permessi e testi
  const man = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  verifica('Manifest: "alarms" c\'è (timer per prezzi e codici personali) e niente "activeTab" (ridondante con <all_urls>)', man.permissions.includes('alarms') && !man.permissions.includes('activeTab'), man.permissions);
  verifica('Manifest: Firefox 128 o più (match_origin_as_fallback)', parseInt(man.browser_specific_settings.gecko.strict_min_version, 10) >= 128, man.browser_specific_settings);
  const testi = ['README.md', 'STORE.md', 'privacy.html', 'manifest.json'].map((f) => fs.readFileSync(path.join(EXT, f), 'utf8')).join('\n');
  verifica('Testi: nessuna frase falsa "niente server" / "nessun database condiviso" / "nessun server"', !/niente server|nessun database condiviso|nessun server|non legge (né )?(email|password)|Nessun dato lascia il tuo computer/i.test(testi));
  verifica('Testi: "activeTab" non è elencato come permesso; "alarms" sì, con il motivo (prezzi e codici personali)', !/\*\*activeTab\*\*|^- `activeTab`/m.test(testi) && /\*\*alarms\*\*[^\n]*prezz/.test(testi) && /^- `alarms`[^\n]*prezz/m.test(testi));

  // --- Edge Function (si prova con Node, senza Deno: si toglie solo l'import di Supabase e si finge Deno)
  const { spawnSync } = require('child_process');
  const os2 = require('os');
  const dirEdge = fs.mkdtempSync(path.join(os2.tmpdir(), 'cs-edge-'));
  const src = fs.readFileSync(path.join(EXT, 'supabase/functions/cacciasconti-codici/index.ts'), 'utf8').replace(/import \{ createClient \} from "jsr:[^"]+";/, 'const createClient = () => ({});');
  fs.writeFileSync(path.join(dirEdge, 'index.mts'), src);
  fs.writeFileSync(path.join(dirEdge, 'prova.mjs'), `
const ENV = { SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k' };
let serveChiamata = 0;
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: () => { serveChiamata++; } };
const m = await import('./index.mts');
const out = { serve: serveChiamata };
const chiamate = { gte: [], rpc: [], insert: 0 };
const db = {
  from: () => { const q = { select: () => q, eq: () => q, gte: (c, v) => { chiamate.gte.push([c, v]); return q; }, order: () => q, limit: () => Promise.resolve({ data: [], error: null }), insert: () => { chiamate.insert++; return Promise.resolve({ error: null }); } }; return q; },
  rpc: (n, a) => { chiamate.rpc.push(a.p_hash); return Promise.resolve({ data: 1, error: null }); }
};
const post = (h) => new Request('http://x/f', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, h), body: JSON.stringify({ domain: 'a.it', code: 'ABC10', worked: true }) });
const get = await m.gestisci(new Request('http://x/f?domain=a.it'), db);
out.get = get.status; out.gte = chiamate.gte;
const r503 = await m.gestisci(post({ 'x-forwarded-for': '1.1.1.1' }), db);
out.senzaSale = { status: r503.status, rpc: chiamate.rpc.length, insert: chiamate.insert };
ENV.CACCIASCONTI_SALE = 'sale-lungo';
await m.gestisci(post({ 'x-forwarded-for': '9.9.9.9, 5.5.5.5' }), db);
await m.gestisci(post({ 'x-forwarded-for': '8.8.8.8, 5.5.5.5' }), db);
await m.gestisci(post({ 'x-forwarded-for': '8.8.8.8, 6.6.6.6' }), db);
await m.gestisci(post({ 'x-forwarded-for': '1.1.1.1, 5.5.5.5', 'cf-connecting-ip': '7.7.7.7' }), db);
await m.gestisci(post({ 'cf-connecting-ip': '7.7.7.7' }), db);
out.hash = chiamate.rpc;
out.ip = [m.ipCliente(post({ 'x-forwarded-for': 'falso, vero' })), m.ipCliente(post({ 'cf-connecting-ip': 'cf', 'x-forwarded-for': 'a, b' })), m.ipCliente(post({}))];
console.log(JSON.stringify(out));
`);
  const rEdge = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', path.join(dirEdge, 'prova.mjs')], { encoding: 'utf8' });
  let ed = null;
  try { ed = JSON.parse(rEdge.stdout.trim().split('\n').pop()); } catch (e) {}
  verifica('Edge Function: Deno.serve parte sempre (nessun controllo import.meta.main)', ed && ed.serve === 1 && !/if\s*\(\s*import\.meta\.main/.test(src), { ed, err: rEdge.stderr.slice(0, 300) });
  verifica('Edge Function: GET chiede almeno 2 successi e tasso di successo >= 50%', ed && ed.get === 200 && JSON.stringify(ed.gte) === '[["n_successi",2],["tasso_successo",50]]', ed && ed.gte);
  verifica('Edge Function: senza CACCIASCONTI_SALE risponde 503, non calcola l\'hash e non salva', ed && ed.senzaSale.status === 503 && ed.senzaSale.rpc === 0 && ed.senzaSale.insert === 0, ed && ed.senzaSale);
  verifica('Edge Function: il limite usa l\'ULTIMO indirizzo di x-forwarded-for (il primo lo scrive il cliente)', ed && ed.hash[0] === ed.hash[1] && ed.hash[1] !== ed.hash[2], ed && ed.hash);
  verifica('Edge Function: con cf-connecting-ip vale quello (anche se x-forwarded-for dice altro)', ed && ed.hash[3] === ed.hash[4] && ed.hash[3] !== ed.hash[0], ed && ed.hash);
  verifica('Edge Function: ipCliente = ultimo elemento / cf-connecting-ip / "sconosciuto"', ed && JSON.stringify(ed.ip) === '["vero","cf","sconosciuto"]', ed && ed.ip);
  fs.writeFileSync(path.join(dirEdge, 'prova-pers.mjs'), `
const ENV = { SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k' };
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: () => {} };
const m = await import('./index.mts');
const reg = { from: 0, rpc: [] };
const cont = {};
const righe = [{ domain: 'a.it', code: 'MAIL15', sconto: '15%', scade_il: '2099-12-31', email_data: '2026-11-01' }];
const db = { from: (t) => { reg.from++; reg.tabella = t; const q = {
  select: (c) => { reg.select = c; return q; }, or: (f) => { reg.or = f; return q; }, eq: (c, v) => { reg.eq = [c, v]; return q; }, gte: () => q,
  order: (c, o) => { reg.order = [c, o && o.ascending, o && o.nullsFirst]; return q; }, limit: (n) => { reg.limit = n; return Promise.resolve({ data: righe, error: null }); } }; return q; },
  rpc: (nome, a) => { if (nome === 'cacciasconti_leggi') return Promise.resolve({ data: cont[a.p_hash] || 0, error: null }); reg.rpc.push(a.p_hash); cont[a.p_hash] = (cont[a.p_hash] || 0) + 1; return Promise.resolve({ data: cont[a.p_hash], error: null }); } };
const get = (qs, h) => new Request('http://x/f?' + qs, { headers: h || {} });
const out = {};
let r = await m.gestisci(get('personali=1'), db);
out.senzaSegreto = { status: r.status, db: reg.from };
ENV.CACCIASCONTI_TOKEN_PERSONALE = 'segreto-lungo-123';
r = await m.gestisci(get('personali=1'), db); out.senzaToken = { status: r.status, db: reg.from };
r = await m.gestisci(get('personali=1', { 'x-cacciasconti-token': 'sbagliato' }), db); out.tokenSbagliato = { status: r.status, db: reg.from };
r = await m.gestisci(get('personali=1', { 'x-cacciasconti-token': 'segreto-lungo-12' }), db); out.tokenCorto = { status: r.status, db: reg.from };
r = await m.gestisci(get('personali=1', { 'x-cacciasconti-token': 'segreto-lungo-123' }), db);
out.giusto = { status: r.status, corpo: await r.json(), tabella: reg.tabella, limit: reg.limit, or: reg.or, eq: reg.eq || null, select: reg.select, order: reg.order };
reg.eq = null;
r = await m.gestisci(get('personali=1&domain=A.it', { 'x-cacciasconti-token': 'segreto-lungo-123' }), db);
out.perDominio = { status: r.status, eq: reg.eq };
r = await m.gestisci(get('personali=1&domain=' + encodeURIComponent('a b;drop'), { 'x-cacciasconti-token': 'segreto-lungo-123' }), db);
out.dominioMalvagio = r.status;
r = await m.gestisci(new Request('http://x/f', { method: 'OPTIONS' }), db);
out.cors = r.headers.get('access-control-allow-headers');
out.costante = [await m.confrontoCostante('abc', 'abc'), await m.confrontoCostante('abc', 'abd'), await m.confrontoCostante('abc', 'abcd'), await m.confrontoCostante('', 'x')];
r = await m.gestisci(get('domain=a.it'), db); out.pubblicoSenzaToken = r.status;
const rpcPrima = reg.rpc.length;
await m.gestisci(get('personali=1', { 'x-cacciasconti-token': 'segreto-lungo-123', 'cf-connecting-ip': '3.3.3.3' }), db);
out.giustoNonConta = reg.rpc.length === rpcPrima;
out.tentativi = [];
for (let i = 0; i < 12; i++) out.tentativi.push((await m.gestisci(get('personali=1', { 'x-cacciasconti-token': 'sbagliato' + i, 'cf-connecting-ip': '3.3.3.3' }), db)).status);
out.giustoBloccato = (await m.gestisci(get('personali=1', { 'x-cacciasconti-token': 'segreto-lungo-123', 'cf-connecting-ip': '3.3.3.3' }), db)).status;
out.altroIp = (await m.gestisci(get('personali=1', { 'x-cacciasconti-token': 'sbagliato', 'cf-connecting-ip': '4.4.4.4' }), db)).status;
const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((x) => x.toString(16).padStart(2, '0')).join('');
out.prefissoTok = reg.rpc.includes(await sha('tokerr|3.3.3.3|' + new Date().toISOString().slice(0, 10) + '|segreto-lungo-123'));
out.altroIpGiusto = (await m.gestisci(get('personali=1', { 'x-cacciasconti-token': 'segreto-lungo-123', 'cf-connecting-ip': '5.5.5.5' }), db)).status;
console.log(JSON.stringify(out));
`);
  const rPers = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', path.join(dirEdge, 'prova-pers.mjs')], { encoding: 'utf8' });
  let ep = null;
  try { ep = JSON.parse(rPers.stdout.trim().split('\n').pop()); } catch (e) {}
  verifica('Edge Function personali: ordine per email_data dal più recente con i codici senza data IN FONDO (nullsFirst: false)', ep && ep.giusto.order[0] === 'email_data' && ep.giusto.order[1] === false && ep.giusto.order[2] === false, ep && ep.giusto.order);
  verifica('Edge Function personali: dopo 10 chiavi sbagliate in un\'ora dallo stesso indirizzo la 11a risponde 429 (le prime 10: 401), anche con la chiave GIUSTA; un altro indirizzo non è bloccato (nemmeno con la chiave giusta)', ep && JSON.stringify(ep.tentativi) === JSON.stringify([401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 429, 429]) && ep.giustoBloccato === 429 && ep.altroIp === 401 && ep.altroIpGiusto === 200, ep && [ep.tentativi, ep.altroIp]);
  verifica('Edge Function personali: il contatore delle chiavi sbagliate usa l\'hash con prefisso "tokerr|" (non si mischia con le segnalazioni) e una chiave GIUSTA non conta', ep && ep.prefissoTok === true && ep.giustoNonConta === true, ep && [ep.prefissoTok, ep.giustoNonConta]);
  verifica('Edge Function personali: senza il segreto CACCIASCONTI_TOKEN_PERSONALE risponde 503 e non tocca il database', ep && ep.senzaSegreto.status === 503 && ep.senzaSegreto.db === 0, ep ? ep.senzaSegreto : rPers.stderr.slice(0, 300));
  verifica('Edge Function personali: senza intestazione, con chiave sbagliata o più corta = 401, database mai toccato', ep && ep.senzaToken.status === 401 && ep.tokenSbagliato.status === 401 && ep.tokenCorto.status === 401 && ep.tokenCorto.db === 0, ep && [ep.senzaToken, ep.tokenSbagliato, ep.tokenCorto]);
  verifica('Edge Function personali: con la chiave giusta 200, tabella cacciasconti_codici_email, max 500, solo non scaduti, ordinati per email_data', ep && ep.giusto.status === 200 && ep.giusto.tabella === 'cacciasconti_codici_email' && ep.giusto.limit === 500 && /^scade_il\.is\.null,scade_il\.gte\.\d{4}-\d{2}-\d{2}$/.test(ep.giusto.or) && ep.giusto.order[0] === 'email_data' && ep.giusto.order[1] === false && ep.giusto.corpo.codici[0].code === 'MAIL15', ep && ep.giusto);
  verifica('Edge Function personali: senza dominio nessun filtro per dominio; con ?domain=A.it filtra su "a.it"', ep && ep.giusto.eq === null && ep.perDominio.status === 200 && JSON.stringify(ep.perDominio.eq) === '["domain","a.it"]', ep && [ep.giusto.eq, ep.perDominio]);
  verifica('Edge Function personali: non restituisce il mittente dell\'email (solo domain, code, sconto, scade_il, email_data) e rifiuta domini strani', ep && ep.giusto.select === 'domain,code,sconto,scade_il,email_data' && ep.dominioMalvagio === 400, ep && [ep.giusto.select, ep.dominioMalvagio]);
  verifica('Edge Function personali: confronto a tempo costante (hash + XOR), niente "===" sul segreto; CORS accetta x-cacciasconti-token', ep && JSON.stringify(ep.costante) === '[true,false,false,false]' && /x-cacciasconti-token/.test(ep.cors) && !/dato\s*===?\s*segreto|segreto\s*===?\s*dato/.test(src) && /confrontoCostante/.test(src), ep && [ep.costante, ep.cors]);
  verifica('Edge Function: la lettura pubblica per dominio resta com\'era (200 senza chiave personale)', ep && ep.pubblicoSenzaToken === 200, ep && ep.pubblicoSenzaToken);
  fs.rmSync(dirEdge, { recursive: true, force: true });
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: true, maxCodici: 8 } }));

  { // ---- sezione 1.4.0 in un blocco proprio: i nomi non si scontrano con il resto
  // ================= (w) Novità 1.4.0 =================
  console.log('\n[w] 1.4.0: funzioni comuni (prove con Node)');
  require('../domain.js'); require('../lib-extra.js');
  const L = self.CS_lib;
  verifica('Numeri: 1.299,00 / 1,299.00 / 19.90 / 1.299 / 49,5', [L.numero('1.299,00'), L.numero('1,299.00'), L.numero('19.90'), L.numero('1.299'), L.numero('49,5')].join('|') === '1299|1299|19.9|1299|49.5', [L.numero('1.299,00'), L.numero('1,299.00'), L.numero('19.90'), L.numero('1.299'), L.numero('49,5')]);
  const ldp = (extra) => '<html><head><script type="application/ld+json">' + JSON.stringify(Object.assign({ '@context': 'https://schema.org', '@type': 'Product', name: 'Scarpa', offers: { '@type': 'Offer', price: '19.90', priceCurrency: 'EUR' } }, extra)) + '</script></head></html>';
  const r1 = L.prezzoDaHtml(ldp({}));
  verifica('Prezzo da JSON-LD (Product/Offer): 19,90 €', r1 && r1.prezzo === 19.9 && r1.valuta === '€' && r1.via === 'json-ld', r1);
  verifica('Prezzo da JSON-LD con AggregateOffer (lowPrice) e dollari', (() => { const r = L.prezzoDaHtml(ldp({ offers: { '@type': 'AggregateOffer', lowPrice: 5.5, priceCurrency: 'USD' } })); return r && r.prezzo === 5.5 && r.valuta === '$'; })());
  verifica('Prezzo da OpenGraph product:price:amount', (() => { const r = L.prezzoDaHtml('<meta property="product:price:amount" content="59.90"><meta property="product:price:currency" content="EUR"><meta property="og:title" content="Zaino">'); return r && r.prezzo === 59.9 && r.nome === 'Zaino' && r.via === 'opengraph'; })());
  verifica('Prezzo da microdata itemprop=price (content="1299.00")', (() => { const r = L.prezzoDaHtml('<div itemscope itemtype="https://schema.org/Product"><span itemprop="name">PC</span><span itemprop="price" content="1299.00">1.299,00 €</span></div>'); return r && r.prezzo === 1299 && r.via === 'microdata'; })());
  verifica('Prezzo Shopify (twitter:data1) e WooCommerce (single-product)', (() => { const a = L.prezzoDaHtml('<meta name="twitter:label1" content="Price"><meta name="twitter:data1" content="€ 24,90">'); const b = L.prezzoDaHtml('<body class="woocommerce single-product"><p class="price"><span class="woocommerce-Price-amount amount"><bdi>35,00&nbsp;<span>€</span></bdi></span></p>'); return a && a.prezzo === 24.9 && a.via === 'shopify' && b && b.prezzo === 35 && b.via === 'woocommerce'; })());
  verifica('Una pagina con due prodotti diversi (elenco) non è una pagina prodotto', L.prezzoDaHtml('<script type="application/ld+json">' + JSON.stringify({ '@graph': [{ '@type': 'Product', name: 'A', offers: { price: '1' } }, { '@type': 'Product', name: 'B', offers: { price: '2' } }] }) + '</script>') === null);
  const t0g = Date.UTC(2026, 10, 8, 10), t1g = Date.UTC(2026, 10, 8, 18), t2g = Date.UTC(2026, 10, 9, 10);
  let pt = L.aggiungiPunto([], 10, t0g); pt = L.aggiungiPunto(pt, 9, t1g);
  verifica('Storico: un solo punto al giorno (il secondo prezzo dello stesso giorno sostituisce il primo)', pt.length === 1 && pt[0][1] === 9, pt);
  pt = L.aggiungiPunto(pt, 8, t2g);
  verifica('Storico: il giorno dopo si aggiunge un punto; min/max/ultimo giusti', pt.length === 2 && L.statistiche(pt).min === 8 && L.statistiche(pt).max === 9 && L.statistiche(pt).ultimo === 8, L.statistiche(pt));
  const svg = L.grafico([[20261101, 10], [20261102, 8], [20261103, 12]]);
  verifica('Grafico: SVG inline con linea e 3 punti, nessuna risorsa esterna', /^<svg/.test(svg) && svg.includes('<polyline') && (svg.match(/<circle/g) || []).length === 3 && !/https?:|<script|<image|href=/.test(svg), svg.slice(0, 120));
  const sp1 = L.spedizione('Spedizione gratuita sopra 49 € ... Subtotale: 41,90 €');
  verifica('Spedizione: soglia 49 € + subtotale 41,90 = "Ti mancano 7,10 € per la spedizione gratuita"', sp1 && sp1.soglia === 49 && sp1.mancano === 7.1 && L.testoSpedizione(sp1) === 'Ti mancano 7,10 € per la spedizione gratuita', sp1);
  verifica('Spedizione: "ti mancano 7,10 € per la spedizione gratuita" scritto dal sito', (() => { const s = L.spedizione('Ti mancano 7,10 € per la spedizione gratuita'); return s && s.mancano === 7.1; })());
  verifica('Spedizione: "free shipping over $50" e "free shipping on orders over €50"', (() => { const a = L.spedizione('Free shipping over $50'); const b = L.spedizione('Enjoy free shipping on orders over €50.'); return a && a.soglia === 50 && a.simbolo === '$' && b && b.soglia === 50 && b.simbolo === '€'; })());
  verifica('Spedizione: "spedizione gratuita per ordini superiori a 59,00 €" e "you\'re $7.10 away from free shipping"', (() => { const a = L.spedizione('Spedizione gratuita per ordini superiori a 59,00 €'); const b = L.spedizione("You're $7.10 away from free shipping"); return a && a.soglia === 59 && b && b.mancano === 7.1; })());
  verifica('Spedizione: testo senza spedizione gratuita = niente', L.spedizione('Totale 40 € spedizione 4,90 €') === null);
  const em1 = L.emailEstrai({ mittente: 'store+123@m.shopifyemail.com', oggetto: 'Il tuo sconto', testo: 'Usa il codice WELCOME15 per il 15% di sconto. Scade il 31/12/2099.', link: ['https://click.klaviyomail.com/x', 'https://negozioprova.it/discount/WELCOME15', 'https://www.negozioprova.it/collections/tutto', 'https://facebook.com/negozioprova', 'https://negozioprova.it/unsubscribe?x=1'] });
  verifica('Email: mittente store+123@m.shopifyemail.com -> negozio dai link nel testo (negozioprova.it), codice, scadenza, -15%', em1.dominio === 'negozioprova.it' && em1.codici.length === 1 && em1.codici[0].code === 'WELCOME15' && em1.codici[0].info === '-15%' && em1.codici[0].scade > Date.now(), em1);
  const em2 = L.emailEstrai({ mittente: 'News <offerte@e.zalando.it>', oggetto: '', testo: 'Sconto del 20% sulla moda. Codice: MODA20 solo oggi', link: [] });
  verifica('Email: mittente normale -> dominio del mittente (zalando.it)', em2.dominio === 'zalando.it' && em2.codici[0].code === 'MODA20', em2);
  verifica('Email: mittente di una piattaforma e nessun link del negozio = nessun negozio (non si inventa)', L.emailEstrai({ mittente: 'x@mailchimp.com', testo: 'codice ABCD1234', link: ['https://facebook.com/x'] }).dominio === null);
  const cu = L.cercaUrl('Scarpe Corsa Pro | Negozio Prova');
  verifica('Cerca anche su: Amazon.it, Google Shopping, Idealo.it, Trovaprezzi.it, nome ripulito, nessun identificativo nostro', cu.length === 4 && cu.map((x) => new URL(x.url).hostname).join() === 'www.amazon.it,www.google.com,www.idealo.it,www.trovaprezzi.it' && cu.every((x) => x.url.includes('Scarpe%20Corsa%20Pro') && !x.url.includes('Negozio') && !/[?&](tag|ref|aff\w*|utm_\w+)=/.test(x.url)), cu.map((x) => x.url));
  verifica('Siti di coupon: riconosce pepper.it / www.picodi.com dall\'elenco, non un negozio qualunque', L.eAggregatore('www.pepper.it', ['pepper.it']) && L.eAggregatore('it.picodi.com', ['picodi.com']) && !L.eAggregatore('zalando.it', ['pepper.it']));
  verifica('Cashback: "tutti" vale ovunque; con elenco solo per quei negozi; spento = niente', !!L.cashbackVale({ attivo: true, servizio: 'igraal', tutti: true }, 'x.it') && !!L.cashbackVale({ attivo: true, servizio: 'igraal', tutti: false, negozi: ['zalando.it'] }, 'zalando.it') && !L.cashbackVale({ attivo: true, servizio: 'igraal', tutti: false, negozi: ['zalando.it'] }, 'amazon.it') && !L.cashbackVale({ attivo: false, servizio: 'igraal' }, 'x.it'));

  const leggiPrezzi = async () => (await sw.evaluate(() => chrome.storage.local.get('prezzi'))).prezzi || {};
  const oggiN = L.giornoNumero(Date.now());
  const kP = (p) => `http://prd.localhost:${porta}${p}`;
  const setPrezzoSrv = (p, v) => leggiUrl(url('prd', `/__prezzo?p=${p}&v=${v}`));
  const notifiche = async () => (await msgExt({ type: 'notificheInviate' })).lista;
  await msgExt({ type: 'opzioni', opzioni: { usaComuni: false, esplora: false, storicoPrezzi: true } });

  console.log('\n[w1] Storico prezzi, grafico, "Avvisami se scende", "Cerca anche su"');
  const pp = await ctx.newPage();
  await pp.goto(url('prd', '/p/scarpe?utm_source=news&fbclid=abc#x'));
  const rec1 = await finche(async () => (await leggiPrezzi())[kP('/p/scarpe')], 8000);
  verifica('Prezzi: pagina prodotto (JSON-LD) salvata: nome, 99,90, euro, un punto di oggi', rec1 && rec1.nome === 'Scarpe Corsa Pro' && rec1.punti.length === 1 && rec1.punti[0][0] === oggiN && rec1.punti[0][1] === 99.9 && rec1.valuta === '€', rec1);
  verifica('Prezzi: l\'indirizzo salvato è pulito (niente utm_source, fbclid, #)', rec1 && /\/p\/scarpe$/.test(rec1.url), rec1 && rec1.url);
  for (const [percorso, prezzo, nome] of [['/p/og', 59.9, 'Zaino Trek'], ['/p/micro', 1299, 'Portatile X 15'], ['/p/shop', 24.9, 'Maglia Rossa'], ['/p/woo', 35, 'Tazza Woo']]) {
    const pg = await ctx.newPage();
    await pg.goto(url('prd', percorso));
    const r = await finche(async () => (await leggiPrezzi())[kP(percorso)], 8000);
    verifica('Prezzi: ' + percorso + ' -> ' + nome + ' a ' + prezzo, r && r.punti[0][1] === prezzo && r.nome === nome, r);
    await pg.close();
  }
  const pl = await ctx.newPage();
  await pl.goto(url('prd', '/lista'));
  await dorme(3500);
  verifica('Prezzi: una pagina elenco (due prodotti) non viene salvata', !(await leggiPrezzi())[kP('/lista')]);
  await pl.close();
  await setPrezzoSrv('/p/scarpe', 89.9);
  await pp.goto(url('prd', '/p/scarpe'));
  const rec2 = await finche(async () => { const r = (await leggiPrezzi())[kP('/p/scarpe')]; return r && r.punti[r.punti.length - 1][1] === 89.9 ? r : null; }, 8000);
  verifica('Prezzi: stesso giorno, prezzo cambiato = sempre un solo punto (aggiornato a 89,90)', rec2 && rec2.punti.length === 1, rec2 && rec2.punti);
  await sw.evaluate((k) => chrome.storage.local.get('prezzi').then((r) => { r.prezzi[k].punti = [[20261101, 120], [20261105, 110], [20261107, 99.9]]; return chrome.storage.local.set({ prezzi: r.prezzi }); }), kP('/p/scarpe'));
  await pp.goto(url('prd', '/p/scarpe'));
  const rec3 = await finche(async () => { const r = (await leggiPrezzi())[kP('/p/scarpe')]; return r && r.punti.length === 4 ? r : null; }, 8000);
  verifica('Prezzi: giorni diversi = punti diversi (4 punti, ultimo di oggi a 89,90)', rec3 && rec3.punti[3][0] === oggiN && rec3.punti[3][1] === 89.9, rec3 && rec3.punti);
  const idPrd = await idScheda('*://prd.localhost/p/scarpe*');
  const pPop = await apriPopup(idPrd);
  await pPop.locator('.scheda[data-s=prezzi]').click();
  verifica('Popup "Prezzi": mini grafico SVG con la linea', await finche(async () => (await pPop.locator('#p-grafico svg polyline').count()) === 1, 6000));
  const stat = await pPop.locator('#p-stat').textContent();
  verifica('Popup "Prezzi": ora 89,90 €, minimo 89,90 €, massimo 120,00 €', stat.includes('Ora 89,90 €') && stat.includes('minimo 89,90 €') && stat.includes('massimo 120,00 €'), stat);
  const links = await pPop.locator('#cerca a').evaluateAll((a) => a.map((x) => ({ t: x.textContent, h: x.href, tg: x.target })));
  verifica('Popup "Cerca anche su": 4 pulsanti (Amazon.it, Google Shopping, Idealo.it, Trovaprezzi.it) con il nome del prodotto, si aprono in una scheda col clic', links.length === 4 && links.map((x) => x.t).join() === 'Amazon.it,Google Shopping,Idealo.it,Trovaprezzi.it' && links.every((x) => x.h.includes('Scarpe%20Corsa%20Pro') && x.tg === '_blank'), links);
  await pPop.locator('#avvisa').check();
  const rec4 = await finche(async () => { const r = (await leggiPrezzi())[kP('/p/scarpe')]; return r && r.avvisa ? r : null; }, 5000);
  verifica('"Avvisami se scende": acceso dal popup, prezzo di riferimento 89,90', rec4 && rec4.prezzoRif === 89.9, rec4);
  const nPrima = (await notifiche()).length;
  await setPrezzoSrv('/p/scarpe', 79.9);
  await pp.goto(url('prd', '/p/scarpe'));
  const n1 = await finche(async () => { const l = await notifiche(); return l.length > nPrima ? l[l.length - 1] : null; }, 8000);
  verifica('Avviso: alla visita il prezzo è sceso -> notifica "Il prezzo è sceso: da 89,90 € a 79,90 €"', n1 && n1.titolo === 'Il prezzo è sceso' && n1.testo.includes('Scarpe Corsa Pro') && n1.testo.includes('89,90 €') && n1.testo.includes('79,90 €') && n1.id === 'prezzo:' + kP('/p/scarpe'), n1);
  const attive = await sw.evaluate(() => new Promise((r) => chrome.notifications.getAll(r)));
  verifica('Avviso: la notifica esiste davvero nel browser (chrome.notifications)', attive && Object.keys(attive).includes('prezzo:' + kP('/p/scarpe')), attive);
  const nDopo = (await notifiche()).length;
  await setPrezzoSrv('/p/scarpe', 95);
  await pp.goto(url('prd', '/p/scarpe'));
  await dorme(2500);
  verifica('Avviso: se il prezzo SALE non arriva nessuna notifica e il prezzo di riferimento NON cambia a ogni lettura (resta 89,90)', (await notifiche()).length === nDopo && ((await leggiPrezzi())[kP('/p/scarpe')].prezzoRif === 89.9));
  const recSerie = (await leggiPrezzi())[kP('/p/scarpe')];
  verifica('Avviso: il minimo della serie "visita" è 79,90 (serie per fonte, una per le visite e una per il controllo)', recSerie.minSerie && recSerie.minSerie.visita === 79.9 && recSerie.minSerie.controllo === undefined, recSerie.minSerie);
  // prodotto non seguito: nessun avviso, nessun controllo in secondo piano
  const pOg = await ctx.newPage();
  await setPrezzoSrv('/p/og', 40);
  await pOg.goto(url('prd', '/p/og'));
  await dorme(2500);
  verifica('Prodotto NON seguito: il prezzo scende ma non arriva nessuna notifica', (await notifiche()).length === nDopo);
  await pOg.close();
  // controllo in secondo piano
  await leggiUrl(url('prd', '/__azzera'));
  await sw.evaluate((k) => chrome.storage.local.get('prezzi').then((r) => { r.prezzi[k].ultimoControllo = Date.now() - 2 * 86400000; return chrome.storage.local.set({ prezzi: r.prezzi }); }), kP('/p/scarpe'));
  await setPrezzoSrv('/p/scarpe', 70);
  const ctl = await msgExt({ type: 'prezziControlla' });
  const hp1 = JSON.parse(await leggiUrl(url('prd', '/__hits'))).hits;
  verifica('Controllo in secondo piano: legge robots.txt e la pagina del prodotto seguito', hp1.some((x) => x.path === '/robots.txt') && hp1.some((x) => x.path.startsWith('/p/scarpe')) && ctl.controllati === 1, { hp1, ctl });
  verifica('Controllo in secondo piano: senza cookie (credentials omit)', hp1.every((x) => !x.cookie), hp1);
  verifica('Controllo in secondo piano: non tocca i prodotti non seguiti (/p/og, /p/micro...)', !hp1.some((x) => /\/p\/(og|micro|shop|woo)/.test(x.path)), hp1);
  await dorme(1500);
  verifica('Controllo in secondo piano: la PRIMA lettura (70, diversa dalle visite: 79,90) crea la serie "controllo" e NON fa partire nessun avviso falso', (await notifiche()).length === nDopo && (await leggiPrezzi())[kP('/p/scarpe')].minSerie.controllo === 70, { n: (await notifiche()).length, nDopo, s: (await leggiPrezzi())[kP('/p/scarpe')].minSerie });
  await sw.evaluate((k) => chrome.storage.local.get('prezzi').then((r) => { r.prezzi[k].ultimoControllo = Date.now() - 2 * 86400000; return chrome.storage.local.set({ prezzi: r.prezzi }); }), kP('/p/scarpe'));
  await msgExt({ type: 'prezziControlla' });
  await dorme(1200);
  verifica('Controllo: stesso prezzo letto di nuovo (70) = nessun avviso', (await notifiche()).length === nDopo);
  // ribasso piccolo (meno dell'1%): niente avviso
  await sw.evaluate((k) => chrome.storage.local.get('prezzi').then((r) => { r.prezzi[k].ultimoControllo = Date.now() - 2 * 86400000; r.prezzi[k].ultimoAvviso = Date.now() - 2 * 86400000; return chrome.storage.local.set({ prezzi: r.prezzi }); }), kP('/p/scarpe'));
  await setPrezzoSrv('/p/scarpe', 69.8);
  await msgExt({ type: 'prezziControlla' });
  await dorme(1200);
  verifica('Controllo: ribasso sotto l\'1% (70 -> 69,80) = nessun avviso', (await notifiche()).length === nDopo, await notifiche());
  // ribasso vero ma l'ultimo avviso è di meno di 24 ore fa: rimandato
  await sw.evaluate((k) => chrome.storage.local.get('prezzi').then((r) => { r.prezzi[k].ultimoControllo = Date.now() - 2 * 86400000; r.prezzi[k].ultimoAvviso = Date.now() - 3600 * 1000; return chrome.storage.local.set({ prezzi: r.prezzi }); }), kP('/p/scarpe'));
  await setPrezzoSrv('/p/scarpe', 60);
  await msgExt({ type: 'prezziControlla' });
  await dorme(1200);
  verifica('Avviso: al massimo uno ogni 24 ore per prodotto (ribasso vero ma ultimo avviso 1 ora fa = rimandato, il minimo non si sposta)', (await notifiche()).length === nDopo && (await leggiPrezzi())[kP('/p/scarpe')].minSerie.controllo === 69.8, (await leggiPrezzi())[kP('/p/scarpe')].minSerie);
  await sw.evaluate((k) => chrome.storage.local.get('prezzi').then((r) => { r.prezzi[k].ultimoControllo = Date.now() - 2 * 86400000; r.prezzi[k].ultimoAvviso = Date.now() - 2 * 86400000; return chrome.storage.local.set({ prezzi: r.prezzi }); }), kP('/p/scarpe'));
  await leggiUrl(url('prd', '/__azzera'));
  await msgExt({ type: 'prezziControlla' });
  const hpX = JSON.parse(await leggiUrl(url('prd', '/__hits'))).hits;
  const n2 = await finche(async () => { const l = await notifiche(); return l.length > nDopo ? l[l.length - 1] : null; }, 5000);
  verifica('Controllo in secondo piano: ribasso vero (69,80 -> 60) dopo 24 ore dall\'ultimo avviso = notifica "da 69,80 € a 60,00 €"', n2 && n2.testo.includes('69,80 €') && n2.testo.includes('60,00 €'), n2);
  await msgExt({ type: 'prezziControlla' });
  const hp2 = JSON.parse(await leggiUrl(url('prd', '/__hits'))).hits;
  verifica('Controllo in secondo piano: al massimo una volta al giorno (la seconda chiamata non scarica niente)', hp2.length === hpX.length, { hpX: hpX.length, hp2: hp2.length });
  // robots.txt vieta /p/vietato
  const pv = await ctx.newPage();
  await pv.goto(url('prd', '/p/vietato'));
  await finche(async () => (await leggiPrezzi())[kP('/p/vietato')], 8000);
  await msgExt({ type: 'prezziAvvisa', chiave: kP('/p/vietato'), avvisa: true });
  await sw.evaluate((k) => chrome.storage.local.get('prezzi').then((r) => { r.prezzi[k].ultimoControllo = Date.now() - 2 * 86400000; return chrome.storage.local.set({ prezzi: r.prezzi }); }), kP('/p/vietato'));
  await pv.close();
  await leggiUrl(url('prd', '/__azzera'));
  const ctl2 = await msgExt({ type: 'prezziControlla' });
  const hp3 = JSON.parse(await leggiUrl(url('prd', '/__hits'))).hits;
  verifica('Controllo in secondo piano: rispetta robots.txt (Disallow: /p/vietato = non scaricata)', ctl2.vietati === 1 && !hp3.some((x) => x.path.startsWith('/p/vietato')) && hp3.some((x) => x.path === '/robots.txt'), { ctl2, hp3 });
  // limite 500 prodotti
  await sw.evaluate(() => chrome.storage.local.get('prezzi').then((r) => { for (let i = 0; i < 520; i++) r.prezzi['http://finto' + i + '.it/p'] = { nome: 'f' + i, dominio: 'finto' + i + '.it', valuta: '€', url: 'http://finto' + i + '.it/p', punti: [[20260101, 1]], avvisa: false, visto: 1000 + i }; return chrome.storage.local.set({ prezzi: r.prezzi }); }));
  const pm = await ctx.newPage();
  await setPrezzoSrv('/p/micro', 1200);
  await pm.goto(url('prd', '/p/micro'));
  await finche(async () => (await leggiPrezzi())[kP('/p/micro')].punti[0][1] === 1200, 8000);
  const tutti = await leggiPrezzi();
  verifica('Prezzi: al massimo 500 prodotti (via i meno recenti); restano quello appena visto e quelli seguiti', Object.keys(tutti).length === 500 && !!tutti[kP('/p/micro')] && !!tutti[kP('/p/scarpe')] && !!tutti[kP('/p/vietato')], Object.keys(tutti).length);
  await pm.close();
  await sw.evaluate(() => chrome.storage.local.get('prezzi').then((r) => { for (const k of Object.keys(r.prezzi)) if (k.startsWith('http://finto')) delete r.prezzi[k]; return chrome.storage.local.set({ prezzi: r.prezzi }); }));
  await pPop.close();
  // opzione spenta
  await msgExt({ type: 'opzioni', opzioni: { storicoPrezzi: false } });
  await sw.evaluate(() => chrome.storage.local.get('prezzi').then((r) => { for (const k of Object.keys(r.prezzi)) if (k.includes('/p/shop')) delete r.prezzi[k]; return chrome.storage.local.set({ prezzi: r.prezzi }); }));
  const ps = await ctx.newPage();
  await ps.goto(url('prd', '/p/shop'));
  await dorme(3500);
  verifica('Opzione "storico prezzi" spenta: la pagina non viene salvata', !(await leggiPrezzi())[kP('/p/shop')]);
  await ps.close();
  await msgExt({ type: 'opzioni', opzioni: { storicoPrezzi: true } });
  await pp.close();

  console.log('\n[w2] Scheda automatica: modalità solo icona, 12 secondi, mai sopra il pagamento');
  await sw.evaluate(() => chrome.storage.local.remove('nascosti'));
  await msgExt({ type: 'opzioni', opzioni: { usaComuni: true, maxCodici: 8, soloIcona: false } });
  const angoloScheda = (page) => page.evaluate(() => { const h = document.getElementById('cacciasconti-scheda'); if (!h) return null; const b = h.shadowRoot.querySelector('.box').getBoundingClientRect(); return { angolo: h.dataset.angolo, l: b.left, t: b.top, r: b.right, b: b.bottom }; });
  const rettPagaOra = (page) => page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent === 'Paga ora'); if (!x) return null; const b = x.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
  const sovrap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const ov1 = await ctx.newPage();
  await ov1.goto(url('ovl', '/cart'));
  const sc1 = await finche(async () => await angoloScheda(ov1), 9000);
  const tOvl = Date.now();
  verifica('Scheda: di base in basso a destra', sc1 && sc1.angolo === 'br', sc1);
  verifica('Scheda: mostra anche "Ti mancano 7,10 € per la spedizione gratuita" quando il carrello lo dice', (await testoScheda(ov1)).includes('Ti mancano 7,10 € per la spedizione gratuita'), await testoScheda(ov1));
  // un pulsante di pagamento compare proprio sotto la scheda: la scheda si sposta o sparisce
  await ov1.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<button id="pagaDopo" style="position:fixed;right:16px;bottom:16px;padding:14px 22px;z-index:1">Paga ora</button>'); });
  const mossa = await finche(async () => { const s = await angoloScheda(ov1); const p = await rettPagaOra(ov1); return !s || (s.angolo !== 'br' && !sovrap(s, p)) ? { s, p } : null; }, 5000);
  verifica('Scheda: se un pulsante "Paga ora" finisce sotto, la scheda si sposta (o sparisce): non lo copre mai', !!mossa && (!mossa.s || !sovrap(mossa.s, mossa.p)), mossa);
  // sparisce da sola dopo 12 s e non torna
  const resto = 12600 - (Date.now() - tOvl);
  await dorme(Math.max(0, resto));
  verifica('Scheda: dopo 12 secondi sparisce da sola', (await ov1.locator('#cacciasconti-scheda').count()) === 0);
  await msgExt({ type: 'ricontrolla', tabId: await idScheda('*://ovl.localhost/*') });
  await dorme(2000);
  verifica('Scheda: una volta sparita non riappare nella stessa visita della pagina (nemmeno dopo un nuovo controllo)', (await ov1.locator('#cacciasconti-scheda').count()) === 0);
  await ov1.close();
  await sw.evaluate(() => chrome.storage.local.remove('nascosti'));
  const ov2 = await ctx.newPage();
  await ov2.goto(url('ovl', '/cart?btn=1'));
  const sc2 = await finche(async () => await angoloScheda(ov2), 9000);
  const pb = await rettPagaOra(ov2);
  verifica('Scheda: con "Paga ora" fisso in basso a destra la scheda va in un altro angolo e non lo copre', sc2 && pb && sc2.angolo !== 'br' && !sovrap(sc2, pb), { sc2, pb });
  await ov2.close();
  await sw.evaluate(() => chrome.storage.local.remove('nascosti'));
  await msgExt({ type: 'opzioni', opzioni: { soloIcona: true } });
  const ov3 = await ctx.newPage();
  await ov3.goto(url('ovl', '/cart'));
  const idOv3 = await idScheda('*://ovl.localhost/*');
  verifica('Solo icona: il numero compare sull\'icona (8)', await finche(async () => (await badge(idOv3)) === '8', 8000), await badge(idOv3));
  await dorme(3500);
  verifica('Solo icona: nessuna scheda sulla pagina', (await ov3.locator('#cacciasconti-scheda').count()) === 0);
  const pIc = await apriPopup(idOv3);
  verifica('Solo icona: dal popup "Genera sconto" funziona ancora', await finche(async () => !(await pIc.locator('#genera').isDisabled()), 8000));
  verifica('Popup: la riga della spedizione gratuita compare nella scheda Codici', await finche(async () => (await pIc.locator('#sped').textContent()).includes('Ti mancano 7,10 € per la spedizione gratuita'), 6000), await pIc.locator('#sped').textContent());
  await pIc.close();
  await ov3.close();
  await msgExt({ type: 'opzioni', opzioni: { soloIcona: false } });

  console.log('\n[w3] Spedizione gratuita');
  const spdCasi = [['/cart', 49, 7.1, '€', 'Ti mancano 7,10 € per la spedizione gratuita'], ['/cart2', null, 7.1, '€', 'Ti mancano 7,10 € per la spedizione gratuita'], ['/cart3', 50, 18, '$', 'Ti mancano 18,00 $ per la spedizione gratuita']];
  for (const [percorso, soglia, manc, simb, testo] of spdCasi) {
    const pg = await ctx.newPage();
    await pg.goto(url('spd', percorso));
    const id = await idScheda('*://spd.localhost/*');
    const r = await finche(async () => { const x = await msgExt({ type: 'spedizioneTab', tabId: id }); return x && x.spedizione ? x.spedizione : null; }, 8000);
    verifica('Spedizione ' + percorso + ': soglia ' + soglia + ', mancano ' + manc + ' ' + simb, r && r.soglia === soglia && r.mancano === manc && r.simbolo === simb && L.testoSpedizione(r) === testo, r);
    await pg.close();
  }

  console.log('\n[w4] Cashback: promemoria alla cassa e registro');
  await sw.evaluate(() => chrome.storage.local.remove('nascosti'));
  const testoCb = (page) => page.evaluate(() => { const h = document.getElementById('cacciasconti-cashback'); return h ? { t: h.shadowRoot.textContent, href: h.shadowRoot.getElementById('l').href, rel: h.shadowRoot.getElementById('l').rel } : null; });
  const cb0 = await ctx.newPage();
  await cb0.goto(url('cbk', '/checkout'));
  await dorme(3500);
  verifica('Cashback spento di base: nessun avviso alla cassa', (await cb0.locator('#cacciasconti-cashback').count()) === 0);
  await msgExt({ type: 'opzioni', opzioni: { cashback: { attivo: true, servizio: 'topcashback', tutti: true, negozi: [] } } });
  await cb0.reload();
  const cbA = await finche(async () => await testoCb(cb0), 9000);
  verifica('Cashback: alla cassa "Hai il cashback su TopCashback: aprilo da lì prima di pagare"', cbA && cbA.t.includes('Hai il cashback su TopCashback') && cbA.t.includes('aprilo da lì prima di pagare'), cbA);
  verifica('Cashback: il link è semplice (home del servizio, nessun parametro nostro) e si apre in un\'altra scheda', cbA && cbA.href === 'https://www.topcashback.it/' && /noopener/.test(cbA.rel), cbA);
  await cb0.evaluate(() => document.getElementById('cacciasconti-cashback').shadowRoot.getElementById('x').click());
  await cb0.reload();
  await dorme(3500);
  verifica('Cashback: chiuso con la X non torna (24 ore per quel sito)', (await cb0.locator('#cacciasconti-cashback').count()) === 0);
  await sw.evaluate(() => chrome.storage.local.remove('nascosti'));
  await cb0.goto(url('cbk', '/prodotti'));
  await dorme(3500);
  verifica('Cashback: non compare sulle pagine che non sono la cassa', (await cb0.locator('#cacciasconti-cashback').count()) === 0);
  await msgExt({ type: 'opzioni', opzioni: { cashback: { attivo: true, servizio: 'igraal', tutti: false, negozi: ['altro.it'] } } });
  await cb0.goto(url('cbk', '/checkout'));
  await dorme(3500);
  verifica('Cashback con elenco negozi: su un negozio NON in elenco non compare', (await cb0.locator('#cacciasconti-cashback').count()) === 0);
  await msgExt({ type: 'opzioni', opzioni: { cashback: { attivo: true, servizio: 'altro', url: 'https://cashback.example/home', tutti: false, negozi: ['https://www.altro.it/x', 'cbk.localhost'] } } });
  await cb0.reload();
  const cbB = await finche(async () => await testoCb(cb0), 9000);
  verifica('Cashback "altro" con indirizzo scelto e negozio in elenco: compare con il link scelto', cbB && cbB.href === 'https://cashback.example/home' && cbB.t.includes('cashback.example'), cbB);
  verifica('Cashback: il promemoria è separato dalla scheda dei coupon (altro elemento della pagina)', (await cb0.locator('#cacciasconti-scheda').count()) === 0 && (await cb0.locator('#cacciasconti-cashback').count()) === 1);
  await cb0.close();
  await msgExt({ type: 'opzioni', opzioni: { cashback: { attivo: false, servizio: 'beruby', tutti: true, negozi: [] } } });
  // registro
  const isoGiorni = (g) => new Date(Date.now() - g * 86400000).toISOString().slice(0, 10);
  const e0 = await msgExt({ type: 'cbAggiungi', negozio: '', importo: '5', data: isoGiorni(1) });
  const e1 = await msgExt({ type: 'cbAggiungi', negozio: 'Zalando', importo: 'abc', data: isoGiorni(1) });
  const e2 = await msgExt({ type: 'cbAggiungi', negozio: 'Zalando', importo: '5', data: '31/12/2026' });
  verifica('Registro cashback: negozio vuoto, importo o data non validi = errore', !!e0.errore && !!e1.errore && !!e2.errore, [e0, e1, e2]);
  await msgExt({ type: 'cbAggiungi', negozio: 'Zalando', importo: '12,50', data: isoGiorni(100), stato: 'in attesa' });
  await msgExt({ type: 'cbAggiungi', negozio: 'Amazon', importo: '3', data: isoGiorni(10), stato: 'in attesa' });
  await msgExt({ type: 'cbAggiungi', negozio: 'MediaWorld', importo: '8', data: isoGiorni(200), stato: 'accreditato' });
  const pCb = await apriPopup(await idScheda('*://woo.localhost/*'));
  await pCb.locator('.scheda[data-s=risparmi]').click();
  verifica('Registro cashback: 3 voci in elenco con importo e data', await finche(async () => (await pCb.locator('#cb-lista li').count()) === 3, 5000));
  const avv = await pCb.locator('#cb-avviso').textContent();
  verifica('Registro cashback: promemoria "in attesa da più di 90 giorni" per la voce di 100 giorni (non per quella di 10 né per quella accreditata di 200)', (await pCb.locator('#cb-avviso').isVisible()) && avv.includes('1 cashback è') && (await pCb.locator('#cb-lista li.ritardo').count()) === 1 && (await pCb.locator('#cb-lista li.ritardo').textContent()).includes('Zalando'), avv);
  verifica('Registro cashback: segnalino rosso sulla scheda "Risparmi"', (await pCb.locator('#tab-risparmi .puntino').count()) === 1);
  const voci = (await msgExt({ type: 'cbLista' })).voci;
  await msgExt({ type: 'cbStato', id: voci.find((v) => v.negozio === 'Zalando').id, stato: 'accreditato' });
  await pCb.locator('.scheda[data-s=codici]').click();
  await pCb.locator('.scheda[data-s=risparmi]').click();
  verifica('Registro cashback: cambiando lo stato in "accreditato" il promemoria sparisce', await finche(async () => !(await pCb.locator('#cb-avviso').isVisible()), 4000));
  await pCb.locator('#cb-negozio').fill('Idealo');
  await pCb.locator('#cb-importo').fill('7,5');
  await pCb.locator('#cb-form button[type=submit]').click();
  verifica('Registro cashback: aggiunta dal popup (Idealo, 7,50 €)', await finche(async () => (await pCb.locator('#cb-lista').textContent()).includes('Idealo · 7,50 €'), 4000));
  const dumpCb = await msgExt({ type: 'esporta' });
  verifica('Registro cashback: va nel file di salvataggio', dumpCb.dati.cashbackRegistro.length === 4);
  await pCb.close();
  for (const v of (await msgExt({ type: 'cbLista' })).voci) await msgExt({ type: 'cbRimuovi', id: v.id });
  verifica('Registro cashback: si può togliere una voce', (await msgExt({ type: 'cbLista' })).voci.length === 0);

  console.log('\n[w5] Codici delle email dal database personale (chiave personale)');
  const pers = (id) => leggiUrl(url('pers', '/__log'));
  await leggiUrl(url('pers', '/__azzera'));
  await sw.evaluate(() => chrome.storage.local.remove(['chiavePersonale', 'statoPersonali']));
  await msgExt({ type: 'opzioni', opzioni: { endpoint: url('pers', '/f'), usaComuni: false } });
  verifica('Chiave personale: all\'inizio non c\'è', (await msgExt({ type: 'chiaveStato' })).presente === false);
  await msgExt({ type: 'personaliAggiorna' });
  verifica('Senza chiave non parte nessuna richiesta', JSON.parse(await pers()).length === 0);
  await msgExt({ type: 'chiaveImposta', chiave: 'sbagliata' });
  await msgExt({ type: 'personaliAggiorna' });
  const stBad = (await msgExt({ type: 'chiaveStato' })).stato;
  verifica('Chiave sbagliata: il servizio risponde 401 e l\'estensione dice "chiave non valida"', stBad && stBad.errore === 'chiave non valida', stBad);
  verifica('Chiave sbagliata: nessun codice salvato', !((await archivio()).archivio || {})['emailshop.it']);
  await msgExt({ type: 'chiaveImposta', chiave: 'segreto-di-prova' });
  await leggiUrl(url('pers', '/__azzera'));
  const ra = await msgExt({ type: 'personaliAggiorna' });
  const lg1 = JSON.parse(await pers());
  verifica('Chiave giusta: richiesta con ?personali=1 e intestazione x-cacciasconti-token, senza cookie', lg1.length === 1 && lg1[0].personali === '1' && lg1[0].token === 'segreto-di-prova' && !lg1[0].cookie && lg1[0].domain === null, lg1);
  const mail15 = await conCodice('emailshop.it', 'MAIL15');
  verifica('Codici email: MAIL15 salvato per emailshop.it con fonte "email (automatico)", scadenza 2099 e sconto 15%', mail15 && mail15.source === 'email (automatico)' && mail15.scade > Date.now() && mail15.info === '15%', mail15);
  verifica('Codici email: un altro negozio (altroshop.com) salvato; il codice già scaduto (VECCHIO5) no', !!(await conCodice('altroshop.com', 'ALTRO20')) && !(await conCodice('emailshop.it', 'VECCHIO5')));
  const dumpK = JSON.stringify((await msgExt({ type: 'esporta' })).dati);
  const stor = await sw.evaluate(() => chrome.storage.local.get(null).then((r) => ({ chiavi: Object.keys(r), inOpzioni: JSON.stringify(r.opzioni).includes('segreto-di-prova'), chiave: r.chiavePersonale })));
  verifica('La chiave sta solo in chrome.storage.local (non nelle opzioni) e NON va nel file di salvataggio', stor.chiave === 'segreto-di-prova' && !stor.inOpzioni && !dumpK.includes('segreto-di-prova'), stor.chiavi);
  verifica('La chiave non si rilegge dal popup (chiaveStato dice solo se c\'è)', !JSON.stringify(await msgExt({ type: 'chiaveStato' })).includes('segreto-di-prova'));
  const sync = await sw.evaluate(() => (chrome.storage.sync ? chrome.storage.sync.get(null) : Promise.resolve({})).then((r) => JSON.stringify(r)).catch(() => '{}'));
  verifica('La chiave non è in chrome.storage.sync (non si sincronizza)', !sync.includes('segreto-di-prova'));
  const manSrc = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  verifica('Il codice non usa mai chrome.storage.sync', !/storage\.sync/.test(manSrc + fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8')));
  // ogni 6 ore
  await leggiUrl(url('pers', '/__azzera'));
  await msgExt({ type: 'badge', tabId: idWoo, dominio: 'woo.localhost', campo: false });
  await dorme(1200);
  verifica('Aggiornamento ogni 6 ore: subito dopo non richiede di nuovo', JSON.parse(await pers()).length === 0);
  await sw.evaluate(() => chrome.storage.local.get('statoPersonali').then((r) => { r.statoPersonali.ts = Date.now() - 7 * 3600 * 1000; return chrome.storage.local.set({ statoPersonali: r.statoPersonali }); }));
  await msgExt({ type: 'badge', tabId: idWoo, dominio: 'woo.localhost', campo: false });
  verifica('Aggiornamento ogni 6 ore: dopo 7 ore richiede di nuovo (all\'apertura di una pagina)', await finche(async () => JSON.parse(await pers()).length === 1, 5000));
  // prima di una prova: si usa subito la cache (6 ore); se è vecchia, l'aggiornamento parte in secondo piano e la prova aspetta al massimo 300 ms
  await leggiUrl(url('pers', '/__azzera'));
  const tA = Date.now();
  await msgExt({ type: 'coda', dominio: 'emailshop.it', avvio: true });
  const lg2 = JSON.parse(await pers());
  verifica('Prima di una prova con la cache fresca (meno di 6 ore): nessuna richiesta di rete, si usano i codici già salvati', lg2.length === 0 && Date.now() - tA < 1500, { lg2, ms: Date.now() - tA });
  await msgExt({ type: 'opzioni', opzioni: { endpoint: url('pers', '/lenta') } });
  await sw.evaluate(() => chrome.storage.local.get('statoPersonali').then((r) => { r.statoPersonali.ts = Date.now() - 7 * 3600 * 1000; return chrome.storage.local.set({ statoPersonali: r.statoPersonali }); }));
  const tB = Date.now();
  const rLenta = await msgExt({ type: 'coda', dominio: 'emailshop.it', avvio: true });
  const msLenta = Date.now() - tB;
  verifica('Prima di una prova con la cache vecchia e il servizio LENTO (2,5 s): la prova aspetta al massimo 300 ms (qui ' + msLenta + ' ms) e ha già il codice MAIL15 dall\'archivio', msLenta < 1200 && rLenta.coda.includes('MAIL15'), { msLenta, coda: rLenta.coda });
  verifica('Cache vecchia: l\'aggiornamento è partito comunque (in secondo piano, richiesta per tutti i negozi)', await finche(async () => { const l = JSON.parse(await pers()); return l.length === 1 && l[0].personali === '1' && l[0].domain === null; }, 3000), JSON.parse(await pers()));
  await msgExt({ type: 'opzioni', opzioni: { endpoint: url('pers', '/f') } });
  await finche(async () => (await msgExt({ type: 'chiaveStato' })).stato.ts > Date.now() - 60000, 6000, 300);
  verifica('Il codice email entra nella coda di prova', (await msgExt({ type: 'coda', dominio: 'emailshop.it' })).coda.includes('MAIL15'));
  const pOpz = await apriPopup(idWoo);
  await pOpz.locator('.scheda[data-s=opzioni]').click();
  verifica('Opzioni: il campo "Chiave personale codici email" c\'è ed è un campo password', (await pOpz.locator('#chiave').getAttribute('type')) === 'password');
  await pOpz.close();
  await msgExt({ type: 'chiaveImposta', chiave: '' });
  verifica('Si può togliere la chiave', (await msgExt({ type: 'chiaveStato' })).presente === false);
  await msgExt({ type: 'opzioni', opzioni: { endpoint: null, usaComuni: true } });

  console.log('\n[w6] Gmail web: codici dalle email aperte');
  const GMAIL = (hash) => `<!doctype html><html><head><title>Posta in arrivo - Gmail</title></head><body><div id="lista"><table><tr><td>Offerte Negozio Prova: codice LISTA10 per te</td></tr></table></div><div id="vista"></div></body></html>`;
  await ctx.route('https://mail.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: GMAIL() }));
  const apriMsg = (page, id, mittente, oggetto, corpo) => page.evaluate(([id, mittente, oggetto, corpo]) => {
    document.getElementById('vista').innerHTML = '<h2 class="hP">' + oggetto + '</h2><div class="adn"><h3 class="iw"><span class="gD" email="' + mittente + '">Negozio</span></h3><div class="a3s aiL">' + corpo + '</div></div>';
    location.hash = '#inbox/' + id;
  }, [id, mittente, oggetto, corpo]);
  const gm = await ctx.newPage();
  await gm.goto('https://mail.google.com/mail/u/0/#inbox');
  await dorme(3500);
  const arch0 = (await archivio()).archivio;
  verifica('Gmail: nell\'elenco (nessun messaggio aperto) non si legge niente: LISTA10 non salvato', !Object.values(arch0).some((s) => s.LISTA10));
  verifica('Gmail: i moduli generici (cercatore, tester) non girano su Gmail: nessun codice salvato per google.com', !arch0['google.com'] && !arch0['mail.google.com']);
  await apriMsg(gm, 'FMfcgzQXJabcdefghijklmnop', 'store+123@m.shopifyemail.com', 'Il tuo sconto', '<p>Ciao! Usa il codice WELCOME15 per il 15% di sconto sul primo ordine. Scade il 31/12/2099.</p><p><a href="https://negozioprova.it/discount/WELCOME15">Vai al negozio</a> <a href="https://www.negozioprova.it/collections/tutto">Tutto</a> <a href="https://click.klaviyomail.com/x">x</a> <a href="https://facebook.com/negozioprova">fb</a> <a href="https://negozioprova.it/unsubscribe?u=1">disiscriviti</a></p>');
  const w15 = await finche(async () => await conCodice('negozioprova.it', 'WELCOME15'), 8000);
  verifica('Gmail: aprendo un messaggio di store+123@m.shopifyemail.com il negozio si ricava dai link (negozioprova.it); fonte "email", scadenza 2099, -15%', w15 && w15.source === 'email' && w15.scade > Date.now() && w15.info === '-15%', w15);
  verifica('Gmail: non salva niente per il dominio della piattaforma (shopifyemail.com)', !(await archivio()).archivio['shopifyemail.com']);
  await apriMsg(gm, 'FMfcgzQXJqrstuvwxyz12345', 'Offerte <offerte@e.zalando.it>', 'Moda', '<p>Sconto del 20%! Codice: MODA20 solo per oggi.</p>');
  verifica('Gmail: mittente normale -> dominio del mittente (zalando.it)', !!(await finche(async () => await conCodice('zalando.it', 'MODA20'), 8000)));
  await msgExt({ type: 'opzioni', opzioni: { gmail: false } });
  const gm2 = await ctx.newPage();
  await gm2.goto('https://mail.google.com/mail/u/0/#inbox');
  await apriMsg(gm2, 'FMfcgzQXJzzzzzzzzzzzzzz1', 'x@negoziospento.it', 'Ciao', '<p>Sconto del 15% con il codice SPENTO15, vale fino a domani. Grazie dal negozio.</p>');
  await dorme(3500);
  verifica('Gmail: con l\'opzione spenta non legge niente', !(await conCodice('negoziospento.it', 'SPENTO15')));
  await msgExt({ type: 'opzioni', opzioni: { gmail: true } });
  const rEm = await msgExt({ type: 'emailLetta', negozio: 'falso.it', codici: [{ code: 'FALSO123' }] });
  verifica('Gmail: il fondo rifiuta i messaggi "email letta" che non arrivano dalla pagina di Gmail', rEm.saltato === true && !(await conCodice('falso.it', 'FALSO123')), rEm);
  await gm.close(); await gm2.close();
  await ctx.unroute('https://mail.google.com/**');

  console.log('\n[w7] Badge nei risultati di Google');
  const GOOGLE = `<!doctype html><html><head><title>scarpe - Cerca con Google</title></head><body><div id="rso">
    <div class="g"><a href="https://www.zalando.it/scarpe-uomo/"><h3>Scarpe uomo | Zalando</h3></a></div>
    <div class="g"><a href="/url?q=https%3A%2F%2Fwww.amazon.it%2Fdp%2FB000&sa=U"><h3>Amazon scarpe</h3></a></div>
    <div class="g"><a href="https://sconosciuto.example/x"><h3>Sito senza codici</h3></a></div>
    <div class="g"><a href="https://www.solofalliti.it/x"><h3>Solo codici che non funzionano</h3></a></div>
    <div class="g"><a href="https://www.zalando.it/altra"><h3>Altra pagina Zalando</h3></a></div></div></body></html>`;
  await ctx.route('https://www.google.it/search**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: GOOGLE }));
  await sw.evaluate(() => chrome.storage.local.get('archivio').then((r) => {
    const a = r.archivio || {};
    const c = (code, esito) => ({ code, source: 'pagina', origine: 'pagina', esito, sconto: null, data: null, trovato: Date.now() });
    a['zalando.it'] = Object.assign(a['zalando.it'] || {}, { Z1: c('Z1', 'mai'), Z2: c('Z2', 'mai') });
    a['amazon.it'] = { A1: c('A1', 'mai') };
    a['solofalliti.it'] = { F1: c('F1', 'ko') };
    return chrome.storage.local.set({ archivio: a });
  }));
  const gg0 = await ctx.newPage();
  await gg0.goto('https://www.google.it/search?q=scarpe');
  await dorme(3500);
  verifica('Google: con l\'opzione spenta (di base) nessuna etichetta', (await gg0.locator('.cacciasconti-etichetta').count()) === 0);
  await msgExt({ type: 'opzioni', opzioni: { googleBadge: true } });
  await gg0.reload();
  const etich = await finche(async () => { const t = await gg0.locator('.cacciasconti-etichetta').allTextContents(); return t.length >= 3 ? t : null; }, 8000);
  verifica('Google: etichette discrete "🏷 N codici" solo per i siti con codici (zalando.it x2 risultati, amazon.it tramite /url?q=)', etich && etich.length === 3 && etich.filter((t) => t === '🏷 1 codice').length === 1 && etich.filter((t) => /^🏷 (2|\d+) codic[ei]$/.test(t)).length >= 2, etich);
  verifica('Google: nessuna etichetta per siti sconosciuti o con soli codici che non funzionano; nessuna immagine/logo', (await gg0.locator('.cacciasconti-etichetta img, .cacciasconti-etichetta svg').count()) === 0 && etich && etich.length === 3);
  await gg0.close();
  await ctx.unroute('https://www.google.it/search**');
  await msgExt({ type: 'opzioni', opzioni: { googleBadge: false } });
  const manif = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const csG = manif.content_scripts.filter((c) => c.js.includes('google.js') || c.js.includes('gmail.js'));
  verifica('Manifest: i moduli Google e Gmail girano SOLO sulle loro pagine (nessun <all_urls>)', csG.length === 2 && csG.every((c) => c.matches.every((m) => /google\./.test(m))) && csG.find((c) => c.js.includes('gmail.js')).matches.join() === 'https://mail.google.com/*', csG.map((c) => c.matches));

  console.log('\n[w8] Codici dai siti di coupon aperti da te');
  await msgExt({ type: 'opzioni', opzioni: { couponAperti: false } });
  const cpOff = await ctx.newPage();
  await cpOff.goto(url('cup', '/codici-sconto/zalando'));
  await dorme(4000);
  verifica('Siti di coupon: spento di base, non salva niente per il negozio', !(await conCodice('zalando.it', 'ZAL15')));
  await msgExt({ type: 'opzioni', opzioni: { couponAperti: true } });
  await cpOff.reload();
  const zal = await finche(async () => await conCodice('zalando.it', 'ZAL15'), 9000);
  verifica('Siti di coupon: ZAL15 salvato per zalando.it (dal link "Vai a zalando.it"), fonte "sito di coupon (aperto da te)", scadenza 2099', zal && zal.source === 'sito di coupon (aperto da te)' && zal.scade > Date.now(), zal);
  verifica('Siti di coupon: anche MODA20 ("Usa il codice ...")', !!(await conCodice('zalando.it', 'MODA20')));
  verifica('Siti di coupon: il codice dietro "Mostra codice" (nascosto) e quello sfocato NON si leggono', !(await conCodice('zalando.it', 'SEGRETO50')) && !(await conCodice('zalando.it', 'BLUR77')));
  verifica('Siti di coupon: nessun clic sul pulsante "Mostra codice"', (await cpOff.evaluate(() => window.__rivelaCliccato || 0)) === 0);
  await cpOff.close();
  await msgExt({ type: 'aggiungi', dominio: 'mediaworld.it', codice: 'TESTMW1' });
  const cpS = await ctx.newPage();
  await cpS.goto(url('cup', '/coupon/mediaworld'));
  verifica('Siti di coupon: senza link al negozio si usa il nome nell\'indirizzo (mediaworld) abbinato a un sito che conosci già', !!(await finche(async () => await conCodice('mediaworld.it', 'MEDIA25'), 9000)));
  await cpS.close();
  const cpG = await ctx.newPage();
  await cpG.goto(url('cup', '/pagina-generica'));
  await dorme(4000);
  const archG = (await archivio()).archivio;
  verifica('Siti di coupon: se non si capisce il negozio non si inventa niente (GEN99 non assegnato)', !Object.entries(archG).some(([d, s]) => s.GEN99 && s.GEN99.source === 'sito di coupon (aperto da te)'));
  await cpG.close();
  await ctx.route('https://www.picodi.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Mediaworld: offerte</title><h1>Offerte del giorno</h1><p>Codice: PIC10X — 10% su tutto</p>' }));
  const cpP = await ctx.newPage();
  await cpP.goto('https://www.picodi.com/it/mediaworld');
  const pic = await finche(async () => await conCodice('mediaworld.it', 'PIC10X'), 9000);
  verifica('Siti di coupon: dominio noto (picodi.com, elenco statico) riconosciuto anche senza "coupon" nel titolo', pic && pic.source === 'sito di coupon (aperto da te)', pic);
  await cpP.close();
  await ctx.unroute('https://www.picodi.com/**');
  const lista = JSON.parse(fs.readFileSync(path.join(EXT, 'recipes/siti-coupon.json'), 'utf8')).aggregatori;
  verifica('Elenco dei siti di coupon: file statico nel pacchetto (nessun download)', Array.isArray(lista) && lista.includes('pepper.it') && lista.includes('picodi.com'));
  await msgExt({ type: 'opzioni', opzioni: { couponAperti: false } });

  console.log('\n[w9] Permessi e codice del pacchetto');
  const man2 = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  verifica('Manifest 1.4.1: permessi storage, scripting, notifications, alarms (e basta); niente cookies/activeTab', man2.version === '1.4.1' && man2.permissions.slice().sort().join() === 'alarms,notifications,scripting,storage', man2.permissions);
  const sorgenti = fs.readdirSync(EXT).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(EXT, f), 'utf8')).join('\n');
  verifica('Nessun codice remoto: niente eval, new Function, importScripts/script da indirizzi http', !/\beval\s*\(|new Function\s*\(|importScripts\(\s*['"]https?:|createElement\(['"]script['"]\)/.test(sorgenti));
  verifica('Nessun cookie: il codice non usa chrome.cookies né document.cookie', !/chrome\.cookies|document\.cookie/.test(sorgenti));
  verifica('Nessun identificativo di affiliazione o tracciamento nei link che costruiamo (ricerche, cashback)', !/[?&](tag|aff\w*|ref|utm_\w+|subid|clickid)=/.test(sorgenti.replace(/PARAM_TRACCIA[^\n]*\n/, '')));

  }

  { // ---- sezione 1.4.1 (revisione indipendente): blocco proprio, i nomi non si scontrano
  console.log('\n[y1] 1.4.1: condivisione solo dei codici pubblici (elenco di origini consentite)');
  require('../domain.js'); require('../lib-extra.js');
  const L2 = self.CS_lib;
  const logC = async () => JSON.parse(await leggiUrl(url('cond', '/__log')));
  await leggiUrl(url('cond', '/__azzera'));
  await msgExt({ type: 'opzioni', opzioni: { usaComuni: false, esplora: false, condividi: true, endpoint: url('cond', '/fn') } });
  const ORIG = { PAGINA1: 'pagina', NEGOZIO1: 'sito del negozio', COMUNE1: 'comune', CONDIV1: 'condivisi', DEBOLE1: 'pagina (classe)',
    EMAIL001: 'email', EMAILAUTO1: 'email (automatico)', COUPON001: 'sito di coupon (aperto da te)', FONTE001: 'fonte indicata da te', MANUALE1: 'manuale', VECCHIO01: undefined };
  await sw.evaluate((o) => chrome.storage.local.get('archivio').then((r) => {
    const a = r.archivio || {}; a['shr.localhost'] = {};
    for (const [c, orig] of Object.entries(o)) { a['shr.localhost'][c] = { code: c, source: orig || 'comune', esito: 'mai', sconto: null, data: null, trovato: Date.now() }; if (orig) a['shr.localhost'][c].origine = orig; }
    return chrome.storage.local.set({ archivio: a });
  }), ORIG);
  for (const c of Object.keys(ORIG)) await msgExt({ type: 'risultato', dominio: 'shr.localhost', codice: c, ok: true, sconto: 5, pct: 10, simbolo: '€', totale: 50 });
  await dorme(1500);
  const inviati = (await logC()).filter((x) => x.metodo === 'POST').map((x) => x.corpo.code).sort();
  verifica('Condivisione: partono SOLO i codici di origine pagina / pagina (classe) / sito del negozio / comune / condivisi', JSON.stringify(inviati) === JSON.stringify(['COMUNE1', 'CONDIV1', 'DEBOLE1', 'NEGOZIO1', 'PAGINA1']), inviati);
  verifica('Condivisione: codici delle email, "email (automatico)", dei siti di coupon, delle fonti indicate da te, manuali e senza origine NON partono mai', !inviati.some((c) => /EMAIL|COUPON|FONTE|MANUALE|VECCHIO/.test(c)), inviati);
  await sw.evaluate(() => chrome.storage.local.get('archivio').then((r) => { delete r.archivio['shr.localhost']; return chrome.storage.local.set({ archivio: r.archivio }); }));
  await msgExt({ type: 'opzioni', opzioni: { condividi: false, endpoint: null, usaComuni: true } });

  console.log('\n[y2] 1.4.1: email con codici di verifica / ordini non si salvano; solo i veri sconti');
  const em = (testo, ogg) => L2.emailEstrai({ mittente: 'Negozio <info@shop.example.it>', oggetto: ogg || '', testo, link: [] }).codici.map((x) => x.code);
  verifica('Email OTP ("il tuo codice di verifica è ...") = niente', em('Il tuo codice di verifica è 4829AB12. Non condividerlo con nessuno.').length === 0);
  verifica('Email password/accesso/login/sicurezza/PIN/one-time = niente', [
    'Codice: AB12CD34 per accedere al tuo account. Hai chiesto di reimpostare la password.',
    'Your one-time code is: XK2931QA. Do not share it. Discount offers in the app.',
    'Nuovo accesso al tuo account. Codice: ZZ99XX11 (security alert)',
    'Il tuo PIN è: 5521ABCD, codice di sicurezza per la tua carta con sconto 5%',
    'Login code: LOGIN2024 - sign in to see 10% off' ].every((t) => em(t).length === 0), [em('Login code: LOGIN2024 - sign in to see 10% off')]);
  verifica('Email con numero d\'ordine ("Codice ordine / Codice: ZX99887", nessun discorso di sconto) = niente', em('Grazie per il tuo acquisto! Il tuo ordine è confermato. Codice: ZX99887. Spedizione in 3 giorni lavorativi.').length === 0 && em('Riepilogo ordine\nCodice ordine: ORD123456\nTotale 59,90 €').length === 0);
  verifica('Email promo vera (sconto/coupon/%) = salvata; anche con il codice nell\'oggetto', em('Per te il 15% di sconto: usa il codice WELCOME15 entro il 31/12/2099.').join() === 'WELCOME15' && em('Offerta lampo', 'Usa il codice FLASH25 e risparmi').join() === 'FLASH25' && em('Black Friday: codice BLACK20 per 20 € di sconto. Accesso anticipato per te!').join() === 'BLACK20');
  verifica('Email: una parola di sconto LONTANA (oltre 80 caratteri) dal codice non basta', em('Codice: LONTANO99 ' + 'x '.repeat(60) + 'approfitta dello sconto').length === 0);

  const GMAIL2 = '<!doctype html><html><head><title>Posta in arrivo - Gmail</title></head><body><div id="lista"></div><div id="vista"></div></body></html>';
  await ctx.route('https://mail.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: GMAIL2 }));
  const apri2 = (page, hash, mittente, oggetto, corpo) => page.evaluate(([hash, mittente, oggetto, corpo]) => {
    document.getElementById('vista').innerHTML = '<h2 class="hP">' + oggetto + '</h2><div class="adn"><h3 class="iw"><span class="gD" email="' + mittente + '">Negozio</span></h3><div class="a3s aiL">' + corpo + '</div></div>';
    location.hash = hash;
  }, [hash, mittente, oggetto, corpo]);
  const gx = await ctx.newPage();
  await gx.goto('https://mail.google.com/mail/u/0/#inbox');
  await dorme(1500);
  await apri2(gx, '#inbox/FMfcgzQXKotpotpotpotpotpotp1', 'sicurezza@otpshop.it', 'Il tuo codice', '<p>Il tuo codice di verifica è OTP48291A. Valido 10 minuti.</p>');
  await dorme(2500);
  await apri2(gx, '#inbox/FMfcgzQXKordineordineordine2', 'ordini@ordshop.it', 'Ordine confermato', '<p>Grazie! Ordine ricevuto. Codice: ORD998877 per seguire la spedizione.</p>');
  await dorme(2500);
  await apri2(gx, '#inbox/FMfcgzQXKpromopromopromopromo3', 'news@promshop.it', 'Per te', '<p>Il 20% di sconto sul tuo prossimo acquisto con il codice ESTATE30X, fino al 31/12/2099.</p>');
  verifica('Gmail (pagina): la email promo vera si salva (ESTATE30X)', !!(await finche(async () => await conCodice('promshop.it', 'ESTATE30X'), 8000)));
  verifica('Gmail (pagina): la email OTP e quella dell\'ordine NON salvano niente', !(await conCodice('otpshop.it', 'OTP48291A')) && !(await conCodice('ordshop.it', 'ORD998877')) && !(await archivio()).archivio['otpshop.it'] && !(await archivio()).archivio['ordshop.it']);
  // identificativo del messaggio: il nome di un'etichetta non vale
  await apri2(gx, '#label/Offerte-promozionali-lunghe-di-natale', 'news@etichetta.it', 'Per te', '<p>Il 30% di sconto con il codice ETICH30X per tutti.</p>');
  await dorme(2500);
  verifica('Gmail: l\'elenco di un\'etichetta con nome lungo (#label/Offerte-promozionali-...) non è un messaggio aperto', !(await conCodice('etichetta.it', 'ETICH30X')));
  await apri2(gx, '#label/Natale/FMfcgzQXKetichettaetichetta4', 'news@etichetta.it', 'Per te', '<p>Il 30% di sconto con il codice ETICH30X per tutti.</p>');
  verifica('Gmail: un messaggio dentro un\'etichetta (#label/Natale/<id>) si legge', !!(await finche(async () => await conCodice('etichetta.it', 'ETICH30X'), 8000)));
  // l'opzione cambia mentre Gmail è aperto: vale subito, senza ricaricare
  await msgExt({ type: 'opzioni', opzioni: { gmail: false } });
  await dorme(700);
  await apri2(gx, '#inbox/FMfcgzQXKspentospentospento5', 'news@spentoora.it', 'Per te', '<p>Il 40% di sconto con il codice SPENTO40 per te.</p>');
  await dorme(3000);
  verifica('Gmail: spegnendo l\'opzione con Gmail già aperto smette subito di leggere (nessun ricaricamento)', !(await conCodice('spentoora.it', 'SPENTO40')));
  await msgExt({ type: 'opzioni', opzioni: { gmail: true } });
  verifica('Gmail: riaccendendola con Gmail già aperto legge subito il messaggio aperto', !!(await finche(async () => await conCodice('spentoora.it', 'SPENTO40'), 8000)));
  // l'osservatore non si ferma più dopo 300 giri
  const srcG = fs.readFileSync(path.join(EXT, 'gmail.js'), 'utf8');
  verifica('Gmail: l\'osservatore non si ferma più dopo 300 giri (resta leggero: 0,9 s poi 4 s) e segue storage.onChanged', !/volte\s*>=\s*300\s*\|\|/.test(srcG) && /storage\.onChanged/.test(srcG) && /4000/.test(srcG));
  await gx.close();
  await ctx.unroute('https://mail.google.com/**');

  console.log('\n[y3] 1.4.1: Google segna il risultato come visto solo dopo una risposta riuscita');
  const gp = await ctx.newPage();
  await gp.addInitScript(() => {
    window.__chiamate = { opz: 0, cod: 0 };
    window.chrome = { runtime: { sendMessage: (m) => {
      if (m.type === 'opzioniPagina') { window.__chiamate.opz++; return Promise.resolve({ googleBadge: true }); }
      if (m.type === 'codiciPerDomini') { window.__chiamate.cod++; return window.__chiamate.cod === 1 ? Promise.reject(new Error('fondo spento')) : Promise.resolve({ conta: { 'negoziogoogle.it': 2 } }); }
      return Promise.resolve(null);
    } }, storage: { onChanged: { addListener() {} } } };
  });
  await gp.route('https://prova-google.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><a href="https://www.negoziogoogle.it/p"><h3>Negozio Google</h3></a></body></html>' }));
  await gp.goto('https://prova-google.test/search?q=x');
  await gp.addScriptTag({ path: path.join(EXT, 'domain.js') });
  await gp.addScriptTag({ path: path.join(EXT, 'google.js') });
  const etichetta = await finche(async () => (await gp.locator('.cacciasconti-etichetta').count()) === 1 ? await gp.locator('.cacciasconti-etichetta').textContent() : null, 12000, 300);
  const chiamateG = await gp.evaluate(() => window.__chiamate);
  verifica('Google: la prima risposta fallisce -> il risultato NON è segnato come visto e si riprova; poi compare "🏷 2 codici" (una sola volta)', etichetta === '🏷 2 codici' && chiamateG.cod >= 2, { etichetta, chiamateG });
  await gp.close();

  console.log('\n[y4] 1.4.1: letture del prezzo leggere (niente outerHTML dell\'intera pagina)');
  const srcPE = fs.readFileSync(path.join(EXT, 'pagina-extra.js'), 'utf8');
  verifica('pagina-extra.js non usa più outerHTML dell\'intera pagina', !/documentElement\.outerHTML/.test(srcPE) && /htmlPerPrezzo/.test(srcPE) && /firmaPrezzo/.test(srcPE));
  const grande = await ctx.newPage();
  await grande.goto('about:blank');
  await grande.setContent('<!doctype html><html><head><title>Scarpa grande</title><meta property="og:title" content="Scarpa grande"><script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: 'Scarpa grande', offers: { '@type': 'Offer', price: '49.90', priceCurrency: 'EUR' } }) + '</script></head><body>' +
    Array.from({ length: 2500 }, (_, i) => '<div class="riga r' + i + '"><span>Voce numero ' + i + ' del catalogo, testo lungo per riempire la pagina come fanno i negozi veri</span></div>').join('') + '</body></html>');
  await grande.addScriptTag({ path: path.join(EXT, 'domain.js') });
  await grande.addScriptTag({ path: path.join(EXT, 'estrattore.js') });
  await grande.addScriptTag({ path: path.join(EXT, 'lib-extra.js') });
  const mis = await grande.evaluate(() => {
    const L = self.CS_lib;
    const N = 9, giri = 5;
    const tempo = (fn) => { let migliore = 1e9; for (let g = 0; g < giri; g++) { const a = performance.now(); for (let i = 0; i < N; i++) fn(); migliore = Math.min(migliore, performance.now() - a); } return migliore; };
    const vecchio = tempo(() => L.prezzoDaHtml(document.documentElement.outerHTML));
    const nuovo = tempo(() => L.prezzoDaHtml(L.htmlPerPrezzo(document)));
    const firmaSola = tempo(() => L.firmaPrezzo(document));
    const rv = L.prezzoDaHtml(document.documentElement.outerHTML), rn = L.prezzoDaHtml(L.htmlPerPrezzo(document));
    return { nodi: document.querySelectorAll('*').length, grandezzaPagina: document.documentElement.outerHTML.length, grandezzaMinima: L.htmlPerPrezzo(document).length, vecchio, nuovo, firmaSola, uguali: JSON.stringify(rv) === JSON.stringify(rn), prezzo: rn && rn.prezzo };
  });
  console.log('  TEMPI (9 letture di fila, pagina con ' + mis.nodi + ' nodi, ' + mis.grandezzaPagina + ' caratteri): prima ' + mis.vecchio.toFixed(1) + ' ms, dopo ' + mis.nuovo.toFixed(1) + ' ms, dopo con pagina invariata (solo firma) ' + mis.firmaSola.toFixed(1) + ' ms; testo letto ' + mis.grandezzaMinima + ' caratteri');
  verifica('Pagina grande (5000 nodi): stesso prezzo di prima (49,90), HTML letto < 5% della pagina, 9 letture molto più veloci (' + mis.vecchio.toFixed(1) + ' -> ' + mis.nuovo.toFixed(1) + ' ms; invariata: ' + mis.firmaSola.toFixed(1) + ' ms)', mis.uguali && mis.prezzo === 49.9 && mis.nodi >= 5000 && mis.grandezzaMinima < mis.grandezzaPagina * 0.05 && mis.nuovo < mis.vecchio * 0.5, mis);
  await grande.close();

  console.log('\n[y5] 1.4.1: timer (alarms), robots.txt con parametri, reindirizzamenti, spazio del browser');
  const allarmi = await sw.evaluate(() => chrome.alarms.getAll());
  const aP = allarmi.find((x) => x.name === 'cacciasconti-prezzi'), aE = allarmi.find((x) => x.name === 'cacciasconti-personali');
  verifica('Timer: controllo prezzi ogni 24 ore e codici personali ogni 6 ore', aP && aP.periodInMinutes === 1440 && aE && aE.periodInMinutes === 360, allarmi);
  const prSet = (k, rec) => sw.evaluate(([k, rec]) => chrome.storage.local.get('prezzi').then((r) => { r.prezzi = r.prezzi || {}; r.prezzi[k] = rec; return chrome.storage.local.set({ prezzi: r.prezzi }); }), [k, rec]);
  const prGet = async (k) => ((await sw.evaluate(() => chrome.storage.local.get('prezzi'))).prezzi || {})[k];
  const kQ = (p) => `http://prd.localhost:${porta}${p}`;
  const vecchioRec = (u, extra) => Object.assign({ nome: 'Prova', dominio: 'prd.localhost', valuta: '€', url: u, punti: [[20261101, 50]], avvisa: true, visto: Date.now(), ultimoControllo: Date.now() - 3 * 86400000, minSerie: { visita: 50 } }, extra || {});
  await msgExt({ type: 'opzioni', opzioni: { storicoPrezzi: true } });
  // l'allarme del prezzo fa partire il controllo
  await prSet(kQ('/p/og'), vecchioRec(kQ('/p/og')));
  await leggiUrl(url('prd', '/__azzera'));
  await sw.evaluate(() => chrome.alarms.create('cacciasconti-prezzi', { when: Date.now() + 400 }));
  const hitAl = await finche(async () => JSON.parse(await leggiUrl(url('prd', '/__hits'))).hits.some((x) => x.path.startsWith('/p/og')), 8000, 300);
  verifica('Timer: quando suona l\'allarme dei prezzi, il prodotto seguito viene controllato in secondo piano', hitAl);
  await sw.evaluate(() => creaAllarmi());
  const allarmi2 = await sw.evaluate(() => chrome.alarms.getAll());
  verifica('Timer: dopo l\'allarme singolo i timer periodici vengono ricreati', allarmi2.find((x) => x.name === 'cacciasconti-prezzi' && x.periodInMinutes === 1440) && allarmi2.find((x) => x.name === 'cacciasconti-personali'), allarmi2);
  await sw.evaluate((k) => chrome.storage.local.get('prezzi').then((r) => { delete r.prezzi[k]; return chrome.storage.local.set({ prezzi: r.prezzi }); }), kQ('/p/og'));
  // robots.txt: regola con parametri (Disallow: /p/scarpe?vietato=1)
  await prSet(kQ('/p/scarpe?vietato=1'), vecchioRec(kQ('/p/scarpe') + '?vietato=1'));
  await prSet(kQ('/p/scarpe?libero=1'), vecchioRec(kQ('/p/scarpe') + '?libero=1'));
  await leggiUrl(url('prd', '/__azzera'));
  const ctlQ = await msgExt({ type: 'prezziControlla' });
  const hQ = JSON.parse(await leggiUrl(url('prd', '/__hits'))).hits;
  verifica('robots.txt: la regola "Disallow: /p/scarpe?vietato=1" vale (si guarda percorso + parametri): quella pagina non si scarica, quella con altri parametri sì', ctlQ.vietati === 1 && ctlQ.controllati === 1 && hQ.filter((x) => x.path.startsWith('/p/scarpe')).length === 1 && hQ.some((x) => x.path === '/p/scarpe?libero=1'), { ctlQ, hQ });
  await sw.evaluate(() => chrome.storage.local.get('prezzi').then((r) => { for (const k of Object.keys(r.prezzi)) if (k.includes('?vietato=1') || k.includes('?libero=1')) delete r.prezzi[k]; return chrome.storage.local.set({ prezzi: r.prezzi }); }));
  // reindirizzamento verso un altro sito: rifiutato
  const verso = url2('prd', '/p/micro');
  await prSet(kQ('/p/redir'), vecchioRec(kQ('/p/redir') + '?to=' + encodeURIComponent(verso)));
  await leggiUrl(url('prd', '/__azzera'));
  const ctlR = await msgExt({ type: 'prezziControlla' });
  const recR = await prGet(kQ('/p/redir'));
  verifica('Reindirizzamento verso un altro sito (altra porta): la pagina NON si usa (errore, nessun prezzo nuovo, nessun avviso)', ctlR.controllati === 0 && ctlR.errori === 1 && recR.punti.length === 1 && recR.punti[0][1] === 50 && !recR.minSerie.controllo, { ctlR, recR });
  await sw.evaluate((k) => chrome.storage.local.get('prezzi').then((r) => { delete r.prezzi[k]; return chrome.storage.local.set({ prezzi: r.prezzi }); }), kQ('/p/redir'));
  const srcBG = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  verifica('robots.txt: ogni controllo usa percorso + parametri (u.pathname + u.search), non il solo percorso', (srcBG.match(/consentito\(robots, u\.pathname \+ u\.search\)/g) || []).length === 2 && !/split\('\?'\)\[0\]/.test(srcBG));

  // spazio del browser finito: si tolgono i dati vecchi, si riprova, il popup avvisa
  await sw.evaluate(() => chrome.storage.local.remove(['avvisoSpazio', 'riempimento']));
  const fisso = {};
  for (let i = 0; i < 300; i++) fisso['http://quota' + i + '.it/prodotto'] = { nome: 'Prodotto di prova numero ' + i + ' con un nome piuttosto lungo', dominio: 'quota' + i + '.it', valuta: '€', url: 'http://quota' + i + '.it/prodotto', punti: [[20260101, 10], [20260102, 11], [20260103, 12]], avvisa: i === 7, visto: 1000 + i };
  await sw.evaluate((f) => chrome.storage.local.get('prezzi').then((r) => chrome.storage.local.set({ prezzi: Object.assign(r.prezzi || {}, f) })), fisso);
  const libero = await sw.evaluate(async () => { const usati = await chrome.storage.local.getBytesInUse(null); const quota = chrome.storage.local.QUOTA_BYTES; const grande = 'x'.repeat(Math.max(0, quota - usati - 60 - 8)); await chrome.storage.local.set({ riempimento: grande }); return quota - (await chrome.storage.local.getBytesInUse(null)); });
  const pq = await ctx.newPage();
  await setPrezzoQuota(pq);
  async function setPrezzoQuota(page) { await page.goto(url('prd', '/p/shop')); }
  const recWoo = await finche(async () => (await prGet(kQ('/p/shop'))), 8000);
  const avv = await finche(async () => (await sw.evaluate(() => chrome.storage.local.get('avvisoSpazio'))).avvisoSpazio, 4000);
  const nProd = Object.keys((await sw.evaluate(() => chrome.storage.local.get('prezzi'))).prezzi).length;
  verifica('Spazio finito (quota del browser): la scrittura non va persa — si tolgono i prodotti più vecchi non seguiti e si riprova (libero prima: ' + libero + ' byte)', !!recWoo && recWoo.punti.length >= 1 && nProd < 300 && !!(await prGet('http://quota7.it/prodotto')), { recWoo: !!recWoo, nProd, seguitoVivo: !!(await prGet('http://quota7.it/prodotto')) });
  verifica('Spazio finito: il browser segna l\'avviso e il popup lo mostra con il pulsante "Ho capito"', !!avv, avv);
  const popQ = await apriPopup(await idScheda('*://prd.localhost/p/shop*'));
  verifica('Popup: avviso "Lo spazio del browser era quasi finito" visibile', await finche(async () => await popQ.locator('#spazio').isVisible(), 4000));
  await popQ.locator('#spazio-btn').click();
  verifica('Popup: "Ho capito" nasconde l\'avviso e lo toglie dall\'archivio', !(await popQ.locator('#spazio').isVisible()) && !(await sw.evaluate(() => chrome.storage.local.get('avvisoSpazio'))).avvisoSpazio);
  verifica('Popup: spiega che le pagine con prezzo solo in JavaScript non si controllano in secondo piano', /solo con JavaScript/.test(await popQ.locator('#nota-js').textContent()));
  await popQ.close(); await pq.close();
  await sw.evaluate(() => chrome.storage.local.remove('riempimento'));
  await sw.evaluate(() => chrome.storage.local.get('prezzi').then((r) => { for (const k of Object.keys(r.prezzi)) if (k.startsWith('http://quota')) delete r.prezzi[k]; return chrome.storage.local.set({ prezzi: r.prezzi }); }));

  console.log('\n[y6] 1.4.1: testi, migrazione e servizio');
  const mig = fs.readFileSync(path.join(EXT, 'supabase/migrations/20261108130000_cacciasconti_codici_email.sql'), 'utf8');
  verifica('Migrazione: colonne e controlli identici alla tabella attiva (id identity, domain, code, sconto<=80, scade_il date, email_data date, mittente<=120, created_at, unique(domain, code))',
    /id bigint generated always as identity primary key/.test(mig) && /domain text not null check \(char_length\(domain\) <= 253 and domain ~ '\^\[a-z0-9\]\(\[a-z0-9\.-\]\*\[a-z0-9\]\)\?\$'\)/.test(mig) && /code text not null check \(code ~ '\^\[A-Z0-9-\]\{3,25\}\$'\)/.test(mig) &&
    /sconto text check \(char_length\(sconto\) <= 80\)/.test(mig) && /scade_il date,/.test(mig) && /email_data date,/.test(mig) && /mittente text check \(char_length\(mittente\) <= 120\)/.test(mig) && /created_at timestamptz default now\(\),/.test(mig) && /unique \(domain, code\)/.test(mig) && !/email_data timestamptz/.test(mig) && !/create index/.test(mig));
  verifica('Migrazione: RLS accesa, revoke anon/authenticated, lavoro pg_cron "cacciasconti_email_pulizia" alle 20 3 * * * con le due condizioni (scade_il < oggi-7 oppure created_at < 180 giorni), nessun altro nome', /enable row level security/.test(mig) && /revoke all on public\.cacciasconti_codici_email from anon, authenticated/.test(mig) &&
    /cron\.unschedule\('cacciasconti_email_pulizia'\)/.test(mig) && /cron\.schedule\('cacciasconti_email_pulizia', '20 3 \* \* \*'/.test(mig) && /scade_il is not null and scade_il < current_date - 7/.test(mig) && /created_at < now\(\) - interval '180 days'/.test(mig) && !/cacciasconti_pulizia_email/.test(mig) && !/coalesce\(email_data/.test(mig));
  const man3 = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const priv = fs.readFileSync(path.join(EXT, 'privacy.html'), 'utf8'), store = fs.readFileSync(path.join(EXT, 'STORE.md'), 'utf8'), readme = fs.readFileSync(path.join(EXT, 'README.md'), 'utf8');
  verifica('Manifest: la descrizione non dice più "Segue i prezzi che scegli tu" e spiega lo storico (salvato sul computer) e gli avvisi per i prodotti seguiti', !/Segue i prezzi che scegli tu/.test(man3.description) && /storico dei prezzi dei prodotti che visiti/.test(man3.description) && /ti avvisa per quelli che segui/.test(man3.description), man3.description);
  verifica('Informativa: spiega la richiesta con la chiave personale (chiave + dominio, solo se la chiave c\'è, indipendente dalla condivisione) e resta la BOZZA', /Richiesta di rete con la chiave personale/.test(priv) && /indipendente dalla condivisione/.test(priv) && /solo se hai inserito la chiave/.test(priv) && /<b>BOZZA:<\/b>/.test(priv));
  verifica('STORE.md: scopo unico riscritto ("Aiutarti a risparmiare sugli acquisti online...") con la spiegazione di ogni funzione; alarms motivato', /Aiutarti a risparmiare sugli acquisti online: codici sconto provati alla cassa, con funzioni collegate \(storico prezzi, promemoria cashback, codici dalle tue email\)/.test(store) && /Come ogni funzione serve a questo unico scopo/.test(store) && /\*\*alarms\*\*/.test(store));
  verifica('README: spiega alarms (nessun avviso all\'installazione), token di almeno 32 caratteri e il limite di 10 chiavi sbagliate', /`alarms`[^\n]*nessun avviso all'installazione/.test(readme) && /almeno 32 caratteri/.test(readme) && /10 chiavi sbagliate/.test(readme) && !/Non ci sono i permessi[^\n]*`alarms`/.test(readme));
  }

  // ================= (s) Versione, novità, permessi =================
  console.log('\n[s] Popup: versione, novità, permessi');
  const pVer = await apriPopup(idWoo);
  await pVer.locator('.scheda[data-s=opzioni]').click();
  const verMan = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  verifica('Popup mostra la versione del manifest (' + verMan + ')', (await pVer.locator('#versione').textContent()) === verMan);
  verifica('Popup mostra le novità dal CHANGELOG', await finche(async () => (await pVer.locator('#novita-testo').textContent()).includes('## ' + verMan), 3000));
  verifica('Popup: nessun avviso di permessi mancanti (Chromium li ha già)', await pVer.locator('#permessi').isHidden());
  await pVer.close();

  // ================= (t) Aggiornamento da cartella =================
  console.log('\n[t] Aggiornamento da cartella: il manifest su disco cambia e l\'estensione si ricarica');
  const os = require('os');
  const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-upd-'));
  for (const f of fs.readdirSync(EXT)) { if (!['test', 'dist', 'store', 'node_modules', 'supabase', 'strumenti'].includes(f)) fs.cpSync(path.join(EXT, f), path.join(cartella, f), { recursive: true }); }
  const ctx2 = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: ['--headless=new', '--no-proxy-server', `--disable-extensions-except=${cartella}`, `--load-extension=${cartella}`] });
  let sw2 = ctx2.serviceWorkers()[0] || (await ctx2.waitForEvent('serviceworker'));
  const ext2 = new URL(sw2.url()).host;
  const u2 = await ctx2.newPage();
  await u2.goto(`chrome-extension://${ext2}/domain.js`);
  const m2 = (x) => u2.evaluate((y) => new Promise((r) => chrome.runtime.sendMessage(y, r)), x);
  const vecchia = await sw2.evaluate(() => chrome.runtime.getManifest().version);
  const senza = await m2({ type: 'controllaAggiornamento' });
  verifica('Aggiornamento: stessa versione su disco = niente da fare', senza && senza.nuova === null, senza);
  const mf = JSON.parse(fs.readFileSync(path.join(cartella, 'manifest.json'), 'utf8'));
  mf.version = '9.9.9';
  fs.writeFileSync(path.join(cartella, 'manifest.json'), JSON.stringify(mf));
  const solo = await m2({ type: 'controllaAggiornamento', soloControlla: true });
  verifica('Aggiornamento: vede la versione nuova su disco senza ricaricare (modalità "solo controlla")', solo && solo.nuova === '9.9.9' && solo.ricarico === false, solo);
  const pAgg = await ctx2.newPage();
  await pAgg.goto(`chrome-extension://${ext2}/popup.html`);
  verifica('Aggiornamento: il popup mostra "Nuova versione pronta"', await finche(async () => await pAgg.locator('#aggiorna-banner').isVisible(), 4000));
  await pAgg.close();
  const senzaAuto = await m2({ type: 'controllaAggiornamento' });
  await dorme(1500);
  const ancoraViva = await u2.evaluate(() => chrome.runtime.getManifest().version).catch(() => null);
  verifica('Aggiornamento: la ricarica automatica è spenta di base (l\'estensione resta viva, resta l\'avviso)', senzaAuto && senzaAuto.nuova === '9.9.9' && senzaAuto.ricarico === false && ancoraViva === vecchia, senzaAuto);
  // NOTA: chrome.runtime.reload() non si può provare qui: in Chromium con --load-extension (Playwright) l'estensione sparisce dopo il reload.
  await ctx2.close();
  fs.rmSync(cartella, { recursive: true, force: true });

  await ctx.close();
  server.close();
  server2.close();
  console.log(`\nRISULTATO: ${ok} passati, ${ko} falliti`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('ERRORE NEL TEST', e); process.exit(2); });
