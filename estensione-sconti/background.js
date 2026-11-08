// ARCHIVIO: salva i codici per sito e decide l'ordine di prova.
// Chrome/Edge/Brave: service worker (importScripts). Firefox: pagina eventi, domain.js è già caricato da manifest (scripts).
if (typeof importScripts === 'function') importScripts('domain.js', 'estrattore.js', 'lib-extra.js');
const api = globalThis.browser ?? chrome; // stessa API, con le promesse, anche in Firefox

const SETTE_GIORNI = 7 * 24 * 3600 * 1000;
const avviiInCorso = new Set(); // schede dove una prova sta partendo
const OPZIONI_BASE = {
  usaComuni: true, maxCodici: 20, esplora: true, condividi: false, ricaricaAuto: false, fonti: [],
  soloIcona: false, googleBadge: false, couponAperti: false, gmail: true, storicoPrezzi: true,
  cashback: { attivo: false, servizio: 'beruby', url: '', nomeAltro: '', tutti: true, negozi: [] }
};
const FONTE_EMAIL = 'email', FONTE_EMAIL_AUTO = 'email (automatico)', FONTE_COUPON = 'sito di coupon (aperto da te)';

// Codici condivisi (anonimi, SPENTI di base). L'indirizzo e la chiave pubblica (anon) si mettono qui; senza chiave la funzione risponde lo stesso se non la richiede.
const ENDPOINT_CONDIVISO = 'https://udubhzamghhlkxgepmmc.supabase.co/functions/v1/cacciasconti-codici';
const SUPABASE_ANON_KEY = '';

const COMUNI = [
  'WELCOME10', 'SCONTO10', 'BENVENUTO10', 'PRIMOORDINE', 'FIRST10', 'SCONTO5', 'SCONTO15', 'SCONTO20',
  'SAVE10', 'SAVE15', 'SAVE20', 'WELCOME', 'WELCOME5', 'WELCOME15', 'WELCOME20', 'BENVENUTO',
  'BENVENUTO5', 'BENVENUTO15', 'PRIMO10', 'FIRST15', 'NEWSLETTER', 'NEWSLETTER10', 'NEWSLETTER5',
  'BLACKFRIDAY', 'BLACK10', 'BLACK20', 'NATALE10', 'NATALE20', 'ESTATE10', 'SALDI', 'SALDI10',
  'SALDI20', 'PROMO10', 'PROMO20', 'GRAZIE10', 'THANKYOU10', 'HELLO10', 'FREESHIP',
  'SPEDIZIONEGRATIS', 'EXTRA10', 'OFFERTA10', 'CIAO10'
];

// Le operazioni sull'archivio vanno una dopo l'altra, per non sovrascriversi.
let coda = Promise.resolve();
function inFila(fn) {
  const p = coda.then(fn, fn);
  coda = p.catch(() => {});
  return p;
}

function normalizza(c) {
  const s = String(c || '').trim().toUpperCase();
  if (s.length < 4 || s.length > 20) return null;
  if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(s) || !/[A-Z]/.test(s)) return null;
  return s;
}

async function leggiOpzioni() {
  const r = await chrome.storage.local.get('opzioni');
  return Object.assign({}, OPZIONI_BASE, r.opzioni || {});
}
async function leggiArchivio() {
  const r = await chrome.storage.local.get('archivio');
  return r.archivio || {};
}
const scriviArchivio = (archivio) => chrome.storage.local.set({ archivio });

const TRENTA_GIORNI = 30 * 24 * 3600 * 1000;

// Ordine: funzionati di recente (risparmio maggiore prima) > trovati nel sito (più nuovi prima)
// > codici funzionati più di 30 giorni fa > manuali > comuni.
function ordinaPerStato(lista) {
  const adesso = Date.now();
  const rango = (e) => {
    if (e.esito === 'ok') return adesso - (e.data || 0) < TRENTA_GIORNI ? 0 : 1.5;
    if (e.source === 'pagina' || ETICHETTE_FONTE.includes(e.source)) return 1;
    if (e.source === 'manuale') return 2;
    if (e.source === FONTE_DEBOLE) return 2.5; // trovato solo dal nome di una classe: dopo quelli aggiunti a mano
    return 3;
  };
  return lista
    .map((e, i) => [e, i])
    .sort((a, b) => {
      const ra = rango(a[0]), rb = rango(b[0]);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return (b[0].sconto || 0) - (a[0].sconto || 0) || a[1] - b[1];
      if (ra === 1) return (b[0].trovato || 0) - (a[0].trovato || 0) || a[1] - b[1];
      return a[1] - b[1];
    })
    .map((x) => x[0]);
}

// Motivi che dipendono dal carrello e non dal codice: il codice NON è "ko", è "da riprovare".
const MOTIVI_CARRELLO = ['importo minimo', 'non applicabile', 'carrello vuoto', 'troppi tentativi', 'totale non leggibile'];
const inizioOggi = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

function costruisciCoda(archivio, dominio, opz, riprova, totale) {
  const adesso = Date.now();
  const mappa = archivio[dominio] || {};
  let lista = Object.values(mappa).filter((e) => opz.usaComuni || e.source !== 'comune');
  if (opz.usaComuni) {
    for (const c of COMUNI) if (!mappa[c]) lista.push({ code: c, source: 'comune', esito: 'mai' });
  }
  // Codici con una scadenza passata (scritta nella pagina) non si provano.
  lista = lista.filter((e) => !(e.scade && e.scade < inizioOggi()));
  // Salta i codici che hanno fallito da meno di 7 giorni (a meno che l'utente scelga "riprova tutti").
  if (!riprova) lista = lista.filter((e) => !(e.esito === 'ko' && adesso - (e.data || 0) < SETTE_GIORNI));
  // "Importo minimo": si riprova solo quando il carrello è cresciuto rispetto all'ultima prova (stesso totale = stesso risultato).
  if (!riprova) {
    lista = lista.filter((e) => !(e.esito === 'riprova' && e.motivo === 'importo minimo' && totale != null && e.totaleAl != null && totale <= e.totaleAl + 0.004));
  }
  return ordinaPerStato(lista).slice(0, Math.max(1, opz.maxCodici)).map((e) => e.code);
}

