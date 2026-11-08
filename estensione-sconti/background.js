// ARCHIVIO: salva i codici per sito e decide l'ordine di prova.
// Chrome/Edge/Brave: service worker (importScripts). Firefox: pagina eventi, domain.js è già caricato da manifest (scripts).
if (typeof importScripts === 'function') importScripts('domain.js');
const api = globalThis.browser ?? chrome; // stessa API, con le promesse, anche in Firefox

const SETTE_GIORNI = 7 * 24 * 3600 * 1000;
const OPZIONI_BASE = { usaComuni: true, maxCodici: 20, esplora: true, condividi: false, fonti: [] };

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
    if (e.source === 'pagina') return 1;
    if (e.source === 'manuale') return 2;
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

function costruisciCoda(archivio, dominio, opz, riprova) {
  const adesso = Date.now();
  const mappa = archivio[dominio] || {};
  let lista = Object.values(mappa).filter((e) => opz.usaComuni || e.source !== 'comune');
  if (opz.usaComuni) {
    for (const c of COMUNI) if (!mappa[c]) lista.push({ code: c, source: 'comune', esito: 'mai' });
  }
  // Salta i codici che hanno fallito da meno di 7 giorni (a meno che l'utente scelga "riprova tutti").
  if (!riprova) lista = lista.filter((e) => !(e.esito === 'ko' && adesso - (e.data || 0) < SETTE_GIORNI));
  return ordinaPerStato(lista).slice(0, Math.max(1, opz.maxCodici)).map((e) => e.code);
}

