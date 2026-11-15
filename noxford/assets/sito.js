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
    bg.setAttribute("aria-label", "Apri il menu");
    mob.setAttribute("aria-hidden", "true");
    mob.querySelectorAll("a").forEach(function (a) { a.setAttribute("tabindex", "-1"); });
    doc.body.style.overflow = "";
  }
  function apri() {
    mob.classList.add("open");
    bg.setAttribute("aria-expanded", "true");
    bg.setAttribute("aria-label", "Chiudi il menu");
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
      var base = H * 0.78;
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
