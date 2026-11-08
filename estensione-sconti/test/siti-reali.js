// Prova di Cacciasconti su negozi DEMO pubblici (mai negozi veri). Niente account, niente pagamenti, niente dati personali.
// Uso: node test/siti-reali.js        (serve la rete: usa il proxy del sistema, NON --no-proxy-server)
// Scrive test/RISULTATI-SITI-REALI.md. Massimo 5 codici per sito.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const EXT = path.resolve(__dirname, '..');
const CODICI = ['PROVA99', 'WELCOME10', 'SCONTO10', 'ESTATE20', 'BENVENUTO10']; // nessuno è un codice vero: servono a vedere come reagisce il sito
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

// Per ogni demo: come arrivare al carrello (passi semplici, uno per piattaforma)
const SITI = [
  { nome: 'WooCommerce Storefront (demo ufficiale)', host: 'themes.woocommerce.com', piattaforma: 'WooCommerce', inizio: 'https://themes.woocommerce.com/storefront/',
    async vaiAlCarrello(p) { await p.locator('a.add_to_cart_button.ajax_add_to_cart, a.add_to_cart_button').first().click(); await dorme(2500); await p.goto(new URL('/storefront/cart/', p.url()).href); } },
  // Dawn demo (negozio Shopify vero di demo). Il prodotto "Louise Slide Sandal" è disponibile (altri sono "Sold out"). cdn.shopify.com è rifiutato dal proxy: le pagine arrivano senza i loro script.
  { nome: 'Shopify Dawn demo: pagina carrello', host: 'theme-dawn-demo.myshopify.com', piattaforma: 'Shopify', inizio: 'https://theme-dawn-demo.myshopify.com/',
    async vaiAlCarrello(p) { await p.goto('https://theme-dawn-demo.myshopify.com/products/louise-slide-sandal'); await p.locator('button[name="add"]').first().click(); await dorme(4000); await p.goto('https://theme-dawn-demo.myshopify.com/cart'); } },
  { nome: 'Shopify Dawn demo: cassa (prima di inserire email o indirizzo)', host: 'theme-dawn-demo.myshopify.com', piattaforma: 'Shopify', inizio: 'https://theme-dawn-demo.myshopify.com/',
    async vaiAlCarrello(p) { await p.goto('https://theme-dawn-demo.myshopify.com/products/louise-slide-sandal'); await p.locator('button[name="add"]').first().click(); await dorme(4000); await p.goto('https://theme-dawn-demo.myshopify.com/checkout'); await dorme(7000); } },
  { nome: 'Magento Luma (demo pubblica)', host: 'magento.softwaretestingboard.com', piattaforma: 'Magento', inizio: 'https://magento.softwaretestingboard.com/',
    async vaiAlCarrello(p) { await p.locator('a.product-item-link').first().click(); await p.locator('.swatch-option').first().click().catch(() => {}); await p.locator('.swatch-attribute.color .swatch-option').first().click().catch(() => {}); await p.locator('#product-addtocart-button').click(); await dorme(4000); await p.goto(new URL('/checkout/cart/', p.url()).href); } },
  // demo.prestashop.com è solo la pagina di ingresso: crea un negozio su un sottodominio CASUALE (es. goofy-wine.demo.prestashop.com) che il proxy rifiuta; fo.demo.prestashop.com risponde 502.
  { nome: 'PrestaShop (demo ufficiale)', host: 'demo.prestashop.com', piattaforma: 'PrestaShop', inizio: 'https://demo.prestashop.com/',
    async vaiAlCarrello(p) {
      await dorme(15000);
      const fr = p.frames().find((x) => x !== p.mainFrame() && /\.demo\.prestashop\.com/.test(x.url()));
      if (!fr) throw new Error('il negozio demo non si apre: crea un sottodominio casuale xxx.demo.prestashop.com (proxy: 403 / ERR_TUNNEL_CONNECTION_FAILED) e fo.demo.prestashop.com risponde 502');
      await fr.locator('.product-miniature a').first().click(); await fr.locator('button.add-to-cart').click(); await dorme(2500); await fr.locator('a:has-text("Proceed to checkout"), a.btn-primary:has-text("checkout")').first().click(); } },
  { nome: 'OpenCart (demo ufficiale, extra)', host: 'demo.opencart.com', piattaforma: 'OpenCart', inizio: 'https://demo.opencart.com/',
    async vaiAlCarrello(p) { await p.locator('button[formaction*="cart.add"], button[onclick*="cart.add"]').first().click(); await dorme(2500); await p.goto(new URL('/index.php?route=checkout/cart', p.url()).href); } }
];

