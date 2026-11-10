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

  // ---------- Scadenza scritta vicino al codice: "scade il 30/11", "valido fino al 31/12/2026", "expires Dec 5" ----------
  const MESI = { gen: 0, jan: 0, feb: 1, mar: 2, apr: 3, mag: 4, may: 4, giu: 5, jun: 5, lug: 6, jul: 6, ago: 7, aug: 7, set: 8, sep: 8, ott: 9, oct: 9, nov: 10, dic: 11, dec: 11 };
  const NOMI_MESI = 'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|jun|jul|aug|sep|oct|dec';
  const RE_PAROLA_SCAD = /scad\w*|valid[oa]\s+(?:fino|sino|entro)|entro\s+il|entro\s+e\s+non\s+oltre|fino\s+al|fino\s+a|until|expires?|expiring|expiry|valid\s+(?:until|through|thru|till)|ends?\s+on|offerta\s+valida|termina/ig;
  const RE_DATA_NUM = /^\W{0,12}(?:(?:il|on|al|by|the|el)\s+)?(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?(?!\d)/i;
  const RE_DATA_GM = new RegExp('^\\W{0,12}(?:(?:il|on|al|by|the|el)\\s+)?(\\d{1,2})(?:st|nd|rd|th|°)?\\s*(?:of\\s+)?(' + NOMI_MESI + ')\\w*\\.?(?:,?\\s+(\\d{4}))?', 'i');
  const RE_DATA_MG = new RegExp('^\\W{0,12}(' + NOMI_MESI + ')\\w*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?', 'i');
  function fineGiorno(anno, mese, giorno) {
    if (mese < 0 || mese > 11 || giorno < 1 || giorno > 31) return null;
    const d = new Date(anno, mese, giorno, 23, 59, 59, 999);
    return d.getMonth() === mese ? d.getTime() : null;
  }
  function dataDa(resto, oggi) {
    const anno0 = new Date(oggi).getFullYear();
    const anno = (a) => (a == null ? anno0 : a < 100 ? 2000 + a : a);
    let m;
    if ((m = RE_DATA_NUM.exec(resto))) {
      let g = +m[1], me = +m[2];
      if (me > 12 && g <= 12) { const x = g; g = me; me = x; }
      return fineGiorno(anno(m[3] == null ? null : +m[3]), me - 1, g);
    }
    if ((m = RE_DATA_GM.exec(resto))) return fineGiorno(anno(m[3] == null ? null : +m[3]), MESI[m[2].slice(0, 3).toLowerCase()], +m[1]);
    if ((m = RE_DATA_MG.exec(resto))) return fineGiorno(anno(m[3] == null ? null : +m[3]), MESI[m[1].slice(0, 3).toLowerCase()], +m[2]);
    return null;
  }
  // Cerca una scadenza nel testo che sta intorno al codice (un po' prima, di più dopo). Restituisce la fine di quel giorno, oppure null.
  function scadenzaVicino(testo, da, a, oggi) {
    const fin = testo.slice(Math.max(0, da - 80), Math.min(testo.length, a + 140));
    let migliore = null, distanza = 1e9;
    RE_PAROLA_SCAD.lastIndex = 0;
    let k;
    while ((k = RE_PAROLA_SCAD.exec(fin))) {
      const ts = dataDa(fin.slice(k.index + k[0].length, k.index + k[0].length + 40), oggi);
      if (ts == null) continue;
      const centro = Math.min(Math.abs(k.index - (da - Math.max(0, da - 80))), 1e8);
      if (centro < distanza) { distanza = centro; migliore = ts; }
    }
    return migliore;
  }
  const inizioGiorno = (oggi) => { const d = new Date(oggi); d.setHours(0, 0, 0, 0); return d.getTime(); };

  // trovati: Set di codici. Se la pagina scrive una scadenza: scaduta = il codice si scarta; futura = si annota in trovati.scad[codice].
  function dalTesto(testo, trovati, oggi) {
    oggi = oggi || Date.now();
    trovati.scad = trovati.scad || {};
    let m;
    for (const [re, serveCifra] of [[RE_A, false], [RE_B, true], [RE_C, true]]) {
      re.lastIndex = 0;
      while ((m = re.exec(testo))) {
        const t = m[1];
        if (!valido(t) || (serveCifra && !haCifra(t))) continue;
        const fine = m.index + m[0].length;
        const sc = scadenzaVicino(testo, fine - t.length, fine, oggi);
        if (sc != null && sc < inizioGiorno(oggi)) continue;
        if (sc != null) trovati.scad[t] = sc;
        trovati.add(t);
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
    // data-code / data-promo / data-clipboard-text possono contenere parole qualunque ("ITALIA"): lì serve una cifra
    senza.replace(/\bdata-(code|coupon|coupon-code|promo|promo-code|voucher|clipboard-text)\s*=\s*"([^"]{1,30})"/gi, (m, a, v) => {
      v = v.trim();
      if (valido(v) && (/^(coupon|coupon-code|voucher)$/i.test(a) || haCifra(v))) trovati.add(v);
      return m;
    });
    const testo = senza.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;|&#34;|&#039;|&#39;|&apos;/g, '"').replace(/&amp;/g, '&').replace(/&lt;|&gt;/g, ' ').replace(/\s+/g, ' ');
    dalTesto(testo, trovati);
    dalTesto(attr.join(' \n'), trovati);
    const out = [...trovati];
    out.scad = trovati.scad || {};
    return out;
  }
  // ---------- Codici personali: non si condividono mai ----------
  // Pagine di account, ordini, profilo, referral: i codici che vi compaiono possono essere solo tuoi.
  const RE_PAG_PERSONALE_URL = /(^|[\/_.-])(account|my-?account|il-?mio-?account|mio-?account|area-?riservata|area-?personale|ordini|i-?miei-?ordini|orders?|my-?orders?|profil[eo]|referral|referrals|refer-?a-?friend|invita|invita-?un-?amico|customer|dashboard|wishlist|login|signin|accedi)([\/_.?#-]|$)/i;
  const RE_PAG_PERSONALE_TITOLO = /(il mio account|my account|area riservata|area personale|i miei ordini|my orders|il mio profilo|my profile|referral|invita un amico|refer a friend|programma amico|dashboard)/i;
  const RE_PAROLE_PERSONALI = /(tuo codice|il tuo codice personale|codice personale|personale|esclusiv[oa] per te|riservat[oa] a te|riservat[oa] per te|invit[ai]|referral|amico|amica|your code|your personal|personal|exclusive for you|exclusive to you|refer\b|refer a)/i;
  function paginaPersonale(url, titolo) {
    let percorso = '';
    try { const u = new URL(url); percorso = u.pathname + u.search; } catch (e) { percorso = String(url || ''); }
    return RE_PAG_PERSONALE_URL.test(percorso) || RE_PAG_PERSONALE_TITOLO.test(String(titolo || ''));
  }
  // Il testo intorno al codice (circa 100 caratteri prima e dopo, in ogni punto in cui compare) parla di qualcosa di personale?
  function contestoPersonale(testo, codice) {
    testo = String(testo || ''); codice = String(codice || '');
    if (!codice) return false;
    let da = 0, n = 0;
    for (;;) {
      const i = testo.indexOf(codice, da);
      if (i < 0 || n++ >= 8) return false;
      if (RE_PAROLE_PERSONALI.test(testo.slice(Math.max(0, i - 100), i + codice.length + 100))) return true;
      da = i + codice.length;
    }
  }
  self.CS_personale = { paginaPersonale, contestoPersonale };
  self.CS_valido = valido;
  self.CS_dalTesto = dalTesto;
  self.CS_dalHtml = dalHtml;
  self.CS_scadenzaVicino = scadenzaVicino;
})();
