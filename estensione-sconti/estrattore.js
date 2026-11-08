// ESTRATTORE: riconosce i codici sconto in un testo. Usato dal cercatore (pagine visitate) e dal fondo (pagine del negozio).
(function () {
  if (self.CS_dalTesto) return;
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


  // Da HTML grezzo (pagine scaricate dal fondo, senza DOM): toglie script e stile, prende testo e attributi utili.
  function dalHtml(html) {
    const trovati = new Set();
    html = String(html || '').slice(0, 600000);
    const senza = html.replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ');
    const attr = [];
    senza.replace(/\b(?:title|alt|aria-label|content)\s*=\s*"([^"]{0,300})"/gi, (m, v) => { attr.push(v); return m; });
    senza.replace(/\bdata-(?:code|coupon|coupon-code|promo|promo-code|voucher|clipboard-text)\s*=\s*"([^"]{1,30})"/gi, (m, v) => { if (valido(v.trim())) trovati.add(v.trim()); return m; });
    const testo = senza.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;|&#34;|&#039;|&#39;|&apos;/g, '"').replace(/&amp;/g, '&').replace(/&lt;|&gt;/g, ' ').replace(/\s+/g, ' ');
    dalTesto(testo, trovati);
    dalTesto(attr.join(' \n'), trovati);
    return [...trovati];
  }
  self.CS_valido = valido;
  self.CS_dalTesto = dalTesto;
  self.CS_dalHtml = dalHtml;
})();