// SOLO=shopify,prestashop prova solo i siti il cui nome contiene una di queste parole
if (process.env.SOLO) { const k = process.env.SOLO.toLowerCase().split(','); for (let i = SITI.length - 1; i >= 0; i--) if (!k.some((w) => SITI[i].nome.toLowerCase().includes(w))) SITI.splice(i, 1); }

// WooCommerce VERO in locale (WordPress + plugin WooCommerce da wordpress.org, SQLite, php -S; vedi RISULTATI-SITI-REALI.md).
// Si accende con: WOO_BASE=http://127.0.0.1:9401 WOO_PID=11 node test/siti-reali.js   (WOO_SOLO=1 per provare solo questi)
if (process.env.WOO_BASE) {
  const base = process.env.WOO_BASE, pid = process.env.WOO_PID || '11';
  const via = (nome, percorso) => ({ nome: 'WooCommerce vero (locale): ' + nome, host: new URL(base).host, piattaforma: 'WooCommerce', inizio: base + '/',
    async vaiAlCarrello(p) { await p.goto(base + '/?add-to-cart=' + pid); await dorme(1500); await p.goto(base + percorso); } });
  const woo = [via('carrello a blocchi', '/cart/'), via('cassa a blocchi', '/checkout/'), via('carrello classico [woocommerce_cart]', '/carrello-classico/'), via('cassa classica', '/cassa-classica/')];
  if (process.env.WOO_SOLO) SITI.length = 0;
  SITI.push(...woo);
}

// OpenCart VERO in locale (release da github.com/opencart/opencart, PHP integrato + MariaDB; coupon ESTATE20 = 20%, SCONTO10 = -10, MINIMO50 = -5 con minimo 500).
// Si accende con: OC_BASE=http://127.0.0.1:9402 node test/siti-reali.js   (OC_SOLO=1 per provare solo questo)
if (process.env.OC_BASE) {
  const base = process.env.OC_BASE;
  if (process.env.OC_SOLO) SITI.length = 0;
  SITI.push({ nome: 'OpenCart vero (locale)', host: new URL(base).host, piattaforma: 'OpenCart', inizio: base + '/',
    async vaiAlCarrello(p) { await p.goto(base + '/index.php?route=product/product&product_id=28&language=en-gb'); await p.locator('#button-cart').click(); await dorme(2500); await p.goto(base + '/index.php?route=checkout/cart&language=en-gb'); } });
}

