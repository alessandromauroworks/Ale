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
  verifica('Manifest: niente "alarms" e niente "activeTab" (ridondante con <all_urls>)', !man.permissions.includes('alarms') && !man.permissions.includes('activeTab'), man.permissions);
  verifica('Manifest: Firefox 128 o più (match_origin_as_fallback)', parseInt(man.browser_specific_settings.gecko.strict_min_version, 10) >= 128, man.browser_specific_settings);
  const testi = ['README.md', 'STORE.md', 'privacy.html', 'manifest.json'].map((f) => fs.readFileSync(path.join(EXT, f), 'utf8')).join('\n');
  verifica('Testi: nessuna frase falsa "niente server" / "nessun database condiviso" / "nessun server"', !/niente server|nessun database condiviso|nessun server|non legge (né )?(email|password)|Nessun dato lascia il tuo computer/i.test(testi));
  verifica('Testi: il permesso "alarms" e "activeTab" non sono più elencati come permessi', !/\*\*activeTab\*\*|\*\*alarms\*\*|^- `activeTab`|^- `alarms`/m.test(testi));

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
  fs.rmSync(dirEdge, { recursive: true, force: true });
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: true, maxCodici: 8 } }));

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
