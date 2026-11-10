// Compila il questionario locale come un cliente e cattura il corpo che la pagina manda alla funzione.
// uso: node compila.js <file html> <out.json> [larghezza] [modo: ok|giu|bozza] [settore-cerca] [nome]
const { chromium } = require('playwright');
const fs = require('fs');
const [file, out, W = '390', modo = 'ok', cerca = 'ristorante', nome = 'PROVA Collaudo 2'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: Number(W), height: 860 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const errori = [], richieste = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errori.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errori.push('pageerror: ' + e.message));
  let corpo = null;
  await ctx.route('**/functions/v1/questionario-ricevi', async r => {
    richieste.push({ metodo: r.request().method(), headers: r.request().headers() });
    corpo = r.request().postData();
    if (modo === 'giu') return r.abort('connectionrefused');
    await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await ctx.route('https://wa.me/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>wa</p>' }));
  await page.goto('file://' + file);
  const shot = n => page.screenshot({ path: out.replace(/\.json$/, '') + `-${W}-${n}.png`, fullPage: true });
  const avanti = async () => { await page.click('#nextBtn'); await page.waitForTimeout(150); };
  const larghezzaOk = async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const overflow = [];
  await shot(0); await avanti();
  await page.fill('#fNome', nome); await page.fill('#fAtt', 'Pizzeria Prova Collaudo');
  await page.click('#fTipo'); await page.fill('#fTipo', cerca); await page.waitForTimeout(100);
  await page.dispatchEvent('#tipoList .opt >> nth=0', 'mousedown');
  if (cerca === 'zzz') await page.fill('#fAltroTipo', 'noleggio barche');
  await page.fill('#fCitta', 'Bari');
  if (!(await larghezzaOk())) overflow.push(1);
  await shot(1); await avanti();
  await page.click('#goals .card >> nth=0'); await page.click('#goals .card >> nth=2');
  if (!(await larghezzaOk())) overflow.push(2);
  await avanti();
  await page.click('#cTeam .chip >> nth=1'); await page.click('#cCan .chip >> nth=1'); await page.click('#cStr .chip >> nth=3');
  await page.fill('#fIg', '@prova'); if (!(await larghezzaOk())) overflow.push(3); await avanti();
  await page.click('#cLav .chip >> nth=0'); if (!(await larghezzaOk())) overflow.push(4); await avanti();
  // problemi: primi due sì (ore diverse), terzo no
  await page.click('.prob[data-i="0"] [data-a="si"]'); await page.click('.prob[data-i="0"] [data-o="3"]');
  await page.click('.prob[data-i="1"] [data-a="si"]'); await page.click('.prob[data-i="1"] [data-o="1"]');
  await page.click('.prob[data-i="2"] [data-a="no"]');
  await page.fill('#fProbAltro', 'Prova di collaudo: perdo tempo con le telefonate àèìòù 🍕');
  if (!(await larghezzaOk())) overflow.push(5); await shot(5); await avanti();
  await page.fill('#fMagia', 'Non rispondere a mano ai messaggi la sera'); if (!(await larghezzaOk())) overflow.push(6); await avanti();
  await page.click('#cGServe .chip >> nth=0'); await page.click('#cGOggi .chip >> nth=0'); await page.click('#cGPannello .chip >> nth=0');
  if (!(await larghezzaOk())) overflow.push(7); await avanti();
  await page.waitForTimeout(400); if (!(await larghezzaOk())) overflow.push(8); await shot(8);
  const pk = await page.$('.pz-btn'); if (pk) await pk.click();
  await avanti();
  await page.click('#cTempi .chip >> nth=1'); await page.click('#cDecide .chip >> nth=0'); await page.click('#cPag .chip >> nth=1'); await page.click('#cIva .chip >> nth=1');
  await page.fill('#fTel', '+39 333 000 0002');
  if (modo === 'bozza') {
    await page.waitForTimeout(500);
    await page.reload(); await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ nome: document.getElementById('fNome').value, tel: document.getElementById('fTel').value, cur: document.querySelector('.step.on').dataset.s, s: document.getElementById('tipoName').textContent }));
    fs.writeFileSync(out, JSON.stringify({ bozza: r, errori }, null, 1)); await browser.close(); return;
  }
  // senza consenso deve bloccare
  await avanti(); const errCons = await page.textContent('#err7');
  await page.check('#fPriv'); await avanti();
  await page.waitForSelector('#sendBtn:not(.wait)'); if (!(await larghezzaOk())) overflow.push(10); await shot(10);
  const [popup] = await Promise.all([ctx.waitForEvent('page'), page.click('#sendBtn')]);
  await page.waitForTimeout(1500);
  if (modo === 'giu') { const [p2] = await Promise.all([ctx.waitForEvent('page'), page.click('#waAgain')]); await page.waitForTimeout(800); }
  const fine = await page.evaluate(() => ({ step: document.querySelector('.step.on').dataset.s, book: document.getElementById('bookBtn').textContent, bookHref: document.getElementById('bookBtn').href, bozza: localStorage.getItem('qpc:bozza') }));
  await shot(11);
  // a11y di base: input senza etichetta, bottoni senza testo
  const a11y = await page.evaluate(() => {
    const p = [];
    document.querySelectorAll('input,textarea').forEach(i => { if (i.closest('.hp')) return; if (!i.labels?.length && !i.getAttribute('aria-label')) p.push('senza etichetta: #' + i.id); });
    document.querySelectorAll('button,a.btn').forEach(b => { if (!b.textContent.trim() && !b.getAttribute('aria-label')) p.push('bottone vuoto'); });
    return p;
  });
  fs.writeFileSync(out, JSON.stringify({ corpo: corpo && JSON.parse(corpo), richieste, errCons, fine, popup: popup.url().slice(0, 120), errori, overflow, a11y }, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
