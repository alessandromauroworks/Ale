// GOOGLE: nella pagina dei risultati di ricerca (solo se accendi l'opzione) segna i risultati di siti per cui hai già dei codici sul computer.
// Discreto: una piccola scritta di testo "🏷 N codici", niente logo. I domini dei risultati restano nel browser (si confrontano con l'archivio locale).
(function () {
  if (window.CS_GOOGLE) return;
  window.CS_GOOGLE = true;
  if (window.top !== window) return;
  const msg = (m) => { try { return chrome.runtime.sendMessage(m).catch(() => null); } catch (e) { return Promise.resolve(null); } };
  let attivo = null, volte = 0, timer = null, inCorso = false, tentativi = 0;

  function dominioDelRisultato(a) {
    try {
      let u = new URL(a.href, location.href);
      if (/(^|\.)google\.[a-z.]+$/.test(u.hostname)) {
        if (u.pathname !== '/url') return null;
        const q = u.searchParams.get('q') || u.searchParams.get('url');
        if (!q) return null;
        u = new URL(q);
      }
      return /^https?:$/.test(u.protocol) ? dominioDi(u.hostname.toLowerCase()) : null;
    } catch (e) { return null; }
  }
  async function giro() {
    if (inCorso) return;
    inCorso = true;
    try {
      if (attivo === null) { const o = await msg({ type: 'opzioniPagina' }); attivo = !!(o && o.googleBadge); }
      if (!attivo) return;
      const per = new Map();
      let n = 0;
      for (const a of document.querySelectorAll('a[href]')) {
        if (a.dataset.csGoogle || !a.querySelector('h3')) continue;
        if (++n > 40) break;
        const d = dominioDelRisultato(a);
        if (!d) { a.dataset.csGoogle = '1'; continue; } // non è un risultato di un sito: inutile riguardarlo

        if (!d) continue;
        if (!per.has(d)) per.set(d, []);
        per.get(d).push(a);
      }
      if (!per.size) return;
      const r = await msg({ type: 'codiciPerDomini', domini: [...per.keys()] });
      if (!r || !r.conta) {
        // Il fondo non ha risposto (si stava riavviando?): i risultati NON si segnano come visti, si riprova fra poco.
        if (tentativi++ < 4) setTimeout(giro, 1500 * tentativi);
        return;
      }
      tentativi = 0;
      const conta = r.conta;
      for (const [d, els] of per) {
        const k = conta[d];
        for (const a of els) a.dataset.csGoogle = '1';
        if (!k) continue;
        for (const a of els) {
          const s = document.createElement('span');
          s.className = 'cacciasconti-etichetta';
          s.textContent = '🏷 ' + k + (k === 1 ? ' codice' : ' codici');
          s.title = 'Cacciasconti: codici salvati sul tuo computer per ' + d;
          s.style.cssText = 'display:inline-block;margin:2px 0 0 0;padding:1px 7px;border-radius:9px;background:#e6f6f0;color:#0b7a5d;font:11px/1.5 system-ui,sans-serif;white-space:nowrap';
          a.parentNode.insertBefore(s, a.nextSibling);
        }
      }
    } finally { inCorso = false; }
  }
  // Se accendi o spegni l'opzione mentre la pagina è aperta, vale subito (senza ricaricare).
  try {
    chrome.storage.onChanged.addListener((c, area) => {
      if (area === 'local' && c.opzioni) { attivo = !!(c.opzioni.newValue && c.opzioni.newValue.googleBadge); if (attivo) giro(); }
    });
  } catch (e) {}
  setTimeout(giro, 400);
  setTimeout(giro, 2000);
  try {
    new MutationObserver(() => {
      if (volte >= 12 || timer) return;
      timer = setTimeout(() => { timer = null; volte++; giro(); }, 1000);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