async function aggiornaBadge(tabId, dominio, campo) {
  if (tabId == null) return;
  const [arch, opz] = [await leggiArchivio(), await leggiOpzioni()];
  const n = campo
    ? costruisciCoda(arch, dominio, opz, false).length
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
const ETICHETTE_FONTE = ['pagina', 'sito del negozio', 'fonte indicata da te', 'condivisi'];
function salvaTrovati(dominio, codici, fonte) {
  return inFila(async () => {
    const arch = await leggiArchivio();
    const sito = (arch[dominio] = arch[dominio] || {});
    let nuovi = 0;
    for (const grezzo of codici || []) {
      const c = normalizza(grezzo);
      if (!c || sito[c]) continue;
      sito[c] = { code: c, source: fonte, origine: fonte, esito: 'mai', sconto: null, data: null, trovato: Date.now() };
      nuovi++;
    }
    if (nuovi) await scriviArchivio(arch);
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

async function giaFattoOggi(chiave) {
  return inFila(async () => {
    const r = (await chrome.storage.local.get('esplorati')).esplorati || {};
    if (r[chiave] && Date.now() - r[chiave] < UN_GIORNO) return true;
    r[chiave] = Date.now();
    await chrome.storage.local.set({ esplorati: r });
    return false;
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
  if (!opz.esplora) { esito.saltato = 'spento'; return esito; }
  if (!/^https?:\/\//.test(origin || '')) { esito.saltato = 'indirizzo non valido'; return esito; }
  const trovati = new Set();
  if (!(await giaFattoOggi('sito:' + dominio))) {
    const robots = await leggiRobots(origin);
    const percorsi = [];
    const aggiungi = (p) => { if (!percorsi.includes(p) && percorsi.length < MAX_PAGINE && consentito(robots, p.split('?')[0])) percorsi.push(p); };
    aggiungi('/');
    let htmlHome = null;
    if (percorsi.includes('/')) {
      htmlHome = await paginaHtml(origin + '/');
      esito.pagine.push(origin + '/');
      if (htmlHome) for (const c of self.CS_dalHtml(htmlHome)) trovati.add(c);
    }
    if (htmlHome) for (const p of linkPromo(htmlHome, origin).slice(0, 4)) aggiungi(p);
    for (const p of PERCORSI_PROMO) aggiungi(p);
    const altre = percorsi.filter((p) => p !== '/');
    for (let i = 0; i < altre.length; i += 3) {
      await Promise.all(altre.slice(i, i + 3).map(async (p) => {
        esito.pagine.push(origin + p);
        const h = await paginaHtml(origin + p);
        if (h) for (const c of self.CS_dalHtml(h)) trovati.add(c);
      }));
    }
    esito.nuovi += (await salvaTrovati(dominio, [...trovati], 'sito del negozio')).nuovi;
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
    const h = await paginaHtml(f.url);
    if (h) esito.nuovi += (await salvaTrovati(dominio, self.CS_dalHtml(h), 'fonte indicata da te')).nuovi;
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
    if (!occupato && !soloControlla) { setTimeout(() => chrome.runtime.reload(), 200); return { nuova: su_disco, attuale, ricarico: true }; }
    return { nuova: su_disco, attuale, ricarico: false };
  } catch (e) { return { errore: String(e) }; }
}
try {
  chrome.alarms.create('cacciasconti-aggiornamento', { periodInMinutes: 360 });
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'cacciasconti-aggiornamento') controllaAggiornamento(); });
  chrome.runtime.onStartup.addListener(() => controllaAggiornamento());
  chrome.runtime.onInstalled.addListener(() => controllaAggiornamento());
} catch (e) {}

async function gestisci(m, sender) {
  const tabId = m.tabId != null ? m.tabId : sender && sender.tab ? sender.tab.id : null;
  // I codici sono sempre del sito che si vede nella barra, anche se il messaggio arriva da un frame di un altro sito.
  if (sender && sender.tab && /^https?:/.test(sender.tab.url || '') && !/^chrome-extension:/.test(sender.url || '') && m.dominio != null) {
    try { m.dominio = dominioDi(new URL(sender.tab.url).hostname); } catch (e) {}
  }
  switch (m.type) {
    case 'trovati':
      return salvaTrovati(m.dominio, m.codici, 'pagina');
    case 'aggiungi':
      return inFila(async () => {
        const c = normalizza(m.codice);
        if (!c) return { errore: 'Codice non valido: usa da 4 a 20 tra lettere, numeri e trattino.' };
        const arch = await leggiArchivio();
        const sito = (arch[m.dominio] = arch[m.dominio] || {});
        if (sito[c]) {
          if (sito[c].esito === 'ko') sito[c].esito = 'mai'; // l'utente vuole riprovarlo
        } else {
          sito[c] = { code: c, source: 'manuale', origine: 'manuale', esito: 'mai', sconto: null, data: null, trovato: Date.now() };
        }
        await scriviArchivio(arch);
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
        e.esito = m.ok ? 'ok' : 'ko';
        e.sconto = m.ok ? m.sconto : null;
        e.simbolo = simboloValuta(m.simbolo);
        e.data = Date.now();
        e.motivo = m.ok ? null : m.motivo || 'nessuna reazione';
        e.source = m.ok ? 'funzionato' : e.origine || 'comune';
        sito[c] = e;
        await scriviArchivio(arch);
        if (e.origine !== 'manuale') inviaRisultato(await leggiOpzioni(), m.dominio, c, m.ok, m.ok ? m.pct : null);
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
      const [arch, opz] = [await leggiArchivio(), await leggiOpzioni()];
      return { coda: costruisciCoda(arch, m.dominio, opz, !!m.riprova), opzioni: opz };
    }
    case 'badge':
      return { n: await aggiornaBadge(tabId, m.dominio, m.campo) };
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
      const r = await chrome.storage.local.get(['archivio', 'storico', 'opzioni']);
      return { dati: { app: 'Cacciasconti', versione: 1, archivio: r.archivio || {}, storico: r.storico || [], opzioni: r.opzioni || {} } };
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
                sconto: e.sconto || null, simbolo: e.simbolo ? simboloValuta(e.simbolo) : '€', data: e.data || null, trovato: e.trovato || Date.now(), motivo: e.motivo || null };
            }
          }
        }
        await scriviArchivio(arch);
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
      const r = await aiFrame(tabId, { type: 'haCampo' });
      const c = r.filter((x) => x.r.campo).sort((a, b) => (b.r.input - a.r.input) || (a.frameId - b.frameId))[0];
      if (!c) return { ok: false, errore: 'Non trovo il campo del codice.' };
      return (await aUnFrame(tabId, c.frameId, { type: 'avvia', riprova: !!m.riprova })) || { ok: false, errore: 'Il frame non risponde.' };
    }
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
    default:
      return { errore: 'messaggio sconosciuto' };
  }
}

chrome.runtime.onMessage.addListener((m, sender, risposta) => {
  gestisci(m, sender).then(risposta, (e) => risposta({ errore: String(e) }));
  return true;
});

chrome.tabs.onRemoved.addListener((id) => chrome.storage.session.remove(['test_' + id, chiaveFrames(id)]));
