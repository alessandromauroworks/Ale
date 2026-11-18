/* Generatore PDF minimo della base dei gestionali (nessuna libreria esterna).
   Scrive un PDF 1.4 vero, A4, con i caratteri standard Helvetica e Helvetica-Bold
   (codifica WinAnsi: lettere accentate italiane e simbolo dell'euro).
   Testo, linee, riquadri, tabelle con totali e salto pagina automatico.
   Si carica solo quando si preme «Esporta PDF». Niente eval, niente rete. */
(function () {
  'use strict';
  var LW = 595.28, LH = 841.89; // A4 in punti
  /* larghezze dei caratteri (unità /1000) da 32 a 126, dalle metriche standard Adobe */
  var WR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  var WB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
  var SPECIALI = { 0x20ac: 0x80, 0x201a: 0x82, 0x201e: 0x84, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2212: 0x2d, 0x00a0: 0x20, 0x202f: 0x20, 0x2009: 0x20, 0x2713: 0x2a, 0x26a0: 0x21 };
  /* testo → byte WinAnsi (un carattere per byte) */
  function win(s) {
    var o = '';
    s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) { i++; o += '?'; continue; }
      if (SPECIALI[c] != null) c = SPECIALI[c];
      else if (c < 32) c = 32;
      else if (c > 255) c = 63;
      o += String.fromCharCode(c);
    }
    return o;
  }
  function larghezza(s, dim, gr) {
    var t = win(s), w = 0, tab = gr ? WB : WR;
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if (c >= 32 && c <= 126) w += tab[c - 32];
      else if (c === 0xec || c === 0xed || c === 0xee || c === 0xef) w += gr ? 278 : 278;
      else w += 556;
    }
    return w * dim / 1000;
  }
  function str(s) { return '(' + win(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')'; }
  function n(x) { return (Math.round(x * 100) / 100).toString(); }
  function col(c) { c = c || [0, 0, 0]; return n(c[0] / 255) + ' ' + n(c[1] / 255) + ' ' + n(c[2] / 255); }
  /* va a capo per stare in una larghezza */
  function aCapo(s, w, dim, gr) {
    var parole = String(s == null ? '' : s).split(/\s+/), righe = [], cur = '';
    parole.forEach(function (p) {
      var prova = cur ? cur + ' ' + p : p;
      if (larghezza(prova, dim, gr) <= w || !cur) {
        if (!cur && larghezza(p, dim, gr) > w) { // parola troppo lunga: si spezza
          var pezzo = '';
          for (var i = 0; i < p.length; i++) { if (larghezza(pezzo + p[i], dim, gr) > w && pezzo) { righe.push(pezzo); pezzo = ''; } pezzo += p[i]; }
          cur = pezzo;
        } else cur = prova;
      } else { righe.push(cur); cur = p; }
    });
    if (cur || !righe.length) righe.push(cur);
    return righe;
  }

  function Documento(info) {
    info = info || {};
    var pagine = [], cur = null;
    var d = {
      nuovaPagina: function () { cur = []; pagine.push(cur); return d; },
      testo: function (x, y, s, o) {
        o = o || {}; var dim = o.dim || 10, gr = !!o.grassetto, w = larghezza(s, dim, gr);
        if (o.allinea === 'destra') x -= w; else if (o.allinea === 'centro') x -= w / 2;
        cur.push('BT /' + (gr ? 'F2' : 'F1') + ' ' + n(dim) + ' Tf ' + col(o.colore) + ' rg ' + n(x) + ' ' + n(LH - y) + ' Td ' + str(s) + ' Tj ET');
        return d;
      },
      linea: function (x1, y1, x2, y2, o) { o = o || {}; cur.push(col(o.colore || [200, 200, 205]) + ' RG ' + n(o.spessore || 0.6) + ' w ' + n(x1) + ' ' + n(LH - y1) + ' m ' + n(x2) + ' ' + n(LH - y2) + ' l S'); return d; },
      riquadro: function (x, y, w, h, c) { cur.push(col(c) + ' rg ' + n(x) + ' ' + n(LH - y - h) + ' ' + n(w) + ' ' + n(h) + ' re f'); return d; },
      larghezza: larghezza, aCapo: aCapo,
      numeroPagine: function () { return pagine.length; },
      vaiPagina: function (i) { cur = pagine[i]; return d; },
      byte: function () {
        var ogg = [], off = [], out = '%PDF-1.4\n%âãÏÓ\n';
        var np = pagine.length, idPag = [], idCont = [];
        /* 1 catalogo, 2 albero pagine, 3-4 caratteri, 5 informazioni, poi pagine e contenuti */
        for (var i = 0; i < np; i++) { idPag.push(6 + i * 2); idCont.push(7 + i * 2); }
        ogg[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        ogg[2] = '<< /Type /Pages /Count ' + np + ' /Kids [' + idPag.map(function (x) { return x + ' 0 R'; }).join(' ') + '] >>';
        ogg[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        ogg[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        var t = new Date(), p2 = function (x) { return String(x).padStart(2, '0'); };
        ogg[5] = '<< /Title ' + str(info.titolo || 'Documento') + ' /Producer (Gestionali A. Mauro - generatore PDF minimo) /CreationDate (D:' + t.getFullYear() + p2(t.getMonth() + 1) + p2(t.getDate()) + p2(t.getHours()) + p2(t.getMinutes()) + p2(t.getSeconds()) + ') >>';
        pagine.forEach(function (pg, i) {
          var cont = pg.join('\n');
          ogg[idPag[i]] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n(LW) + ' ' + n(LH) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + idCont[i] + ' 0 R >>';
          ogg[idCont[i]] = '<< /Length ' + cont.length + ' >>\nstream\n' + cont + '\nendstream';
        });
        for (var k = 1; k < ogg.length; k++) { off[k] = out.length; out += k + ' 0 obj\n' + ogg[k] + '\nendobj\n'; }
        var xref = out.length;
        out += 'xref\n0 ' + ogg.length + '\n0000000000 65535 f\r\n';
        for (k = 1; k < ogg.length; k++) out += String(off[k]).padStart(10, '0') + ' 00000 n\r\n';
        out += 'trailer\n<< /Size ' + ogg.length + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
        var b = new Uint8Array(out.length);
        for (var j = 0; j < out.length; j++) b[j] = out.charCodeAt(j) & 255;
        return b;
      }
    };
    d.nuovaPagina();
    return d;
  }

  /* impaginazione di un report: blocchi uno sotto l'altro, salto pagina automatico */
  function report(def) {
    var doc = Documento({ titolo: def.titolo }), M = 42, W = LW - 2 * M, y = 0, ALTO = 64, BASSO = LH - 56;
    var GRIGIO = [110, 110, 115], LINEA = [214, 214, 220], FONDO = [242, 242, 245], NERO = [29, 29, 31];
    function inizioPagina() { y = ALTO; }
    function spazio(h) { if (y + h > BASSO) { doc.nuovaPagina(); inizioPagina(); return true; } return false; }
    function paragrafo(t, o) {
      o = o || {}; var dim = o.dim || 9.5, lh = dim * 1.38;
      aCapo(t, W, dim, o.grassetto).forEach(function (r) { spazio(lh); doc.testo(M, y + dim, r, { dim: dim, grassetto: o.grassetto, colore: o.colore || NERO }); y += lh; });
      y += o.dopo == null ? 4 : o.dopo;
    }
    function tabella(tb) {
      var cols = tb.colonne, tot = cols.reduce(function (a, c) { return a + (c.w || 1); }, 0), dim = 8.6, pad = 4;
      var xs = [], x = M; cols.forEach(function (c) { xs.push(x); x += W * (c.w || 1) / tot; });
      var lw = function (i) { return W * (cols[i].w || 1) / tot - 2 * pad; };
      function testata() {
        spazio(20); doc.riquadro(M, y, W, 17, FONDO);
        cols.forEach(function (c, i) { doc.testo(c.num ? xs[i] + lw(i) + pad : xs[i] + pad, y + 11.5, c.t, { dim: 7.6, grassetto: true, colore: GRIGIO, allinea: c.num ? 'destra' : null }); });
        y += 17;
      }
      function riga(r, gr) {
        var cell = r.map(function (v, i) { return cols[i].num ? [String(v == null ? '' : v)] : aCapo(v == null ? '' : v, lw(i), dim, gr); });
        var h = Math.max.apply(null, cell.map(function (c) { return c.length; })) * dim * 1.3 + 7;
        if (spazio(h)) testata();
        cell.forEach(function (lin, i) { lin.forEach(function (t, j) { doc.testo(cols[i].num ? xs[i] + lw(i) + pad : xs[i] + pad, y + 4 + dim + j * dim * 1.3, t, { dim: dim, grassetto: gr, colore: NERO, allinea: cols[i].num ? 'destra' : null }); }); });
        y += h; doc.linea(M, y, M + W, y, { colore: LINEA });
      }
      testata();
      if (!tb.righe.length) { spazio(16); doc.testo(M + pad, y + 11, tb.vuoto || 'Nessun dato', { dim: dim, colore: GRIGIO }); y += 16; }
      tb.righe.forEach(function (r) { riga(r, false); });
      if (tb.totale) riga(tb.totale, true);
      y += 10;
    }
    function riquadri(lista) {
      var g = 10, w = (W - g * (lista.length - 1)) / lista.length, h = 52;
      spazio(h + 8);
      lista.forEach(function (k, i) {
        var x = M + i * (w + g);
        doc.riquadro(x, y, w, h, FONDO);
        doc.testo(x + 9, y + 15, k[0], { dim: 8, colore: GRIGIO });
        doc.testo(x + 9, y + 33, k[1], { dim: 14, grassetto: true, colore: k[3] || NERO });
        if (k[2]) doc.testo(x + 9, y + 46, k[2], { dim: 7.4, colore: GRIGIO });
      });
      y += h + 12;
    }
    inizioPagina();
    def.blocchi.forEach(function (b) {
      if (b.h1) { spazio(30); doc.testo(M, y + 18, b.h1, { dim: 18, grassetto: true, colore: NERO }); y += 28; }
      else if (b.h2) { spazio(34); y += 8; doc.testo(M, y + 12, b.h2, { dim: 12, grassetto: true, colore: NERO }); y += 20; }
      else if (b.p != null) paragrafo(b.p, b);
      else if (b.tabella) tabella(b.tabella);
      else if (b.riquadri) riquadri(b.riquadri);
    });
    /* intestazione e piè di pagina, con il numero di pagine finale */
    var np = doc.numeroPagine();
    for (var i = 0; i < np; i++) {
      doc.vaiPagina(i);
      doc.testo(M, 34, def.intestazione || def.titolo, { dim: 8, colore: GRIGIO });
      doc.testo(M + W, 34, def.data || '', { dim: 8, colore: GRIGIO, allinea: 'destra' });
      doc.linea(M, 42, M + W, 42, { colore: LINEA });
      doc.linea(M, LH - 40, M + W, LH - 40, { colore: LINEA });
      doc.testo(M, LH - 27, def.piede || '', { dim: 7.6, colore: GRIGIO });
      doc.testo(M + W, LH - 27, 'Pagina ' + (i + 1) + ' di ' + np, { dim: 7.6, colore: GRIGIO, allinea: 'destra' });
    }
    return doc.byte();
  }

  window.MiniPdf = { Documento: Documento, report: report, larghezza: larghezza };
})();
