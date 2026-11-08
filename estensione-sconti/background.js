// ARCHIVIO: salva i codici per sito e decide l'ordine di prova.
// Chrome/Edge/Brave: service worker (importScripts). Firefox: pagina eventi, domain.js è già caricato da manifest (scripts).
if (typeof importScripts === 'function') importScripts('domain.js');
const api = globalThis.browser ?? chrome; // stessa API, con le promesse, anche in Firefox

const SETTE_GIORNI = 7 * 24 * 3600 * 1000;
const OPZIONI_BASE = { usaComuni: true, maxCodici: 20 };

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

async function gestisci(m, sender) {
  const tabId = m.tabId != null ? m.tabId : sender && sender.tab ? sender.tab.id : null;
  // I codici sono sempre del sito che si vede nella barra, anche se il messaggio arriva da un frame di un altro sito.
  if (sender && sender.tab && /^https?:/.test(sender.tab.url || '') && !/^chrome-extension:/.test(sender.url || '') && m.dominio != null) {
    try { m.dominio = dominioDi(new URL(sender.tab.url).hostname); } catch (e) {}
  }
  switch (m.type) {
    case 'trovati':
      return inFila(async () => {
        const arch = await leggiArchivio();
        const sito = (arch[m.dominio] = arch[m.dominio] || {});
        let nuovi = 0;
        for (const grezzo of m.codici || []) {
          const c = normalizza(grezzo);
          if (!c || sito[c]) continue;
          sito[c] = { code: c, source: 'pagina', origine: 'pagina', esito: 'mai', sconto: null, data: null, trovato: Date.now() };
          nuovi++;
        }
        if (nuovi) await scriviArchivio(arch);
        return { nuovi };
      });
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
