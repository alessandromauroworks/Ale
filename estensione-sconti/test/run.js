// Prova completa di Cacciasconti con Chromium vero e tre negozi finti.
// Uso: node test/run.js [--screenshot]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
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
