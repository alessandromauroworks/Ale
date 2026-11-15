/* Comportamenti comuni del sito: menu del telefono, comparsa allo scroll, scena animata, mappa, link di prenotazione e contatti.
   Il sito funziona anche senza questo file: i link portano comunque alle pagine giuste. */
(function () {
  "use strict";
  const root = document.documentElement, BASE = root.getAttribute("data-base") || "";
  const ridotto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!ridotto && "IntersectionObserver" in window) root.classList.add("anim");

  /* menu del telefono */
  const h = document.querySelector(".hamb"), m = document.getElementById("menu");
  if (h && m) {
    const set = v => { h.setAttribute("aria-expanded", String(v)); m.classList.toggle("open", v); };
    h.addEventListener("click", () => set(h.getAttribute("aria-expanded") !== "true"));
    document.addEventListener("keydown", e => { if (e.key === "Escape" && h.getAttribute("aria-expanded") === "true") { set(false); h.focus(); } });
    m.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    window.addEventListener("resize", () => { if (innerWidth > 900) set(false); });
  }

  /* comparsa allo scroll, scena dell'apertura e mappa «come lavoro» */
  const vis = document.querySelectorAll(".rv, .scena, .mappa");
  if (root.classList.contains("anim")) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; e.target.classList.add(e.target.classList.contains("rv") ? "in" : "va"); io.unobserve(e.target); }), { rootMargin: "0px 0px -8% 0px", threshold: .12 });
    vis.forEach(x => io.observe(x));
  } else vis.forEach(x => x.classList.add("in", "va"));

  /* contatti e prenotazione: tutto da comune/config.js */
  const C = typeof CONTATTI === "object" ? CONTATTI : null, P = typeof PRENOTA_URL === "string" ? PRENOTA_URL.trim() : "";
  let pren = ""; try { if (P) { const u = new URL(P); if (u.protocol === "https:") pren = u.href; } } catch (e) { pren = ""; }
  const testo = "Ciao Alessandro, ho visto il tuo sito e vorrei fissare una call conoscitiva.";
  if (C) {
    document.querySelectorAll("[data-wa]").forEach(a => { a.href = "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(a.getAttribute("data-wa") || testo); });
    document.querySelectorAll("[data-mail]").forEach(a => { a.href = "mailto:" + C.email + "?subject=" + encodeURIComponent(a.getAttribute("data-mail") || "Call conoscitiva"); });
  }
  /* pagina «Prenota una call»: con il link si prenota subito, senza link si scrive su WhatsApp o per email */
  document.querySelectorAll("[data-se-prenota]").forEach(e => { e.hidden = !pren; });
  document.querySelectorAll("[data-se-no-prenota]").forEach(e => { e.hidden = !!pren; });
  document.querySelectorAll("a[data-prenota-diretto]").forEach(a => { if (pren) { a.href = pren; a.target = "_blank"; a.rel = "noopener"; } });

  /* anno nel piè di pagina */
  document.querySelectorAll("[data-anno]").forEach(e => { e.textContent = String(new Date().getFullYear()); });
  void BASE;
})();
