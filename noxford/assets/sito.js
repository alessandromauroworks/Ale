/* Noxford Agency - script del sito. Nessuna libreria esterna. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var ridotto = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CHIAVE = "nox-tema";

  function salva(t) { try { localStorage.setItem(CHIAVE, t); } catch (e) {} }

  /* tema: le home (data-fisso) salvano il proprio tema; le pagine interne l'hanno già letto nell'head */
  if (root.hasAttribute("data-fisso")) salva(root.getAttribute("data-tema") || "argento");

  function segnaPillola() {
    var t = root.getAttribute("data-tema");
    doc.querySelectorAll(".pill [data-tema-set]").forEach(function (el) {
      el.setAttribute("aria-current", el.getAttribute("data-tema-set") === t ? "true" : "false");
    });
  }
  function aggiornaLinkHome() {
    if (root.hasAttribute("data-fisso")) return;
    var oro = root.getAttribute("data-tema") === "oro";
    doc.querySelectorAll("a[data-home]").forEach(function (a) {
      var base = a.getAttribute("data-home");
      a.setAttribute("href", oro ? base + "oro/" : base);
    });
  }
  doc.querySelectorAll(".pill [data-tema-set]").forEach(function (el) {
    el.addEventListener("click", function () {
      var t = el.getAttribute("data-tema-set");
      salva(t);
      if (el.tagName === "BUTTON") {
        root.setAttribute("data-tema", t);
        segnaPillola();
        aggiornaLinkHome();
        if (window.__noxRedraw) window.__noxRedraw();
      }
    });
  });
  segnaPillola();
  aggiornaLinkHome();

  /* menu in alto */
  var top = doc.querySelector(".top");
  function onScroll() {
    var y = window.pageYOffset || 0;
    if (top) top.classList.toggle("sc", y > 30);
    var hv = doc.querySelector(".hv");
    if (hv && !ridotto && y < window.innerHeight * 1.2) {
      hv.style.transform = "translate3d(0," + (y * 0.12).toFixed(1) + "px,0)";
      var c = doc.querySelector(".hero canvas");
      if (c) c.style.transform = "translate3d(0," + (y * 0.2).toFixed(1) + "px,0)";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* menu telefono */
  var bg = doc.querySelector(".burger"), mob = doc.getElementById("mob");
  function chiudi() {
    if (!mob) return;
    mob.classList.remove("open");
    bg.setAttribute("aria-expanded", "false");
    bg.setAttribute("aria-label", bg.getAttribute("data-lo") || "Apri il menu");
    mob.setAttribute("aria-hidden", "true");
    mob.querySelectorAll("a").forEach(function (a) { a.setAttribute("tabindex", "-1"); });
    doc.body.style.overflow = "";
  }
  function apri() {
    mob.classList.add("open");
    bg.setAttribute("aria-expanded", "true");
    bg.setAttribute("aria-label", bg.getAttribute("data-lc") || "Chiudi il menu");
    mob.setAttribute("aria-hidden", "false");
    mob.querySelectorAll("a").forEach(function (a) { a.removeAttribute("tabindex"); });
    doc.body.style.overflow = "hidden";
  }
  if (bg && mob) {
    chiudi();
    bg.addEventListener("click", function () { mob.classList.contains("open") ? chiudi() : apri(); });
    mob.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", chiudi); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && mob.classList.contains("open")) { chiudi(); bg.focus(); } });
    window.addEventListener("resize", function () { if (window.innerWidth >= 900) chiudi(); });
  }

  /* comparsa morbida */
  var rv = doc.querySelectorAll(".rv");
  if ("IntersectionObserver" in window && !ridotto) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    rv.forEach(function (el) { io.observe(el); });
  } else {
    rv.forEach(function (el) { el.classList.add("in"); });
  }

  /* filtri video */
  var fb = doc.querySelectorAll(".filt button");
  if (fb.length) {
    fb.forEach(function (b) {
      b.addEventListener("click", function () {
        var c = b.getAttribute("data-f");
        fb.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        doc.querySelectorAll(".vid").forEach(function (v) {
          v.hidden = !(c === "tutti" || v.getAttribute("data-c") === c);
        });
      });
    });
  }


  /* ---------- lingua: tabella di corrispondenza italiano <-> inglese ---------- */
  var PAGINE = [
    ["", "en/"],
    ["oro/", "en/oro/"],
    ["video/", "en/video/"],
    ["software/", "en/software/"],
    ["gestionali/", "en/management/"],
    ["automazioni/", "en/automation/"],
    ["agent/", "en/agents/"],
    ["medico/", "en/healthcare/"],
    ["bnb/", "en/bnb/"],
    ["immobiliari/", "en/real-estate/"]
  ];
  var CH_LINGUA = "nox-lingua", CH_BARRA = "nox-barra";
  function leggi(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function scrivi(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var langPag = (root.getAttribute("lang") || "it").slice(0, 2) === "en" ? "en" : "it";
  var radice = null;
  (function () {
    var sc = doc.currentScript || doc.querySelector('script[src*="sito.js"]');
    try { radice = new URL("../", sc.src); } catch (e) { radice = null; }
  })();
  function paginaCorrente() {
    if (!radice) return -1;
    var rel = location.pathname.slice(radice.pathname.length).replace(/index\.html$/, "");
    if (rel && rel.charAt(rel.length - 1) !== "/") rel += "/";
    var da = langPag === "en" ? 1 : 0;
    for (var i = 0; i < PAGINE.length; i++) if (PAGINE[i][da] === rel) return i;
    return -1;
  }
  function destinazione(lingua) {
    var i = paginaCorrente();
    if (i < 0 || !radice) return null;
    return new URL(PAGINE[i][lingua === "en" ? 1 : 0], radice).href;
  }
  doc.querySelectorAll("a[data-lang]").forEach(function (a) {
    var l = a.getAttribute("data-lang");
    var d = destinazione(l);
    if (d) a.setAttribute("href", d);
    a.addEventListener("click", function () {
      scrivi(CH_LINGUA, l);
      var h = a.getAttribute("href").split("#")[0];
      a.setAttribute("href", h + location.hash);
    });
  });

  /* barra discreta per chi ha il browser non in italiano (nessun reindirizzamento) */
  (function () {
    if (langPag !== "it" || leggi(CH_LINGUA) || leggi(CH_BARRA)) return;
    var nl = ((navigator.languages && navigator.languages[0]) || navigator.language || "it").toLowerCase();
    if (nl.indexOf("it") === 0) return;
    var d = destinazione("en");
    if (!d) return;
    var b = doc.createElement("div");
    b.className = "langbar";
    b.setAttribute("role", "region");
    b.setAttribute("aria-label", "Language");
    b.innerHTML = '<a href="' + d + '" lang="en" hreflang="en">View this site in English</a><button type="button" aria-label="Close">×</button>';
    b.querySelector("a").addEventListener("click", function () { scrivi(CH_LINGUA, "en"); });
    b.querySelector("button").addEventListener("click", function () { scrivi(CH_BARRA, "1"); b.remove(); });
    doc.body.appendChild(b);
  })();

  /* ---------- hero: il tablet con il flusso Noxford ---------- */
  var hv = doc.querySelector(".hv[data-flow]");
  if (hv) {
    var sg = [].slice.call(hv.querySelectorAll(".sg"));
    var ps = [].slice.call(hv.querySelectorAll(".fp"));
    var cp = hv.querySelector(".cp"), pzb = hv.querySelector(".pz");
    var corr = -1, man = false, hov = false, foc = false, vis = true;
    var vai = function (i) {
      corr = i;
      sg.forEach(function (b) { b.classList.remove("act"); });
      void hv.offsetWidth;
      ps.forEach(function (p, k) { p.classList.toggle("on", k === i); });
      sg.forEach(function (b, k) {
        b.classList.toggle("act", k === i);
        b.classList.toggle("done", k < i && !ridotto);
        b.setAttribute("aria-current", k === i ? "step" : "false");
      });
      hv.setAttribute("data-ph", String(i));
      if (cp) cp.textContent = sg[i].getAttribute("data-cap") || "";
    };
    var agg = function () { hv.classList.toggle("pz2", man || hov || foc || !vis); };
    sg.forEach(function (b, k) { b.addEventListener("click", function () { vai(k); }); });
    if (ridotto) {
      vai(2);
      sg.forEach(function (b, k) { b.classList.toggle("done", false); });
    } else {
      vai(0);
      hv.addEventListener("animationend", function (e) {
        if (e.animationName === "nfill" && e.target.classList.contains("fill")) vai((corr + 1) % ps.length);
      });
      hv.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { hov = true; agg(); } });
      hv.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { hov = false; agg(); } });
      hv.addEventListener("focusin", function (e) { if (e.target.matches && e.target.matches(":focus-visible")) { foc = true; agg(); } });
      hv.addEventListener("focusout", function () { foc = false; agg(); });
      if (pzb) pzb.addEventListener("click", function () {
        man = !man;
        pzb.setAttribute("aria-pressed", man ? "true" : "false");
        var t = pzb.querySelector(".pt");
        if (t) t.textContent = pzb.getAttribute(man ? "data-r" : "data-p");
        agg();
      });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (es) { vis = es[0].isIntersecting; agg(); }, { threshold: 0.1 }).observe(hv);
      }
    }
  }

  /* fondo del cielo: poche luci e una linea d'acqua */
  var cv = doc.querySelector(".hero canvas");
  if (cv && cv.getContext) {
    var ctx = cv.getContext("2d"), W = 0, H = 0, stelle = [], rgb = "201,206,214", visibile = true, t0 = 0, raf = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var leggiColore = function () {
      var v = getComputedStyle(root).getPropertyValue("--ac-rgb").trim();
      if (v) rgb = v;
    };
    var misura = function () {
      var r = cv.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = W < 600 ? 38 : 70;
      stelle = [];
      for (var i = 0; i < n; i++) stelle.push({ x: Math.random() * W, y: Math.random() * H * 0.62, r: Math.random() * 1.3 + 0.3, f: Math.random() * 6.28, v: 0.4 + Math.random() * 1.1 });
    };
    var disegna = function (ms) {
      var t = ms / 1000;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stelle.length; i++) {
        var s = stelle[i], a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.v + s.f));
        ctx.fillStyle = "rgba(" + rgb + "," + a.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
      }
      var base = H * 0.9;
      for (var k = 0; k < 4; k++) {
        ctx.beginPath();
        var amp = 3 + k * 2.2, y0 = base + k * 15, vel = 0.35 + k * 0.12;
        for (var x = 0; x <= W; x += 8) {
          var y = y0 + Math.sin(x * 0.012 + t * vel + k) * amp + Math.sin(x * 0.031 - t * vel * 1.4) * amp * 0.4;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(" + rgb + "," + (k === 0 ? 0.55 : 0.2 - k * 0.03).toFixed(2) + ")";
        ctx.lineWidth = k === 0 ? 1.2 : 1;
        ctx.stroke();
      }
    };
    var ciclo = function (ms) {
      if (!visibile) { raf = 0; return; }
      disegna(ms);
      raf = requestAnimationFrame(ciclo);
    };
    misura(); leggiColore(); disegna(0);
    window.__noxRedraw = function () { leggiColore(); disegna(performance.now()); };
    if (!ridotto) {
      raf = requestAnimationFrame(ciclo);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (es) {
          visibile = es[0].isIntersecting;
          if (visibile && !raf) raf = requestAnimationFrame(ciclo);
        }).observe(cv);
      }
    }
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { misura(); disegna(performance.now()); }, 150); });
  }
})();
