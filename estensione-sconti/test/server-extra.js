// Pagine finte per le novità della 1.4.0: prezzi, siti di coupon, spedizione gratuita, cashback, scheda che non copre il pagamento, servizio dei codici personali.
const hitsPrd = [], logPers = [];
const prezzi = { '/p/scarpe': 99.9, '/p/og': 59.9, '/p/micro': 1299, '/p/shop': 24.9, '/p/woo': 35, '/p/vietato': 20 };
const NEG = 'Negozio Prova';
const base = (titolo, corpo, testa) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${titolo}</title>${testa || ''}</head><body style="font-family:system-ui;max-width:760px;margin:30px auto">${corpo}</body></html>`;
const ld = (nome, prezzo) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: nome, offers: { '@type': 'Offer', price: String(prezzo.toFixed(2)), priceCurrency: 'EUR' } })}</script>`;

function paginaProdotto(p) {
  const v = prezzi[p];
  if (p === '/p/scarpe' || p === '/p/vietato') return base((p === '/p/scarpe' ? 'Scarpe Corsa Pro' : 'Borraccia Termica') + ' | ' + NEG, '<h1>Prodotto</h1><p>Prezzo ' + v + ' €</p>', ld(p === '/p/scarpe' ? 'Scarpe Corsa Pro' : 'Borraccia Termica', v));
  if (p === '/p/og') return base('Zaino Trek', '<h1>Zaino Trek</h1>', `<meta property="og:type" content="product"><meta property="og:title" content="Zaino Trek"><meta property="product:price:amount" content="${v.toFixed(2)}"><meta property="product:price:currency" content="EUR">`);
  if (p === '/p/micro') return base('Portatile X', `<div itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">Portatile X 15</h1><div itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="priceCurrency" content="EUR"><span itemprop="price" content="${v.toFixed(2)}">1.299,00 €</span></div></div>`);
  if (p === '/p/shop') return base('Maglia Rossa', '<h1>Maglia Rossa</h1>', `<meta property="og:title" content="Maglia Rossa"><meta name="twitter:label1" content="Price"><meta name="twitter:data1" content="€ ${v.toFixed(2).replace('.', ',')}">`);
  if (p === '/p/woo') return `<!doctype html><html><head><meta charset="utf-8"><title>Tazza Woo</title><meta property="og:title" content="Tazza Woo"></head><body class="woocommerce single-product"><div class="summary"><h1 class="product_title">Tazza Woo</h1><p class="price"><span class="woocommerce-Price-amount amount"><bdi>${v.toFixed(2).replace('.', ',')}&nbsp;<span class="woocommerce-Price-currencySymbol">€</span></bdi></span></p></div></body></html>`;
  return null;
}
const LISTA = base('Tutte le scarpe', '<h1>Elenco</h1>', `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'Product', name: 'Scarpa A', offers: { '@type': 'Offer', price: '10.00', priceCurrency: 'EUR' } },
  { '@type': 'Product', name: 'Scarpa B', offers: { '@type': 'Offer', price: '20.00', priceCurrency: 'EUR' } }] })}</script>`);

const COUPON_ZALANDO = base('Codici sconto Zalando.it: coupon e promo code validi', `<h1>Codici sconto Zalando</h1>
<div class="offerta"><p>Codice: ZAL15 — 15% sulla prima spesa. Scade il 31/12/2099</p></div>
<div class="offerta"><p>Usa il codice MODA20 per il 20% sui capi di moda</p></div>
<div class="offerta"><button id="rivela" class="rivela" onclick="window.__rivelaCliccato=(window.__rivelaCliccato||0)+1" data-code="SEGRETO50">Mostra codice</button>
  <span class="nascosto" style="display:none">Codice: SEGRETO50</span></div>
<div class="offerta"><span style="filter:blur(6px)">Codice: BLUR77</span></div>
<p><a href="https://zalando.it/">Vai a zalando.it</a></p>`);
const COUPON_SLUG = base('Coupon Mediaworld', '<h1>Coupon Mediaworld</h1><p>Codice: MEDIA25 — 25 euro di sconto</p>');
const COUPON_NIENTE = base('Coupon e promo del giorno', '<h1>Coupon</h1><p>Codice: GEN99 — sconto generico</p>');
const PICODI = base('Mediaworld: offerte', '<h1>Offerte del giorno</h1><p>Codice: PIC10X — 10% su tutto</p>');

function sped(v) {
  const t = {
    1: '<h1>Carrello</h1><p class="banner">Spedizione gratuita sopra 49 €</p><table><tr><td>Scarpe</td><td>41,90 €</td></tr></table><div class="cart-subtotal">Subtotale: 41,90 €</div>',
    2: '<h1>Carrello</h1><p>Ti mancano 7,10 € per la spedizione gratuita</p><div>Subtotale: 41,90 €</div>',
    3: '<h1>Cart</h1><p>Free shipping on orders over $50</p><div>Subtotal: $32.00</div>'
  }[v];
  return base('Carrello', t);
}
const CHECKOUT_CB = base('Pagamento', '<h1>Pagamento</h1><p>Inserisci i dati.</p><button type="button">Conferma</button>');
const OVL = (extra) => base('Carrello', `<h1>Carrello</h1><p>Promo: usa il codice ESTATE20 oggi.</p><p>Spedizione gratuita sopra 49 €</p><div>Subtotale: 41,90 €</div><input name="coupon_code" placeholder="Codice coupon"><button type="button">Applica</button>${extra || ''}`);