// Pulizia dell'archivio, per restare molto sotto il limite di spazio del browser:
// al massimo MAX_PER_SITO codici per sito (restano prima quelli che funzionano, poi i tuoi, poi i più recenti),
// via i codici trovati nelle pagine e mai provati da più di 60 giorni, via quelli scaduti, al massimo MAX_SITI siti.
const MAX_PER_SITO = 40, MAX_SITI = 200, SESSANTA_GIORNI = 60 * 24 * 3600 * 1000;
function potatura(arch) {
  const adesso = Date.now();
  const peso = (e) => (e.esito === 'ok' ? 0 : e.source === 'manuale' ? 1 : e.esito === 'riprova' ? 2 : e.esito === 'ko' ? 3 : 4);
  for (const dom of Object.keys(arch)) {
    const sito = arch[dom];
    for (const [c, e] of Object.entries(sito)) {
      if (e.esito === 'mai' && e.source !== 'manuale' && adesso - (e.trovato || 0) > SESSANTA_GIORNI) delete sito[c];
      else if (e.scade && e.scade < adesso - 24 * 3600 * 1000) delete sito[c];
    }
    const voci = Object.values(sito);
    if (voci.length > MAX_PER_SITO) {
      voci.sort((a, b) => peso(a) - peso(b) || (b.data || b.trovato || 0) - (a.data || a.trovato || 0));
      for (const e of voci.slice(MAX_PER_SITO)) delete sito[e.code];
    }
    if (!Object.keys(sito).length) delete arch[dom];
  }
  const doms = Object.keys(arch);
  if (doms.length > MAX_SITI) {
    const ultima = (d) => Math.max(0, ...Object.values(arch[d]).map((e) => e.data || e.trovato || 0));
    const caro = (d) => (Object.values(arch[d]).some((e) => e.esito === 'ok' || e.source === 'manuale') ? 1 : 0);
    doms.sort((a, b) => caro(b) - caro(a) || ultima(b) - ultima(a));
    for (const d of doms.slice(MAX_SITI)) delete arch[d];
  }
  return arch;
}

async function aggiornaBadge(tabId, dominio, campo, totale) {
  if (tabId == null) return;
  const [arch, opz] = [await leggiArchivio(), await leggiOpzioni()];
  const n = campo
    ? costruisciCoda(arch, dominio, opz, false, totale).length
    : Object.values(arch[dominio] || {}).filter((e) => e.esito !== 'ko').length;
  try {
    await chrome.action.setBadgeText({ tabId, text: n ? String(n) : '' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#0f9d78' });
  } catch (e) {}
  return n;
}

let ricetteCache = null;
async function leggiRicette() {
  if (ricetteCache) return ricetteCache;
  const out = [];
  try {
    const indice = await (await fetch(chrome.runtime.getURL('recipes/indice.json'))).json();
    for (const f of indice) out.push(await (await fetch(chrome.runtime.getURL('recipes/' + f))).json());
    ricetteCache = out;
  } catch (e) {}
  return out;
}


// ---------- Frame: ogni frame della scheda si registra, il fondo li coordina ----------
const chiaveFrames = (tabId) => 'frames_' + tabId;
async function leggiFrames(tabId) {
  const k = chiaveFrames(tabId);
  return (await chrome.storage.session.get(k))[k] || [];
}
function registraFrame(tabId, frameId) {
  return inFila(async () => {
    const lista = await leggiFrames(tabId);
    if (!lista.includes(frameId)) lista.push(frameId);
    await chrome.storage.session.set({ [chiaveFrames(tabId)]: lista });
  });
}
function togliFrame(tabId, ids) {
  if (!ids.length) return Promise.resolve();
  return inFila(async () => {
    const lista = (await leggiFrames(tabId)).filter((x) => !ids.includes(x));
    await chrome.storage.session.set({ [chiaveFrames(tabId)]: lista });
  });
}
const conTempo = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(undefined), ms))]);
// Manda un messaggio a tutti i frame registrati (tranne quelli esclusi) e raccoglie le risposte.
async function aiFrame(tabId, m, esclusi) {
  const ids = (await leggiFrames(tabId)).filter((id) => !(esclusi || []).includes(id));
  const out = [], morti = [];
  await Promise.all(ids.map(async (id) => {
    try {
      const r = await conTempo(chrome.tabs.sendMessage(tabId, m, { frameId: id }), 1500);
      if (r !== undefined && r !== null) out.push({ frameId: id, r });
    } catch (e) {
      if (/Receiving end does not exist|No frame with id|No tab with id/i.test(String(e && e.message))) morti.push(id);
    }
  }));
  await togliFrame(tabId, morti);
  return out.sort((a, b) => a.frameId - b.frameId);
}
const aUnFrame = async (tabId, frameId, m) => {
  try { return await conTempo(chrome.tabs.sendMessage(tabId, m, { frameId }), 1500); } catch (e) { return null; }
};

// ---------- Salvataggio dei codici trovati (da pagina, sito del negozio, fonti, condivisi) ----------
const FONTE_DEBOLE = 'pagina (classe)';
const ETICHETTE_FONTE = ['pagina', 'sito del negozio', 'fonte indicata da te', 'condivisi', FONTE_EMAIL, FONTE_EMAIL_AUTO, FONTE_COUPON];
// scadenze: { CODICE: timestamp } quando la pagina scrive fino a quando vale il codice.
function salvaTrovati(dominio, codici, fonte, scadenze, info) {
  info = info || {};
  scadenze = scadenze || (codici && codici.scad) || {};
  return inFila(async () => {
    const arch = await leggiArchivio();
    const sito = (arch[dominio] = arch[dominio] || {});
    let nuovi = 0;
    for (const grezzo of codici || []) {
      const c = normalizza(grezzo);
      if (!c) continue;
      const sc = Number(scadenze[grezzo]) || Number(scadenze[c]) || null;
      if (sc && sc < inizioOggi()) continue;
      if (sito[c]) {
        // già noto: aggiorno solo la scadenza, se la pagina ne scrive una
        if (sc && sito[c].scade !== sc) { sito[c].scade = sc; nuovi++; }
        continue;
      }
      sito[c] = { code: c, source: fonte, origine: fonte, esito: 'mai', sconto: null, data: null, trovato: Date.now() };
      if (sc) sito[c].scade = sc;
      const inf = info[grezzo] || info[c];
      if (inf) sito[c].info = String(inf).slice(0, 40);
      nuovi++;
    }
    if (nuovi) await scriviArchivio(potatura(arch));
    return { nuovi };
  });
}

// ---------- Rete: scarica con tempo massimo, senza cookie ----------
async function scarica(url, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms || 5000);
  try {
    const r = await fetch(url, { credentials: 'omit', signal: ac.signal, redirect: 'follow', cache: 'no-store' });
    return r;
  } finally { clearTimeout(t); }
}

// ---------- robots.txt ----------
// Regole del gruppo "User-agent: *". 404 e simili = tutto permesso; errore del server o di rete = non tocco niente.
async function leggiRobots(origin) {
  try {
    const r = await scarica(origin + '/robots.txt', 5000);
    if (r.status >= 500) return { vietaTutto: true, regole: [] };
    if (!r.ok) return { vietaTutto: false, regole: [] };
    const righe = (await r.text()).slice(0, 200000).split(/\r?\n/);
    const regole = [];
    let nelGruppo = false, vistoAgente = false;
    for (let riga of righe) {
      riga = riga.replace(/#.*/, '').trim();
      const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(riga);
      if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === 'user-agent') {
        if (vistoAgente === false) nelGruppo = false;
        vistoAgente = true;
        if (v === '*') nelGruppo = true;
      } else {
        vistoAgente = false;
        if (nelGruppo && (k === 'disallow' || k === 'allow') && v) regole.push({ permesso: k === 'allow', modello: v });
      }
    }
    return { vietaTutto: false, regole };
  } catch (e) { return { vietaTutto: true, regole: [] }; }
}
function consentito(robots, percorso) {
  if (robots.vietaTutto) return false;
  let migliore = null;
  for (const r of robots.regole) {
    const fine = r.modello.endsWith('$');
    const corpo = (fine ? r.modello.slice(0, -1) : r.modello).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    if (new RegExp('^' + corpo + (fine ? '$' : '')).test(percorso)) {
      const peso = r.modello.length;
      if (!migliore || peso > migliore.peso || (peso === migliore.peso && r.permesso)) migliore = { peso, permesso: r.permesso };
    }
  }
  return !migliore || migliore.permesso;
}

