// TESTER: trova il campo coupon, prova i codici uno alla volta e applica il migliore.
(function () {
  if (window.CS_TESTER) return;
  window.CS_TESTER = true;
  const CS = (window.CS = window.CS || {});
  const dominio = dominioDi(location.hostname);
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
  const msg = (m) => { try { return chrome.runtime.sendMessage(m).catch(() => null); } catch (e) { return Promise.resolve(null); } };
  const TIMEOUT_ESITO = 4000;

  // ---------- Ricette dei siti (file statici nel pacchetto) ----------
  let ricette = [];
  const ricetteProntE = msg({ type: 'ricette' }).then((r) => { ricette = (r && r.ricette) || []; });
  const selDa = (chiave) => ricette.reduce((a, r) => a.concat(r[chiave] || []), []);

  // ---------- Utilità sulla pagina ----------
  function visibile(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && (r.width > 0 || r.height > 0);
  }
  function primoVisibile(selettori) {
    for (const sel of selettori) {
      let els = [];
      try { els = [...document.querySelectorAll(sel)]; } catch (e) {}
      const v = els.find(visibile);
      if (v) return v;
    }
    return null;
  }
  const pulisci = (t) => String(t || '').replace(/\s+/g, ' ').trim();

  // ---------- Campo coupon ----------
  const RE_CAMPO = /coupon|promo|discount|voucher|gift|sconto|codice|buono/i;
  const RE_NO_CAMPO = /e-?mail|password|search|cerca|zip|postal|postcode|\bcap\b|fiscale|\bvat\b|partita|\bpiva\b|phone|telefon|\btel\b|newsletter|iscriv/i;

  function etichetta(el) {
    let t = '';
    if (el.labels) for (const l of el.labels) t += ' ' + l.textContent;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(/\s+/).forEach((id) => { const e = document.getElementById(id); if (e) t += ' ' + e.textContent; });
    return t;
  }
  function trovaCampo() {
    const ric = primoVisibile(selDa('input'));
    if (ric) return { input: ric };
    const inputs = [...document.querySelectorAll('input')].filter((el) => {
      const tipo = (el.getAttribute('type') || 'text').toLowerCase();
      return tipo === 'text' || tipo === '';
    });
    for (const el of inputs) {
      const h = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.autocomplete, el.title, etichetta(el)].join(' ');
      if (RE_CAMPO.test(h) && !RE_NO_CAMPO.test(h) && visibile(el)) return { input: el };
    }
    return { input: null };
  }
  const RE_INTERRUTTORE = /hai un (codice|coupon|buono)|(codice|coupon) (sconto|promo|promozionale)|have a (promo|coupon|discount|voucher|gift)|(enter|add|use) (a |your )?(promo|coupon|discount|voucher)|aggiungi (un )?(codice|coupon)|inserire il (tuo )?codice|inserisci (il )?(codice|coupon)/i;
  function trovaInterruttore() {
    const els = document.querySelectorAll('a,button,summary,[role="button"],[aria-expanded],[onclick],label');
    for (const el of els) {
      const t = pulisci(el.textContent);
      if (t.length > 0 && t.length < 80 && RE_INTERRUTTORE.test(t) && visibile(el)) return el;
    }
    return null;
  }
  async function assicuraCampo() {
    let r = trovaCampo();
    if (r.input) return r.input;
    const tg = trovaInterruttore();
    if (tg) {
      tg.click();
      for (let i = 0; i < 10 && !r.input; i++) { await dorme(100); r = trovaCampo(); }
    }
    return r.input;
  }

  // ---------- Pulsante "applica" ----------
  const RE_APPLICA = /^(applica|apply|usa|riscatta|redeem|ok|invia|submit|aggiungi|add|verifica|convalida|conferma|→|›|»|>)(\b|$)/i;
  const RE_NO_BOTTONE = /pagament|\bpay|ordina|checkout|acquista|place order|procedi|continua|continue|paga|login|accedi|iscriv|subscribe|cerca|search|newsletter/i;
  const testoBottone = (b) => pulisci((b.value || '') + ' ' + (b.innerText || b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.title || ''));
  function trovaBottone(input) {
    const ric = primoVisibile(selDa('bottone'));
    if (ric) return ric;
    let cont = input.parentElement;
    for (let i = 0; i < 5 && cont; i++) {
      const bs = [...cont.querySelectorAll('button,input[type=submit],input[type=button],a[role=button],[role=button]')].filter(visibile);
      for (const b of bs) {
        const t = testoBottone(b);
        if (RE_NO_BOTTONE.test(t)) continue;
        if (RE_APPLICA.test(t)) return b;
      }
      if (cont.tagName === 'FORM') break;
      cont = cont.parentElement;
    }
    // Pulsante senza testo (solo icona) nello stesso modulo
    const f = input.closest('form');
    if (f) {
      const b = [...f.querySelectorAll('button[type=submit],input[type=submit]')].filter(visibile).find((x) => !RE_NO_BOTTONE.test(testoBottone(x)));
      if (b) return b;
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
    el.focus();
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ---------- Prezzi e totale ----------
  const NUM = '(\\d{1,3}(?:[ \\u00a0\\u202f.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
  function parseNumero(s) {
    s = s.replace(/[   ]/g, '');
    const p = s.lastIndexOf('.'), c = s.lastIndexOf(',');
    if (p > -1 && c > -1) return parseFloat(c > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));
    const sep = p > -1 ? '.' : c > -1 ? ',' : null;
    if (!sep) return parseFloat(s);
    const parti = s.split(sep);
    if (parti.length > 2 || (parti.length === 2 && parti[1].length === 3)) return parseFloat(parti.join(''));
    return parseFloat(parti[0] + '.' + parti[1]);
  }
  function prezzi(testo) {
    const out = [];
    const re = new RegExp('(?:([€$£])\\s*' + NUM + ')|(?:' + NUM + '\\s*([€$£]))', 'g');
    let m;
    while ((m = re.exec(testo))) {
      const v = parseNumero(m[2] || m[3]);
      if (!isNaN(v)) out.push({ v, s: m[1] || m[4], negativo: /[-−–]\s*$/.test(testo.slice(Math.max(0, m.index - 3), m.index)) });
    }
    return out;
  }
  const ultimoPrezzo = (t) => { const p = prezzi(t).filter((x) => !x.negativo); return p.length ? p[p.length - 1] : null; };

  const RE_ESCLUDI_TOT = /sub|ship|spediz|tax|iva|vat|discount|sconto|saving|risparm|item|count|qty|quant|before|prima|old|original|\bwas\b/i;
  const RE_ETICHETTA_TOT = /^(?:il\s+)?(?:totale|total)(?:\s+(?:ordine|order|da pagare|complessivo|carrello|iva inclusa|due))?\s*:?\s*(?:[€$£]|\d.*)?$/i;
  function leggiTotale() {
    const ric = [];
    for (const sel of selDa('totale')) {
      let els = [];
      try { els = [...document.querySelectorAll(sel)].filter(visibile); } catch (e) {}
      if (els.length) { const p = ultimoPrezzo(els[els.length - 1].textContent); if (p) return p; }
      void ric;
    }
    const cand = [...document.querySelectorAll('[class*="total" i],[id*="total" i]')].filter((el) =>
      !RE_ESCLUDI_TOT.test(String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className) + ' ' + el.id) &&
      visibile(el) && el.textContent.length < 200 && ultimoPrezzo(el.textContent));
    const foglie = cand.filter((el) => !cand.some((o) => o !== el && el.contains(o)));
    if (foglie.length) return ultimoPrezzo(foglie[foglie.length - 1].textContent);
    // Cerca per testo: "Totale" accanto a un prezzo
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n, ultimo = null;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.trim();
      if (!t || t.length > 60 || !RE_ETICHETTA_TOT.test(t)) continue;
      let box = n.parentElement;
      if (!visibile(box)) continue;
      for (let i = 0; i < 3 && box; i++) {
        const p = box.textContent.length < 200 ? ultimoPrezzo(box.textContent) : null;
        if (p) { ultimo = p; break; }
        box = box.parentElement;
      }
    }
    return ultimo;
  }

  // ---------- Messaggi della pagina ----------
  const RE_ERR = /non valid|invalid|scadut|expired|non applicabil|not valid|not applicable|non esist|does not exist|non riconosciut|not recogni|errore|error|cannot be applied|non può essere|not found|già utilizzat|already (been )?used|minim|unknown/i;
  const RE_OK = /applicat|applied|riscattat|redeemed|you saved|hai risparmiato|aggiunto|accettato|congratulazioni|congratulations|success/i;
  const RE_TROPPI = /troppi tentativi|too many (attempts|requests|tries)|riprova più tardi|try again later|rate limit/i;
  const SEL_MSG = '[role="alert"],[aria-live],[class*="error" i],[class*="notice" i],[class*="message" i],[class*="alert" i],[class*="feedback" i],[class*="invalid" i],[class*="success" i],[class*="msg" i]';
  const RE_RIGA_SCONTO = /discount|sconto|coupon|promo|saving|risparm/i;

  function leggiMessaggi() {
    const err = new Set(), ok = new Set();
    for (const el of document.querySelectorAll(SEL_MSG)) {
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
    for (const el of document.querySelectorAll('tr,li,div,span,p,dd,dt')) {
      const id = String(el.className && el.className.baseVal != null ? '' : el.className) + ' ' + el.id;
      if (!RE_RIGA_SCONTO.test(id) || !visibile(el)) continue;
      const t = pulisci(el.textContent);
      if (t.length > 140 || !/[-−–]\s*[€$£]?\s*\d|[€$£]\s*[-−–]\s*\d/.test(t) || !prezzi(t.replace(/[-−–]/g, '')).length) continue;
      out.add(t.toLowerCase());
    }
    return [...out];
  }
  function leggi() {
    const t = leggiTotale();
    const m = leggiMessaggi();
    return { totale: t ? t.v : null, simbolo: t ? t.s : null, err: m.err, ok: m.ok, righe: leggiRigheSconto() };
  }
  const snap = (x) => ({ totale: x.totale, simbolo: x.simbolo, err: x.err, ok: x.ok, righe: x.righe });

  function motivoDa(testo) {
    const t = String(testo || '').toLowerCase();
    if (!t) return 'nessuna reazione';
    if (/scadut|expired/.test(t)) return 'scaduto';
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
      if (segnale(prima, leggi())) {
        if (!visto) visto = Date.now();
        if (Date.now() - visto >= 200) break; // lascia aggiornare anche il totale
      } else if (Date.now() - t0 > 600 && Date.now() - att.ultimo > 1000) break;
    }
    att.stop();
  }

  // ---------- Rimuovere il codice ----------
  function trovaRimuovi() {
    const ric = primoVisibile(selDa('rimuovi'));
    if (ric) return ric;
    const RE = /^(rimuovi|remove|elimina|togli)\b|rimuovi (il )?(codice|coupon)|remove (coupon|code|discount)|^\[?\s*(rimuovi|remove)\s*\]?$/i;
    for (const el of document.querySelectorAll('a,button,[role="button"]')) {
      if (!visibile(el)) continue;
      const t = pulisci(el.textContent + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.title || ''));
      if (t.length < 60 && RE.test(t)) return el;
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
    const dopo = leggi();
    const v = valuta(p.prima, dopo);
    st.pending = null;
    if (/troppi tentativi|too many|riprova più tardi|try again later|rate limit/i.test(dopo.err.join(' '))) st.consecutiviTroppi++;
    else st.consecutiviTroppi = 0;
    if (p.finale) {
      st.fase = 'finale-fatto';
      st.finaleOk = v.ok;
      if (v.ok) st.ultimoApplicato = { code: p.code, sconto: v.sconto, simbolo: dopo.simbolo || p.prima.simbolo };
    } else {
      st.risultati.push({ code: p.code, ok: v.ok, sconto: v.sconto || null, motivo: v.motivo || null, simbolo: dopo.simbolo || p.prima.simbolo || '€' });
      await msg({ type: 'risultato', dominio, codice: p.code, ok: v.ok, sconto: v.sconto || null, motivo: v.motivo || null });
      if (v.ok) { st.rimuovi = 'da-fare'; st.ultimoApplicato = { code: p.code, sconto: v.sconto, simbolo: dopo.simbolo || p.prima.simbolo }; }
    }
    await salva(st);
    renderOverlay(st);
  }

  async function provaCodice(st, codice, finale) {
    const input = await assicuraCampo();
    if (!input) { st.errore = 'Non trovo più il campo del codice.'; st.stop = true; await salva(st); return; }
    const bottone = trovaBottone(input);
    const prima = snap(leggi());
    st.pending = { code: codice, finale: !!finale, prima };
    st.corrente = codice;
    await salva(st);
    renderOverlay(st);
    scrivi(input, '');
    scrivi(input, codice);
    if (bottone) bottone.click(); else premiInvio(input);
    await attendiEsito(prima);
    await valutaPending(st, false);
  }

  async function rimuovi(st) {
    if (st.rimuovi === 'cliccato') { // siamo qui dopo un ricaricamento della pagina
      await dorme(300);
      const ora = leggi();
      if (ora.totale != null && st.rimTot != null && ora.totale <= st.rimTot + 0.004) st.nonRimovibile = true;
      st.rimuovi = null;
      await salva(st);
      return;
    }
    const el = trovaRimuovi();
    if (!el) { st.rimuovi = null; st.nonRimovibile = true; await salva(st); return; }
    const prima = snap(leggi());
    st.rimuovi = 'cliccato';
    st.rimTot = prima.totale;
    await salva(st);
    el.click();
    await attendiEsito(prima);
    const ora = leggi();
    if (ora.totale != null && prima.totale != null && ora.totale <= prima.totale + 0.004) st.nonRimovibile = true;
    st.rimuovi = null;
    await salva(st);
  }

  const migliore = (st) => {
    const ok = st.risultati.filter((r) => r.ok);
    if (!ok.length) return null;
    return ok.slice().sort((a, b) => (b.sconto || 0) - (a.sconto || 0))[0];
  };
  const euro = (n, s) => n.toFixed(2).replace('.', ',') + ' ' + (s || '€');

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

  // ---------- Pannello sulla pagina ----------
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

  function creaOverlay() { hostOverlay = creaHost('cacciasconti-overlay'); }
  function renderOverlay(st) {
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
    if (s) s.onclick = async () => { st.stop = true; await salva(st); };
    const c = sr.getElementById('chiudi');
    if (c) c.onclick = () => hostOverlay.remove();
  }

  // ---------- Scheda "consiglio" automatica e badge ----------
  let schedaMostrata = false;
  async function aggiornaStato() {
    if (CS.inEsecuzione) return;
    await ricetteProntE;
    const campo = !!trovaCampo().input || !!trovaInterruttore();
    const b = await msg({ type: 'badge', dominio, campo });
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
    host.shadowRoot.getElementById('vai').onclick = () => { host.remove(); avvia({}); };
  }

  // ---------- Avvio, messaggi dal popup, ripresa dopo il ricaricamento ----------
  async function avvia(opz) {
    if (CS.inEsecuzione) return { ok: false, errore: 'Già in corso.' };
    await ricetteProntE;
    const r = await msg({ type: 'coda', dominio, riprova: !!opz.riprova });
    const coda = (r && r.coda) || [];
    const st = {
      dominio, url: location.href, fase: 'prova', coda, idx: 0, risultati: [], stop: false, pending: null, rimuovi: null,
      consecutiviTroppi: 0, nonRimovibile: false, concluso: null, inizio: Date.now(), ts: Date.now(), corrente: null
    };
    const sh = document.getElementById('cacciasconti-scheda');
    if (sh) sh.remove();
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
    if (m.type === 'stato') {
      ricetteProntE.then(() => risposta({ campo: !!trovaCampo().input || !!trovaInterruttore(), inEsecuzione: CS.inEsecuzione }));
      return true;
    }
    if (m.type === 'avvia') { avvia(m).then(risposta); return true; }
    if (m.type === 'ferma') {
      if (statoCorrente) { statoCorrente.stop = true; salva(statoCorrente); }
      risposta({ ok: true });
    }
  });

  (async function ripresa() {
    const r = await msg({ type: 'sessGet' });
    const st = r && r.st;
    if (st && !st.concluso && st.dominio === dominio) {
      if (Date.now() - st.ts > 60000) { await msg({ type: 'sessDel' }); }
      else { await ricetteProntE; esegui(st); return; }
    }
    setTimeout(aggiornaStato, 800);
    setTimeout(aggiornaStato, 2500);
    setTimeout(aggiornaStato, 5500);
  })();
})();
