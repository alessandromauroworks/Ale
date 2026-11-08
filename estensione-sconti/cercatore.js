// CERCATORE: cerca nella pagina i codici sconto e li manda all'archivio.
(function () {
  if (window.CS_CARICATO) return;
  window.CS_CARICATO = true;
  const CS = (window.CS = window.CS || {});
  CS.inEsecuzione = false;
  // Il cercatore legge solo la pagina principale: i frame (pubblicità, widget) non devono sporcare l'archivio.
  if (window.top !== window) return;
  const dominio = dominioDi(location.hostname);

  const PAROLE_VIETATE = new Set((
    'CODICE CODE CODES PROMO PROMOZIONE PROMOZIONI COUPON COUPONS SCONTO SCONTI DISCOUNT VOUCHER OFFERTA OFFERTE ' +
    'GRATIS FREE SPEDIZIONE SHIPPING CARRELLO CART CHECKOUT PAGAMENTO TOTALE TOTAL ORDINE ORDER APPLICA APPLY ' +
    'INVIA SUBMIT FINO TUTTI TUTTO ONLINE SOLO ORDINI ACQUISTI NEWSLETTER EMAIL NULL NONE TRUE FALSE UNDEFINED ' +
    'INSERISCI ENTER NOME CLIENTE SALE SALDI HTTP HTTPS WWW HTML REGALO GIFT CARD PROMOCODE SUBTOTALE ' +
    'SUBTOTAL ACCEDI LOGIN PASSWORD CERCA SEARCH MENU HOME SHOP NEGOZIO PRODOTTI OFFERS DEALS DEAL'
  ).split(' '));

  function valido(t) {
    if (typeof t !== 'string') return false;
    if (t !== t.toUpperCase() || t.length < 4 || t.length > 20) return false;
    if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(t) || !/[A-Z]/.test(t)) return false;
    if (t.split('-').every((p) => PAROLE_VIETATE.has(p))) return false;
    if (/^[0-9A-F]{6}([0-9A-F]{2})?$/.test(t)) return false; // colori CSS
    return true;
  }
  const haCifra = (t) => /[0-9]/.test(t);

  // Parola chiave "forte" + codice (accetta anche solo lettere)
  const RE_A = new RegExp(
    '\\b(?:codice(?:\\s+(?:sconto|promozionale|promo|coupon|regalo))?|coupon(?:\\s+code)?|promo\\s?code|' +
      'discount\\s+code|voucher(?:\\s+code)?|gift\\s+code|code)\\s*[:=\\-–]?\\s*["“”«»\'`]?\\s*' +
      '([A-Za-z0-9][A-Za-z0-9-]{2,19})(?![A-Za-z0-9])', 'gi');
  // Parola chiave "debole" + due punti: serve almeno una cifra nel codice
  const RE_B = /\b(?:sconto|promo|promozione|discount|offerta|offer)\s*[:=]\s*["“”«»'`]?\s*([A-Za-z0-9][A-Za-z0-9-]{2,19})(?![A-Za-z0-9])/gi;
  // "usa ESTATE20", "use SUMMER25": tutto maiuscolo con cifra
  const RE_C = /\b(?:usa|use|inserisci|enter|applica|apply)\s+(?:il\s+|the\s+|il\s+codice\s+|code\s+)?([A-Z][A-Z0-9-]{3,19})(?![A-Za-z0-9])/g;

  function dalTesto(testo, trovati) {
    let m;
    for (const [re, serveCifra] of [[RE_A, false], [RE_B, true], [RE_C, true]]) {
      re.lastIndex = 0;
      while ((m = re.exec(testo))) {
        const t = m[1];
        if (valido(t) && (!serveCifra || haCifra(t))) trovati.add(t);
      }
    }
  }

  function testoPagina() {
    const parti = [];
    const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n, tot = 0;
    while ((n = w.nextNode()) && tot < 300000) {
      const v = n.nodeValue.trim();
      if (v) { parti.push(v); tot += v.length; }
    }
    return parti.join(' \n');
  }

  function estrai() {
    const trovati = new Set();
    if (!document.body) return [];
    dalTesto(testoPagina(), trovati);

    // Elementi con "coupon/promo/code" nella classe o nell'id: il testo intero può essere il codice
    const els = document.querySelectorAll(
      '[class*="coupon" i],[class*="promo" i],[class*="voucher" i],[class*="code" i],[id*="coupon" i],[id*="promo" i],[id*="code" i]');
    let i = 0;
    for (const el of els) {
      if (++i > 600) break;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') continue;
      const t = (el.textContent || '').trim();
      if (t.length >= 4 && t.length <= 24 && valido(t)) trovati.add(t);
    }
    // Attributi tipici dei pulsanti "copia codice"
    document.querySelectorAll('[data-code],[data-coupon],[data-coupon-code],[data-promo],[data-promo-code],[data-voucher],[data-clipboard-text]')
      .forEach((el) => {
        for (const a of ['data-code', 'data-coupon', 'data-coupon-code', 'data-promo', 'data-promo-code', 'data-voucher', 'data-clipboard-text']) {
          const v = el.getAttribute(a);
          if (v && valido(v.trim())) trovati.add(v.trim());
        }
      });
    document.querySelectorAll('input[readonly][value]').forEach((el) => {
      const v = (el.value || '').trim();
      if (valido(v) && /coupon|promo|code|codice|voucher/i.test(el.className + el.id + el.name)) trovati.add(v);
    });
    // Testi negli attributi (titoli, descrizioni)
    const attr = [];
    document.querySelectorAll('[title],[alt],[aria-label],meta[name="description"],meta[property="og:description"]').forEach((el, k) => {
      if (k > 500) return;
      attr.push(el.getAttribute('title') || '', el.getAttribute('alt') || '', el.getAttribute('aria-label') || '', el.getAttribute('content') || '');
    });
    dalTesto(attr.join(' \n'), trovati);
    return [...trovati];
  }

  const visti = new Set();
  function scansiona() {
    if (CS.inEsecuzione) return;
    let nuovi;
    try { nuovi = estrai().filter((c) => !visti.has(c)); } catch (e) { return; }
    if (!nuovi.length) return;
    nuovi.forEach((c) => visti.add(c));
    try { chrome.runtime.sendMessage({ type: 'trovati', dominio, codici: nuovi }).catch(() => {}); } catch (e) {}
  }
  CS.scansiona = scansiona;
  CS.codiceValido = valido;

  // Prima scansione subito, poi dopo un po' (banner e popup compaiono in ritardo)
  setTimeout(scansiona, 100);
  setTimeout(scansiona, 1500);
  setTimeout(scansiona, 4500);
  let volte = 0, timer = null;
  try {
    new MutationObserver(() => {
      if (volte >= 8 || timer) return;
      timer = setTimeout(() => { timer = null; volte++; scansiona(); }, 2000);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
