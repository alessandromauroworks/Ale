// FUNZIONI COMUNI (senza accesso alla pagina): prezzi, spedizione gratuita, email, siti di coupon, ricerche.
// Si usano nelle pagine, nel fondo e nel popup, e si provano anche con Node.
(function () {
  if (self.CS_lib) return;
  const L = (self.CS_lib = {});

  // ---------- Numeri e valute ----------
  // "1.299,00" -> 1299 ; "1,299.00" -> 1299 ; "19.90" -> 19.9 ; "1.299" -> 1299 ; "49,5" -> 49.5
  L.numero = function (s) {
    let t = String(s == null ? '' : s).replace(/[^\d.,]/g, '');
    if (!t || !/\d/.test(t)) return null;
    const vir = t.lastIndexOf(','), pun = t.lastIndexOf('.');
    if (vir >= 0 && pun >= 0) {
      if (vir > pun) t = t.replace(/\./g, '').replace(',', '.');
      else t = t.replace(/,/g, '');
    } else if (vir >= 0) {
      t = /,\d{1,2}$/.test(t) && t.indexOf(',') === vir ? t.replace(',', '.') : t.replace(/,/g, '');
    } else if (pun >= 0) {
      t = /\.\d{1,2}$/.test(t) && t.indexOf('.') === pun ? t : t.replace(/\./g, '');
    }
    const n = parseFloat(t);
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  };
  const simbolo = (v) => (self.simboloValuta ? self.simboloValuta(v) : v || '€');
  const valutaDa = (s) => {
    const m = /(€|EUR|\$|USD|£|GBP|CHF)/i.exec(String(s || ''));
    return m ? simbolo(m[1]) : null;
  };

  // ---------- Prodotto e prezzo da HTML ----------
  const dec = (t) => String(t || '').replace(/&amp;/g, '&').replace(/&quot;|&#34;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&euro;/g, '€').replace(/&#8364;/g, '€').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const pulisci = (t) => dec(String(t || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  function attributi(tag) {
    const a = {};
    tag.replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g, (m, k, v1, v2, v3) => { a[k.toLowerCase()] = dec(v1 != null ? v1 : v2 != null ? v2 : v3); return m; });
    return a;
  }
  function metaTutti(html) {
    const out = {};
    const re = /<meta\b[^>]*>/gi;
    let m, n = 0;
    while ((m = re.exec(html)) && n++ < 400) {
      const a = attributi(m[0]);
      const k = (a.property || a.name || a.itemprop || '').toLowerCase();
      if (k && a.content != null && out[k] == null) out[k] = a.content;
    }
    return out;
  }
  const tipoHa = (t, nome) => [].concat(t || []).some((x) => String(x).split('/').pop() === nome);
  function nodiJson(x, out, prof) {
    if (!x || typeof x !== 'object' || prof > 4) return;
    if (Array.isArray(x)) { x.forEach((y) => nodiJson(y, out, prof + 1)); return; }
    out.push(x);
    if (x['@graph']) nodiJson(x['@graph'], out, prof + 1);
    if (x.mainEntity) nodiJson(x.mainEntity, out, prof + 1);
  }
  function offertaPrezzo(o, prof) {
    if (!o || typeof o !== 'object' || (prof || 0) > 3) return null;
    if (Array.isArray(o)) { for (const x of o) { const r = offertaPrezzo(x, (prof || 0) + 1); if (r) return r; } return null; }
    const spec = o.priceSpecification && (Array.isArray(o.priceSpecification) ? o.priceSpecification[0] : o.priceSpecification);
    for (const v of [o.price, o.lowPrice, spec && spec.price]) {
      if (v == null || v === '') continue;
      const n = typeof v === 'number' ? v : L.numero(v);
      if (n != null && n > 0) return { prezzo: n, valuta: simbolo(o.priceCurrency || (spec && spec.priceCurrency) || 'EUR') };
    }
    return o.offers ? offertaPrezzo(o.offers, (prof || 0) + 1) : null;
  }

  // Restituisce { nome, prezzo, valuta, via } oppure null. Se la pagina elenca più prodotti diversi (una lista) non è una pagina prodotto.
  L.prezzoDaHtml = function (html) {
    html = String(html || '').slice(0, 2500000);
    const meta = metaTutti(html);
    const ogProdotto = /product/i.test(meta['og:type'] || '');
    let nomeTitolo = pulisci((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '');
    const nomeMeta = pulisci(meta['og:title'] || meta['twitter:title'] || '');
    // 1) JSON-LD
    const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
    let m, prodotti = [], k = 0;
    while ((m = re.exec(html)) && k++ < 20) {
      let j;
      try { j = JSON.parse(m[1].trim()); } catch (e) { continue; }
      const nodi = [];
      nodiJson(j, nodi, 0);
      for (const n of nodi) if (tipoHa(n['@type'], 'Product') || tipoHa(n['@type'], 'ProductGroup')) prodotti.push(n);
    }
    const conPrezzo = prodotti.map((p) => ({ p, o: offertaPrezzo(p.offers) || (p.hasVariant ? offertaPrezzo(p.hasVariant) : null) })).filter((x) => x.o);
    const nomiDiversi = new Set(conPrezzo.map((x) => pulisci(x.p.name))).size;
    if (conPrezzo.length && (nomiDiversi <= 1 || ogProdotto)) {
      const x = conPrezzo[0];
      return { nome: pulisci(x.p.name) || nomeMeta || nomeTitolo, prezzo: x.o.prezzo, valuta: x.o.valuta, via: 'json-ld' };
    }
    if (nomiDiversi > 1) return null;
    // 2) OpenGraph / product:price
    const pm = meta['product:price:amount'] || meta['og:price:amount'];
    if (pm != null && L.numero(pm) > 0) {
      return { nome: nomeMeta || nomeTitolo, prezzo: L.numero(pm), valuta: simbolo(meta['product:price:currency'] || meta['og:price:currency'] || 'EUR'), via: 'opengraph' };
    }
    // 3) Microdata (itemprop="price" dentro un Product)
    if (/itemtype\s*=\s*["'][^"']*schema\.org\/Product/i.test(html)) {
      const mp = /<([a-z0-9]+)\b[^>]*\bitemprop\s*=\s*["']price["'][^>]*>/i.exec(html);
      if (mp) {
        const a = attributi(mp[0]);
        let raw = a.content;
        if (raw == null) raw = pulisci(html.slice(mp.index + mp[0].length, mp.index + mp[0].length + 120).split('<')[0]);
        const n = L.numero(raw);
        if (n > 0) {
          const mc = /<[a-z0-9]+\b[^>]*\bitemprop\s*=\s*["']priceCurrency["'][^>]*>/i.exec(html);
          const mn = /<[a-z0-9]+\b[^>]*\bitemprop\s*=\s*["']name["'][^>]*>/i.exec(html);
          const nome = mn ? (attributi(mn[0]).content || pulisci(html.slice(mn.index + mn[0].length, mn.index + mn[0].length + 300).split('<')[0])) : '';
          return { nome: pulisci(nome) || nomeMeta || nomeTitolo, prezzo: n, valuta: simbolo((mc && attributi(mc[0]).content) || 'EUR'), via: 'microdata' };
        }
      }
    }
    // 4) Shopify (twitter:data1 = prezzo)
    if (/^(price|prezzo|precio|preis|prix)$/i.test(meta['twitter:label1'] || '') && meta['twitter:data1']) {
      const n = L.numero(meta['twitter:data1']);
      if (n > 0) return { nome: nomeMeta || nomeTitolo, prezzo: n, valuta: valutaDa(meta['twitter:data1']) || '€', via: 'shopify' };
    }
    // 5) WooCommerce (pagina prodotto, prezzo nell'HTML)
    if (/<body[^>]*class\s*=\s*["'][^"']*\bsingle-product\b/i.test(html)) {
      const mw = /class\s*=\s*["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]{0,600}?)<\/(?:p|span|div)>/i.exec(html);
      const mb = mw && /woocommerce-Price-amount[^>]*>([\s\S]*?)<\/span>\s*(?:<\/ins>|<\/p>|$)?/i.exec(mw[1]);
      const raw = mb ? pulisci(mb[1]) : mw ? pulisci(mw[1]) : '';
      const n = L.numero(raw);
      if (n > 0) return { nome: nomeMeta || nomeTitolo, prezzo: n, valuta: valutaDa(raw) || '€', via: 'woocommerce' };
    }
    return null;
  };

  // Dalla pagina VERA (DOM) prende solo i pezzi che servono per leggere il prezzo e li mette in un piccolo HTML: titolo, <meta>, JSON-LD, elementi con itemprop,
  // il tag <body> e i primi blocchi "price" (WooCommerce). Non si copia più l'intera pagina (outerHTML), che su pagine grandi costa decine di millisecondi per volta.
  L.htmlPerPrezzo = function (doc) {
    doc = doc || document;
    const parti = [];
    const t = doc.title;
    if (t) parti.push('<title>' + String(t).replace(/</g, '&lt;') + '</title>');
    let n = 0;
    for (const el of doc.querySelectorAll('meta')) { if (n++ >= 400) break; parti.push(el.outerHTML); }
    n = 0;
    for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) { if (n++ >= 20) break; parti.push(el.outerHTML.slice(0, 300000)); }
    const radice = doc.querySelector('[itemtype*="schema.org/Product" i]');
    if (radice) parti.push(radice.cloneNode(false).outerHTML.replace(/<\/[a-z0-9]+>$/i, ''));
    n = 0;
    for (const el of doc.querySelectorAll('[itemprop=price],[itemprop=priceCurrency],[itemprop=name]')) { if (n++ >= 12) break; parti.push(el.outerHTML.slice(0, 600)); }
    if (doc.body && doc.body.classList && doc.body.classList.contains('single-product')) {
      parti.push('<body class="' + String(doc.body.className).replace(/"/g, '') + '">');
      n = 0;
      for (const el of doc.querySelectorAll('.price')) { if (n++ >= 3) break; parti.push(el.outerHTML.slice(0, 2000)); }
    }
    return parti.join('\n');
  };
  // Firma leggera di ciò che conta per il prezzo: se non cambia, non serve rileggere la pagina.
  L.firmaPrezzo = function (doc) {
    doc = doc || document;
    let f = String(doc.title || '').length + '|';
    // Oltre alla lunghezza c'è un breve hash (FNV-1a) del testo: 29,90 -> 39,90 ha la stessa lunghezza ma cambia la firma.
    let h = 0x811c9dc5;
    const mescola = (t) => { t = String(t); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } h ^= 0x7c; h = Math.imul(h, 0x01000193) >>> 0; };
    for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) { f += el.textContent.length + ','; mescola(el.textContent); }
    for (const el of doc.querySelectorAll('meta[property^="product:"],meta[property^="og:price"],meta[name="twitter:data1"]')) { const c = el.getAttribute('content') || ''; f += c + ','; mescola(c); }
    for (const el of doc.querySelectorAll('[itemprop=price]')) { const c = (el.getAttribute('content') || el.textContent || '').slice(0, 40); f += c + ','; mescola(c); }
    f += 'h' + h.toString(36) + ',';
    if (doc.body && doc.body.classList.contains('single-product')) { const p = doc.querySelector('.price'); f += p ? p.textContent.replace(/\s+/g, ' ').slice(0, 80) : ''; }
    return f;
  };

  L.chiaveProdotto = function (url) {
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) return null;
      return u.protocol + '//' + u.host.toLowerCase().replace(/^www\./, '') + u.pathname.replace(/\/+$/, '');
    } catch (e) { return null; }
  };
  L.nomeBreve = function (nome) {
    let n = String(nome || '').replace(/\s+/g, ' ').trim();
    n = n.replace(/\s[|–—-]\s[^|–—-]{2,40}$/, '').trim(); // via " | Nome del negozio"
    return n.slice(0, 90);
  };

  // ---------- Storico prezzi: un punto al giorno ----------
  L.giornoNumero = function (ts) { const d = new Date(ts); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  L.aggiungiPunto = function (punti, prezzo, ts) {
    punti = Array.isArray(punti) ? punti.slice() : [];
    const g = L.giornoNumero(ts || Date.now());
    const ult = punti[punti.length - 1];
    if (ult && ult[0] === g) ult[1] = prezzo; else punti.push([g, prezzo]);
    return punti.slice(-200);
  };
  L.statistiche = function (punti) {
    punti = punti || [];
    if (!punti.length) return null;
    const v = punti.map((p) => p[1]);
    return { min: Math.min.apply(null, v), max: Math.max.apply(null, v), ultimo: v[v.length - 1], precedente: v.length > 1 ? v[v.length - 2] : null, n: v.length };
  };
  L.giornoLeggibile = function (g) { const s = String(g); return s.slice(6, 8) + '/' + s.slice(4, 6) + '/' + s.slice(0, 4); };
  // Grafico piccolo in SVG (nessuna risorsa esterna). Dentro ci sono solo numeri.
  L.grafico = function (punti, w, h) {
    w = w || 300; h = h || 90;
    punti = (punti || []).filter((p) => isFinite(p[1]));
    if (!punti.length) return '';
    const v = punti.map((p) => p[1]);
    let mn = Math.min.apply(null, v), mx = Math.max.apply(null, v);
    if (mx === mn) { mx += 1; mn -= 1; }
    const px = 8, py = 10;
    const x = (i) => (punti.length === 1 ? w / 2 : px + (i * (w - 2 * px)) / (punti.length - 1));
    const y = (val) => py + ((mx - val) * (h - 2 * py)) / (mx - mn);
    const pts = punti.map((p, i) => x(i).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ');
    const ult = punti[punti.length - 1];
    return '<svg class="grafico" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Andamento del prezzo">' +
      (punti.length > 1 ? '<polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" points="' + pts + '"/>' : '') +
      punti.map((p, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p[1]).toFixed(1) + '" r="' + (i === punti.length - 1 ? 4 : 2) + '" fill="currentColor"><title>' + L.giornoLeggibile(p[0]) + ': ' + p[1] + '</title></circle>').join('') +
      '<text x="' + (w - 4) + '" y="' + (h - 2) + '" text-anchor="end" font-size="9" fill="currentColor" opacity=".6">' + L.giornoLeggibile(ult[0]) + '</text></svg>';
  };

  // ---------- Spedizione gratuita ----------
  const NUM = '(\\d{1,4}(?:[.,]\\d{1,3})*)';
  const VAL = '(?:€|eur(?:o)?|\\$|usd|£|gbp|chf)';
  const SIMB = '(€|eur(?:o)?|\\$|usd|£|gbp|chf)?';
  const importo = (testo) => { const m = new RegExp(SIMB + '\\s*' + NUM + '\\s*' + SIMB, 'i').exec(testo); return m ? { n: L.numero(m[2]), s: simbolo(m[1] || m[3] || '€') } : null; };
  L.spedizione = function (testo) {
    const t = String(testo || '').replace(/\s+/g, ' ').slice(0, 200000);
    let soglia = null, mancano = null, simb = null, m;
    // "ti mancano 7,10 € per la spedizione gratuita" / "aggiungi ancora 7,10 € ..." / "mancano 7,10 € alla spedizione gratuita"
    const reManca = [
      new RegExp('(?:ti\\s+mancano|mancano|ancora|aggiungi(?:\\s+ancora)?|spendi\\s+ancora)\\s+(' + SIMB + '\\s*' + NUM + '\\s*' + SIMB + ')[^.]{0,60}?(?:spedizione\\s+(?:gratuita|gratis)|consegna\\s+gratuita)', 'i'),
      new RegExp('(?:you(?:\'re| are)\\s+)?(' + SIMB + '\\s*' + NUM + '\\s*' + SIMB + ')\\s+(?:away\\s+from|more\\s+(?:for|to\\s+get|to\\s+qualify\\s+for)|short\\s+of|left\\s+(?:for|to\\s+get))\\s+free\\s+(?:shipping|delivery)', 'i'),
      new RegExp('(?:add|spend)\\s+(' + SIMB + '\\s*' + NUM + '\\s*' + SIMB + ')\\s+more\\s+(?:for|to\\s+get|to\\s+qualify\\s+for)\\s+free\\s+(?:shipping|delivery)', 'i')
    ];
    for (const re of reManca) {
      if ((m = re.exec(t))) { const im = importo(m[1]); if (im && im.n > 0) { mancano = im.n; simb = im.s; break; } }
    }
    // "spedizione gratuita sopra 49 €" / "gratis per ordini superiori a 49,00 €" / "free shipping over $50" / "free shipping on orders over €50"
    const reSoglia = [
      new RegExp('(?:spedizione|consegna)\\s+(?:gratuita|gratis)\\s+(?:per\\s+(?:ordini|acquisti)\\s+)?(?:sopra|oltre|da|superiori?\\s+a|a\\s+partire\\s+da|per\\s+ordini\\s+sopra)(?:\\s+i)?\\s+(' + SIMB + '\\s*' + NUM + '\\s*' + SIMB + ')', 'i'),
      new RegExp('(?:spedizione|consegna)\\s+(?:gratuita|gratis)\\s+per\\s+(?:ordini|acquisti)\\s+(?:sopra|oltre|superiori?\\s+a|da)(?:\\s+i)?\\s+(' + SIMB + '\\s*' + NUM + '\\s*' + SIMB + ')', 'i'),
      new RegExp('free\\s+(?:standard\\s+)?(?:shipping|delivery)\\s+(?:on\\s+(?:all\\s+)?orders\\s+)?(?:over|above|from|for\\s+orders\\s+over|on\\s+orders\\s+of)\\s+(' + SIMB + '\\s*' + NUM + '\\s*' + SIMB + ')', 'i'),
      new RegExp('(?:gratis|gratuita)\\s+(?:sopra|oltre)\\s+(' + SIMB + '\\s*' + NUM + '\\s*' + SIMB + ')', 'i')
    ];
    for (const re of reSoglia) {
      if ((m = re.exec(t))) { const im = importo(m[1]); if (im && im.n > 0) { soglia = im.n; simb = simb || im.s; break; } }
    }
    if (soglia == null && mancano == null) return null;
    // Subtotale letto dal carrello: serve solo per calcolare "ti mancano" quando la pagina non lo scrive
    let subtotale = null;
    if (mancano == null) {
      const ms = new RegExp('(?:sub-?totale(?:\\s+carrello)?|totale\\s+parziale|cart\\s+subtotal|subtotal)\\s*:?\\s*(' + SIMB + '\\s*' + NUM + '\\s*' + SIMB + ')', 'i').exec(t);
      const im = ms && importo(ms[1]);
      if (im && im.n >= 0) subtotale = im.n;
      if (soglia != null && subtotale != null && subtotale < soglia) mancano = Math.round((soglia - subtotale) * 100) / 100;
    }
    return { soglia, mancano, simbolo: simb || '€', subtotale };
  };
  L.testoSpedizione = function (s) {
    if (!s) return '';
    const f = (n) => (self.formattaImporto ? self.formattaImporto(n, s.simbolo) : n + ' ' + s.simbolo);
    if (s.mancano != null && s.mancano > 0) return 'Ti mancano ' + f(s.mancano) + ' per la spedizione gratuita';
    if (s.soglia != null) return 'Spedizione gratuita sopra ' + f(s.soglia);
    return '';
  };

  // ---------- Email: codici e negozio ----------
  const ESP = new Set(('shopifyemail.com myshopify.com klaviyomail.com klaviyo.com mailchimp.com mcsv.net rsgsv.net mcdlv.net list-manage.com sendgrid.net sendgrid.com ' +
    'mailgun.org mailgun.net sendinblue.com sibautomation.com brevo.com sendibt2.com sendibt3.com amazonses.com createsend.com cmail19.com cmail20.com cmail1.com ' +
    'exacttarget.com et.com salesforce.com hubspotemail.net hubspot.com mandrillapp.com mailjet.com mjt.lu postmarkapp.com sparkpostmail.com customeriomail.com ' +
    'iterable.com e.customer.io ctctcdn.com constantcontact.com activehosted.com omnisend.com omnisrc.com mailerlite.com mlsend.com').split(' '));
  const IGNORA_LINK = new Set(('facebook.com instagram.com twitter.com x.com youtube.com tiktok.com pinterest.com linkedin.com google.com goo.gl apple.com wa.me whatsapp.com ' +
    't.me telegram.org snapchat.com trustpilot.com gstatic.com googleusercontent.com w3.org schema.org').split(' '));
  const PERSONALI = new Set('gmail.com googlemail.com outlook.com hotmail.com live.com yahoo.com yahoo.it libero.it icloud.com me.com tiscali.it virgilio.it alice.it'.split(' '));
  const dom = (host) => (self.dominioDi ? self.dominioDi(host) : String(host).replace(/^www\./, ''));
  L.eEsp = (d) => ESP.has(d) || [...ESP].some((x) => d.endsWith('.' + x));
  L.dominioMittente = function (indirizzo) {
    const m = /@([a-z0-9.-]+\.[a-z]{2,})>?\s*$/i.exec(String(indirizzo || '').trim());
    return m ? dom(m[1].toLowerCase()) : null;
  };
  function dominiDeiLink(link) {
    const conta = new Map();
    for (let h of link || []) {
      try {
        let u = new URL(h);
        if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === '/url') { const q = u.searchParams.get('q') || u.searchParams.get('url'); if (q) u = new URL(q); }
        if (!/^https?:$/.test(u.protocol)) continue;
        const d = dom(u.hostname.toLowerCase());
        if (!d || IGNORA_LINK.has(d) || L.eEsp(d)) continue;
        if (/unsubscribe|optout|disiscriv/i.test(u.href)) continue;
        conta.set(d, (conta.get(d) || 0) + 1);
      } catch (e) {}
    }
    return [...conta.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  }
  const reInfoPct = /(\d{1,2}(?:[.,]\d)?)\s*%/;
  // Codici di verifica, accesso, password, sicurezza: mai salvati. Nelle email il codice deve avere VICINO (circa 80 caratteri) una parola di sconto.
  const FINESTRA_CODICE = 80;
  const RE_SEGRETO = /verifica\b|verifich|verification|verify|\botp\b|one[-\s]?time|password|accesso|log[-\s]?in|sign[-\s]?in|conferma\s+(?:del\s+(?:tuo\s+)?|il\s+tuo\s+|la\s+tua\s+)?(?:account|e-?mail|indirizzo)|confirm\w*\s+(?:your\s+)?(?:account|e-?mail)|security|sicurezza|autenticazion|authentication|\bpin\b|\b2fa\b|due\s+fattori|two[-\s]?factor/i;
  const RE_SCONTO_VICINO = /sconto|sconti|coupon|promo|offert|risparm|discount|\d\s*%|%\s*\d|€\s*di\s*sconto|\boff\b|\bsave\b|saving/i;
  L.contestoSconto = function (vicino) {
    const t = String(vicino || '').replace(/accesso\s+(?:anticipato|esclusivo|prioritario|riservato)|early\s+access|vip\s+access/gi, ' ');
    return RE_SCONTO_VICINO.test(t) && !RE_SEGRETO.test(t);
  };
  // { mittente, oggetto, testo, link: [href...], oggi } -> { dominio, codici: [{ code, scade, info }] }
  L.emailEstrai = function (e) {
    const out = { dominio: null, codici: [] };
    const testo = String(e.testo || '');
    const oggi = e.oggi || Date.now();
    const dMitt = L.dominioMittente(e.mittente);
    const link = dominiDeiLink(e.link);
    if (dMitt && !L.eEsp(dMitt) && !PERSONALI.has(dMitt)) out.dominio = dMitt;
    else if (link.length) out.dominio = link[0];
    if (!out.dominio) return out;
    const trovati = new Set();
    const tutto = String(e.oggetto || '') + ' \n' + testo.slice(0, 200000);
    self.CS_dalTesto(tutto, trovati, oggi);
    for (const c of trovati) {
      // Una email vale solo se il codice sta dentro un discorso di sconto (e non di verifica, accesso, password...): altrimenti potrebbe essere un codice SEGRETO.
      let i = tutto.indexOf(c), buono = false;
      while (i >= 0 && !buono) {
        buono = L.contestoSconto(tutto.slice(Math.max(0, i - FINESTRA_CODICE), i + c.length + FINESTRA_CODICE));
        i = tutto.indexOf(c, i + c.length);
      }
      if (!buono) continue;
      const j = tutto.indexOf(c);
      const vicino = j >= 0 ? tutto.slice(Math.max(0, j - 120), j + c.length + 120) : '';
      const p = reInfoPct.exec(vicino);
      out.codici.push({ code: c, scade: (trovati.scad && trovati.scad[c]) || null, info: p ? '-' + p[1].replace(',', '.') + '%' : null });
    }
    out.codici = out.codici.slice(0, 20);
    return out;
  };

  // ---------- Siti di coupon aperti dall'utente ----------
  const RE_COUPON_TESTO = /codic[ei]\s+(?:sconto|promo(?:zional[ei])?|coupon)|coupon|promo\s?code|discount\s+code|voucher\s+code|codice\s+promo/i;
  L.eAggregatore = function (host, lista) {
    const d = dom(String(host || '').toLowerCase());
    return (lista || []).some((x) => d === x || d.endsWith('.' + x));
  };
  L.slugNegozio = function (url) {
    let u;
    try { u = new URL(url); } catch (e) { return null; }
    const segs = u.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s).toLowerCase());
    const parole = /^(codic[ei]|sconto|sconti|coupon|coupons|promo|promozion[ei]|code|codes|discount|discounts|voucher|vouchers|offert[ae]|codice|store|stores|shop|negozio|negozi|it|en|de|fr|es|com|buoni|buono|categoria|category|s)$/;
    for (let i = segs.length - 1; i >= 0; i--) {
      let s = segs[i].replace(/\.(html?|php|aspx?)$/, '');
      s = s.split('-').filter((p) => p && !parole.test(p)).join('-');
      s = s.replace(/-(it|com|co-uk|de|fr|es)$/, '');
      if (s.length >= 2 && /^[a-z0-9-]+$/.test(s)) return s;
    }
    return null;
  };
  L.titoloCoupon = (url, titolo) => RE_COUPON_TESTO.test(String(titolo || '')) || RE_COUPON_TESTO.test(String(url || '').replace(/[-_/]/g, ' '));
  // candidati: [{ dominio, peso }] da link e testi. dominiPagina = dominio dell'aggregatore, da escludere.
  L.candidatiNegozio = function (p) {
    const pesi = new Map();
    const aggiungi = (host, peso) => {
      const d = dom(String(host || '').toLowerCase());
      if (!d || d === p.dominioPagina || IGNORA_LINK.has(d) || L.eEsp(d) || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return;
      pesi.set(d, (pesi.get(d) || 0) + peso);
    };
    for (const l of p.link || []) {
      let h = null;
      try { h = new URL(l.href).hostname; } catch (e) {}
      const t = String(l.testo || '').trim();
      const comeDominio = /^(?:vai\s+(?:a|al|su)\s+|visita\s+|visit\s+|go\s+to\s+)?(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\/?$/i.exec(t);
      if (comeDominio) aggiungi(comeDominio[1], 3);
      else if (h && /vai\s+(al\s+)?(negozio|sito|shop)|visita|visit\s+(store|shop|site)|go\s+to\s+(store|shop|site)|shop\s+now|apri\s+il\s+negozio/i.test(t)) aggiungi(h, 3);
    }
    const re = /\b((?:[a-z0-9-]{2,}\.)+(?:it|com|co\.uk|de|fr|es|eu|net|org|shop|store|nl|ch|at|be|pt|pl))\b/gi;
    let m;
    const titolo = String(p.titolo || '');
    while ((m = re.exec(titolo))) aggiungi(m[1], 2);
    const corpo = String(p.testo || '').slice(0, 20000);
    let k = 0;
    while ((m = re.exec(corpo)) && k++ < 30) aggiungi(m[1], 1);
    return [...pesi.entries()].map(([dominio, peso]) => ({ dominio, peso })).sort((a, b) => b.peso - a.peso);
  };
  const etichettaDi = (d) => String(d).split('.')[0];
  // sceglie il negozio: il candidato col nome uguale allo slug; senza candidati, un sito già noto (chiavi) con quel nome
  L.scegliNegozio = function (candidati, slug, noti) {
    const s = slug ? slug.replace(/-/g, '') : null;
    const punti = (c) => c.peso + (s && etichettaDi(c.dominio).replace(/-/g, '') === s ? 5 : 0);
    const ord = (candidati || []).slice().sort((a, b) => punti(b) - punti(a));
    if (ord.length && (punti(ord[0]) >= 3)) return ord[0].dominio;
    if (s) {
      const uguali = (noti || []).filter((d) => etichettaDi(d).replace(/-/g, '') === s);
      if (uguali.length === 1) return uguali[0];
    }
    return ord.length && ord[0].peso >= 2 ? ord[0].dominio : null;
  };

  // ---------- Cerca anche su (apre una scheda solo quando l'utente clicca) ----------
  L.cercaUrl = function (nome) {
    const q = encodeURIComponent(L.nomeBreve(nome));
    return [
      { id: 'amazon', nome: 'Amazon.it', url: 'https://www.amazon.it/s?k=' + q },
      { id: 'google', nome: 'Google Shopping', url: 'https://www.google.com/search?tbm=shop&q=' + q },
      { id: 'idealo', nome: 'Idealo.it', url: 'https://www.idealo.it/risultati.html?q=' + q },
      { id: 'trovaprezzi', nome: 'Trovaprezzi.it', url: 'https://www.trovaprezzi.it/categoria.aspx?libera=' + q + '&id=-1' }
    ];
  };

  // ---------- Cashback ----------
  L.SERVIZI_CASHBACK = {
    beruby: { nome: 'Beruby', url: 'https://www.beruby.com/' },
    topcashback: { nome: 'TopCashback', url: 'https://www.topcashback.it/' },
    igraal: { nome: 'iGraal', url: 'https://it.igraal.com/' },
    payback: { nome: 'Payback', url: 'https://www.payback.it/' },
    letyshops: { nome: 'LetyShops', url: 'https://letyshops.com/it' }
  };
  L.urlCashback = function (cb) {
    if (!cb) return null;
    if (cb.servizio === 'altro') {
      try { const u = new URL(String(cb.url || '')); return /^https?:$/.test(u.protocol) ? { nome: String(cb.nomeAltro || u.hostname).slice(0, 40), url: u.href } : null; } catch (e) { return null; }
    }
    return L.SERVIZI_CASHBACK[cb.servizio] || null;
  };
  L.cashbackVale = function (cb, dominio) {
    if (!cb || !cb.attivo) return null;
    const s = L.urlCashback(cb);
    if (!s) return null;
    const negozi = (cb.negozi || []).map((x) => String(x).toLowerCase().replace(/^www\./, ''));
    if (cb.tutti !== false) return s;
    return negozi.some((x) => dominio === x || dominio.endsWith('.' + x) || x.endsWith('.' + dominio)) ? s : null;
  };
  L.giorniDa = (iso, adesso) => Math.floor(((adesso || Date.now()) - new Date(iso + 'T12:00:00').getTime()) / 86400000);
})();