// ---------- Esploratore del negozio: poche pagine pubbliche dello STESSO negozio, una volta al giorno ----------
const PERCORSI_PROMO = ['/promo', '/promozioni', '/offerte', '/sconti', '/coupon', '/codici-sconto', '/pages/promo', '/sale', '/newsletter'];
const RE_LINK_PROMO = /promo|offert|sconti|coupon|codice/i;
const MAX_PAGINE = 8;
const UN_GIORNO = 24 * 3600 * 1000;

// Si segna "fatto" solo DOPO uno scarico riuscito: se la rete cade, si riprova alla prossima visita.
const esplorazioniInCorso = new Set(); // evita due scarichi insieme dallo stesso sito (due schede)
async function giaFattoOggi(chiave) {
  if (esplorazioniInCorso.has(chiave)) return true;
  const r = (await chrome.storage.local.get('esplorati')).esplorati || {};
  return !!(r[chiave] && Date.now() - r[chiave] < UN_GIORNO);
}
function segnaFatto(chiave) {
  return inFila(async () => {
    const r = (await chrome.storage.local.get('esplorati')).esplorati || {};
    r[chiave] = Date.now();
    await chrome.storage.local.set({ esplorati: r });
  });
}
async function paginaHtml(url) {
  try {
    const r = await scarica(url, 5000);
    if (!r.ok || !/html|text/i.test(r.headers.get('content-type') || 'text/html')) return null;
    return (await r.text()).slice(0, 600000);
  } catch (e) { return null; }
}
function linkPromo(html, origin) {
  const out = [];
  const re = /<a\s[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 20) {
    const testo = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!RE_LINK_PROMO.test(testo) || testo.length > 80) continue;
    try {
      const u = new URL(m[1], origin + '/');
      if (u.origin !== origin || !/^https?:$/.test(u.protocol) || /\.(jpe?g|png|gif|webp|svg|pdf|css|js|zip)$/i.test(u.pathname)) continue;
      out.push(u.pathname + u.search);
    } catch (e) {}
  }
  return out;
}
async function esplora(dominio, origin) {
  const opz = await leggiOpzioni();
  const esito = { pagine: [], nuovi: 0, saltato: null };
  if (!/^https?:\/\//.test(origin || '')) { esito.saltato = 'indirizzo non valido'; return esito; }
  const trovati = new Set(), scadenzeTrovate = {};
  const raccogli = (lista) => { Object.assign(scadenzeTrovate, lista.scad || {}); return lista; };
  if (!opz.esplora) esito.saltato = 'spento';
  else if (!(await giaFattoOggi('sito:' + dominio))) {
    esplorazioniInCorso.add('sito:' + dominio);
    try {
    let ottenuto = false;
    const robots = await leggiRobots(origin);
    const percorsi = [];
    const aggiungi = (p) => { if (!percorsi.includes(p) && percorsi.length < MAX_PAGINE && consentito(robots, p.split('?')[0])) percorsi.push(p); };
    aggiungi('/');
    let htmlHome = null;
    if (percorsi.includes('/')) {
      htmlHome = await paginaHtml(origin + '/');
      esito.pagine.push(origin + '/');
      if (htmlHome) ottenuto = true;
      if (htmlHome) for (const c of raccogli(self.CS_dalHtml(htmlHome))) trovati.add(c);
    }
    if (htmlHome) for (const p of linkPromo(htmlHome, origin).slice(0, 4)) aggiungi(p);
    for (const p of PERCORSI_PROMO) aggiungi(p);
    const altre = percorsi.filter((p) => p !== '/');
    for (let i = 0; i < altre.length; i += 3) {
      await Promise.all(altre.slice(i, i + 3).map(async (p) => {
        esito.pagine.push(origin + p);
        const h = await paginaHtml(origin + p);
        if (h) ottenuto = true;
        if (h) for (const c of raccogli(self.CS_dalHtml(h))) trovati.add(c);
      }));
    }
    const lista = [...trovati];
    lista.scad = scadenzeTrovate;
    esito.nuovi += (await salvaTrovati(dominio, lista, 'sito del negozio')).nuovi;
    if (ottenuto) await segnaFatto('sito:' + dominio);
    } finally { esplorazioniInCorso.delete('sito:' + dominio); }
  } else esito.saltato = 'già fatto nelle ultime 24 ore';

  // Fonti aggiuntive scelte dall'utente per questo sito (stessa regola di robots.txt)
  for (const f of opz.fonti || []) {
    if (!f || f.dominio !== dominio) continue;
    let u;
    try { u = new URL(f.url); } catch (e) { continue; }
    if (!/^https?:$/.test(u.protocol) || (await giaFattoOggi('fonte:' + f.url))) continue;
    const robots = await leggiRobots(u.origin);
    if (!consentito(robots, u.pathname)) { esito.fonteVietata = (esito.fonteVietata || []).concat(f.url); continue; }
    esito.pagine.push(f.url);
    esplorazioniInCorso.add('fonte:' + f.url);
    try {
      const h = await paginaHtml(f.url);
      if (h) { esito.nuovi += (await salvaTrovati(dominio, self.CS_dalHtml(h), 'fonte indicata da te')).nuovi; await segnaFatto('fonte:' + f.url); }
    } finally { esplorazioniInCorso.delete('fonte:' + f.url); }
  }
  return esito;
}

// ---------- Codici condivisi (anonimi, solo se l'utente li accende) ----------
const intestazioniCondiviso = () => {
  const h = { 'content-type': 'application/json' };
  if (SUPABASE_ANON_KEY) { h.apikey = SUPABASE_ANON_KEY; h.authorization = 'Bearer ' + SUPABASE_ANON_KEY; }
  return h;
};
const urlCondiviso = (opz) => (opz && opz.endpoint) || ENDPOINT_CONDIVISO;
const ultimoScarico = {};
async function scaricaCondivisi(dominio, opz, fresco) {
  if (!opz.condividi) return;
  if (!fresco && ultimoScarico[dominio] && Date.now() - ultimoScarico[dominio] < 6 * 3600 * 1000) return;
  ultimoScarico[dominio] = Date.now();
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    const r = await fetch(urlCondiviso(opz) + '?domain=' + encodeURIComponent(dominio), { headers: intestazioniCondiviso(), credentials: 'omit', signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return;
    const j = await r.json();
    await salvaTrovati(dominio, (j.codici || []).map((x) => x.code), 'condivisi');
  } catch (e) {}
}
// Invia SOLO: sito, codice, se ha funzionato, percentuale di sconto. Mai i codici scritti a mano (possono essere personali).
async function inviaRisultato(opz, dominio, codice, ok, pct) {
  if (!opz.condividi) return;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    await fetch(urlCondiviso(opz), {
      method: 'POST', headers: intestazioniCondiviso(), credentials: 'omit', signal: ac.signal,
      body: JSON.stringify({ domain: dominio, code: codice, worked: !!ok, saving_pct: pct == null ? null : Math.min(100, Math.max(0, Math.round(pct * 100) / 100)) })
    });
    clearTimeout(t);
  } catch (e) {}
}


// ---------- Prezzi dei prodotti: storico locale, "avvisami se scende" ----------
const MAX_PRODOTTI = 500, MAX_SEGUITI = 100;
const PARAM_TRACCIA = /^(utm_.+|fbclid|gclid|msclkid|mc_cid|mc_eid|igshid|_ga|ref|ref_|tag|affiliate|aff|aff_id|cmpid|dclid|yclid|srsltid)$/i;
function urlPulito(u) {
  try {
    const x = new URL(u);
    x.hash = '';
    for (const k of [...x.searchParams.keys()]) if (PARAM_TRACCIA.test(k)) x.searchParams.delete(k);
    return x.href;
  } catch (e) { return null; }
}
const notificheInviate = []; // ultime notifiche (anche per le prove)
function notifica(id, titolo, testo) {
  notificheInviate.push({ id, titolo, testo, ts: Date.now() });
  if (notificheInviate.length > 20) notificheInviate.shift();
  try {
    chrome.notifications.create(id, { type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'), title: titolo, message: testo });
  } catch (e) {}
}
try {
  chrome.notifications.onClicked.addListener(async (id) => {
    if (!String(id).startsWith('prezzo:')) return;
    const rec = ((await chrome.storage.local.get('prezzi')).prezzi || {})[id.slice(7)];
    if (rec && rec.url) chrome.tabs.create({ url: rec.url });
    try { chrome.notifications.clear(id); } catch (e) {}
  });
} catch (e) {}

// Registra il prezzo visto (un punto al giorno) e, se il prodotto è tra quelli seguiti, avvisa quando è sceso.
function registraPrezzo(chiave, dati, prezzo, fonte) {
  return inFila(async () => {
    const prezzi = (await chrome.storage.local.get('prezzi')).prezzi || {};
    const nuovo = !prezzi[chiave];
    const rec = prezzi[chiave] || { nome: '', dominio: dati.dominio, valuta: '€', url: dati.url, punti: [], avvisa: false };
    if (dati.nome) rec.nome = String(dati.nome).slice(0, 120);
    if (dati.url) rec.url = dati.url;
    rec.valuta = simboloValuta(dati.valuta || rec.valuta);
    rec.punti = self.CS_lib.aggiungiPunto(rec.punti, prezzo, Date.now());
    if (fonte === 'visita') rec.visto = Date.now();
    else rec.visto = rec.visto || Date.now();
    let avviso = null;
    if (rec.avvisa) {
      if (rec.prezzoRif != null && prezzo < rec.prezzoRif - 0.004) avviso = { da: rec.prezzoRif, a: prezzo };
      rec.prezzoRif = prezzo;
    }
    prezzi[chiave] = rec;
    // Al massimo MAX_PRODOTTI: via prima quelli non seguiti e meno recenti
    const chiavi = Object.keys(prezzi);
    if (chiavi.length > MAX_PRODOTTI) {
      chiavi.sort((a, b) => (prezzi[b].avvisa ? 1 : 0) - (prezzi[a].avvisa ? 1 : 0) || (prezzi[b].visto || 0) - (prezzi[a].visto || 0));
      chiavi.slice(MAX_PRODOTTI).forEach((k) => delete prezzi[k]);
    }
    await chrome.storage.local.set({ prezzi });
    if (avviso) notifica('prezzo:' + chiave, 'Il prezzo è sceso', (rec.nome || chiave) + ': da ' + formattaImporto(avviso.da, rec.valuta) + ' a ' + formattaImporto(avviso.a, rec.valuta));
    return { nuovo, avviso: !!avviso };
  });
}

// Controllo in secondo piano SOLO dei prodotti che segui: al massimo una volta al giorno per prodotto, senza cookie, rispettando robots.txt.
let controlloInCorso = false, ultimoGiroControllo = 0;
async function controllaOsservati(forza) {
  if (controlloInCorso || (!forza && Date.now() - ultimoGiroControllo < 30 * 60 * 1000)) return { saltato: true };
  controlloInCorso = true;
  ultimoGiroControllo = Date.now();
  const esito = { controllati: 0, vietati: 0, errori: 0 };
  try {
    const prezzi = (await chrome.storage.local.get('prezzi')).prezzi || {};
    const dovuti = Object.entries(prezzi).filter(([, r]) => r.avvisa && r.url && Date.now() - (r.ultimoControllo || 0) >= UN_GIORNO).slice(0, 15);
    const segna = (chiave, ts) => inFila(async () => {
      const t = (await chrome.storage.local.get('prezzi')).prezzi || {};
      if (t[chiave]) { t[chiave].ultimoControllo = ts; await chrome.storage.local.set({ prezzi: t }); }
    });
    for (const [chiave, r] of dovuti) {
      let u;
      try { u = new URL(r.url); } catch (e) { continue; }
      if (!/^https?:$/.test(u.protocol)) continue;
      const robots = await leggiRobots(u.origin);
      if (!consentito(robots, u.pathname)) { esito.vietati++; await segna(chiave, Date.now()); continue; }
      const h = await paginaHtml(r.url);
      const p = h ? self.CS_lib.prezzoDaHtml(h) : null;
      if (!p || !(p.prezzo > 0)) { esito.errori++; await segna(chiave, Date.now() - UN_GIORNO + 4 * 3600 * 1000); continue; } // riprova tra 4 ore
      await segna(chiave, Date.now());
      await registraPrezzo(chiave, { nome: null, dominio: r.dominio, valuta: p.valuta, url: r.url }, p.prezzo, 'controllo');
      esito.controllati++;
    }
  } finally { controlloInCorso = false; }
  return esito;
}

// ---------- Codici delle email dal database personale dell'utente (chiave personale, solo in locale) ----------
const SEI_ORE = 6 * 3600 * 1000;
const RE_DOM = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
const leggiChiave = async () => ((await chrome.storage.local.get('chiavePersonale')).chiavePersonale) || '';
const fineGiornoIso = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999); return isNaN(d) ? null : d.getTime(); };
let personaliInCorso = null;
function scaricaPersonali(dominio, forza) {
  if (personaliInCorso && !dominio) return personaliInCorso;
  const p = (async () => {
    const chiave = await leggiChiave();
    if (!chiave) return { saltato: 'senza chiave' };
    const st = (await chrome.storage.local.get('statoPersonali')).statoPersonali || {};
    if (!dominio && !forza && (Date.now() - (st.ts || 0) < SEI_ORE || Date.now() - (st.tentativo || 0) < 15 * 60 * 1000)) return { saltato: 'recente' };
    const opz = await leggiOpzioni();
    const aggiorna = (x) => inFila(async () => {
      const s2 = (await chrome.storage.local.get('statoPersonali')).statoPersonali || {};
      await chrome.storage.local.set({ statoPersonali: Object.assign(s2, x) });
    });
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 5000);
      const h = intestazioniCondiviso();
      delete h['content-type'];
      h['x-cacciasconti-token'] = chiave;
      const r = await fetch(urlCondiviso(opz) + '?personali=1' + (dominio ? '&domain=' + encodeURIComponent(dominio) : ''), { headers: h, credentials: 'omit', signal: ac.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!r.ok) { await aggiorna({ errore: r.status === 401 ? 'chiave non valida' : r.status === 503 ? 'servizio non configurato' : 'errore ' + r.status, tentativo: Date.now() }); return { errore: r.status }; }
      const j = await r.json();
      const per = {};
      for (const x of Array.isArray(j.codici) ? j.codici.slice(0, 500) : []) {
        const d = String((x && x.domain) || '').toLowerCase();
        if (!RE_DOM.test(d) || d.length > 253) continue;
        (per[d] = per[d] || []).push(x);
      }
      let n = 0;
      for (const [d, righe] of Object.entries(per)) {
        const scad = {}, info = {};
        const codici = righe.map((x) => { const c = normalizza(x.code); if (c) { const sc = fineGiornoIso(x.scade_il); if (sc) scad[c] = sc; if (x.sconto) info[c] = x.sconto; } return c; }).filter(Boolean);
        n += (await salvaTrovati(d, codici, FONTE_EMAIL_AUTO, scad, info)).nuovi;
      }
      if (!dominio) await aggiorna({ ts: Date.now(), tentativo: 0, errore: null, n: Object.values(per).reduce((a, x) => a + x.length, 0) });
      else await aggiorna({ errore: null });
      return { nuovi: n };
    } catch (e) { await aggiorna({ errore: 'non raggiungibile', tentativo: Date.now() }); return { errore: 'rete' }; }
  })();
  if (!dominio) { personaliInCorso = p; p.finally(() => { personaliInCorso = null; }); }
  return p;
}

