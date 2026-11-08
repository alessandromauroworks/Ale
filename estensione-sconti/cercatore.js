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

  // Contesto "da coupon": nella classe/id dell'elemento o dei suoi genitori vicini c'è coupon, voucher, sconto o discount.
  // Solo "code" o "promo" nella classe NON bastano: "ITALIA" in un menu di nazioni o "NUOVO" in un'etichetta non sono codici.
  const RE_CTX_COUPON = /coupon|voucher|sconto|discount/i;
  function contestoCoupon(el) {
    let x = el;
    for (let i = 0; i < 3 && x && x.nodeType === 1; i++, x = x.parentElement) {
      if (RE_CTX_COUPON.test(String(x.className && x.className.baseVal != null ? x.className.baseVal : x.className || '') + ' ' + (x.id || ''))) return true;
    }
    return false;
  }

  // Restituisce { forti, deboli, scad }: forti = scritti nel testo con una parola chiave; deboli = tondi nel solo nome di una classe (rango più basso).
  function estrai() {
    const forti = new Set(), deboli = new Set();
    if (!document.body) return { forti: [], deboli: [], scad: {} };
    dalTesto(testoPagina(), forti);
    const scad = Object.assign({}, forti.scad);

    // Elementi con "coupon/promo/code" nella classe o nell'id: il testo intero può essere il codice (serve una cifra, oppure un contesto coupon/voucher/sconto)
    const els = document.querySelectorAll(
      '[class*="coupon" i],[class*="promo" i],[class*="voucher" i],[class*="code" i],[id*="coupon" i],[id*="promo" i],[id*="code" i]');
    let i = 0;
    for (const el of els) {
      if (++i > 600) break;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') continue;
      const t = (el.textContent || '').trim();
      if (t.length >= 4 && t.length <= 24 && valido(t) && (haCifra(t) || contestoCoupon(el))) deboli.add(t);
    }
    // Attributi tipici dei pulsanti "copia codice": data-coupon e data-voucher bastano, gli altri vogliono una cifra
    document.querySelectorAll('[data-code],[data-coupon],[data-coupon-code],[data-promo],[data-promo-code],[data-voucher],[data-clipboard-text]')
      .forEach((el) => {
        for (const a of ['data-code', 'data-coupon', 'data-coupon-code', 'data-promo', 'data-promo-code', 'data-voucher', 'data-clipboard-text']) {
          const v = (el.getAttribute(a) || '').trim();
          if (v && valido(v) && (haCifra(v) || /coupon|voucher/.test(a))) forti.add(v);
        }
      });
    document.querySelectorAll('input[readonly][value]').forEach((el) => {
      const v = (el.value || '').trim();
      if (valido(v) && /coupon|promo|code|codice|voucher/i.test(el.className + el.id + el.name) && (haCifra(v) || RE_CTX_COUPON.test(el.className + el.id + el.name))) forti.add(v);
    });
    // Testi negli attributi (titoli, descrizioni)
    const attr = [];
    document.querySelectorAll('[title],[alt],[aria-label],meta[name="description"],meta[property="og:description"]').forEach((el, k) => {
      if (k > 500) return;
      attr.push(el.getAttribute('title') || '', el.getAttribute('alt') || '', el.getAttribute('aria-label') || '', el.getAttribute('content') || '');
    });
    dalTesto(attr.join(' \n'), forti);
    Object.assign(scad, forti.scad);
    for (const c of forti) deboli.delete(c);
    return { forti: [...forti], deboli: [...deboli], scad };
  }

  const visti = new Set();
  function scansiona() {
    if (CS.inEsecuzione) return;
    let r;
    try { r = estrai(); } catch (e) { return; }
    const nuoviF = r.forti.filter((c) => !visti.has(c)), nuoviD = r.deboli.filter((c) => !visti.has(c));
    if (!nuoviF.length && !nuoviD.length) return;
    nuoviF.concat(nuoviD).forEach((c) => visti.add(c));
    try { chrome.runtime.sendMessage({ type: 'trovati', dominio, codici: nuoviF, deboli: nuoviD, scadenze: r.scad }).catch(() => {}); } catch (e) {}
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
