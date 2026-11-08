// Tre negozi finti per provare Cacciasconti. Codici validi: ESTATE20 (-20%), SCONTO10 (-10%).
const http = require('http');

const VALIDI = { ESTATE20: 0.2, SCONTO10: 0.1 };
const sessioni = {}; // WooCommerce finto: stato lato server, per cookie
const virgola = (n) => n.toFixed(2).replace('.', ',') + ' €';
const inglese = (n) => '£ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function leggiCorpo(req) {
  return new Promise((ok) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => ok(b)); });
}
function cookie(req) {
  const m = /sid=(\w+)/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}

// ---------- (a) WooCommerce finto, con ricaricamento completo ----------
function paginaWoo(s) {
  const sub = 100, spedizione = 4.9;
  const sc = s.coupon ? sub * VALIDI[s.coupon] : 0;
  const totale = sub - sc + spedizione;
  const flash = s.flash ? `<div class="woocommerce-notices-wrapper"><div class="${s.flash.tipo === 'errore' ? 'woocommerce-error' : 'woocommerce-message'}" role="alert">${s.flash.testo}</div></div>` : '';
  s.flash = null;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Negozio Woo</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:30px auto;padding:0 20px;color:#222}.top-banner{background:#fff3cd;padding:10px;border-radius:8px}table{width:100%;margin:12px 0}td,th{text-align:left;padding:6px;border-bottom:1px solid #eee}.checkout-button{display:inline-block;background:#222;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none}</style></head><body>
<div class="top-banner">Estate in corso: usa il codice ESTATE20 per il 20% di sconto!</div>
<h1>Carrello</h1>${flash}
<table class="cart"><tr><td>Scarpe</td><td>49,90 €</td></tr><tr><td>Zaino</td><td>50,10 €</td></tr></table>
<form class="woocommerce-cart-form coupon" method="post" action="/cart">
  <label for="coupon_code">Coupon:</label>
  <input type="text" name="coupon_code" class="input-text" id="coupon_code" placeholder="Codice coupon">
  <button type="submit" class="button" name="apply_coupon" value="Applica il coupon">Applica il coupon</button>
</form>
<form method="post" action="/newsletter"><input type="email" name="email" placeholder="La tua email"><button type="submit">Iscriviti</button></form>
<table class="cart_totals">
<tr class="cart-subtotal"><th>Subtotale</th><td><span class="amount">${virgola(sub)}</span></td></tr>
${s.coupon ? `<tr class="cart-discount coupon-${s.coupon.toLowerCase()}"><th>Coupon: ${s.coupon.toLowerCase()}</th><td>-${virgola(sc)} <a href="/cart?remove_coupon=${s.coupon}" class="woocommerce-remove-coupon">[Rimuovi]</a></td></tr>` : ''}
<tr class="shipping"><th>Spedizione</th><td>${virgola(spedizione)}</td></tr>
<tr class="order-total"><th>Totale</th><td><strong><span class="amount">${virgola(totale)}</span></strong></td></tr>
</table>
<a class="checkout-button" href="/pagamento">Procedi al pagamento</a>
</body></html>`;
}

// ---------- (b) SPA stile React ----------
const PAGINA_SPA = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Negozio SPA</title></head><body>
<div class="promo-banner">Summer sale! With code ESTATE20 get 20% off your order.</div>
<div id="app"></div>
<script>
// Il campo reagisce SOLO agli eventi "input" (come un componente controllato).
const SUB = 1250;
let state = { code: '', applied: null, loading: false, msg: null };
const app = document.getElementById('app');
app.innerHTML = '<h1>Your cart</h1><div class="line">Subtotal <span>£ 1,250.00</span></div>' +
 '<div class="disc"><input id="disc" placeholder="Discount code" autocomplete="off"><button id="ap">Apply</button></div>' +
 '<div id="status"></div><div id="rm"></div>' +
 '<div class="summary-total"><span>Total</span> <b data-testid="total" id="tot"></b></div><button class="pay">Pay now</button>';
const fmt = (n) => '£ ' + n.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
const input = document.getElementById('disc');
input.addEventListener('input', (e) => { state.code = e.target.value; });
function render() {
  const pct = state.applied ? state.applied.pct : 0;
  document.getElementById('tot').textContent = fmt(SUB * (1 - pct));
  const st = document.getElementById('status');
  st.textContent = '';
  st.className = '';
  if (state.loading) { st.textContent = 'Checking...'; st.className = 'loading'; }
  else if (state.msg) { st.textContent = state.msg.t; st.className = 'msg ' + (state.msg.ok ? 'success' : 'error'); }
  const rm = document.getElementById('rm');
  rm.textContent = '';
  if (state.applied) {
    const b = document.createElement('button');
    b.textContent = 'Remove code';
    b.onclick = () => { state.applied = null; state.msg = null; render(); };
    rm.appendChild(b);
  }
}
document.getElementById('ap').addEventListener('click', async () => {
  if (!state.code) return;
  state.loading = true; state.msg = null; render();
  const r = await fetch('/api/coupon', { method: 'POST', body: JSON.stringify({ code: state.code }) });
  const j = await r.json();
  state.loading = false;
  if (j.ok) { state.applied = { code: state.code, pct: j.pct }; state.msg = { ok: true, t: 'Code applied' }; }
  else state.msg = { ok: false, t: 'Codice non valido' };
  render();
});
render();
</script></body></html>`;

// ---------- (c) campo nascosto dietro "Hai un codice sconto?" ----------
const PAGINA_HOME = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Negozio Home</title></head><body>
<h1>Benvenuto</h1><div class="banner">Solo oggi: con il codice ESTATE20 hai il 20% di sconto sul tuo ordine.</div>
<a href="/checkout">Vai alla cassa</a></body></html>`;
const PAGINA_CHECKOUT = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Cassa</title></head><body>
<h1>Cassa</h1>
<form id="dati"><input type="email" name="email" placeholder="Email"><input name="nome" placeholder="Nome e cognome">
<input name="cap" placeholder="CAP" autocomplete="postal-code"><input name="codice_fiscale" placeholder="Codice fiscale"></form>
<p><a href="#" id="toggle">Hai un codice sconto?</a></p>
<div id="cbox" style="display:none"><input name="discount_code" placeholder="Codice sconto"><button id="ap" type="button">Applica</button>
<div id="esito" class="notice"></div></div>
<div id="riga"></div>
<div class="order-summary"><div class="subtotal">Subtotale 200,00 €</div><div class="grand-total">Totale <span id="tot">200,00 €</span></div></div>
<button class="pay" type="button">Ordina e paga</button>
<script>
let pct = 0, cod = null;
const $ = (s) => document.querySelector(s);
const virg = (n) => n.toFixed(2).replace('.', ',') + ' €';
function draw() {
  $('#tot').textContent = virg(200 * (1 - pct));
  $('#riga').innerHTML = cod ? '<div class="discount-row">Sconto ' + cod + ': -' + virg(200 * pct) + ' <a href="#" id="rm">Rimuovi codice</a></div>' : '';
  const rm = $('#rm'); if (rm) rm.onclick = (e) => { e.preventDefault(); pct = 0; cod = null; $('#esito').textContent = ''; draw(); };
}
$('#toggle').onclick = (e) => { e.preventDefault(); $('#cbox').style.display = 'block'; };
$('#ap').onclick = () => {
  const c = $('[name=discount_code]').value.trim().toUpperCase();
  const V = { ESTATE20: 0.2, SCONTO10: 0.1 };
  setTimeout(() => {
    if (V[c]) { pct = V[c]; cod = c; $('#esito').textContent = 'Codice applicato'; }
    else $('#esito').textContent = 'Codice non valido';
    draw();
  }, 250);
};
draw();
</script></body></html>`;

// ---------- Pagine per i casi difficili (robustezza e frame) ----------
const HEAD = (t) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${t}</title></head><body>`;
const BANNER = '<div class="banner">Solo oggi: usa il codice ESTATE20 per il 20% di sconto.</div>';
const SCRIPT_V = "const V = { ESTATE20: 0.2, SCONTO10: 0.1 }; const virg = (n) => n.toFixed(2).replace('.', ',') + ' €';";

// (d) il pulsante resta spento finché nel campo non c'è del testo; si riaccende con 150 ms di ritardo
const PAGINA_DIS = HEAD('Pulsante spento') + BANNER + `<h1>Cassa</h1>
<div class="coupon"><input name="coupon" placeholder="Codice sconto" id="c" autocomplete="off"><button id="ap" type="button" disabled>Applica</button></div>
<div id="esito" class="notice"></div><div id="riga"></div>
<div class="grand-total">Totale <span id="tot">100,00 €</span></div>
<script>${SCRIPT_V}
const c = document.getElementById('c'), ap = document.getElementById('ap'), tot = document.getElementById('tot'), es = document.getElementById('esito'), riga = document.getElementById('riga');
c.addEventListener('input', () => setTimeout(() => { ap.disabled = !c.value.trim(); }, 150));
ap.addEventListener('click', () => {
  if (ap.disabled) return;
  const code = c.value.trim().toUpperCase();
  setTimeout(() => {
    if (V[code]) { tot.textContent = virg(100 * (1 - V[code])); es.textContent = 'Codice applicato'; riga.innerHTML = '<a href="#" id="rm">Rimuovi codice</a>';
      document.getElementById('rm').onclick = (e) => { e.preventDefault(); tot.textContent = '100,00 €'; riga.innerHTML = ''; es.textContent = ''; c.value = ''; ap.disabled = true; }; }
    else es.textContent = 'Codice non valido';
  }, 200);
});
</script></body></html>`;

// (e) il "pulsante" non è un <button>: <a> senza ruolo, <div role=button> o <span onclick>
function paginaBtn(v) {
  const el = v === 'div' ? '<div role="button" class="cta" id="ap" tabindex="0">Applica</div>'
    : v === 'span' ? '<span class="btn-apply" id="ap">Apply</span>'
      : '<a href="#" class="apply-link" id="ap">Applica</a>';
  return HEAD('Pulsante speciale') + BANNER + `<h1>Carrello</h1>
<div class="coupon-box"><input name="coupon" placeholder="Hai un codice sconto?" id="c" autocomplete="off">${el}</div>
<div id="esito" class="notice"></div><div id="riga"></div>
<div class="order-total">Totale <span id="tot">100,00 €</span></div>
<script>${SCRIPT_V}
const c = document.getElementById('c'), tot = document.getElementById('tot'), es = document.getElementById('esito'), riga = document.getElementById('riga');
document.getElementById('ap').addEventListener('click', (e) => {
  e.preventDefault();
  const code = c.value.trim().toUpperCase();
  setTimeout(() => {
    if (V[code]) { tot.textContent = virg(100 * (1 - V[code])); es.textContent = 'Codice applicato'; riga.innerHTML = '<a href="#" id="rm">Rimuovi codice</a>';
      document.getElementById('rm').onclick = (e) => { e.preventDefault(); tot.textContent = '100,00 €'; riga.innerHTML = ''; es.textContent = ''; c.value = ''; }; }
    else es.textContent = 'Codice non valido';
  }, 200);
});
</script></body></html>`;
}

// (f) campo e pulsante vengono ricreati a ogni lettera (come un componente che si ridisegna); gli eventi delle vecchie copie vengono ignorati
const PAGINA_RER = HEAD('Ridisegno') + BANNER + `<h1>Cassa</h1>
<div id="host"></div><div id="esito" class="notice"></div><div id="riga"></div>
<div class="order-total">Totale <span id="tot">100,00 €</span></div>
<script>${SCRIPT_V}
let stato = { code: '' }, pct = 0;
const host = document.getElementById('host'), es = document.getElementById('esito'), tot = document.getElementById('tot'), riga = document.getElementById('riga');
function disegna() { host.innerHTML = '<div class="cp"><input name="coupon" placeholder="Codice sconto" value="' + stato.code.replace(/"/g, '') + '"><button type="button" class="apply">Applica</button></div>'; }
host.addEventListener('input', (e) => { stato.code = e.target.value; disegna(); });
host.addEventListener('click', (e) => {
  if (!e.target.classList || !e.target.classList.contains('apply')) return;
  const code = stato.code.trim().toUpperCase();
  setTimeout(() => {
    if (V[code]) { tot.textContent = virg(100 * (1 - V[code])); es.textContent = 'Codice applicato'; riga.innerHTML = '<a href="#" id="rm">Rimuovi codice</a>';
      document.getElementById('rm').onclick = (e) => { e.preventDefault(); tot.textContent = '100,00 €'; riga.innerHTML = ''; es.textContent = ''; stato.code = ''; disegna(); }; }
    else es.textContent = 'Codice non valido';
  }, 200);
});
disegna();
</script></body></html>`;

// (g) tutto dentro shadow DOM aperti (campo, pulsante, messaggio; il totale in un secondo componente annidato)
const PAGINA_SHD = HEAD('Shadow DOM') + BANNER + `<h1>Cassa</h1><shop-cart></shop-cart>
<script>${SCRIPT_V}
class TotaleBox extends HTMLElement { constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = '<div class="order-total">Totale <span id="t">100,00 €</span></div>'; } set(v) { this.shadowRoot.getElementById('t').textContent = v; } }
customElements.define('total-box', TotaleBox);
class Carrello extends HTMLElement {
  constructor() {
    super();
    const r = this.attachShadow({ mode: 'open' });
    r.innerHTML = '<div class="cp"><input name="coupon" placeholder="Codice sconto"><button type="button">Applica</button></div><div class="notice" id="e"></div><div id="riga"></div><total-box></total-box>';
    const inp = r.querySelector('input'), es = r.getElementById('e'), box = r.querySelector('total-box'), riga = r.getElementById('riga');
    r.querySelector('button').addEventListener('click', () => {
      const code = inp.value.trim().toUpperCase();
      setTimeout(() => {
        if (V[code]) { box.set(virg(100 * (1 - V[code]))); es.textContent = 'Codice applicato'; riga.innerHTML = '<a href="#" id="rm">Rimuovi codice</a>';
          r.getElementById('rm').onclick = (e) => { e.preventDefault(); box.set('100,00 €'); riga.innerHTML = ''; es.textContent = ''; inp.value = ''; }; }
        else es.textContent = 'Codice non valido';
      }, 200);
    });
  }
}
customElements.define('shop-cart', Carrello);
</script></body></html>`;

// (h) formati diversi del totale (?f=0..8), anche con il prezzo vecchio barrato
const PAGINA_FMT = HEAD('Formati del totale') + BANNER + `<h1>Carrello</h1>
<div class="cp"><input name="coupon" placeholder="Codice sconto" id="c"><button type="button" id="ap">Applica</button></div>
<div id="esito" class="notice"></div><div id="riga"></div>
<div class="cart-total" id="tot"></div>
<script>${SCRIPT_V}
const it = (n) => n.toFixed(2).replace('.', ',').replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
const itSp = (n, sp) => n.toFixed(2).replace('.', ',').replace(/\\B(?=(\\d{3})+(?!\\d))/g, sp);
const en = (n) => n.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
const ch = (n) => n.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, "'");
const FORMATI = [
  (n) => 'Totale € ' + it(n),
  (n) => 'Totale ' + itSp(n, '\\u00a0') + '\\u00a0€',
  (n) => 'Totale ' + itSp(n, ' ') + ' €',
  (n) => 'Total EUR ' + en(n),
  (n) => "Total CHF " + ch(n),
  (n, vecchio) => 'Totale ' + (vecchio ? '<del>€ ' + it(1250) + '</del> <ins>€ ' + it(n) + '</ins>' : '€ ' + it(n)),
  (n, vecchio) => 'Totale ' + (vecchio ? '<span>€ ' + it(n) + '</span> <s>€ ' + it(1250) + '</s>' : '€ ' + it(n)),
  (n, vecchio) => 'Totale ' + (vecchio ? '<b>€ ' + it(n) + '</b> <span style="text-decoration:line-through">€ ' + it(1250) + '</span>' : '€ ' + it(n)),
  (n) => 'Total $' + en(n),
  (n) => 'Total ' + en(n) + ' GBP'
];
const f = parseInt(new URLSearchParams(location.search).get('f') || '0', 10);
const tot = document.getElementById('tot'), es = document.getElementById('esito'), riga = document.getElementById('riga'), c = document.getElementById('c');
const disegna = (n, vecchio) => { tot.innerHTML = FORMATI[f](n, vecchio); };
disegna(1250, false);
document.getElementById('ap').addEventListener('click', () => {
  const code = c.value.trim().toUpperCase();
  setTimeout(() => {
    if (V[code]) { disegna(1250 * (1 - V[code]), true); es.textContent = 'Codice applicato'; riga.innerHTML = '<a href="#" id="rm">Rimuovi codice</a>';
      document.getElementById('rm').onclick = (e) => { e.preventDefault(); disegna(1250, false); riga.innerHTML = ''; es.textContent = ''; c.value = ''; }; }
    else es.textContent = 'Codice non valido';
  }, 200);
});
</script></body></html>`;

// ---------- Frame ----------
const PAGINA_FORM_FRAME = HEAD('Form coupon') + `<style>body{font-family:system-ui;margin:8px}</style>
<div class="cp"><input type="text" name="coupon_code" placeholder="Codice sconto" id="c" autocomplete="off"><button type="button" id="ap">Applica</button></div>
<div id="esito" class="notice"></div>
<script>${SCRIPT_V}
const c = document.getElementById('c'), es = document.getElementById('esito');
document.getElementById('ap').addEventListener('click', () => {
  const code = c.value.trim().toUpperCase();
  setTimeout(() => {
    if (V[code]) { es.textContent = 'Codice applicato'; parent.postMessage({ tipo: 'sconto', pct: V[code], code }, '*'); }
    else es.textContent = 'Codice non valido';
  }, 200);
});
addEventListener('message', (e) => { if (e.data && e.data.tipo === 'reset') { c.value = ''; es.textContent = ''; } });
</script></body></html>`;

// Pagina principale: totale e riga sconto stanno qui, il campo coupon nel frame (?src= indirizzo del frame)
const PAGINA_TOP_FRAME = HEAD('Negozio con frame') + BANNER + `<h1>Carrello</h1>
<iframe id="fr" width="440" height="140" style="border:1px solid #ccc"></iframe>
<div id="riga"></div>
<div class="order-summary"><div class="grand-total">Totale <span id="tot">200,00 €</span></div></div>
<script>
const virg = (n) => n.toFixed(2).replace('.', ',') + ' €';
const fr = document.getElementById('fr');
fr.src = new URLSearchParams(location.search).get('src');
window.aggiorna = (pct, code) => {
  document.getElementById('tot').textContent = virg(200 * (1 - pct));
  document.getElementById('riga').innerHTML = '<div class="discount-row">Sconto ' + code + ': -' + virg(200 * pct) + ' <a href="#" id="rm">Rimuovi codice</a></div>';
  document.getElementById('rm').onclick = (e) => { e.preventDefault(); document.getElementById('tot').textContent = '200,00 €'; document.getElementById('riga').innerHTML = ''; fr.contentWindow.postMessage({ tipo: 'reset' }, '*'); };
};
addEventListener('message', (e) => { if (e.data && e.data.tipo === 'sconto') window.aggiorna(e.data.pct, e.data.code); });
</script></body></html>`;

// Frame con il campo coupon nello stesso sito (srcdoc, stessa origine)
const PAGINA_TOP_SRCDOC = (() => {
  const dentro = HEAD('x') + `<div class="cp"><input type="text" name="coupon_code" placeholder="Codice sconto" id="c" autocomplete="off"><button type="button" id="ap">Applica</button></div><div id="esito" class="notice"></div>
<script>const V = { ESTATE20: 0.2, SCONTO10: 0.1 }; const c = document.getElementById('c'), es = document.getElementById('esito');
document.getElementById('ap').addEventListener('click', () => { const code = c.value.trim().toUpperCase();
  setTimeout(() => { if (V[code]) { es.textContent = 'Codice applicato'; parent.aggiorna(V[code], code); } else es.textContent = 'Codice non valido'; }, 200); });
window.reset = () => { c.value = ''; es.textContent = ''; };
<\/script></body></html>`;
  return PAGINA_TOP_FRAME.replace('fr.src = new URLSearchParams(location.search).get(\'src\');', '')
    .replace('<iframe id="fr" width="440" height="140" style="border:1px solid #ccc"></iframe>', '<iframe id="fr" width="440" height="140" srcdoc="' + dentro.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></iframe>')
    .replace("fr.contentWindow.postMessage({ tipo: 'reset' }, '*');", 'fr.contentWindow.reset();');
})();

// Il contrario: campo coupon nella pagina principale, totale in un frame di un altro sito
const PAGINA_CAMPO_TOP = (src) => HEAD('Campo nella pagina') + BANNER + `<h1>Cassa</h1>
<div class="coupon"><input name="coupon" placeholder="Codice sconto" id="c" autocomplete="off"><button id="ap" type="button">Applica</button></div>
<div id="esito" class="notice"></div><div id="riga"></div>
<iframe id="fr" src="${src}" width="440" height="80" style="border:1px solid #ccc"></iframe>
<script>${SCRIPT_V}
const fr = document.getElementById('fr'), c = document.getElementById('c'), es = document.getElementById('esito'), riga = document.getElementById('riga');
document.getElementById('ap').addEventListener('click', () => {
  const code = c.value.trim().toUpperCase();
  setTimeout(() => {
    if (V[code]) { es.textContent = 'Codice applicato'; fr.contentWindow.postMessage({ tipo: 'totale', v: virg(200 * (1 - V[code])) }, '*'); riga.innerHTML = '<a href="#" id="rm">Rimuovi codice</a>';
      document.getElementById('rm').onclick = (e) => { e.preventDefault(); fr.contentWindow.postMessage({ tipo: 'totale', v: '200,00 €' }, '*'); riga.innerHTML = ''; es.textContent = ''; c.value = ''; }; }
    else es.textContent = 'Codice non valido';
  }, 200);
});
</script></body></html>`;
const PAGINA_TOTALE_FRAME = HEAD('Riepilogo') + `<div class="order-total">Totale <span id="t">200,00 €</span></div>
<script>addEventListener('message', (e) => { if (e.data && e.data.tipo === 'totale') document.getElementById('t').textContent = e.data.v; });</script></body></html>`;

// ---------- Markup simulato dei demo ufficiali (da come sono fatti Magento Luma e PrestaShop; NON sono i siti veri) ----------
const PAGINA_MAG = HEAD('Magento (simulato)') + BANNER + `<h1>Shopping Cart</h1>
<div class="block discount" id="block-discount">
  <div class="title" data-role="title"><strong id="block-discount-heading" role="heading" aria-level="2">Apply Discount Code</strong></div>
  <div class="content" data-role="content" aria-labelledby="block-discount-heading" style="display:none">
    <form id="discount-coupon-form" onsubmit="return false">
      <div class="fieldset coupon"><div class="field"><label for="coupon_code" class="label"><span>Enter discount code</span></label>
        <div class="control"><input type="text" class="input-text" id="coupon_code" name="coupon_code" placeholder="Enter discount code"></div></div>
        <div class="actions-toolbar"><div class="primary"><button class="action apply primary" type="button" value="Apply Discount"><span>Apply Discount</span></button></div></div></div>
    </form>
  </div>
</div>
<div id="msgs" class="messages"></div>
<table class="data table totals"><tr class="totals sub"><th class="mark">Subtotal</th><td class="amount"><span class="price">$100.00</span></td></tr>
<tbody id="sc"></tbody>
<tr class="grand totals"><th class="mark"><strong class="label">Order Total</strong></th><td class="amount"><strong><span class="price" id="gt">$100.00</span></strong></td></tr></table>
<script>
const V = { ESTATE20: 0.2, SCONTO10: 0.1 };
const q = (s) => document.querySelector(s);
q('[data-role=title]').addEventListener('click', () => { const c = q('[data-role=content]'); c.style.display = c.style.display === 'none' ? 'block' : 'none'; });
document.addEventListener('click', (ev) => {
  if (!ev.target.closest('button.action.apply')) return;
  const code = q('#coupon_code').value.trim().toUpperCase();
  setTimeout(() => {
    if (V[code]) {
      q('#msgs').innerHTML = '<div class="message message-success success"><div>You used coupon code "' + code + '".</div></div>';
      q('#gt').textContent = '$' + (100 * (1 - V[code])).toFixed(2);
      q('#sc').innerHTML = '<tr class="totals discount"><th class="mark">Discount (' + code + ')</th><td class="amount"><span class="price">-$' + (100 * V[code]).toFixed(2) + '</span></td></tr>';
      q('.actions-toolbar .primary').innerHTML = '<button class="action cancel" type="button" value="Cancel Coupon"><span>Cancel Coupon</span></button>';
      q('button.action.cancel').onclick = () => { q('#gt').textContent = '$100.00'; q('#sc').innerHTML = ''; q('#msgs').innerHTML = '<div class="message message-success success"><div>You canceled the coupon code.</div></div>'; q('.actions-toolbar .primary').innerHTML = '<button class="action apply primary" type="button"><span>Apply Discount</span></button>'; location.reload; };
    } else q('#msgs').innerHTML = '<div class="message message-error error"><div>The coupon code "' + code + '" is not valid.</div></div>';
  }, 300);
});
</script></body></html>`;

const PAGINA_PRE = HEAD('PrestaShop (simulato)') + BANNER + `<h1>Shopping Cart</h1>
<div class="cart-summary">
  <p class="promo-code-button display-promo"><a class="collapse-button promo-code-button" href="#promo-code" aria-expanded="false" aria-controls="promo-code">Have a promo code?</a></p>
  <div id="promo-code" class="promo-code collapse" style="display:none">
    <form action="#" data-link-action="add-voucher" method="post" onsubmit="return false">
      <input class="promo-input" type="text" name="discount_name" placeholder="Promo code">
      <button type="submit" class="btn btn-primary"><span>Add</span></button>
    </form>
    <div class="alert alert-danger js-error" role="alert" style="display:none"><span class="ml-1 js-error-text"></span></div>
  </div>
  <div id="voucher"></div>
  <div class="cart-summary-line cart-total"><span class="label">Total (tax incl.)</span><span class="value">€100.00</span></div>
</div>
<script>
const V = { ESTATE20: 0.2, SCONTO10: 0.1 };
const q = (s) => document.querySelector(s);
q('a.promo-code-button').addEventListener('click', (e) => { e.preventDefault(); q('#promo-code').style.display = 'block'; });
q('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = q('.promo-input').value.trim().toUpperCase();
  setTimeout(() => {
    if (V[code]) { q('.js-error').style.display = 'none'; q('.cart-total .value').textContent = '€' + (100 * (1 - V[code])).toFixed(2);
      q('#voucher').innerHTML = '<div class="cart-summary-line"><span class="label">' + code + '</span><span class="value">-€' + (100 * V[code]).toFixed(2) + '</span> <a href="#" data-link-action="remove-voucher"><i>delete</i></a></div>';
      q('a[data-link-action=remove-voucher]').onclick = (e) => { e.preventDefault(); q('#voucher').innerHTML = ''; q('.cart-total .value').textContent = '€100.00'; }; }
    else { q('.js-error-text').textContent = 'This voucher does not exist.'; q('.js-error').style.display = 'block'; }
  }, 300);
});
</script></body></html>`;

// ---------- Negozio con pagine promo, robots.txt e un servizio finto di codici condivisi ----------
const hitsPrm = [], cookiesViste = [], logCond = [];
const pagPrm = (corpo) => HEAD('Negozio promo') + corpo + '</body></html>';
const PAGINE_PRM = {
  '/': pagPrm('<h1>Carrello</h1><a href="/gold-deals">Offerte speciali</a> <a href="/chi-siamo">Chi siamo</a><div class="coupon"><input name="coupon" placeholder="Codice sconto" id="c"><button type="button">Applica</button></div><div class="order-total">Totale <span>100,00 €</span></div>'),
  '/promo': pagPrm('<p>Solo per te: usa il codice SPECIALE15 al checkout.</p>'),
  '/gold-deals': pagPrm('<p>Codice sconto: LINKATO30</p>'),
  '/offerte': pagPrm('<p>Offerta riservata: codice VIETATO25</p>'),
  '/lista-codici': pagPrm('<p>Promo del mese, codice FONTE40</p>'),
  '/privato': pagPrm('<p>Codice PRIVATO50</p>')
};

function crea() {
  return http.createServer(async (req, res) => {
    const host = (req.headers.host || '').split(':')[0];
    const url = new URL(req.url, 'http://x');
    const html = (t, extra) => { res.writeHead(200, Object.assign({ 'content-type': 'text/html; charset=utf-8' }, extra || {})); res.end(t); };
    if (host.startsWith('woo.')) {
      let sid = cookie(req), extra = {};
      if (!sid || !sessioni[sid]) { sid = Math.random().toString(16).slice(2); sessioni[sid] = { coupon: null, flash: null }; extra['set-cookie'] = 'sid=' + sid + '; Path=/'; }
      const s = sessioni[sid];
      if (url.pathname === '/cart' && req.method === 'POST') {
        const dati = new URLSearchParams(await leggiCorpo(req));
        const c = (dati.get('coupon_code') || '').trim().toUpperCase();
        if (VALIDI[c]) { s.coupon = c; s.flash = { tipo: 'ok', testo: 'Codice coupon applicato con successo.' }; }
        else s.flash = { tipo: 'errore', testo: 'Codice non valido.' };
        res.writeHead(302, Object.assign({ location: '/cart' }, extra)); return res.end();
      }
      if (url.pathname === '/cart' && url.searchParams.get('remove_coupon')) {
        s.coupon = null; s.flash = { tipo: 'ok', testo: 'Coupon rimosso.' };
        res.writeHead(302, Object.assign({ location: '/cart' }, extra)); return res.end();
      }
      if (url.pathname === '/__stato') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(s)); }
      if (url.pathname === '/cart' || url.pathname === '/') return html(paginaWoo(s), extra);
    }
    if (host.startsWith('spa.')) {
      if (url.pathname === '/api/coupon') {
        const c = JSON.parse((await leggiCorpo(req)) || '{}').code || '';
        const pct = VALIDI[String(c).toUpperCase()];
        return setTimeout(() => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(pct ? { ok: true, pct } : { ok: false })); }, 900);
      }
      return html(PAGINA_SPA);
    }
    if (host.startsWith('hid.')) {
      if (url.pathname === '/checkout') return html(PAGINA_CHECKOUT);
      return html(PAGINA_HOME);
    }
    const q = url.searchParams;
    if (host.startsWith('prm.')) {
      if (url.pathname === '/__hits') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ hits: hitsPrm, cookies: cookiesViste })); }
      if (url.pathname === '/__azzera') { hitsPrm.length = 0; res.writeHead(200); return res.end('ok'); }
      hitsPrm.push(url.pathname);
      if (req.headers.cookie) cookiesViste.push(req.headers.cookie);
      if (url.pathname === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('User-agent: Altro\nDisallow: /\n\nUser-agent: *\nDisallow: /offerte\nDisallow: /privato\n'); }
      if (PAGINE_PRM[url.pathname]) return html(PAGINE_PRM[url.pathname], { 'set-cookie': 'sid=1; Path=/' });
      res.writeHead(404); return res.end('no');
    }
    if (host.startsWith('rbx.')) { // robots.txt che dà errore del server: non si tocca niente
      hitsPrm.push('rbx' + url.pathname);
      if (url.pathname === '/robots.txt') { res.writeHead(500); return res.end('errore'); }
      return html(pagPrm('<p>codice NONDOVREI10</p>'));
    }
    if (host.startsWith('cond.')) { // finto servizio dei codici condivisi
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('access-control-allow-headers', '*');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (url.pathname === '/__log') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(logCond)); }
      if (url.pathname === '/__azzera') { logCond.length = 0; res.writeHead(200); return res.end('ok'); }
      if (req.method === 'POST') { logCond.push({ metodo: 'POST', corpo: JSON.parse((await leggiCorpo(req)) || '{}'), cookie: req.headers.cookie || null }); res.writeHead(201, { 'content-type': 'application/json' }); return res.end('{"ok":true}'); }
      logCond.push({ metodo: 'GET', dominio: url.searchParams.get('domain') });
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ codici: [{ code: 'CONDIV25', n_report: 5, tasso_successo: 80 }] }));
    }
    if (host.startsWith('mag.')) return html(PAGINA_MAG);
    if (host.startsWith('pre.')) return html(PAGINA_PRE);
    if (host.startsWith('dis.')) return html(PAGINA_DIS);
    if (host.startsWith('btn.')) return html(paginaBtn(q.get('v')));
    if (host.startsWith('rer.')) return html(PAGINA_RER);
    if (host.startsWith('shd.')) return html(PAGINA_SHD);
    if (host.startsWith('fmt.')) return html(PAGINA_FMT);
    if (host.startsWith('fr.')) return html(PAGINA_TOP_FRAME);
    if (host.startsWith('fs.')) return html(PAGINA_TOP_SRCDOC);
    if (host.startsWith('ft.')) return html(PAGINA_CAMPO_TOP(q.get('src')));
    if (host.startsWith('cp.')) return html(url.pathname === '/totale' ? PAGINA_TOTALE_FRAME : PAGINA_FORM_FRAME);
    res.writeHead(404); res.end('no');
  });
}
module.exports = { crea };
if (require.main === module) crea().listen(8123, () => console.log('http://woo.localhost:8123/cart  http://spa.localhost:8123/  http://hid.localhost:8123/'));
