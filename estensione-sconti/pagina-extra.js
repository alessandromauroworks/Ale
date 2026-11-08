// PAGINA EXTRA (solo pagina principale): prezzi dei prodotti, spedizione gratuita, codici dai siti di coupon aperti da te, promemoria cashback.
// Legge solo ciò che la pagina già mostra. Non clicca niente e non apre pagine.
(function () {
  if (window.CS_EXTRA) return;
  window.CS_EXTRA = true;
  if (window.top !== window) return;
  const CS = (window.CS = window.CS || {});
  const L = self.CS_lib;
  if (!L || !/^https?:$/.test(location.protocol)) return;
  const dominio = dominioDi(location.hostname);
  const msg = (m) => { try { return chrome.runtime.sendMessage(m).catch(() => null); } catch (e) { return Promise.resolve(null); } };
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Posto libero per le schede: mai sopra i pulsanti di pagamento ----------
  const RE_PAGA = /pagament|\bpaga\b|paga\s+ora|checkout|ordin(a|e)\b|acquist|procedi|conferma|place\s+order|\bpay\b|pay\s+now|buy\s+now|continue\s+to|complete\s+(your\s+)?order|completa|vai\s+alla\s+cassa|cassa/i;
  function visibileEl(el) {
    try { return el.checkVisibility ? el.checkVisibility() : !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); } catch (e) { return false; }
  }
  function pulsantiPagamento() {
    const out = [];
    let n = 0;
    for (const el of document.querySelectorAll('button,a[href],input[type=submit],input[type=button],[role=button]')) {
      if (++n > 400) break;
      const t = (el.value || el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 60);
      if (!t || !RE_PAGA.test(t) || !visibileEl(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push(r);
    }
    return out;
  }
  const MARGINE = 16;
  function rettangolo(angolo, w, h) {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const destra = angolo[1] === 'r', alto = angolo[0] === 't';
    const left = destra ? vw - MARGINE - w : MARGINE, top = alto ? MARGINE : vh - MARGINE - h;
    return { left, top, right: left + w, bottom: top + h };
  }
  const siTocca = (a, b, m) => a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;
  // Il primo angolo (tra quelli indicati) in cui una scheda w x h non copre nessun pulsante di pagamento. Se non c'è, null.
  CS.posizioneLibera = function (w, h, angoli, preferito) {
    const btn = pulsantiPagamento();
    const lista = preferito ? [preferito].concat(angoli.filter((a) => a !== preferito)) : angoli;
    for (const a of lista) {
      const r = rettangolo(a, w, h);
      if (!btn.some((b) => siTocca(r, b, 8))) return a;
    }
    return null;
  };
  const IMPOSTA = { br: { r: '16px', b: '16px', l: 'auto', t: 'auto' }, bl: { r: 'auto', b: '16px', l: '16px', t: 'auto' }, tr: { r: '16px', b: 'auto', l: 'auto', t: '16px' }, tl: { r: 'auto', b: 'auto', l: '16px', t: '16px' } };
  CS.metti = function (host, angolo) {
    const p = IMPOSTA[angolo];
    for (const k of Object.keys(p)) host.style.setProperty('--' + k, p[k]);
    host.dataset.angolo = angolo;
  };
  // Mostra la scheda per durataMs al massimo e la toglie se un pulsante di pagamento finisce sotto. Restituisce la funzione per fermarla.
  CS.sorveglia = function (host, angoli, durataMs, quandoFinita) {
    const box = host.shadowRoot && host.shadowRoot.querySelector('.box');
    const r0 = box ? box.getBoundingClientRect() : { width: 300, height: 90 };
    const w = Math.ceil(r0.width) || 300, h = Math.ceil(r0.height) || 90;
    const a0 = CS.posizioneLibera(w, h, angoli);
    if (!a0) { host.remove(); if (quandoFinita) quandoFinita('occupato'); return null; }
    CS.metti(host, a0);
    const t0 = Date.now();
    let fermo = false;
    const fine = (perche) => { if (fermo) return; fermo = true; clearInterval(iv); host.remove(); if (quandoFinita) quandoFinita(perche); };
    const iv = setInterval(() => {
      if (!host.isConnected) { fermo = true; clearInterval(iv); return; }
      if (Date.now() - t0 >= durataMs) return fine('tempo');
      const a = CS.posizioneLibera(w, h, angoli, host.dataset.angolo);
      if (!a) return fine('occupato');
      if (a !== host.dataset.angolo) CS.metti(host, a);
    }, 700);
    return () => fine('chiusa');
  };

  // ---------- Prezzo del prodotto ----------
  let ultimoInviato = null;
  CS.prodotto = null;
  function chiaveDiQuestaPagina() {
    let k = L.chiaveProdotto(location.href);
    const can = document.querySelector('link[rel="canonical"]');
    if (can && can.href) {
      try { if (new URL(can.href).hostname.replace(/^www\./, '') === location.hostname.replace(/^www\./, '')) k = L.chiaveProdotto(can.href) || k; } catch (e) {}
    }
    return k;
  }
  async function rilevaPrezzo() {
    if (!document.documentElement) return null;
    if (!document.querySelector('script[type="application/ld+json"],meta[property^="product:"],meta[property="og:price:amount"],[itemprop=price],meta[name="twitter:data1"],body.single-product')) return CS.prodotto;
    let r;
    try { r = L.prezzoDaHtml(document.documentElement.outerHTML); } catch (e) { return CS.prodotto; }
    if (!r || !(r.prezzo > 0)) return CS.prodotto;
    const nome = L.nomeBreve(r.nome || document.title);
    CS.prodotto = { chiave: chiaveDiQuestaPagina(), url: location.href.split('#')[0], nome, prezzo: r.prezzo, valuta: r.valuta, via: r.via, dominio };
    const firma = CS.prodotto.chiave + '|' + r.prezzo;
    if (firma !== ultimoInviato) {
      const o = await msg({ type: 'opzioniPagina' });
      if (o && o.storicoPrezzi !== false) { ultimoInviato = firma; msg({ type: 'prezzoVisto', prodotto: CS.prodotto }); }
    }
    return CS.prodotto;
  }
  CS.rilevaPrezzo = rilevaPrezzo;

  // ---------- Spedizione gratuita (pagine del carrello) ----------
  const RE_CARRELLO = /cart|carrello|basket|checkout|cassa|bag|panier|warenkorb|pagamento|order|ordine/i;
  CS.spedizione = null;
  function leggiSpedizione() {
    if (!document.body) return null;
    const campo = CS.haCampoQui ? (() => { try { return CS.haCampoQui(); } catch (e) { return false; } })() : false;
    if (!RE_CARRELLO.test(location.pathname + location.search) && !campo) return CS.spedizione;
    let r = null;
    try { r = L.spedizione(document.body.innerText || ''); } catch (e) {}
    CS.spedizione = r;
    return r;
  }
  CS.leggiSpedizione = leggiSpedizione;

  // ---------- Siti di coupon aperti dall'utente (opzione, spenta di base) ----------
  const NASCOSTI = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA|INPUT|SELECT)$/;
  function testoVisibile() {
    const parti = [];
    const cache = new Map();
    const ok = (el) => {
      if (cache.has(el)) return cache.get(el);
      let v = visibileEl(el);
      if (v) {
        try {
          const cs = getComputedStyle(el);
          if (/blur/.test(cs.filter || '') || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) v = false;
          if (v && el.closest('[aria-hidden="true"]')) v = false;
        } catch (e) {}
      }
      cache.set(el, v);
      return v;
    };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) { const p = n.parentElement; return !p || NASCOSTI.test(p.tagName) || !ok(p) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    let n, tot = 0;
    while ((n = w.nextNode()) && tot < 200000) { const v = n.nodeValue.trim(); if (v) { parti.push(v); tot += v.length; } }
    return parti.join(' \n');
  }
  let couponFatto = false;
  async function couponAperti() {
    if (couponFatto || !document.body) return;
    const o = await msg({ type: 'opzioniPagina' });
    if (!o || !o.couponAperti) return;
    const ric = await msg({ type: 'ricetteCoupon' });
    const noto = L.eAggregatore(location.hostname, (ric && ric.aggregatori) || []);
    if (!noto && !L.titoloCoupon(location.href, document.title)) return;
    const testo = testoVisibile();
    const trovati = new Set();
    self.CS_dalTesto(testo, trovati);
    const codici = [...trovati].slice(0, 25);
    if (!codici.length) return;
    const h1 = Array.from(document.querySelectorAll('h1')).map((x) => x.textContent).join(' ');
    const link = Array.from(document.querySelectorAll('a[href]')).slice(0, 300).map((a) => ({ href: a.href, testo: (a.textContent || '').trim().slice(0, 80) }));
    const cand = L.candidatiNegozio({ dominioPagina: dominio, titolo: document.title + ' ' + h1, testo, link });
    const slug = L.slugNegozio(location.href);
    if (!cand.length && !slug) return;
    couponFatto = true;
    msg({ type: 'couponSito', codici, scadenze: trovati.scad || {}, candidati: cand.slice(0, 8), slug, aggregatoreNoto: noto });
  }

  // ---------- Promemoria cashback (separato dai coupon) ----------
  let cashbackMostrato = false;
  const CSS_CB = `:host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
    .box{position:fixed;right:var(--r,auto);bottom:var(--b,16px);left:var(--l,16px);top:var(--t,auto);z-index:2147483646;width:280px;max-width:calc(100vw - 32px);background:#fffbea;color:#3d3200;border:1px solid #ecd98a;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.18);padding:10px 12px;font-size:13px;line-height:1.35}
    @media (prefers-color-scheme:dark){.box{background:#2a2510;color:#f5ecc0;border-color:#5e5320}}
    .riga{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}a{color:inherit;font-weight:700}
    .x{background:transparent;border:none;color:inherit;cursor:pointer;font-size:15px;padding:0 4px}`;
  async function cashback() {
    if (cashbackMostrato || !document.body) return;
    const campo = CS.haCampoQui ? (() => { try { return CS.haCampoQui(); } catch (e) { return false; } })() : false;
    if (!campo && !/checkout|cassa|pagamento|payment|carrello|cart|basket|ordine|order/i.test(location.pathname)) return;
    const r = await msg({ type: 'cashbackAvviso', dominio });
    if (!r || !r.servizio || cashbackMostrato) return;
    cashbackMostrato = true;
    let host = document.getElementById('cacciasconti-cashback');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'cacciasconti-cashback';
    host.attachShadow({ mode: 'open' });
    document.documentElement.appendChild(host);
    const sr = host.shadowRoot;
    sr.innerHTML = '<style>' + CSS_CB + '</style><div class="box"><div class="riga"><div>Hai il cashback su <b id="n"></b>: <a id="l" target="_blank" rel="noopener noreferrer">aprilo da lì prima di pagare</a></div><button class="x" id="x" title="Chiudi">✕</button></div></div>';
    sr.getElementById('n').textContent = r.servizio.nome;
    sr.getElementById('l').href = r.servizio.url;
    sr.getElementById('x').onclick = () => { host.remove(); msg({ type: 'cashbackChiuso', dominio }); };
    CS.sorveglia(host, ['bl', 'tl', 'tr'], 20000);
  }

  // ---------- Messaggi dal fondo (popup) ----------
  chrome.runtime.onMessage.addListener((m, mittente, risposta) => {
    if (m.type === 'dammiProdotto') { rilevaPrezzo().then((p) => risposta({ prodotto: p || null })); return true; }
    if (m.type === 'dammiSpedizione') { risposta({ spedizione: leggiSpedizione() }); return; }
  });

  async function giro() {
    await rilevaPrezzo();
    leggiSpedizione();
    couponAperti();
    cashback();
  }
  setTimeout(giro, 700);
  setTimeout(giro, 3200);
  setTimeout(giro, 7500);
  let volte = 0, timer = null;
  try {
    new MutationObserver(() => {
      if (volte >= 6 || timer) return;
      timer = setTimeout(() => { timer = null; volte++; leggiSpedizione(); cashback(); rilevaPrezzo(); }, 2500);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