// ---------- Registro cashback (a mano) ----------
const STATI_CB = ['in attesa', 'accreditato', 'mancante'];
const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(new Date(s + 'T12:00:00'));
const oggiIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
async function leggiRegistro() { return (await chrome.storage.local.get('cashbackRegistro')).cashbackRegistro || []; }
const scriviRegistro = (v) => chrome.storage.local.set({ cashbackRegistro: v });

let coupon_ricette = null;
async function ricetteCoupon() {
  if (coupon_ricette) return coupon_ricette;
  try { coupon_ricette = await (await fetch(chrome.runtime.getURL('recipes/siti-coupon.json'))).json(); } catch (e) { coupon_ricette = { aggregatori: [] }; }
  return coupon_ricette;
}
const sitoDelMittente = (sender) => { try { return new URL(sender.tab.url).hostname; } catch (e) { return ''; } };

// ---------- Aggiornamento da cartella (modalità sviluppatore): se il manifest su disco è più nuovo, si ricarica ----------
const versioneMaggiore = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
};
async function testInCorso() {
  const t = await chrome.storage.session.get(null);
  return Object.keys(t).some((k) => k.startsWith('test_') && t[k] && !t[k].concluso && Date.now() - t[k].ts < 60000);
}
async function controllaAggiornamento(soloControlla) {
  try {
    const r = await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' });
    const su_disco = (await r.json()).version;
    const attuale = chrome.runtime.getManifest().version;
    if (!versioneMaggiore(su_disco, attuale)) { await chrome.storage.local.remove('aggiornamentoPronto'); return { nuova: null, attuale }; }
    await chrome.storage.local.set({ aggiornamentoPronto: su_disco });
    const occupato = await testInCorso();
    const ricarica = (await leggiOpzioni()).ricaricaAuto === true;
    if (!occupato && !soloControlla && ricarica) { setTimeout(() => chrome.runtime.reload(), 200); return { nuova: su_disco, attuale, ricarico: true }; }
    return { nuova: su_disco, attuale, ricarico: false };
  } catch (e) { return { errore: String(e) }; }
}
// Niente permesso "alarms": il controllo parte all'avvio del browser, all'installazione e ogni volta che si apre il popup.
// (Ha senso solo per la cartella caricata a mano; con gli store aggiornano gli store.)
try {
  chrome.runtime.onStartup.addListener(() => { controllaAggiornamento(); controllaOsservati(); scaricaPersonali(null, false); });
  chrome.runtime.onInstalled.addListener(() => controllaAggiornamento());
} catch (e) {}

