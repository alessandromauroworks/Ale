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
  const idMessaggio = () => { const m = /^#[^?]*\/([A-Za-z0-9_-]{14,})$/.exec(location.hash); return m ? m[1] : null; };
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
        fatti.add(chiave);
        const link = Array.from(corpo.querySelectorAll('a[href]')).slice(0, 200).map((a) => a.href);
        const r = L.emailEstrai({ mittente: indirizzo, oggetto, testo, link });
        if (r.dominio && r.codici.length) msg({ type: 'emailLetta', negozio: r.dominio, codici: r.codici });
      }
    } finally { inCorso = false; }
  }
  window.addEventListener('hashchange', () => setTimeout(giro, 700));
  setTimeout(giro, 800);
  try {
    new MutationObserver(() => {
      if (volte >= 300 || timer) return;
      timer = setTimeout(() => { timer = null; volte++; giro(); }, 900);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
