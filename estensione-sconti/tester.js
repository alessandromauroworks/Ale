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
  const ricetteProntE = msg({ type: 'ricette' }).then((r) => { ricette = (r && r.ricette) || []; });
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
  const RE_INTERRUTTORE = /hai un (codice|coupon|buono)|(codice|coupon) (sconto|promo|promozionale)|have a (promo|coupon|discount|voucher|gift)|(enter|add|use|apply) (a |your )?(promo|coupon|discount|voucher|gift)|have a (promo|coupon)|aggiungi (un )?(codice|coupon)|inserire il (tuo )?codice|inserisci (il )?(codice|coupon)/i;
  function trovaInterruttore() {
    for (const el of tutti('a,button,summary,[role="button"],[aria-expanded],[onclick],label,[data-role="title"],[role="heading"],[class*="toggle" i],[class*="collaps" i],[class*="accordion" i]')) {
      const t = pulisci(el.textContent);
      if (t.length > 0 && t.length < 80 && RE_INTERRUTTORE.test(t) && visibile(el)) return el;
    }
    return null;
  }
  async function assicuraCampo() {
    fresco();
    let r = trovaCampo();
    if (r.input) return r.input;
    const tg = trovaInterruttore();
    if (tg) {
      tg.click();
      for (let i = 0; i < 10 && !r.input; i++) { await dorme(100); fresco(); r = trovaCampo(); }
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
  function testoUtile(radice) {
    const memo = new Map();
    const scartaEl = (x) => {
      if (memo.has(x)) return memo.get(x);
      let r = false;
      if (/^(DEL|S|STRIKE|SCRIPT|STYLE)$/.test(x.tagName)) r = true;
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
  function leggiTotaleLocale() {
    for (const sel of selDa('totale')) {
      const els = tutti(sel).filter(visibile);
      if (els.length) { const p = ultimoPrezzo(testoUtile(els[els.length - 1])); if (p) return p; }
    }
    const cand = tutti('[class*="total" i],[id*="total" i]').filter((el) =>
      !RE_ESCLUDI_TOT.test(classe(el) + ' ' + el.id) &&
      visibile(el) && el.textContent.length < 200 && ultimoPrezzo(testoUtile(el)));
    const foglie = cand.filter((el) => !cand.some((o) => o !== el && el.contains(o)));
    if (foglie.length) return ultimoPrezzo(testoUtile(foglie[foglie.length - 1]));
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
          const p = box.textContent.length < 200 ? ultimoPrezzo(testoUtile(box)) : null;
          if (p) { ultimo = p; break; }
          box = padre(box);
        }
      }
    }
    return ultimo;
  }

  // ---------- Messaggi della pagina ----------
  const RE_ERR = /non valid|invalid|scadut|expired|non applicabil|not valid|not applicable|non esist|does not exist|non riconosciut|not recogni|errore|error|cannot be applied|non può essere|not found|già utilizzat|already (been )?used|minim|unknown|ungültig|abgelaufen|invalide|expiré|n'est pas valide|no es válido|no válido|caducado|inválido/i;
  const RE_OK = /applicat|applied|riscattat|redeemed|you saved|hai risparmiato|aggiunto|accettato|congratulazioni|congratulations|success|angewendet|appliqué|aplicado/i;
  const RE_TROPPI = /troppi tentativi|too many (attempts|requests|tries)|riprova più tardi|try again later|rate limit/i;
  const SEL_MSG = '[role="alert"],[aria-live],[class*="error" i],[class*="notice" i],[class*="message" i],[class*="alert" i],[class*="feedback" i],[class*="invalid" i],[class*="success" i],[class*="msg" i]';
  const RE_RIGA_SCONTO = /discount|sconto|coupon|promo|saving|risparm/i;

  function leggiMessaggi() {
    const err = new Set(), ok = new Set();
    for (const el of tutti(SEL_MSG)) {
      if (!visibile(el)) continue;
      const t = pulisci(el.textContent).toLowerCase();
      if (!t || t.length > 200) continue;
      if (RE_ERR.test(t)) err.add(t);
      else if (RE_OK.test(t)) ok.add(t);
    }
    return { err: [...err], ok: [...ok] };
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
    return { totale: t ? t.v : null, simbolo: t ? t.s : null, err: m.err, ok: m.ok, righe: leggiRigheSconto() };
  }
  // Lettura della scheda: questo frame, più (se serve) gli altri frame, perché il totale può stare altrove.
  async function leggi() {
    const l = leggiLocale();
    if (eTop && l.totale != null) return l;
    const r = await msg({ type: 'leggiAltrove' });
    for (const f of (r && r.frame) || []) {
      if (l.totale == null && f.totale != null) { l.totale = f.totale; l.simbolo = f.simbolo; }
      for (const k of ['err', 'ok', 'righe']) for (const t of f[k] || []) if (!l[k].includes(t)) l[k].push(t);
    }
    return l;
  }
  const snap = (x) => ({ totale: x.totale, simbolo: x.simbolo, err: x.err, ok: x.ok, righe: x.righe });

  function motivoDa(testo) {
    const t = String(testo || '').toLowerCase();
    if (!t) return 'nessuna reazione';
    if (/scadut|expired|abgelaufen|expiré|caducado/.test(t)) return 'scaduto';
    if (/minim/.test(t)) return 'importo minimo';
    if (/non applicabil|not applicable|cannot be applied|non può essere/.test(t)) return 'non applicabile';
    if (/non valid|invalid|not valid|non esist|does not exist|non riconosciut|not recogni|not found|unknown/.test(t)) return 'non valido';
    return 'non valido';
  }

  function valuta(prima, dopo) {
    const errNuovi = dopo.err.filter((t) => !prima.err.includes(t));
    if (errNuovi.length) return { ok: false, motivo: motivoDa(errNuovi[0]), testo: errNuovi[0] };
    const calo = prima.totale != null && dopo.totale != null ? prima.totale - dopo.totale : null;
    if (calo != null && calo > 0.004) return { ok: true, sconto: Math.round(calo * 100) / 100 };
    const righeNuove = dopo.righe.filter((t) => !prima.righe.includes(t));
    if (righeNuove.length) {
      const imp = Math.max(0, ...righeNuove.map((t) => (ultimoPrezzo(t.replace(/[-−–]/g, '')) || { v: 0 }).v));
      return { ok: true, sconto: imp || null };
    }
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
      ora.err.some((t) => !prima.err.includes(t)) || ora.ok.some((t) => !prima.ok.includes(t)) ||
      ora.righe.some((t) => !prima.righe.includes(t)) || prima.righe.some((t) => !ora.righe.includes(t));
  }
  async function attendiEsito(prima) {
    const t0 = Date.now();
    const att = osservaAttivita();
    let visto = 0;
    while (Date.now() - t0 < TIMEOUT_ESITO) {
      await dorme(100);
      fresco();
      if (segnale(prima, await leggi())) {
        if (!visto) visto = Date.now();
        if (Date.now() - visto >= 200) break; // lascia aggiornare anche il totale
      } else if (Date.now() - t0 > 800 && Date.now() - att.ultimo > 1800) break;
    }
    att.stop();
  }

  // ---------- Rimuovere il codice ----------
  const RE_RIMUOVI = /^(rimuovi|remove|elimina|togli)\b|rimuovi (il )?(codice|coupon)|remove (coupon|code|discount)|^\[?\s*(rimuovi|remove)\s*\]?$/i;
  function trovaRimuovi() {
    fresco();
    const ric = primoVisibile(selDa('rimuovi'));
    if (ric) return ric;
    for (const el of tutti('a,button,[role="button"]')) {
      if (!visibile(el)) continue;
      const t = pulisci(el.textContent + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.title || ''));
      if (t.length < 60 && RE_RIMUOVI.test(t)) return el;
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

  async function valutaPending(st, dopoRicarica) {
    const p = st.pending;
    if (dopoRicarica) await dorme(500);
    fresco();
    const dopo = await leggi();
    const v = valuta(p.prima, dopo);
    st.pending = null;
    if (RE_TROPPI.test(dopo.err.join(' '))) st.consecutiviTroppi++;
    else st.consecutiviTroppi = 0;
    const simbolo = dopo.simbolo || p.prima.simbolo || '€';
    if (p.finale) {
      st.fase = 'finale-fatto';
      st.finaleOk = v.ok;
      if (v.ok) st.ultimoApplicato = { code: p.code, sconto: v.sconto, simbolo };
    } else {
      st.risultati.push({ code: p.code, ok: v.ok, sconto: v.sconto || null, motivo: v.motivo || null, simbolo });
      await msg({ type: 'risultato', dominio, codice: p.code, ok: v.ok, sconto: v.sconto || null, motivo: v.motivo || null, simbolo, pct: v.ok && v.sconto && p.prima.totale ? (v.sconto / p.prima.totale) * 100 : null });
      if (v.ok) { st.rimuovi = 'da-fare'; st.ultimoApplicato = { code: p.code, sconto: v.sconto, simbolo }; }
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
    const b = await msg({ type: 'badge', dominio, campo });
    if (campo && !esplorato) { esplorato = true; msg({ type: 'esplora', dominio }); }
    if (!campo || schedaMostrata) return;
    const nasc = await msg({ type: 'cardNascosta', dominio });
    if (nasc && nasc.nascosta) return;
    const c = await msg({ type: 'coda', dominio });
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
    if (CS.inEsecuzione) return { ok: false, errore: 'Già in corso.' };
    await ricetteProntE;
    await prontoE;
    const r = await msg({ type: 'coda', dominio, riprova: !!opz.riprova, avvio: true });
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
