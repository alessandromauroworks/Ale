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
  await pSpa.locator('.scheda[data-s=risparmi]').click();
  verifica('Popup "Risparmi": elenco con ESTATE20 e totale', await finche(async () => { const t = await pSpa.locator('#s-risparmi').textContent(); return t.includes('ESTATE20') && t.includes('spa.localhost'); }, 3000));
  verifica('Totale risparmiato = 270,00 € (20 + 250)', (await pSpa.locator('#totale').textContent()).includes('270,00'), await pSpa.locator('#totale').textContent());
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

  await ctx.close();
  server.close();
  console.log(`\nRISULTATO: ${ok} passati, ${ko} falliti`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('ERRORE NEL TEST', e); process.exit(2); });
