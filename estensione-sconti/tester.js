// TESTER: trova il campo coupon, prova i codici uno alla volta e applica il migliore.
// Gira in ogni frame della pagina. Lavora solo il frame che ha il campo coupon; il pannello
// si disegna nel frame principale; il totale può stare in un altro frame (lo chiede il fondo).
(function () {
  if (window.CS_TESTER) return;
  window.CS_TESTER = true;
  const CS = (window.CS = window.CS || {});
  const eTop = window.top === window;
  let dominio = dominioDi(location.hostname); // nei frame lo corregge subito il fondo con quello del sito principale
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
  const msg = (m) => { try { return chrome.runtime.sendMessage(m).catch(() => null); } catch (e) { return Promise.resolve(null); } };
  const TIMEOUT_ESITO = 6000;
  const prontoE = msg({ type: 'chiSono', dominio }).then((r) => { if (r && r.dominio) dominio = r.dominio; });
  msg({ type: 'registraFrame' });

  // ---------- Ricette dei siti (file statici nel pacchetto) ----------
  let ricette = [];
  // Selettori che su questo sito hanno già funzionato (campo e pulsante): si provano per primi. Si salvano solo dopo un codice riuscito.
  let selCache = { input: null, bottone: null };
  const ricetteProntE = msg({ type: 'ricette' }).then(async (r) => {
    ricette = (r && r.ricette) || [];
    await prontoE;
    const c = await msg({ type: 'selLeggi', dominio });
    if (c && c.sel) selCache = c.sel;
  });
  const selDa = (chiave) => ricette.reduce((a, r) => a.concat(r[chiave] || []), []);

  // ---------- Utilità sulla pagina (con shadow DOM aperti) ----------
  // Elenco di document + tutti gli shadow root aperti. Il pannello e la scheda di Cacciasconti restano fuori.
  let cacheRad = { t: 0, v: null };
  const fresco = () => { cacheRad.v = null; };
  function radici() {
    const ora = Date.now();
    if (cacheRad.v && ora - cacheRad.t < 40) return cacheRad.v;
    const out = [document];
    for (let i = 0; i < out.length && out.length < 200; i++) {
      for (const el of out[i].querySelectorAll('*')) {
        const sr = el.shadowRoot;
        if (sr && !(el.id && el.id.indexOf('cacciasconti-') === 0)) out.push(sr);
      }
    }
    cacheRad = { t: ora, v: out };
    return out;
  }
  function tutti(sel) {
    const out = [];
    for (const r of radici()) { try { for (const e of r.querySelectorAll(sel)) out.push(e); } catch (e) {} }
    return out;
  }
  // Il genitore, anche uscendo da uno shadow root
  const padre = (el) => el.parentElement || (el.getRootNode && el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null);

  function visibile(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && (r.width > 0 || r.height > 0);
  }
  function primoVisibile(selettori) {
    for (const sel of selettori) {
      const v = tutti(sel).find(visibile);
      if (v) return v;
    }
    return null;
  }
  const pulisci = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const classe = (el) => String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className || '');
  const spento = (b) => b.disabled === true || b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true' || /(^|\s)disabled(\s|$)/.test(classe(b));

  // ---------- Campo coupon ----------
  const RE_CAMPO = /coupon|promo|discount|voucher|gift|sconto|codice|buono|gutschein|rabatt|code promo|réduction|reduction|descuento|cup[oó]n/i;
  const RE_NO_CAMPO = /e-?mail|password|search|cerca|zip|postal|postcode|\bcap\b|fiscale|\bvat\b|partita|\bpiva\b|phone|telefon|\btel\b|newsletter|iscriv/i;

  function etichetta(el) {
    let t = '';
    if (el.labels) for (const l of el.labels) t += ' ' + l.textContent;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const rad = el.getRootNode();
      lb.split(/\s+/).forEach((id) => { const e = rad.getElementById ? rad.getElementById(id) : null; if (e) t += ' ' + e.textContent; });
    }
    return t;
  }
  function trovaCampo() {
    const ric = primoVisibile(selDa('input'));
    if (ric) return { input: ric };
    if (selCache.input) {
      let v = null;
      try { v = tutti(selCache.input).find((x) => visibile(x) && x.tagName === 'INPUT'); } catch (e) {}
      if (v) return { input: v };
    }
    const inputs = tutti('input').filter((el) => {
      const tipo = (el.getAttribute('type') || 'text').toLowerCase();
      return tipo === 'text' || tipo === '';
    });
    for (const el of inputs) {
      const h = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.autocomplete, el.title, etichetta(el)].join(' ');
      if (RE_CAMPO.test(h) && !RE_NO_CAMPO.test(h) && visibile(el)) return { input: el };
    }
    return { input: null };
  }
  const RE_INTERRUTTORE = /hai un (codice|coupon|buono)|(codice|coupon) (sconto|promo|promozionale)|have a (promo|coupon|discount|voucher|gift)|(enter|add|use|apply) (a |your )?(promo|coupon|discount|voucher|gift)|have a (promo|coupon)|aggiungi (un )?(codice|coupon)|enter your (code|coupon)|click here to enter|clicca qui per (inserire|immettere)|inserire il (tuo )?codice|inserisci (il )?(codice|coupon)/i;
  function trovaInterruttore() {
    const buoni = [];
    for (const el of tutti('a,button,summary,[role="button"],[aria-expanded],[onclick],label,[data-role="title"],[role="heading"],[class*="toggle" i],[class*="collaps" i],[class*="accordion" i]')) {
      const t = pulisci(el.textContent);
      // anche l'etichetta per accessibilità (WooCommerce classico: <a aria-label="Enter your coupon code">Click here to enter your code</a>)
      const tt = t + ' ' + pulisci(el.getAttribute('aria-label') || el.title || '');
      if (t.length > 0 && t.length < 80 && RE_INTERRUTTORE.test(tt) && visibile(el)) buoni.push(el);
    }
    // Se un candidato ne contiene un altro (es. WooCommerce a blocchi: <div role=heading> con dentro il vero <div role=button>) tengo il più interno,
    // perché il clic va dato a chi ha il gestore, non al contenitore. Già aperto (aria-expanded=true) = niente da cliccare.
    const interni = buoni.filter((b) => !buoni.some((o) => o !== b && b.contains(o)));
    return interni.find((b) => b.getAttribute('aria-expanded') !== 'true') || interni[0] || null;
  }
  async function assicuraCampo() {
    fresco();
    let r = trovaCampo();
    if (r.input) return r.input;
    // Dopo aver tolto un codice alcune casse (WooCommerce a blocchi, React) ridisegnano il riquadro: aspetto fino a ~3 s che campo o interruttore tornino
    let tg = trovaInterruttore();
    for (let i = 0; i < 20 && !tg && !r.input; i++) { await dorme(150); fresco(); r = trovaCampo(); tg = trovaInterruttore(); }
    if (r.input) return r.input;
    for (let tentativo = 0; tg && !r.input && tentativo < 2; tentativo++) {
      tg.click();
      for (let i = 0; i < 15 && !r.input; i++) { await dorme(100); fresco(); r = trovaCampo(); }
      if (!r.input) { fresco(); tg = trovaInterruttore(); }
    }
    return r.input;
  }

  // ---------- Pulsante "applica" ----------
  const RE_APPLICA = /^(applica|apply|usa|riscatta|redeem|ok|invia|submit|aggiungi|add|verifica|convalida|conferma|einl[oö]sen|anwenden|appliquer|valider|utiliser|aplicar|canjear|→|›|»|>)(\b|$)/i;
  const RE_NO_BOTTONE = /pagament|\bpay|ordina|checkout|acquista|place order|procedi|continua|continue|paga|login|accedi|iscriv|subscribe|cerca|search|newsletter|carrello|\bcart\b|wishlist|panier|warenkorb/i;
  const testoBottone = (b) => pulisci((b.value || '') + ' ' + (b.innerText || b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.title || ''));
  // Pulsanti veri, ma anche <a>, <div role=button>, <div onclick> e simili
  const SEL_BTN = 'button,input[type=submit],input[type=button],input[type=image],a,[role=button],[onclick],[class*="btn" i],[class*="button" i]';
  function trovaBottone(input) {
    const ric = primoVisibile(selDa('bottone'));
    if (ric) return ric;
    if (selCache.bottone) {
      let v = null;
      try { v = tutti(selCache.bottone).find((x) => visibile(x) && x !== input); } catch (e) {}
      if (v) return v;
    }
    // Pulsanti collegati al modulo con l'attributo form="..." ma messi FUORI dal modulo (OpenCart 4: "Apply Coupon" e "Remove" stanno accanto al <form>)
    if (input.form && input.form.id) {
      let esterni = [];
      try { esterni = tutti('button[form="' + String(input.form.id).replace(/["\\]/g, '') + '"],input[type=submit][form="' + String(input.form.id).replace(/["\\]/g, '') + '"]'); } catch (e) {}
      const buoni = esterni.filter((b) => visibile(b) && !RE_NO_BOTTONE.test(testoBottone(b)) && RE_APPLICA.test(testoBottone(b)));
      if (buoni.length) return buoni[0];
    }
    let cont = padre(input);
    for (let i = 0; i < 5 && cont; i++) {
      const bs = [...cont.querySelectorAll(SEL_BTN)].filter((b) => visibile(b) && b !== input);
      const buoni = bs.filter((b) => { const t = testoBottone(b); return t.length < 40 && !RE_NO_BOTTONE.test(t) && RE_APPLICA.test(t); });
      // se un candidato ne contiene un altro, tengo il più interno
      const interno = buoni.filter((b) => !buoni.some((o) => o !== b && b.contains(o)));
      if (interno.length) return interno[0];
      if (cont.tagName === 'FORM') break;
      cont = padre(cont);
    }
    // Pulsante senza testo (solo icona) nello stesso modulo
    const f = input.closest('form');
    if (f) {
      const b = [...f.querySelectorAll('button[type=submit],input[type=submit]')].filter(visibile).find((x) => !RE_NO_BOTTONE.test(testoBottone(x)));
      if (b) return b;
    }
    // ... oppure l'unico pulsante accanto al campo
    const vicino = padre(input);
    if (vicino) {
      const soli = [...vicino.querySelectorAll('button,[role=button]')].filter((b) => visibile(b) && !RE_NO_BOTTONE.test(testoBottone(b)));
      if (soli.length === 1) return soli[0];
    }
    return null;
  }
  function premiInvio(input) {
    for (const tipo of ['keydown', 'keypress', 'keyup']) {
      input.dispatchEvent(new KeyboardEvent(tipo, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }
    const f = input.closest('form');
    // Invia il modulo solo se è piccolo (mai l'intero modulo di pagamento)
    if (f && [...f.querySelectorAll('input')].filter(visibile).length <= 2 && f.requestSubmit) { try { f.requestSubmit(); } catch (e) {} }
  }
  function scrivi(el, v) {
    el.focus({ preventScroll: true });
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: v.slice(-1) || 'Backspace', bubbles: true }));
  }
  // Scrive il codice cercando il campo di nuovo a ogni tentativo (il sito può averlo ricreato),
  // poi cerca il pulsante DOPO aver scritto (alcuni si accendono solo quando c'è del testo) e lo preme.
  async function inserisciEApplica(codice) {
    let input = null;
    for (let t = 0; t < 3; t++) {
      input = await assicuraCampo();
      if (!input) return false;
      scrivi(input, codice);
      await dorme(60);
      fresco();
      const ora = trovaCampo().input || (input.isConnected ? input : null);
      if (ora && ora.isConnected && String(ora.value).toUpperCase() === codice.toUpperCase()) { input = ora; break; }
      if (t === 2 && ora) input = ora;
    }
    if (!input || !input.isConnected) return false;
    let bottone = null;
    for (let i = 0; i < 15; i++) {
      fresco();
      bottone = trovaBottone(input);
      if (!bottone || !spento(bottone)) break;
      await dorme(100);
    }
    if (bottone && !spento(bottone)) bottone.click(); else premiInvio(input);
    return true;
  }

  // ---------- Prezzi e totale ----------
  const SEP = ' \\u00a0\\u202f.,\'\\u2019';
  const NUM = '(\\d{1,3}(?:[' + SEP + ']\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
  const VAL = '(€|\\$|£|(?<![A-Za-z])(?:CHF|EUR|USD|GBP)(?![A-Za-z]))';
  function parseNumero(s) {
    s = s.replace(/[   '’]/g, '');
    const p = s.lastIndexOf('.'), c = s.lastIndexOf(',');
    if (p > -1 && c > -1) return parseFloat(c > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));
    const sep = p > -1 ? '.' : c > -1 ? ',' : null;
    if (!sep) return parseFloat(s);
    const parti = s.split(sep);
    if (parti.length > 2 || (parti.length === 2 && parti[1].length === 3)) return parseFloat(parti.join(''));
    return parseFloat(parti[0] + '.' + parti[1]);
  }
  // Riconosce "€ 1.234,56", "1 234,56 €", "EUR 12.00", "12.00 EUR", "CHF 1'250.00", "£1,234.50", "$12"
  function prezzi(testo) {
    const out = [];
    const re = new RegExp('(?:' + VAL + '\\s*' + NUM + ')|(?:' + NUM + '\\s*' + VAL + ')', 'gi');
    let m;
    while ((m = re.exec(testo))) {
      const v = parseNumero(m[2] || m[3]);
      if (!isNaN(v)) out.push({ v, s: simboloValuta(m[1] || m[4]), negativo: /[-−–]\s*$/.test(testo.slice(Math.max(0, m.index - 3), m.index)) });
    }
    return out;
  }
  const ultimoPrezzo = (t) => { const p = prezzi(t).filter((x) => !x.negativo); return p.length ? p[p.length - 1] : null; };

  // Testo di un elemento SENZA i prezzi vecchi: <del>, <s>, <strike>, testo barrato, classi "old/was/compare" e parti nascoste.
  const RE_VECCHIO = /(^|[\s_-])(old|was|original|compare|strike|strikethrough|line-through|crossed|before|prima|regular-price)([\s_-]|$)/i;
  // Note sulle tasse ("(include 5,41 € IVA)", "Including 5,41 € in taxes"): NON sono il totale. Classi tipiche: includes_tax, tax_label,
  // WooCommerce a blocchi: ...totals-item__description e ...footer-item-tax (la classe ...footer-item-tax-value invece sta anche sul totale vero).
  const RE_TOKEN_TASSE = /^(includes?[_-]?tax|tax[_-]?label|tax[_-]?total|tax[_-]?rate|tax|vat|iva)$|item__description$|footer-item-tax$|(^|[_-])includes[_-]tax$/i;
  const classiTasse = (x) => classe(x).split(/\s+/).some((t) => t && RE_TOKEN_TASSE.test(t));
  const eNotaTasse = (x) => x.tagName === 'SMALL' || classiTasse(x);
  // Il testo "(di cui IVA 22%: 5,41 €)" scritto senza classi
  const RE_TESTO_TASSE = /\([^)]*(?:\biva\b|\bvat\b|\btax(?:es)?\b|\btva\b|mwst|imposte|\bttc\b)[^)]*\)|(?:di cui|of which|including|includes|inclusa|incluso|incl\.?)\s+(?:iva|vat|tax(?:es)?)[^\d€$£]{0,25}[€$£]?\s*\d[\d.,]*\s*[€$£]?/gi;
  // L'elemento sta dentro una nota sulle tasse o dentro un prezzo vecchio (<del>, barrato, classe old/was...)? Si guardano pochi genitori.
  // `limite`: fino a quell'elemento si guardano anche le classi tipo old/was/compare; sopra di lui solo tag <del>/<s> e note sulle tasse.
  function inNotaOVecchio(el, limite) {
    let x = el, dentroLimite = true;
    for (let i = 0; i < 6 && x && x.nodeType === 1; i++, x = padre(x)) {
      if (eNotaTasse(x) || /^(DEL|S|STRIKE)$/.test(x.tagName) || (dentroLimite && RE_VECCHIO.test(classe(x)))) return true;
      if (x === limite) dentroLimite = false;
    }
    return false;
  }
  function testoUtile(radice, senzaTasse) {
    const memo = new Map();
    const scartaEl = (x) => {
      if (memo.has(x)) return memo.get(x);
      let r = false;
      if (/^(DEL|S|STRIKE|SCRIPT|STYLE)$/.test(x.tagName)) r = true;
      else if (senzaTasse && x !== radice && eNotaTasse(x)) r = true;
      else {
        const cs = getComputedStyle(x);
        r = cs.display === 'none' || cs.visibility === 'hidden' || /line-through/.test(cs.textDecorationLine || '') || RE_VECCHIO.test(classe(x));
      }
      memo.set(x, r);
      return r;
    };
    let out = '';
    const w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      let x = n.parentElement, via = false;
      while (x) {
        if (scartaEl(x)) { via = true; break; }
        if (x === radice) break;
        x = x.parentElement;
      }
      if (!via) out += n.nodeValue;
    }
    return out;
  }

  const RE_ESCLUDI_TOT = /sub|ship|spediz|tax|iva|vat|discount|sconto|saving|risparm|item|count|qty|quant|before|prima|(^|[^a-z])old([^a-z]|$)|original|\bwas\b/i;
  const RE_ETICHETTA_TOT = /^(?:il\s+)?(?:totale|total|gesamtsumme|gesamt)(?:\s+(?:ordine|order|da pagare|complessivo|carrello|iva inclusa|due))?\s*:?\s*(?:[€$£]|\d.*)?$/i;
  // Casse che mostrano un "segnaposto grigio" al posto dei totali mentre ricalcolano (WooCommerce a blocchi): il totale in quel momento NON è leggibile
  function totaliInCaricamento() {
    return tutti('[class*="skeleton" i]').some((el) => {
      if (!visibile(el)) return false;
      let c = padre(el);
      for (let i = 0; i < 4 && c; i++, c = padre(c)) if (/total|summary|riepilogo/i.test(classe(c))) return true;
      return false;
    });
  }
  // Il prezzo del TOTALE in un elemento: prima un importo "forte" (strong, bdi, .amount) che non sta in una nota sulle tasse né è un prezzo vecchio,
  // altrimenti l'ultimo importo del testo dopo aver tolto vecchi prezzi e note sulle tasse.
  function prezzoTotale(el) {
    if (!el || inNotaOVecchio(el, el)) return null;
    const pulito = (e) => testoUtile(e, true).replace(RE_TESTO_TASSE, ' ');
    for (const f of el.querySelectorAll('strong,bdi,[class*="amount" i]')) {
      if (!visibile(f) || inNotaOVecchio(f, el)) continue;
      const p = ultimoPrezzo(pulito(f));
      if (p) return p;
    }
    return ultimoPrezzo(pulito(el));
  }
  function leggiTotaleLocale() {
    if (totaliInCaricamento()) return null;
    for (const sel of selDa('totale')) {
      for (const el of tutti(sel).filter(visibile)) { const p = prezzoTotale(el); if (p) return p; }
    }
    const cand = tutti('[class*="total" i],[id*="total" i]').filter((el) =>
      !RE_ESCLUDI_TOT.test(classe(el) + ' ' + el.id) &&
      visibile(el) && el.textContent.length < 200 && prezzoTotale(el));
    const foglie = cand.filter((el) => !cand.some((o) => o !== el && el.contains(o)));
    if (foglie.length) return prezzoTotale(foglie[foglie.length - 1]);
    // Cerca per testo: "Totale" accanto a un prezzo (anche dentro gli shadow DOM)
    let ultimo = null;
    for (const r of radici()) {
      const base = r === document ? document.body : r;
      if (!base) continue;
      const w = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.nodeValue.trim();
        if (!t || t.length > 60 || !RE_ETICHETTA_TOT.test(t)) continue;
        let box = n.parentElement;
        if (!visibile(box)) continue;
        for (let i = 0; i < 3 && box; i++) {
          const p = box.textContent.length < 200 ? prezzoTotale(box) : null;
          if (p) { ultimo = p; break; }
          box = padre(box);
        }
      }
    }
    return ultimo;
  }

  // ---------- Messaggi della pagina ----------
  const RE_ERR = /non valid|invalid|scadut|expired|non applicabil|not valid|not applicable|non esist|does not exist|non riconosciut|not recogni|errore|error|cannot be applied|non può essere|not found|già utilizzat|already (been )?used|minim|unknown|ungültig|abgelaufen|invalide|expiré|n'est pas valide|no es válido|no válido|caducado|inválido/i;
  // Un messaggio di successo vale solo se parla di coupon/codice/sconto (RE_PAROLA_COUPON): "Prodotto aggiunto al carrello" NON è un codice applicato.
  const RE_OK = /applicat|applied|riscattat|redeemed|you saved|hai risparmiato|aggiunto|added|accettato|accepted|congratulazioni|congratulations|success|angewendet|appliqué|aplicado/i;
  const RE_PAROLA_COUPON = /coupon|codice|\bcode\b|sconto|discount|promo|voucher|buono|gutschein|rabatt|r[ée]duction|descuento|cup[oó]n|gift|regalo/i;
  const RE_PRODOTTO_AGGIUNTO = /(al|nel|in)\s+(tuo\s+)?carrello|to\s+(your\s+|the\s+)?(cart|basket|bag)|in\s+(your\s+)?(cart|basket)|wishlist|lista desideri|panier|warenkorb/i;
  const RE_TROPPI = /troppi tentativi|too many (attempts|requests|tries)|riprova più tardi|try again later|rate limit/i;
  const SEL_MSG = '[role="alert"],[aria-live],[class*="error" i],[class*="notice" i],[class*="message" i],[class*="alert" i],[class*="feedback" i],[class*="invalid" i],[class*="success" i],[class*="msg" i]';
  const RE_RIGA_SCONTO = /discount|sconto|coupon|promo|saving|risparm/i;

  // Il riquadro del campo coupon (pochi genitori sopra il campo): lì ogni errore riguarda il codice.
  function zonaCoupon() {
    const inp = trovaCampo().input;
    if (!inp) return null;
    let c = padre(inp);
    for (let i = 0; i < 4 && c && padre(c) && !/^(BODY|HTML)$/.test(padre(c).tagName || ''); i++) c = padre(c);
    return c;
  }
  const dentro = (el, zona) => { for (let x = el; x; x = padre(x)) if (x === zona) return true; return false; };
  // Messaggi: un errore conta se parla di coupon/codice/sconto, oppure se sta nel riquadro del campo coupon.
  // Un successo conta SOLO se parla di coupon/codice/sconto (e non di "aggiunto al carrello").
  // "Troppi tentativi" si cerca in qualunque messaggio visibile.
  function leggiMessaggi() {
    const err = new Set(), ok = new Set();
    let troppi = false;
    const zona = zonaCoupon();
    for (const el of tutti(SEL_MSG)) {
      if (!visibile(el)) continue;
      const t = pulisci(el.textContent).toLowerCase();
      if (!t || t.length > 200) continue;
      if (RE_TROPPI.test(t)) { troppi = true; continue; }
      const cup = RE_PAROLA_COUPON.test(t);
      if (RE_ERR.test(t)) { if (cup || (zona && dentro(el, zona))) err.add(t); }
      else if (RE_OK.test(t) && cup && !RE_PRODOTTO_AGGIUNTO.test(t)) ok.add(t);
    }
    return { err: [...err], ok: [...ok], troppi };
  }
  // Righe "sconto" con un importo negativo (es. "Sconto: -20,00 €")
  function leggiRigheSconto() {
    const out = new Set();
    for (const el of tutti('tr,li,div,span,p,dd,dt')) {
      const id = classe(el) + ' ' + el.id;
      if (!RE_RIGA_SCONTO.test(id) || !visibile(el)) continue;
      const t = pulisci(testoUtile(el));
      if (t.length > 140 || !/[-−–]\s*[€$£]?\s*\d|[€$£]\s*[-−–]\s*\d|[-−–]\s*\d[\d.,\s]*\s*(EUR|USD|GBP|CHF)/i.test(t) || !prezzi(t.replace(/[-−–]/g, '')).length) continue;
      out.add(t.toLowerCase());
    }
    return [...out];
  }
  // Lettura di UN frame
  function leggiLocale() {
    const t = leggiTotaleLocale();
    const m = leggiMessaggi();
    return { totale: t ? t.v : null, simbolo: t ? t.s : null, err: m.err, ok: m.ok, troppi: m.troppi, righe: leggiRigheSconto() };
  }
  // Lettura della scheda: questo frame, più (se serve) gli altri frame, perché il totale può stare altrove.
  async function leggi() {
    const l = leggiLocale();
    if (eTop && l.totale != null) return l;
    const r = await msg({ type: 'leggiAltrove' });
    for (const f of (r && r.frame) || []) {
      if (l.totale == null && f.totale != null) { l.totale = f.totale; l.simbolo = f.simbolo; }
      if (f.troppi) l.troppi = true;
      for (const k of ['err', 'ok', 'righe']) for (const t of f[k] || []) if (!l[k].includes(t)) l[k].push(t);
    }
    return l;
  }
  const snap = (x) => ({ totale: x.totale, simbolo: x.simbolo, err: x.err, ok: x.ok, troppi: !!x.troppi, righe: x.righe });

  function motivoDa(testo) {
    const t = String(testo || '').toLowerCase();
    if (!t) return 'nessuna reazione';
    if (/scadut|expired|abgelaufen|expiré|caducado/.test(t)) return 'scaduto';
    if (/troppi tentativi|too many/.test(t)) return 'troppi tentativi';
    if (/minim/.test(t)) return 'importo minimo';
    // "cannot be applied because it does not exist" (WooCommerce 10) è un codice inesistente, non un codice non applicabile
    if (/non esist|does not exist|doesn't exist|non riconosciut|not recogni/.test(t)) return 'non valido';
    if (/non applicabil|not applicable|cannot be applied|non può essere/.test(t)) return 'non applicabile';
    if (/non valid|invalid|not valid|non esist|does not exist|non riconosciut|not recogni|not found|unknown/.test(t)) return 'non valido';
    return 'non valido';
  }

  function valuta(prima, dopo) {
    // "Troppi tentativi" (in qualunque messaggio visibile): il sito non ha giudicato il codice, quindi niente "non funziona"
    const trop = !!dopo.troppi;
    const errNuovi = dopo.err.filter((t) => !prima.err.includes(t));
    if (!trop && errNuovi.length) return { ok: false, motivo: motivoDa(errNuovi[0]), testo: errNuovi[0] };
    const calo = prima.totale != null && dopo.totale != null ? prima.totale - dopo.totale : null;
    if (calo != null && calo > 0.004) return { ok: true, sconto: Math.round(calo * 100) / 100 };
    const righeNuove = dopo.righe.filter((t) => !prima.righe.includes(t));
    if (righeNuove.length) {
      const imp = Math.max(0, ...righeNuove.map((t) => (ultimoPrezzo(t.replace(/[-−–]/g, '')) || { v: 0 }).v));
      return { ok: true, sconto: imp || null };
    }
    if (trop) return { ok: false, motivo: 'troppi tentativi', riprova: true };
    if (dopo.ok.some((t) => !prima.ok.includes(t)) && !dopo.err.length) return { ok: true, sconto: null };
    if (dopo.err.length) return { ok: false, motivo: motivoDa(dopo.err[0]), testo: dopo.err[0] };
    return { ok: false, motivo: 'nessuna reazione' };
  }

  // ---------- Attesa del risultato: qualunque segnale, polling ogni 100 ms ----------
  let hostOverlay = null;
  function osservaAttivita() {
    let ultimo = Date.now();
    const mo = new MutationObserver((ms) => {
      if (ms.some((m) => !(hostOverlay && (m.target === hostOverlay || hostOverlay.contains(m.target))))) ultimo = Date.now();
    });
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
    let po = null;
    try { po = new PerformanceObserver(() => { ultimo = Date.now(); }); po.observe({ type: 'resource' }); } catch (e) {}
    return { get ultimo() { return ultimo; }, stop() { mo.disconnect(); if (po) po.disconnect(); } };
  }
  function segnale(prima, ora) {
    return (ora.totale != null && prima.totale != null && Math.abs(ora.totale - prima.totale) > 0.004) ||
      (ora.troppi && !prima.troppi) || ora.err.some((t) => !prima.err.includes(t)) || ora.ok.some((t) => !prima.ok.includes(t)) ||
      ora.righe.some((t) => !prima.righe.includes(t)) || prima.righe.some((t) => !ora.righe.includes(t));
  }
  async function attendiEsito(prima) {
    const t0 = Date.now();
    const att = osservaAttivita();
    let visto = 0, ultimaLettura = '', ultimoCambio = 0;
    while (Date.now() - t0 < TIMEOUT_ESITO) {
      await dorme(100);
      fresco();
      const ora = await leggi();
      if (segnale(prima, ora)) {
        if (!visto) visto = Date.now();
        // Aspetto che la lettura si assesti: in alcune casse (WooCommerce a blocchi) la riga "sconto" compare prima del totale
        const j = JSON.stringify(snap(ora));
        if (j !== ultimaLettura) { ultimaLettura = j; ultimoCambio = Date.now(); }
        const totaleOk = ora.totale != null || prima.totale == null;
        if (Date.now() - visto >= 200 && Date.now() - ultimoCambio >= 450 && (totaleOk || Date.now() - visto >= 2500)) break;
        if (Date.now() - visto >= 6000) break;
      } else if (Date.now() - t0 > 800 && Date.now() - att.ultimo > 1800) break;
    }
    att.stop();
  }

  // ---------- Rimuovere il codice ----------
  const RE_RIMUOVI = /^(rimuovi|remove|elimina|togli)\b|rimuovi (il )?(codice|coupon)|remove (coupon|code|discount)|^\[?\s*(rimuovi|remove)\s*\]?$/i;
  const RE_NO_RIMUOVI = /\b(item|items|product|products|articol[oi]|prodott[oi]|quantity|quantit[àa]|line item|panier|warenkorb)\b|from (the |this |your )?(cart|basket|bag)|dal carrello|del carrello|dalla borsa/i;
  const RE_RIMUOVI_CODICE = /(coupon|codice|code|sconto|discount|promo|voucher|buono)/i;
  // Una riga PRODOTTO del carrello (WooCommerce tr.cart_item, blocchi wc-block-cart-items, Shopify .cart-item, "line item"...): lì dentro non si clicca mai.
  const RE_RIGA_PRODOTTO = /(cart|line|order|basket|mini[_-]?cart|checkout)[_-]?items?(?![a-z])|product[_-]?(remove|row|line|item|name|list)|(^|[\s_-])(cart_item|cart__row)(?![a-z])/i;
  function inRigaProdotto(el) {
    let x = el;
    for (let i = 0; i < 9 && x && x.nodeType === 1; i++, x = padre(x)) {
      if (RE_RIGA_PRODOTTO.test(classe(x) + ' ' + (x.id || ''))) return true;
      if (x.getAttributeNames && x.getAttributeNames().some((a) => /^data-(cart[-_]?item|line[-_]?item|item[-_]?key|line-key|product-id|cart-item-key)/.test(a))) return true;
    }
    return false;
  }
  function trovaRimuovi() {
    fresco();
    // I selettori delle ricette sono tutti insieme: scarto quelli che toglierebbero un PRODOTTO ("Remove Maglia from cart") o che stanno in una riga prodotto
    for (const sel of selDa('rimuovi')) {
      const el = tutti(sel).find((x) => visibile(x) && !inRigaProdotto(x) && !RE_NO_RIMUOVI.test(pulisci(x.textContent + ' ' + (x.getAttribute('aria-label') || '') + ' ' + (x.title || ''))));
      if (el) return el;
    }
    for (const el of tutti('a,button,[role="button"]')) {
      if (!visibile(el) || inRigaProdotto(el)) continue;
      const t = pulisci(el.textContent + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.title || ''));
      if (t.length >= 60 || !RE_RIMUOVI.test(t)) continue;
      // MAI il pulsante che toglie un PRODOTTO dal carrello ("Remove item", "Rimuovi articolo"...)
      if (RE_NO_RIMUOVI.test(t)) continue;
      // "Rimuovi" da solo vale solo se è dentro una riga di sconto/coupon
      if (!RE_RIMUOVI_CODICE.test(t)) {
        let c = padre(el), ok = false;
        for (let i = 0; i < 3 && c && !ok; i++, c = padre(c)) ok = c.textContent.length < 120 && RE_RIGA_SCONTO.test(c.textContent);
        if (!ok) continue;
      }
      return el;
    }
    return null;
  }

  // ---------- Stato del test (sopravvive al ricaricamento) ----------
  let statoCorrente = null;
  async function salva(st) { st.ts = Date.now(); await msg({ type: 'sessSet', st }); }

  const CAPTCHA_SEL = '[class*="captcha" i]:not(.grecaptcha-badge),iframe[src*="captcha" i],iframe[src*="turnstile" i],iframe[title*="challenge" i]';
  function captcha() {
    return [...document.querySelectorAll(CAPTCHA_SEL)].some((el) => {
      if (el.classList.contains('grecaptcha-badge')) return false;
      const r = el.getBoundingClientRect();
      return visibile(el) && r.width > 150 && r.height > 60;
    });
  }

  const RE_VUOTO = /cart is (currently )?empty|your cart is empty|carrello (è|e') vuoto|il tuo carrello è vuoto|nessun prodotto nel carrello|panier est vide|warenkorb ist leer|carrito est[aá] vac[ií]o/i;
  const carrelloVuoto = () => { try { return RE_VUOTO.test((document.body && document.body.innerText || '').slice(0, 60000)); } catch (e) { return false; } };

  // Un selettore corto e unico per un elemento (serve a ritrovare campo e pulsante la volta dopo)
  function selettoreDi(el) {
    if (!el || !el.isConnected) return null;
    const tag = el.tagName.toLowerCase(), cand = [];
    if (el.id && !/\d{4,}/.test(el.id)) cand.push('#' + CSS.escape(el.id));
    const nome = el.getAttribute('name');
    if (nome) cand.push(tag + '[name="' + nome.replace(/["\\]/g, '') + '"]');
    const cl = [...el.classList].filter((c) => !/\d{3,}/.test(c)).slice(0, 3);
    if (cl.length) cand.push(tag + '.' + cl.map((c) => CSS.escape(c)).join('.'));
    for (const sel of cand) { try { const t = tutti(sel); if (t.length === 1 && t[0] === el) return sel; } catch (e) {} }
    return null;
  }
  // Dopo un codice riuscito il campo e il pulsante usati erano quelli giusti: li ricordo per questo sito.
  async function ricordaSelettori() {
    try {
      fresco();
      const inp = trovaCampo().input;
      if (!inp) return;
      const bt = trovaBottone(inp);
      const nuovo = { input: selettoreDi(inp), bottone: bt ? selettoreDi(bt) : null };
      if (!nuovo.input || (nuovo.input === selCache.input && nuovo.bottone === selCache.bottone)) return;
      selCache = nuovo;
      await msg({ type: 'selSalva', dominio, input: nuovo.input, bottone: nuovo.bottone });
    } catch (e) {}
  }

  async function valutaPending(st, dopoRicarica) {
    const p = st.pending;
    if (dopoRicarica) await dorme(500);
    fresco();
    const dopo = await leggi();
    let v = valuta(p.prima, dopo);
    // Nessuna reazione: se il carrello è vuoto o il totale non si legge, il codice NON è sbagliato, va riprovato un'altra volta
    if (!v.ok && v.motivo === 'nessuna reazione') {
      if (carrelloVuoto()) v = { ok: false, motivo: 'carrello vuoto', riprova: true };
      else if (p.prima.totale == null || dopo.totale == null) v = { ok: false, motivo: 'totale non leggibile', riprova: true };
    }
    st.pending = null;
    if (dopo.troppi || dopo.err.some((t) => RE_TROPPI.test(t))) st.consecutiviTroppi++;
    else st.consecutiviTroppi = 0;
    const simbolo = dopo.simbolo || p.prima.simbolo || '€';
    if (p.finale) {
      st.fase = 'finale-fatto';
      st.finaleOk = v.ok;
      if (v.ok) st.ultimoApplicato = { code: p.code, sconto: v.sconto, simbolo };
    } else {
      st.risultati.push({ code: p.code, ok: v.ok, sconto: v.sconto || null, motivo: v.motivo || null, simbolo, riprova: !!v.riprova });
      await msg({ type: 'risultato', dominio, codice: p.code, ok: v.ok, riprova: !!v.riprova, totale: p.prima.totale, sconto: v.sconto || null, motivo: v.motivo || null, simbolo, pct: v.ok && v.sconto && p.prima.totale ? (v.sconto / p.prima.totale) * 100 : null });
      if (v.ok) { st.rimuovi = 'da-fare'; st.ultimoApplicato = { code: p.code, sconto: v.sconto, simbolo }; await ricordaSelettori(); }
    }
    await salva(st);
    renderOverlay(st);
  }

  async function provaCodice(st, codice, finale) {
    fresco();
    if (!(await assicuraCampo())) { st.errore = 'Non trovo più il campo del codice.'; st.stop = true; await salva(st); return; }
    const prima = snap(await leggi());
    st.pending = { code: codice, finale: !!finale, prima };
    st.corrente = codice;
    await salva(st);
    renderOverlay(st);
    if (!(await inserisciEApplica(codice))) { st.pending = null; st.errore = 'Non trovo più il campo del codice.'; st.stop = true; await salva(st); return; }
    await attendiEsito(prima);
    await valutaPending(st, false);
  }

  async function rimuovi(st) {
    if (st.rimuovi === 'cliccato') { // siamo qui dopo un ricaricamento della pagina
      await dorme(300);
      const ora = await leggi();
      if (ora.totale != null && st.rimTot != null && ora.totale <= st.rimTot + 0.004) st.nonRimovibile = true;
      st.rimuovi = null;
      await salva(st);
      return;
    }
    const el = trovaRimuovi();
    const prima = snap(await leggi());
    st.rimuovi = 'cliccato';
    st.rimTot = prima.totale;
    await salva(st);
    if (el) el.click();
    else { // il link "rimuovi" può stare in un altro frame
      const r = await msg({ type: 'rimuoviAltrove' });
      if (!(r && r.cliccato)) { st.rimuovi = null; st.nonRimovibile = true; await salva(st); return; }
    }
    await attendiEsito(prima);
    const ora = await leggi();
    if (ora.totale != null && prima.totale != null && ora.totale <= prima.totale + 0.004) st.nonRimovibile = true;
    st.rimuovi = null;
    await salva(st);
  }

  const migliore = (st) => {
    const ok = st.risultati.filter((r) => r.ok);
    if (!ok.length) return null;
    return ok.slice().sort((a, b) => (b.sconto || 0) - (a.sconto || 0))[0];
  };
  const euro = (n, s) => formattaImporto(n, s);

  async function esegui(st) {
    statoCorrente = st;
    CS.inEsecuzione = true;
    creaOverlay();
    renderOverlay(st);
    try {
      while (true) {
        if (st.pending) { await valutaPending(st, true); continue; }
        if (st.rimuovi) { await rimuovi(st); continue; }
        if (st.nonRimovibile || st.fase === 'finale-fatto' || st.stop) break;
        if (st.consecutiviTroppi >= 3) { st.motivoFine = 'troppi'; break; }
        if (captcha()) { st.motivoFine = 'captcha'; break; }
        if (st.fase === 'prova') {
          if (st.idx >= st.coda.length) { st.fase = 'finale'; await salva(st); continue; }
          const codice = st.coda[st.idx++];
          await salva(st);
          await provaCodice(st, codice, false);
          if (st.pending || st.rimuovi) continue;
          await dorme(150 + Math.random() * 250);
        } else if (st.fase === 'finale') {
          const b = migliore(st);
          if (!b) break;
          st.fase = 'finale-in-corso';
          await provaCodice(st, b.code, true);
        } else break;
      }
    } catch (e) {
      st.errore = 'Qualcosa è andato storto: ' + (e && e.message);
    }
    await concludi(st);
  }

  async function concludi(st) {
    const secondi = Math.max(1, Math.round((Date.now() - st.inizio) / 1000));
    const provati = st.risultati.length;
    const b = migliore(st);
    let r;
    if (st.errore) r = { tipo: 'errore', testo: st.errore };
    else if (st.nonRimovibile && st.ultimoApplicato) {
      const u = st.ultimoApplicato;
      r = { tipo: 'ok', code: u.code, sconto: u.sconto, simbolo: u.simbolo, nota: 'Non riesco a togliere i codici da questo sito, quindi mi sono fermato al primo che funziona.' };
    } else if (st.fase === 'finale-fatto' && st.finaleOk && st.ultimoApplicato) {
      const u = st.ultimoApplicato;
      r = { tipo: 'ok', code: u.code, sconto: b ? b.sconto : u.sconto, simbolo: u.simbolo };
    } else if (st.motivoFine === 'captcha') r = { tipo: 'fermato', testo: 'Compare un captcha: mi sono fermato per non insistere.' };
    else if (st.motivoFine === 'troppi') r = { tipo: 'fermato', testo: 'Il sito dice che ci sono troppi tentativi: mi sono fermato.' };
    else if (st.stop) r = { tipo: 'fermato', testo: 'Test fermato.' + (b ? ' Miglior codice finora: ' + b.code + (b.sconto ? ' (' + euro(b.sconto, b.simbolo) + ')' : '') + ' (non applicato).' : '') };
    else r = { tipo: 'nessuno', testo: 'Nessun codice funzionante trovato' };
    r.provati = provati;
    r.secondi = secondi;
    st.concluso = r;
    await salva(st);
    if (r.tipo === 'ok' && r.sconto) await msg({ type: 'storico', dominio, codice: r.code, risparmio: r.sconto, simbolo: r.simbolo });
    CS.inEsecuzione = false;
    renderOverlay(st);
  }

  // ---------- Pannello sulla pagina (sempre nel frame principale) ----------
  const CSS_BASE = `
    :host{all:initial}
    *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
    .box{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:300px;max-width:calc(100vw - 32px);
      background:#fff;color:#14231d;border:1px solid #cfe3da;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.22);padding:14px;font-size:14px;line-height:1.35}
    @media (prefers-color-scheme:dark){.box{background:#17221e;color:#e8f3ee;border-color:#2c4238}}
    .tit{font-weight:700;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
    .verde{color:#0f9d78}.rosso{color:#d14343}.grigio{opacity:.65}
    ul{list-style:none;margin:8px 0;padding:0;max-height:160px;overflow:auto}
    li{padding:2px 0;font-size:13px}
    button{font:inherit;cursor:pointer;border-radius:9px;border:1px solid #0f9d78;padding:6px 12px;background:#0f9d78;color:#fff;font-weight:600}
    button.sec{background:transparent;color:inherit;border-color:#9bb5a9}
    .riga{display:flex;gap:8px;align-items:center;justify-content:space-between}
    .grande{font-size:16px;font-weight:700;margin:6px 0}
    .x{background:transparent;border:none;color:inherit;padding:2px 6px;font-size:16px}`;

  function creaHost(id) {
    let h = document.getElementById(id);
    if (!h) {
      h = document.createElement('div');
      h.id = id;
      h.attachShadow({ mode: 'open' });
      document.documentElement.appendChild(h);
    }
    return h;
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function creaOverlay() {
    if (!eTop) return;
    const sc = document.getElementById('cacciasconti-scheda');
    if (sc) sc.remove();
    hostOverlay = creaHost('cacciasconti-overlay');
  }
  // Nei frame secondari il pannello lo disegna il frame principale (il messaggio passa dal fondo).
  function renderOverlay(st) {
    if (!eTop) { msg({ type: 'overlay', st }); return; }
    disegnaOverlay(st);
  }
  function disegnaOverlay(st) {
    if (!hostOverlay || !hostOverlay.isConnected) creaOverlay();
    const sr = hostOverlay.shadowRoot;
    const righe = st.risultati.map((r) => r.ok
      ? `<li class="verde">✓ ${esc(r.code)} ${r.sconto ? '(-' + esc(euro(r.sconto, r.simbolo)) + ')' : ''}</li>`
      : `<li class="rosso grigio">✗ ${esc(r.code)} <small>${esc(r.motivo || '')}</small></li>`).join('');
    let testa, piedi;
    if (st.concluso) {
      const c = st.concluso;
      const dettaglio = c.provati ? `<div class="grigio"><small>${c.provati} codici provati in ${c.secondi} s</small></div>` : '';
      testa = c.tipo === 'ok'
        ? `<div class="grande verde">Risparmi ${c.sconto ? esc(euro(c.sconto, c.simbolo)) : ''} con ${esc(c.code)}</div>${c.nota ? '<div><small>' + esc(c.nota) + '</small></div>' : ''}`
        : `<div class="grande">${esc(c.testo)}</div>`;
      piedi = dettaglio + '<div class="riga" style="margin-top:8px"><span></span><button id="chiudi">Chiudi</button></div>';
    } else {
      testa = `<div>Sto provando: <b>${esc(st.corrente || '...')}</b> <small>(${Math.min(st.idx, st.coda.length)} di ${st.coda.length})</small></div>`;
      piedi = '<div class="riga" style="margin-top:8px"><span class="grigio"><small>Non toccare la pagina</small></span><button id="stop" class="sec">Stop</button></div>';
    }
    sr.innerHTML = `<style>${CSS_BASE}</style><div class="box"><div class="tit"><span>Cacciasconti</span></div>${testa}<ul>${righe}</ul>${piedi}</div>`;
    const s = sr.getElementById('stop');
    if (s) s.onclick = () => { msg({ type: 'fermaTab' }); };
    const c = sr.getElementById('chiudi');
    if (c) c.onclick = () => hostOverlay.remove();
  }

  // ---------- Scheda "consiglio" automatica e badge (solo nel frame principale) ----------
  let schedaMostrata = false, esplorato = false;
  const haCampoQui = () => !!trovaCampo().input || !!trovaInterruttore();
  async function aggiornaStato() {
    if (CS.inEsecuzione) return;
    await ricetteProntE;
    await prontoE;
    fresco();
    const mio = haCampoQui();
    if (!eTop) { // un frame con il campo avvisa: il badge e la scheda li gestisce il frame principale
      if (mio) { await msg({ type: 'badge', dominio, campo: true }); await msg({ type: 'ricontrolla' }); }
      return;
    }
    let campo = mio;
    if (!campo) { const a = await msg({ type: 'campoAltrove' }); campo = !!(a && a.campo); }
    const b = await msg({ type: 'badge', dominio, campo, totale: leggiLocale().totale });
    if (campo && !esplorato) { esplorato = true; msg({ type: 'esplora', dominio }); }
    if (!campo || schedaMostrata) return;
    const nasc = await msg({ type: 'cardNascosta', dominio });
    if (nasc && nasc.nascosta) return;
    const c = await msg({ type: 'coda', dominio, totale: leggiLocale().totale });
    const n = c && c.coda ? c.coda.length : (b && b.n) || 0;
    if (!n) return;
    schedaMostrata = true;
    const host = creaHost('cacciasconti-scheda');
    host.shadowRoot.innerHTML = `<style>${CSS_BASE}</style><div class="box"><div class="riga"><div><b>Cacciasconti</b>: ${n} codic${n === 1 ? 'e' : 'i'} da provare</div>
      <button class="x" id="x" title="Non mostrare per 24 ore">✕</button></div><div style="margin-top:8px"><button id="vai">Genera sconto</button></div></div>`;
    host.shadowRoot.getElementById('x').onclick = async () => { host.remove(); await msg({ type: 'nascondiCard', dominio }); };
    host.shadowRoot.getElementById('vai').onclick = () => { host.remove(); msg({ type: 'avviaTab', riprova: false }); };
  }

  // ---------- Avvio, messaggi dal fondo, ripresa dopo il ricaricamento ----------
  async function avvia(opz) {
    // Il segno "in corso" si mette SUBITO, prima di ogni attesa: due clic veloci non fanno partire due prove insieme.
    if (CS.inEsecuzione) return { ok: false, errore: 'Già in corso.' };
    CS.inEsecuzione = true;
    try { return await avviaDavvero(opz); } catch (e) { CS.inEsecuzione = false; throw e; }
  }
  async function avviaDavvero(opz) {
    await ricetteProntE;
    await prontoE;
    const tot = await leggi().then((l) => l.totale).catch(() => null);
    const r = await msg({ type: 'coda', dominio, riprova: !!opz.riprova, avvio: true, totale: tot });
    const coda = (r && r.coda) || [];
    const st = {
      dominio, url: location.href, op: { top: eTop, origin: location.origin }, fase: 'prova', coda, idx: 0, risultati: [], stop: false, pending: null, rimuovi: null,
      consecutiviTroppi: 0, nonRimovibile: false, concluso: null, inizio: Date.now(), ts: Date.now(), corrente: null
    };
    if (!coda.length) {
      st.concluso = { tipo: 'nessuno', testo: 'Non ci sono codici da provare', provati: 0, secondi: 0 };
      await salva(st);
      creaOverlay();
      renderOverlay(st);
      CS.inEsecuzione = false;
      return { ok: true };
    }
    await salva(st);
    esegui(st);
    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((m, mittente, risposta) => {
    if (m.type === 'haCampo') {
      Promise.all([ricetteProntE, prontoE]).then(() => { fresco(); const input = !!trovaCampo().input; risposta({ campo: input || !!trovaInterruttore(), input, inEsecuzione: !!CS.inEsecuzione }); });
      return true;
    }
    // Diagnosi (per le prove sui siti veri): cosa vede questo frame, senza toccare niente
    if (m.type === 'diagnosi') {
      ricetteProntE.then(() => {
        fresco();
        const input = trovaCampo().input;
        const b = input ? trovaBottone(input) : null;
        const l = leggiLocale();
        risposta({ campo: !!input, interruttore: !!trovaInterruttore(), bottone: b ? (testoBottone(b).slice(0, 30) || '(solo icona)') : null, totale: l.totale, simbolo: l.simbolo, url: location.href });
      });
      return true;
    }
    if (m.type === 'avvia') { avvia(m).then(risposta); return true; }
    if (m.type === 'ferma') {
      if (statoCorrente) { statoCorrente.stop = true; salva(statoCorrente); }
      risposta({ ok: true });
      return;
    }
    if (m.type === 'leggiLocale') {
      ricetteProntE.then(() => { fresco(); risposta(leggiLocale()); });
      return true;
    }
    if (m.type === 'cliccaRimuovi') {
      const el = trovaRimuovi();
      if (el) el.click();
      risposta({ cliccato: !!el });
      return;
    }
    if (m.type === 'disegnaOverlay' && eTop) { disegnaOverlay(m.st); risposta({ ok: true }); return; }
    if (m.type === 'ricontrolla' && eTop) { aggiornaStato().then(() => risposta({ ok: true })); return true; }
  });

  // Quale frame riprende un test interrotto da un ricaricamento: quello dove era partito.
  const eOperatore = (st) => !st.op || (st.op.top === eTop && st.op.origin === location.origin);

  (async function ripresa() {
    await prontoE;
    const r = await msg({ type: 'sessGet' });
    const st = r && r.st;
    if (st && !st.concluso && st.dominio === dominio) {
      if (Date.now() - st.ts > 60000) { if (eTop) await msg({ type: 'sessDel' }); }
      else {
        if (eOperatore(st)) { await ricetteProntE; esegui(st); }
        else if (eTop) { creaOverlay(); disegnaOverlay(st); } // il test lavora in un frame: qui mostro il pannello
        return;
      }
    }
    setTimeout(aggiornaStato, 800);
    setTimeout(aggiornaStato, 2500);
    setTimeout(aggiornaStato, 5500);
  })();
})();
