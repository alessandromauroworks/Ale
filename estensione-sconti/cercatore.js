// CERCATORE: cerca nella pagina i codici sconto e li manda all'archivio.
(function () {
  if (window.CS_CARICATO) return;
  window.CS_CARICATO = true;
  const CS = (window.CS = window.CS || {});
  CS.inEsecuzione = false;
  // Il cercatore legge solo la pagina principale: i frame (pubblicità, widget) non devono sporcare l'archivio.
  if (window.top !== window) return;
  const dominio = dominioDi(location.hostname);

  const valido = self.CS_valido, dalTesto = self.CS_dalTesto;
  const haCifra = (t) => /[0-9]/.test(t);

  function testoPagina() {
    const parti = [];
    const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n, tot = 0;
    while ((n = w.nextNode()) && tot < 300000) {
      const v = n.nodeValue.trim();
      if (v) { parti.push(v); tot += v.length; }
    }
    return parti.join(' \n');
  }

  function estrai() {
    const trovati = new Set();
    if (!document.body) return [];
    dalTesto(testoPagina(), trovati);

    // Elementi con "coupon/promo/code" nella classe o nell'id: il testo intero può essere il codice
    const els = document.querySelectorAll(
      '[class*="coupon" i],[class*="promo" i],[class*="voucher" i],[class*="code" i],[id*="coupon" i],[id*="promo" i],[id*="code" i]');
    let i = 0;
    for (const el of els) {
      if (++i > 600) break;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') continue;
      const t = (el.textContent || '').trim();
      if (t.length >= 4 && t.length <= 24 && valido(t)) trovati.add(t);
    }
    // Attributi tipici dei pulsanti "copia codice"
    document.querySelectorAll('[data-code],[data-coupon],[data-coupon-code],[data-promo],[data-promo-code],[data-voucher],[data-clipboard-text]')
      .forEach((el) => {
        for (const a of ['data-code', 'data-coupon', 'data-coupon-code', 'data-promo', 'data-promo-code', 'data-voucher', 'data-clipboard-text']) {
          const v = el.getAttribute(a);
          if (v && valido(v.trim())) trovati.add(v.trim());
        }
      });
    document.querySelectorAll('input[readonly][value]').forEach((el) => {
      const v = (el.value || '').trim();
      if (valido(v) && /coupon|promo|code|codice|voucher/i.test(el.className + el.id + el.name)) trovati.add(v);
    });
    // Testi negli attributi (titoli, descrizioni)
    const attr = [];
    document.querySelectorAll('[title],[alt],[aria-label],meta[name="description"],meta[property="og:description"]').forEach((el, k) => {
      if (k > 500) return;
      attr.push(el.getAttribute('title') || '', el.getAttribute('alt') || '', el.getAttribute('aria-label') || '', el.getAttribute('content') || '');
    });
    dalTesto(attr.join(' \n'), trovati);
    return [...trovati];
  }

  const visti = new Set();
  function scansiona() {
    if (CS.inEsecuzione) return;
    let nuovi;
    try { nuovi = estrai().filter((c) => !visti.has(c)); } catch (e) { return; }
    if (!nuovi.length) return;
    nuovi.forEach((c) => visti.add(c));
    try { chrome.runtime.sendMessage({ type: 'trovati', dominio, codici: nuovi }).catch(() => {}); } catch (e) {}
  }
  CS.scansiona = scansiona;
  CS.codiceValido = valido;

  // Prima scansione subito, poi dopo un po' (banner e popup compaiono in ritardo)
  setTimeout(scansiona, 100);
  setTimeout(scansiona, 1500);
  setTimeout(scansiona, 4500);
  let volte = 0, timer = null;
  try {
    new MutationObserver(() => {
      if (volte >= 8 || timer) return;
      timer = setTimeout(() => { timer = null; volte++; scansiona(); }, 2000);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
