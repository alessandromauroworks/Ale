// ARCHIVIO: salva i codici per sito e decide l'ordine di prova.
importScripts('domain.js');

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

function ordinaPerStato(lista) {
  const rango = (e) => (e.esito === 'ok' ? 0 : e.source === 'manuale' ? 1 : e.source === 'pagina' ? 2 : 3);
  return lista
    .map((e, i) => [e, i])
    .sort((a, b) => {
      const ra = rango(a[0]), rb = rango(b[0]);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return (b[0].sconto || 0) - (a[0].sconto || 0) || a[1] - b[1];
      return a[1] - b[1];
    })
    .map((x) => x[0]);
}

function costruisciCoda(archivio, dominio, opz) {
  const adesso = Date.now();
  const mappa = archivio[dominio] || {};
  let lista = Object.values(mappa).filter((e) => opz.usaComuni || e.source !== 'comune');
  if (opz.usaComuni) {
    for (const c of COMUNI) if (!mappa[c]) lista.push({ code: c, source: 'comune', esito: 'mai' });
  }
  // Salta i codici che hanno fallito da meno di 7 giorni.
  lista = lista.filter((e) => !(e.esito === 'ko' && adesso - (e.data || 0) < SETTE_GIORNI));
  return ordinaPerStato(lista).slice(0, Math.max(1, opz.maxCodici)).map((e) => e.code);
}

async function gestisci(m, sender) {
  const tabId = m.tabId != null ? m.tabId : sender && sender.tab ? sender.tab.id : null;
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
        e.data = Date.now();
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
      return { coda: costruisciCoda(arch, m.dominio, opz), opzioni: opz };
    }
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
    default:
      return { errore: 'messaggio sconosciuto' };
  }
}

chrome.runtime.onMessage.addListener((m, sender, risposta) => {
  gestisci(m, sender).then(risposta, (e) => risposta({ errore: String(e) }));
  return true;
});

chrome.tabs.onRemoved.addListener((id) => chrome.storage.session.remove('test_' + id));