(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    proxy: proxy ? { server: proxy, bypass: '127.0.0.1,localhost' } : undefined, // rete vera: il proxy serve
    viewport: { width: 1280, height: 900 }
  });
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
  const extId = new URL(sw.url()).host;
  const util = await ctx.newPage();
  await util.goto(`chrome-extension://${extId}/popup.html`);
  const msgExt = (m) => util.evaluate((x) => new Promise((r) => chrome.runtime.sendMessage(x, r)), m);
  await sw.evaluate(() => chrome.storage.local.set({ opzioni: { usaComuni: false, maxCodici: 5 } }));

  const righe = [];
  for (const sito of SITI) {
    const r = { sito: sito.nome, piattaforma: sito.piattaforma, host: sito.host, raggiunto: 'no', campo: '-', bottone: '-', totale: '-', errore: '-', tempo: '-', nota: '' };
    await ctx.clearCookies(); // carrello pulito a ogni sito (il codice migliore resta applicato alla fine)
    const p = await ctx.newPage();
    try {
      await p.goto(sito.inizio, { timeout: 30000, waitUntil: 'domcontentloaded' });
      r.raggiunto = 'sì';
    } catch (e) {
      r.nota = String(e.message).split('\n')[0].replace('page.goto: ', '');
      righe.push(r); await p.close(); continue;
    }
    try {
      await sito.vaiAlCarrello(p);
      await dorme(2500);
      const u = new URL(p.url());
      const id = await sw.evaluate(async (h) => (await chrome.tabs.query({})).find((t) => t.url && t.url.includes(h) && !t.url.startsWith('chrome-extension')).id, u.hostname);
      const dom = await msgExt({ type: 'chiSono', dominio: u.hostname }).catch(() => null);
      const dominio = (await sw.evaluate((h) => dominioDi(h), u.hostname));
      await sw.evaluate((d) => chrome.storage.local.get('archivio').then((x) => { const a = x.archivio || {}; delete a[d]; return chrome.storage.local.set({ archivio: a }); }), dominio);
      for (const c of CODICI) await msgExt({ type: 'aggiungi', dominio, codice: c });
      const dg = await msgExt({ type: 'diagnosiTab', tabId: id });
      const fr = (dg.frame || []).find((f) => f.campo) || (dg.frame || []).find((f) => f.interruttore);
      r.campo = fr ? (fr.campo ? 'sì' : 'sì (dietro un link)') + (fr.frameId ? ', in un frame' : '') : 'NO';
      r.bottone = fr && fr.bottone ? 'sì: ' + fr.bottone : 'no (uso Invio)';
      const tot = (dg.frame || []).find((f) => f.totale != null);
      r.totale = tot ? tot.totale + ' ' + tot.simbolo : 'NON LETTO';
      if (fr) {
        const t0 = Date.now();
        await msgExt({ type: 'avviaTab', tabId: id });
        const st = await (async () => { for (let i = 0; i < 120; i++) { const s = await sw.evaluate(async (i2) => (await chrome.storage.session.get('test_' + i2))['test_' + i2] || null, id); if (s && s.concluso) return s; await dorme(500); } return null; })();
        r.tempo = Math.round((Date.now() - t0) / 1000) + ' s';
        const arch = (await sw.evaluate(() => chrome.storage.local.get('archivio'))).archivio[dominio] || {};
        const motivi = CODICI.map((c) => (arch[c] ? c + ': ' + (arch[c].esito === 'ok' ? 'FUNZIONA' : arch[c].motivo) : c + ': non provato'));
        r.errore = motivi.join('; ');
        const dg2 = await msgExt({ type: 'diagnosiTab', tabId: id }).catch(() => null);
        const tot2 = dg2 && (dg2.frame || []).find((f) => f.totale != null);
        if (tot2) r.totale += ' -> dopo il test ' + tot2.totale + ' ' + tot2.simbolo;
        r.migliore = st && st.concluso && st.concluso.code ? st.concluso.code + (st.concluso.sconto ? ' (-' + st.concluso.sconto + ' ' + st.concluso.simbolo + ')' : '') : '-';
        r.coda = st && st.coda; r.nota = st ? st.concluso.tipo + (st.concluso.testo ? ' - ' + st.concluso.testo : '') + (st.concluso.nota ? ' - ' + st.concluso.nota : '') + ' [coda: ' + (st.coda || []).join(',') + ' | provati: ' + st.risultati.map((x) => x.code + (x.ok ? '+' : '-')).join(',') + ']' : 'il test non è finito in 60 s';
      }
    } catch (e) { r.nota = 'Errore nei passi: ' + String(e.message).split('\n')[0]; }
    righe.push(r);
    await p.close();
  }
  await ctx.close();

  const data = new Date().toISOString().slice(0, 10);
  let md = `# Prova su negozi demo pubblici (Cacciasconti)\n\nData prova: ${data}. Solo negozi DEMO, niente account, niente pagamenti, niente dati personali, al massimo ${CODICI.length} codici inventati per sito (${CODICI.join(', ')}).\n\n`;
  md += '| Negozio | Raggiunto | Campo coupon | Pulsante applica | Totale letto | Messaggio di errore riconosciuto | Codice migliore applicato | Tempo | Note |\n|---|---|---|---|---|---|---|---|---|\n';
  for (const r of righe) md += `| ${r.sito} (${r.host}) | ${r.raggiunto} | ${r.campo} | ${r.bottone} | ${r.totale} | ${r.errore} | ${r.migliore || '-'} | ${r.tempo} | ${r.nota} |\n`;
  fs.writeFileSync(path.join(__dirname, 'RISULTATI-SITI-REALI.generato.md'), md);
  console.log(md);
})().catch((e) => { console.error('ERRORE', e); process.exit(2); });
