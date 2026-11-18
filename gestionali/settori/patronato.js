/* Settore: Patronato / sportello servizi (versione demo).
   Solo ciò che è del mestiere: pratiche di patronato e CAF, stati, enti, documenti richiesti,
   protocolli, esiti, termini e scadenze, richieste online. Tutto il resto è nella base.
   Dati demo inventati: nomi, codici fiscali (con X al posto del comune), telefoni ed email. */
(function () {
  'use strict';
  var B = window.Base, h = B.h, U = B.u, UI = B.ui;

  /* ---------- regole del mestiere ---------- */
  var OPE = ['Marta Leone', 'Sara Fiore'];
  var INV = 'Invalidità civile / accompagnamento';
  var TIPI = ['NASpI', 'DIS-COLL', 'ISEE/DSU', '730', '730 integrativo', 'Redditi PF', 'RED', 'Pensione vecchiaia', 'Pensione anticipata', INV, 'Maternità', 'Congedo parentale', 'Assegno unico', 'Dimissioni telematiche', 'Successione'];
  var STATI = ['Da aprire', 'Documenti mancanti', 'Pronta da inviare', 'Inviata', 'In istruttoria', 'Con esito', 'Ricorso'];
  var STCL = { 'Da aprire': 'info', 'Documenti mancanti': 'warn', 'Pronta da inviare': 'acc', 'Inviata': 'acc', 'In istruttoria': 'acc', 'Con esito': 'ok', 'Ricorso': 'warn' };
  var ENTE = { 'NASpI': 'INPS', 'DIS-COLL': 'INPS', 'ISEE/DSU': 'INPS', 'RED': 'INPS', 'Pensione vecchiaia': 'INPS', 'Pensione anticipata': 'INPS', 'Maternità': 'INPS', 'Congedo parentale': 'INPS', 'Assegno unico': 'INPS', '730': 'Agenzia delle Entrate', '730 integrativo': 'Agenzia delle Entrate', 'Redditi PF': 'Agenzia delle Entrate', 'Successione': 'Agenzia delle Entrate', 'Dimissioni telematiche': 'Ministero del Lavoro' };
  ENTE[INV] = 'INPS';
  var ENTE_SH = { 'INPS': 'INPS', 'Agenzia delle Entrate': 'AdE', 'Ministero del Lavoro': 'Min. Lavoro' };
  var GR = {
    prest: [{ k: 'Accolta', cl: 'ok' }, { k: 'Respinta', cl: 'bad', neg: 1 }],
    rim: [{ k: 'Ricevuta di presentazione', cl: 'ok' }],
    isee: [{ k: 'Attestazione rilasciata', cl: 'ok' }, { k: 'Attestazione rilasciata con omissioni/difformità', cl: 'warn' }],
    dim: [{ k: 'Conclusa', cl: 'ok' }, { k: 'Revocata', cl: 'info' }],
    succ: [{ k: 'Ricevuta', cl: 'ok' }]
  };
  var GRT = { 'ISEE/DSU': 'isee', '730': 'rim', '730 integrativo': 'rim', 'Redditi PF': 'rim', 'RED': 'rim', 'Dimissioni telematiche': 'dim', 'Successione': 'succ' };
  var AL_MESE = { 'NASpI': 1, 'DIS-COLL': 1, 'Pensione vecchiaia': 1, 'Pensione anticipata': 1, 'Assegno unico': 1 }; AL_MESE[INV] = 1;
  /* listino inventato: le pratiche di patronato verso l'INPS sono gratuite per il cittadino, i servizi fiscali hanno un prezzo */
  var LISTINO = { '730': 2500, '730 integrativo': 1500, 'Redditi PF': 4500, 'Successione': 25000 };
  var CAT_TIPO = { '730': '730 e dichiarazioni', '730 integrativo': '730 e dichiarazioni', 'Redditi PF': '730 e dichiarazioni', 'Successione': 'Successioni' };
  var ID = 'Documento d\'identità', IBAN = 'Codice IBAN', DAT = 'Dati del datore di lavoro', SPID = 'SPID o CIE per l\'accesso', SPESE = 'Spese detraibili non incluse nel 730 presentato';
  var DOCREQ = {
    'NASpI': [ID, 'Lettera di licenziamento', IBAN, 'Ultime buste paga'],
    'DIS-COLL': [ID, 'Iscrizione alla gestione separata', 'Estratto dei compensi', IBAN],
    'ISEE/DSU': [ID, 'Redditi del secondo anno precedente', 'Saldo al 31/12 e giacenza media dei conti', 'Contratto d\'affitto o rogito'],
    '730': ['Certificazione Unica', 'Spese mediche', 'Interessi del mutuo', 'Delega firmata'],
    '730 integrativo': ['Certificazione Unica', SPESE, 'Copia del 730 presentato', 'Delega firmata'],
    'Redditi PF': ['Certificazione Unica', SPESE, 'Copia del 730 presentato', 'Delega firmata'],
    'RED': [ID, 'Redditi percepiti nell\'anno', 'Redditi del coniuge', IBAN],
    'Pensione vecchiaia': [ID, 'Estratto contributivo', 'Periodi di lavoro all\'estero', IBAN, SPID],
    'Pensione anticipata': [ID, 'Estratto contributivo', 'Periodi di lavoro all\'estero', IBAN, SPID],
    'Maternità': ['Certificato medico di gravidanza', ID, DAT, IBAN],
    'Congedo parentale': ['Certificato di nascita del figlio', ID, DAT, IBAN],
    'Assegno unico': ['ISEE in corso di validità (senza, importo minimo)', IBAN, ID, 'Codici fiscali dei figli'],
    'Dimissioni telematiche': [ID, 'Data di decorrenza', DAT, 'Indirizzo email'],
    'Successione': ['Certificato di morte', 'Visura catastale', 'Dichiarazione sostitutiva di atto notorio', 'Elenco dei beni']
  };
  DOCREQ[INV] = ['Certificato medico introduttivo', ID, 'Documentazione sanitaria', IBAN];
  var DOCIF = { 'Redditi del coniuge': 'coniuge', 'Codici fiscali dei figli': 'figli' };
  var DSU_L = 'ABCDEFGHJKLMNPRSTVWXYZ';

  function D() { return B.dati(); }
  function S() { return D().settore; }
  function prat(id) { return S().pratiche.filter(function (p) { return p.id === id; })[0]; }
  function nome(c) { return B.clienti.nome(c); }
  function grp(t) { return GRT[t] || 'prest'; }
  function esOpts(p) { return GR[grp(p.t)]; }
  function esInfo(p) { return p.esito ? (esOpts(p).filter(function (o) { return o.k === p.esito.k; })[0] || { cl: 'info' }) : null; }
  function esNeg(p) { var i = esInfo(p); return !!(i && i.neg); }
  function chiusa(p) { return p.st === 'Con esito'; }
  function idx(p) { return STATI.indexOf(p.st); }
  function inviata(p) { return !!p.inv; }
  function mancanti(p) { return p.docs.filter(function (d) { return !d.ok; }); }
  function manca(n) { return n === 1 ? 'Manca 1 documento' : 'Mancano ' + n + ' documenti'; }
  function aperte() { return S().pratiche.filter(function (p) { return !chiusa(p); }); }
  function d(x) { return x ? U.pIso(x) : null; }
  function nucleo(c) { return (c && Array.isArray(c.nucleo)) ? c.nucleo : []; }
  function docsFor(t, c, nato) {
    var con = nucleo(c).some(function (n) { return /^coniuge/i.test(n[1]); }), fig = nucleo(c).some(function (n) { return /^figli/i.test(n[1]); });
    return DOCREQ[t].filter(function (n) { var r = DOCIF[n]; return !r || (r === 'coniuge' ? con : fig); })
      .map(function (n) { return (t === 'Maternità' && nato && n === 'Certificato medico di gravidanza') ? 'Dati del figlio e certificato di nascita' : n; });
  }
  function protLabel(p) { return p.t === 'ISEE/DSU' ? 'Protocollo DSU' : (p.ente === 'Agenzia delle Entrate' ? 'Protocollo telematico' : (p.ente === 'Ministero del Lavoro' ? 'Codice identificativo' : 'Protocollo')); }
  function protHint(t) {
    if (t === 'Dimissioni telematiche') return 'Data e ora della trasmissione al millisecondo: 17 cifre (aaaammgghhmmssSSS).';
    if (t === 'ISEE/DSU') return 'Formato INPS-ISEE-aaaa-NNNNNNNNX-00.';
    if (ENTE[t] === 'Agenzia delle Entrate') return '17 cifre, trattino e progressivo di 6 cifre.';
    return 'Formato INPS.nnnn.gg/mm/aaaa.nnnnnnn, con la data di invio.';
  }
  var SEME = 20261029;
  function rn() { SEME = (SEME * 16807) % 2147483647; return SEME / 2147483647; }
  function cifre(n) { var x = ''; for (var i = 0; i < n; i++) x += Math.floor(rn() * 10); return x; }
  var ADE_SEQ = 0;
  function genProt(p, dataInv) {
    var dd = d(dataInv) || U.oggi(), y = dd.getFullYear(), pad = U.pad;
    if (p.t === 'Dimissioni telematiche') return U.iso(dd).replace(/-/g, '') + pad(9 + Math.floor(rn() * 8)) + pad(Math.floor(rn() * 60)) + pad(Math.floor(rn() * 60)) + pad(Math.floor(rn() * 1000), 3);
    if (p.t === 'ISEE/DSU') return 'INPS-ISEE-' + y + '-' + cifre(8) + DSU_L.charAt(Math.floor(rn() * DSU_L.length)) + '-00';
    if (ENTE[p.t] === 'INPS') return 'INPS.' + ['5100', '5102', '5105'][Math.floor(rn() * 3)] + '.' + pad(dd.getDate()) + '/' + pad(dd.getMonth() + 1) + '/' + y + '.' + cifre(7);
    return cifre(17) + '-' + pad(++ADE_SEQ, 6);
  }
  /* controlla il formato del protocollo; restituisce l'errore o '' */
  function protOk(t, prot, inv) {
    prot = String(prot || '').trim(); var di = d(inv);
    if (t === 'Dimissioni telematiche') {
      if (!/^\d{17}$/.test(prot)) return 'Il codice identificativo deve avere 17 cifre (aaaammgghhmmssSSS).';
      var yy = +prot.slice(0, 4), mo = +prot.slice(4, 6), gg = +prot.slice(6, 8), hh = +prot.slice(8, 10), mi = +prot.slice(10, 12), ss = +prot.slice(12, 14), dx = new Date(yy, mo - 1, gg);
      if (!(yy >= 2000 && dx.getFullYear() === yy && dx.getMonth() === mo - 1 && dx.getDate() === gg)) return 'La data nel codice identificativo non esiste.';
      if (hh > 23 || mi > 59 || ss > 59) return 'L\'ora nel codice identificativo non è valida.';
      if (di && prot.slice(0, 8) !== U.iso(di).replace(/-/g, '')) return 'Il codice deve iniziare con la data di invio (' + U.iso(di).replace(/-/g, '') + ').';
      return '';
    }
    if (t === 'ISEE/DSU') {
      if (!new RegExp('^INPS-ISEE-\\d{4}-\\d{8}[' + DSU_L + ']-00$').test(prot)) return 'Il protocollo DSU non è nel formato INPS-ISEE-aaaa-NNNNNNNNX-00.';
      if (di && prot.slice(10, 14) !== String(di.getFullYear())) return 'L\'anno del protocollo DSU deve essere quello dell\'invio.';
      return '';
    }
    if (ENTE[t] === 'INPS') {
      var m = /^INPS\.\d{4}\.(\d{2})\/(\d{2})\/(\d{4})\.\d{7}$/.exec(prot);
      if (!m) return 'Il protocollo INPS non è nel formato INPS.nnnn.gg/mm/aaaa.nnnnnnn.';
      if (di && (m[3] + '-' + m[2] + '-' + m[1]) !== U.iso(di)) return 'La data nel protocollo deve essere quella di invio.';
      return '';
    }
    if (!/^\d{17}-\d{6}$/.test(prot)) return 'Il protocollo telematico deve avere 17 cifre, un trattino e 6 cifre.';
    return '';
  }
  function log(p, t) { p.log.push({ q: new Date().toISOString(), chi: B.chi(), t: t }); }
  function setTermini(p) { var c = d(p.esito.com); if (p.t === INV) { p.ric = null; p.atp = U.iso(U.piuMesi(c, 6)); } else { p.ric = U.iso(U.piuGiorni(c, 90)); p.atp = null; } }
  function azzeraEsito(p) { p.esito = null; p.ric = null; p.atp = null; p.ricPres = null; }
  /* prossima azione: dipende da stato, firme e documenti */
  function azioneP(p) {
    var nm = mancanti(p).length, i = idx(p), parti = [];
    if (i <= 2) {
      if (!p.mandato) parti.push('far firmare il mandato');
      if (!p.privacy) parti.push('far firmare l\'informativa privacy');
      if (nm && i <= 1) parti.unshift('raccogliere ' + (nm === 1 ? 'il documento mancante' : 'i ' + nm + ' documenti mancanti') + ' (' + mancanti(p).map(function (x) { return x.n; }).join(', ') + ')');
      if (parti.length) return U.cap(parti.join('; '));
      if (i <= 1) return 'Portare la pratica in «Pronta da inviare»';
      return 'Inserire il ' + protLabel(p).toLowerCase() + ' e inviare la pratica a ' + p.ente;
    }
    if (i === 3 || i === 4) {
      if (p.t === 'Dimissioni telematiche') return 'Attendere la fine del termine di revoca (' + U.fmt(U.piuGiorni(d(p.inv), 7)) + ')';
      if (p.integ && !p.integTerm) return 'Inserire il termine scritto nella lettera di integrazione';
      if (p.integ) return 'Evadere la richiesta di integrazione entro il ' + U.fmt(p.integTerm);
      return 'Attendere l\'esito da ' + p.ente;
    }
    if (p.st === 'Ricorso') { if (p.ricPres) return 'Attendere la decisione sul ricorso'; return p.t === INV ? 'Presentare l\'accertamento tecnico preventivo entro il ' + U.fmt(p.atp) : 'Presentare il ricorso entro il ' + U.fmt(p.ric); }
    if (p.esito && esNeg(p)) return 'Comunicare l\'esito e valutare ' + (p.t === INV ? 'l\'accertamento tecnico preventivo entro il ' + U.fmt(p.atp) : 'il ricorso entro il ' + U.fmt(p.ric));
    if (p.esito && U.diff(p.esito.com) >= -7) return 'Comunicare l\'esito al cittadino';
    return 'Nessuna: pratica definita';
  }
  function controlliInvio(p, o) {
    o = o || {}; var e = [], nm = mancanti(p).length, prot = o.prot != null ? o.prot : p.prot;
    if (nm) e.push(manca(nm).toLowerCase());
    if (!p.mandato) e.push('manca il mandato firmato');
    if (!p.privacy) e.push('manca l\'informativa privacy firmata');
    if (!o.senzaProt) { if (!String(prot || '').trim()) e.push('manca il ' + protLabel(p).toLowerCase()); else { var m = protOk(p.t, prot, o.inv || p.inv); if (m) e.push(m.charAt(0).toLowerCase() + m.slice(1).replace(/\.$/, '')); } }
    return e;
  }
  /* dimissioni: dopo 7 giorni senza revoca la pratica si conclude da sola */
  function autoConcludi(dati) {
    (dati.settore.pratiche || []).forEach(function (p) {
      if (p.t === 'Dimissioni telematiche' && p.inv && (p.st === 'Inviata' || p.st === 'In istruttoria') && !p.esito) {
        var rv = U.piuGiorni(d(p.inv), 7);
        if (U.diff(rv) < 0) { p.esito = { k: 'Conclusa', d: U.iso(rv), com: U.iso(rv), mot: '', imp: null, dir: '' }; p.st = 'Con esito'; p.log.push({ q: U.piuGiorni(rv, 1).toISOString(), chi: 'Automatico', t: 'Pratica conclusa: 7 giorni senza revoca' }); }
      }
    });
  }

  /* ---------- pillole e testi ---------- */
  function pillSt(p) {
    if (p.st === 'Con esito' && p.esito) return UI.pill(p.esito.k, esInfo(p).cl);
    return UI.pill(p.st === 'Inviata' ? 'Inviata · ' + ENTE_SH[p.ente] : p.st, STCL[p.st]);
  }
  function pagTesto(p) { if (!p.cost) return 'Gratuita'; return U.eur(p.cost) + (p.pagata ? ' · incassato il ' + U.fmt(p.pagata) : ' · da incassare'); }
  function impTesto(p) { var e = p.esito; if (e.imp == null) return ''; return U.eur(e.imp) + (e.dir ? ' (' + e.dir.toLowerCase() + ')' : (AL_MESE[p.t] ? ' al mese' : '')); }

  /* ---------- cambi di stato con le regole di lavoro ---------- */
  var APERTA = null;
  function aggiorna() { B.salva(); B.render(); if (APERTA && APERTA.rid) APERTA.rid(); }
  function sposta(p, st) {
    var da = p.st;
    if (STATI.indexOf(st) < 5 && p.esito) { azzeraEsito(p); log(p, 'Esito azzerato: la pratica è tornata in lavorazione'); }
    p.st = st; log(p, 'Stato cambiato: «' + da + '» → «' + st + '»');
    B.registra('Stato della pratica cambiato', p.t + ' · ' + nome(p.c), '«' + da + '» → «' + st + '»');
    aggiorna(); B.toast('Pratica in «' + st + '»');
  }
  function provaSposta(id, st) {
    var p = prat(id); if (!p || p.st === st) { aggiorna(); return; }
    var oi = idx(p), ni = STATI.indexOf(st);
    var no = function (m) { B.toast(m, true); aggiorna(); };
    if (p.t === 'Dimissioni telematiche' && chiusa(p)) return no('Le dimissioni concluse o revocate non si riaprono.');
    if (st === 'Ricorso') { if (!(p.esito && esNeg(p))) return no('Il ricorso si avvia solo da un esito negativo (respinta).'); return sposta(p, st); }
    if (st === 'Con esito') {
      if (p.st === 'Ricorso') return B.conferma('Riportare la pratica a «Con esito»?', 'Il ricorso risulta non avviato. L\'esito registrato resta com\'è.', 'Riporta indietro', function () { sposta(p, st); });
      if (!p.inv) return no('La pratica non è stata ancora inviata: non può avere un esito.');
      aggiorna(); return moduloEsito(p);
    }
    var indietro = ni < oi;
    if (indietro && p.inv && ni < 3) return no('La pratica è già stata inviata: non può tornare prima dell\'invio.');
    if (st === 'Documenti mancanti' && !mancanti(p).length) return no('Tutti i documenti ci sono: usa «Pronta da inviare».');
    if (ni >= 2 && ni <= 4 && mancanti(p).length) return no(manca(mancanti(p).length) + ': la pratica non può andare avanti.');
    if (ni >= 3 && !indietro && !p.inv) { var e0 = controlliInvio(p, { senzaProt: true }); if (e0.length) return no('Non si può inviare: ' + e0.join('; ') + '.'); aggiorna(); return moduloInvio(p, st); }
    if (indietro) {
      aggiorna();
      return B.conferma('Spostare la pratica indietro?', 'Da «' + p.st + '» a «' + st + '».' + (p.esito && ni < 5 ? ' L\'esito registrato sarà azzerato.' : '') + ' Data di invio e protocollo restano.', 'Sposta indietro', function () { sposta(p, st); }, true);
    }
    sposta(p, st);
  }
  function toggleDoc(p, i, ok) {
    if (inviata(p)) { B.toast('La pratica è già stata inviata: i documenti non si cambiano più.', true); aggiorna(); return; }
    p.docs[i].ok = ok; log(p, (ok ? 'Documento ricevuto: ' : 'Documento tolto: ') + p.docs[i].n);
    B.registra(ok ? 'Documento ricevuto' : 'Documento tolto', p.t + ' · ' + nome(p.c), p.docs[i].n);
    if (!mancanti(p).length && p.st === 'Documenti mancanti') { p.st = 'Pronta da inviare'; log(p, 'Stato cambiato: «Documenti mancanti» → «Pronta da inviare»'); B.toast('Documenti completi: pratica pronta da inviare'); }
    else if (mancanti(p).length && (p.st === 'Pronta da inviare' || p.st === 'Da aprire')) { var da = p.st; p.st = 'Documenti mancanti'; log(p, 'Stato cambiato: «' + da + '» → «Documenti mancanti»'); }
    aggiorna();
  }
  function firma(p, cosa, on) {
    if (!on && inviata(p)) { B.toast('Pratica già inviata: la firma non si toglie.', true); return; }
    p[cosa] = on ? U.iso(U.oggi()) : null;
    var t = cosa === 'mandato' ? 'Mandato' : 'Informativa privacy';
    log(p, on ? t + ' firmato' : t + ' tolto'); B.registra(on ? t + ' firmato' : t + ' tolto', p.t + ' · ' + nome(p.c), '');
    aggiorna(); B.toast(on ? t + ' firmato oggi' : t + ' tolto');
  }
  function incassa(p) {
    if (!p.cost || p.pagata) return;
    var m = B.movimenti.aggiungi({ data: U.iso(U.oggi()), tipo: 'entrata', categoria: CAT_TIPO[p.t] || 'Altri servizi', importo: p.cost, descrizione: 'Pratica ' + p.t + ' · ' + nome(p.c), cliente: p.c, stato: 'pagato', rif: p.id });
    p.pagata = m.data; p.mov = m.id;
    log(p, 'Incassati ' + U.eur(p.cost)); B.registra('Incasso registrato', p.t + ' · ' + nome(p.c), U.eur(p.cost) + ' · entra nel bilancio di ' + U.meseLabel(m.data.slice(0, 7)));
    aggiorna(); B.toast('Incassati ' + U.eur(p.cost) + ': ora sono nel bilancio del mese');
  }
  function annullaIncasso(p) {
    B.conferma('Annullare l\'incasso?', U.eur(p.cost) + ' esce dal bilancio' + (p.pagata && B.movimenti.meseChiuso(p.pagata.slice(0, 7)) ? ' e la chiusura di ' + U.meseLabel(p.pagata.slice(0, 7)) + ' si aggiorna' : '') + '.', 'Annulla incasso', function () {
      if (p.mov) B.movimenti.togli(p.mov);
      log(p, 'Incasso annullato'); B.registra('Incasso annullato', p.t + ' · ' + nome(p.c), U.eur(p.cost));
      p.pagata = null; p.mov = null; aggiorna(); B.toast('Incasso annullato');
    }, true);
  }

  /* ---------- moduli della pratica ---------- */
  function etichettaEv(t) { return t === 'Successione' ? 'Data del decesso' : 'Fine del rapporto di lavoro'; }
  function serveEv(t) { return t === 'NASpI' || t === 'DIS-COLL' || t === 'Successione'; }
  B.azione('pratica.nuova', function (v) {
    var c = B.clienti.trova(v.c); if (!c) return { campo: { c: 'Scegli una persona in archivio.' } };
    if (TIPI.indexOf(v.t) < 0) return { campo: { t: 'Tipo non valido.' } };
    var p = { id: U.nuovoId('pr'), c: v.c, t: v.t, st: 'Da aprire', op: v.op, ap: U.iso(U.oggi()), ente: ENTE[v.t], mandato: null, privacy: null, prot: '', inv: null, ev: serveEv(v.t) ? v.ev || null : null, integ: null, integTerm: null, sc: v.t === 'RED' ? v.sc || null : null, nato: false, cost: v.cost || 0, pagata: null, mov: null, esito: null, ric: null, atp: null, ricPres: null, dom: v.t === INV ? v.dom : '', note: [], log: [] };
    p.docs = docsFor(v.t, c, false).map(function (n) { return { n: n, ok: false }; });
    p.st = 'Documenti mancanti';
    log(p, 'Pratica aperta');
    if (v.nota) { p.note.push({ q: new Date().toISOString(), chi: B.chi(), t: v.nota }); }
    S().pratiche.push(p);
    B.registra('Pratica aperta', v.t + ' · ' + c.nome, 'Operatrice ' + v.op + (p.cost ? ' · ' + U.eur(p.cost) : ' · gratuita'));
    return { id: p.id };
  });
  function moduloNuova(cliente) {
    return B.modulo({
      titolo: 'Nuova pratica', id: 'pratica-nuova' + (cliente ? '-' + cliente : ''), azione: 'pratica.nuova', larga: true, toast: 'Pratica aperta',
      campi: [
        { k: 'c', l: 'Cittadino', tipo: 'select', obbl: true, opzioni: function () { return B.clienti.opzioni('Scegli…'); }, hint: 'Non c\'è? Crealo prima da «Cittadini».' },
        { k: 't', l: 'Tipo di pratica', tipo: 'select', opzioni: TIPI },
        { k: 'op', l: 'Operatrice', tipo: 'select', opzioni: OPE },
        { k: 'ev', l: 'Data dell\'evento', tipo: 'date', obbl: true, se: function (g) { return serveEv(g.t); }, hint: 'Fine del rapporto (NASpI, DIS-COLL) o data del decesso (successione): da qui partono i termini.', valida: function (x) { return x > U.iso(U.oggi()) ? 'Non può essere nel futuro.' : ''; } },
        { k: 'sc', l: 'Scadenza fissata dall\'INPS per il RED', tipo: 'date', se: function (g) { return g.t === 'RED'; } },
        { k: 'dom', l: 'Cosa si chiede', tipo: 'select', opzioni: ['Assegno o pensione di invalidità', 'Indennità di accompagnamento', 'Entrambe'], se: function (g) { return g.t === INV; } },
        { k: 'cost', l: 'Prezzo (€, 0 se gratuita)', tipo: 'importo', zero: true, maxImporto: 500000, hint: 'Dal listino: le pratiche INPS sono gratuite.' },
        { k: 'nota', l: 'Nota iniziale', tipo: 'textarea', max: 800 }
      ],
      valori: { c: cliente || '', t: 'NASpI', op: OPE[0], cost: 0, dom: 'Indennità di accompagnamento' },
      cambia: function (k, g, set) { if (k === 't') set('cost', U.importoTesto(LISTINO[g.t] || 0)); },
      avvisi: function (v) {
        var w = [], c = B.clienti.trova(v.c);
        if (S().pratiche.some(function (p) { return p.c === v.c && p.t === v.t && !chiusa(p); })) w.push(nome(v.c) + ' ha già una pratica «' + v.t + '» aperta.');
        if ((v.t === 'NASpI' || v.t === 'DIS-COLL') && v.ev && U.diff(v.ev) < -68) w.push('Sono passati più di 68 giorni dalla fine del rapporto: la domanda rischia di essere fuori termine.');
        if (v.t === 'Successione' && v.ev && U.diff(U.iso(U.piuMesi(d(v.ev), 12))) < 0) w.push('Sono passati più di 12 mesi dal decesso: la dichiarazione è in ritardo.');
        if (v.t === INV && c && c.nascita && v.dom !== 'Indennità di accompagnamento') { var a = U.oggi().getFullYear() - d(c.nascita).getFullYear(); if (a >= 67) w.push('Oltre i 67 anni non si chiede l\'assegno di invalidità: di solito solo l\'indennità di accompagnamento.'); }
        return w;
      },
      dopo: function (r) { if (r && r.id) setTimeout(function () { apriPratica(r.id); }, 0); }
    });
  }
  B.azione('pratica.invio', function (v, ctx) {
    var p = prat(ctx.id); if (!p) return { errore: 'Pratica non trovata.' };
    var e = controlliInvio(p, { prot: v.prot, inv: v.inv }); if (e.length) return { errore: 'Non si può inviare: ' + e.join('; ') + '.' };
    p.inv = v.inv; p.prot = v.prot; var da = p.st; p.st = ctx.st || 'Inviata';
    log(p, 'Pratica inviata (' + p.ente + '), ' + protLabel(p).toLowerCase() + ' ' + p.prot);
    B.registra('Pratica inviata', p.t + ' · ' + nome(p.c), p.ente + ' · ' + p.prot + ' · da «' + da + '»');
    return {};
  });
  function moduloInvio(p, st) {
    return B.modulo({
      titolo: 'Invio a ' + p.ente, id: 'invio-' + p.id, azione: 'pratica.invio', contesto: { id: p.id, st: st }, toast: 'Pratica inviata',
      intro: h('p', { class: 'hint' }, 'Inserisci il protocollo che ti ha dato ' + p.ente + ' dopo la trasmissione. ' + protHint(p.t)),
      campi: [
        { k: 'inv', l: 'Data di invio', tipo: 'date', obbl: true, valida: function (x) { return x > U.iso(U.oggi()) ? 'Non può essere nel futuro.' : (x < p.ap ? 'Non può essere prima dell\'apertura (' + U.fmt(p.ap) + ').' : ''); } },
        { k: 'prot', l: protLabel(p), obbl: true, max: 60, valida: function (x, g) { return protOk(p.t, x, g.inv); } }
      ],
      valori: { inv: U.iso(U.oggi()), prot: '' },
      dopo: function () { if (APERTA && APERTA.rid) APERTA.rid(); }
    }).el.querySelector('.actions').appendChild(UI.btn('Genera un protocollo di prova', function () {
      var f = document.querySelector('.sheet input[name=prot]'), di = document.querySelector('.sheet input[name=inv]');
      if (f) { f.value = genProt(p, di && di.value); f.dispatchEvent(new Event('input')); }
    }, 'sec', { title: 'Solo nella demo: crea un protocollo nel formato giusto' }));
  }
  B.azione('pratica.esito', function (v, ctx) {
    var p = prat(ctx.id); if (!p) return { errore: 'Pratica non trovata.' };
    if (!p.inv) return { errore: 'La pratica non è stata inviata.' };
    if (v.d < p.inv) return { campo: { d: 'L\'esito non può essere prima dell\'invio (' + U.fmt(p.inv) + ').' } };
    var opt = esOpts(p).filter(function (o) { return o.k === v.k; })[0]; if (!opt) return { campo: { k: 'Esito non valido.' } };
    if (opt.neg && !v.mot) return { campo: { mot: 'Per un esito negativo scrivi la motivazione: serve per il ricorso.' } };
    p.esito = { k: v.k, d: v.d, com: v.com || v.d, mot: v.mot || '', imp: v.imp, dir: grp(p.t) === 'rim' && v.imp != null ? v.dir : '' };
    p.ric = null; p.atp = null; if (opt.neg) setTermini(p);
    var da = p.st; p.st = 'Con esito';
    log(p, 'Esito registrato: ' + v.k + (v.imp != null ? ' · ' + impTesto(p) : ''));
    B.registra('Esito registrato', p.t + ' · ' + nome(p.c), v.k + ' · da «' + da + '»');
    return {};
  });
  function moduloEsito(p) {
    var rim = grp(p.t) === 'rim', prest = grp(p.t) === 'prest';
    return B.modulo({
      titolo: 'Esito della pratica', id: 'esito-' + p.id, azione: 'pratica.esito', contesto: { id: p.id }, toast: 'Esito registrato',
      campi: [
        { k: 'k', l: 'Esito', tipo: 'select', opzioni: esOpts(p).map(function (o) { return o.k; }) },
        { k: 'd', l: 'Data dell\'esito', tipo: 'date', obbl: true, valida: function (x) { return x > U.iso(U.oggi()) ? 'Non può essere nel futuro.' : ''; } },
        { k: 'com', l: 'Data della comunicazione al cittadino', tipo: 'date', hint: 'Da qui partono i termini di ricorso. Se vuota, vale la data dell\'esito.' },
        { k: 'dir', l: 'Risultato', tipo: 'select', opzioni: ['Rimborso', 'Debito'], se: function () { return rim; } },
        { k: 'imp', l: rim ? 'Importo del rimborso o del debito (€)' : 'Importo (€, se c\'è)', tipo: 'importo', se: function (g) { return rim || (prest && g.k === 'Accolta'); }, maxImporto: 10000000 },
        { k: 'mot', l: 'Motivazione', tipo: 'textarea', max: 800, se: function (g) { return g.k !== 'Accolta' && g.k !== 'Ricevuta di presentazione' && g.k !== 'Ricevuta' && g.k !== 'Attestazione rilasciata' && g.k !== 'Conclusa'; } }
      ],
      valori: { k: esOpts(p)[0].k, d: U.iso(U.oggi()), dir: 'Rimborso' },
      dopo: function () { if (APERTA && APERTA.rid) APERTA.rid(); }
    });
  }
  B.azione('pratica.modifica', function (v, ctx) {
    var p = prat(ctx.id); if (!p) return { errore: 'Pratica non trovata.' };
    if (p.inv && v.prot !== p.prot) { var m = protOk(p.t, v.prot, p.inv); if (m) return { campo: { prot: m } }; }
    if (v.integTerm && !v.integ) return { campo: { integ: 'Inserisci anche la data della richiesta di integrazione.' } };
    if (v.integ && p.inv && v.integ < p.inv) return { campo: { integ: 'La richiesta di integrazione non può essere prima dell\'invio.' } };
    var cambi = [];
    ['op', 'ev', 'sc', 'integ', 'integTerm', 'prot'].forEach(function (k) { if (v[k] === undefined) return; var nv = v[k] || (k === 'prot' ? p.prot : null); if (k === 'prot' && !p.inv) return; if ((p[k] || null) !== (nv || null)) { cambi.push(k); p[k] = nv; } });
    if (!p.pagata && v.cost != null && v.cost !== p.cost) { cambi.push('prezzo'); p.cost = v.cost; }
    if (cambi.length) { log(p, 'Dati modificati: ' + cambi.join(', ')); B.registra('Pratica modificata', p.t + ' · ' + nome(p.c), cambi.join(', ')); }
    return {};
  });
  function moduloModifica(p) {
    var sent = p.st === 'Inviata' || p.st === 'In istruttoria';
    return B.modulo({
      titolo: 'Modifica dati · ' + p.t, id: 'modpr-' + p.id, azione: 'pratica.modifica', contesto: { id: p.id }, toast: 'Dati aggiornati: scadenze ricalcolate', larga: true,
      campi: [
        { k: 'op', l: 'Operatrice', tipo: 'select', opzioni: OPE },
        { k: 'ev', l: etichettaEv(p.t), tipo: 'date', se: function () { return serveEv(p.t); } },
        { k: 'sc', l: 'Scadenza RED fissata dall\'INPS', tipo: 'date', se: function () { return p.t === 'RED'; } },
        { k: 'prot', l: protLabel(p), max: 60, se: function () { return !!p.inv; } },
        { k: 'integ', l: 'Data della richiesta di integrazione INPS', tipo: 'date', se: function () { return sent && p.ente === 'INPS'; } },
        { k: 'integTerm', l: 'Termine scritto nella lettera', tipo: 'date', se: function () { return sent && p.ente === 'INPS'; } },
        { k: 'cost', l: 'Prezzo (€, 0 se gratuita)', tipo: 'importo', zero: true, maxImporto: 500000, se: function () { return !p.pagata; } }
      ],
      valori: { op: p.op, ev: p.ev || '', sc: p.sc || '', prot: p.prot, integ: p.integ || '', integTerm: p.integTerm || '', cost: p.cost },
      dopo: function () { if (APERTA && APERTA.rid) APERTA.rid(); }
    });
  }

  /* ---------- scheda della pratica ---------- */
  function apriPratica(id) {
    var p = prat(id); if (!p) { B.toast('Pratica non trovata.', true); return; }
    var corpo = h('div');
    var m = B.modale(p.t + ' · ' + nome(p.c), corpo, { larga: true, dopo: function () { if (APERTA && APERTA.m === m) APERTA = null; } });
    APERTA = { m: m, rid: function () { var q = prat(id); if (!q) { m.chiudi('tolta'); return; } corpo.textContent = ''; corpo.appendChild(schedaPratica(q, m)); } };
    APERTA.rid();
  }
  function schedaPratica(p, m) {
    var nm = mancanti(p).length, sent = inviata(p);
    var sel = h('select', { 'aria-label': 'Stato della pratica' }, STATI.map(function (x) { return h('option', { value: x }, x); }));
    sel.value = p.st; sel.addEventListener('change', function () { provaSposta(p.id, sel.value); });
    var nota = h('textarea', { 'aria-label': 'Nuova nota', placeholder: 'Scrivi una nota…', maxlength: '800' });
    var docs = h('div', { class: 'list' }, p.docs.map(function (dc, i) {
      var cb = h('input', { type: 'checkbox', checked: dc.ok, disabled: sent, id: 'doc-' + p.id + '-' + i });
      cb.addEventListener('change', function () { toggleDoc(p, i, cb.checked); });
      return h('label', { class: 'check', for: 'doc-' + p.id + '-' + i }, cb, h('span', dc.n), dc.ok ? null : UI.pill('manca', 'warn'));
    }));
    var es = p.esito;
    return h('div',
      h('div', { class: 'row' }, pillSt(p), UI.pill(p.ente, 'info'), UI.pill(p.mandato ? 'Mandato firmato' : 'Senza mandato', p.mandato ? 'ok' : 'bad'), UI.pill(p.privacy ? 'Privacy firmata' : 'Privacy da firmare', p.privacy ? 'ok' : 'warn'), UI.pill(pagTesto(p), p.cost ? (p.pagata ? 'ok' : 'warn') : 'info')),
      h('div', { class: 'ibox' }, 'Prossima azione: ' + azioneP(p)),
      h('div', { class: 'grid g2' },
        h('div', { class: 'card' }, h('h3', 'Stato'), sel,
          h('div', { class: 'row', style: { marginTop: '10px', marginBottom: '0' } },
            sent && !es ? UI.btn('Registra esito', function () { moduloEsito(p); }, 'sm') : null,
            p.st === 'Ricorso' && !p.ricPres ? UI.btn(p.t === INV ? 'ATP presentato oggi' : 'Ricorso presentato oggi', function () { p.ricPres = U.iso(U.oggi()); log(p, p.t === INV ? 'Accertamento tecnico preventivo presentato' : 'Ricorso presentato'); B.registra('Ricorso presentato', p.t + ' · ' + nome(p.c), ''); aggiorna(); }, 'sm') : null,
            !sent && !nm && p.mandato && p.privacy ? UI.btn('Invia a ' + ENTE_SH[p.ente], function () { provaSposta(p.id, 'Inviata'); }, 'sm') : null),
          h('dl', { class: 'kv', style: { marginTop: '12px' } }, h('dt', 'Aperta il'), h('dd', U.fmt(p.ap)), h('dt', 'Operatrice'), h('dd', p.op),
            serveEv(p.t) ? [h('dt', etichettaEv(p.t)), h('dd', U.fmt(p.ev))] : null, p.t === 'RED' ? [h('dt', 'Scadenza RED'), h('dd', U.fmt(p.sc))] : null, p.dom ? [h('dt', 'Domanda'), h('dd', p.dom)] : null)),
        h('div', { class: 'card' }, h('h3', 'Firme'),
          h('div', { class: 'item' }, h('div', { class: 't' }, h('b', 'Mandato di patrocinio'), h('span', p.mandato ? 'Firmato il ' + U.fmt(p.mandato) : 'Da firmare prima dell\'invio')), p.mandato ? (sent ? null : UI.btn('Togli', function () { firma(p, 'mandato', false); }, 'sec sm')) : UI.btn('Firmato oggi', function () { firma(p, 'mandato', true); }, 'sm')),
          h('div', { class: 'item' }, h('div', { class: 't' }, h('b', 'Informativa privacy'), h('span', p.privacy ? 'Firmata il ' + U.fmt(p.privacy) : 'Da firmare prima dell\'invio')), p.privacy ? (sent ? null : UI.btn('Togli', function () { firma(p, 'privacy', false); }, 'sec sm')) : UI.btn('Firmata oggi', function () { firma(p, 'privacy', true); }, 'sm'))),
        h('div', { class: 'card' }, h('h3', 'Documenti richiesti' + (nm ? ' · ' + manca(nm).toLowerCase() : ' · completi')), docs, sent ? h('p', { class: 'hint', style: { margin: '8px 0 0' } }, 'Pratica inviata: la checklist è bloccata.') : null),
        h('div', { class: 'card' }, h('h3', 'Invio e protocollo'),
          h('dl', { class: 'kv' }, h('dt', 'Ente'), h('dd', p.ente), h('dt', protLabel(p)), h('dd', { class: 'mono' }, p.prot || '—'), h('dt', 'Inviata il'), h('dd', U.fmt(p.inv)),
            p.integ ? [h('dt', 'Integrazione richiesta'), h('dd', U.fmt(p.integ) + (p.integTerm ? ' · termine ' + U.fmt(p.integTerm) : ' · termine da inserire'))] : null),
          h('div', { style: { marginTop: '10px' } }, UI.btn('Modifica dati', function () { moduloModifica(p); }, 'sec sm'))),
        es ? h('div', { class: 'card' }, h('h3', 'Esito'), h('dl', { class: 'kv' }, h('dt', 'Esito'), h('dd', es.k), h('dt', 'Data'), h('dd', U.fmt(es.d)), h('dt', 'Comunicato il'), h('dd', U.fmt(es.com)),
          es.imp != null ? [h('dt', 'Importo'), h('dd', impTesto(p))] : null, es.mot ? [h('dt', 'Motivazione'), h('dd', es.mot)] : null,
          p.ric ? [h('dt', 'Ricorso entro'), h('dd', U.fmt(p.ric) + ' (90 giorni: verificare il termine nel provvedimento)')] : null,
          p.atp ? [h('dt', 'ATP entro'), h('dd', U.fmt(p.atp) + ' (6 mesi: verificare il termine nel provvedimento)')] : null,
          p.ricPres ? [h('dt', 'Ricorso presentato'), h('dd', U.fmt(p.ricPres))] : null)) : null,
        h('div', { class: 'card' }, h('h3', 'Pagamento'), h('p', null, pagTesto(p)),
          p.cost && !p.pagata ? UI.btn('Segna incassato oggi', function () { incassa(p); }, 'sm') : null,
          p.pagata ? UI.btn('Annulla incasso', function () { annullaIncasso(p); }, 'no sm') : null,
          !p.cost ? h('p', { class: 'hint' }, 'Le pratiche di patronato verso l\'INPS sono gratuite per il cittadino.') : h('p', { class: 'hint', style: { marginTop: '8px' } }, 'L\'incasso entra da solo nel bilancio del mese.'))),
      h('div', { class: 'card', style: { marginTop: '14px' } }, h('h3', 'Note'),
        p.note.length ? h('div', { class: 'list' }, p.note.slice().reverse().map(function (n) { return h('div', { class: 'item' }, h('div', { class: 't' }, h('b', n.t), h('span', U.fmtDT(n.q) + ' · ' + n.chi))); })) : h('p', { class: 'hint' }, 'Nessuna nota.'),
        h('div', { class: 'f', style: { marginTop: '10px' } }, nota),
        UI.btn('Aggiungi nota', function () {
          var t = nota.value.trim(); if (!t) { B.toast('Scrivi prima la nota.', true); nota.focus(); return; }
          p.note.push({ q: new Date().toISOString(), chi: B.chi(), t: t.slice(0, 800) }); log(p, 'Nota aggiunta'); B.registra('Nota aggiunta', p.t + ' · ' + nome(p.c), t.slice(0, 80)); aggiorna(); B.toast('Nota aggiunta');
        }, 'sec sm')),
      h('div', { class: 'card', style: { marginTop: '14px' } }, h('h3', 'Storico della pratica'),
        h('div', { class: 'tl' }, p.log.slice().reverse().map(function (l) { return h('div', { class: 'ev' }, h('small', U.fmtDT(l.q) + ' · ' + l.chi), h('p', l.t)); }))),
      h('div', { class: 'actions' },
        UI.btn('Copia il messaggio per il cittadino', function () { copiaMessaggio(p); }, 'sec'),
        UI.btn('Apri la scheda di ' + nome(p.c), function () { B.stato.f.schedaTab = 'pratiche'; B.vai('clienti', p.c); }, 'sec'),
        UI.btn('Elimina pratica', function () {
          if (p.pagata) { B.toast('Prima annulla l\'incasso: il movimento è nel bilancio.', true); return; }
          B.conferma('Eliminare la pratica?', p.t + ' · ' + nome(p.c) + '. Lo storico della pratica si perde; resta la voce nel registro modifiche.', 'Elimina', function () {
            S().pratiche = S().pratiche.filter(function (x) { return x.id !== p.id; });
            B.registra('Pratica eliminata', p.t + ' · ' + nome(p.c), p.st); m.chiudi('eliminata'); aggiorna(); B.toast('Pratica eliminata');
          }, true);
        }, 'no')));
  }

  /* testo pronto da mandare o stampare per il cittadino: cosa portare, a che punto è */
  function messaggio(p) {
    var c = B.clienti.trova(p.c), r = ['Gentile ' + (c ? c.nome : '') + ',', ''];
    var mm = mancanti(p);
    if (mm.length && !inviata(p)) { r.push('per la pratica ' + p.t + ' ci servono ancora:'); mm.forEach(function (x) { r.push('- ' + x.n); }); }
    if (!inviata(p) && (!p.mandato || !p.privacy)) r.push('Allo sportello firmeremo ' + [!p.mandato ? 'il mandato' : '', !p.privacy ? 'l\'informativa privacy' : ''].filter(Boolean).join(' e ') + '.');
    if (inviata(p) && !p.esito) r.push('la pratica ' + p.t + ' è stata inviata a ' + p.ente + ' il ' + U.fmt(p.inv) + ' (' + protLabel(p).toLowerCase() + ' ' + p.prot + '). Ti avvisiamo appena arriva l\'esito.');
    if (p.esito) r.push('la pratica ' + p.t + ' ha questo esito: ' + p.esito.k + (p.esito.imp != null ? ', ' + impTesto(p) : '') + '.' + (p.ric ? ' Se vuoi fare ricorso, il termine è il ' + U.fmt(p.ric) + ': passa allo sportello.' : '') + (p.atp ? ' Per l\'accertamento tecnico preventivo il termine è il ' + U.fmt(p.atp) + '.' : ''));
    if (r.length === 2) r.push('la pratica ' + p.t + ' è in lavorazione.');
    r.push('', 'Orari: lun–ven 9:00–13:00 e 15:30–18:30.');
    return r.join('\n');
  }
  function copiaMessaggio(p) {
    var t = messaggio(p), area = h('textarea', { readOnly: true, class: 'mono', 'aria-label': 'Messaggio per il cittadino', style: { minHeight: '200px' } });
    area.value = t;
    var m = B.modale('Messaggio per ' + nome(p.c), h('div', h('p', { class: 'hint' }, 'Da mandare per SMS o email, o da stampare e consegnare. Controlla sempre prima di inviare.'), area,
      h('div', { class: 'actions' }, UI.btn('Copia', function () {
        area.select();
        var ok = function () { B.toast('Messaggio copiato'); B.registra('Messaggio preparato per il cittadino', p.t + ' · ' + nome(p.c), ''); B.salva(); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { B.toast('Copia non riuscita: seleziona il testo a mano.', true); }); else B.toast('Seleziona il testo e copialo.');
      }), UI.btn('Chiudi', function () { m.chiudi('x'); }, 'sec'))));
  }

  /* ---------- sezione Pratiche ---------- */
  function filtrate() {
    var f = B.stato.f;
    return S().pratiche.filter(function (p) {
      return (!f.prT || p.t === f.prT) && (!f.prOp || p.op === f.prOp) && (!f.prFirme || (!chiusa(p) && (!p.mandato || !p.privacy))) && (!f.prQ || U.norm(p.t + ' ' + nome(p.c) + ' ' + p.prot).indexOf(U.norm(f.prQ)) > -1);
    });
  }
  function pcard(p) {
    var nm = mancanti(p).length, mob = window.matchMedia && window.matchMedia('(max-width:820px)').matches;
    var sel = h('select', { 'aria-label': 'Sposta ' + p.t + ' di ' + nome(p.c) + ' in un altro stato' }, STATI.map(function (x) { return h('option', { value: x }, x); }));
    sel.value = p.st; sel.addEventListener('change', function () { provaSposta(p.id, sel.value); });
    var c = h('div', { class: 'pcard', draggable: mob ? null : 'true', 'data-pid': p.id },
      h('button', { class: 'clink', type: 'button', on: { click: function () { apriPratica(p.id); } } }, p.t),
      h('small', nome(p.c) + ' · ' + p.op.split(' ')[0]), p.prot ? h('small', { class: 'mono' }, p.prot) : null,
      h('div', { class: 'pills' }, chiusa(p) ? pillSt(p) : null, UI.pill(ENTE_SH[p.ente], 'info'), p.mandato ? null : UI.pill('Senza mandato', 'bad'), nm && !chiusa(p) ? UI.pill(U.pl(nm, 'documento mancante', 'documenti mancanti'), 'warn') : null, p.cost && !p.pagata ? UI.pill('Da incassare ' + U.eur(p.cost), 'warn') : null),
      sel);
    if (!mob) {
      c.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('drag'); });
      c.addEventListener('dragend', function () { c.classList.remove('drag'); });
    }
    return c;
  }
  function vPratiche() {
    var f = B.stato.f, mob = window.matchMedia && window.matchMedia('(max-width:820px)').matches, modo = f.prModo || 'colonne';
    var righe = filtrate(), ap = aperte();
    var ferme = ap.filter(function (p) { return p.st === 'Documenti mancanti'; }).length, firme = ap.filter(function (p) { return !p.mandato || !p.privacy; }).length, pronte = ap.filter(function (p) { return p.st === 'Pronta da inviare'; }).length;
    var corpo;
    if (modo === 'colonne') {
      var stati = STATI, pre = null;
      if (mob) {
        var scelto = f.prCol && STATI.indexOf(f.prCol) > -1 ? f.prCol : (STATI.filter(function (x) { return righe.some(function (p) { return p.st === x; }); })[0] || STATI[0]);
        stati = [scelto];
        pre = h('div', { class: 'chips', role: 'group', 'aria-label': 'Scegli lo stato' }, STATI.map(function (x) {
          return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(x === scelto), on: { click: function () { f.prCol = x; B.render(); } } }, x + ' (' + righe.filter(function (p) { return p.st === x; }).length + ')');
        }));
      }
      corpo = h('div', pre, h('div', { class: 'board' }, h('div', { class: 'cols' + (mob ? ' one' : '') }, stati.map(function (st) {
        var ps = righe.filter(function (p) { return p.st === st; });
        if (st === 'Con esito') ps.sort(function (a, b) { return (b.esito ? b.esito.d : '') < (a.esito ? a.esito.d : '') ? -1 : 1; });
        var vis = st === 'Con esito' && !f.prTutte ? ps.slice(0, 5) : ps;
        var col = h('div', { class: 'col', 'data-drop': st }, h('h3', st + ' (' + ps.length + ')'), vis.map(pcard), !ps.length ? h('p', { class: 'hint' }, 'Nessuna pratica.') : null,
          st === 'Con esito' && ps.length > 5 ? UI.btn(f.prTutte ? 'Solo le ultime 5' : 'Mostra tutte (' + ps.length + ')', function () { f.prTutte = !f.prTutte; B.render(); }, 'sec sm') : null);
        col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); });
        col.addEventListener('dragleave', function () { col.classList.remove('over'); });
        col.addEventListener('drop', function (e) { e.preventDefault(); col.classList.remove('over'); var id = e.dataTransfer.getData('text/plain'); if (id) provaSposta(id, st); });
        return col;
      }))));
    } else {
      corpo = UI.tabella([
        { t: 'Pratica', v: function (p) { return h('b', p.t); } },
        { t: 'Cittadino', v: function (p) { return nome(p.c); } },
        { t: 'Stato', v: pillSt },
        { t: 'Operatrice', v: function (p) { return p.op; } },
        { t: 'Firme', v: function (p) { return !p.mandato ? UI.pill('Senza mandato', 'bad') : (!p.privacy ? UI.pill('Privacy da firmare', 'warn') : UI.pill('Complete', 'ok')); } },
        { t: 'Prossima azione', v: azioneP },
        { t: 'Aperta', v: function (p) { return U.fmt(p.ap); } }
      ], righe.slice().sort(function (a, b) { return a.ap < b.ap ? 1 : -1; }), { apri: function (p) { apriPratica(p.id); }, vuoto: 'Nessuna pratica con questi filtri' });
    }
    var q = h('input', { type: 'search', placeholder: 'Cerca tipo, cittadino, protocollo…', 'aria-label': 'Cerca tra le pratiche', value: f.prQ || '', maxlength: '80' });
    q.addEventListener('change', function () { f.prQ = q.value; B.render(); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { f.prQ = q.value; B.render(); } });
    return [
      UI.intestazione('Pratiche', 'Dal primo contatto all\'esito. Per inviare servono documenti completi, mandato, privacy e protocollo nel formato dell\'ente: la regola vale su ogni strada (menu, trascinamento, scheda).',
        [UI.btn('Nuova pratica', function () { moduloNuova(null); }), UI.btn('Esporta CSV', function () { var r = datiCsv(); UI.esportaCsv('Pratiche', r.testa, r.righe); }, 'sec')]),
      h('div', { class: 'grid g4 mb' },
        UI.kpi({ n: ap.length, l: 'Pratiche aperte' }), UI.kpi({ n: ferme, l: 'Ferme per documenti', col: ferme ? 'warn' : '' }),
        UI.kpi({ n: pronte, l: 'Pronte da inviare' }), UI.kpi({ n: firme, l: 'Senza mandato o privacy', col: firme ? 'bad' : '', vai: function () { f.prFirme = !f.prFirme; B.render(); } })),
      h('div', { class: 'row' }, UI.seg([['colonne', 'Per stato'], ['tabella', 'Tabella']], modo, function (v) { f.prModo = v; B.render(); }, 'Vista delle pratiche'),
        h('div', { class: 'grow' }, q),
        UI.selettore([['', 'Tutti i tipi']].concat(TIPI), f.prT || '', function (v) { f.prT = v; B.render(); }, 'Filtra per tipo'),
        UI.selettore([['', 'Tutte le operatrici']].concat(OPE), f.prOp || '', function (v) { f.prOp = v; B.render(); }, 'Filtra per operatrice'),
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!!f.prFirme), on: { click: function () { f.prFirme = !f.prFirme; B.render(); } } }, 'Solo senza firme')),
      corpo];
  }
  function datiCsv() {
    return { testa: ['Tipo', 'Cittadino', 'Stato', 'Ente', 'Operatrice', 'Aperta', 'Mandato', 'Privacy', 'Protocollo', 'Inviata', 'Esito', 'Data esito', 'Prezzo (€)', 'Incassato', 'Prossima azione'],
      righe: S().pratiche.map(function (p) { return [p.t, nome(p.c), p.st, p.ente, p.op, p.ap, p.mandato || '', p.privacy || '', p.prot, p.inv || '', p.esito ? p.esito.k : '', p.esito ? p.esito.d : '', U.importoTesto(p.cost), p.pagata || '', azioneP(p)]; }) };
  }

  /* ---------- scadenze del mestiere ---------- */
  function scadenze(dati) {
    var out = [], Y = U.oggi().getFullYear(), visI = {}, visA = {};
    (dati.settore.pratiche || []).forEach(function (p) {
      var add = function (tipo, desc, data) { out.push({ data: U.iso(data), tipo: tipo, titolo: desc, sotto: nome(p.c) + ' · ' + p.op.split(' ')[0], vai: function () { apriPratica(p.id); } }); };
      var i = idx(p), pre = i <= 2, sent = p.st === 'Inviata' || p.st === 'In istruttoria';
      if (p.integ && p.integTerm && sent && p.ente === 'INPS') add('Integrazione INPS', p.t + ': termine scritto nella lettera di integrazione', d(p.integTerm));
      if ((p.t === 'NASpI' || p.t === 'DIS-COLL') && p.ev && pre) add(p.t, 'Domanda entro 68 giorni dalla fine del rapporto', U.piuGiorni(d(p.ev), 68));
      if (p.t === 'Dimissioni telematiche' && p.inv && sent) add(p.t, 'Ultimo giorno per la revoca (7 giorni dalla trasmissione)', U.piuGiorni(d(p.inv), 7));
      if (p.t === 'RED' && p.sc && !chiusa(p)) add('RED', 'Invio del RED entro la scadenza fissata dall\'INPS', d(p.sc));
      if (p.t === 'Successione' && p.ev && !chiusa(p)) add('Successione', 'Dichiarazione di successione entro 12 mesi dal decesso', U.piuMesi(d(p.ev), 12));
      if (p.t === 'ISEE/DSU' && p.esito && !visI[p.c]) { visI[p.c] = 1; add('ISEE/DSU', 'Rinnovo ISEE: la DSU in corso vale fino al 31 dicembre', new Date(Y + 1, 0, 1)); }
      if (p.t === 'Assegno unico' && !(p.esito && esNeg(p)) && !visA[p.c]) { visA[p.c] = 1; add('Assegno unico', 'ISEE aggiornato entro il 28 febbraio per non avere l\'importo minimo', new Date(Y + 1, 1, 28)); }
      if (p.esito && esNeg(p) && !p.ricPres && (p.st === 'Con esito' || p.st === 'Ricorso')) {
        if (p.ric) add('Ricorso', p.t + ': ricorso amministrativo (verificare il termine nel provvedimento)', d(p.ric));
        if (p.atp) add('ATP invalidità', 'Accertamento tecnico preventivo entro 6 mesi dalla comunicazione', d(p.atp));
      }
    });
    return out;
  }

  /* ---------- richieste online e modulo pubblico ---------- */
  function richieste() { return S().richieste || (S().richieste = []); }
  function linkPubblico() { return location.href.split('#')[0] + '#richiesta'; }
  function qr(el) {
    el.textContent = '';
    try {
      if (!window.QRCode) throw new Error('libreria assente');
      new window.QRCode(el, { text: linkPubblico(), width: 148, height: 148, colorDark: '#1d1d1f', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
      el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Codice QR del modulo per chiedere un appuntamento');
    } catch (e) { el.appendChild(h('div', { class: 'hint', style: { padding: '12px', textAlign: 'center', maxWidth: '150px' } }, 'Il codice QR compare quando la pagina è collegata a internet. Il link qui accanto funziona sempre.')); }
  }
  function vRichieste() {
    var tutte = richieste().slice().sort(function (a, b) { return a.q < b.q ? 1 : -1; });
    var nuove = tutte.filter(function (r) { return r.stato === 'nuova'; }), fatte = tutte.filter(function (r) { return r.stato !== 'nuova'; });
    var box = h('div', { class: 'qr', style: { background: '#fff', padding: '10px', borderRadius: '12px', border: '1px solid var(--line)', width: 'fit-content', minWidth: '168px', minHeight: '168px', display: 'grid', placeItems: 'center' } });
    setTimeout(function () { qr(box); }, 0);
    var link = h('input', { type: 'text', readOnly: true, value: linkPubblico(), 'aria-label': 'Link del modulo pubblico' });
    return [
      UI.intestazione('Richieste online', 'I cittadini chiedono un appuntamento dal telefono, con il QR allo sportello o il link. La titolare le conferma a mano: diventano appuntamenti in agenda.'),
      h('div', { class: 'card mb' }, h('h2', 'Modulo per i cittadini'),
        h('div', { class: 'row', style: { alignItems: 'flex-start', marginBottom: '0' } }, box,
          h('div', { class: 'grow' }, h('div', { class: 'f' }, link),
            h('div', { class: 'row' }, UI.btn('Copia il link', function () { link.select(); var ok = function () { B.toast('Link copiato'); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link.value).then(ok, function () { B.toast('Copia non riuscita: seleziona il link a mano.', true); }); else B.toast('Seleziona il link e copialo.'); }, 'sec'), UI.btn('Apri il modulo', function () { location.hash = 'richiesta'; }, 'sec')),
            h('p', { class: 'hint' }, 'Nella demo la richiesta resta in questo browser. Nella versione vera arriva allo sportello e il cittadino riceve la conferma.')))),
      h('h2', 'Da confermare (' + nuove.length + ')'),
      nuove.length ? h('div', { class: 'grid g2 mb' }, nuove.map(function (r) {
        return h('div', { class: 'card' }, h('h3', r.nome), h('p', { class: 'hint' }, r.tel + ' · ' + r.tipo + ' · ' + U.fmt(r.giorno) + ', ' + r.fascia.toLowerCase()), r.msg ? h('p', null, '«' + r.msg + '»') : null, h('p', { class: 'hint' }, 'Arrivata il ' + U.fmtDT(r.q)),
          h('div', { class: 'row', style: { marginBottom: '0' } }, UI.btn('Conferma e fissa', function () { conferma(r); }, 'sm'), UI.btn('Rifiuta', function () {
            B.conferma('Rifiutare la richiesta?', r.nome + ' · ' + r.tipo + '. Ricordati di avvisare la persona al ' + r.tel + '.', 'Rifiuta', function () { r.stato = 'rifiutata'; B.registra('Richiesta online rifiutata', r.nome, r.tipo); B.salva(); B.render(); }, true);
          }, 'no sm')));
      })) : h('div', { class: 'card mb' }, UI.vuoto('Nessuna richiesta da confermare', 'Le nuove richieste compaiono qui e nel conteggio del menu.')),
      fatte.length ? [h('h2', 'Già gestite'), UI.tabella([{ t: 'Persona', v: function (r) { return h('b', r.nome); } }, { t: 'Servizio', v: function (r) { return r.tipo; } }, { t: 'Giorno chiesto', v: function (r) { return U.fmt(r.giorno); } }, { t: 'Esito', v: function (r) { return UI.pill(r.stato === 'confermata' ? 'Confermata' : 'Rifiutata', r.stato === 'confermata' ? 'ok' : 'info'); } }], fatte)] : null];
  }
  function conferma(r) {
    var tn = String(r.tel).replace(/\D/g, '').slice(-9);
    var gia = B.dati().clienti.filter(function (c) { return c.tel && String(c.tel).replace(/\D/g, '').slice(-9) === tn; })[0];
    B.agenda.modulo(null, { cliente: gia ? gia.id : '', nome: gia ? '' : r.nome, titolo: r.tipo + ' (richiesta online)', data: r.giorno, ora: r.fascia === 'Pomeriggio' ? '16:00' : '09:30', note: r.msg, op: OPE[0], bozza: 'app-rich-' + r.id, dopoSalva: { richiesta: r.id } });
  }
  function giorniLiberi() {
    var o = [], i, dd;
    for (i = 1; o.length < 10 && i < 30; i++) { dd = U.giorni(i); if (!U.giornoChiuso(dd)) o.push([U.iso(dd), U.cap(dd.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))]); }
    return o;
  }
  var KEY_PUB = 'gestionale-patronato-bozza-pubblica';
  function paginaRichiesta() {
    var bz = {}; try { bz = JSON.parse(localStorage.getItem(KEY_PUB) || '{}') || {}; } catch (e) { bz = {}; }
    var f = {};
    var campo = function (k, l, el, obbl) { el.id = 'r-' + k; el.name = k; f[k] = el; if (bz[k] != null) { if (el.type === 'checkbox') el.checked = !!bz[k]; else el.value = bz[k]; } return h('div', { class: 'f' }, h('label', { for: 'r-' + k }, l + (obbl ? ' *' : '')), el, h('div', { class: 'err', id: 'r-' + k + '-e', 'aria-live': 'polite' })); };
    var gl = giorniLiberi();
    var privacy = h('input', { type: 'checkbox', id: 'r-privacy' });
    if (bz.privacy) privacy.checked = true;
    f.privacy = privacy;
    var esito = h('div', { 'aria-live': 'polite' });
    var form = h('form', { novalidate: true },
      campo('nome', 'Nome e cognome', h('input', { type: 'text', maxlength: '80', autocomplete: 'name' }), true),
      campo('tel', 'Telefono', h('input', { type: 'tel', maxlength: '25', autocomplete: 'tel', placeholder: 'es. 333 123 4567' }), true),
      campo('tipo', 'Di cosa hai bisogno?', h('select', TIPI.concat(['Altro o non lo so']).map(function (t) { return h('option', { value: t }, t); }))),
      campo('giorno', 'Giorno preferito', h('select', gl.map(function (g) { return h('option', { value: g[0] }, g[1]); }))),
      campo('fascia', 'Momento della giornata', h('select', ['Mattina', 'Pomeriggio'].map(function (t) { return h('option', { value: t }, t); }))),
      campo('msg', 'Vuoi aggiungere qualcosa? (facoltativo)', h('textarea', { maxlength: '500' })),
      h('details', { class: 'hint', style: { marginBottom: '10px' } }, h('summary', 'Informativa privacy in breve'),
        h('p', null, 'Titolare: lo sportello. Usiamo nome, telefono e messaggio solo per richiamarti e fissare l\'appuntamento; li cancelliamo se l\'appuntamento non si fa. Non li diamo a nessuno. Puoi chiedere di vederli o cancellarli in qualsiasi momento. In questa demo i dati restano solo nel tuo browser.')),
      h('label', { class: 'check', for: 'r-privacy', style: { borderBottom: '0' } }, privacy, h('span', 'Ho letto l\'informativa e accetto di essere ricontattato *')),
      h('div', { class: 'err', id: 'r-privacy-e', 'aria-live': 'polite' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'submit' }, 'Invia la richiesta')),
      esito);
    form.addEventListener('input', function () { var v = {}; Object.keys(f).forEach(function (k) { v[k] = f[k].type === 'checkbox' ? f[k].checked : f[k].value; }); try { localStorage.setItem(KEY_PUB, JSON.stringify(v)); } catch (e) { } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = 0, set = function (k, m) { var el = document.getElementById('r-' + k + '-e'); el.textContent = m; f[k].setAttribute('aria-invalid', m ? 'true' : 'false'); if (m) { if (!err) f[k].focus(); err++; } };
      var nm = f.nome.value.trim(), tl = f.tel.value.trim(), ms = f.msg.value.trim();
      set('nome', !nm ? 'Scrivi nome e cognome.' : (nm.length > 80 ? 'Massimo 80 caratteri.' : ''));
      set('tel', !tl ? 'Scrivi un numero di telefono.' : (!U.telOk(tl) ? 'Numero non valido: cellulare (3…) o fisso (0…).' : ''));
      set('msg', ms.length > 500 ? 'Massimo 500 caratteri.' : '');
      set('privacy', !privacy.checked ? 'Serve il consenso per poterti richiamare.' : '');
      if (TIPI.concat(['Altro o non lo so']).indexOf(f.tipo.value) < 0 || !gl.some(function (g) { return g[0] === f.giorno.value; }) || ['Mattina', 'Pomeriggio'].indexOf(f.fascia.value) < 0) { esito.textContent = 'Scegli le voci dagli elenchi.'; return; }
      if (err) return;
      if (richieste().filter(function (r) { return r.stato === 'nuova'; }).length >= 30) { esito.textContent = 'Troppe richieste in attesa: chiama lo sportello.'; return; }
      richieste().push({ id: U.nuovoId('rq'), nome: nm, tel: tl, tipo: f.tipo.value, giorno: f.giorno.value, fascia: f.fascia.value, msg: ms, q: new Date().toISOString(), stato: 'nuova' });
      B.registra('Richiesta online ricevuta', nm, f.tipo.value + ' · ' + U.fmt(f.giorno.value));
      B.salva();
      try { localStorage.removeItem(KEY_PUB); } catch (x) { }
      form.replaceWith(h('div', { 'data-test': 'richiesta-ok' }, h('h2', 'Richiesta inviata'), h('p', { class: 'sub' }, 'Grazie ' + nm + '. Lo sportello ti richiama al ' + tl + ' per confermare il giorno.'),
        h('a', { class: 'btn sec', href: '#/richieste' }, 'Vedi la richiesta nel gestionale (demo)')));
    });
    return h('div', { class: 'pubblico' }, h('div', { class: 'card' },
      h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('h1', { style: { fontSize: '24px', margin: 0 } }, 'Prenota allo sportello'), h('div', { 'data-tasti-pref': '', style: { display: 'flex', gap: '6px' } }, UI.tastiPref())),
      h('p', { class: 'sub', style: { marginTop: '8px' } }, 'Patronato e CAF · ' + 'Lun–Ven 9:00–13:00 e 15:30–18:30. Scegli il giorno: ti richiamiamo per confermare.'),
      form));
  }

  /* ---------- schede nel CRM ---------- */
  function tabPratiche(c) {
    var ps = S().pratiche.filter(function (p) { return p.c === c.id; }).sort(function (a, b) { return a.ap < b.ap ? 1 : -1; });
    return h('div', h('div', { class: 'row' }, UI.btn('Nuova pratica per ' + c.nome, function () { moduloNuova(c.id); })),
      UI.tabella([{ t: 'Pratica', v: function (p) { return h('b', p.t); } }, { t: 'Stato', v: pillSt }, { t: 'Prossima azione', v: azioneP }, { t: 'Pagamento', v: pagTesto }, { t: 'Aperta', v: function (p) { return U.fmt(p.ap); } }], ps,
        { apri: function (p) { apriPratica(p.id); }, vuoto: 'Nessuna pratica', vuotoD: 'Apri la prima pratica per questa persona.' }));
  }
  function tabNucleo(c) {
    var n = nucleo(c);
    var nm = h('input', { type: 'text', maxlength: '80', 'aria-label': 'Nome del familiare', placeholder: 'Nome e cognome' });
    var rel = h('input', { type: 'text', maxlength: '60', 'aria-label': 'Relazione', placeholder: 'es. Coniuge, Figlio 12 anni' });
    return h('div', { class: 'card' }, h('h2', 'Nucleo familiare'), h('p', { class: 'hint' }, 'Serve per sapere quali documenti chiedere (per esempio i redditi del coniuge per il RED o i codici fiscali dei figli per l\'assegno unico).'),
      n.length ? h('div', { class: 'list' }, n.map(function (x, i) {
        return h('div', { class: 'item' }, h('div', { class: 't' }, h('b', x[0]), h('span', x[1])), UI.btn('Togli', function () { c.nucleo.splice(i, 1); B.registra('Familiare tolto', c.nome, x[0]); B.salva(); B.render(); }, 'sec sm', { 'aria-label': 'Togli ' + x[0] }));
      })) : UI.vuoto('Nessun familiare inserito'),
      h('div', { class: 'row', style: { marginTop: '12px', marginBottom: '0' } }, h('div', { class: 'grow' }, nm), h('div', { class: 'grow' }, rel), UI.btn('Aggiungi', function () {
        var a = nm.value.trim(), b = rel.value.trim();
        if (!a || !b) { B.toast('Scrivi nome e relazione.', true); return; }
        if (!Array.isArray(c.nucleo)) c.nucleo = [];
        c.nucleo.push([a.slice(0, 80), b.slice(0, 60)]); B.registra('Familiare aggiunto', c.nome, a + ' · ' + b); B.salva(); B.render(); B.toast('Familiare aggiunto');
      }, 'sec')));
  }

  /* ---------- dashboard del mestiere ---------- */
  function cardDashboard() {
    var ap = aperte();
    var perStato = STATI.slice(0, 5).concat(['Ricorso']).map(function (st, i) { var n = ap.filter(function (p) { return p.st === st; }).length; return { l: st, v: n, tip: st + ': ' + U.pl(n, 'pratica', 'pratiche') }; });
    var carico = OPE.map(function (o) { var mie = ap.filter(function (p) { return p.op === o; }); return { l: o, v: mie.length, tip: o + ': ' + U.pl(mie.length, 'pratica aperta', 'pratiche aperte') + ', ' + mie.filter(function (p) { return p.st === 'Documenti mancanti'; }).length + ' ferme per documenti' }; });
    return h('div', { class: 'card' }, h('h2', 'Pratiche aperte per stato'), UI.barre(perStato), h('div', { class: 'subh', style: { marginTop: '18px' } }, 'Carico per operatrice'), UI.barre(carico),
      h('div', { style: { marginTop: '12px' } }, UI.btn('Apri le pratiche', function () { B.vai('pratiche'); }, 'sec sm')));
  }

  /* ---------- dati demo (tutti inventati) ---------- */
  function datiDemo() {
    SEME = 20261029; ADE_SEQ = 0;
    var O = U.oggi(), iso = U.iso;
    var nonLav = function (x) { return !!U.giornoChiuso(x); };
    var Wb = function (n) { var x = U.giorni(n); while (nonLav(x)) x = U.piuGiorni(x, -1); return x; }; // giorno lavorativo, all'indietro
    var W = function (n) { var x = U.giorni(n); while (nonLav(x)) x = U.piuGiorni(x, 1); return x; }; // in avanti
    var at = function (dd, hh, mm) { var x = new Date(dd); x.setHours(hh, mm || 0, 0, 0); return x.toISOString(); };
    var CL = [
      ['c1', 'Giuseppe Ferrante', 'FRRGPP68M12X001A', '1968-08-12', '333 000 0101', 'giuseppe.f@esempio.it', [['Elena Bruni', 'Coniuge'], ['Marco Ferrante', 'Figlio, 17 anni']], -390],
      ['c2', 'Maria Colombo', 'CLMMRA85C41X002B', '1985-03-01', '333 000 0102', 'maria.c@esempio.it', [['Paolo Colombo', 'Coniuge'], ['Luca Colombo', 'Figlio, 9 anni'], ['Sofia Colombo', 'Figlia, 4 anni']], -380],
      ['c3', 'Antonio De Santis', 'DSNNTN57H10X003C', '1957-06-10', '333 000 0103', 'antonio.ds@esempio.it', [['Lina De Santis', 'Coniuge']], -400],
      ['c4', 'Rosa Barbieri', 'BRBRSO59D55X004D', '1959-04-15', '333 000 0104', 'rosa.b@esempio.it', [['Nicola Barbieri', 'Coniuge']], -300],
      ['c5', 'Luigi Piras', 'PRSLGU90E20X005E', '1990-05-20', '333 000 0105', 'luigi.p@esempio.it', [['Anna Villa', 'Coniuge'], ['Giorgio Piras', 'Figlio, 3 mesi']], -200],
      ['c6', 'Anna Villa', 'VLLNNA92P50X006F', '1992-09-10', '333 000 0106', 'anna.v@esempio.it', [['Luigi Piras', 'Coniuge'], ['Giorgio Piras', 'Figlio, 3 mesi']], -200],
      ['c7', 'Fabio Gallo', 'GLLFBA75B08X007G', '1975-02-08', '333 000 0107', 'fabio.g@esempio.it', [['Daniela Gallo', 'Coniuge']], -150],
      ['c8', 'Carla Sanna', 'SNNCRL63L45X008H', '1963-07-05', '333 000 0108', 'carla.s@esempio.it', [['Stefano Sanna', 'Figlio, 38 anni'], ['Silvia Sanna', 'Figlia, 35 anni']], -250],
      ['c9', 'Vito Lombardi', 'LMBVTI71S15X009I', '1971-11-15', '333 000 0109', 'vito.l@esempio.it', [['Pina Lombardi', 'Coniuge'], ['Carmen Lombardi', 'Figlia, 14 anni']], -330],
      ['c10', 'Teresa Rinaldi', 'RNLTRS49A60X010L', '1949-01-20', '333 000 0110', 'teresa.r@esempio.it', [], -395],
      ['c11', 'Pietro Conti', 'CNTPTR64T22X011M', '1964-12-22', '333 000 0111', 'pietro.c@esempio.it', [['Giulia Conti', 'Coniuge']], -385],
      ['c12', 'Lucia Serra', 'SRRLCU58R50X012N', '1958-10-10', '333 000 0112', 'lucia.s@esempio.it', [['Mario Serra', 'Coniuge']], -360],
      ['c13', 'Domenico Pellegrino', 'PLLDNC79H03X013O', '1979-06-03', '333 000 0113', 'domenico.p@esempio.it', [['Rita Pellegrino', 'Coniuge'], ['Chiara Pellegrino', 'Figlia, 19 anni, studentessa']], -320],
      ['c14', 'Giovanna Basile', 'BSLGNN44C45X014P', '1944-03-05', '333 000 0114', 'giovanna.b@esempio.it', [['Elena Basile', 'Figlia, caregiver']], -90],
      ['c15', 'Claudio Marchetti', 'MRCCLD83D18X015Q', '1983-04-18', '333 000 0115', 'claudio.m@esempio.it', [['Paola Marchetti', 'Coniuge']], -120],
      ['e1', 'Franca Rizzo', 'RZZFNC55E41X016R', '1955-05-01', '333 000 0116', 'franca.r@esempio.it', [], -405],
      ['e2', 'Michele Greco', 'GRCMHL69C10X017S', '1969-03-10', '333 000 0117', 'michele.g@esempio.it', [['Lia Greco', 'Coniuge']], -405],
      ['e3', 'Paola Fontana', 'FNTPLA72H52X018T', '1972-06-12', '333 000 0118', 'paola.f@esempio.it', [], -400],
      ['e4', 'Sergio Caruso', 'CRSSRG61A15X019U', '1961-01-15', '333 000 0119', 'sergio.c@esempio.it', [], -398],
      ['e5', 'Nadia Ferri', 'FRRNDA80L44X020V', '1980-07-04', '333 000 0120', 'nadia.f@esempio.it', [], -392],
      ['e6', 'Bruno Testa', 'TSTBRN52D20X021W', '1952-04-20', '333 000 0121', 'bruno.t@esempio.it', [], -388],
      ['e7', 'Laura Mancini', 'MNCLRA88S50X022Y', '1988-11-10', '333 000 0122', 'laura.m@esempio.it', [], -230],
      ['e8', 'Giorgio Longo', 'LNGGRG66P05X023Z', '1966-09-05', '333 000 0123', 'giorgio.l@esempio.it', [], -210],
      ['e9', 'Silvia Gentile', 'GNTSLV77B41X024A', '1977-02-01', '333 000 0124', 'silvia.g@esempio.it', [], -190],
      ['e10', 'Renato Bellini', 'BLLRNT58T12X025B', '1958-12-12', '333 000 0125', 'renato.b@esempio.it', [], -175],
      ['e11', 'Davide Russo', 'RSSDVD91M03X026C', '1991-08-03', '333 000 0126', 'davide.r@esempio.it', [], -6],
      ['e12', 'Elisa Moretti', 'MRTLSE94A61X027D', '1994-01-21', '333 000 0127', 'elisa.m@esempio.it', [['Tommaso Moretti', 'Figlio, 2 anni']], -2]
    ];
    var clienti = CL.map(function (x) { return { id: x[0], nome: x[1], cf: x[2], nascita: x[3], tel: x[4], email: x[5], nucleo: x[6], creato: iso(U.giorni(x[7])), note: '' }; });
    clienti[7].note = 'Preferisce essere chiamata al mattino.';
    clienti[13].note = 'Viene accompagnata dalla figlia Elena, che ha la delega.';
    var cliente = function (id) { return clienti.filter(function (c) { return c.id === id; })[0]; };
    /* pratiche (riprese dal Patronato originale, con le date relative a oggi) */
    var pratiche = [];
    var P = function (id, c, t, st, op, ap, o) {
      o = o || {};
      var B2 = function (n) { return n == null ? null : iso(Wb(n)); };
      var p = { id: id, c: c, t: t, st: st, op: OPE[op], ap: iso(Wb(ap)), ente: ENTE[t], mandato: B2(o.man), privacy: B2(o.priv), prot: '', inv: B2(o.inv), ev: o.ev == null ? null : iso(U.giorni(o.ev)), integ: B2(o.ig), integTerm: o.it == null ? null : iso(U.giorni(o.it)), sc: o.sc == null ? null : iso(U.giorni(o.sc)), nato: !!o.nato, cost: o.cost || 0, pagata: B2(o.paid), mov: null, esito: null, ric: null, atp: null, ricPres: null, dom: o.dom || '', note: [], log: [] };
      if (o.pr) p.prot = genProt(p, p.inv || p.ap);
      p.docs = docsFor(t, cliente(c), p.nato).map(function (n, i) { return { n: n, ok: (o.m || []).indexOf(i) < 0 }; });
      if (o.ek) { p.esito = { k: o.ek, d: B2(o.ed), com: o.ec == null ? B2(o.ed) : B2(o.ec), mot: o.mot || '', imp: o.imp == null ? null : o.imp, dir: o.dir || '' }; if (esNeg(p)) setTermini(p); }
      var L = function (dd, hh, t2) { p.log.push({ q: at(U.pIso(dd), hh, (hh * 7 + t2.length) % 60), chi: p.op, t: t2 }); };
      L(p.ap, 9, 'Pratica aperta');
      if (p.mandato) L(p.mandato, 10, 'Mandato firmato');
      if (p.privacy) L(p.privacy, 10, 'Informativa privacy firmata');
      if (p.inv) L(p.inv, 11, 'Pratica inviata (' + p.ente + ')' + (p.prot ? ', ' + protLabel(p).toLowerCase() + ' ' + p.prot : ''));
      if (p.integ) L(p.integ, 12, 'Richiesta di integrazione ricevuta da ' + p.ente);
      if (p.esito) L(p.esito.d, 15, 'Esito registrato: ' + p.esito.k);
      if (p.pagata) L(p.pagata, 16, 'Incassati ' + U.eur(p.cost));
      (o.note || []).forEach(function (n) { var dd = iso(Wb(n[0])); p.note.push({ q: at(U.pIso(dd), 14, 20), chi: p.op, t: n[1] }); L(dd, 14, 'Nota aggiunta'); });
      p.log.sort(function (a, b) { return a.q < b.q ? -1 : 1; });
      pratiche.push(p);
    };
    P('p1', 'c1', 'NASpI', 'Documenti mancanti', 0, -6, { man: -6, priv: -6, ev: -62, m: [1], note: [[-1, 'Porta la lettera di licenziamento in sportello oggi.']] });
    P('p2', 'c2', 'ISEE/DSU', 'Inviata', 1, -3, { man: -3, priv: -3, pr: 1, inv: -2 });
    P('p3', 'c3', 'Redditi PF', 'Documenti mancanti', 1, -12, { man: -12, priv: -12, m: [1], cost: 4500, note: [[-12, 'Il termine del 730 integrativo è passato: la pratica è impostata come Redditi PF. Verificare il termine nelle istruzioni dell\'Agenzia delle Entrate.'], [-2, 'Ha promesso le ricevute entro il fine settimana.']] });
    P('p4', 'c4', 'Pensione vecchiaia', 'Documenti mancanti', 0, -1, { m: [1, 4] });
    P('p5', 'c6', 'Maternità', 'In istruttoria', 1, -30, { man: -30, priv: -30, pr: 1, inv: -26, ig: -25, it: 5, nato: 1 });
    P('p6', 'c13', 'Assegno unico', 'Documenti mancanti', 0, -8, { man: -8, priv: -8, m: [1] });
    P('p7', 'c7', 'Dimissioni telematiche', 'Inviata', 1, -4, { man: -4, priv: -4, pr: 1, inv: -4 });
    P('p8', 'c8', 'Successione', 'Documenti mancanti', 0, -21, { ev: -350, m: [1, 2, 3], cost: 25000, note: [[-6, 'Mancano le visure: i familiari le stanno cercando.']] });
    P('p9', 'c9', 'DIS-COLL', 'Pronta da inviare', 0, -5, { man: -5, ev: -40 });
    P('p10', 'c10', 'RED', 'Documenti mancanti', 1, -14, { man: -14, priv: -14, sc: 12, m: [1] });
    P('p11', 'c11', 'Pensione anticipata', 'Pronta da inviare', 1, -10, { man: -10, priv: -10 });
    P('p12', 'c12', INV, 'In istruttoria', 1, -170, { man: -170, priv: -170, pr: 1, inv: -168, ig: -33, it: -3, dom: 'Indennità di accompagnamento', note: [[-169, 'Oltre i 67 anni non si presenta l\'assegno di invalidità: la domanda riguarda solo l\'indennità di accompagnamento.'], [-3, 'Chiamare il medico di famiglia per il certificato.']] });
    P('p13', 'c14', INV, 'In istruttoria', 0, -32, { man: -32, priv: -32, pr: 1, inv: -30, ig: -24, it: 9 });
    P('p14', 'c5', 'Congedo parentale', 'Da aprire', 1, 0, { m: [0, 3] });
    P('p15', 'c13', INV, 'Ricorso', 0, -200, { man: -200, priv: -200, pr: 1, inv: -198, ek: 'Respinta', ed: -21, ec: -20, mot: 'Requisiti sanitari non riconosciuti dalla commissione medica', note: [[-19, 'Il cittadino conferma di voler procedere con l\'accertamento tecnico preventivo.']] });
    P('p16', 'c3', 'ISEE/DSU', 'Con esito', 1, -40, { man: -40, priv: -40, pr: 1, inv: -38, ek: 'Attestazione rilasciata', ed: -30 });
    P('p17', 'c15', 'NASpI', 'Con esito', 1, -85, { man: -85, priv: -85, pr: 1, inv: -83, ev: -110, ek: 'Accolta', ed: -60, imp: 118000 });
    P('p18', 'c1', 'ISEE/DSU', 'Con esito', 0, -50, { man: -50, priv: -50, pr: 1, inv: -48, ek: 'Attestazione rilasciata', ed: -41 });
    P('p19', 'c10', '730', 'Con esito', 0, -75, { man: -75, priv: -75, pr: 1, inv: -74, ek: 'Ricevuta di presentazione', ed: -74, imp: 21450, dir: 'Rimborso', cost: 2500, paid: -74 });
    P('p20', 'c13', 'ISEE/DSU', 'Con esito', 0, -36, { man: -36, priv: -36, pr: 1, inv: -35, ek: 'Attestazione rilasciata', ed: -27 });
    P('p22', 'c8', 'ISEE/DSU', 'Con esito', 1, -55, { man: -55, priv: -55, pr: 1, inv: -54, ek: 'Attestazione rilasciata con omissioni/difformità', ed: -25, mot: 'Omissione: giacenza media dei conti non dichiarata' });
    P('p23', 'c6', 'Assegno unico', 'Con esito', 1, -62, { man: -62, priv: -62, pr: 1, inv: -61, ek: 'Accolta', ed: -29 });
    P('p24', 'c5', 'ISEE/DSU', 'Con esito', 0, -30, { man: -30, priv: -30, pr: 1, inv: -29, ek: 'Attestazione rilasciata', ed: -15 });
    P('p25', 'c2', 'Assegno unico', 'Con esito', 1, -70, { man: -70, priv: -70, pr: 1, inv: -69, ek: 'Accolta', ed: -35 });
    P('p26', 'c11', 'NASpI', 'Con esito', 1, -88, { man: -88, priv: -88, pr: 1, inv: -87, ev: -120, ek: 'Accolta', ed: -68, imp: 124000 });
    P('p27', 'c4', 'ISEE/DSU', 'Con esito', 0, -58, { man: -58, priv: -58, pr: 1, inv: -56, ek: 'Attestazione rilasciata', ed: -31 });
    P('p28', 'c3', '730', 'Con esito', 1, -140, { man: -140, priv: -140, pr: 1, inv: -139, ek: 'Ricevuta di presentazione', ed: -139, imp: 11800, dir: 'Rimborso', cost: 3000, paid: -139 });
    P('p29', 'c11', '730', 'Con esito', 0, -120, { man: -120, priv: -120, pr: 1, inv: -119, ek: 'Ricevuta di presentazione', ed: -119, imp: 7600, dir: 'Debito', cost: 3000, paid: -119 });
    P('p30', 'e12', 'Assegno unico', 'Da aprire', 0, -2, { m: [0, 1, 2, 3] });
    /* movimenti: 14 mesi di attività inventata, sempre in giorni lavorativi e mai dopo oggi */
    var mov = [], seq = 0;
    var M = function (dd, tipo, cat, imp, des, cl, extra) {
      if (!dd || dd > O) return null;
      var x = { id: 'mv' + (++seq), data: iso(dd), tipo: tipo, categoria: cat, importo: Math.round(imp), descrizione: des, cliente: cl || null, stato: 'pagato', scadenza: null, rif: null, creato: at(dd, 12) };
      if (extra) Object.keys(extra).forEach(function (k) { x[k] = extra[k]; });
      mov.push(x); return x;
    };
    var lav = function (y, m, g) { var x = new Date(y, m, Math.min(g, new Date(y, m + 1, 0).getDate())); var t = 0; while (nonLav(x) && t++ < 6) x = U.piuGiorni(x, 1); if (x.getMonth() !== m) { x = new Date(y, m, g); while (nonLav(x)) x = U.piuGiorni(x, -1); } return x; };
    var pool = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12', 'c13', 'c15', 'e1', 'e2', 'e7', 'e8', 'e9', 'e10'], pi = 0;
    var prossimo = function () { pi = (pi + 7) % pool.length; return pool[pi]; };
    var stag730 = [1, 1, 1, 2, 4, 10, 30, 34, 14, 2, 4, 2]; // gen..dic
    for (var k = -13; k <= 0; k++) {
      var base = U.piuMesi(new Date(O.getFullYear(), O.getMonth(), 1), k), y = base.getFullYear(), m = base.getMonth();
      M(lav(y, m, 1), 'uscita', 'Affitto del locale', 45000, 'Affitto mensile');
      M(lav(y, m, 5), 'uscita', 'Software e collegamenti', 5900, 'Programma pratiche e firma digitale');
      M(lav(y, m, 11), 'uscita', 'Utenze', 8500 + Math.round(rn() * 7000), 'Luce, telefono e internet');
      M(lav(y, m, 16), 'uscita', 'Cancelleria e stampe', 1800 + Math.round(rn() * 4200), 'Carta, toner, raccoglitori');
      M(lav(y, m, 27), 'uscita', 'Collaboratori', 60000 + (m >= 4 && m <= 6 ? 40000 : 0), m >= 4 && m <= 6 ? 'Compensi collaboratrici (stagione 730)' : 'Compensi collaboratrici');
      if (m % 3 === 0) M(lav(y, m, 20), 'uscita', 'Commercialista e consulenze', 18000, 'Consulenza trimestrale');
      if (m === 1 || m === 8) M(lav(y, m, 14), 'uscita', 'Formazione', 12000, 'Aggiornamento normativo');
      /* entrate */
      var n730 = stag730[m];
      for (var i = 0; i < n730; i++) { var g = 2 + Math.floor(i * 26 / Math.max(1, n730)); var cl = k <= -11 ? ['e3', 'e4', 'e5', 'e6', 'e1', 'e2'][i % 6] : prossimo(); M(lav(y, m, g), 'entrata', '730 e dichiarazioni', i % 3 === 0 ? 3000 : 2500, (m >= 8 ? 'Dichiarazione integrativa' : 'Modello 730') + ' · ' + cliente(cl).nome, cl); }
      if (m >= 5 && m <= 10) for (var j = 0; j < 2 + (m % 3); j++) { var cl2 = prossimo(); M(lav(y, m, 6 + j * 8), 'entrata', '730 e dichiarazioni', 4500, 'Redditi PF · ' + cliente(cl2).nome, cl2); }
      if ((k + 13) % 2 === 0) { var cl3 = k <= -11 ? 'e4' : prossimo(); M(lav(y, m, 18), 'entrata', 'Successioni', 25000, 'Dichiarazione di successione · famiglia ' + cliente(cl3).nome.split(' ').pop(), cl3); }
      if (m === 5 || m === 11) for (var q = 0; q < 12; q++) M(lav(y, m, 3 + q), 'entrata', 'IMU e altri tributi', 1000, 'Calcolo IMU e F24');
      for (var r = 0; r < 10; r++) M(lav(y, m, 6 + r), 'entrata', 'Colf e badanti', 1500, 'Busta paga colf o badante');
      M(lav(y, m, 12), 'entrata', 'Rimborsi della sede (pratiche INPS)', 70000 + Math.round(rn() * 40000), 'Rimborso mensile della sede provinciale per le pratiche INPS chiuse');
      for (var v = 0; v < 4; v++) M(lav(y, m, 4 + v * 6), 'entrata', 'Altri servizi', 1000, 'Visura o estratto contributivo');
      if (m <= 2) for (var t = 0; t < 9; t++) M(lav(y, m, 3 + t * 3), 'entrata', 'Tessere associative', 2000, 'Tessera associativa annuale');
      if (m % 3 === 2) M(lav(y, m, 25), 'entrata', 'Convenzioni CAF (ISEE, RED)', 32000 + Math.round(rn() * 28000), 'Compenso convenzioni dalla sede provinciale');
      if (k <= -11) M(lav(y, m, 8), 'entrata', 'Altri servizi', 1500, 'Visura e stampa estratto contributivo · ' + cliente(['e5', 'e6', 'e3'][k + 13]).nome, ['e5', 'e6', 'e3'][k + 13]);
    }
    /* incassi delle pratiche già pagate (collegati alla pratica) */
    pratiche.forEach(function (p) { if (p.pagata) { var x = M(U.pIso(p.pagata), 'entrata', CAT_TIPO[p.t], p.cost, 'Pratica ' + p.t + ' · ' + cliente(p.c).nome, p.c, { rif: p.id }); if (x) p.mov = x.id; } });
    /* aperti: da incassare e da pagare */
    M(Wb(-20), 'entrata', 'Successioni', 25000, 'Successione · famiglia Rizzo (saldo)', 'e1', { stato: 'aperto', scadenza: iso(U.giorni(-5)) });
    M(Wb(-3), 'entrata', 'Colf e badanti', 4500, 'Tre buste paga di ottobre · Greco', 'e2', { stato: 'aperto', scadenza: iso(U.giorni(12)) });
    M(Wb(-8), 'uscita', 'Utenze', 11840, 'Bolletta della luce', null, { stato: 'aperto', scadenza: iso(U.giorni(6)) });
    M(Wb(-2), 'uscita', 'Commercialista e consulenze', 18000, 'Saldo consulenza', null, { stato: 'aperto', scadenza: iso(U.giorni(20)) });
    var app = [];
    var A = function (dd, ora, dur, tit, c, op, nomeP) { app.push({ id: 'ap' + (app.length + 1), data: iso(dd), ora: ora, durata: dur, titolo: tit, cliente: c, nome: nomeP || '', op: OPE[op], note: '' }); };
    A(U.giorni(0), '09:30', 30, 'Ritiro documenti NASpI', 'c1', 0); A(U.giorni(0), '11:00', 30, 'Consegna delle spese sanitarie per i Redditi PF', 'c3', 1); A(U.giorni(0), '16:00', 30, 'Verifica integrazione accompagnamento', 'c14', 0);
    A(W(1), '10:00', 30, 'Firma del mandato per la successione', 'c8', 0); A(W(4), '09:00', 45, 'Raccolta documenti per l\'assegno unico', 'c13', 0); A(W(5), '15:30', 30, 'Controllo del conteggio pensione anticipata', 'c11', 1);
    A(W(6), '11:30', 30, 'Certificato per la richiesta di integrazione', 'c6', 1); A(W(8), '10:00', 30, 'Firma del mandato per la pensione', 'c4', 0); A(W(12), '09:30', 30, 'Compilazione RED', 'c10', 1);
    A(Wb(-1), '10:30', 30, 'Prima consulenza', 'e11', 1); A(Wb(-2), '09:00', 30, 'Apertura assegno unico', 'e12', 0); A(Wb(-3), '15:30', 45, 'ISEE per l\'università', 'c13', 1); A(Wb(-5), '12:00', 30, 'Consegna documenti DIS-COLL', 'c9', 0);
    var contatti = [
      { id: 'k1', cliente: 'c3', q: at(Wb(-8), 10, 12), tipo: 'Chiamata', testo: 'Due pratiche aperte: teniamo insieme gli appuntamenti.', chi: OPE[1] },
      { id: 'k2', cliente: 'c8', q: at(Wb(-6), 9, 40), tipo: 'Chiamata', testo: 'Le visure catastali arrivano la settimana prossima.', chi: OPE[0] },
      { id: 'k3', cliente: 'c14', q: at(Wb(-9), 11, 5), tipo: 'Incontro allo sportello', testo: 'Presente la figlia Elena con la delega.', chi: OPE[0] },
      { id: 'k4', cliente: 'c1', q: at(Wb(-1), 17, 20), tipo: 'Messaggio', testo: 'Domani porto la lettera di licenziamento.', chi: OPE[0] },
      { id: 'k5', cliente: 'e11', q: at(Wb(-6), 10, 0), tipo: 'Chiamata', testo: 'Chiede informazioni su NASpI dopo un contratto a termine.', chi: OPE[1] },
      { id: 'k6', cliente: 'e2', q: at(Wb(-3), 12, 30), tipo: 'Email', testo: 'Inviato il riepilogo delle buste paga di ottobre.', chi: 'Rita Esposito' }
    ];
    var azioni = [
      { id: 'az1', cliente: 'c1', data: iso(W(1)), testo: 'Controllare la lettera di licenziamento e chiudere i documenti NASpI', fatto: false, creato: iso(Wb(-1)) },
      { id: 'az2', cliente: 'c8', data: iso(U.giorni(-2)), testo: 'Sollecitare le visure catastali ai familiari', fatto: false, creato: iso(Wb(-6)) },
      { id: 'az3', cliente: 'c10', data: iso(U.giorni(5)), testo: 'Ricordare il RED e i redditi dell\'anno', fatto: false, creato: iso(Wb(-14)) },
      { id: 'az4', cliente: 'e1', data: iso(U.giorni(0)), testo: 'Chiamare per il saldo della successione', fatto: false, creato: iso(Wb(-4)) },
      { id: 'az5', cliente: 'c13', data: iso(Wb(-4)), testo: 'Mandare la lista documenti per l\'assegno unico', fatto: true, creato: iso(Wb(-8)) }
    ];
    var documenti = [
      { id: 'd1', cliente: 'c1', nome: 'Carta d\'identità Ferrante.pdf', tipo: 'Documento d\'identità', dim: 0, data: iso(Wb(-6)), contenuto: null },
      { id: 'd2', cliente: 'c1', nome: 'Mandato NASpI firmato.pdf', tipo: 'Mandato di patrocinio', dim: 0, data: iso(Wb(-6)), contenuto: null },
      { id: 'd3', cliente: 'c3', nome: 'Certificazione Unica 2026.pdf', tipo: 'Certificazione Unica', dim: 0, data: iso(Wb(-12)), contenuto: null },
      { id: 'd4', cliente: 'c8', nome: 'Delega degli eredi.pdf', tipo: 'Delega', dim: 0, data: iso(Wb(-21)), contenuto: null },
      { id: 'd5', cliente: 'c10', nome: 'Ricevuta 730.pdf', tipo: 'Ricevuta di presentazione', dim: 0, data: iso(Wb(-74)), contenuto: null },
      { id: 'd6', cliente: 'c15', nome: 'Esito NASpI accolta.pdf', tipo: 'Esito INPS', dim: 0, data: iso(Wb(-60)), contenuto: null }
    ];
    var richiesteDemo = [
      { id: 'rq1', nome: 'Irene Santoro', tel: '333 000 0201', tipo: 'Maternità', giorno: iso(W(6)), fascia: 'Pomeriggio', msg: 'Sono all\'ottavo mese, vorrei capire cosa devo presentare.', q: at(Wb(-1), 21, 14), stato: 'nuova' },
      { id: 'rq2', nome: 'Gaetano Fabbri', tel: '333 000 0202', tipo: 'Pensione anticipata', giorno: iso(W(3)), fascia: 'Mattina', msg: 'Vorrei sapere quando posso andare in pensione.', q: at(Wb(-2), 8, 2), stato: 'nuova' },
      { id: 'rq3', nome: 'Valeria Pagani', tel: '333 000 0203', tipo: 'ISEE/DSU', giorno: iso(W(4)), fascia: 'Mattina', msg: 'Mi serve l\'ISEE per l\'iscrizione all\'università.', q: at(Wb(-2), 19, 40), stato: 'nuova' }
    ];
    var oggiK = U.chiaveMese(O), obiettivi = {}; obiettivi[oggiK] = 320000; obiettivi[U.chiaveMese(U.piuMesi(O, -1))] = 300000;
    var registro = [{ id: 'r0', q: at(O, 8, 0), chi: 'Sistema', azione: 'Dati demo creati', oggetto: 'Tutto il gestionale', dettaglio: 'Dati inventati, nessuna persona reale' }];
    pratiche.forEach(function (p) { p.log.forEach(function (l) { registro.push({ id: U.nuovoId('r'), q: l.q, chi: l.chi, azione: l.t.split(':')[0].split(' (')[0], oggetto: p.t + ' · ' + cliente(p.c).nome, dettaglio: '' }); }); });
    registro.sort(function (a, b) { return a.q < b.q ? -1 : 1; });
    return { clienti: clienti, contatti: contatti, azioni: azioni, appuntamenti: app, movimenti: mov, documenti: documenti, registro: registro.slice(-400), obiettivi: obiettivi, settore: { pratiche: pratiche, richieste: richiesteDemo } };
  }

  /* ---------- aggancio alla base ---------- */
  B.avvia({
    id: 'patronato',
    nome: 'Sportello Patronato',
    sottotitolo: 'Patronato e CAF · demo',
    etichette: { cliente: 'Cittadino', clienti: 'Cittadini' },
    cercaSegnaposto: ', pratiche, protocolli',
    persone: [{ nome: 'Rita Esposito', ruolo: 'Titolare' }, { nome: 'Marta Leone', ruolo: 'Operatrice', agenda: true }, { nome: 'Sara Fiore', ruolo: 'Operatrice', agenda: true }, { nome: 'Studio Bianchi', ruolo: 'Commercialista esterno' }],
    ruoli: ['Titolare', 'Operatrice', 'Commercialista (esterno)'],
    permessi: [
      ['Cittadini e pratiche', 'Tutto', 'Tutto', 'No'],
      ['Agenda e richieste online', 'Tutto', 'Tutto', 'No'],
      ['Documenti dei cittadini', 'Tutto', 'Tutto', 'No'],
      ['Bilancio e movimenti', 'Tutto', 'Solo gli incassi del giorno', 'Vedere ed esportare'],
      ['Registro modifiche', 'Vedere', 'No', 'No'],
      ['Impostazioni e ruoli', 'Tutto', 'No', 'No']
    ],
    campiCliente: [
      { k: 'cf', l: 'Codice fiscale', max: 16, maiuscolo: true, pattern: /^[A-Z0-9]{16}$/, msgPattern: 'Il codice fiscale ha 16 lettere e cifre.', unico: true, cerca: true, alias: ['codice fiscale', 'cf', 'cod fisc'] },
      { k: 'nascita', l: 'Data di nascita', tipo: 'date', alias: ['data di nascita', 'nascita', 'nato il'], valida: function (v) { return v > U.iso(U.oggi()) ? 'Non può essere nel futuro.' : ''; } }
    ],
    colonneCliente: [{ t: 'Pratiche aperte', v: function (c) { var n = S().pratiche.filter(function (p) { return p.c === c.id && !chiusa(p); }).length; return n ? UI.pill(String(n), 'acc') : ''; } }],
    tipiDocumento: ['Documento d\'identità', 'Mandato di patrocinio', 'Informativa privacy', 'Delega', 'Certificazione Unica', 'Ricevuta di presentazione', 'Esito INPS', 'Altro'],
    categorie: {
      entrata: ['730 e dichiarazioni', 'Successioni', 'Rimborsi della sede (pratiche INPS)', 'Convenzioni CAF (ISEE, RED)', 'IMU e altri tributi', 'Colf e badanti', 'Tessere associative', 'Altri servizi'],
      uscita: ['Affitto del locale', 'Utenze', 'Software e collegamenti', 'Cancelleria e stampe', 'Collaboratori', 'Commercialista e consulenze', 'Formazione', 'Altro']
    },
    orari: { aperto: [1, 2, 3, 4, 5], fasce: [['09:00', '13:00'], ['15:30', '18:30']], inizio: '08:30', fine: '19:00', passo: 30 },
    sogliaPersiGiorni: 365,
    testoScadenze: 'e i termini delle pratiche (68 giorni per NASpI e DIS-COLL, 7 giorni per revocare le dimissioni, integrazioni INPS, RED, successioni, ricorsi)',
    testoRif: function () { return 'Dalla pratica: si cambia lì'; },
    sezioni: [
      { id: 'pratiche', titolo: 'Pratiche', dopo: 'dash', render: function () { return vPratiche(); } },
      { id: 'richieste', titolo: 'Richieste online', dopo: 'agenda', render: function () { return vRichieste(); } }
    ],
    schedeCliente: [{ id: 'pratiche', titolo: 'Pratiche', render: tabPratiche }, { id: 'nucleo', titolo: 'Nucleo familiare', render: tabNucleo }],
    conteggi: function () { return { richieste: richieste().filter(function (r) { return r.stato === 'nuova'; }).length }; },
    scadenze: scadenze,
    attivita: function (dati) { var a = []; (dati.settore.pratiche || []).forEach(function (p) { a.push({ cliente: p.c, data: p.ap }); p.log.forEach(function (l) { a.push({ cliente: p.c, data: l.q.slice(0, 10) }); }); }); return a; },
    storicoCliente: function (c, dati) { var e = []; (dati.settore.pratiche || []).forEach(function (p) { if (p.c !== c.id) return; p.log.forEach(function (l) { e.push({ q: l.q, t: 'Pratica ' + p.t, x: l.t, chi: l.chi }); }); }); return e; },
    cerca: function (t) {
      var r = S().pratiche.filter(function (p) { return U.norm(p.t + ' ' + nome(p.c) + ' ' + p.prot + ' ' + p.st).indexOf(t) > -1; }).slice(0, 6)
        .map(function (p) { return { titolo: p.t + ' · ' + nome(p.c), sotto: p.st + (p.prot ? ' · ' + p.prot : ''), vai: function () { apriPratica(p.id); } }; });
      return [{ nome: 'Pratiche', r: r }];
    },
    kpi: function () {
      var ap = aperte(), integ = ap.filter(function (p) { return p.integ && (p.st === 'Inviata' || p.st === 'In istruttoria'); }).length;
      return [
        { n: ap.length, l: 'Pratiche aperte', vai: function () { B.vai('pratiche'); } },
        { n: ap.filter(function (p) { return p.st === 'Documenti mancanti'; }).length, l: 'Ferme per documenti', col: 'warn', vai: function () { B.stato.f.prCol = 'Documenti mancanti'; B.vai('pratiche'); } },
        { n: ap.filter(function (p) { return !p.mandato || !p.privacy; }).length, l: 'Senza mandato o privacy', col: 'bad', vai: function () { B.stato.f.prFirme = true; B.vai('pratiche'); } },
        { n: integ, l: 'Integrazioni INPS da evadere', col: integ ? 'warn' : '', vai: function () { B.vai('scadenze'); } }
      ];
    },
    dashboard: cardDashboard,
    azioniRapide: function () { return [UI.btn('Nuova pratica', function () { moduloNuova(null); }, 'sec')]; },
    esporta: [{ t: 'Pratiche', d: 'Tutte le pratiche con stato, protocollo ed esito', dati: datiCsv }],
    puoEliminareCliente: function (c) { var n = S().pratiche.filter(function (p) { return p.c === c.id; }).length; return n ? c.nome + ' ha ' + U.pl(n, 'pratica', 'pratiche') + ': eliminale prima da «Pratiche».' : ''; },
    dopoAppuntamento: function (x, a) { if (x && x.richiesta) { var r = richieste().filter(function (q) { return q.id === x.richiesta; })[0]; if (r) { r.stato = 'confermata'; r.app = a.id; B.registra('Richiesta online confermata', r.nome, a.titolo + ' · ' + U.fmt(a.data) + ' ' + a.ora); } } },
    dopoCarica: function (dati) { dati.settore.pratiche = dati.settore.pratiche || []; dati.settore.richieste = dati.settore.richieste || []; autoConcludi(dati); },
    datiDemo: datiDemo,
    paginePubbliche: { richiesta: paginaRichiesta }
  });
})();
