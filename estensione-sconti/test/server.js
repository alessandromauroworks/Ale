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
    res.writeHead(404); res.end('no');
  });
}
module.exports = { crea };
if (require.main === module) crea().listen(8123, () => console.log('http://woo.localhost:8123/cart  http://spa.localhost:8123/  http://hid.localhost:8123/'));
