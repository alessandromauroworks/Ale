/* Base comune dei gestionali di Alessandro Mauro (versione demo).
   Ricavata dal gestionale demo del Patronato e completata con la base obbligatoria
   della skill gestionale-universale (punto 7, colonna demo).
   Regole: il testo dell'utente entra nella pagina solo con textContent (funzione h),
   mai con innerHTML; niente eval; i dati stanno in localStorage di questo browser.
   Un settore si aggancia con Base.avvia({...}): qui non c'è niente di un solo mestiere. */
(function () {
  'use strict';
  var DE = document.documentElement;
  /* cartella di base.js: da qui si caricano i pezzi usati solo ogni tanto (PDF, QR) */
  var BASE_DIR = ((document.currentScript && document.currentScript.src) || '').replace(/[^\/]*$/, '');
  var caricati = {};
  function caricaScript(nome) {
    if (caricati[nome]) return caricati[nome];
    caricati[nome] = new Promise(function (ok, no) {
      var sc = document.createElement('script');
      sc.src = BASE_DIR + nome; sc.async = true;
      sc.onload = function () { ok(); };
      sc.onerror = function () { delete caricati[nome]; sc.remove(); no(new Error('Non caricato: ' + nome)); };
      document.head.appendChild(sc);
    });
    return caricati[nome];
  }

  /* =========================================================
     1. Preferenze: giorno/notte e Liquid Glass (subito, prima del disegno)
     ========================================================= */
  var PREF_TEMA = 'gestionali-tema', PREF_VETRO = 'gestionali-vetro', PREF_VETRO_AUTO = 'gestionali-vetro-auto';
  var tastiPref = []; // i due tasti rapidi (giorno/notte e vetro) presenti nella pagina
  function leggi(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function scrivi(k, v) {
    try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); return true; }
    catch (e) { return false; }
  }
  function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }
  function menoTrasparenza() { return mq('(prefers-reduced-transparency: reduce)'); }
  function menoMovimento() { return mq('(prefers-reduced-motion: reduce)'); }
  function dispositivoDebole() {
    var m = navigator.deviceMemory, c = navigator.hardwareConcurrency, cn = navigator.connection;
    return (m && m <= 2) || (c && c <= 2) || !!(cn && cn.saveData);
  }
  function statoVetro() {
    if (menoTrasparenza()) return { on: false, bloccato: true, motivo: 'Il sistema chiede meno trasparenza: il vetro resta spento e le superfici sono piene.' };
    var p = leggi(PREF_VETRO);
    if (p === '1') return { on: true, motivo: dispositivoDebole() ? 'Acceso a mano su un dispositivo poco potente: se scatta, spegnilo.' : '' };
    if (p === '0') return { on: false, motivo: '' };
    if (dispositivoDebole()) return { on: false, motivo: 'Dispositivo poco potente: il vetro si è spento da solo. Puoi riaccenderlo.' };
    if (leggi(PREF_VETRO_AUTO) === 'lento') return { on: false, motivo: 'Il dispositivo andava a scatti: il vetro si è spento da solo. Puoi riaccenderlo.' };
    return { on: true, motivo: '' };
  }
  function temaScelto() { var t = leggi(PREF_TEMA); return (t === 'scuro' || t === 'chiaro') ? t : ''; }
  function temaEffettivo() { return temaScelto() || (mq('(prefers-color-scheme: dark)') ? 'scuro' : 'chiaro'); }
  function applicaPreferenze() {
    var t = temaScelto();
    if (t) DE.setAttribute('data-tema', t); else DE.removeAttribute('data-tema');
    DE.classList.toggle('lg', statoVetro().on);
    aggiornaTasti();
  }
  function cambioMorbido() {
    if (menoMovimento()) return;
    DE.classList.add('html-cambio');
    clearTimeout(cambioMorbido.t);
    cambioMorbido.t = setTimeout(function () { DE.classList.remove('html-cambio'); }, 380);
  }
  function impostaTema(t) { cambioMorbido(); scrivi(PREF_TEMA, t || null); applicaPreferenze(); }
  function impostaVetro(on) {
    if (menoTrasparenza()) { toast('Il sistema chiede meno trasparenza: il vetro resta spento.', true); return; }
    cambioMorbido(); scrivi(PREF_VETRO, on ? '1' : '0'); scrivi(PREF_VETRO_AUTO, null); applicaPreferenze();
  }
  applicaPreferenze();
  /* misura la fluidità dopo l'apertura: se va sotto i 25 fotogrammi al secondo, spegne il vetro da solo (solo se la scelta è automatica) */
  function controllaFluidita(dopo) {
    if (leggi(PREF_VETRO) || !DE.classList.contains('lg') || !window.requestAnimationFrame) return;
    var t = [], prima = 0;
    function passo(ts) {
      if (prima) t.push(ts - prima); prima = ts;
      if (t.length < 24) { requestAnimationFrame(passo); return; }
      t.sort(function (a, b) { return a - b; });
      if (t[12] > 40) { scrivi(PREF_VETRO_AUTO, 'lento'); applicaPreferenze(); if (dopo) dopo(); }
    }
    setTimeout(function () { requestAnimationFrame(passo); }, 700);
  }
  if (window.matchMedia) {
    ['(prefers-color-scheme: dark)', '(prefers-reduced-transparency: reduce)'].forEach(function (q) {
      var m = window.matchMedia(q);
      var f = function () { applicaPreferenze(); };
      if (m.addEventListener) m.addEventListener('change', f); else if (m.addListener) m.addListener(f);
    });
  }

  /* =========================================================
     2. Costruttore di elementi: unico modo per scrivere nella pagina
     ========================================================= */
  function imposta(el, a, svg) {
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v == null || v === false) return;
      if (k === 'class') { if (svg) el.setAttribute('class', v); else el.className = v; }
      else if (k === 'style') {
        Object.keys(v).forEach(function (sk) {
          if (sk.indexOf('--') === 0) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk];
        });
      }
      else if (k === 'on') { Object.keys(v).forEach(function (e) { el.addEventListener(e, v[e]); }); }
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'multiple' || k === 'readOnly') el[k] = !!v;
      else if (/^on/i.test(k)) throw new Error('Gestori in linea non ammessi');
      else el.setAttribute(k, v === true ? '' : String(v));
    });
  }
  function aggiungi(el, c) {
    if (c == null || c === false || c === '') return;
    if (Array.isArray(c)) { c.forEach(function (x) { aggiungi(el, x); }); return; }
    if (c.nodeType) { el.appendChild(c); return; }
    el.appendChild(document.createTextNode(String(c)));
  }
  function crea(svg, tag, args) {
    var el = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    var i = 0, a = args[0];
    if (a && typeof a === 'object' && !a.nodeType && !Array.isArray(a)) { imposta(el, a, svg); i = 1; }
    for (; i < args.length; i++) aggiungi(el, args[i]);
    return el;
  }
  function h(tag) { return crea(false, tag, [].slice.call(arguments, 1)); }
  function s(tag) { return crea(true, tag, [].slice.call(arguments, 1)); }

  var ICONE = {
    sole: ['M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4', 'c:12,12,4.2'],
    luna: ['M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z'],
    vetro: ['M12 3c3.5 4.2 6 7.6 6 10.6A6 6 0 0 1 6 13.6C6 10.6 8.5 7.2 12 3Z', 'M9.2 14.4a3 3 0 0 0 2.6 2.6'],
    campana: ['M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z', 'M10 20.5a2.2 2.2 0 0 0 4 0'],
    cerca: ['M20 20l-4.2-4.2', 'c:10.5,10.5,6.5'],
    chiudi: ['M6 6l12 12M18 6 6 18']
  };
  function icona(nome, dim) {
    dim = dim || 18;
    var g = s('svg', { viewBox: '0 0 24 24', width: dim, height: dim, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    (ICONE[nome] || []).forEach(function (d) {
      if (d.indexOf('c:') === 0) { var p = d.slice(2).split(','); g.appendChild(s('circle', { cx: p[0], cy: p[1], r: p[2] })); }
      else g.appendChild(s('path', { d: d }));
    });
    return g;
  }

  /* =========================================================
     3. Utilità (date, soldi, testi)
     ========================================================= */
  var OGGI = new Date(); OGGI.setHours(0, 0, 0, 0);
  function pad(n, l) { return String(n).padStart(l || 2, '0'); }
  function iso(d) { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function pIso(x) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return (d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]) ? d : null;
  }
  function piuGiorni(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function giorni(n) { return piuGiorni(OGGI, n); }
  function piuMesi(d, n) {
    var x = new Date(d), g = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n);
    var ult = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(g, ult)); return x;
  }
  function fmt(d) { if (!d) return '—'; d = typeof d === 'string' ? (pIso(d) || new Date(d)) : d; return isNaN(d) ? '—' : d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function fmtL(d) { d = typeof d === 'string' ? pIso(d) : d; return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function fmtDT(q) { var d = new Date(q); return isNaN(d) ? '—' : fmt(d) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function diff(d) { d = typeof d === 'string' ? pIso(d) : d; return d ? Math.round((d - OGGI) / 864e5) : null; }
  function norm(x) { return String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function cap(x) { x = String(x || ''); return x.charAt(0).toUpperCase() + x.slice(1); }
  function eur(c) { return (Number(c || 0) / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }
  var MAX_IMPORTO = 100000000; // 1.000.000 € in centesimi
  function leggiImporto(x) {
    var t = String(x == null ? '' : x).replace(/[\s€]/g, '');
    if (!t) return null;
    var v;
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t) || /^\d+,\d{1,2}$/.test(t)) v = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d+(\.\d{1,2})?$/.test(t)) v = t;
    else if (/^\d+$/.test(t)) v = t;
    else return NaN;
    var c = Math.round(parseFloat(v) * 100);
    return isFinite(c) ? c : NaN;
  }
  function importoTesto(c) { return c == null ? '' : (c / 100).toFixed(2).replace('.', ','); }
  function telOk(x) { var d = String(x).replace(/[\s.\-\/()]/g, '').replace(/^(\+39|0039)/, ''); return /^3\d{8,9}$/.test(d) || /^0\d{5,10}$/.test(d); }
  function telNorm(x) { return String(x || '').replace(/[^\d]/g, '').replace(/^(39|0039)(?=3)/, ''); }
  function emailOk(x) { return /^[^\s@<>()"',;]{1,64}@[^\s@<>()"',;]{1,190}\.[a-z]{2,24}$/i.test(String(x)); }
  function nuovoId(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function chiaveMese(d) { d = typeof d === 'string' ? (pIso(d) || pIso(d.slice(0, 10))) : d; return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function meseDa(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, 1); }
  function meseLabel(k) { return meseDa(k).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); }
  function meseCorto(k) { return meseDa(k).toLocaleDateString('it-IT', { month: 'short' }); }
  function spostaMese(k, n) { return chiaveMese(piuMesi(meseDa(k), n)); }
  function mesiTra(a, b) { var out = [], k = a, g = 0; while (k <= b && g++ < 600) { out.push(k); k = spostaMese(k, 1); } return out; }
  function nomeFile(x) { return String(x || 'file').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120); }
  /* festività nazionali italiane */
  function pasqua(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451),
      mo = Math.floor((hh + l - 7 * m + 114) / 31), da = (hh + l - 7 * m + 114) % 31 + 1;
    return new Date(y, mo - 1, da);
  }
  var FESTE = { '0-1': 'Capodanno', '0-6': 'Epifania', '3-25': 'Festa della Liberazione', '4-1': 'Festa del Lavoro', '5-2': 'Festa della Repubblica', '7-15': 'Ferragosto', '10-1': 'Ognissanti', '11-8': 'Immacolata', '11-25': 'Natale', '11-26': 'Santo Stefano' };
  function festivo(d) {
    var f = FESTE[d.getMonth() + '-' + d.getDate()]; if (f) return f;
    return iso(piuGiorni(pasqua(d.getFullYear()), 1)) === iso(d) ? 'Lunedì dell\'Angelo' : '';
  }
  function minuti(hm) { var a = String(hm).split(':'); return (+a[0]) * 60 + (+a[1]); }
  function hm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function csvCella(v) {
    v = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(v)) v = '\'' + v; // niente formule quando si apre in Excel
    return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  /* =========================================================
     4. Stato, salvataggio, registro
     ========================================================= */
  var CFG = null, D = null, KEY = '', KEY_BOZZE = '', KEY_CODA = '', KEY_CHI = '';
  var AZIONI = {};
  var memoriaOk = true;
  var stato = { vista: 'dash', param: null, f: {} };

  function datiVuoti() {
    return { versione: 1, seme: iso(OGGI), clienti: [], contatti: [], azioni: [], appuntamenti: [], movimenti: [], documenti: [], registro: [], obiettivi: {}, chiusure: {}, settore: {} };
  }
  function completa(d) {
    var v = datiVuoti();
    Object.keys(v).forEach(function (k) {
      if (d[k] == null || typeof d[k] !== typeof v[k] || Array.isArray(v[k]) !== Array.isArray(d[k])) d[k] = v[k];
    });
    return d;
  }
  function semina() {
    var d = datiVuoti();
    var x = CFG.datiDemo ? CFG.datiDemo(Base) : {};
    Object.keys(x || {}).forEach(function (k) { d[k] = x[k]; });
    return completa(d);
  }
  function carica() {
    var raw = leggi(KEY), d = null;
    if (raw) { try { d = JSON.parse(raw); } catch (e) { d = null; } }
    if (!d || typeof d !== 'object' || d.versione !== 1) { D = semina(); D._nuovo = true; }
    else D = completa(d);
    if (CFG.dopoCarica) CFG.dopoCarica(D);
    chiudiMesi();
    delete D._nuovo;
    salva(true);
  }
  function salva(silenzioso) {
    try { window.localStorage.setItem(KEY, JSON.stringify(D)); memoriaOk = true; return true; }
    catch (e) {
      memoriaOk = false;
      if (!silenzioso) toast('Spazio del browser pieno o non disponibile: la modifica vale solo finché la pagina resta aperta.', true);
      return false;
    }
  }
  function chi() {
    var c = leggi(KEY_CHI), p = CFG.persone || [];
    return p.some(function (x) { return x.nome === c; }) ? c : (p[0] ? p[0].nome : 'Titolare');
  }
  function registra(azione, oggetto, dettaglio) {
    D.registro.push({ id: nuovoId('r'), q: new Date().toISOString(), chi: chi(), azione: String(azione), oggetto: String(oggetto || ''), dettaglio: String(dettaglio || '') });
    if (D.registro.length > 3000) D.registro.splice(0, D.registro.length - 3000);
  }
  function ripristina() {
    D = semina(); D._nuovo = true;
    if (CFG.dopoCarica) CFG.dopoCarica(D);
    chiudiMesi(); delete D._nuovo;
    registra('Dati demo ripristinati', 'Impostazioni', 'Tutti i dati sono tornati quelli di esempio');
    scrivi(KEY_BOZZE, null); scrivi(KEY_CODA, null);
    salva();
  }

  /* =========================================================
     5. Clienti, movimenti, attività (API per i settori)
     ========================================================= */
  function cliente(id) { for (var i = 0; i < D.clienti.length; i++) if (D.clienti[i].id === id) return D.clienti[i]; return null; }
  function nomeCliente(id) { var c = cliente(id); return c ? c.nome : '—'; }
  function opzioniClienti(vuota) {
    var o = D.clienti.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'it'); }).map(function (c) { return [c.id, c.nome]; });
    return vuota ? [['', vuota]].concat(o) : o;
  }
  function movimento(id) { for (var i = 0; i < D.movimenti.length; i++) if (D.movimenti[i].id === id) return D.movimenti[i]; return null; }
  function pagato(m) { return m.stato === 'pagato'; }
  function totali(filtro) {
    var e = 0, u = 0, n = 0;
    D.movimenti.forEach(function (m) {
      if (!pagato(m) || !filtro(m)) return;
      n++; if (m.tipo === 'entrata') e += m.importo; else u += m.importo;
    });
    return { entrate: e, uscite: u, margine: e - u, n: n };
  }
  var memo = null; // calcoli riusati dentro un solo disegno della pagina
  function totaliMese(k) {
    if (memo) { memo.mesi = memo.mesi || {}; if (memo.mesi[k]) return memo.mesi[k]; }
    var t = totali(function (m) { return m.data.slice(0, 7) === k; });
    if (memo) memo.mesi[k] = t;
    return t;
  }
  function totaliTra(a, b) { var x = iso(a), y = iso(b); return totali(function (m) { return m.data >= x && m.data <= y; }); }
  function primoMese() {
    var k = chiaveMese(OGGI);
    D.movimenti.forEach(function (m) { var mk = m.data.slice(0, 7); if (mk < k) k = mk; });
    return k;
  }
  /* chiusura automatica: ogni mese passato si chiude e resta nello storico */
  function chiudiMesi() {
    var cur = chiaveMese(OGGI), da = primoMese();
    mesiTra(da, spostaMese(cur, -1)).forEach(function (k) {
      if (D.chiusure[k]) return;
      var t = totaliMese(k);
      D.chiusure[k] = { mese: k, chiusoIl: iso(meseDa(spostaMese(k, 1))), entrate: t.entrate, uscite: t.uscite, margine: t.margine, n: t.n, aggiornata: null };
      if (!D._nuovo) registra('Mese chiuso in automatico', meseLabel(k), 'Entrate ' + eur(t.entrate) + ', uscite ' + eur(t.uscite));
    });
  }
  function meseChiuso(k) { return !!D.chiusure[k] && k < chiaveMese(OGGI); }
  function aggiornaChiusura(k) {
    if (!meseChiuso(k)) return;
    var t = totaliMese(k), c = D.chiusure[k];
    if (c.entrate === t.entrate && c.uscite === t.uscite && c.n === t.n) return;
    c.entrate = t.entrate; c.uscite = t.uscite; c.margine = t.margine; c.n = t.n; c.aggiornata = new Date().toISOString();
    registra('Chiusura del mese aggiornata', meseLabel(k), 'Dopo una modifica ai movimenti: entrate ' + eur(t.entrate) + ', uscite ' + eur(t.uscite));
  }
  function aggiungiMovimento(m) {
    var x = {
      id: nuovoId('m'), data: m.data || iso(OGGI), tipo: m.tipo === 'uscita' ? 'uscita' : 'entrata', categoria: m.categoria || 'Altro',
      importo: Math.round(m.importo), descrizione: m.descrizione || '', cliente: m.cliente || null, stato: m.stato === 'aperto' ? 'aperto' : 'pagato',
      scadenza: m.scadenza || null, rif: m.rif || null, creato: new Date().toISOString()
    };
    D.movimenti.push(x);
    aggiornaChiusura(x.data.slice(0, 7));
    return x;
  }
  function togliMovimento(id) {
    var m = movimento(id); if (!m) return;
    D.movimenti = D.movimenti.filter(function (x) { return x.id !== id; });
    aggiornaChiusura(m.data.slice(0, 7));
  }
  /* date di attività di ogni cliente: servono per clienti nuovi, tornati e persi */
  function attivita() {
    var a = [];
    D.contatti.forEach(function (c) { a.push({ cliente: c.cliente, data: c.q.slice(0, 10) }); });
    D.appuntamenti.forEach(function (x) { if (x.cliente && x.data <= iso(OGGI)) a.push({ cliente: x.cliente, data: x.data }); });
    D.movimenti.forEach(function (m) { if (m.cliente) a.push({ cliente: m.cliente, data: m.data }); });
    if (CFG.attivita) a = a.concat(CFG.attivita(D) || []);
    return a.filter(function (x) { return x.cliente && pIso(x.data); });
  }
  function ultimaAttivita(id) {
    var u = '';
    attivita().forEach(function (x) { if (x.cliente === id && x.data <= iso(OGGI) && x.data > u) u = x.data; });
    return u;
  }

  /* =========================================================
     6. Avvisi, finestre, conferme
     ========================================================= */
  var toastEl = null;
  function toast(msg, err) {
    if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: true }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (err ? ' err' : '');
    toastEl.hidden = false;
    var c = toastEl.cloneNode(true); toastEl.replaceWith(c); toastEl = c; // riparte l'animazione
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { toastEl.hidden = true; }, err ? 5200 : 3200);
  }
  var pila = [];
  function modale(titolo, corpo, o) {
    o = o || {};
    var prima = document.activeElement;
    var chiudiBtn = h('button', { class: 'ico', type: 'button', 'aria-label': 'Chiudi', on: { click: function () { m.chiudi('x'); } } }, icona('chiudi'));
    var sheet = h('div', { class: 'sheet' + (o.larga ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': titolo },
      h('div', { class: 'head' }, h('h2', titolo), chiudiBtn), corpo);
    var fondo = h('div', { class: 'modal' }, sheet);
    fondo.addEventListener('mousedown', function (e) { if (e.target === fondo && !o.modulo) m.chiudi('fuori'); });
    var m = {
      el: sheet,
      chiudi: function (come) {
        if (m.chiusa) return;
        if (o.primaDiChiudere && o.primaDiChiudere(come) === false) return;
        m.chiusa = true; fondo.remove(); pila = pila.filter(function (x) { return x !== m; });
        if (prima && prima.focus && document.contains(prima)) prima.focus();
        if (o.dopo) o.dopo(come);
      }
    };
    pila.push(m);
    document.body.appendChild(fondo);
    var f = sheet.querySelector('input:not([type=hidden]),select,textarea,button.btn');
    (f || chiudiBtn).focus();
    return m;
  }
  function chiudiTutte() { pila.slice().forEach(function (m) { m.chiudi('tutte'); }); }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && pila.length) { e.preventDefault(); pila[pila.length - 1].chiudi('esc'); }
    if (e.key === 'Tab' && pila.length) { // il tasto Tab resta dentro la finestra
      var sh = pila[pila.length - 1].el, f = [].filter.call(sh.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]'), function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  function conferma(titolo, testo, ok, fn, pericolo) {
    var m = modale(titolo, h('div', h('p', { class: 'sub' }, testo), h('div', { class: 'actions' },
      h('button', { class: 'btn' + (pericolo ? ' no' : ''), type: 'button', on: { click: function () { m.chiudi('ok'); fn(); } } }, ok),
      h('button', { class: 'btn sec', type: 'button', on: { click: function () { m.chiudi('annulla'); } } }, 'Annulla'))));
    return m;
  }

  /* =========================================================
     7. Moduli: campi, controlli, bozze e rete che cade
     ========================================================= */
  function bozze() { try { return JSON.parse(leggi(KEY_BOZZE) || '{}') || {}; } catch (e) { return {}; } }
  function salvaBozza(id, valori) { var b = bozze(); b[id] = { valori: valori, q: new Date().toISOString() }; scrivi(KEY_BOZZE, JSON.stringify(b)); }
  function togliBozza(id) { var b = bozze(); if (b[id]) { delete b[id]; scrivi(KEY_BOZZE, JSON.stringify(b)); } }
  function coda() { try { var c = JSON.parse(leggi(KEY_CODA) || '[]'); return Array.isArray(c) ? c : []; } catch (e) { return []; } }
  function salvaCoda(c) { scrivi(KEY_CODA, c.length ? JSON.stringify(c) : null); }
  function inRete() { return navigator.onLine !== false; }

  function opzioniDi(def, valori) {
    var o = typeof def.opzioni === 'function' ? def.opzioni(valori) : (def.opzioni || []);
    return o.map(function (x) { return Array.isArray(x) ? x : [x, x]; });
  }
  function controllaCampo(def, grezzo, valori) {
    var v = typeof grezzo === 'string' ? grezzo.trim() : grezzo, t = def.tipo || 'text';
    if (t === 'checkbox') { if (def.obbl && !v) return { err: def.msgObbl || 'Va spuntato per proseguire.' }; return { v: !!v }; }
    if (v === '' || v == null) { if (def.obbl) return { err: 'Campo obbligatorio.' }; return { v: t === 'importo' || t === 'number' ? null : '' }; }
    if (def.maiuscolo && typeof v === 'string') v = v.toUpperCase().replace(/\s+/g, '');
    var max = def.max || (t === 'textarea' ? 2000 : 120);
    if (typeof v === 'string' && v.length > max && t !== 'importo') return { err: 'Troppo lungo: massimo ' + max + ' caratteri.' };
    if (t === 'email' && !emailOk(v)) return { err: 'Indirizzo email non valido (esempio: nome@dominio.it).' };
    if (t === 'tel' && !telOk(v)) return { err: 'Numero non valido: cellulare (3…) o fisso (0…), anche con +39.' };
    if (t === 'date') { var d = pIso(v); if (!d || d.getFullYear() < 1900 || d.getFullYear() > 2100) return { err: 'Data non valida.' }; }
    if (t === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return { err: 'Ora non valida (hh:mm).' };
    if (t === 'number') {
      if (!/^-?\d{1,9}$/.test(v)) return { err: 'Scrivi un numero intero.' };
      v = parseInt(v, 10);
      if (def.min != null && v < def.min) return { err: 'Il minimo è ' + def.min + '.' };
      if (def.maxN != null && v > def.maxN) return { err: 'Il massimo è ' + def.maxN + '.' };
    }
    if (t === 'importo') {
      var c = leggiImporto(v);
      if (c == null || isNaN(c)) return { err: 'Importo non valido: per esempio 25 oppure 1.250,50.' };
      if (c > (def.maxImporto || MAX_IMPORTO)) return { err: 'Importo troppo alto: massimo ' + eur(def.maxImporto || MAX_IMPORTO) + '.' };
      if (c <= 0 && !def.zero) return { err: 'L\'importo deve essere maggiore di zero.' };
      v = c;
    }
    if (t === 'select') {
      var ok = opzioniDi(def, valori).some(function (o) { return String(o[0]) === String(v); });
      if (!ok) return { err: 'Scegli una voce dall\'elenco.' };
    }
    if (def.pattern && !def.pattern.test(v)) return { err: def.msgPattern || 'Formato non valido.' };
    if (def.valida) { var m = def.valida(v, valori); if (m) return { err: m }; }
    return { v: v };
  }
  /* modulo: o = {titolo, id (bozza), azione, contesto, campi, valori, avvisi(v), testoSalva, larga, toast, cambia(k, grezzi, set), intro} */
  function modulo(o) {
    var campi = o.campi, rif = {}, errEl = {}, wrap = {};
    var valIniz = o.valori || {};
    var b = o.id ? bozze()[o.id] : null;
    var grezzi = {};
    campi.forEach(function (c) {
      var v = valIniz[c.k];
      if (c.tipo === 'importo') v = v == null ? '' : importoTesto(v);
      grezzi[c.k] = v == null ? (c.tipo === 'checkbox' ? false : (c.predef != null ? c.predef : '')) : v;
    });
    function leggiGrezzi() {
      campi.forEach(function (c) { var el = rif[c.k]; if (!el) return; grezzi[c.k] = c.tipo === 'checkbox' ? el.checked : el.value; });
      return grezzi;
    }
    function aggiornaVisibili() {
      campi.forEach(function (c) { if (c.se && wrap[c.k]) wrap[c.k].hidden = !c.se(grezzi); });
    }
    function set(k, v) { grezzi[k] = v; var el = rif[k]; if (el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v; } }
    function cambiato(k) {
      leggiGrezzi();
      if (o.cambia) o.cambia(k, grezzi, set);
      aggiornaVisibili();
      if (o.id) { salvaBozza(o.id, grezzi); }
      if (errEl[k] && errEl[k].textContent) { errEl[k].textContent = ''; rif[k].removeAttribute('aria-invalid'); }
      avvisiDati = null; salvaBtn.textContent = o.testoSalva || 'Salva';
    }
    function input(c) {
      var t = c.tipo || 'text', id = 'f-' + c.k + '-' + Math.random().toString(36).slice(2, 6), el;
      var att = { id: id, name: c.k, 'aria-describedby': id + '-e' };
      if (t === 'textarea') el = h('textarea', att);
      else if (t === 'select') {
        el = h('select', att, opzioniDi(c, grezzi).map(function (op) { return h('option', { value: op[0] }, op[1]); }));
      }
      else if (t === 'checkbox') { att.type = 'checkbox'; el = h('input', att); }
      else {
        att.type = t === 'importo' ? 'text' : t;
        if (t === 'importo') { att.inputmode = 'decimal'; att.placeholder = c.segnaposto || 'es. 25,00'; }
        if (t === 'number') att.inputmode = 'numeric';
        if (c.segnaposto && t !== 'importo') att.placeholder = c.segnaposto;
        if (t === 'tel') att.autocomplete = 'tel';
        if (t === 'email') att.autocomplete = 'email';
        el = h('input', att);
      }
      if (c.obbl) el.setAttribute('aria-required', 'true');
      if (t === 'checkbox') el.checked = !!grezzi[c.k]; else el.value = grezzi[c.k] == null ? '' : grezzi[c.k];
      el.addEventListener(t === 'select' || t === 'checkbox' || t === 'date' ? 'change' : 'input', function () { cambiato(c.k); });
      rif[c.k] = el;
      var e = h('div', { class: 'err', id: id + '-e', 'aria-live': 'polite' }); errEl[c.k] = e;
      var lab = h('label', { for: id }, c.l + (c.obbl ? ' *' : ''));
      var w = t === 'checkbox'
        ? h('div', { class: 'f' }, h('label', { class: 'check', for: id, style: { borderBottom: '0', padding: '4px 0' } }, el, h('span', c.l + (c.obbl ? ' *' : ''))), c.hint ? h('div', { class: 'hint' }, c.hint) : null, e)
        : h('div', { class: 'f' }, lab, el, c.hint ? h('div', { class: 'hint' }, c.hint) : null, e);
      if (t === 'textarea' || c.piena || t === 'checkbox') w.style.gridColumn = '1 / -1';
      wrap[c.k] = w;
      return w;
    }
    var bozzaBox = null;
    if (b && b.valori) {
      bozzaBox = h('div', { class: 'ibox' }, 'C\'è una bozza non salvata del ' + fmtDT(b.q) + '. ',
        h('button', { class: 'btn sm', type: 'button', on: { click: function () { Object.keys(b.valori).forEach(function (k) { if (k in grezzi) set(k, b.valori[k]); }); aggiornaVisibili(); bozzaBox.remove(); toast('Bozza ripresa'); } } }, 'Riprendi la bozza'), ' ',
        h('button', { class: 'btn sm sec', type: 'button', on: { click: function () { togliBozza(o.id); bozzaBox.remove(); } } }, 'Scarta'));
    }
    var ferr = h('div', { class: 'ferr', role: 'alert', hidden: true });
    var wbox = h('div', { class: 'wbox', role: 'alert', hidden: true });
    var rete = h('div', { class: 'wbox', hidden: inRete() }, 'Sei senza rete: quello che scrivi resta come bozza su questo dispositivo e lo registro appena la rete torna.');
    var avvisiDati = null;
    var salvaBtn = h('button', { class: 'btn', type: 'submit' }, o.testoSalva || 'Salva');
    var form = h('form', { novalidate: true },
      o.intro || null, bozzaBox, rete,
      h('div', { class: 'frow' }, campi.map(input)),
      wbox, ferr,
      h('div', { class: 'actions' }, salvaBtn,
        h('button', { class: 'btn sec', type: 'button', on: { click: function () { if (o.id) togliBozza(o.id); m.chiudi('annulla'); } } }, 'Annulla')));
    aggiornaVisibili();
    var aggRete = function () { rete.hidden = inRete(); };
    window.addEventListener('online', aggRete); window.addEventListener('offline', aggRete);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      leggiGrezzi();
      var valori = {}, errori = 0, primo = null;
      campi.forEach(function (c) {
        errEl[c.k].textContent = ''; rif[c.k].removeAttribute('aria-invalid');
        if (c.se && !c.se(grezzi)) { valori[c.k] = c.tipo === 'checkbox' ? false : (c.tipo === 'importo' || c.tipo === 'number' ? null : ''); return; }
        var r = controllaCampo(c, grezzi[c.k], grezzi);
        if (r.err) { errori++; errEl[c.k].textContent = r.err; rif[c.k].setAttribute('aria-invalid', 'true'); if (!primo) primo = rif[c.k]; }
        else valori[c.k] = r.v;
      });
      ferr.hidden = !errori; ferr.textContent = errori ? (errori === 1 ? 'C\'è un campo da correggere.' : 'Ci sono ' + errori + ' campi da correggere.') : '';
      if (errori) { primo.focus(); return; }
      var w = o.avvisi ? (o.avvisi(valori, o.contesto) || []) : [];
      var chiave = w.join('|');
      if (w.length && avvisiDati !== chiave) {
        avvisiDati = chiave; wbox.textContent = '';
        wbox.appendChild(h('b', 'Controlla prima di salvare:')); wbox.appendChild(h('ul', w.map(function (x) { return h('li', x); })));
        wbox.hidden = false; salvaBtn.textContent = 'Salva comunque'; salvaBtn.focus(); return;
      }
      wbox.hidden = true;
      if (!inRete()) {
        var c = coda(); c.push({ azione: o.azione, contesto: o.contesto || null, valori: valori, q: new Date().toISOString(), titolo: o.titolo, bozza: o.id || null });
        salvaCoda(c);
        if (o.id) salvaBozza(o.id, grezzi);
        m.chiudi('coda'); aggiornaOffline();
        toast('Senza rete: tenuto come bozza. Lo registro appena torna la rete.');
        return;
      }
      var res = esegui(o.azione, valori, o.contesto);
      if (res && res.errore) { ferr.hidden = false; ferr.textContent = res.errore; return; }
      if (res && res.campo) { Object.keys(res.campo).forEach(function (k) { if (errEl[k]) { errEl[k].textContent = res.campo[k]; rif[k].setAttribute('aria-invalid', 'true'); } }); ferr.hidden = false; ferr.textContent = 'Controlla i campi segnati.'; return; }
      if (o.id) togliBozza(o.id);
      m.chiudi('salvato');
      toast(o.toast || 'Salvato');
      if (o.dopo) o.dopo(res);
      render();
    });
    var m = modale(o.titolo, form, {
      larga: o.larga, modulo: true,
      primaDiChiudere: function (come) {
        if ((come === 'x' || come === 'esc') && o.id) { leggiGrezzi(); var b2 = bozze()[o.id]; if (b2) toast('Bozza conservata: la ritrovi riaprendo il modulo.'); }
      },
      dopo: function () { window.removeEventListener('online', aggRete); window.removeEventListener('offline', aggRete); }
    });
    return m;
  }
  function azione(nome, fn) { AZIONI[nome] = fn; }
  function esegui(nome, valori, contesto) {
    var f = AZIONI[nome];
    if (!f) return { errore: 'Azione non disponibile.' };
    var r = f(valori, contesto);
    if (!(r && (r.errore || r.campo))) salva();
    return r;
  }
  function svuotaCoda() {
    var c = coda(); if (!c.length || !inRete()) return;
    var resta = [], ok = 0;
    c.forEach(function (x) {
      var r = esegui(x.azione, x.valori, x.contesto);
      if (r && (r.errore || r.campo)) resta.push(x);
      else { ok++; if (x.bozza) togliBozza(x.bozza); }
    });
    salvaCoda(resta);
    if (ok) toast('Rete tornata: ' + pl(ok, 'bozza registrata', 'bozze registrate') + '.');
    if (resta.length) toast(pl(resta.length, 'bozza non registrata', 'bozze non registrate') + ': riaprila e controlla i dati.', true);
    render();
  }

  /* =========================================================
     8. Componenti grafici
     ========================================================= */
  function pill(t, c) { return h('span', { class: 'pill ' + (c || 'info') }, t); }
  function vuoto(t, d) { return h('div', { class: 'empty' }, h('b', t), d ? h('span', d) : null); }
  function semaforo(n) { return n < 0 ? 'bad' : (n <= 7 ? 'warn' : 'ok'); }
  function quando(n) { return n < 0 ? 'scaduta da ' + pl(-n, 'giorno', 'giorni') : (n === 0 ? 'oggi' : (n === 1 ? 'domani' : 'tra ' + n + ' giorni')); }
  function pillScad(data) { var n = diff(data); return pill(quando(n), semaforo(n)); }
  function contaSu(el, fine, f) {
    if (menoMovimento() || !window.requestAnimationFrame || !fine) { el.textContent = f(fine); return; }
    var t0 = null, dur = 700;
    el.textContent = f(0);
    function passo(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = f(p < 1 ? Math.round(fine * e) : fine); if (p < 1) requestAnimationFrame(passo); }
    requestAnimationFrame(passo);
  }
  function kpi(o) {
    var f = o.soldi ? eur : function (x) { return String(x); };
    var n = h('div', { class: 'n' }, f(o.n)); if (o.col) n.style.color = 'var(--' + o.col + ')';
    if (typeof o.n === 'number') contaSu(n, o.n, f);
    var inner = [n, h('div', { class: 'l' }, o.l), o.delta || null];
    if (o.vai) return h('button', { class: 'card stat kpi', type: 'button', 'aria-label': o.l + ': ' + f(o.n) + '. Apri il dettaglio', on: { click: o.vai } }, inner, h('span', { class: 'go', 'aria-hidden': 'true' }, '›'));
    return h('div', { class: 'card stat' }, inner);
  }
  function barre(righe, o) {
    o = o || {};
    if (!righe.length) return vuoto(o.vuoto || 'Nessun dato');
    var mx = Math.max.apply(null, righe.map(function (r) { return Math.abs(r.v); }).concat([1]));
    return h('div', { class: 'hb' }, righe.map(function (r, i) {
      return h('div', { class: 'hbr' }, h('span', { class: 'hbl', title: r.l }, r.l),
        h('span', { class: 'hbt', 'data-tip': r.tip || (r.l + ': ' + (r.vt || r.v)), tabindex: '0', role: 'img', 'aria-label': r.tip || (r.l + ': ' + (r.vt || r.v)) },
          h('i', { class: r.u ? 'u' : '', style: { width: Math.max(3, Math.round(Math.abs(r.v) / mx * 100)) + '%', '--i': String(i) } })),
        h('b', r.vt != null ? r.vt : String(r.v)));
    }));
  }
  function asseMax(v) { var mx = Math.max.apply(null, v.concat([1])); var e = Math.pow(10, Math.floor(Math.log10(mx))); var n = Math.ceil(mx / e); n = n <= 2 ? 2 : (n <= 5 ? 5 : 10); return n * e; }
  function grafColonne(etichette, serie, o) {
    o = o || {};
    var mob = mq('(max-width:820px)'), W = 380, H = mob ? 280 : 210, L = o.soldi ? 46 : 26, R = 8, T = 14, B = 26, pw = W - L - R, ph = H - T - B;
    var tutti = []; serie.forEach(function (x) { tutti = tutti.concat(x.vals); });
    var mx = asseMax(tutti), n = etichette.length, gw = pw / n, bw = Math.min(16, (gw - 4) / serie.length);
    var y = function (v) { return T + ph * (1 - v / mx); };
    var fa = o.soldi ? function (c) { var e = c / 100; return e >= 1000 ? Math.round(e / 1000) + 'k' : String(Math.round(e)); } : String;
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.aria || 'Grafico' });
    [0, mx / 2, mx].forEach(function (v) {
      svg.appendChild(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'gl' }));
      svg.appendChild(s('text', { x: L - 6, y: y(v) + 3, 'text-anchor': 'end', class: 'ax' }, fa(v)));
    });
    etichette.forEach(function (l, i) {
      var cx = L + gw * i + gw / 2;
      if (!mob || i % 2 === (n - 1) % 2) svg.appendChild(s('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'ax' }, l));
      serie.forEach(function (se, k) {
        var v = Math.max(0, se.vals[i]), x0 = cx - serie.length * bw / 2 + k * bw + 1, hh = ph * v / mx;
        svg.appendChild(s('rect', { x: x0.toFixed(1), y: y(v).toFixed(1), width: Math.max(1, bw - 2).toFixed(1), height: Math.max(hh, 1).toFixed(1), rx: '3', class: 'cb s' + k, style: { '--i': String(i) }, 'data-tip': se.tips[i], tabindex: '0', role: 'img', 'aria-label': se.tips[i] }));
      });
    });
    return h('div', { class: 'ch' }, svg, h('div', { class: 'legend' }, serie.map(function (se, k) { return h('span', h('i', { class: 's' + k }), se.nome); })));
  }
  var tipEl = null;
  function suggerimenti() {
    tipEl = h('div', { class: 'tip', hidden: true, role: 'status' }); document.body.appendChild(tipEl);
    function mostra(e) {
      var t = e.target.closest && e.target.closest('[data-tip]'); if (!t) return;
      tipEl.textContent = t.getAttribute('data-tip'); tipEl.hidden = false;
      var r = t.getBoundingClientRect(), x = e.clientX || (r.left + r.width / 2), yy = e.clientY || r.top;
      var w = tipEl.offsetWidth; tipEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px'; tipEl.style.top = Math.max(8, yy - 40) + 'px';
    }
    document.addEventListener('pointerover', mostra); document.addEventListener('focusin', mostra);
    document.addEventListener('pointerout', function (e) { if (e.target.closest && e.target.closest('[data-tip]')) tipEl.hidden = true; });
    document.addEventListener('focusout', function () { tipEl.hidden = true; });
    window.addEventListener('scroll', function () { tipEl.hidden = true; }, { passive: true });
  }
  /* tabella che su telefono diventa un elenco di schede */
  function tabella(colonne, righe, o) {
    o = o || {};
    if (!righe.length) return h('div', { class: 'card' }, vuoto(o.vuoto || 'Nessun elemento', o.vuotoD));
    var tb = h('tbody', righe.map(function (r) {
      var tr = h('tr', null, colonne.map(function (c, i) {
        var v = c.v(r);
        return h('td', { class: c.num ? 'num' : null, 'data-l': (i > 0 && c.t) ? c.t : null }, v == null || v === '' ? '—' : v);
      }));
      if (o.apri) {
        tr.className = 'apri'; tr.tabIndex = 0;
        tr.addEventListener('click', function (e) { if (e.target.closest('button,a,select,input')) return; o.apri(r); });
        tr.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === tr) { e.preventDefault(); o.apri(r); } });
      }
      return tr;
    }));
    return h('div', { class: 'tablewrap carte' }, h('table', h('thead', h('tr', colonne.map(function (c) { return h('th', { class: c.num ? 'num' : null, scope: 'col' }, c.t); }))), tb, o.piede || null));
  }
  function esportaCsv(titolo, testa, righe) {
    var txt = [testa].concat(righe).map(function (r) { return r.map(csvCella).join(';'); }).join('\r\n');
    var nome = norm(titolo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + iso(OGGI) + '.csv';
    scarica(nome, new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
    registra('Esportazione CSV', titolo, pl(righe.length, 'riga', 'righe'));
    salva();
    toast('File ' + nome + ' pronto: ' + pl(righe.length, 'riga', 'righe') + '.');
    return txt;
  }
  function scarica(nome, blob) {
    try {
      var url = URL.createObjectURL(blob), a = h('a', { href: url, download: nomeFile(nome) });
      a.style.display = 'none'; document.body.appendChild(a); a.click();
      setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 1500);
      return true;
    } catch (e) { toast('Scaricamento non riuscito in questo browser.', true); return false; }
  }
  /* per il margine conta la differenza in euro: la percentuale inganna se prima era vicino a zero o negativo */
  function deltaEuro(cur, prev, inverti) {
    if (prev == null) return h('div', { class: 'd par' }, 'nessun dato per il confronto');
    var x = cur - prev;
    return h('div', { class: 'd ' + (x === 0 ? 'par' : ((x > 0) !== !!inverti ? 'su' : 'giu')) }, (x > 0 ? '+' : (x < 0 ? '−' : '')) + eur(Math.abs(x)));
  }
  function delta(cur, prev, inverti) {
    if (prev == null) return h('div', { class: 'd par' }, 'nessun dato per il confronto');
    if (prev === 0) return h('div', { class: 'd par' }, cur === 0 ? 'uguale' : 'prima era zero');
    var p = (cur - prev) / Math.abs(prev) * 100, su = p >= 0;
    var cl = Math.abs(p) < 0.05 ? 'par' : ((su !== !!inverti) ? 'su' : 'giu');
    return h('div', { class: 'd ' + cl }, (su ? '+' : '−') + Math.abs(p).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%');
  }

  /* =========================================================
     9. Scadenze e notifiche (base + settore)
     ========================================================= */
  function scadenze() {
    if (memo && memo.scad) return memo.scad;
    var out = [];
    D.azioni.forEach(function (a) { if (!a.fatto && a.data) out.push({ data: a.data, tipo: 'Prossima azione', titolo: a.testo, sotto: nomeCliente(a.cliente), vai: function () { vai('clienti', a.cliente); } }); });
    D.movimenti.forEach(function (m) {
      if (m.stato !== 'aperto') return;
      var d = m.scadenza || m.data;
      out.push({ data: d, tipo: m.tipo === 'entrata' ? 'Da incassare' : 'Da pagare', titolo: (m.descrizione || m.categoria) + ' · ' + eur(m.importo), sotto: m.cliente ? nomeCliente(m.cliente) : m.categoria, vai: function () { stato.f.bilTab = 'mov'; vai('bilancio'); } });
    });
    if (CFG.scadenze) out = out.concat(CFG.scadenze(D) || []);
    out = out.filter(function (x) { return pIso(x.data); }).sort(function (a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); });
    if (memo) memo.scad = out;
    return out;
  }
  function notifiche() {
    var n = [], og = iso(OGGI), dom = iso(giorni(1));
    D.appuntamenti.forEach(function (a) {
      if (a.data === og || a.data === dom) n.push({ urg: a.data === og, gruppo: a.data === og ? 'Appuntamenti di oggi' : 'Appuntamenti di domani', titolo: a.ora + ' · ' + a.titolo, sotto: (a.cliente ? nomeCliente(a.cliente) : (a.nome || '')) + (a.op ? ' · ' + a.op : ''), vai: function () { stato.f.agData = a.data; stato.f.agVista = 'giorno'; vai('agenda'); }, ord: a.data + a.ora });
    });
    scadenze().forEach(function (x) {
      var d = diff(x.data);
      if (d <= 7) n.push({ urg: d <= 0, gruppo: d < 0 ? 'Scadute' : 'Scadenze entro 7 giorni', titolo: x.tipo + ' · ' + x.titolo, sotto: (x.sotto ? x.sotto + ' · ' : '') + quando(d), vai: x.vai, ord: x.data });
    });
    var c = coda().length; if (c) n.push({ urg: true, gruppo: 'Bozze in attesa della rete', titolo: pl(c, 'bozza da registrare', 'bozze da registrare'), sotto: 'Si registrano da sole quando torna la rete', ord: '0' });
    if (CFG.notifiche) n = n.concat(CFG.notifiche(D) || []);
    var ordineG = ['Bozze in attesa della rete', 'Scadute', 'Appuntamenti di oggi', 'Scadenze entro 7 giorni', 'Appuntamenti di domani'];
    return n.sort(function (a, b) { var ga = ordineG.indexOf(a.gruppo), gb = ordineG.indexOf(b.gruppo); if (ga !== gb) return (ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb); return String(a.ord || '').localeCompare(String(b.ord || '')); });
  }

  /* =========================================================
     10. Guscio: barra laterale, barra in alto, ricerca, notifiche
     ========================================================= */
  var G = {}; // riferimenti del guscio
  function aggiornaTasti() {
    var t = temaEffettivo(), v = statoVetro();
    tastiPref.forEach(function (b) {
      if (b.dataset.tasto === 'tema') {
        b.textContent = ''; b.appendChild(icona(t === 'scuro' ? 'sole' : 'luna'));
        b.setAttribute('aria-label', t === 'scuro' ? 'Passa al tema giorno' : 'Passa al tema notte');
        b.title = b.getAttribute('aria-label');
      } else {
        b.setAttribute('aria-pressed', v.on ? 'true' : 'false');
        b.setAttribute('aria-disabled', v.bloccato ? 'true' : 'false');
        b.setAttribute('aria-label', v.bloccato ? 'Liquid Glass non disponibile: il sistema chiede meno trasparenza' : (v.on ? 'Spegni Liquid Glass' : 'Accendi Liquid Glass'));
        b.title = b.getAttribute('aria-label');
      }
    });
  }
  function creaTastiPref() {
    var bt = h('button', { class: 'ico', type: 'button', 'data-tasto': 'tema', on: { click: function () { impostaTema(temaEffettivo() === 'scuro' ? 'chiaro' : 'scuro'); if (D) render(); } } });
    var bv = h('button', { class: 'ico', type: 'button', 'data-tasto': 'vetro', on: { click: function () { impostaVetro(!statoVetro().on); if (D) render(); } } }, icona('vetro'));
    tastiPref.push(bt, bv); aggiornaTasti();
    return [bt, bv];
  }
  /* pagine semplici (elenco dei gestionali): solo i due tasti */
  function preparaPagina() {
    document.querySelectorAll('[data-tasti-pref]').forEach(function (box) { creaTastiPref().forEach(function (b) { box.appendChild(b); }); });
  }

  function sezioni() {
    var base = [
      ['dash', 'Dashboard'], ['clienti', CFG.etichette.clienti], ['agenda', 'Agenda'], ['scadenze', 'Scadenze'],
      ['bilancio', 'Bilancio'], ['documenti', 'Documenti'], ['csv', 'Importa ed esporta'], ['registro', 'Registro modifiche'], ['imp', 'Impostazioni']
    ].map(function (x) { return { id: x[0], titolo: x[1] }; });
    (CFG.sezioni || []).forEach(function (sz) {
      var i = base.map(function (b) { return b.id; }).indexOf(sz.dopo || 'dash');
      base.splice(i + 1, 0, sz);
    });
    return base;
  }
  function trovaSezione(id) { return sezioni().filter(function (x) { return x.id === id; })[0]; }

  function guscio() {
    var root = document.getElementById('app');
    G.nav = h('nav', { class: 'nav', 'aria-label': 'Sezioni' });
    G.ind = h('span', { class: 'navind', 'aria-hidden': 'true' });
    var chiSel = h('select', { id: 'chi-sono', 'aria-label': 'Operi come' }, (CFG.persone || []).map(function (p) { return h('option', { value: p.nome }, p.nome + ' · ' + p.ruolo); }));
    chiSel.value = chi();
    chiSel.addEventListener('change', function () { scrivi(KEY_CHI, chiSel.value); toast('Ora operi come ' + chiSel.value + ': lo vedi nel registro modifiche.'); });
    G.side = h('aside', { class: 'side' },
      h('div', { class: 'brand' }, CFG.nome, h('small', CFG.sottotitolo || '')),
      G.nav,
      h('div', { class: 'ruolo' }, h('label', { for: 'chi-sono' }, 'Operi come (ruoli solo mostrati nella demo)'), chiSel));
    /* barra in alto */
    G.cercaIn = h('input', { type: 'search', id: 'cerca-globale', placeholder: 'Cerca ' + CFG.etichette.clienti.toLowerCase() + (CFG.cercaSegnaposto || '') + '…', 'aria-label': 'Ricerca globale', autocomplete: 'off', maxlength: '80' });
    G.cercaPop = h('div', { class: 'pop', hidden: true, role: 'listbox', 'aria-label': 'Risultati della ricerca' });
    G.cerca = h('div', { class: 'cerca', role: 'search' }, icona('cerca', 16), G.cercaIn, G.cercaPop);
    G.badge = h('span', { class: 'badge', hidden: true });
    G.campana = h('button', { class: 'ico', type: 'button', 'aria-label': 'Notifiche e scadenze', 'aria-expanded': 'false', on: { click: apriNotifiche } }, icona('campana'), G.badge);
    G.notifPop = h('div', { class: 'pop notif', hidden: true, role: 'dialog', 'aria-label': 'Notifiche' });
    var lente = h('button', { class: 'ico solo-m', type: 'button', 'aria-label': 'Apri la ricerca', on: { click: function () { G.top.classList.toggle('cerca-aperta'); if (G.top.classList.contains('cerca-aperta')) G.cercaIn.focus(); } } }, icona('cerca'));
    var tp = creaTastiPref();
    G.top = h('header', { class: 'top' }, h('div', { class: 'brand-m' }, CFG.nome), G.cerca, h('div', { class: 'spazio' }), lente, G.campana, tp[0], tp[1], G.notifPop);
    G.main = h('main', { id: 'vista', tabindex: '-1' });
    G.offline = h('div', { class: 'offline', role: 'status', hidden: true });
    root.textContent = '';
    root.appendChild(G.offline);
    root.appendChild(h('div', { class: 'app' }, G.side, G.top, G.main));
    /* ricerca */
    var tm = null;
    G.cercaIn.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(function () { mostraRicerca(G.cercaIn.value); }, 100); });
    G.cercaIn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { var f = G.cercaPop.querySelector('.res'); if (f) { e.preventDefault(); f.focus(); } }
      if (e.key === 'Enter') { var r = G.cercaPop.querySelector('.res'); if (r) { e.preventDefault(); r.click(); } }
      if (e.key === 'Escape') { G.cercaPop.hidden = true; }
    });
    G.cercaPop.addEventListener('keydown', function (e) {
      var l = [].slice.call(G.cercaPop.querySelectorAll('.res')), i = l.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < l.length - 1) { e.preventDefault(); l[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) l[i - 1].focus(); else G.cercaIn.focus(); }
      if (e.key === 'Escape') { G.cercaPop.hidden = true; G.cercaIn.focus(); }
    });
    if (guscio.fatto) return;
    guscio.fatto = true; // i gestori della pagina si registrano una volta sola
    document.addEventListener('mousedown', function (e) {
      if (!G.cerca) return;
      if (!G.cerca.contains(e.target)) G.cercaPop.hidden = true;
      if (!G.notifPop.contains(e.target) && !G.campana.contains(e.target)) { G.notifPop.hidden = true; G.campana.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (!G.top) return;
      if (e.key === '/' && !/input|textarea|select/i.test((e.target.tagName || '')) && !pila.length) { e.preventDefault(); G.top.classList.add('cerca-aperta'); G.cercaIn.focus(); }
      if (e.key === 'Escape' && !G.notifPop.hidden) { G.notifPop.hidden = true; G.campana.focus(); }
    });
    window.addEventListener('resize', function () { if (G.nav) posaIndicatore(false); });
  }
  function risultato(titolo, sotto, fn) {
    return h('button', { class: 'res', type: 'button', role: 'option', on: { click: function () { G.cercaPop.hidden = true; G.top.classList.remove('cerca-aperta'); G.cercaIn.value = ''; fn(); } } }, h('b', titolo), sotto ? h('span', sotto) : null);
  }
  function cerca(q) {
    var t = norm(q), gruppi = [];
    if (t.length < 2) return gruppi;
    var tn = telNorm(q);
    var cl = D.clienti.filter(function (c) {
      return norm(c.nome).indexOf(t) > -1 || norm(c.email).indexOf(t) > -1 || (tn.length >= 4 && telNorm(c.tel).indexOf(tn) > -1) || (CFG.campiCliente || []).some(function (f) { return f.cerca && norm(c[f.k]).indexOf(t) > -1; });
    }).slice(0, 6).map(function (c) { return { titolo: c.nome, sotto: [c.tel, c.email].filter(Boolean).join(' · '), vai: function () { vai('clienti', c.id); } }; });
    if (cl.length) gruppi.push({ nome: CFG.etichette.clienti, r: cl });
    if (CFG.cerca) (CFG.cerca(t, D) || []).forEach(function (g) { if (g.r.length) gruppi.push(g); });
    var ap = D.appuntamenti.filter(function (a) { return norm(a.titolo).indexOf(t) > -1 || norm(a.cliente ? nomeCliente(a.cliente) : a.nome).indexOf(t) > -1; })
      .sort(function (a, b) { return a.data < b.data ? 1 : -1; }).slice(0, 4)
      .map(function (a) { return { titolo: a.titolo, sotto: fmt(a.data) + ' ' + a.ora + ' · ' + (a.cliente ? nomeCliente(a.cliente) : a.nome || ''), vai: function () { stato.f.agData = a.data; stato.f.agVista = 'giorno'; vai('agenda'); } }; });
    if (ap.length) gruppi.push({ nome: 'Appuntamenti', r: ap });
    var doc = D.documenti.filter(function (d) { return norm(d.nome).indexOf(t) > -1 || norm(d.tipo).indexOf(t) > -1; }).slice(0, 4)
      .map(function (d) { return { titolo: d.nome, sotto: d.tipo + ' · ' + nomeCliente(d.cliente), vai: function () { stato.f.schedaTab = 'documenti'; vai('clienti', d.cliente); } }; });
    if (doc.length) gruppi.push({ nome: 'Documenti', r: doc });
    var mv = D.movimenti.filter(function (m) { return norm(m.descrizione).indexOf(t) > -1 || norm(m.categoria).indexOf(t) > -1; })
      .sort(function (a, b) { return a.data < b.data ? 1 : -1; }).slice(0, 4)
      .map(function (m) { return { titolo: (m.descrizione || m.categoria) + ' · ' + eur(m.importo), sotto: fmt(m.data) + ' · ' + (m.tipo === 'entrata' ? 'Entrata' : 'Uscita') + ' · ' + m.categoria, vai: function () { stato.f.bilTab = 'mov'; stato.f.movMese = m.data.slice(0, 7); vai('bilancio'); } }; });
    if (mv.length) gruppi.push({ nome: 'Movimenti', r: mv });
    return gruppi;
  }
  function mostraRicerca(q) {
    var g = cerca(q);
    G.cercaPop.textContent = '';
    if (norm(q).length < 2) { G.cercaPop.hidden = true; return; }
    if (!g.length) G.cercaPop.appendChild(h('div', { class: 'vuoto' }, 'Nessun risultato per «' + q.trim().slice(0, 40) + '».'));
    g.forEach(function (x) { G.cercaPop.appendChild(h('div', { class: 'grp' }, x.nome)); x.r.forEach(function (r) { G.cercaPop.appendChild(risultato(r.titolo, r.sotto, r.vai)); }); });
    G.cercaPop.hidden = false;
  }
  function apriNotifiche() {
    var aperto = !G.notifPop.hidden;
    G.notifPop.hidden = aperto; G.campana.setAttribute('aria-expanded', aperto ? 'false' : 'true');
    if (aperto) return;
    var n = notifiche(); G.notifPop.textContent = '';
    G.notifPop.appendChild(h('div', { class: 'grp', style: { fontSize: '13px', textTransform: 'none', letterSpacing: '0', color: 'var(--fg)' } }, 'Notifiche e scadenze'));
    if (!n.length) G.notifPop.appendChild(h('div', { class: 'vuoto' }, 'Niente di urgente. Le scadenze dei prossimi 7 giorni compaiono qui.'));
    var g = '';
    n.slice(0, 40).forEach(function (x) {
      if (x.gruppo !== g) { g = x.gruppo; G.notifPop.appendChild(h('div', { class: 'grp' }, g)); }
      G.notifPop.appendChild(h('button', { class: 'res', type: 'button', on: { click: function () { G.notifPop.hidden = true; if (x.vai) x.vai(); } } }, h('b', x.titolo), h('span', x.sotto || '')));
    });
    G.notifPop.appendChild(h('div', { style: { padding: '8px' } }, h('button', { class: 'btn sec sm', type: 'button', on: { click: function () { G.notifPop.hidden = true; vai('scadenze'); } } }, 'Tutte le scadenze')));
    var f = G.notifPop.querySelector('.res'); if (f) f.focus();
  }
  function aggiornaOffline() {
    if (!G.offline) return;
    var c = coda().length;
    G.offline.hidden = inRete() && !c;
    G.offline.textContent = !inRete()
      ? 'Sei senza rete. Quello che compili resta salvato come bozza su questo dispositivo' + (c ? ' (' + pl(c, 'bozza in attesa', 'bozze in attesa') + ')' : '') + ': lo registro appena la rete torna.'
      : (c ? pl(c, 'bozza in attesa', 'bozze in attesa') + ' di registrazione…' : '');
  }
  function posaIndicatore(anim) {
    if (!G.nav) return;
    var cur = G.nav.querySelector('[aria-current="page"]');
    if (!cur) return;
    if (!anim) G.ind.style.transition = 'none';
    G.ind.style.width = cur.offsetWidth + 'px'; G.ind.style.height = cur.offsetHeight + 'px';
    G.ind.style.transform = 'translate(' + cur.offsetLeft + 'px,' + cur.offsetTop + 'px)';
    if (!anim) { void G.ind.offsetWidth; G.ind.style.transition = ''; }
    if (mq('(max-width:820px)')) { var l = cur.offsetLeft - (G.nav.clientWidth - cur.offsetWidth) / 2; G.nav.scrollTo ? G.nav.scrollTo({ left: Math.max(0, l), behavior: anim && !menoMovimento() ? 'smooth' : 'auto' }) : (G.nav.scrollLeft = l); }
  }
  function disegnaNav() {
    var conta = { scadenze: scadenze().filter(function (x) { return diff(x.data) < 0; }).length };
    if (CFG.conteggi) { var c = CFG.conteggi(D) || {}; Object.keys(c).forEach(function (k) { conta[k] = c[k]; }); }
    G.nav.textContent = '';
    G.nav.appendChild(G.ind);
    sezioni().forEach(function (sz) {
      var b = h('button', { type: 'button', 'data-vai': sz.id, on: { click: function () { vai(sz.id); } } }, h('span', sz.titolo), conta[sz.id] ? h('span', { class: 'count', 'aria-label': conta[sz.id] + ' da guardare' }, String(conta[sz.id])) : null);
      if (sz.id === stato.vista) b.setAttribute('aria-current', 'page');
      G.nav.appendChild(b);
      if (sz.id === 'bilancio') G.nav.appendChild(h('div', { class: 'navsep', 'aria-hidden': 'true' }));
    });
    var urg = notifiche().filter(function (x) { return x.urg; }).length;
    G.badge.hidden = !urg; G.badge.textContent = urg > 99 ? '99+' : String(urg);
    G.campana.setAttribute('aria-label', 'Notifiche e scadenze' + (urg ? ': ' + urg + ' urgenti' : ''));
  }

  /* =========================================================
     11. Navigazione e disegno
     ========================================================= */
  function leggiHash() {
    var x = (location.hash || '').replace(/^#\/?/, '').split('/');
    var v = decodeURIComponent(x[0] || 'dash'), p = x[1] ? decodeURIComponent(x[1]) : null;
    return { vista: v, param: p };
  }
  function vai(vista, param) {
    chiudiTutte();
    var h2 = '#/' + encodeURIComponent(vista) + (param ? '/' + encodeURIComponent(param) : '');
    if (location.hash === h2) { render(true); return; }
    location.hash = h2;
  }
  var ultimaVista = '';
  function render(forza) {
    if (!D) return;
    var pagPub = (location.hash || '').replace(/^#/, '');
    if (CFG.paginePubbliche && CFG.paginePubbliche[pagPub]) { renderPubblica(pagPub); return; }
    if (!G.main) guscio();
    var hs = leggiHash();
    if (!trovaSezione(hs.vista)) hs = { vista: 'dash', param: null };
    var cambio = forza === true || hs.vista + '/' + hs.param !== ultimaVista;
    stato.vista = hs.vista; stato.param = hs.param;
    ultimaVista = hs.vista + '/' + hs.param;
    memo = {};
    disegnaNav();
    aggiornaOffline();
    var sx = window.scrollY;
    var contenuto;
    try { contenuto = disegnaVista(hs.vista, hs.param); }
    catch (e) { console.error(e); contenuto = h('div', { class: 'card' }, h('h2', 'Qualcosa non ha funzionato'), h('p', { class: 'sub' }, 'Questa sezione non si è aperta. Ricarica la pagina; se capita di nuovo, ripristina i dati demo da Impostazioni.')); }
    memo = null;
    G.main.textContent = '';
    G.main.appendChild(contenuto);
    if (cambio) {
      document.title = (trovaSezione(hs.vista).titolo) + ' · ' + CFG.nome;
      if (!menoMovimento()) { G.main.classList.remove('vista-entra'); void G.main.offsetWidth; G.main.classList.add('vista-entra'); clearTimeout(render.t); var mainEl = G.main; render.t = setTimeout(function () { mainEl.classList.remove('vista-entra'); }, 900); }
      window.scrollTo(0, 0);
    } else window.scrollTo(0, sx);
    requestAnimationFrame(function () { posaIndicatore(cambio); });
    if (!render.pronto && window.performance && performance.mark) { render.pronto = true; performance.mark('gestionale-pronto'); }
  }
  function renderPubblica(id) {
    G = {};
    var root = document.getElementById('app');
    root.textContent = '';
    root.appendChild(CFG.paginePubbliche[id](Base));
  }
  function disegnaVista(v, p) {
    var sz = trovaSezione(v);
    if (sz.render) return h('div', { class: 'view' }, sz.render(Base, p));
    var f = { dash: vDash, clienti: p ? vScheda : vClienti, agenda: vAgenda, scadenze: vScadenze, bilancio: vBilancio, documenti: vDocumenti, csv: vCsv, registro: vRegistro, imp: vImpostazioni }[v];
    return h('div', { class: 'view' }, f(p));
  }
  function intestazione(titolo, sotto, azioni) {
    return [h('h1', titolo), sotto ? h('p', { class: 'sub' }, sotto) : null, azioni && azioni.length ? h('div', { class: 'row' }, azioni) : null];
  }
  function btn(t, fn, cl, extra) { var a = { class: 'btn' + (cl ? ' ' + cl : ''), type: 'button', on: { click: fn } }; if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; }); return h('button', a, t); }
  function seg(opz, val, fn, aria) {
    return h('div', { class: 'seg', role: 'group', 'aria-label': aria || 'Vista' }, opz.map(function (o) {
      return h('button', { type: 'button', 'aria-pressed': String(o[0] === val), on: { click: function () { fn(o[0]); } } }, o[1]);
    }));
  }
  function selettore(opz, val, fn, aria, id) {
    var el = h('select', { 'aria-label': aria, id: id || null }, opz.map(function (o) { o = Array.isArray(o) ? o : [o, o]; return h('option', { value: o[0] }, o[1]); }));
    el.value = val == null ? '' : val;
    el.addEventListener('change', function () { fn(el.value); });
    return el;
  }

  /* ---------- Dashboard ---------- */
  function periodo(tipo) {
    var fine = OGGI, ini, pIni, pFine, aIni, aFine;
    if (tipo === 'trim') ini = new Date(OGGI.getFullYear(), Math.floor(OGGI.getMonth() / 3) * 3, 1);
    else if (tipo === 'anno') ini = new Date(OGGI.getFullYear(), 0, 1);
    else ini = new Date(OGGI.getFullYear(), OGGI.getMonth(), 1);
    var mesi = tipo === 'trim' ? 3 : (tipo === 'anno' ? 12 : 1);
    var span = Math.round((fine - ini) / 864e5);
    pIni = piuMesi(ini, -mesi); pFine = piuGiorni(pIni, span);
    var limiteP = piuGiorni(ini, -1); if (pFine > limiteP) pFine = limiteP;
    aIni = piuMesi(ini, -12); aFine = piuGiorni(aIni, span);
    return { ini: ini, fine: fine, pIni: pIni, pFine: pFine, aIni: aIni, aFine: aFine };
  }
  function haDatiDa(d) { return iso(d).slice(0, 7) >= primoMese(); }
  function vDash() {
    var og = iso(OGGI), k = chiaveMese(OGGI), kp = spostaMese(k, -1);
    var t = totaliMese(k), p = periodo('mese'), tp = totaliTra(p.pIni, p.pFine);
    var daInc = D.movimenti.filter(function (m) { return m.stato === 'aperto' && m.tipo === 'entrata'; }).reduce(function (a, m) { return a + m.importo; }, 0);
    var appOggi = D.appuntamenti.filter(function (a) { return a.data === og; }).sort(function (a, b) { return a.ora < b.ora ? -1 : 1; });
    var sc = scadenze(), scadute = sc.filter(function (x) { return diff(x.data) < 0; }), sett = sc.filter(function (x) { var n = diff(x.data); return n >= 0 && n <= 7; });
    var azOggi = D.azioni.filter(function (a) { return !a.fatto && a.data && a.data <= og; });
    var ora = new Date().getHours(), saluto = ora < 13 ? 'Buongiorno' : (ora < 18 ? 'Buon pomeriggio' : 'Buonasera');
    var rapide = [btn('Nuovo ' + CFG.etichette.cliente.toLowerCase(), function () { moduloCliente(null); }), btn('Nuovo appuntamento', function () { moduloAppuntamento(null, {}); }, 'sec'), btn('Nuovo movimento', function () { moduloMovimento(null); }, 'sec')];
    if (CFG.azioniRapide) rapide = rapide.slice(0, 1).concat(CFG.azioniRapide(Base)).concat(rapide.slice(1));
    var lista = function (arr, f, v) { return arr.length ? h('div', { class: 'list' }, arr.map(f)) : vuoto(v); };
    var itemScad = function (x) { return h('div', { class: 'item' }, h('div', { class: 't' }, h('button', { class: 'clink', type: 'button', on: { click: x.vai } }, x.tipo + ' · ' + x.titolo), h('span', (x.sotto || '') + ' · ' + fmt(x.data))), pillScad(x.data)); };
    var oggiCard = h('div', { class: 'card mb' },
      h('h2', 'Oggi'),
      h('div', { class: 'grid g3' },
        h('div', h('div', { class: 'subh' }, 'Appuntamenti (' + appOggi.length + ')'), lista(appOggi.slice(0, 5), function (a) {
          return h('div', { class: 'item' }, h('div', { class: 't' }, h('button', { class: 'clink', type: 'button', on: { click: function () { moduloAppuntamento(a, {}); } } }, a.ora + ' · ' + a.titolo), h('span', (a.cliente ? nomeCliente(a.cliente) : (a.nome || 'Senza nome')) + (a.op ? ' · ' + a.op : ''))));
        }, 'Nessun appuntamento oggi')),
        h('div', h('div', { class: 'subh' }, 'Scadute (' + scadute.length + ')'), lista(scadute.slice(0, 3), itemScad, 'Nessuna scadenza scaduta'),
          h('div', { class: 'subh' }, 'Nei prossimi 7 giorni (' + sett.length + ')'), lista(sett.slice(0, 3), itemScad, 'Nessuna scadenza vicina')),
        h('div', h('div', { class: 'subh' }, 'Prossime azioni per oggi (' + azOggi.length + ')'), lista(azOggi.slice(0, 5), function (a) {
          return h('div', { class: 'item' }, h('div', { class: 't' }, h('button', { class: 'clink', type: 'button', on: { click: function () { vai('clienti', a.cliente); } } }, a.testo), h('span', nomeCliente(a.cliente) + ' · ' + fmt(a.data))), pillScad(a.data));
        }, 'Nessuna azione in sospeso'))),
      (scadute.length > 3 || sett.length > 3) ? h('div', { style: { marginTop: '10px' } }, btn('Tutte le scadenze', function () { vai('scadenze'); }, 'sec sm')) : null);
    var k12 = mesiTra(spostaMese(k, -11), k), pm = primoMese();
    var serieE = k12.map(function (x) { return x < pm ? 0 : totaliMese(x).entrate; }), serieU = k12.map(function (x) { return x < pm ? 0 : totaliMese(x).uscite; });
    var grafico = grafColonne(k12.map(function (x) { return meseCorto(x) + (x === k ? '*' : ''); }), [
      { nome: 'Entrate', vals: serieE, tips: k12.map(function (x, i) { return meseLabel(x) + ': entrate ' + eur(serieE[i]) + (x === k ? ' (mese in corso)' : ''); }) },
      { nome: 'Uscite', vals: serieU, tips: k12.map(function (x, i) { return meseLabel(x) + ': uscite ' + eur(serieU[i]) + (x === k ? ' (mese in corso)' : ''); }) }
    ], { soldi: true, aria: 'Entrate e uscite degli ultimi 12 mesi' });
    var cat = {}; D.movimenti.forEach(function (m) { if (pagato(m) && m.tipo === 'entrata' && m.data.slice(0, 7) === k) cat[m.categoria] = (cat[m.categoria] || 0) + m.importo; });
    var catR = Object.keys(cat).map(function (c) { return { l: c, v: cat[c], vt: eur(cat[c]) }; }).sort(function (a, b) { return b.v - a.v; });
    var out = [
      intestazione(saluto, cap(fmtL(OGGI)), rapide),
      oggiCard,
      h('div', { class: 'grid g4 mb' },
        kpi({ n: t.entrate, l: 'Entrate di ' + meseLabel(k) + ' (fino a oggi)', soldi: true, delta: delta(t.entrate, haDatiDa(p.pIni) ? tp.entrate : null), vai: function () { stato.f.bilMese = k; stato.f.bilTab = 'mese'; vai('bilancio'); } }),
        kpi({ n: t.uscite, l: 'Uscite del mese', soldi: true, delta: delta(t.uscite, haDatiDa(p.pIni) ? tp.uscite : null, true), vai: function () { stato.f.bilMese = k; stato.f.bilTab = 'mese'; vai('bilancio'); } }),
        kpi({ n: t.margine, l: 'Margine del mese', soldi: true, col: t.margine < 0 ? 'bad' : '', delta: deltaEuro(t.margine, haDatiDa(p.pIni) ? tp.margine : null) }),
        kpi({ n: daInc, l: 'Da incassare', soldi: true, col: daInc ? 'warn' : '', vai: function () { stato.f.bilTab = 'mov'; stato.f.movStato = 'aperto'; vai('bilancio'); } }),
        kpi({ n: appOggi.length, l: appOggi.length === 1 ? 'Appuntamento oggi' : 'Appuntamenti oggi', vai: function () { stato.f.agVista = 'giorno'; stato.f.agData = og; vai('agenda'); } }),
        kpi({ n: scadute.length, l: scadute.length === 1 ? 'Scadenza scaduta' : 'Scadenze scadute', col: scadute.length ? 'bad' : '', vai: function () { stato.f.scFiltro = 'scadute'; vai('scadenze'); } })
      ),
      h('p', { class: 'hint', style: { margin: '-6px 0 14px' } }, 'Le percentuali confrontano ' + fmt(p.ini) + ' – ' + fmt(p.fine) + ' con lo stesso numero di giorni del mese prima (' + fmt(p.pIni) + ' – ' + fmt(p.pFine) + '), per un confronto onesto.'),
      CFG.kpi ? h('div', { class: 'grid g4 mb' }, CFG.kpi(Base).map(kpi)) : null,
      h('div', { class: 'grid g2 mb' },
        h('div', { class: 'card' }, h('h2', 'Entrate e uscite, ultimi 12 mesi'), grafico, h('p', { class: 'hint', style: { margin: '8px 0 0' } }, '* mese in corso: numeri parziali fino a oggi. Tocca una colonna per il valore.')),
        confrontoCard()),
      h('div', { class: 'grid g2' },
        h('div', { class: 'card' }, h('h2', 'Entrate del mese per servizio'), barre(catR, { vuoto: 'Nessuna entrata registrata questo mese' })),
        CFG.dashboard ? CFG.dashboard(Base) : null)
    ];
    return out;
  }
  function confrontoCard() {
    var tipo = stato.f.confr || 'mese', p = periodo(tipo);
    var a = totaliTra(p.ini, p.fine), b = haDatiDa(p.pIni) ? totaliTra(p.pIni, p.pFine) : null, c = haDatiDa(p.aIni) ? totaliTra(p.aIni, p.aFine) : null;
    var riga = function (l, k, inv) {
      var dd = k === 'margine' ? deltaEuro : delta;
      return h('tr', h('td', l), h('td', { class: 'num' }, eur(a[k])), h('td', { class: 'num' }, b ? eur(b[k]) : '—'), h('td', { class: 'num' }, dd(a[k], b ? b[k] : null, inv)), h('td', { class: 'num' }, c ? eur(c[k]) : '—'), h('td', { class: 'num' }, dd(a[k], c ? c[k] : null, inv)));
    };
    return h('div', { class: 'card' }, h('h2', 'Confronto tra periodi'),
      h('div', { class: 'row' }, seg([['mese', 'Mese'], ['trim', 'Trimestre'], ['anno', 'Anno']], tipo, function (v) { stato.f.confr = v; render(); }, 'Periodo da confrontare')),
      h('div', { class: 'confronto-schede solo-stretto' }, [['Entrate', 'entrate'], ['Uscite', 'uscite'], ['Margine', 'margine']].map(function (v) {
        var k = v[1], riga2 = function (l, x) { return h('div', { class: 'item' }, h('div', { class: 't' }, h('b', l), h('span', x ? eur(x[k]) : 'nessun dato')), x ? deltaEuro(a[k], x[k], k === 'uscite') : null); };
        return h('div', { class: 'cfs' }, h('div', { class: 'cfs-t' }, h('b', v[0]), h('b', eur(a[k]))), riga2('Periodo prima', b), riga2('Anno prima', c));
      })),
      h('div', { class: 'tablewrap solo-largo' }, h('table', { style: { minWidth: '520px' } },
        h('thead', h('tr', h('th', ''), h('th', { class: 'num' }, 'Adesso'), h('th', { class: 'num' }, 'Periodo prima'), h('th', { class: 'num' }, 'Diff.'), h('th', { class: 'num' }, 'Anno prima'), h('th', { class: 'num' }, 'Diff.'))),
        h('tbody', riga('Entrate', 'entrate'), riga('Uscite', 'uscite', true), riga('Margine', 'margine')))),
      h('p', { class: 'hint', style: { margin: '8px 0 0' } }, 'Adesso: ' + fmt(p.ini) + ' – ' + fmt(p.fine) + '. Periodo prima: ' + fmt(p.pIni) + ' – ' + fmt(p.pFine) + '. Anno prima: ' + fmt(p.aIni) + ' – ' + fmt(p.aFine) + '. Contano solo i movimenti pagati.'));
  }

  /* ---------- Clienti (CRM) ---------- */
  function campiCliente() {
    return [{ k: 'nome', l: 'Nome e cognome', obbl: true, max: 80 }]
      .concat(CFG.campiCliente || [])
      .concat([{ k: 'tel', l: 'Telefono', tipo: 'tel', max: 25 }, { k: 'email', l: 'Email', tipo: 'email', max: 120 }, { k: 'note', l: 'Note', tipo: 'textarea', max: 1000 }]);
  }
  function chiaviDup(c) {
    var k = [];
    if (c.email) k.push('e:' + norm(c.email));
    if (c.tel && telNorm(c.tel).length >= 6) k.push('t:' + telNorm(c.tel));
    (CFG.campiCliente || []).forEach(function (f) { if (f.unico && c[f.k]) k.push(f.k + ':' + norm(c[f.k])); });
    if (c.nome) k.push('n:' + norm(c.nome).replace(/\s+/g, ' '));
    return k;
  }
  function trovaDuplicato(c, escludi) {
    var kk = chiaviDup(c);
    for (var i = 0; i < D.clienti.length; i++) {
      var x = D.clienti[i]; if (x.id === escludi) continue;
      var kx = chiaviDup(x);
      if (kk.some(function (k) { return kx.indexOf(k) > -1; })) return x;
    }
    return null;
  }
  azione('cliente.salva', function (v, ctx) {
    var c = ctx && ctx.id ? cliente(ctx.id) : null;
    if (ctx && ctx.id && !c) return { errore: 'Questa scheda non esiste più.' };
    var nuovo = !c;
    if (nuovo) { c = { id: nuovoId('c'), creato: iso(OGGI) }; D.clienti.push(c); }
    var cambi = [];
    campiCliente().forEach(function (f) { if (!nuovo && String(c[f.k] || '') !== String(v[f.k] || '')) cambi.push(f.l); c[f.k] = v[f.k]; });
    registra(nuovo ? CFG.etichette.cliente + ' creato' : 'Scheda modificata', c.nome, nuovo ? '' : (cambi.join(', ') || 'Nessun campo cambiato'));
    return { id: c.id };
  });
  function moduloCliente(c, dopo) {
    return modulo({
      titolo: c ? 'Modifica ' + c.nome : 'Nuovo ' + CFG.etichette.cliente.toLowerCase(), id: 'cliente-' + (c ? c.id : 'nuovo'), azione: 'cliente.salva', contesto: { id: c ? c.id : null },
      campi: campiCliente(), valori: c || {}, toast: c ? 'Scheda aggiornata' : CFG.etichette.cliente + ' creato',
      avvisi: function (v, ctx) { var d = trovaDuplicato(v, ctx.id); return d ? ['Sembra già presente: ' + d.nome + (d.tel ? ' (' + d.tel + ')' : '') + '. Controlla di non creare un doppione.'] : []; },
      dopo: function (r) { if (dopo) dopo(r); else if (!c && r && r.id) vai('clienti', r.id); }
    });
  }
  function vClienti() {
    var q = stato.f.clQ || '', fil = stato.f.clF || '';
    var t = norm(q), og = iso(OGGI);
    var ult = {}; attivita().forEach(function (a) { if (a.data <= og && (!ult[a.cliente] || a.data > ult[a.cliente])) ult[a.cliente] = a.data; });
    var prox = {}; D.azioni.forEach(function (a) { if (!a.fatto && (!prox[a.cliente] || (a.data || '9') < (prox[a.cliente].data || '9'))) prox[a.cliente] = a; });
    var soglia = CFG.sogliaPersiGiorni || 365;
    var righe = D.clienti.filter(function (c) {
      if (t && !(norm(c.nome).indexOf(t) > -1 || norm(c.email).indexOf(t) > -1 || telNorm(c.tel).indexOf(telNorm(q) || '#') > -1 || (CFG.campiCliente || []).some(function (f) { return f.cerca && norm(c[f.k]).indexOf(t) > -1; }))) return false;
      if (fil === 'azioni') return !!prox[c.id];
      if (fil === 'persi') return !ult[c.id] || diff(ult[c.id]) < -soglia;
      return true;
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'it'); });
    var input = h('input', { type: 'search', placeholder: 'Filtra per nome, telefono, email…', 'aria-label': 'Filtra l\'elenco', value: q, maxlength: '80' });
    input.addEventListener('input', function () { stato.f.clQ = input.value; var pos = input.selectionStart; render(); var n = G.main.querySelector('input[type=search]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } });
    var col = [
      { t: 'Nome', v: function (c) { return h('b', c.nome); } },
      { t: 'Telefono', v: function (c) { return c.tel; } },
      { t: 'Email', v: function (c) { return c.email; } },
      { t: 'Ultimo contatto', v: function (c) { return ult[c.id] ? fmt(ult[c.id]) : 'mai'; } },
      { t: 'Prossima azione', v: function (c) { var a = prox[c.id]; return a ? h('span', a.testo + (a.data ? ' · ' : ''), a.data ? pillScad(a.data) : null) : ''; } }
    ].concat((CFG.colonneCliente || []).map(function (x) { return { t: x.t, v: function (c) { return x.v(c, Base); } }; }));
    return [
      intestazione(CFG.etichette.clienti, 'L\'archivio centrale: ogni sezione legge da qui. Tocca una riga per la scheda completa.',
        [btn('Nuovo ' + CFG.etichette.cliente.toLowerCase(), function () { moduloCliente(null); }), btn('Importa da CSV', function () { vai('csv'); }, 'sec'), btn('Esporta CSV', esportaClienti, 'sec')]),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, input),
        seg([['', 'Tutti (' + D.clienti.length + ')'], ['azioni', 'Con azioni da fare'], ['persi', 'Non tornano da ' + Math.round(soglia / 30) + ' mesi']], fil, function (v) { stato.f.clF = v; render(); }, 'Filtro')),
      tabella(col, righe, { apri: function (c) { vai('clienti', c.id); }, vuoto: q ? 'Nessun risultato' : 'Nessun ' + CFG.etichette.cliente.toLowerCase(), vuotoD: q ? 'Prova con meno lettere.' : 'Crea il primo o importa un CSV.' })
    ];
  }
  function esportaClienti() {
    var f = campiCliente();
    esportaCsv(CFG.etichette.clienti, f.map(function (x) { return x.l; }).concat(['Creato il']), D.clienti.map(function (c) { return f.map(function (x) { return c[x.k] || ''; }).concat([c.creato || '']); }));
  }
  azione('contatto.salva', function (v, ctx) {
    if (!cliente(ctx.cliente)) return { errore: 'Scheda non trovata.' };
    var q = v.data ? new Date(v.data + 'T' + (v.ora || '12:00') + ':00') : new Date();
    D.contatti.push({ id: nuovoId('k'), cliente: ctx.cliente, q: q.toISOString(), tipo: v.tipo, testo: v.testo, chi: chi() });
    registra('Contatto registrato', nomeCliente(ctx.cliente), v.tipo);
    return {};
  });
  var TIPI_CONTATTO = ['Chiamata', 'Messaggio', 'Email', 'Incontro allo sportello', 'Nota'];
  function moduloContatto(idc) {
    var n = new Date();
    return modulo({ titolo: 'Registra un contatto · ' + nomeCliente(idc), id: 'contatto-' + idc, azione: 'contatto.salva', contesto: { cliente: idc }, toast: 'Contatto registrato nello storico',
      campi: [{ k: 'tipo', l: 'Tipo', tipo: 'select', opzioni: TIPI_CONTATTO, obbl: true }, { k: 'data', l: 'Giorno', tipo: 'date', obbl: true, valida: function (v) { return v > iso(OGGI) ? 'Il contatto non può essere nel futuro: per il futuro usa una prossima azione.' : ''; } }, { k: 'ora', l: 'Ora', tipo: 'time', obbl: true }, { k: 'testo', l: 'Cosa vi siete detti', tipo: 'textarea', obbl: true, max: 1500 }],
      valori: { tipo: 'Chiamata', data: iso(n), ora: pad(n.getHours()) + ':' + pad(n.getMinutes()) } });
  }
  azione('azione.salva', function (v, ctx) {
    if (!cliente(ctx.cliente)) return { errore: 'Scheda non trovata.' };
    D.azioni.push({ id: nuovoId('a'), cliente: ctx.cliente, data: v.data, testo: v.testo, fatto: false, creato: iso(OGGI) });
    registra('Prossima azione aggiunta', nomeCliente(ctx.cliente), v.testo + ' · ' + fmt(v.data));
    return {};
  });
  function moduloAzione(idc) {
    return modulo({ titolo: 'Prossima azione · ' + nomeCliente(idc), id: 'azione-' + idc, azione: 'azione.salva', contesto: { cliente: idc }, toast: 'Prossima azione aggiunta',
      campi: [{ k: 'testo', l: 'Cosa fare', obbl: true, max: 160, segnaposto: 'es. Richiamare per il documento mancante' }, { k: 'data', l: 'Entro il', tipo: 'date', obbl: true }],
      valori: { data: iso(giorni(1)) } });
  }
  function vScheda(id) {
    var c = cliente(id);
    if (!c) return [h('button', { class: 'back', type: 'button', on: { click: function () { vai('clienti'); } } }, '‹ ' + CFG.etichette.clienti), h('div', { class: 'card' }, vuoto('Scheda non trovata', 'Forse è stata eliminata.'))];
    var tabs = [['riep', 'Riepilogo'], ['storico', 'Storico'], ['documenti', 'Documenti']].concat((CFG.schedeCliente || []).map(function (x) { return [x.id, x.titolo]; }));
    var tab = stato.f.schedaTab && tabs.some(function (x) { return x[0] === stato.f.schedaTab; }) ? stato.f.schedaTab : 'riep';
    var corpo;
    if (tab === 'riep') corpo = schedaRiepilogo(c);
    else if (tab === 'storico') corpo = h('div', { class: 'card' }, storicoCliente(c));
    else if (tab === 'documenti') corpo = documentiCliente(c);
    else corpo = (CFG.schedeCliente.filter(function (x) { return x.id === tab; })[0]).render(c, Base);
    return [
      h('button', { class: 'back', type: 'button', on: { click: function () { stato.f.schedaTab = ''; vai('clienti'); } } }, '‹ ' + CFG.etichette.clienti),
      h('h1', c.nome),
      h('p', { class: 'sub' }, recapiti(c)),
      h('div', { class: 'row' },
        btn('Registra contatto', function () { moduloContatto(c.id); }),
        btn('Prossima azione', function () { moduloAzione(c.id); }, 'sec'),
        btn('Appuntamento', function () { moduloAppuntamento(null, { cliente: c.id }); }, 'sec'),
        btn('Modifica', function () { moduloCliente(c); }, 'sec'),
        btn('Elimina', function () { eliminaCliente(c); }, 'no')),
      h('div', { class: 'tabs', role: 'tablist' }, tabs.map(function (x) {
        return h('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(x[0] === tab), on: { click: function () { stato.f.schedaTab = x[0]; render(); } } }, x[1]);
      })),
      corpo
    ];
  }
  /* recapiti cliccabili: tel e mailto con prefisso fisso, numero solo in cifre */
  function recapiti(c) {
    var r = [];
    if (c.tel) r.push(h('a', { href: 'tel:' + String(c.tel).replace(/[^\d+]/g, ''), 'aria-label': 'Chiama ' + c.tel }, c.tel));
    if (c.email && emailOk(c.email)) r.push(h('a', { href: 'mailto:' + c.email }, c.email));
    if (!r.length) return 'Nessun recapito';
    return r.map(function (x, i) { return [i ? ' · ' : '', x]; });
  }
  function schedaRiepilogo(c) {
    var az = D.azioni.filter(function (a) { return a.cliente === c.id; }).sort(function (a, b) { return (a.fatto - b.fatto) || ((a.data || '') < (b.data || '') ? -1 : 1); });
    var ua = ultimaAttivita(c.id);
    var dati = campiCliente().filter(function (f) { return f.k !== 'nome'; });
    return h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', 'Dati'), h('dl', { class: 'kv' }, dati.map(function (f) { var v = c[f.k]; if (f.tipo === 'date' && v) v = fmt(v); return [h('dt', f.l), h('dd', v || '—')]; }),
        h('dt', 'In archivio dal'), h('dd', fmt(c.creato)), h('dt', 'Ultimo contatto'), h('dd', ua ? fmt(ua) : 'mai'))),
      h('div', { class: 'card' }, h('h2', 'Prossime azioni'),
        az.length ? h('div', { class: 'list' }, az.map(function (a) {
          var cb = h('input', { type: 'checkbox', checked: a.fatto, 'aria-label': 'Fatto: ' + a.testo });
          cb.addEventListener('change', function () { a.fatto = cb.checked; registra(cb.checked ? 'Azione completata' : 'Azione riaperta', c.nome, a.testo); salva(); render(); });
          return h('div', { class: 'item' }, h('label', { class: 'check', style: { borderBottom: '0', padding: '0', flex: '1 1 auto', minWidth: '0' } }, cb,
            h('span', { class: 't' }, h('b', { style: a.fatto ? { textDecoration: 'line-through', color: 'var(--muted)' } : null }, a.testo), h('span', a.data ? 'Entro il ' + fmt(a.data) : ''))),
            a.fatto ? pill('Fatta', 'ok') : (a.data ? pillScad(a.data) : null),
            h('button', { class: 'btn sm sec', type: 'button', 'aria-label': 'Elimina l\'azione ' + a.testo, on: { click: function () { conferma('Eliminare l\'azione?', a.testo, 'Elimina', function () { D.azioni = D.azioni.filter(function (x) { return x !== a; }); registra('Azione eliminata', c.nome, a.testo); salva(); render(); }, true); } } }, 'Elimina'));
        })) : vuoto('Nessuna prossima azione', 'Aggiungine una per non dimenticare niente.'),
        h('div', { style: { marginTop: '10px' } }, btn('Aggiungi azione', function () { moduloAzione(c.id); }, 'sec sm'))),
      h('div', { class: 'card', style: { gridColumn: '1 / -1' } }, h('h2', 'Ultimi eventi'), storicoCliente(c, 5)));
  }
  function storicoCliente(c, max) {
    var ev = [];
    D.contatti.forEach(function (k) { if (k.cliente === c.id) ev.push({ q: k.q, t: k.tipo, x: k.testo, chi: k.chi }); });
    D.appuntamenti.forEach(function (a) { if (a.cliente === c.id) ev.push({ q: a.data + 'T' + a.ora + ':00', t: 'Appuntamento' + (a.data > iso(OGGI) ? ' (in programma)' : ''), x: a.titolo, chi: a.op }); });
    D.movimenti.forEach(function (m) { if (m.cliente === c.id) ev.push({ q: m.data + 'T12:00:00', t: (m.tipo === 'entrata' ? (pagato(m) ? 'Incasso' : 'Da incassare') : 'Uscita') + ' · ' + eur(m.importo), x: m.descrizione || m.categoria }); });
    D.documenti.forEach(function (d) { if (d.cliente === c.id) ev.push({ q: d.data + 'T09:00:00', t: 'Documento aggiunto', x: d.nome + ' · ' + d.tipo }); });
    if (CFG.storicoCliente) ev = ev.concat(CFG.storicoCliente(c, D) || []);
    ev.sort(function (a, b) { return a.q < b.q ? 1 : -1; });
    if (max) ev = ev.slice(0, max);
    if (!ev.length) return vuoto('Ancora nessun evento', 'Chiamate, messaggi, appuntamenti e pagamenti compariranno qui.');
    return h('div', { class: 'tl' }, ev.map(function (e) {
      return h('div', { class: 'ev' }, h('small', fmtDT(e.q) + (e.chi ? ' · ' + e.chi : '')), h('b', e.t), e.x ? h('p', e.x) : null);
    }));
  }
  function eliminaCliente(c) {
    var blocco = CFG.puoEliminareCliente ? CFG.puoEliminareCliente(c, D) : '';
    if (blocco) { toast(blocco, true); return; }
    var nm = D.movimenti.filter(function (m) { return m.cliente === c.id; }).length;
    conferma('Eliminare ' + c.nome + '?', 'Si cancellano scheda, contatti, prossime azioni, appuntamenti e documenti.' + (nm ? ' I ' + nm + ' movimenti restano nel bilancio, senza nome.' : '') + ' Nella versione vera si rispettano gli obblighi di conservazione.', 'Elimina', function () {
      D.clienti = D.clienti.filter(function (x) { return x.id !== c.id; });
      D.contatti = D.contatti.filter(function (x) { return x.cliente !== c.id; });
      D.azioni = D.azioni.filter(function (x) { return x.cliente !== c.id; });
      D.appuntamenti = D.appuntamenti.filter(function (x) { return x.cliente !== c.id; });
      D.documenti = D.documenti.filter(function (x) { return x.cliente !== c.id; });
      D.movimenti.forEach(function (m) { if (m.cliente === c.id) m.cliente = null; });
      if (CFG.dopoEliminaCliente) CFG.dopoEliminaCliente(c, D);
      registra(CFG.etichette.cliente + ' eliminato', c.nome, '');
      salva(); toast('Scheda eliminata'); vai('clienti');
    }, true);
  }

  /* ---------- Documenti ---------- */
  var MAX_FILE = 400 * 1024;
  var TIPI_FILE = /\.(pdf|jpe?g|png|txt|csv|docx?|xlsx?|odt)$/i;
  function tipiDocumento() { return CFG.tipiDocumento || ['Contratto', 'Fattura', 'Documento d\'identità', 'Delega', 'Altro']; }
  function caricaDocumento(idc, tipoDoc, file, fatto) {
    if (!file) return;
    if (!TIPI_FILE.test(file.name)) { toast('Tipo di file non ammesso: PDF, immagini, testo, Word o Excel.', true); return; }
    if (file.size > MAX_FILE) { toast('File troppo grande per la demo: massimo 400 KB (nella versione vera fino a 20 MB, cifrati).', true); return; }
    var r = new FileReader();
    r.onload = function () {
      var d = { id: nuovoId('d'), cliente: idc, nome: nomeFile(file.name), tipo: tipoDoc, dim: file.size, data: iso(OGGI), contenuto: String(r.result), chi: chi() };
      D.documenti.push(d);
      registra('Documento caricato', nomeCliente(idc), d.nome + ' · ' + d.tipo);
      if (!salva()) { D.documenti.pop(); D.registro.pop(); toast('Spazio del browser pieno: il documento non è stato salvato.', true); return; }
      toast('Documento allegato alla scheda'); if (fatto) fatto(); render();
    };
    r.onerror = function () { toast('Lettura del file non riuscita.', true); };
    r.readAsDataURL(file);
  }
  function scaricaDocumento(d) {
    var blob;
    if (d.contenuto && /^data:[^,]*;base64,/.test(d.contenuto)) {
      var b = atob(d.contenuto.split(',')[1]), u = new Uint8Array(b.length);
      for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      blob = new Blob([u], { type: 'application/octet-stream' }); // sempre scaricato, mai aperto nella pagina
    } else blob = new Blob(['Documento di esempio della demo: «' + d.nome + '». Nessun contenuto reale.'], { type: 'text/plain;charset=utf-8' });
    var nome = d.contenuto ? d.nome : d.nome.replace(/\.[a-z0-9]+$/i, '') + '-esempio.txt';
    if (scarica(nome, blob)) { registra('Documento scaricato', nomeCliente(d.cliente), d.nome); salva(); }
  }
  function eliminaDocumento(d) {
    conferma('Eliminare il documento?', d.nome + ' · ' + nomeCliente(d.cliente), 'Elimina', function () {
      D.documenti = D.documenti.filter(function (x) { return x.id !== d.id; });
      registra('Documento eliminato', nomeCliente(d.cliente), d.nome); salva(); toast('Documento eliminato'); render();
    }, true);
  }
  function pannelloCarica(idcFisso) {
    var selC = idcFisso ? null : h('select', { 'aria-label': 'Scegli a chi allegarlo' }, opzioniClienti('Scegli ' + CFG.etichette.cliente.toLowerCase() + '…').map(function (o) { return h('option', { value: o[0] }, o[1]); }));
    var selT = h('select', { 'aria-label': 'Tipo di documento' }, tipiDocumento().map(function (t) { return h('option', { value: t }, t); }));
    var file = h('input', { type: 'file', accept: '.pdf,.jpg,.jpeg,.png,.txt,.csv,.doc,.docx,.xls,.xlsx,.odt', 'aria-label': 'Scegli il file' });
    file.addEventListener('change', function () {
      var idc = idcFisso || selC.value;
      if (!idc) { toast('Prima scegli a chi allegare il documento.', true); file.value = ''; return; }
      caricaDocumento(idc, selT.value, file.files[0], function () { file.value = ''; });
    });
    return h('div', { class: 'card mb' }, h('h2', 'Allega un documento'),
      h('div', { class: 'row', style: { marginBottom: '6px' } }, selC, selT, file),
      h('p', { class: 'hint', style: { margin: 0 } }, 'Demo: il file resta solo in questo browser, massimo 400 KB. Si scarica sempre, non si apre nella pagina.'));
  }
  function righeDocumenti(lista, conNome) {
    var col = [{ t: 'Documento', v: function (d) { return h('b', d.nome); } }];
    if (conNome) col.push({ t: CFG.etichette.cliente, v: function (d) { return h('button', { class: 'clink', type: 'button', on: { click: function () { stato.f.schedaTab = 'documenti'; vai('clienti', d.cliente); } } }, nomeCliente(d.cliente)); } });
    col = col.concat([
      { t: 'Tipo', v: function (d) { return d.tipo; } },
      { t: 'Data', v: function (d) { return fmt(d.data); } },
      { t: 'Dimensione', v: function (d) { return d.contenuto ? Math.max(1, Math.round(d.dim / 1024)) + ' KB' : 'esempio'; } },
      { t: 'Azioni', v: function (d) { return h('span', { class: 'acts' }, btn('Scarica', function () { scaricaDocumento(d); }, 'sec sm', { 'aria-label': 'Scarica ' + d.nome }), ' ', btn('Elimina', function () { eliminaDocumento(d); }, 'no sm', { 'aria-label': 'Elimina ' + d.nome })); } }
    ]);
    return tabella(col, lista, { vuoto: 'Nessun documento', vuotoD: 'Contratti, fatture e PDF allegati compaiono qui.' });
  }
  function documentiCliente(c) {
    return h('div', pannelloCarica(c.id), righeDocumenti(D.documenti.filter(function (d) { return d.cliente === c.id; }).sort(function (a, b) { return a.data < b.data ? 1 : -1; }), false));
  }
  function vDocumenti() {
    var ft = stato.f.docT || '';
    var lista = D.documenti.filter(function (d) { return !ft || d.tipo === ft; }).sort(function (a, b) { return a.data < b.data ? 1 : -1; });
    var usati = 0; D.documenti.forEach(function (d) { usati += d.contenuto ? d.contenuto.length : 0; });
    return [intestazione('Documenti', 'Tutti i documenti allegati alle schede: contratti, fatture, deleghe e PDF.'),
      pannelloCarica(null),
      h('div', { class: 'row' }, selettore([['', 'Tutti i tipi']].concat(tipiDocumento()), ft, function (v) { stato.f.docT = v; render(); }, 'Filtra per tipo'), h('span', { class: 'hint' }, pl(lista.length, 'documento', 'documenti') + ' · file caricati: ' + Math.round(usati / 1024) + ' KB')),
      righeDocumenti(lista, true)];
  }

  /* ---------- Agenda ---------- */
  function orari() { return CFG.orari || { aperto: [1, 2, 3, 4, 5], fasce: [['09:00', '13:00'], ['15:00', '19:00']], inizio: '08:00', fine: '20:00', passo: 30 }; }
  function giornoChiuso(d) { var f = festivo(d); if (f) return f; return orari().aperto.indexOf(d.getDay()) < 0 ? (d.getDay() === 0 ? 'domenica' : (d.getDay() === 6 ? 'sabato' : 'chiuso')) : ''; }
  function fuoriOrario(ora, dur) { var a = minuti(ora), b = a + dur; return !orari().fasce.some(function (f) { return a >= minuti(f[0]) && b <= minuti(f[1]); }); }
  function fasceTxt() { return orari().fasce.map(function (f) { return f[0] + '–' + f[1]; }).join(' e '); }
  function operatori() { return (CFG.persone || []).filter(function (p) { return p.agenda; }).map(function (p) { return p.nome; }); }
  function avvisiAppuntamento(v, ctx) {
    var w = [], d = pIso(v.data); if (!d) return w;
    var ch = giornoChiuso(d);
    if (ch) w.push('Il ' + fmt(d) + ' è ' + (festivo(d) ? 'festivo (' + ch + ')' : ch) + ': l\'attività è chiusa.');
    else if (fuoriOrario(v.ora, +v.durata)) w.push('L\'orario ' + v.ora + ' (' + v.durata + ' minuti) è fuori dall\'apertura (' + fasceTxt() + ').');
    if (new Date(v.data + 'T' + v.ora + ':00') < new Date()) w.push('L\'appuntamento è già passato.');
    var a0 = minuti(v.ora), a1 = a0 + (+v.durata);
    D.appuntamenti.forEach(function (x) {
      if (ctx && x.id === ctx.id) return;
      if (x.data !== v.data || !x.op || x.op !== v.op) return;
      var b0 = minuti(x.ora), b1 = b0 + (+x.durata || 30);
      if (a0 < b1 && b0 < a1) w.push(v.op + ' ha già «' + x.titolo + '» dalle ' + x.ora + ' alle ' + hm(b1) + '.');
    });
    return w;
  }
  azione('appuntamento.salva', function (v, ctx) {
    var a = ctx && ctx.id ? D.appuntamenti.filter(function (x) { return x.id === ctx.id; })[0] : null;
    if (ctx && ctx.id && !a) return { errore: 'Questo appuntamento non esiste più.' };
    var nuovo = !a;
    if (v.cliente && !cliente(v.cliente)) return { campo: { cliente: 'Scheda non trovata.' } };
    if (nuovo) { a = { id: nuovoId('p') }; D.appuntamenti.push(a); }
    a.cliente = v.cliente || null; a.nome = v.cliente ? '' : v.nome; a.titolo = v.titolo; a.data = v.data; a.ora = v.ora; a.durata = +v.durata; a.op = v.op; a.note = v.note;
    if (ctx && ctx.rif) a.rif = ctx.rif;
    registra(nuovo ? 'Appuntamento creato' : 'Appuntamento modificato', a.cliente ? nomeCliente(a.cliente) : a.nome, a.titolo + ' · ' + fmt(a.data) + ' ' + a.ora);
    if (ctx && ctx.dopoSalva && CFG.dopoAppuntamento) CFG.dopoAppuntamento(ctx.dopoSalva, a, D);
    return { id: a.id };
  });
  function moduloAppuntamento(a, pre) {
    pre = pre || {};
    var ops = operatori();
    var val = a ? { cliente: a.cliente || '', nome: a.nome || '', titolo: a.titolo, data: a.data, ora: a.ora, durata: String(a.durata || 30), op: a.op || '', note: a.note || '' }
      : { cliente: pre.cliente || '', nome: pre.nome || '', titolo: pre.titolo || '', data: pre.data || iso(OGGI), ora: pre.ora || '10:00', durata: String(pre.durata || 30), op: pre.op || ops[0] || '', note: pre.note || '' };
    var m = modulo({
      titolo: a ? 'Modifica appuntamento' : 'Nuovo appuntamento', id: a ? 'app-' + a.id : (pre.bozza || 'app-nuovo'), azione: 'appuntamento.salva', contesto: { id: a ? a.id : null, rif: pre.rif || null, dopoSalva: pre.dopoSalva || null },
      toast: a ? 'Appuntamento aggiornato' : 'Appuntamento creato', larga: true,
      campi: [
        { k: 'cliente', l: CFG.etichette.cliente, tipo: 'select', opzioni: function () { return opzioniClienti('Persona non in archivio'); } },
        { k: 'nome', l: 'Nome della persona', obbl: true, max: 80, se: function (g) { return !g.cliente; } },
        { k: 'titolo', l: 'Motivo', obbl: true, max: 120 },
        { k: 'op', l: 'Con chi', tipo: 'select', opzioni: ops.length ? ops : [''] },
        { k: 'data', l: 'Giorno', tipo: 'date', obbl: true },
        { k: 'ora', l: 'Ora', tipo: 'time', obbl: true },
        { k: 'durata', l: 'Durata', tipo: 'select', opzioni: [['15', '15 minuti'], ['30', '30 minuti'], ['45', '45 minuti'], ['60', '1 ora'], ['90', '1 ora e mezza']] },
        { k: 'note', l: 'Note', tipo: 'textarea', max: 600 }
      ],
      valori: val, avvisi: avvisiAppuntamento, dopo: pre.dopo
    });
    if (a) {
      m.el.querySelector('.actions').appendChild(btn('Elimina appuntamento', function () {
        conferma('Eliminare l\'appuntamento?', a.titolo + ' · ' + fmt(a.data) + ' ' + a.ora, 'Elimina', function () {
          D.appuntamenti = D.appuntamenti.filter(function (x) { return x.id !== a.id; });
          togliBozza('app-' + a.id);
          registra('Appuntamento eliminato', a.cliente ? nomeCliente(a.cliente) : a.nome, a.titolo + ' · ' + fmt(a.data) + ' ' + a.ora);
          salva(); chiudiTutte(); toast('Appuntamento eliminato'); render();
        }, true);
      }, 'no'));
    }
    return m;
  }
  function inizioSettimana(d) { var x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function vAgenda() {
    var vista = stato.f.agVista || (mq('(max-width:820px)') ? 'giorno' : 'settimana');
    var dsel = pIso(stato.f.agData) || OGGI, fop = stato.f.agOp || '';
    var ops = operatori();
    var filtro = function (a) { return !fop || a.op === fop; };
    var nomeA = function (a) { return a.cliente ? nomeCliente(a.cliente) : (a.nome || 'Senza nome'); };
    var opCl = function (a) { var i = ops.indexOf(a.op); return 'appt' + (i > 0 ? ' op' + Math.min(i, 2) : ''); };
    var bApp = function (a) { return h('button', { class: opCl(a), type: 'button', on: { click: function () { moduloAppuntamento(a, {}); } }, 'aria-label': a.ora + ' ' + a.titolo + ' con ' + nomeA(a) }, h('b', a.ora + ' · ' + nomeA(a)), a.titolo + (a.op && !fop ? ' · ' + a.op.split(' ')[0] : '')); };
    var sposta = function (n) { var x = vista === 'giorno' ? piuGiorni(dsel, n) : piuGiorni(dsel, 7 * n); stato.f.agData = iso(x); render(); };
    var corpo, titolo;
    if (vista === 'settimana') {
      var ini = inizioSettimana(dsel), fine = piuGiorni(ini, 6);
      titolo = fmt(ini) + ' – ' + fmt(fine);
      corpo = h('div', { class: 'week' }, [0, 1, 2, 3, 4, 5, 6].map(function (i) {
        var d = piuGiorni(ini, i), k = iso(d), ch = giornoChiuso(d), f = festivo(d);
        var lista = D.appuntamenti.filter(function (a) { return a.data === k && filtro(a); }).sort(function (a, b) { return a.ora < b.ora ? -1 : 1; });
        return h('div', { class: 'wd' + (k === iso(OGGI) ? ' oggi' : '') + (ch ? ' chiuso' : '') },
          h('h3', h('span', d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })), h('button', { type: 'button', 'aria-label': 'Nuovo appuntamento il ' + fmt(d), title: 'Aggiungi', on: { click: function () { moduloAppuntamento(null, { data: k, op: fop || ops[0] }); } } }, '+')),
          f ? h('span', { class: 'fest' }, f) : null,
          lista.map(bApp),
          !lista.length ? h('div', { class: 'hint' }, ch ? 'Chiuso' : 'Libero') : null);
      }));
    } else {
      var k = iso(dsel), o = orari(), chd = giornoChiuso(dsel);
      titolo = fmtL(dsel);
      var lista = D.appuntamenti.filter(function (a) { return a.data === k && filtro(a); }).sort(function (a, b) { return a.ora < b.ora ? -1 : 1; });
      var slot = [], m0 = minuti(o.inizio), m1 = minuti(o.fine);
      lista.forEach(function (a) { m0 = Math.min(m0, Math.floor(minuti(a.ora) / o.passo) * o.passo); m1 = Math.max(m1, minuti(a.ora) + o.passo); });
      for (var m = m0; m < m1; m += o.passo) slot.push(m);
      corpo = h('div', chd ? h('div', { class: 'wbox' }, 'Giorno di chiusura: ' + chd + '.') : null,
        h('div', { class: 'slots' }, slot.map(function (mm) {
          var qui = lista.filter(function (a) { var x = minuti(a.ora); return x >= mm && x < mm + o.passo; });
          var fuori = !!chd || fuoriOrario(hm(mm), o.passo);
          return h('div', { class: 'slot' + (fuori ? ' fuori' : '') }, h('div', { class: 'h' }, hm(mm)),
            h('div', { class: 'c' }, qui.map(bApp), h('button', { class: 'add', type: 'button', 'aria-label': 'Nuovo appuntamento alle ' + hm(mm), on: { click: function () { moduloAppuntamento(null, { data: k, ora: hm(mm), op: fop || ops[0] }); } } }, qui.length ? '+' : (fuori ? '' : '+ libero'))));
        })));
    }
    var extra = CFG.agendaExtra ? CFG.agendaExtra(Base) : null;
    return [
      intestazione('Agenda', 'Appuntamenti dal CRM. Apertura: ' + fasceTxt() + '.'),
      h('div', { class: 'ag-head' },
        seg([['giorno', 'Giorno'], ['settimana', 'Settimana']], vista, function (v) { stato.f.agVista = v; render(); }, 'Vista dell\'agenda'),
        btn('‹', function () { sposta(-1); }, 'sec sm', { 'aria-label': vista === 'giorno' ? 'Giorno prima' : 'Settimana prima' }),
        btn('Oggi', function () { stato.f.agData = iso(OGGI); render(); }, 'sec sm'),
        btn('›', function () { sposta(1); }, 'sec sm', { 'aria-label': vista === 'giorno' ? 'Giorno dopo' : 'Settimana dopo' }),
        h('div', { class: 'tit', 'aria-live': 'polite' }, titolo),
        ops.length > 1 ? selettore([['', 'Tutte le persone']].concat(ops), fop, function (v) { stato.f.agOp = v; render(); }, 'Filtra per persona') : null,
        btn('Nuovo appuntamento', function () { moduloAppuntamento(null, { data: iso(dsel), op: fop || ops[0] }); })),
      corpo, extra];
  }

  /* ---------- Scadenze ---------- */
  function vScadenze() {
    var tutte = scadenze(), f = stato.f.scFiltro || '';
    var nS = tutte.filter(function (x) { return diff(x.data) < 0; }).length, nW = tutte.filter(function (x) { var n = diff(x.data); return n >= 0 && n <= 7; }).length, nM = tutte.filter(function (x) { var n = diff(x.data); return n > 7 && n <= 30; }).length;
    var lista = tutte.filter(function (x) { var n = diff(x.data); return !f || (f === 'scadute' && n < 0) || (f === 'sett' && n >= 0 && n <= 7) || (f === 'mese' && n > 7 && n <= 30) || (f === 'dopo' && n > 30); });
    return [
      intestazione('Scadenze', 'Prossime azioni, incassi e pagamenti aperti' + (CFG.testoScadenze ? ', ' + CFG.testoScadenze : '') + '. Scadute e prossime restano sempre separate.',
        [btn('Esporta CSV', function () { esportaCsv('Scadenze', ['Data', 'Tipo', 'Cosa', 'Chi', 'Stato'], lista.map(function (x) { return [x.data, x.tipo, x.titolo, x.sotto || '', quando(diff(x.data))]; })); }, 'sec')]),
      h('div', { class: 'grid g3 mb' }, kpi({ n: nS, l: nS === 1 ? 'Scaduta' : 'Scadute', col: nS ? 'bad' : '', vai: function () { stato.f.scFiltro = 'scadute'; render(); } }), kpi({ n: nW, l: 'Nei prossimi 7 giorni', col: nW ? 'warn' : '', vai: function () { stato.f.scFiltro = 'sett'; render(); } }), kpi({ n: nM, l: 'Tra 8 e 30 giorni', vai: function () { stato.f.scFiltro = 'mese'; render(); } })),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtra le scadenze' }, [['', 'Tutte (' + tutte.length + ')'], ['scadute', 'Scadute (' + nS + ')'], ['sett', 'Prossimi 7 giorni (' + nW + ')'], ['mese', 'Tra 8 e 30 giorni (' + nM + ')'], ['dopo', 'Più avanti']].map(function (o) {
        return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(o[0] === f), on: { click: function () { stato.f.scFiltro = o[0]; render(); } } }, o[1]);
      })),
      tabella([
        { t: 'Cosa', v: function (x) { return h('button', { class: 'clink', type: 'button', on: { click: x.vai } }, x.titolo); } },
        { t: 'Tipo', v: function (x) { return x.tipo; } },
        { t: 'Chi', v: function (x) { return x.sotto; } },
        { t: 'Data', v: function (x) { return fmt(x.data); } },
        { t: 'Stato', v: function (x) { return pillScad(x.data); } }
      ], lista, { vuoto: 'Nessuna scadenza in questo elenco' })];
  }

  /* ---------- Bilancio e storico del mese ---------- */
  function categorie(tipo) { return (CFG.categorie && CFG.categorie[tipo]) || ['Altro']; }
  azione('movimento.salva', function (v, ctx) {
    var m = ctx && ctx.id ? movimento(ctx.id) : null;
    if (ctx && ctx.id && !m) return { errore: 'Questo movimento non esiste più.' };
    if (m && m.rif) return { errore: 'Movimento collegato: si cambia dalla sua scheda.' };
    if (v.cliente && !cliente(v.cliente)) return { campo: { cliente: 'Scheda non trovata.' } };
    if (categorie(v.tipo).indexOf(v.categoria) < 0) return { campo: { categoria: 'Categoria non valida per questo tipo.' } };
    var vecchioMese = m ? m.data.slice(0, 7) : null;
    if (!m) { m = aggiungiMovimento({ data: v.data, tipo: v.tipo, categoria: v.categoria, importo: v.importo, descrizione: v.descrizione, cliente: v.cliente, stato: v.stato, scadenza: v.stato === 'aperto' ? v.scadenza : null }); registra('Movimento aggiunto', (v.tipo === 'entrata' ? 'Entrata ' : 'Uscita ') + eur(v.importo), v.categoria + (v.descrizione ? ' · ' + v.descrizione : '') + ' · ' + fmt(v.data)); return { id: m.id }; }
    var prima = eur(m.importo) + ' ' + m.data;
    m.data = v.data; m.tipo = v.tipo; m.categoria = v.categoria; m.importo = v.importo; m.descrizione = v.descrizione; m.cliente = v.cliente || null; m.stato = v.stato; m.scadenza = v.stato === 'aperto' ? v.scadenza : null;
    registra('Movimento modificato', (m.tipo === 'entrata' ? 'Entrata ' : 'Uscita ') + eur(m.importo), 'Prima: ' + prima);
    aggiornaChiusura(vecchioMese); aggiornaChiusura(m.data.slice(0, 7));
    return { id: m.id };
  });
  function moduloMovimento(m) {
    var val = m ? { tipo: m.tipo, data: m.data, categoria: m.categoria, importo: m.importo, descrizione: m.descrizione, cliente: m.cliente || '', stato: m.stato, scadenza: m.scadenza || '' }
      : { tipo: 'entrata', data: iso(OGGI), categoria: categorie('entrata')[0], stato: 'pagato', scadenza: iso(giorni(30)) };
    return modulo({
      titolo: m ? 'Modifica movimento' : 'Nuovo movimento', id: m ? 'mov-' + m.id : 'mov-nuovo', azione: 'movimento.salva', contesto: { id: m ? m.id : null }, toast: m ? 'Movimento aggiornato' : 'Movimento registrato',
      campi: [
        { k: 'tipo', l: 'Tipo', tipo: 'select', opzioni: [['entrata', 'Entrata'], ['uscita', 'Uscita']] },
        { k: 'data', l: 'Data', tipo: 'date', obbl: true, valida: function (v) { return v > iso(giorni(366)) ? 'Data troppo avanti nel futuro.' : ''; } },
        { k: 'categoria', l: 'Servizio o categoria', tipo: 'select', opzioni: function (g) { return categorie(g.tipo || 'entrata'); } },
        { k: 'importo', l: 'Importo (€)', tipo: 'importo', obbl: true },
        { k: 'stato', l: 'Stato', tipo: 'select', opzioni: function (g) { return g.tipo === 'uscita' ? [['pagato', 'Pagato'], ['aperto', 'Da pagare']] : [['pagato', 'Incassato'], ['aperto', 'Da incassare']]; } },
        { k: 'scadenza', l: 'Scadenza', tipo: 'date', obbl: true, se: function (g) { return g.stato === 'aperto'; } },
        { k: 'cliente', l: CFG.etichette.cliente + ' (facoltativo)', tipo: 'select', opzioni: function () { return opzioniClienti('Nessuno'); } },
        { k: 'descrizione', l: 'Descrizione', max: 140 }
      ],
      valori: val,
      cambia: function (k, g, set) {
        if (k === 'tipo') {
          var sel = document.querySelector('.sheet select[name=categoria]'), st = document.querySelector('.sheet select[name=stato]');
          if (sel) { sel.textContent = ''; categorie(g.tipo).forEach(function (c) { sel.appendChild(h('option', { value: c }, c)); }); set('categoria', categorie(g.tipo)[0]); }
          if (st) { var v = st.value; st.textContent = ''; (g.tipo === 'uscita' ? [['pagato', 'Pagato'], ['aperto', 'Da pagare']] : [['pagato', 'Incassato'], ['aperto', 'Da incassare']]).forEach(function (o) { st.appendChild(h('option', { value: o[0] }, o[1])); }); set('stato', v); }
        }
      },
      avvisi: function (v) {
        var w = [], k = v.data.slice(0, 7);
        if (v.stato === 'pagato' && meseChiuso(k)) w.push(cap(meseLabel(k)) + ' è già chiuso: salvando, la chiusura del mese si aggiorna e resta scritto nel registro.');
        if (m && m.stato === 'pagato' && meseChiuso(m.data.slice(0, 7)) && m.data.slice(0, 7) !== k) w.push('Il movimento esce da ' + meseLabel(m.data.slice(0, 7)) + ', che è chiuso: anche quella chiusura si aggiorna.');
        if (v.importo >= 1000000) w.push('Importo alto (' + eur(v.importo) + '): controlla le cifre.');
        return w;
      }
    });
  }
  function segnaPagato(m) {
    var oggi = iso(OGGI), vecchio = m.data.slice(0, 7);
    m.stato = 'pagato'; m.emesso = m.data; m.data = oggi; m.scadenza = null;
    aggiornaChiusura(vecchio); aggiornaChiusura(oggi.slice(0, 7));
    registra(m.tipo === 'entrata' ? 'Incasso registrato' : 'Pagamento registrato', eur(m.importo), (m.descrizione || m.categoria) + ' · conta nel mese di ' + meseLabel(oggi.slice(0, 7)));
    if (CFG.dopoPagamento) CFG.dopoPagamento(m, D);
    salva(); toast(m.tipo === 'entrata' ? 'Incassato oggi: entra nel bilancio di ' + meseLabel(oggi.slice(0, 7)) : 'Pagato oggi'); render();
  }
  function eliminaMovimento(m) {
    if (m.rif) { toast('Movimento collegato: si toglie dalla sua scheda.', true); return; }
    var k = m.data.slice(0, 7);
    conferma('Eliminare il movimento?', (m.tipo === 'entrata' ? 'Entrata ' : 'Uscita ') + eur(m.importo) + ' · ' + (m.descrizione || m.categoria) + ' · ' + fmt(m.data) + (meseChiuso(k) && pagato(m) ? '. ' + cap(meseLabel(k)) + ' è chiuso: la chiusura si aggiorna.' : ''), 'Elimina', function () {
      togliMovimento(m.id); registra('Movimento eliminato', eur(m.importo), (m.descrizione || m.categoria) + ' · ' + fmt(m.data)); salva(); toast('Movimento eliminato'); render();
    }, true);
  }
  function mesiDisponibili() { return mesiTra(primoMese(), chiaveMese(OGGI)).reverse(); }
  function analisiMese(k) {
    var mov = D.movimenti.filter(function (m) { return pagato(m) && m.data.slice(0, 7) === k; });
    var catE = {}, catU = {}, e = 0, u = 0;
    mov.forEach(function (m) {
      var c = m.tipo === 'entrata' ? catE : catU; c[m.categoria] = c[m.categoria] || { v: 0, n: 0 }; c[m.categoria].v += m.importo; c[m.categoria].n++;
      if (m.tipo === 'entrata') e += m.importo; else u += m.importo;
    });
    var ini = iso(meseDa(k)), fine = iso(new Date(meseDa(k).getFullYear(), meseDa(k).getMonth() + 1, 0));
    /* clienti nuovi, tornati, persi */
    var att = attivita(), primo = {}, ultPrima = {}, attivi = {};
    att.forEach(function (a) {
      if (!primo[a.cliente] || a.data < primo[a.cliente]) primo[a.cliente] = a.data;
      if (a.data < ini && (!ultPrima[a.cliente] || a.data > ultPrima[a.cliente])) ultPrima[a.cliente] = a.data;
      if (a.data >= ini && a.data <= fine) attivi[a.cliente] = 1;
    });
    var soglia = CFG.sogliaPersiGiorni || 365;
    var nuovi = D.clienti.filter(function (c) { var d0 = c.creato && c.creato < (primo[c.id] || '9') ? c.creato : primo[c.id]; return d0 && d0 >= ini && d0 <= fine; });
    var tornati = D.clienti.filter(function (c) { return attivi[c.id] && ultPrima[c.id] && nuovi.indexOf(c) < 0; });
    var persi = D.clienti.filter(function (c) {
      if (attivi[c.id]) return false;
      var u0 = ultPrima[c.id]; if (!u0) return false;
      var lim = iso(piuGiorni(pIso(u0), soglia));
      return lim >= ini && lim <= fine && lim <= iso(OGGI);
    });
    var aperti = D.movimenti.filter(function (m) { return m.stato === 'aperto' && (m.emesso || m.data) <= fine; });
    return { mov: mov, catE: catE, catU: catU, e: e, u: u, nuovi: nuovi, tornati: tornati, persi: persi, daInc: aperti.filter(function (m) { return m.tipo === 'entrata'; }), daPag: aperti.filter(function (m) { return m.tipo === 'uscita'; }), ini: ini, fine: fine };
  }
  function tabCategorie(cat, tot, tit) {
    var r = Object.keys(cat).map(function (c) { return { c: c, v: cat[c].v, n: cat[c].n }; }).sort(function (a, b) { return b.v - a.v; });
    return h('div', { class: 'card' }, h('h2', tit),
      r.length ? h('div', { class: 'tablewrap' }, h('table', h('thead', h('tr', h('th', 'Voce'), h('th', { class: 'num solo-desk' }, 'Movimenti'), h('th', { class: 'num' }, 'Importo'), h('th', { class: 'num' }, 'Quota'))),
        h('tbody', r.map(function (x) { return h('tr', h('td', x.c), h('td', { class: 'num solo-desk' }, String(x.n)), h('td', { class: 'num' }, eur(x.v)), h('td', { class: 'num' }, tot ? (x.v / tot * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%' : '—')); })),
        h('tfoot', h('tr', h('td', 'Totale'), h('td', { class: 'num solo-desk' }, String(r.reduce(function (a, x) { return a + x.n; }, 0))), h('td', { class: 'num' }, eur(tot)), h('td', { class: 'num' }, tot ? '100%' : '—'))))) : vuoto('Nessun movimento'));
  }
  function elencoNomi(lista, vuotoT) {
    if (!lista.length) return h('div', { class: 'hint' }, vuotoT);
    return h('div', { class: 'hint' }, lista.slice(0, 12).map(function (c, i) { return [i ? ', ' : '', h('button', { class: 'clink', type: 'button', on: { click: function () { vai('clienti', c.id); } } }, c.nome)]; }), lista.length > 12 ? ' e altri ' + (lista.length - 12) : '');
  }
  function vBilancio() {
    var tab = stato.f.bilTab || 'mese';
    var corpo = tab === 'anno' ? bilancioAnno() : (tab === 'mov' ? bilancioMovimenti() : (tab === 'storico' ? bilancioStorico() : bilancioMese()));
    return [
      h('h1', 'Bilancio e storico del mese'),
      h('div', { class: 'ibox' }, 'Bilancio di gestione, non documento fiscale: serve a capire come va l\'attività. Non è il bilancio d\'esercizio. I numeri nascono solo dai movimenti registrati.'),
      h('div', { class: 'tabs no-stampa', role: 'tablist' }, [['mese', 'Mese'], ['anno', 'Anno'], ['mov', 'Movimenti'], ['storico', 'Storico chiusure']].map(function (x) {
        return h('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(x[0] === tab), on: { click: function () { stato.f.bilTab = x[0]; render(); } } }, x[1]);
      })),
      corpo];
  }
  function bilancioMese() {
    var disp = mesiDisponibili(), k = stato.f.bilMese && disp.indexOf(stato.f.bilMese) > -1 ? stato.f.bilMese : disp[0];
    var a = analisiMese(k), cur = chiaveMese(OGGI);
    var kp = spostaMese(k, -1), ka = spostaMese(k, -12), pm = primoMese();
    var tp = kp >= pm ? totaliMese(kp) : null, ta = ka >= pm ? totaliMese(ka) : null;
    var stato1 = k === cur ? pill('Mese in corso: numeri parziali fino al ' + fmt(OGGI), 'warn') : (D.chiusure[k] ? pill('Chiuso in automatico il ' + fmt(D.chiusure[k].chiusoIl) + (D.chiusure[k].aggiornata ? ' · aggiornato il ' + fmt(D.chiusure[k].aggiornata.slice(0, 10)) : ''), 'ok') : pill('Mese passato', 'info'));
    var vuotoMese = !a.mov.length ? h('div', { class: 'wbox' }, 'Nessun movimento pagato registrato in questo mese: i numeri sono a zero, non è detto che il mese sia andato così.') : null;
    var ob = D.obiettivi[k] || null;
    var obInput = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Obiettivo di entrate del mese in euro', placeholder: 'es. 3.000', value: ob ? importoTesto(ob) : '', style: { maxWidth: '160px' } });
    var obErr = h('div', { class: 'err', 'aria-live': 'polite', style: { color: 'var(--bad)', fontWeight: '600', fontSize: '12.5px' } });
    var obSalva = btn('Salva obiettivo', function () {
      var c = leggiImporto(obInput.value);
      if (obInput.value.trim() === '') { delete D.obiettivi[k]; registra('Obiettivo tolto', meseLabel(k), ''); salva(); render(); return; }
      if (c == null || isNaN(c) || c <= 0) { obErr.textContent = 'Importo non valido: per esempio 3000 oppure 3.000,00.'; obInput.setAttribute('aria-invalid', 'true'); return; }
      if (c > MAX_IMPORTO) { obErr.textContent = 'Obiettivo troppo alto: massimo ' + eur(MAX_IMPORTO) + '.'; obInput.setAttribute('aria-invalid', 'true'); return; }
      D.obiettivi[k] = c; registra('Obiettivo impostato', meseLabel(k), eur(c)); salva(); toast('Obiettivo salvato'); render();
    }, 'sec sm');
    var perc = ob ? Math.round(a.e / ob * 100) : 0;
    var rendE = Object.keys(a.catE).map(function (c) { return { c: c, v: a.catE[c].v }; }).sort(function (x, y) { return y.v - x.v; });
    /* controllo al centesimo: somma diretta dei movimenti */
    var sommaE = 0, sommaU = 0; a.mov.forEach(function (m) { if (m.tipo === 'entrata') sommaE += m.importo; else sommaU += m.importo; });
    var tornaC = sommaE === a.e && sommaU === a.u && (!D.chiusure[k] || k === cur || (D.chiusure[k].entrate === a.e && D.chiusure[k].uscite === a.u));
    return h('div', { id: 'bilancio-mese' },
      h('div', { class: 'solo-stampa' }, h('h2', CFG.nome + ' · Bilancio di gestione di ' + meseLabel(k)), h('p', 'Bilancio di gestione, non documento fiscale. Progetto dimostrativo · dati inventati. Stampato il ' + fmt(OGGI) + '.')),
      h('div', { class: 'row no-stampa' }, selettore(disp.map(function (x) { return [x, cap(meseLabel(x))]; }), k, function (v) { stato.f.bilMese = v; render(); }, 'Scegli il mese', 'bil-mese'),
        btn('Esporta CSV', function () { esportaMese(k, a); }, 'sec'), btn('Esporta PDF', function () { scaricaPdf('bilancio-' + k + '.pdf', pdfMese(k, a), 'Bilancio ' + meseLabel(k)); }, 'sec'),
        btn('Stampa', function () { registra('Stampa', 'Bilancio ' + meseLabel(k), ''); salva(); window.print(); }, 'sec', { title: 'Seconda scelta: la stampa del browser, anche «Salva come PDF»' })),
      h('p', null, stato1), vuotoMese,
      h('div', { class: 'grid g3 mb' },
        h('div', { class: 'card stat' }, h('div', { class: 'n', 'data-test': 'entrate' }, eur(a.e)), h('div', { class: 'l' }, 'Entrate'), h('div', { class: 'hint' }, 'Mese prima: ', tp ? eur(tp.entrate) : 'nessun dato'), delta(a.e, tp ? tp.entrate : null), h('div', { class: 'hint' }, 'Stesso mese anno prima: ', ta ? eur(ta.entrate) : 'nessun dato'), delta(a.e, ta ? ta.entrate : null)),
        h('div', { class: 'card stat' }, h('div', { class: 'n', 'data-test': 'uscite' }, eur(a.u)), h('div', { class: 'l' }, 'Uscite'), h('div', { class: 'hint' }, 'Mese prima: ', tp ? eur(tp.uscite) : 'nessun dato'), delta(a.u, tp ? tp.uscite : null, true), h('div', { class: 'hint' }, 'Stesso mese anno prima: ', ta ? eur(ta.uscite) : 'nessun dato'), delta(a.u, ta ? ta.uscite : null, true)),
        h('div', { class: 'card stat' }, h('div', { class: 'n', 'data-test': 'margine', style: { color: a.e - a.u < 0 ? 'var(--bad)' : '' } }, eur(a.e - a.u)), h('div', { class: 'l' }, 'Margine'), h('div', { class: 'hint' }, 'Mese prima: ', tp ? eur(tp.margine) : 'nessun dato'), deltaEuro(a.e - a.u, tp ? tp.margine : null), h('div', { class: 'hint' }, 'Stesso mese anno prima: ', ta ? eur(ta.margine) : 'nessun dato'), deltaEuro(a.e - a.u, ta ? ta.margine : null))),
      h('p', { class: 'hint', 'data-test': 'controllo' }, (tornaC ? '✓ ' : '⚠ ') + 'Controllo: somma di ' + pl(a.mov.length, 'movimento pagato', 'movimenti pagati') + ' = entrate ' + eur(sommaE) + ' − uscite ' + eur(sommaU) + ' = ' + eur(sommaE - sommaU) + (tornaC ? ', torna al centesimo' + (D.chiusure[k] && k !== cur ? ' con la chiusura del mese' : '') + '.' : ': non torna con la chiusura, controlla il registro modifiche.')),
      h('div', { class: 'grid g2 mb' }, tabCategorie(a.catE, a.e, 'Entrate per servizio'), tabCategorie(a.catU, a.u, 'Uscite per categoria')),
      h('div', { class: 'grid g2 mb' },
        h('div', { class: 'card' }, h('h2', 'Servizi che rendono di più e di meno'),
          rendE.length ? [h('div', { class: 'subh' }, 'Di più'), h('div', { class: 'list' }, rendE.slice(0, 3).map(function (x) { return h('div', { class: 'item' }, h('div', { class: 't' }, h('b', x.c)), h('b', eur(x.v))); })),
            rendE.length > 3 ? [h('div', { class: 'subh' }, 'Di meno'), h('div', { class: 'list' }, rendE.slice(-Math.min(3, rendE.length - 3)).reverse().map(function (x) { return h('div', { class: 'item' }, h('div', { class: 't' }, h('b', x.c)), h('span', eur(x.v))); }))] : null] : vuoto('Nessuna entrata nel mese')),
        h('div', { class: 'card' }, h('h2', 'Obiettivo del mese'),
          ob ? [h('div', { class: 'stat' }, h('div', { class: 'n' }, perc + '%'), h('div', { class: 'l' }, eur(a.e) + ' su ' + eur(ob) + (k === cur ? ' (mese in corso)' : ''))), h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, perc) + '%', background: perc >= 100 ? 'var(--ok)' : 'var(--accent)' } }))] : h('p', { class: 'hint' }, 'Nessun obiettivo impostato per questo mese.'),
          h('div', { class: 'row no-stampa', style: { marginTop: '12px', marginBottom: '0' } }, obInput, obSalva), obErr)),
      h('div', { class: 'grid g2 mb' },
        h('div', { class: 'card' }, h('h2', 'Incassi da riscuotere'), h('p', { class: 'hint' }, 'Aperti oggi, emessi entro la fine del mese.'),
          a.daInc.length ? h('div', { class: 'list' }, a.daInc.map(function (m) { return h('div', { class: 'item' }, h('div', { class: 't' }, h('b', (m.descrizione || m.categoria) + ' · ' + eur(m.importo)), h('span', (m.cliente ? nomeCliente(m.cliente) + ' · ' : '') + 'scadenza ' + fmt(m.scadenza || m.data))), pillScad(m.scadenza || m.data)); })) : vuoto('Niente da riscuotere')),
        h('div', { class: 'card' }, h('h2', 'Pagamenti in scadenza'), h('p', { class: 'hint' }, 'Da pagare, emessi entro la fine del mese.'),
          a.daPag.length ? h('div', { class: 'list' }, a.daPag.map(function (m) { return h('div', { class: 'item' }, h('div', { class: 't' }, h('b', (m.descrizione || m.categoria) + ' · ' + eur(m.importo)), h('span', 'scadenza ' + fmt(m.scadenza || m.data))), pillScad(m.scadenza || m.data)); })) : vuoto('Nessun pagamento in sospeso'))),
      h('div', { class: 'card' }, h('h2', CFG.etichette.clienti + ' del mese'),
        h('div', { class: 'grid g3' },
          h('div', h('div', { class: 'stat' }, h('div', { class: 'n' }, String(a.nuovi.length)), h('div', { class: 'l' }, 'Nuovi')), elencoNomi(a.nuovi, 'Nessuno')),
          h('div', h('div', { class: 'stat' }, h('div', { class: 'n' }, String(a.tornati.length)), h('div', { class: 'l' }, 'Tornati (già in archivio, attivi nel mese)')), elencoNomi(a.tornati, 'Nessuno')),
          h('div', h('div', { class: 'stat' }, h('div', { class: 'n', style: { color: a.persi.length ? 'var(--bad)' : '' } }, String(a.persi.length)), h('div', { class: 'l' }, 'Persi nel mese (nessun contatto da ' + Math.round((CFG.sogliaPersiGiorni || 365) / 30) + ' mesi)')), elencoNomi(a.persi, 'Nessuno')))));
  }
  /* ---------- PDF veri (generatore minimo in pdf.js, caricato solo qui) ---------- */
  var PIEDE_PDF = 'Bilancio di gestione, non documento fiscale';
  var DICITURA = 'Bilancio di gestione, non documento fiscale: serve a capire come va l\'attività. Non è il bilancio d\'esercizio. I numeri nascono solo dai movimenti registrati e contano solo quelli pagati.';
  function scaricaPdf(nome, def, oggetto) {
    toast('Preparo il PDF…');
    caricaScript('pdf.js').then(function () {
      var b = window.MiniPdf.report(def);
      if (scarica(nome, new Blob([b], { type: 'application/pdf' }))) { registra('Esportazione PDF', oggetto, nome); salva(); toast('PDF pronto: ' + nome); }
    }).catch(function () { toast('Il PDF non si è preparato (rete?). Usa «Stampa» e scegli «Salva come PDF».', true); });
  }
  function difEur(x, y) { return y == null ? 'nessun dato' : (x - y > 0 ? '+' : (x - y < 0 ? '−' : '')) + eur(Math.abs(x - y)); }
  function righeCat(cat, tot) {
    return Object.keys(cat).map(function (c) { return { c: c, v: cat[c].v, n: cat[c].n }; }).sort(function (x, y) { return y.v - x.v; })
      .map(function (x) { return [x.c, String(x.n), eur(x.v), tot ? (x.v / tot * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%' : '—']; });
  }
  function pdfMese(k, a) {
    var cur = chiaveMese(OGGI), pm = primoMese(), kp = spostaMese(k, -1), ka = spostaMese(k, -12);
    var tp = kp >= pm ? totaliMese(kp) : null, ta = ka >= pm ? totaliMese(ka) : null, e = a.e, u = a.u;
    var stato1 = k === cur ? 'Mese in corso: numeri parziali fino al ' + fmt(OGGI) + '.' : (D.chiusure[k] ? 'Mese chiuso in automatico il ' + fmt(D.chiusure[k].chiusoIl) + (D.chiusure[k].aggiornata ? ', aggiornato il ' + fmt(D.chiusure[k].aggiornata.slice(0, 10)) : '') + '.' : 'Mese passato.');
    var colCat = [{ t: 'Voce', w: 3 }, { t: 'Movimenti', w: 1, num: true }, { t: 'Importo', w: 1.4, num: true }, { t: 'Quota', w: 1, num: true }];
    var colAp = [{ t: 'Voce', w: 3 }, { t: CFG.etichette.cliente, w: 2 }, { t: 'Scadenza', w: 1.3 }, { t: 'Importo', w: 1.3, num: true }];
    var somma = function (l) { return l.reduce(function (x, m) { return x + m.importo; }, 0); };
    var ap = function (l) { return l.map(function (m) { return [m.descrizione || m.categoria, m.cliente ? nomeCliente(m.cliente) : '', fmt(m.scadenza || m.data), eur(m.importo)]; }); };
    var ob = D.obiettivi[k];
    var mov = a.mov.slice().sort(function (x, y) { return x.data < y.data ? -1 : (x.data > y.data ? 1 : 0); });
    return {
      titolo: 'Bilancio di gestione di ' + meseLabel(k), intestazione: CFG.nome + ' · Bilancio di gestione di ' + meseLabel(k), data: 'Creato il ' + fmt(new Date()),
      piede: PIEDE_PDF + ' · Progetto dimostrativo · dati inventati',
      blocchi: [
        { h1: CFG.nome }, { h2: 'Bilancio di gestione di ' + meseLabel(k) }, { p: DICITURA, grassetto: true }, { p: stato1 + (a.mov.length ? '' : ' Nessun movimento pagato registrato: i numeri sono a zero.') },
        { riquadri: [['Entrate', eur(e)], ['Uscite', eur(u)], ['Margine', eur(e - u), null, e - u < 0 ? [196, 43, 43] : null]] },
        { h2: 'Confronto' },
        { tabella: { colonne: [{ t: 'Voce', w: 1.2 }, { t: 'Questo mese', w: 1.3, num: true }, { t: 'Mese prima', w: 1.3, num: true }, { t: 'Differenza', w: 1.3, num: true }, { t: 'Anno prima', w: 1.3, num: true }, { t: 'Differenza', w: 1.3, num: true }],
          righe: [['Entrate', 'entrate', e], ['Uscite', 'uscite', u], ['Margine', 'margine', e - u]].map(function (r) { return [r[0], eur(r[2]), tp ? eur(tp[r[1]]) : 'nessun dato', difEur(r[2], tp ? tp[r[1]] : null), ta ? eur(ta[r[1]]) : 'nessun dato', difEur(r[2], ta ? ta[r[1]] : null)]; }) } },
        { h2: 'Entrate per servizio' }, { tabella: { colonne: colCat, righe: righeCat(a.catE, e), totale: ['Totale entrate', String(Object.keys(a.catE).reduce(function (x, c) { return x + a.catE[c].n; }, 0)), eur(e), e ? '100%' : '—'], vuoto: 'Nessuna entrata' } },
        { h2: 'Uscite per categoria' }, { tabella: { colonne: colCat, righe: righeCat(a.catU, u), totale: ['Totale uscite', String(Object.keys(a.catU).reduce(function (x, c) { return x + a.catU[c].n; }, 0)), eur(u), u ? '100%' : '—'], vuoto: 'Nessuna uscita' } },
        { p: 'Controllo: somma di ' + pl(a.mov.length, 'movimento pagato', 'movimenti pagati') + ' = entrate ' + eur(e) + ' − uscite ' + eur(u) + ' = margine ' + eur(e - u) + '.' },
        ob ? { p: 'Obiettivo di entrate del mese: ' + eur(ob) + ' · raggiunto ' + Math.round(e / ob * 100) + '%' + (k === cur ? ' (mese in corso).' : '.') } : null,
        { h2: 'Incassi da riscuotere (aperti oggi)' }, { tabella: { colonne: colAp, righe: ap(a.daInc), totale: a.daInc.length ? ['Totale da riscuotere', '', '', eur(somma(a.daInc))] : null, vuoto: 'Niente da riscuotere' } },
        { h2: 'Pagamenti in scadenza (aperti oggi)' }, { tabella: { colonne: colAp, righe: ap(a.daPag), totale: a.daPag.length ? ['Totale da pagare', '', '', eur(somma(a.daPag))] : null, vuoto: 'Nessun pagamento in sospeso' } },
        { h2: CFG.etichette.clienti + ' del mese' },
        { p: 'Nuovi: ' + a.nuovi.length + '. Tornati (già in archivio, attivi nel mese): ' + a.tornati.length + '. Persi nel mese (nessun contatto da ' + Math.round((CFG.sogliaPersiGiorni || 365) / 30) + ' mesi): ' + a.persi.length + '.' },
        { h2: 'Movimenti pagati del mese' },
        { tabella: { colonne: [{ t: 'Data', w: 1.1 }, { t: 'Tipo', w: 0.9 }, { t: 'Categoria', w: 2 }, { t: 'Descrizione', w: 3 }, { t: 'Importo', w: 1.3, num: true }],
          righe: mov.map(function (m) { return [fmt(m.data), m.tipo === 'entrata' ? 'Entrata' : 'Uscita', m.categoria, (m.descrizione || '') + (m.cliente ? ' · ' + nomeCliente(m.cliente) : ''), (m.tipo === 'entrata' ? '+' : '−') + eur(m.importo)]; }),
          totale: ['', '', '', 'Margine', eur(e - u)], vuoto: 'Nessun movimento' } }
      ].filter(Boolean)
    };
  }
  function pdfAnno(y, righe, tot, totP, daMese) {
    return {
      titolo: 'Bilancio di gestione ' + y, intestazione: CFG.nome + ' · Bilancio di gestione ' + y, data: 'Creato il ' + fmt(new Date()), piede: PIEDE_PDF + ' · Progetto dimostrativo · dati inventati',
      blocchi: [
        { h1: CFG.nome }, { h2: 'Bilancio di gestione dell\'anno ' + y }, { p: DICITURA, grassetto: true },
        daMese ? { p: 'Anno incompleto: i movimenti partono da ' + meseLabel(daMese) + '. I mesi prima non hanno dati.' } : null,
        { riquadri: [['Entrate ' + y, eur(tot.e), totP.ok ? 'anno prima: ' + eur(totP.e) : ''], ['Uscite ' + y, eur(tot.u), totP.ok ? 'anno prima: ' + eur(totP.u) : ''], ['Margine ' + y, eur(tot.e - tot.u), totP.ok ? 'anno prima: ' + eur(totP.e - totP.u) : '']] },
        { tabella: { colonne: [{ t: 'Mese', w: 2 }, { t: 'Entrate', w: 1.4, num: true }, { t: 'Uscite', w: 1.4, num: true }, { t: 'Margine', w: 1.4, num: true }, { t: 'Stato', w: 1.2 }],
          righe: righe.map(function (r) { var nd = r.st === 'futuro' || r.st === 'nessun dato'; return [cap(meseLabel(r.k)), nd ? '—' : eur(r.t.entrate), nd ? '—' : eur(r.t.uscite), nd ? '—' : eur(r.t.margine), r.st]; }),
          totale: ['Totale ' + y + (y === String(OGGI.getFullYear()) ? ' (fino a oggi)' : ''), eur(tot.e), eur(tot.u), eur(tot.e - tot.u), ''] } }
      ].filter(Boolean)
    };
  }
  function esportaMese(k, a) {
    var righe = a.mov.slice().sort(function (x, y) { return x.data < y.data ? -1 : 1; }).map(function (m) { return [m.data, m.tipo === 'entrata' ? 'Entrata' : 'Uscita', m.categoria, m.descrizione || '', m.cliente ? nomeCliente(m.cliente) : '', importoTesto(m.tipo === 'entrata' ? m.importo : -m.importo)]; });
    righe.push([]); righe.push(['Totale entrate', '', '', '', '', importoTesto(a.e)]); righe.push(['Totale uscite', '', '', '', '', importoTesto(-a.u)]); righe.push(['Margine', '', '', '', '', importoTesto(a.e - a.u)]);
    righe.push(['Bilancio di gestione, non documento fiscale. Progetto dimostrativo, dati inventati.']);
    esportaCsv('Bilancio ' + meseLabel(k), ['Data', 'Tipo', 'Categoria', 'Descrizione', CFG.etichette.cliente, 'Importo (€)'], righe);
  }
  function bilancioAnno() {
    var anni = []; mesiDisponibili().forEach(function (k) { var y = k.slice(0, 4); if (anni.indexOf(y) < 0) anni.push(y); });
    var y = stato.f.bilAnno && anni.indexOf(stato.f.bilAnno) > -1 ? stato.f.bilAnno : anni[0];
    var cur = chiaveMese(OGGI), pm = primoMese(), tot = { e: 0, u: 0 }, totP = { e: 0, u: 0, ok: false };
    var mesi = []; for (var i = 1; i <= 12; i++) mesi.push(y + '-' + pad(i));
    var righe = mesi.map(function (k) {
      var t = totaliMese(k), st = k > cur ? 'futuro' : (k < pm ? 'nessun dato' : (k === cur ? 'in corso' : (D.chiusure[k] ? 'chiuso' : 'passato')));
      if (k <= cur && k >= pm) { tot.e += t.entrate; tot.u += t.uscite; }
      var kp = spostaMese(k, -12); if (kp >= pm && k <= cur) { var tp = totaliMese(kp); totP.e += tp.entrate; totP.u += tp.uscite; totP.ok = true; }
      return { k: k, t: t, st: st };
    });
    var col = [
      { t: 'Mese', v: function (r) { return h('button', { class: 'clink', type: 'button', on: { click: function () { stato.f.bilMese = r.k; stato.f.bilTab = 'mese'; render(); } } }, cap(meseLabel(r.k))); } },
      { t: 'Entrate', num: true, v: function (r) { return r.st === 'futuro' || r.st === 'nessun dato' ? '—' : eur(r.t.entrate); } },
      { t: 'Uscite', num: true, v: function (r) { return r.st === 'futuro' || r.st === 'nessun dato' ? '—' : eur(r.t.uscite); } },
      { t: 'Margine', num: true, v: function (r) { return r.st === 'futuro' || r.st === 'nessun dato' ? '—' : eur(r.t.margine); } },
      { t: 'Stato', v: function (r) { return pill(r.st, { 'chiuso': 'ok', 'in corso': 'warn', 'futuro': 'info', 'nessun dato': 'info', 'passato': 'info' }[r.st]); } }
    ];
    var piede = h('tfoot', h('tr', h('td', 'Totale ' + y + (y === String(OGGI.getFullYear()) ? ' (fino a oggi)' : '')), h('td', { class: 'num' }, eur(tot.e)), h('td', { class: 'num' }, eur(tot.u)), h('td', { class: 'num' }, eur(tot.e - tot.u)), h('td', '')));
    var parziale = mesi[0] < pm;
    return h('div',
      h('div', { class: 'row' }, selettore(anni.map(function (a) { return [a, a]; }), y, function (v) { stato.f.bilAnno = v; render(); }, 'Scegli l\'anno'),
        btn('Esporta CSV', function () { esportaCsv('Bilancio ' + y, ['Mese', 'Entrate (€)', 'Uscite (€)', 'Margine (€)', 'Stato'], righe.map(function (r) { return [r.k, importoTesto(r.t.entrate), importoTesto(r.t.uscite), importoTesto(r.t.margine), r.st]; }).concat([['Totale', importoTesto(tot.e), importoTesto(tot.u), importoTesto(tot.e - tot.u), '']])); }, 'sec'),
        btn('Esporta PDF', function () { scaricaPdf('bilancio-' + y + '.pdf', pdfAnno(y, righe, tot, totP, parziale ? pm : null), 'Bilancio ' + y); }, 'sec')),
      parziale ? h('div', { class: 'wbox' }, 'Anno incompleto: i movimenti partono da ' + meseLabel(pm) + '. I mesi prima non hanno dati.') : null,
      h('div', { class: 'grid g3 mb' }, kpi({ n: tot.e, l: 'Entrate ' + y, soldi: true, delta: delta(tot.e, totP.ok ? totP.e : null) }), kpi({ n: tot.u, l: 'Uscite ' + y, soldi: true, delta: delta(tot.u, totP.ok ? totP.u : null, true) }), kpi({ n: tot.e - tot.u, l: 'Margine ' + y, soldi: true, delta: deltaEuro(tot.e - tot.u, totP.ok ? totP.e - totP.u : null) })),
      totP.ok ? h('p', { class: 'hint' }, 'Percentuali: confronto con gli stessi mesi dell\'anno prima, dove ci sono dati.') : null,
      tabella(col, righe, { piede: piede }));
  }
  function bilancioMovimenti() {
    var disp = mesiDisponibili(), fm = stato.f.movMese || '', ft = stato.f.movTipo || '', fs = stato.f.movStato || '';
    var lista = D.movimenti.filter(function (m) { return (!fm || m.data.slice(0, 7) === fm || (m.stato === 'aperto' && (m.emesso || m.data).slice(0, 7) === fm)) && (!ft || m.tipo === ft) && (!fs || m.stato === fs); })
      .sort(function (a, b) { return a.data < b.data ? 1 : (a.data > b.data ? -1 : (a.creato < b.creato ? 1 : -1)); });
    var vis = stato.f.movTutti ? lista : lista.slice(0, 60);
    var col = [
      { t: 'Data', v: function (m) { return fmt(m.data); } },
      { t: 'Voce', v: function (m) { return h('span', h('b', m.descrizione || m.categoria), m.descrizione ? h('span', { class: 'hint' }, ' · ' + m.categoria) : null); } },
      { t: CFG.etichette.cliente, v: function (m) { return m.cliente ? nomeCliente(m.cliente) : ''; } },
      { t: 'Stato', v: function (m) { return m.stato === 'aperto' ? pill((m.tipo === 'entrata' ? 'Da incassare' : 'Da pagare') + ' · ' + fmt(m.scadenza || m.data), 'warn') : pill(m.tipo === 'entrata' ? 'Incassato' : 'Pagato', 'ok'); } },
      { t: 'Importo', num: true, v: function (m) { return h('b', { style: { color: m.tipo === 'entrata' ? 'var(--ok)' : 'var(--bad)' } }, (m.tipo === 'entrata' ? '+' : '−') + eur(m.importo)); } },
      { t: 'Azioni', v: function (m) {
        if (m.rif) return h('span', { class: 'hint' }, CFG.testoRif ? CFG.testoRif(m) : 'Collegato');
        return h('span', { class: 'acts' }, m.stato === 'aperto' ? btn(m.tipo === 'entrata' ? 'Incassato' : 'Pagato', function () { segnaPagato(m); }, 'sm') : null, ' ', btn('Modifica', function () { moduloMovimento(m); }, 'sec sm'), ' ', btn('Elimina', function () { eliminaMovimento(m); }, 'no sm'));
      } }
    ];
    var tE = 0, tU = 0; lista.forEach(function (m) { if (pagato(m)) { if (m.tipo === 'entrata') tE += m.importo; else tU += m.importo; } });
    return h('div',
      h('div', { class: 'row' }, btn('Nuovo movimento', function () { moduloMovimento(null); }),
        selettore([['', 'Tutti i mesi']].concat(disp.map(function (x) { return [x, cap(meseLabel(x))]; })), fm, function (v) { stato.f.movMese = v; render(); }, 'Filtra per mese'),
        selettore([['', 'Entrate e uscite'], ['entrata', 'Solo entrate'], ['uscita', 'Solo uscite']], ft, function (v) { stato.f.movTipo = v; render(); }, 'Filtra per tipo'),
        selettore([['', 'Tutti gli stati'], ['pagato', 'Pagati'], ['aperto', 'Da incassare o pagare']], fs, function (v) { stato.f.movStato = v; render(); }, 'Filtra per stato'),
        btn('Esporta CSV', function () { esportaCsv('Movimenti', ['Data', 'Tipo', 'Categoria', 'Descrizione', CFG.etichette.cliente, 'Stato', 'Scadenza', 'Importo (€)'], lista.map(function (m) { return [m.data, m.tipo, m.categoria, m.descrizione || '', m.cliente ? nomeCliente(m.cliente) : '', m.stato === 'pagato' ? 'pagato' : 'aperto', m.scadenza || '', importoTesto(m.tipo === 'entrata' ? m.importo : -m.importo)]; })); }, 'sec')),
      h('p', { class: 'hint' }, pl(lista.length, 'movimento', 'movimenti') + ' · pagati: entrate ' + eur(tE) + ', uscite ' + eur(tU) + ', margine ' + eur(tE - tU)),
      tabella(col, vis, { vuoto: 'Nessun movimento con questi filtri' }),
      lista.length > vis.length ? h('div', { style: { marginTop: '10px' } }, btn('Mostra tutti (' + lista.length + ')', function () { stato.f.movTutti = true; render(); }, 'sec sm')) : null);
  }
  function bilancioStorico() {
    var ks = Object.keys(D.chiusure).sort().reverse();
    if (!ks.length) return h('div', { class: 'card' }, vuoto('Nessun mese chiuso', 'Ogni mese si chiude da solo il 1° del mese dopo.'));
    var perAnno = {}; ks.forEach(function (k) { (perAnno[k.slice(0, 4)] = perAnno[k.slice(0, 4)] || []).push(D.chiusure[k]); });
    return h('div', h('p', { class: 'hint' }, 'Ogni mese si chiude da solo il 1° del mese dopo e resta qui. Se un movimento cambia dopo la chiusura, la chiusura si aggiorna e lo dice.'),
      Object.keys(perAnno).sort().reverse().map(function (y) {
        var e = 0, u = 0; perAnno[y].forEach(function (c) { e += c.entrate; u += c.uscite; });
        return h('div', { class: 'mb' }, h('h2', y + ' · margine ' + eur(e - u)), tabella([
          { t: 'Mese', v: function (c) { return h('button', { class: 'clink', type: 'button', on: { click: function () { stato.f.bilMese = c.mese; stato.f.bilTab = 'mese'; render(); } } }, cap(meseLabel(c.mese))); } },
          { t: 'Chiuso il', v: function (c) { return fmt(c.chiusoIl); } },
          { t: 'Entrate', num: true, v: function (c) { return eur(c.entrate); } },
          { t: 'Uscite', num: true, v: function (c) { return eur(c.uscite); } },
          { t: 'Margine', num: true, v: function (c) { return eur(c.margine); } },
          { t: 'Note', v: function (c) { return c.aggiornata ? pill('aggiornata il ' + fmt(c.aggiornata.slice(0, 10)), 'warn') : (c.n ? pl(c.n, 'movimento', 'movimenti') : 'nessun movimento'); } }
        ], perAnno[y]));
      }));
  }

  /* ---------- Importa ed esporta (CSV) ---------- */
  function leggiCsv(testo) {
    testo = String(testo).replace(/^﻿/, '');
    var prima = testo.split(/\r?\n/)[0] || '';
    var conta = function (c) { var n = 0, q = false; for (var i = 0; i < prima.length; i++) { if (prima[i] === '"') q = !q; else if (!q && prima[i] === c) n++; } return n; };
    var sep = [';', ',', '\t'].sort(function (a, b) { return conta(b) - conta(a); })[0];
    var righe = [], riga = [], campo = '', q = false, i = 0, nr = 1, inizioQ = 0;
    for (; i < testo.length; i++) {
      var ch = testo[i];
      if (q) {
        if (ch === '"') { if (testo[i + 1] === '"') { campo += '"'; i++; } else q = false; }
        else { if (ch === '\n') nr++; campo += ch; }
      } else if (ch === '"' && campo === '') { q = true; inizioQ = nr; }
      else if (ch === sep) { riga.push(campo); campo = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && testo[i + 1] === '\n') i++; riga.push(campo); righe.push(riga); riga = []; campo = ''; nr++; }
      else campo += ch;
      if (righe.length > 5001) return { errore: 'Troppe righe: massimo 5.000 per importazione.' };
    }
    if (q) return { errore: 'CSV non valido: virgolette aperte alla riga ' + inizioQ + ' e mai chiuse.' };
    if (campo !== '' || riga.length) { riga.push(campo); righe.push(riga); }
    righe = righe.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
    if (!righe.length) return { errore: 'Il file è vuoto.' };
    return { sep: sep, righe: righe };
  }
  var ALIAS = { nome: ['nome', 'nominativo', 'nome e cognome', 'cliente', 'cittadino', 'ragione sociale', 'name'], tel: ['telefono', 'tel', 'cellulare', 'cell', 'phone', 'numero'], email: ['email', 'e-mail', 'mail', 'posta'], note: ['note', 'annotazioni', 'commenti'] };
  function indovina(intest) {
    var t = norm(intest);
    var campi = campiCliente();
    for (var i = 0; i < campi.length; i++) {
      var f = campi[i], al = (ALIAS[f.k] || []).concat(f.alias || []).concat([norm(f.l)]);
      if (al.some(function (a) { return t === a || (a.length > 3 && t.indexOf(a) > -1); })) return f.k;
    }
    return '';
  }
  function vCsv() {
    var esporti = [
      { t: CFG.etichette.clienti, d: 'Tutte le schede con i recapiti', fn: esportaClienti },
      { t: 'Appuntamenti', d: 'Agenda completa', fn: function () { esportaCsv('Appuntamenti', ['Data', 'Ora', 'Durata (min)', 'Motivo', CFG.etichette.cliente, 'Con chi', 'Note'], D.appuntamenti.slice().sort(function (a, b) { return (a.data + a.ora) < (b.data + b.ora) ? -1 : 1; }).map(function (a) { return [a.data, a.ora, a.durata, a.titolo, a.cliente ? nomeCliente(a.cliente) : a.nome, a.op || '', a.note || '']; })); } },
      { t: 'Movimenti', d: 'Entrate e uscite, per il commercialista', fn: function () { esportaCsv('Movimenti', ['Data', 'Tipo', 'Categoria', 'Descrizione', CFG.etichette.cliente, 'Stato', 'Importo (€)'], D.movimenti.slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; }).map(function (m) { return [m.data, m.tipo, m.categoria, m.descrizione || '', m.cliente ? nomeCliente(m.cliente) : '', m.stato, importoTesto(m.tipo === 'entrata' ? m.importo : -m.importo)]; })); } },
      { t: 'Registro modifiche', d: 'Chi ha cambiato cosa e quando', fn: esportaRegistro }
    ].concat((CFG.esporta || []).map(function (x) { return { t: x.t, d: x.d, fn: function () { var r = x.dati(Base); esportaCsv(x.t, r.testa, r.righe); } }; }));
    esporti.push({ t: 'Backup completo', d: 'Tutti i dati in un file (JSON)', fn: function () {
      var copia = JSON.parse(JSON.stringify(D)); copia.documenti.forEach(function (d) { if (d.contenuto) d.contenuto = '(file di ' + Math.round(d.dim / 1024) + ' KB non incluso nel backup demo)'; });
      scarica(norm(CFG.nome).replace(/[^a-z0-9]+/g, '-') + '-backup-' + iso(OGGI) + '.json', new Blob([JSON.stringify(copia, null, 1)], { type: 'application/json' }));
      registra('Backup esportato', 'Tutti i dati', ''); salva(); toast('Backup pronto');
    } });
    return [
      intestazione('Importa ed esporta', 'Il CSV serve solo a spostare dati dentro e fuori: l\'archivio vero resta il CRM.'),
      h('div', { class: 'card mb' }, h('h2', 'Importa ' + CFG.etichette.clienti.toLowerCase() + ' da CSV'), importaWizard()),
      h('h2', 'Esporta'),
      h('div', { class: 'grid g3' }, esporti.map(function (x) {
        return h('div', { class: 'card' }, h('h3', x.t), h('p', { class: 'hint' }, x.d), btn('Esporta', x.fn, 'sec sm', { 'aria-label': 'Esporta ' + x.t }));
      }))];
  }
  var IMP = null; // stato dell'importazione in corso
  function importaWizard() {
    var box = h('div');
    function passo1() {
      IMP = null; box.textContent = '';
      var file = h('input', { type: 'file', accept: '.csv,.txt,text/csv', 'aria-label': 'Scegli il file CSV' });
      var area = h('textarea', { class: 'mono', 'aria-label': 'Oppure incolla qui il testo del CSV', placeholder: 'Nome;Telefono;Email\nMario Rossi;333 123 4567;mario@esempio.it', maxlength: '1000000' });
      var err = h('div', { class: 'ferr', role: 'alert', hidden: true });
      var avanti = function (testo) {
        var r = leggiCsv(testo);
        if (r.errore) { err.hidden = false; err.textContent = r.errore; return; }
        IMP = { righe: r.righe, sep: r.sep, intest: true };
        IMP.map = r.righe[0].map(function (c) { return indovina(c); });
        passo2();
      };
      file.addEventListener('change', function () {
        var f = file.files[0]; if (!f) return;
        if (f.size > 1024 * 1024) { err.hidden = false; err.textContent = 'File troppo grande: massimo 1 MB.'; file.value = ''; return; }
        var rd = new FileReader(); rd.onload = function () { avanti(String(rd.result)); }; rd.onerror = function () { err.hidden = false; err.textContent = 'Lettura del file non riuscita.'; }; rd.readAsText(f, 'utf-8');
      });
      box.appendChild(h('p', { class: 'hint' }, 'Passo 1 di 4 · Scegli un file .csv (separatore punto e virgola, virgola o tabulazione) oppure incolla il testo.'));
      box.appendChild(h('div', { class: 'row' }, file));
      box.appendChild(h('div', { class: 'f' }, area));
      box.appendChild(err);
      box.appendChild(h('div', { class: 'row', style: { marginTop: '10px', marginBottom: '0' } }, btn('Leggi il testo incollato', function () { if (!area.value.trim()) { err.hidden = false; err.textContent = 'Incolla prima il testo del CSV.'; return; } avanti(area.value); }, 'sec')));
    }
    function dati() { return IMP.intest ? IMP.righe.slice(1) : IMP.righe; }
    function passo2() {
      box.textContent = '';
      var nCol = Math.max.apply(null, IMP.righe.map(function (r) { return r.length; }));
      var campi = campiCliente();
      var chk = h('input', { type: 'checkbox', checked: IMP.intest, id: 'imp-intest' });
      chk.addEventListener('change', function () { IMP.intest = chk.checked; passo2(); });
      var anteprima = (IMP.intest ? IMP.righe.slice(1) : IMP.righe).slice(0, 5);
      var err = h('div', { class: 'ferr', role: 'alert', hidden: true });
      box.appendChild(h('p', { class: 'hint' }, 'Passo 2 di 4 · Anteprima e associazione delle colonne. ' + pl(dati().length, 'riga', 'righe') + ' trovate.'));
      box.appendChild(h('label', { class: 'check', for: 'imp-intest', style: { borderBottom: '0' } }, chk, h('span', 'La prima riga contiene i nomi delle colonne')));
      box.appendChild(h('div', { class: 'csvmap mb' }, Array.from({ length: nCol }, function (_, i) {
        var tit = IMP.intest ? (IMP.righe[0][i] || 'Colonna ' + (i + 1)) : 'Colonna ' + (i + 1);
        var sel = h('select', { 'aria-label': 'Dove va la colonna ' + tit }, [h('option', { value: '' }, '— Ignora —')].concat(campi.map(function (f) { return h('option', { value: f.k }, f.l + (f.obbl ? ' *' : '')); })));
        sel.value = IMP.map[i] || '';
        sel.addEventListener('change', function () { IMP.map[i] = sel.value; });
        return h('div', { class: 'f' }, h('label', null, tit.slice(0, 40)), sel, h('div', { class: 'hint' }, 'Es.: ' + (anteprima[0] && anteprima[0][i] ? String(anteprima[0][i]).slice(0, 40) : '—')));
      })));
      box.appendChild(h('div', { class: 'tablewrap mb' }, h('table', h('thead', h('tr', Array.from({ length: nCol }, function (_, i) { return h('th', IMP.intest ? String(IMP.righe[0][i] || '').slice(0, 30) : 'Col. ' + (i + 1)); }))),
        h('tbody', anteprima.map(function (r) { return h('tr', Array.from({ length: nCol }, function (_, i) { return h('td', String(r[i] == null ? '' : r[i]).slice(0, 60)); })); })))));
      box.appendChild(err);
      box.appendChild(h('div', { class: 'row', style: { marginBottom: 0 } }, btn('Controlla i dati', function () {
        var usati = IMP.map.filter(Boolean);
        if (usati.indexOf('nome') < 0) { err.hidden = false; err.textContent = 'Associa almeno la colonna «Nome e cognome».'; return; }
        var dop = usati.filter(function (x, i) { return usati.indexOf(x) !== i; });
        if (dop.length) { err.hidden = false; err.textContent = 'Due colonne vanno nello stesso campo: ' + campi.filter(function (f) { return f.k === dop[0]; })[0].l + '.'; return; }
        passo3();
      }), btn('Ricomincia', passo1, 'sec')));
    }
    function passo3() {
      box.textContent = '';
      var campi = campiCliente(), visti = [];
      IMP.esame = dati().map(function (r, i) {
        var c = {}, problemi = [];
        IMP.map.forEach(function (k, j) { if (k) c[k] = String(r[j] == null ? '' : r[j]).trim(); });
        campi.forEach(function (f) {
          if (c[f.k] == null || c[f.k] === '') return;
          var x = controllaCampo(f, c[f.k], c);
          if (x.err) { problemi.push(f.l + ': ' + x.err.charAt(0).toLowerCase() + x.err.slice(1).replace(/\.$/, '')); c[f.k] = ''; } else c[f.k] = x.v;
        });
        var nr = i + 1 + (IMP.intest ? 1 : 0);
        if (!c.nome) return { nr: nr, c: c, scarta: 'manca il nome' + (problemi.length ? ' · ' + problemi.join('; ') : '') };
        var dup = trovaDuplicato(c, null), nelFile = null;
        if (!dup) { var kk = chiaviDup(c); visti.forEach(function (v) { if (!nelFile && kk.some(function (k) { return v.k.indexOf(k) > -1; })) nelFile = v; }); }
        visti.push({ k: chiaviDup(c), nr: nr, c: c });
        return { nr: nr, c: c, dup: dup, nelFile: nelFile, problemi: problemi, scelta: dup || nelFile ? 'unisci' : 'crea' };
      });
      var duplicati = IMP.esame.filter(function (x) { return x.dup || x.nelFile; });
      var scarti = IMP.esame.filter(function (x) { return x.scarta; });
      box.appendChild(h('p', { class: 'hint' }, 'Passo 3 di 4 · Controllo dei duplicati e degli errori.'));
      box.appendChild(h('div', { class: 'grid g3 mb' }, kpi({ n: IMP.esame.length - scarti.length - duplicati.length, l: 'Nuove schede' }), kpi({ n: duplicati.length, l: 'Possibili doppioni', col: duplicati.length ? 'warn' : '' }), kpi({ n: scarti.length, l: 'Righe da scartare', col: scarti.length ? 'bad' : '' })));
      if (duplicati.length) {
        box.appendChild(h('div', { class: 'row' }, h('b', 'Per tutti i doppioni:'), btn('Unisci', function () { duplicati.forEach(function (d) { d.scelta = 'unisci'; }); passo3b(); }, 'sec sm'), btn('Salta', function () { duplicati.forEach(function (d) { d.scelta = 'salta'; }); passo3b(); }, 'sec sm'), btn('Crea nuove', function () { duplicati.forEach(function (d) { d.scelta = 'crea'; }); passo3b(); }, 'sec sm')));
        box.appendChild(h('p', { class: 'hint' }, '«Unisci» completa solo i campi vuoti della scheda che c\'è già: niente viene sovrascritto.'));
        IMP.boxDup = h('div', { class: 'mb' }); box.appendChild(IMP.boxDup); passo3b();
      }
      IMP.esame.forEach(function (x) { if (x.problemi && x.problemi.length) box.appendChild(h('div', { class: 'wbox' }, 'Riga ' + x.nr + ' (' + x.c.nome + '): ' + x.problemi.join('; ') + '. Il campo resta vuoto.')); });
      if (scarti.length) box.appendChild(h('div', { class: 'wbox' }, h('b', 'Righe scartate:'), h('ul', scarti.slice(0, 20).map(function (x) { return h('li', 'Riga ' + x.nr + ': ' + x.scarta); })), scarti.length > 20 ? 'e altre ' + (scarti.length - 20) : null));
      box.appendChild(h('div', { class: 'row', style: { marginBottom: 0 } }, btn('Importa', passo4), btn('Indietro', passo2, 'sec'), btn('Annulla', passo1, 'sec')));
    }
    function passo3b() {
      IMP.boxDup.textContent = '';
      IMP.esame.filter(function (x) { return x.dup || x.nelFile; }).forEach(function (d) {
        IMP.boxDup.appendChild(h('div', { class: 'dup' }, h('b', 'Riga ' + d.nr + ': ' + d.c.nome), h('div', { class: 'hint' }, d.dup ? 'Somiglia a ' + d.dup.nome + ' già in archivio' + (d.dup.tel ? ' (' + d.dup.tel + ')' : '') : 'Ripete la riga ' + d.nelFile.nr + ' dello stesso file'),
          seg([['unisci', 'Unisci'], ['salta', 'Salta'], ['crea', 'Crea nuovo']], d.scelta, function (v) { d.scelta = v; passo3b(); }, 'Cosa fare con la riga ' + d.nr)));
      });
    }
    function passo4() {
      var r = { creati: 0, uniti: 0, saltati: 0, scartati: 0 }, creatiNelFile = {};
      IMP.esame.forEach(function (x) {
        if (x.scarta) { r.scartati++; return; }
        if ((x.dup || x.nelFile) && x.scelta === 'salta') { r.saltati++; return; }
        var target = x.dup || (x.nelFile ? creatiNelFile[x.nelFile.nr] : null);
        if ((x.dup || x.nelFile) && x.scelta === 'unisci' && target) {
          campiCliente().forEach(function (f) { if ((target[f.k] == null || target[f.k] === '') && x.c[f.k]) target[f.k] = x.c[f.k]; });
          r.uniti++; creatiNelFile[x.nr] = target; return;
        }
        var c = { id: nuovoId('c'), creato: iso(OGGI) };
        campiCliente().forEach(function (f) { c[f.k] = x.c[f.k] || ''; });
        D.clienti.push(c); creatiNelFile[x.nr] = c; r.creati++;
      });
      registra('Importazione CSV', CFG.etichette.clienti, 'Create ' + r.creati + ', unite ' + r.uniti + ', saltate ' + r.saltati + ', scartate ' + r.scartati);
      salva();
      box.textContent = '';
      box.appendChild(h('p', { class: 'hint' }, 'Passo 4 di 4 · Riepilogo.'));
      box.appendChild(h('div', { class: 'grid g4 mb', 'data-test': 'riepilogo-import' }, kpi({ n: r.creati, l: 'Create' }), kpi({ n: r.uniti, l: 'Unite' }), kpi({ n: r.saltati, l: 'Saltate' }), kpi({ n: r.scartati, l: 'Scartate', col: r.scartati ? 'bad' : '' })));
      box.appendChild(h('div', { class: 'row', style: { marginBottom: 0 } }, btn('Vai a ' + CFG.etichette.clienti, function () { vai('clienti'); }), btn('Nuova importazione', passo1, 'sec')));
      IMP = null;
      disegnaNav();
      toast('Importazione completata');
    }
    passo1();
    return box;
  }

  /* ---------- Registro modifiche ---------- */
  function esportaRegistro() { esportaCsv('Registro modifiche', ['Quando', 'Chi', 'Azione', 'Su cosa', 'Dettaglio'], D.registro.slice().reverse().map(function (r) { return [r.q, r.chi, r.azione, r.oggetto, r.dettaglio]; })); }
  function vRegistro() {
    var q = norm(stato.f.regQ || ''), fc = stato.f.regChi || '';
    var persone = []; D.registro.forEach(function (r) { if (persone.indexOf(r.chi) < 0) persone.push(r.chi); });
    var lista = D.registro.slice().reverse().filter(function (r) { return (!fc || r.chi === fc) && (!q || norm(r.azione + ' ' + r.oggetto + ' ' + r.dettaglio).indexOf(q) > -1); });
    var vis = lista.slice(0, stato.f.regTutti ? 3000 : 80);
    var input = h('input', { type: 'search', placeholder: 'Cerca nel registro…', 'aria-label': 'Cerca nel registro', value: stato.f.regQ || '', maxlength: '80' });
    input.addEventListener('change', function () { stato.f.regQ = input.value; render(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { stato.f.regQ = input.value; render(); } });
    return [
      intestazione('Registro modifiche', 'Chi ha cambiato cosa e quando. Nella versione vera il registro non si può modificare né cancellare, nemmeno dal titolare.', [btn('Esporta CSV', esportaRegistro, 'sec')]),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, input), selettore([['', 'Tutte le persone']].concat(persone), fc, function (v) { stato.f.regChi = v; render(); }, 'Filtra per persona')),
      tabella([
        { t: 'Quando', v: function (r) { return fmtDT(r.q); } },
        { t: 'Chi', v: function (r) { return r.chi; } },
        { t: 'Azione', v: function (r) { return h('b', r.azione); } },
        { t: 'Su cosa', v: function (r) { return r.oggetto; } },
        { t: 'Dettaglio', v: function (r) { return r.dettaglio; } }
      ], vis, { vuoto: 'Nessuna voce' }),
      lista.length > vis.length ? h('div', { style: { marginTop: '10px' } }, btn('Mostra tutte (' + lista.length + ')', function () { stato.f.regTutti = true; render(); }, 'sec sm')) : null];
  }

  /* ---------- Impostazioni ---------- */
  function interruttore(on, fn, aria, dis) {
    var b = h('button', { class: 'sw', type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': aria, 'aria-disabled': dis ? 'true' : null, on: { click: function () { if (dis) { toast('Il sistema chiede meno trasparenza: il vetro resta spento.', true); return; } fn(!on); } } }, h('i'));
    return b;
  }
  function vImpostazioni() {
    var v = statoVetro(), t = temaScelto() || 'auto';
    var usato = (leggi(KEY) || '').length;
    var permessi = CFG.permessi || [];
    return [
      intestazione('Impostazioni', 'Le scelte di aspetto restano su questo dispositivo.'),
      h('div', { class: 'grid g2 mb' },
        h('div', { class: 'card' }, h('h2', 'Aspetto'),
          h('div', { class: 'setrow' }, h('div', { class: 't' }, h('b', 'Giorno o notte'), h('span', 'Automatico segue il telefono o il computer.')),
            seg([['auto', 'Automatico'], ['chiaro', 'Giorno'], ['scuro', 'Notte']], t, function (x) { impostaTema(x === 'auto' ? '' : x); render(); }, 'Tema')),
          h('div', { class: 'setrow' }, h('div', { class: 't' }, h('b', 'Liquid Glass'), h('span', v.motivo || 'Superfici di vetro trasparente su tutta l\'interfaccia. Spento: schede piene, più leggere.')),
            interruttore(v.on, function (on) { impostaVetro(on); render(); }, 'Liquid Glass', v.bloccato)),
          h('div', { class: 'setrow' }, h('div', { class: 't' }, h('b', 'Movimento'), h('span', menoMovimento() ? 'Il dispositivo chiede meno movimento: le animazioni sono spente.' : 'Animazioni brevi. Se il dispositivo chiede meno movimento, si spengono da sole.')))),
        h('div', { class: 'card' }, h('h2', 'Dati della demo'),
          h('p', { class: 'hint' }, memoriaOk ? 'I dati restano solo in questo browser (' + Math.max(1, Math.round(usato / 1024)) + ' KB usati). Nessun dato va su internet.' : 'Questo browser non permette di salvare: le modifiche valgono finché la pagina resta aperta.'),
          h('div', { class: 'row', style: { marginBottom: 0 } },
            btn('Ripristina dati demo', function () { conferma('Ripristinare i dati demo?', 'Tutte le modifiche fatte in questo browser si cancellano e tornano i dati di esempio.', 'Ripristina', function () { ripristina(); toast('Dati demo ripristinati'); vai('dash'); }, true); }, 'no'),
            btn('Importa ed esporta', function () { vai('csv'); }, 'sec')))),
      h('div', { class: 'card' }, h('h2', 'Ruoli e permessi'),
        h('p', { class: 'hint' }, 'Nella demo i ruoli sono solo mostrati: tutti possono fare tutto. Nella versione vera ognuno entra con il suo account e vede solo quello che gli serve.'),
        h('div', { class: 'tablewrap' }, h('table', h('thead', h('tr', [h('th', 'Area')].concat((CFG.ruoli || []).map(function (r) { return h('th', r); })))),
          h('tbody', permessi.map(function (p) { return h('tr', h('td', p[0]), p.slice(1).map(function (x) { return h('td', x); })); }))))),
      CFG.impostazioniExtra ? CFG.impostazioniExtra(Base) : null];
  }

  /* =========================================================
     12. Avvio
     ========================================================= */
  function avvia(cfg) {
    CFG = cfg;
    CFG.etichette = CFG.etichette || { cliente: 'Cliente', clienti: 'Clienti' };
    KEY = 'gestionale-' + cfg.id + '-dati-v1'; KEY_BOZZE = 'gestionale-' + cfg.id + '-bozze'; KEY_CODA = 'gestionale-' + cfg.id + '-coda'; KEY_CHI = 'gestionale-' + cfg.id + '-chi';
    try { window.localStorage.setItem('gestionale-prova', '1'); window.localStorage.removeItem('gestionale-prova'); } catch (e) { memoriaOk = false; }
    if (cfg.azioni) Object.keys(cfg.azioni).forEach(function (k) { azione(k, cfg.azioni[k]); });
    carica();
    suggerimenti();
    window.addEventListener('hashchange', function () { render(); });
    window.addEventListener('online', function () { aggiornaOffline(); svuotaCoda(); });
    window.addEventListener('offline', function () { aggiornaOffline(); toast('Rete assente: le bozze restano su questo dispositivo.', true); });
    window.addEventListener('storage', function (e) { if (e.key === KEY && e.newValue) { try { D = completa(JSON.parse(e.newValue)); render(); } catch (x) { } } });
    render(true);
    if (inRete()) svuotaCoda();
    controllaFluidita(function () { toast('Il dispositivo andava a scatti: Liquid Glass spento da solo.'); if (G.main) render(); });
  }

  var Base = {
    avvia: avvia, preparaPagina: preparaPagina, h: h, s: s, icona: icona, carica: caricaScript,
    u: { iso: iso, pIso: pIso, oggi: function () { return OGGI; }, giorni: giorni, piuGiorni: piuGiorni, piuMesi: piuMesi, fmt: fmt, fmtL: fmtL, fmtDT: fmtDT, diff: diff, pad: pad, norm: norm, pl: pl, cap: cap, eur: eur, leggiImporto: leggiImporto, importoTesto: importoTesto, telOk: telOk, emailOk: emailOk, nuovoId: nuovoId, chiaveMese: chiaveMese, meseLabel: meseLabel, festivo: festivo, quando: quando, minuti: minuti, hm: hm, giornoChiuso: giornoChiuso },
    dati: function () { return D; }, salva: salva, registra: registra, chi: chi, render: render, vai: vai, stato: stato,
    toast: toast, modale: modale, conferma: conferma, modulo: modulo, azione: azione, chiudiTutte: chiudiTutte, inRete: inRete,
    ui: { tabella: tabella, kpi: kpi, barre: barre, grafColonne: grafColonne, vuoto: vuoto, pill: pill, pillScad: pillScad, btn: btn, seg: seg, selettore: selettore, intestazione: intestazione, esportaCsv: esportaCsv, scarica: scarica, tastiPref: creaTastiPref },
    clienti: { trova: cliente, nome: nomeCliente, opzioni: opzioniClienti, nuovo: function (v) { return esegui('cliente.salva', v, {}); }, modulo: moduloCliente },
    movimenti: { aggiungi: aggiungiMovimento, togli: togliMovimento, trova: movimento, meseChiuso: meseChiuso },
    agenda: { modulo: moduloAppuntamento, operatori: operatori }
  };
  window.Base = Base;
  /* pagine semplici (elenco dei gestionali): i due tasti senza il resto */
  document.addEventListener('DOMContentLoaded', function () { if (document.body && document.body.hasAttribute('data-pagina-semplice')) preparaPagina(); });
})();