async function gestisci(m, sender) {
  const tabId = m.tabId != null ? m.tabId : sender && sender.tab ? sender.tab.id : null;
  // I codici sono sempre del sito che si vede nella barra, anche se il messaggio arriva da un frame di un altro sito.
  if (sender && sender.tab && /^https?:/.test(sender.tab.url || '') && !/^chrome-extension:/.test(sender.url || '') && m.dominio != null) {
    try { m.dominio = dominioDi(new URL(sender.tab.url).hostname); } catch (e) {}
  }
  switch (m.type) {
    case 'trovati': {
      const a = await salvaTrovati(m.dominio, m.codici, 'pagina', m.scadenze);
      const b = (m.deboli && m.deboli.length) ? await salvaTrovati(m.dominio, m.deboli, FONTE_DEBOLE, m.scadenze) : { nuovi: 0 };
      return { nuovi: a.nuovi + b.nuovi };
    }
    case 'aggiungi':
      return inFila(async () => {
        const c = normalizza(m.codice);
        if (!c) return { errore: 'Codice non valido: usa da 4 a 20 tra lettere, numeri e trattino.' };
        const arch = await leggiArchivio();
        const sito = (arch[m.dominio] = arch[m.dominio] || {});
        if (sito[c]) {
          if (sito[c].esito === 'ko' || sito[c].esito === 'riprova') sito[c].esito = 'mai'; // l'utente vuole riprovarlo
        } else {
          sito[c] = { code: c, source: 'manuale', origine: 'manuale', esito: 'mai', sconto: null, data: null, trovato: Date.now() };
        }
        await scriviArchivio(potatura(arch));
        return { ok: true };
      });
    case 'rimuovi':
      return inFila(async () => {
        const arch = await leggiArchivio();
        if (arch[m.dominio]) delete arch[m.dominio][m.codice];
        await scriviArchivio(arch);
        return { ok: true };
      });
    case 'risultato':
      return inFila(async () => {
        const arch = await leggiArchivio();
        const sito = (arch[m.dominio] = arch[m.dominio] || {});
        const c = m.codice;
        const e = sito[c] || { code: c, source: 'comune', origine: 'comune', trovato: Date.now() };
        // "da riprovare" = il motivo dipende dal carrello (importo minimo, non applicabile, carrello vuoto, troppi tentativi, totale non leggibile), non dal codice
        const daRiprovare = !m.ok && (m.riprova === true || MOTIVI_CARRELLO.includes(m.motivo));
        e.esito = m.ok ? 'ok' : daRiprovare ? 'riprova' : 'ko';
        e.totaleAl = typeof m.totale === 'number' && isFinite(m.totale) ? m.totale : null;
        e.sconto = m.ok ? m.sconto : null;
        e.simbolo = simboloValuta(m.simbolo);
        e.data = Date.now();
        e.motivo = m.ok ? null : m.motivo || 'nessuna reazione';
        e.source = m.ok ? 'funzionato' : e.origine || 'comune';
        sito[c] = e;
        await scriviArchivio(potatura(arch));
        // Si segnala solo ciò che dice qualcosa sul CODICE: "funziona" o "non esiste/non vale". Mai i motivi che dipendono dal carrello.
        if (e.origine !== 'manuale' && e.esito !== 'riprova') inviaRisultato(await leggiOpzioni(), m.dominio, c, m.ok, m.ok ? m.pct : null);
        return { ok: true };
      });
    case 'stato': {
      const [arch, opz] = [await leggiArchivio(), await leggiOpzioni()];
      const mappa = arch[m.dominio] || {};
      const codici = ordinaPerStato(Object.values(mappa));
      const nComuni = opz.usaComuni ? COMUNI.filter((c) => !mappa[c]).length : 0;
      return { codici, nComuni, opzioni: opz };
    }
    case 'coda': {
      await scaricaCondivisi(m.dominio, await leggiOpzioni(), !!m.avvio);
      if (m.avvio) await scaricaPersonali(m.dominio, true); // prima di una prova: codici delle email per questo sito (se hai messo la chiave)
      const [arch, opz] = [await leggiArchivio(), await leggiOpzioni()];
      return { coda: costruisciCoda(arch, m.dominio, opz, !!m.riprova, typeof m.totale === 'number' ? m.totale : null), opzioni: opz };
    }
    case 'badge':
      controllaOsservati();
      scaricaPersonali(null, false);
      return { n: await aggiornaBadge(tabId, m.dominio, m.campo, typeof m.totale === 'number' ? m.totale : null) };
    case 'ricette':
      return { ricette: await leggiRicette() };
    case 'storico':
      return inFila(async () => {
        const r = await chrome.storage.local.get('storico');
        const lista = r.storico || [];
        lista.unshift({ dominio: m.dominio, codice: m.codice, risparmio: m.risparmio, simbolo: simboloValuta(m.simbolo), data: Date.now() });
        await chrome.storage.local.set({ storico: lista.slice(0, 500) });
        return { ok: true };
      });
    case 'leggiStorico':
      return { storico: (await chrome.storage.local.get('storico')).storico || [] };
    case 'nascondiCard':
      return inFila(async () => {
        const r = await chrome.storage.local.get('nascosti');
        const n = r.nascosti || {};
        n[m.dominio] = Date.now();
        await chrome.storage.local.set({ nascosti: n });
        return { ok: true };
      });
    case 'cardNascosta': {
      const n = (await chrome.storage.local.get('nascosti')).nascosti || {};
      return { nascosta: !!n[m.dominio] && Date.now() - n[m.dominio] < 24 * 3600 * 1000 };
    }
    case 'esporta': {
      const r = await chrome.storage.local.get(['archivio', 'storico', 'opzioni', 'cashbackRegistro']);
      return { dati: { app: 'Cacciasconti', versione: 1, archivio: r.archivio || {}, storico: r.storico || [], opzioni: r.opzioni || {}, cashbackRegistro: r.cashbackRegistro || [] } };
    }
    case 'importa':
      return inFila(async () => {
        const d = m.dati;
        if (!d || d.app !== 'Cacciasconti' || typeof d.archivio !== 'object') return { errore: 'File non valido.' };
        const arch = await leggiArchivio();
        for (const dom of Object.keys(d.archivio)) {
          const sito = (arch[dom] = arch[dom] || {});
          for (const e of Object.values(d.archivio[dom] || {})) {
            const c = normalizza(e && e.code);
            if (!c) continue;
            const vecchio = sito[c];
            if (!vecchio || (e.data || 0) > (vecchio.data || 0)) {
              sito[c] = { code: c, source: e.source || 'manuale', origine: e.origine || 'manuale', esito: e.esito || 'mai',
                sconto: e.sconto || null, simbolo: e.simbolo ? simboloValuta(e.simbolo) : '€', data: e.data || null, trovato: e.trovato || Date.now(), motivo: e.motivo || null, scade: Number(e.scade) || null, totaleAl: typeof e.totaleAl === 'number' ? e.totaleAl : null };
            }
          }
        }
        await scriviArchivio(potatura(arch));
        if (Array.isArray(d.cashbackRegistro)) {
          const v = await leggiRegistro();
          const ids = new Set(v.map((x) => x.id));
          for (const x of d.cashbackRegistro.slice(0, 500)) {
            if (x && typeof x.id === 'string' && !ids.has(x.id) && x.negozio && STATI_CB.includes(x.stato) && dataValida(x.data) && isFinite(Number(x.importo))) v.push({ id: x.id.slice(0, 30), negozio: String(x.negozio).slice(0, 60), importo: Number(x.importo), data: x.data, stato: x.stato });
          }
          await scriviRegistro(v.slice(0, 500));
        }
        if (Array.isArray(d.storico)) {
          const r = await chrome.storage.local.get('storico');
          const chiavi = new Set((r.storico || []).map((x) => x.dominio + x.codice + x.data));
          const unito = (r.storico || []).concat(d.storico.filter((x) => x && !chiavi.has(x.dominio + x.codice + x.data)));
          unito.sort((a, b) => b.data - a.data);
          await chrome.storage.local.set({ storico: unito.slice(0, 500) });
        }
        return { ok: true };
      });
    case 'opzioni':
      return inFila(async () => {
        const nuove = Object.assign(await leggiOpzioni(), m.opzioni || {});
        nuove.maxCodici = Math.min(40, Math.max(3, parseInt(nuove.maxCodici, 10) || 20));
        nuove.usaComuni = !!nuove.usaComuni;
        nuove.esplora = nuove.esplora !== false;
        nuove.condividi = nuove.condividi === true;
        nuove.ricaricaAuto = nuove.ricaricaAuto === true;
        nuove.soloIcona = nuove.soloIcona === true;
        nuove.googleBadge = nuove.googleBadge === true;
        nuove.couponAperti = nuove.couponAperti === true;
        nuove.gmail = nuove.gmail !== false;
        nuove.storicoPrezzi = nuove.storicoPrezzi !== false;
        const cb = Object.assign({}, OPZIONI_BASE.cashback, nuove.cashback || {});
        cb.attivo = cb.attivo === true;
        cb.servizio = ['beruby', 'topcashback', 'igraal', 'payback', 'letyshops', 'altro'].includes(cb.servizio) ? cb.servizio : 'beruby';
        cb.url = String(cb.url || '').slice(0, 300);
        cb.nomeAltro = String(cb.nomeAltro || '').slice(0, 40);
        cb.tutti = cb.tutti !== false;
        cb.negozi = (Array.isArray(cb.negozi) ? cb.negozi : []).map((x) => String(x).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')).filter((x) => x && RE_DOM.test(x) && x.length < 100).slice(0, 50);
        nuove.cashback = cb;
        nuove.fonti = (Array.isArray(nuove.fonti) ? nuove.fonti : []).filter((f) => f && /^https?:\/\//.test(f.url || '') && f.dominio).slice(0, 10)
          .map((f) => ({ url: String(f.url).slice(0, 500), dominio: String(f.dominio).toLowerCase().slice(0, 253) }));
        await chrome.storage.local.set({ opzioni: nuove });
        return nuove;
      });
    // Stato del test per scheda (serve a continuare dopo il ricaricamento della pagina).
    case 'sessGet': {
      const k = 'test_' + tabId;
      const r = await chrome.storage.session.get(k);
      return { st: r[k] || null };
    }
    case 'sessSet':
      await chrome.storage.session.set({ ['test_' + tabId]: m.st });
      return { ok: true };
    case 'sessDel':
      await chrome.storage.session.remove('test_' + tabId);
      return { ok: true };
    case 'esplora': {
      let origin = m.origin;
      if (sender && sender.tab && /^https?:/.test(sender.tab.url || '') && !/^chrome-extension:/.test(sender.url || '')) origin = new URL(sender.tab.url).origin;
      const p = esplora(m.dominio, origin);
      return m.attendi ? await p : { ok: true };
    }
    case 'controllaAggiornamento':
      return controllaAggiornamento(!!m.soloControlla);
    case 'ricarica':
      setTimeout(() => chrome.runtime.reload(), 100);
      return { ok: true };
    // ----- Frame -----
    case 'registraFrame':
      if (tabId != null && sender && sender.frameId != null) await registraFrame(tabId, sender.frameId);
      return { ok: true };
    case 'chiSono': {
      let dom = m.dominio;
      try { dom = dominioDi(new URL(sender.tab.url).hostname); } catch (e) {}
      return { frameId: sender ? sender.frameId : 0, tabId, dominio: dom };
    }
    // Quali frame hanno un campo coupon? (serve al popup, alla scheda e al badge)
    case 'statoTab': {
      const r = await aiFrame(tabId, { type: 'haCampo' });
      return { n: r.length, campo: r.some((x) => x.r.campo), inEsecuzione: r.some((x) => x.r.inEsecuzione), frame: r.filter((x) => x.r.campo).map((x) => x.frameId) };
    }
    case 'campoAltrove': {
      const r = await aiFrame(tabId, { type: 'haCampo' }, [sender.frameId]);
      return { campo: r.some((x) => x.r.campo) };
    }
    case 'ricontrolla':
      await aUnFrame(tabId, 0, { type: 'ricontrolla' });
      return { ok: true };
    // Avvia il test nel frame giusto: quello che ha il campo (meglio se c'è proprio l'input visibile).
    case 'avviaTab': {
      // Un solo avvio alla volta per scheda, deciso subito (prima di ogni attesa): due clic veloci non fanno partire due prove.
      if (avviiInCorso.has(tabId)) return { ok: false, errore: 'Già in corso.' };
      avviiInCorso.add(tabId);
      try {
        const r = await aiFrame(tabId, { type: 'haCampo' });
        if (r.some((x) => x.r.inEsecuzione)) return { ok: false, errore: 'Già in corso.' };
        const c = r.filter((x) => x.r.campo).sort((a, b) => (b.r.input - a.r.input) || (a.frameId - b.frameId))[0];
        if (!c) return { ok: false, errore: 'Non trovo il campo del codice.' };
        return (await aUnFrame(tabId, c.frameId, { type: 'avvia', riprova: !!m.riprova })) || { ok: false, errore: 'Il frame non risponde.' };
      } finally { avviiInCorso.delete(tabId); }
    }
    // Selettori che hanno funzionato su questo sito (campo e pulsante): la prossima volta si provano per primi.
    case 'selLeggi':
      return { sel: ((await chrome.storage.local.get('selettori')).selettori || {})[m.dominio] || null };
    case 'selSalva':
      return inFila(async () => {
        const t = (await chrome.storage.local.get('selettori')).selettori || {};
        t[m.dominio] = { input: String(m.input || '').slice(0, 300) || null, bottone: String(m.bottone || '').slice(0, 300) || null, ts: Date.now() };
        const chiavi = Object.keys(t);
        if (chiavi.length > 200) chiavi.sort((a, b) => (t[a].ts || 0) - (t[b].ts || 0)).slice(0, chiavi.length - 200).forEach((k) => delete t[k]);
        await chrome.storage.local.set({ selettori: t });
        return { ok: true };
      });
    case 'diagnosiTab':
      return { frame: (await aiFrame(tabId, { type: 'diagnosi' })).map((x) => Object.assign({ frameId: x.frameId }, x.r)) };
    case 'fermaTab':
      await aiFrame(tabId, { type: 'ferma' });
      return { ok: true };
    // Il pannello si disegna sempre nel frame principale.
    case 'overlay':
      await aUnFrame(tabId, 0, { type: 'disegnaOverlay', st: m.st });
      return { ok: true };
    // Il link "rimuovi codice" può stare in un altro frame: clicca il primo che lo trova.
    case 'rimuoviAltrove': {
      const r = await aiFrame(tabId, { type: 'cliccaRimuovi' }, [sender.frameId]);
      return { cliccato: r.some((x) => x.r.cliccato) };
    }
    // Lettura di totale e messaggi negli altri frame
    case 'leggiAltrove': {
      const r = await aiFrame(tabId, { type: 'leggiLocale' }, [sender.frameId]);
      return { frame: r.map((x) => x.r) };
    }
    // ----- Prezzi -----
    case 'opzioniPagina': {
      const o = await leggiOpzioni();
      return { googleBadge: o.googleBadge === true, gmail: o.gmail !== false, couponAperti: o.couponAperti === true, storicoPrezzi: o.storicoPrezzi !== false, soloIcona: o.soloIcona === true };
    }
    case 'prezzoVisto': {
      const p = m.prodotto || {};
      const chiave = self.CS_lib.chiaveProdotto(p.chiave || '');
      const prezzo = Number(p.prezzo);
      if (!chiave || !(prezzo > 0) || prezzo > 10000000 || !sender || !sender.tab) return { errore: 'dati non validi' };
      if (self.CS_lib.chiaveProdotto(sender.tab.url || '') === null || dominioDi(new URL(sender.tab.url).hostname) !== dominioDi(new URL(chiave).hostname)) return { errore: 'sito diverso' };
      if ((await leggiOpzioni()).storicoPrezzi === false) return { saltato: true };
      const url = urlPulito(p.url) || chiave;
      const r = await registraPrezzo(chiave, { nome: p.nome, dominio: dominioDi(new URL(chiave).hostname), valuta: p.valuta, url }, prezzo, 'visita');
      controllaOsservati();
      return r;
    }
    case 'prodottoTab': {
      const r = await aUnFrame(m.tabId, 0, { type: 'dammiProdotto' });
      const prodotto = r && r.prodotto ? r.prodotto : null;
      const prezzi = (await chrome.storage.local.get('prezzi')).prezzi || {};
      return { prodotto, rec: prodotto ? prezzi[prodotto.chiave] || null : null };
    }
    case 'spedizioneTab': {
      const r = await aUnFrame(m.tabId, 0, { type: 'dammiSpedizione' });
      return { spedizione: (r && r.spedizione) || null };
    }
    case 'prezziAvvisa':
      return inFila(async () => {
        const prezzi = (await chrome.storage.local.get('prezzi')).prezzi || {};
        const rec = prezzi[m.chiave];
        if (!rec) return { errore: 'Prodotto non ancora salvato: ricarica la pagina.' };
        if (m.avvisa && Object.values(prezzi).filter((x) => x.avvisa).length >= MAX_SEGUITI && !rec.avvisa) return { errore: 'Puoi seguire al massimo ' + MAX_SEGUITI + ' prodotti.' };
        rec.avvisa = !!m.avvisa;
        rec.prezzoRif = rec.avvisa ? (rec.punti.length ? rec.punti[rec.punti.length - 1][1] : null) : null;
        if (rec.avvisa) rec.ultimoControllo = Date.now();
        await chrome.storage.local.set({ prezzi });
        return { ok: true, avvisa: rec.avvisa };
      });
    case 'prezziSeguiti': {
      const prezzi = (await chrome.storage.local.get('prezzi')).prezzi || {};
      return { seguiti: Object.entries(prezzi).filter(([, r]) => r.avvisa).map(([chiave, r]) => ({ chiave, nome: r.nome, dominio: r.dominio, valuta: r.valuta, ultimo: r.punti.length ? r.punti[r.punti.length - 1][1] : null })) };
    }
    case 'prezziControlla':
      return controllaOsservati(true);
    case 'notificheInviate':
      return { lista: notificheInviate.slice() };
    // ----- Google, Gmail, siti di coupon -----
    case 'codiciPerDomini': {
      const arch = await leggiArchivio();
      const conta = {};
      for (const d of (Array.isArray(m.domini) ? m.domini : []).slice(0, 40)) {
        const n = Object.values(arch[d] || {}).filter((e) => e.esito !== 'ko' && !(e.scade && e.scade < inizioOggi())).length;
        if (n) conta[d] = n;
      }
      return { conta };
    }
    case 'emailLetta': {
      if (sitoDelMittente(sender) !== 'mail.google.com' || (await leggiOpzioni()).gmail === false) return { saltato: true };
      const d = String(m.negozio || '').toLowerCase();
      if (!RE_DOM.test(d) || d.length > 253 || !Array.isArray(m.codici)) return { errore: 'dati non validi' };
      const scad = {}, info = {};
      const codici = m.codici.slice(0, 20).map((x) => { const c = normalizza(x && x.code); if (c) { if (Number(x.scade)) scad[c] = Number(x.scade); if (x.info) info[c] = x.info; } return c; }).filter(Boolean);
      return salvaTrovati(d, codici, FONTE_EMAIL, scad, info);
    }
    case 'ricetteCoupon':
      return ricetteCoupon();
    case 'couponSito': {
      if ((await leggiOpzioni()).couponAperti !== true || !sender || !sender.tab) return { saltato: true };
      const pagina = dominioDi(sitoDelMittente(sender));
      const arch = await leggiArchivio();
      const prezzi = (await chrome.storage.local.get('prezzi')).prezzi || {};
      const noti = Object.keys(arch).concat(Object.values(prezzi).map((r) => r.dominio)).filter((x, i, a) => x && a.indexOf(x) === i);
      const cand = (Array.isArray(m.candidati) ? m.candidati : []).slice(0, 8).filter((c) => c && RE_DOM.test(String(c.dominio)) && Number(c.peso) > 0).map((c) => ({ dominio: String(c.dominio), peso: Number(c.peso) }));
      const slug = typeof m.slug === 'string' && /^[a-z0-9-]{2,60}$/.test(m.slug) ? m.slug : null;
      const negozio = self.CS_lib.scegliNegozio(cand, slug, noti);
      if (!negozio || negozio === pagina) return { negozio: null };
      const scad = {};
      const codici = (Array.isArray(m.codici) ? m.codici : []).slice(0, 25).filter((c) => typeof c === 'string');
      for (const c of codici) if (m.scadenze && Number(m.scadenze[c])) scad[normalizza(c)] = Number(m.scadenze[c]);
      const r = await salvaTrovati(negozio, codici, FONTE_COUPON, scad);
      return { negozio, nuovi: r.nuovi };
    }
    // ----- Chiave personale dei codici email (resta solo in locale, non si esporta) -----
    case 'chiaveImposta':
      return inFila(async () => {
        const k = String(m.chiave || '').trim();
        if (k.length > 200 || /\s/.test(k)) return { errore: 'Chiave non valida.' };
        if (!k) await chrome.storage.local.remove(['chiavePersonale', 'statoPersonali']);
        else await chrome.storage.local.set({ chiavePersonale: k });
        return { ok: true, presente: !!k };
      });
    case 'chiaveStato': {
      const st = (await chrome.storage.local.get('statoPersonali')).statoPersonali || null;
      return { presente: !!(await leggiChiave()), stato: st };
    }
    case 'personaliAggiorna':
      return scaricaPersonali(m.dominio || null, true);
    // ----- Cashback -----
    case 'cashbackAvviso': {
      const o = await leggiOpzioni();
      const n = (await chrome.storage.local.get('nascosti')).nascosti || {};
      if (n['cb:' + m.dominio] && Date.now() - n['cb:' + m.dominio] < 24 * 3600 * 1000) return { servizio: null };
      return { servizio: self.CS_lib.cashbackVale(o.cashback, m.dominio) };
    }
    case 'cashbackChiuso':
      return inFila(async () => {
        const n = (await chrome.storage.local.get('nascosti')).nascosti || {};
        n['cb:' + m.dominio] = Date.now();
        await chrome.storage.local.set({ nascosti: n });
        return { ok: true };
      });
    case 'cbLista':
      return { voci: await leggiRegistro() };
    case 'cbAggiungi':
      return inFila(async () => {
        const negozio = String(m.negozio || '').trim().slice(0, 60);
        const importo = Math.round(Number(String(m.importo).replace(',', '.')) * 100) / 100;
        const data = m.data || oggiIso();
        const stato = STATI_CB.includes(m.stato) ? m.stato : 'in attesa';
        if (!negozio) return { errore: 'Scrivi il negozio.' };
        if (!isFinite(importo) || importo < 0 || importo > 100000) return { errore: 'Importo non valido.' };
        if (!dataValida(data)) return { errore: 'Data non valida.' };
        const v = await leggiRegistro();
        if (v.length >= 500) return { errore: 'Registro pieno (500 voci).' };
        v.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), negozio, importo, data, stato });
        await scriviRegistro(v);
        return { ok: true };
      });
    case 'cbStato':
      return inFila(async () => {
        const v = await leggiRegistro();
        const x = v.find((y) => y.id === m.id);
        if (!x || !STATI_CB.includes(m.stato)) return { errore: 'Voce non trovata.' };
        x.stato = m.stato;
        await scriviRegistro(v);
        return { ok: true };
      });
    case 'cbRimuovi':
      return inFila(async () => { await scriviRegistro((await leggiRegistro()).filter((y) => y.id !== m.id)); return { ok: true }; });
    default:
      return { errore: 'messaggio sconosciuto' };
  }
}

chrome.runtime.onMessage.addListener((m, sender, risposta) => {
  gestisci(m, sender).then(risposta, (e) => risposta({ errore: String(e) }));
  return true;
});

chrome.tabs.onRemoved.addListener((id) => chrome.storage.session.remove(['test_' + id, chiaveFrames(id)]));
