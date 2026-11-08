// GMAIL (web): quando APRI un messaggio, cerca i codici sconto scritti nel testo e li salva per il negozio che ha scritto.
// Agisce solo su un messaggio aperto (mai sull'elenco), solo sul tuo computer: il testo dell'email non esce dalla pagina; al fondo arrivano solo negozio, codici e scadenza.
(function () {
  if (window.CS_GMAIL) return;
  window.CS_GMAIL = true;
  if (window.top !== window) return;
  const L = self.CS_lib;
  if (!L) return;
  const msg = (m) => { try { return chrome.runtime.sendMessage(m).catch(() => null); } catch (e) { return Promise.resolve(null); } };
  const fatti = new Set();
  let attivo = null, volte = 0, timer = null, inCorso = false;

  // Un messaggio è aperto quando l'indirizzo finisce con l'identificativo del messaggio (#inbox/FMfcg...), non con il nome di una cartella.
  // Gli identificativi veri sono 16 cifre esadecimali (vecchi) oppure 24-40 tra lettere e cifre (nuovi, senza trattini): il nome di un'etichetta (#label/Offerte-di-natale) non vale.
  // Per #label/... e #search/... l'identificativo sta dopo il nome (almeno tre pezzi); per le cartelle normali (#inbox/...) subito dopo.
  const RE_ID = /^(?:[0-9a-f]{16}|[A-Za-z][A-Za-z0-9]{23,39})$/;
  const idMessaggio = () => {
    const pezzi = location.hash.replace(/^#/, '').split('?')[0].split('/');
    const nome = (pezzi[0] || '').toLowerCase();
    const id = pezzi[pezzi.length - 1];
    if (pezzi.length < 2 || !RE_ID.test(id)) return null;
    if ((nome === 'label' || nome === 'search' || nome === 'category') && pezzi.length < 3) return null;
    return id;
  };
  const visibile = (el) => { try { return el.checkVisibility ? el.checkVisibility() : !!(el.offsetWidth || el.offsetHeight); } catch (e) { return false; } };

  async function giro() {
    if (inCorso) return;
    inCorso = true;
    try {
      const id = idMessaggio();
      if (!id) return;
      if (attivo === null) { const o = await msg({ type: 'opzioniPagina' }); attivo = !!(o && o.gmail !== false); }
      if (!attivo) return;
      const oggetto = (document.querySelector('h2.hP') || {}).textContent || '';
      for (const m of document.querySelectorAll('div.adn')) {
        const corpo = m.querySelector('div.a3s');
        if (!corpo || !visibile(corpo)) continue;
        const testo = (corpo.innerText || '').trim();
        if (testo.length < 20) continue;
        const mitt = m.querySelector('span.gD[email], span[email].gD, h3.iw span[email], span[email]');
        const indirizzo = (mitt && mitt.getAttribute('email')) || '';
        const chiave = id + '|' + indirizzo + '|' + testo.length + '|' + testo.slice(0, 60);
        if (fatti.has(chiave)) continue;
        if (fatti.size > 500) fatti.clear();
        fatti.add(chiave);
        const link = Array.from(corpo.querySelectorAll('a[href]')).slice(0, 200).map((a) => a.href);
        const r = L.emailEstrai({ mittente: indirizzo, oggetto, testo, link });
        if (r.dominio && r.codici.length) msg({ type: 'emailLetta', negozio: r.dominio, codici: r.codici });
      }
    } finally { inCorso = false; }
  }
  window.addEventListener('hashchange', () => setTimeout(giro, 700));
  // Se accendi o spegni l'opzione mentre Gmail è aperto, vale subito (senza ricaricare).
  try {
    chrome.storage.onChanged.addListener((c, area) => {
      if (area === 'local' && c.opzioni) { attivo = !(c.opzioni.newValue && c.opzioni.newValue.gmail === false); if (attivo) giro(); }
    });
  } catch (e) {}
  setTimeout(giro, 800);
  // L'osservatore non si ferma mai (Gmail cambia la pagina di continuo), ma è leggero: al massimo un giro ogni 0,9 secondi, poi ogni 4 secondi dopo 300 giri;
  // e se non c'è un messaggio aperto il giro finisce subito (guarda solo l'indirizzo).
  try {
    new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; volte++; giro(); }, volte < 300 ? 900 : 4000);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