// Ritorna true se ha gestito la richiesta.
async function gestisciExtra(host, url, req, res, html, leggiCorpo) {
  const json = (o, st) => { res.writeHead(st || 200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }); res.end(JSON.stringify(o)); };
  if (host.startsWith('per.')) { // 1.4.2: codici personali o pubblici
    const PAD = '<p>' + 'Testo di riempimento della pagina del negozio senza niente di speciale. '.repeat(8) + '</p>';
    if (url.pathname === '/account/ordini') { html(base('I miei ordini', '<h1>Ordini</h1><p>Usa il codice ACCOUNT15 per il 15% di sconto.</p>')); return true; }
    if (url.pathname === '/amici') { html(base('Offerte', '<h1>Offerte</h1><p>Invita un amico: usa il tuo codice AMICO20, esclusivo per te: 20% di sconto.</p>' + PAD + '<p>Per tutti: usa il codice TUTTI10 per il 10% di sconto.</p>')); return true; }
    html(base('Negozio', '<h1>Negozio</h1><p>Usa il codice PUBBLICO10 per il 10% di sconto sul primo ordine.</p>')); return true;
  }
  if (/^(www\.)?prd\./.test(host)) {
    if (url.pathname === '/__hits') return json({ hits: hitsPrd }), true;
    if (url.pathname === '/__azzera') { hitsPrd.length = 0; return json({ ok: 1 }), true; }
    if (url.pathname === '/__prezzo') { prezzi[url.searchParams.get('p')] = parseFloat(url.searchParams.get('v')); return json({ ok: 1 }), true; }
    if (url.pathname === '/robots.txt') { hitsPrd.push({ path: '/robots.txt', cookie: req.headers.cookie || null }); res.writeHead(200, { 'content-type': 'text/plain' }); res.end('User-agent: *\nDisallow: /p/vietato\nDisallow: /p/scarpe?vietato=1\n'); return true; }
    if (url.pathname === '/lista') { html(LISTA); return true; }
    if (url.pathname === '/p/redir') { hitsPrd.push({ path: '/p/redir', cookie: null }); res.writeHead(302, { location: url.searchParams.get('to') }); res.end(); return true; }
    const p = paginaProdotto(url.pathname);
    if (p) { hitsPrd.push({ path: url.pathname + url.search, cookie: req.headers.cookie || null, ua: req.headers['user-agent'] ? 1 : 0 }); html(p, { 'set-cookie': 'sid=1; Path=/' }); return true; }
    res.writeHead(404); res.end('no'); return true;
  }
  if (host.startsWith('cup.')) {
    if (url.pathname === '/codici-sconto/zalando') { html(COUPON_ZALANDO); return true; }
    if (url.pathname === '/coupon/mediaworld') { html(COUPON_SLUG); return true; }
    if (url.pathname === '/pagina-generica') { html(COUPON_NIENTE); return true; }
    res.writeHead(404); res.end('no'); return true;
  }
  if (host.startsWith('spd.')) { html(sped(url.pathname === '/cart2' ? 2 : url.pathname === '/cart3' ? 3 : 1)); return true; }
  if (host.startsWith('cbk.')) { html(url.pathname === '/checkout' ? CHECKOUT_CB : base('Prodotti', '<h1>Prodotti</h1><p>Tazza 10 €</p>')); return true; }
  if (host.startsWith('ovl.')) {
    html(OVL(url.searchParams.get('btn') === '1' ? '<button style="position:fixed;right:16px;bottom:16px;padding:14px 22px">Paga ora</button>' : ''));
    return true;
  }
  if (host.startsWith('pers.')) { // finto servizio dei codici personali (come la Edge Function)
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true; }
    if (url.pathname === '/__log') return json(logPers), true;
    if (url.pathname === '/__azzera') { logPers.length = 0; return json({ ok: 1 }), true; }
    const token = req.headers['x-cacciasconti-token'] || null;
    logPers.push({ domain: url.searchParams.get('domain'), personali: url.searchParams.get('personali'), token, cookie: req.headers.cookie || null });
    if (url.pathname === '/lenta') await new Promise((r) => setTimeout(r, 2500));
    if (token !== 'segreto-di-prova') return json({ errore: 'non autorizzato' }, 401), true;
    const tutte = [
      { domain: 'emailshop.it', code: 'MAIL15', sconto: '15%', scade_il: '2099-12-31', email_data: '2026-11-01' },
      { domain: 'emailshop.it', code: 'VECCHIO5', sconto: '5%', scade_il: '2020-01-01', email_data: '2019-12-01' },
      { domain: 'altroshop.com', code: 'ALTRO20', sconto: null, scade_il: null, email_data: '2026-11-02' }
    ];
    const d = url.searchParams.get('domain');
    return json({ codici: d ? tutte.filter((x) => x.domain === d) : tutte }), true;
  }
  return false;
}
module.exports = { gestisciExtra };
