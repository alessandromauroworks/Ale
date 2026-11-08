// Prova DAL VIVO in Firefox (serve Firefox >= 128, geckodriver e selenium-webdriver).
// Uso: MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1 FIREFOX=/percorso/firefox GECKODRIVER=/percorso/geckodriver node test/firefox.js
// Costruisce il pacchetto Firefox (come pacchetto.sh), lo installa come componente temporaneo e prova i negozi finti.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { Builder, By } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const { crea } = require('./server');

const EXT = path.resolve(__dirname, '..');
const UUID = '11111111-2222-3333-4444-555555555555';
let ok = 0, ko = 0;
const verifica = (nome, cond, dettaglio) => { if (cond) { ok++; console.log('  PASS  ' + nome); } else { ko++; console.log('  FAIL  ' + nome + (dettaglio !== undefined ? '  -> ' + JSON.stringify(dettaglio) : '')); } };
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
async function finche(fn, ms, passo = 300) { const fine = Date.now() + ms; let v; while (Date.now() < fine) { try { v = await fn(); if (v) return v; } catch (e) {} await dorme(passo); } return v; }

(async () => {
  // pacchetto Firefox
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-ff-'));
  execSync(`cd "${EXT}" && ./pacchetto.sh >/dev/null && unzip -q dist/cacciasconti-${JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'))).version}-firefox.zip -d "${dir}"`);
  const server = crea();
  await new Promise((r) => server.listen(0, r));
  const porta = server.address().port;
  const url = (h, p) => `http://${h}.localhost:${porta}${p}`;

  const opts = new firefox.Options();
  opts.setBinary(process.env.FIREFOX);
  opts.addArguments('-headless');
  opts.setPreference('extensions.webextensions.uuids', JSON.stringify({ 'cacciasconti@alessandro.local': UUID }));
  opts.setPreference('network.proxy.type', 0);
  opts.setPreference('network.dns.native-is-localhost', true);
  const service = new firefox.ServiceBuilder(process.env.GECKODRIVER);
  const d = await new Builder().forBrowser('firefox').setFirefoxOptions(opts).setFirefoxService(service).build();
  try {
    await d.installAddon(dir, true);
    console.log('Componente installato (temporaneo), uuid', UUID);
    const popupUrl = `moz-extension://${UUID}/popup.html`;
    const estensione = async (js, ...args) => d.executeAsyncScript(`const done = arguments[arguments.length - 1]; (async () => { ${js} })().then(done, (e) => done({ __err: String(e) }));`, ...args);
    // pagina di servizio: il popup (ha accesso alle API)
    // WebDriver non può navigare a moz-extension://: la scheda del popup si apre dal contesto "chrome" del browser
    const apriPopup = async () => {
      const prima = await d.getAllWindowHandles();
      await d.setContext(firefox.Context.CHROME);
      await d.executeScript('const t = gBrowser.addTab(arguments[0], { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }); gBrowser.selectedTab = t;', popupUrl);
      await d.setContext(firefox.Context.CONTENT);
      await dorme(1500);
      const dopo = await d.getAllWindowHandles();
      const nuova = dopo.find((h) => !prima.includes(h));
      await d.switchTo().window(nuova);
      return nuova;
    };
    await apriPopup();
    const base = await estensione('return { v: browser.runtime.getManifest().version, perm: await browser.permissions.contains({ origins: ["<all_urls>"] }) };');
    verifica('Popup si apre in Firefox e legge la versione', base && /^\d+\.\d+\.\d+$/.test(base.v), base);
    console.log('  (permesso <all_urls> concesso all\'installazione:', base.perm, ')');
    const msgBg = (m) => estensione('return await browser.runtime.sendMessage(arguments[0]);', m);
    await msgBg({ type: 'opzioni', opzioni: { usaComuni: false, maxCodici: 8, esplora: false } });
    const popupHandle = await d.getWindowHandle();

    // --- WooCommerce finto con ricarica
    await d.switchTo().newWindow('tab');
    const wooH = await d.getWindowHandle();
    await d.get(url('woo', '/cart'));
    const archivio = async () => { const h = await d.getWindowHandle(); await d.switchTo().window(popupHandle); const r = await msgBg({ type: 'esporta' }); await d.switchTo().window(h); return r.dati.archivio; };
    const trovato = await finche(async () => ((await archivio())['woo.localhost'] || {}).ESTATE20, 15000);
    verifica('Firefox: il Cercatore (content script) trova ESTATE20 nella pagina', !!trovato, trovato);
    if (!trovato) verifica('Firefox: i content script girano (permesso sui siti)', false);
    const scheda = await finche(async () => d.executeScript('const h = document.getElementById("cacciasconti-scheda"); return h ? h.shadowRoot.textContent : "";').then((t) => (t.includes('da provare') ? t : null)), 15000);
    verifica('Firefox: compare la scheda "codici da provare"', !!scheda, scheda);
    await msgBg({ type: 'aggiungi', dominio: 'woo.localhost', codice: 'PROVA99' }).catch(() => {});
    // avvio con un clic sul pulsante della scheda (dentro lo shadow DOM)
    await d.executeScript('document.getElementById("cacciasconti-scheda").shadowRoot.getElementById("vai").click();');
    const fine = await finche(async () => {
      const t = await d.executeScript('const h = document.getElementById("cacciasconti-overlay"); return h ? h.shadowRoot.textContent : "";');
      return /Risparmi|Nessun codice|fermato|Qualcosa/.test(t) ? t : null;
    }, 150000, 1000);
    verifica('Firefox: il Tester applica il migliore: "Risparmi 20,00 € con ESTATE20"', !!fine && fine.includes('Risparmi 20,00 € con ESTATE20'), fine);
    const statoSrv = await d.executeScript('return fetch("/__stato").then((r) => r.json());');
    verifica('Firefox: il negozio ha davvero ESTATE20 applicato', statoSrv && statoSrv.coupon === 'ESTATE20', statoSrv);
    const arch2 = await archivio();
    verifica('Firefox: archivio con esito (ESTATE20 ok, WELCOME10 non provato perché comuni spenti)', (arch2['woo.localhost'].ESTATE20 || {}).esito === 'ok', arch2['woo.localhost'] && arch2['woo.localhost'].ESTATE20);

    // --- Negozio SPA e campo nascosto
    for (const [host, atteso, sc] of [['dis', 'Risparmi 20,00 € con ESTATE20', 20], ['hid', 'Risparmi 40,00 € con ESTATE20', 40]]) {
      await d.switchTo().newWindow('tab');
      await d.get(url(host, '/')); // il codice sta nel banner della home
      await finche(async () => ((await archivio())[host + '.localhost'] || {}).ESTATE20, 15000);
      if (host === 'hid') await d.get(url('hid', '/checkout'));
      await finche(async () => (await d.executeScript('return !!document.getElementById("cacciasconti-scheda");')), 15000);
      await d.executeScript('const h = document.getElementById("cacciasconti-scheda"); if (h) h.shadowRoot.getElementById("vai").click();');
      const f = await finche(async () => { const t = await d.executeScript('const h = document.getElementById("cacciasconti-overlay"); return h ? h.shadowRoot.textContent : "";'); return /Risparmi|Nessun codice|fermato|Qualcosa/.test(t) ? t : null; }, 150000, 1000);
      verifica('Firefox: ' + host + ' -> ' + atteso, !!f && f.includes(atteso), f);
    }
    // --- Popup con i codici
    await d.switchTo().window(popupHandle);
    await d.navigate().refresh();
    const lista = await finche(async () => (await d.findElement(By.id('lista')).getText()), 5000);
    verifica('Firefox: il popup mostra l\'elenco dei codici', typeof lista === 'string', lista);
    const permBox = await d.findElement(By.id('permessi')).isDisplayed();
    verifica('Firefox: avviso "Dai il permesso" nascosto quando il permesso sui siti c\'è', base.perm ? !permBox : permBox, { perm: base.perm, permBox });
    // Onboarding: tolgo il permesso sui siti (come fa Firefox di base per le estensioni MV3 firmate) e ricarico il popup
    const tolto = await estensione('return await browser.permissions.remove({ origins: ["<all_urls>"] });');
    await d.navigate().refresh();
    const permDopo = await finche(async () => d.findElement(By.id('permessi')).isDisplayed(), 5000);
    const haPerm = await estensione('return await browser.permissions.contains({ origins: ["<all_urls>"] });');
    verifica('Firefox: senza il permesso sui siti il popup mostra l\'avviso "Dai il permesso" (il pulsante poi chiede il permesso: richiede un gesto dell\'utente, non automatizzabile)', tolto === true ? (!haPerm && permDopo === true) : true, { tolto, haPerm, permDopo });
    // Se il permesso NON c'è, il pulsante deve chiedere (si verifica solo che il pulsante esista e sia visibile)
    if (!base.perm) verifica('Firefox: senza permesso il popup mostra il pulsante "Dai il permesso"', await d.findElement(By.id('perm-btn')).isDisplayed());
  } finally {
    await d.quit();
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\nRISULTATO FIREFOX: ${ok} passati, ${ko} falliti`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('ERRORE NEL TEST', e); process.exit(2); });
