/* DEMO del sito di Alessandro Mauro. Tutti i dati sono INVENTATI (nessun cliente vero) e niente viene salvato o inviato.
   Usa i dati condivisi di comune/settori.js (gli stessi del questionario).
   Si apre con un pulsante [data-demo="sito|gest|auto|ass|vf|fogli"]; il settore si sceglie con <select data-settore>. */
(function () {
  "use strict";
  if (typeof SETTORI === "undefined") return;
  const BASE = document.documentElement.getAttribute("data-base") || "";
  const RIDOTTO = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const btn = (x, c, fn) => { const b = el("button", c || "btn sec pic", x); b.type = "button"; if (fn) b.addEventListener("click", fn); return b; };
  const dueParti = s => { const i = s.indexOf("|"); return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)]; };
  const hsh = s => Array.from(s).reduce((t, c) => (t * 31 + c.charCodeAt(0)) % 997, 7);
  const timers = new Set();
  const dopo = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, RIDOTTO() ? Math.min(ms, 60) : ms); timers.add(t); return t; };
  const fermaTutto = () => { timers.forEach(clearTimeout); timers.clear(); };

  /* ---------- settore scelto (ricordato solo in questo browser, per comodità) ---------- */
  const KEY = "am:settore";
  const leggi = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const scrivi = v => { try { localStorage.setItem(KEY, v); } catch (e) {} };
  let nomeSett = (() => { try { const q = new URLSearchParams(location.search).get("settore"); if (q && SETTORI.some(s => s.n === q)) return q; } catch (e) {} const l = leggi(); return l && SETTORI.some(s => s.n === l) ? l : "Studio dentistico"; })();
  const sett = () => SETTORI.find(s => s.n === nomeSett) || SETTORI[SETTORI.length - 1];
  const priv = () => /^Privato/.test(nomeSett);
  const altra = () => nomeSett === "Altra attività";
  const chi = () => priv() ? "te" : altra() ? "la tua attività" : nomeSett.toLowerCase();
  const sanita = () => /dentist|medic|dietist|nutrizion|fisioterap|osteopat|psicolog|veterinar|farmacia/i.test(nomeSett);
  function sincronizza() {
    document.querySelectorAll("select[data-settore]").forEach(s => { if (s.value !== nomeSett) s.value = nomeSett; });
    document.querySelectorAll("[data-sett-nome]").forEach(e => { e.textContent = priv() ? "per te" : altra() ? "per la tua attività" : "per " + nomeSett.toLowerCase(); });
  }
  document.addEventListener("change", e => { const s = e.target.closest && e.target.closest("select[data-settore]"); if (!s) return; nomeSett = s.value; scrivi(nomeSett); sincronizza(); });

  /* ---------- finestra (dialog) ---------- */
  let dlg, dT, dB, opener = null, chiudiCb = null;
  function creaDialog() {
    dlg = el("dialog", "dlg"); dlg.setAttribute("aria-labelledby", "dlgT");
    const box = el("div", "dlg-box"), h = el("div", "dlg-h"); dT = el("h2", ""); dT.id = "dlgT";
    const x = btn("", "dlg-x", chiudi); x.setAttribute("aria-label", "Chiudi la demo");
    x.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    h.append(dT, x); dB = el("div", "dlg-b");
    const f = el("div", "dlg-f"), fp = el("p", "", "Esempio con dati inventati: niente viene salvato o inviato."), cta = el("a", "btn pic", "Lo voglio per la mia attività");
    cta.href = BASE + "prenota/"; f.append(fp, cta); box.append(h, dB, f); dlg.append(box); document.body.append(dlg);
    dlg.addEventListener("cancel", e => { e.preventDefault(); chiudi(); });
    dlg.addEventListener("click", e => { if (e.target === dlg) chiudi(); });
  }
  function apri(titolo, costruisci, onClose) {
    if (!dlg) creaDialog();
    fermaTutto(); if (!dlg.open) opener = document.activeElement; chiudiCb = onClose || null;
    dT.textContent = titolo; dB.replaceChildren(); dB.scrollTop = 0; dlg.classList.remove("chiude");
    const tag = el("p", ""); tag.append(el("span", "esempio", "Esempio con dati inventati")); dB.append(tag);
    costruisci(dB);
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    document.documentElement.style.overflow = "hidden";
    const f = dB.querySelector("[data-primo]") || dlg.querySelector(".dlg-x"); setTimeout(() => f.focus({ preventScroll: true }), 30);
  }
  function chiudi() {
    if (!dlg || !dlg.open || dlg.classList.contains("chiude")) return;
    fermaTutto(); dlg.classList.add("chiude");
    setTimeout(() => { dlg.classList.remove("chiude"); if (dlg.open) { if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open"); }
      document.documentElement.style.overflow = ""; dB.replaceChildren(); if (chiudiCb) chiudiCb(); chiudiCb = null;
      if (opener && opener.isConnected) opener.focus({ preventScroll: true }); }, RIDOTTO() ? 0 : 190);
  }
  const gruppo = (lab, items, cur, on) => { const g = el("div", "dg"); g.setAttribute("role", "group"); g.setAttribute("aria-label", lab); g.append(el("span", "dg-l", lab));
    items.forEach(([k, t]) => { const b = btn(t, "chip", () => { on(k); g.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.k === k))); }); b.dataset.k = k; b.setAttribute("aria-pressed", String(k === cur)); g.append(b); }); return g; };
  const scegliSettore = (onCambia) => { const w = el("div", "sett"), id = "dSet" + Math.random().toString(36).slice(2, 7), l = el("label", "", "La tua attività"); l.htmlFor = id;
    const s = el("select", "sel"); s.id = id; s.setAttribute("data-settore", ""); SETTORI.forEach(x => { const o = el("option", "", x.n); o.value = x.n; s.append(o); }); s.value = nomeSett;
    s.addEventListener("change", () => { nomeSett = s.value; scrivi(nomeSett); sincronizza(); onCambia(); }); w.append(l, s); w.style.marginBottom = "0"; return w; };

  /* ---------- 1. demo del sito ---------- */
  function testiSito(nome) { const r = (SITO_TXT[nomeSett] || SITO_TXT["Altra attività"]).split("|"); return { h: r[0].replace("{n}", nome), sub: r[1].replace("{n}", nome), sv: r[2].split(";"), cta: r[3] }; }
  function demoSito() {
    let dev = innerWidth < 700 ? "tel" : "pc", stile = "sem", nomeAtt = "";
    apri("Il tuo sito, in anteprima", body => {
      const top = el("div", "barra-d"), nomeW = el("div", "sett"), nl = el("label", "", "Nome della tua attività"), ni = el("input", "sel"); ni.id = "dNome"; nl.htmlFor = "dNome";
      ni.type = "text"; ni.maxLength = 40; ni.placeholder = "Es. Studio Rossi"; ni.style.backgroundImage = "none"; ni.style.paddingRight = "18px"; ni.autocomplete = "off"; nomeW.style.marginBottom = "0"; nomeW.append(nl, ni);
      const stage = el("div", "sd-stage"), frame = el("div", "sd-frame"), sd = el("div", "sd");
      const fit = () => { const W = dev === "tel" ? 360 : 980; frame.style.width = W + "px"; frame.style.zoom = String(Math.min(1, (stage.clientWidth - 22) / W)); frame.className = "sd-frame d-" + dev; };
      const disegna = () => {
        const nome = nomeAtt.trim() || (priv() ? "Il tuo nome" : "La tua attività"), T = testiSito(nome);
        sd.replaceChildren(); sd.className = "sd st-" + stile;
        const hd = el("div", "sd-h"), nv = el("nav", "sd-n"); nv.setAttribute("aria-label", "Menu di esempio"); (priv() ? ["Chi sono", "Lavori", "Contatti"] : ["Servizi", "Chi siamo", "Contatti"]).forEach(p => nv.append(el("span", "", p))); hd.append(el("b", "sd-logo", nome), nv);
        const hero = el("section", "sd-hero rvd"); hero.append(el("h3", "", T.h), el("p", "", T.sub), el("span", "sd-cta", T.cta));
        const sv = el("section", "sd-sec rvd"); sv.append(el("h4", "", priv() ? "I miei lavori" : "Cosa facciamo")); const gr = el("div", "sd-g");
        T.sv.forEach(t => { const c = el("div", "sd-card"); c.append(el("b", "", t), el("span", "", "Breve testo di esempio che spiega cosa include e a chi serve.")); gr.append(c); }); sv.append(gr);
        const rv = el("section", "sd-sec rvd"); rv.append(el("h4", "", priv() ? "Cosa dicono di me" : "Cosa dicono i clienti")); const rg = el("div", "sd-g");
        [["Cliente 1", "Persone gentili e puntuali, tutto chiaro dall'inizio."], ["Cliente 2", "Mi hanno risposto subito e ho risolto in poco tempo."]].forEach(([a, t]) => { const c = el("figure", "sd-card"), st = el("span", "sd-st", "★★★★★"); st.setAttribute("aria-label", "5 stelle su 5"); c.append(st, el("blockquote", "", t), el("figcaption", "", a + " · recensione di esempio")); rg.append(c); }); rv.append(rg);
        const ct = el("section", "sd-sec rvd"); ct.append(el("h4", "", "Contatti"), el("p", "", "Via Esempio 1 · Telefono 000 000 0000 · Orari di esempio"), el("span", "sd-cta", "Scrivici su WhatsApp"));
        sd.append(hd, hero, sv, rv, ct, el("div", "sd-f", "© " + nome + " · sito di esempio"));
        sd.classList.add("flash"); setTimeout(() => sd.classList.remove("flash"), 450);
        if (typeof IntersectionObserver === "function" && !RIDOTTO()) { const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add("in"); }), { root: sd, threshold: .12 }); sd.querySelectorAll(".rvd").forEach(x => io.observe(x)); }
        else sd.querySelectorAll(".rvd").forEach(x => x.classList.add("in"));
      };
      sd.tabIndex = 0; sd.setAttribute("role", "region"); sd.setAttribute("aria-label", "Anteprima del sito: scorri per vederlo tutto");
      const g1 = gruppo("Vedi su", [["tel", "Telefono"], ["pc", "Computer"]], dev, k => { dev = k; fit(); }); g1.querySelector("button").setAttribute("data-primo", "");
      const g2 = gruppo("Stile", [["sem", "Semplice"], ["ele", "Elegante"], ["wow", "Effetto wow"]], stile, k => { stile = k; disegna(); });
      ni.addEventListener("input", () => { nomeAtt = ni.value; disegna(); });
      top.append(scegliSettore(disegna), nomeW); const top2 = el("div", "barra-d"); top2.append(g1, g2);
      frame.append(sd); stage.append(frame);
      body.append(top, top2, el("p", "ex", "Scegli la tua attività, scrivi il nome e cambia stile: il sito vero lo scriviamo insieme, con i tuoi testi e le tue foto."), stage);
      disegna(); fit(); if (typeof ResizeObserver === "function") { const ro = new ResizeObserver(fit); ro.observe(stage); }
    });
  }

  /* ---------- 2. demo del gestionale ---------- */
  const moduli = () => { const x = GEST[nomeSett] || GEST["Altra attività"]; const u = a => a.filter((t, i) => a.indexOf(t) === i); return u([...x[0], ...G_GEN.filter(t => !(x[2] || []).includes(t))]).slice(0, 8); };
  const tipoModulo = m => GP_K.find(x => x[0].test(m)) || [0, ["Oggi", "Questa settimana", "Da fare"], ["Voce", "Data", "Stato"], (i, h) => ["Voce " + (i + 1), ["Lun 12", "Mar 13", "Mer 14", "Gio 15"][i], ["Nuovo", "In corso", "Fatto", "Da fare"][(h + i) % 4]]];
  const classeStato = t => /ritardo|scorta|manca|da inviare|da richiamare|da incassare|da firmare|assenti|in ferie|da confermare|da fare/i.test(t) ? "stato w" : /nuov|in corso|in ordine|in arrivo|aperta/i.test(t) ? "stato n" : "stato";
  function conta(e, fine, money) {
    const f = v => money ? "€ " + Math.round(v) : String(Math.round(v));
    if (RIDOTTO() || typeof requestAnimationFrame !== "function") { e.textContent = f(fine); return; }
    const t0 = performance.now(), d = 900; const step = t => { const k = Math.min(1, (t - t0) / d), v = fine * (1 - Math.pow(1 - k, 3)); e.textContent = f(v); if (k < 1 && e.isConnected) requestAnimationFrame(step); }; requestAnimationFrame(step);
  }
  function demoGest() {
    let sel = "Panoramica";
    apri("Il tuo gestionale, in anteprima", body => {
      const gp = el("div", "gp"), nav = el("nav", "gp-nav"), main = el("div", "gp-main"); nav.setAttribute("aria-label", "Moduli del gestionale di esempio");
      const vai = m => { sel = m; nav.querySelectorAll("button").forEach(b => b.setAttribute("aria-current", String(b.dataset.m === m))); mostra(); };
      const disegnaNav = () => { nav.replaceChildren(el("b", "", priv() ? "Le tue cose" : "Moduli per " + chi()));
        ["Panoramica", ...moduli()].forEach((m, i) => { const b = btn(m, "", () => vai(m)); b.dataset.m = m; b.setAttribute("aria-current", String(m === sel)); if (i === 0) b.setAttribute("data-primo", ""); nav.append(b); }); };
      const mostra = () => {
        main.replaceChildren(); main.classList.remove("entra"); void main.offsetWidth; main.classList.add("entra");
        if (sel === "Panoramica") {
          const h = el("div", "gp-h"); h.append(el("h3", "", "Buongiorno"), el("span", "ex", "Oggi, in un colpo d'occhio")); main.append(h);
          const k = el("div", "gp-k"); [[6, "Appuntamenti oggi"], [3, "Da richiamare"], [4, "Messaggi partiti da soli"]].forEach(([n, l]) => { const c = el("div", "gp-c"), b = el("b", "", "0"); c.append(b, el("span", "", l)); k.append(c); conta(b, n + hsh(nomeSett) % 5); }); main.append(k);
          const t = el("div", "gp-t"); t.setAttribute("role", "list"); t.setAttribute("aria-label", "Strumenti");
          moduli().slice(0, 4).forEach((m, i) => { const r = el("div", "gp-r"); r.setAttribute("role", "listitem"); const a = btn(m, "chip", () => vai(m)); r.append(a, el("span", "gp-s", ["Aggiornato ora", "3 novità", "Tutto in ordine", "2 da vedere"][i]), el("span", "")); t.append(r); });
          main.append(t, el("p", "ex", "Tocca un modulo a sinistra (o qui sopra) per vederlo. I moduli cambiano in base alla tua attività."));
          return;
        }
        const K = tipoModulo(sel), h = hsh(sel), money = K[1][0] === "Incassato";
        const hd = el("div", "gp-h"); hd.append(el("h3", "", sel)); const cerca = el("input", "gp-cerca"); cerca.type = "search"; cerca.placeholder = "Cerca"; cerca.setAttribute("aria-label", "Cerca in " + sel); hd.append(cerca); main.append(hd);
        const k = el("div", "gp-k"); K[1].forEach((l, j) => { const c = el("div", "gp-c"), b = el("b", "", money ? "€ 0" : "0"); c.append(b, el("span", "", l)); k.append(c); conta(b, money ? 200 + (h * (j + 3)) % 900 : [3 + h % 9, 14 + h % 40, 2 + h % 7][j], money); }); main.append(k);
        const tb = el("div", "gp-t"); tb.setAttribute("role", "table"); tb.setAttribute("aria-label", "Righe di esempio di " + sel);
        const hr = el("div", "gp-r gp-hd"); hr.setAttribute("role", "row"); K[2].forEach(x => { const e = el("span", "", x); e.setAttribute("role", "columnheader"); hr.append(e); }); tb.append(hr);
        const righe = []; for (let i = 0; i < 4; i++) { const r = el("div", "gp-r"); r.setAttribute("role", "row"); K[3](i, h).forEach((x, j) => { const e = el("span", j === 1 ? "gp-s" : "", null); e.setAttribute("role", "cell"); if (j === 2) e.append(el("span", classeStato(x), x)); else e.textContent = x; r.append(e); }); tb.append(r); righe.push(r); }
        const vuoto = el("p", "gp-vuoto", "Nessun risultato: prova un'altra parola."); vuoto.hidden = true; vuoto.setAttribute("role", "status");
        cerca.addEventListener("input", () => { const q = cerca.value.trim().toLowerCase(); let n = 0; righe.forEach(r => { const ok = !q || r.textContent.toLowerCase().includes(q); r.hidden = !ok; if (ok) n++; }); vuoto.hidden = n > 0; });
        const agg = btn("Aggiungi una riga di esempio", "btn sec pic", () => { const i = righe.length; const r = el("div", "gp-r lamp"); r.setAttribute("role", "row"); K[3](i % 4, h + i).forEach((x, j) => { const e = el("span", j === 1 ? "gp-s" : "", null); e.setAttribute("role", "cell"); if (j === 2) e.append(el("span", classeStato(x), x)); else e.textContent = j === 0 ? x.replace(/\d+$/, String(i + 1)) : x; r.append(e); }); tb.append(r); righe.push(r); setTimeout(() => r.classList.remove("lamp"), 1200); });
        main.append(tb, vuoto, agg);
      };
      const rifai = () => { sel = "Panoramica"; disegnaNav(); mostra(); };
      gp.append(nav, main); body.append(scegliSettore(rifai), el("p", "ex", "Un solo pannello con i moduli che servono alla tua attività. Niente di più, niente di meno."), gp); rifai();
    });
  }

  /* ---------- 3. demo delle automazioni ---------- */
  const passiDi = t => (FLOWS.find(f => f[0].test(t)) || [0, ["Succede qualcosa nel tuo lavoro", "Parte un messaggio al momento giusto", "Il cliente risponde", "Trovi tutto aggiornato, senza averlo fatto a mano"]])[1];
  const ORARI = ["Subito", "Ogni mattina alle 9:00", "Durante il giorno", "La sera alle 18:00", "1 giorno prima", "3 giorni prima", "3 giorni dopo", "Dopo 3 mesi che non torna", "Dopo 6 mesi che non torna"];
  function demoAuto() {
    let vista = "come", ix = 0, n = -1, timer = null;
    apri("Le automazioni, passo per passo", body => {
      const tabs = gruppo("Vedi", [["come", "Come funziona"], ["regole", "Le regole (puoi cambiarle)"]], vista, k => { vista = k; disegna(); }); tabs.querySelector("button").setAttribute("data-primo", "");
      const area = el("div", ""); area.style.display = "flex"; area.style.flexDirection = "column"; area.style.gap = "14px";
      const stop = () => { clearInterval(timer); timer = null; };
      const disegna = () => { stop(); area.replaceChildren(); n = -1; vista === "come" ? come() : regole(); };
      function come() {
        const lista = [...(AUTO_SET[nomeSett] || []).map(dueParti), ...AUTO_GEN.slice(0, 2).map(dueParti)].slice(0, 6); if (ix >= lista.length) ix = 0;
        const lst = el("div", "dg"); lst.setAttribute("role", "group"); lst.setAttribute("aria-label", "Scegli un'automazione");
        lista.forEach(([t], j) => { const b = btn(t, "chip", () => { ix = j; disegna(); }); b.setAttribute("aria-pressed", String(j === ix)); lst.append(b); });
        const tit = el("h3", "fl-t", lista[ix][0]), sub = el("p", "ex", lista[ix][1]), ol = el("ol", "fl"), live = el("p", "sr"); live.setAttribute("aria-live", "polite");
        passiDi(lista[ix][0]).forEach((t, j) => { const li = el("li", "fs"); li.append(el("span", "fs-n", String(j + 1)), el("span", "fs-x", t)); ol.append(li); });
        const show = k => { n = k; [...ol.children].forEach((li, j) => { li.classList.toggle("s-done", j < n); li.classList.toggle("s-now", j === n); li.setAttribute("aria-current", j === n ? "step" : "false"); }); if (n >= 0) live.textContent = "Passo " + (n + 1) + ": " + ol.children[n].textContent; };
        const play = btn("Riproduci", "btn pic"), passo = btn("Passo dopo passo", "btn sec pic"), da = btn("Ricomincia", "btn sec pic");
        const fine = () => { stop(); play.textContent = "Riproduci"; };
        play.addEventListener("click", () => { if (timer) { fine(); return; } if (n >= ol.children.length - 1) show(-1); play.textContent = "Ferma"; show(n + 1); timer = setInterval(() => { if (n >= ol.children.length - 1) { fine(); return; } show(n + 1); }, RIDOTTO() ? 600 : 1300); });
        passo.addEventListener("click", () => { fine(); show(n >= ol.children.length - 1 ? 0 : n + 1); });
        da.addEventListener("click", () => { fine(); show(-1); });
        const az = el("div", "azioni"); az.append(play, passo, da);
        area.append(lst, tit, sub, ol, az, live);
      }
      function regole() {
        const VARS = { nome: "Cliente 1", data: "giovedì 12", ora: "10:30", sedute: "2 sedute", telefono: "000 000 0000" }, sub = t => t.replace(/\{(\w+)\}/g, (m, k) => VARS[k] || m);
        area.append(el("p", "ex", "Accendi o spegni una regola, scegli quando parte e cambia il testo: vedi subito il messaggio. Nella demo non si salva niente."));
        const lst = el("div", "rls");
        regoleSettore(nomeSett, priv()).forEach(r => { let on = true;
          const c = el("div", "rl"), h = el("div", "rl-h"), sw = btn("", "sw"); sw.setAttribute("role", "switch"); sw.setAttribute("aria-checked", "true"); sw.setAttribute("aria-label", "Regola: " + r.label); const st = el("span", "", "Accesa"); sw.append(el("i"), st);
          h.append(el("b", "rl-t", r.label), sw); const bd = el("div", "rl-b");
          const sid = "q_" + r.id, sl = el("label", "", "Quando parte"); sl.htmlFor = sid; const se = el("select"); se.id = sid; ORARI.forEach(q => { const o = el("option", "", q); o.value = q; se.append(o); }); se.value = r.q;
          const tid = "m_" + r.id, tl = el("label", "", "Testo del messaggio"); tl.htmlFor = tid; const ta = el("textarea"); ta.id = tid; ta.maxLength = 300; ta.rows = 3; ta.value = r.msg;
          const pv = el("div", "wa"), when = el("p", "wa-w"), b1 = el("p", "wa-b"), b2 = r.avviso ? el("p", "wa-b wa-i") : null;
          const upd = () => { c.classList.toggle("off", !on); sw.setAttribute("aria-checked", String(on)); st.textContent = on ? "Accesa" : "Spenta"; when.textContent = on ? "Parte: " + se.value + " · " + r.canale : "Spenta: non parte."; b1.textContent = sub(ta.value) || "(testo vuoto)"; if (b2) b2.textContent = "Avviso a chi lavora con te: " + sub(r.avviso); };
          sw.addEventListener("click", () => { on = !on; upd(); }); se.addEventListener("change", upd); ta.addEventListener("input", upd);
          pv.append(when, b1); if (b2) pv.append(b2);
          bd.append(sl, se, tl, ta, el("p", "ex", r.consenso ? "Parte solo a chi ha dato il consenso." : priv() ? "Arriva solo a te." : "Può andare a tutti i clienti."), pv); c.append(h, bd); lst.append(c); upd(); });
        area.append(lst, el("p", "ex", "Nella versione vera i testi li decidiamo insieme. I messaggi per far tornare i clienti partono solo a chi ha dato il consenso."));
      }
      body.append(scegliSettore(() => { ix = 0; disegna(); }), tabs, area); disegna();
    }, () => { clearInterval(timer); });
  }

  /* ---------- 4. demo dell'assistente WhatsApp e telefono ---------- */
  function copione(tipo) {
    const n = nomeSett, cosa = /Ristorante|Bar |Cantina|B&B|viaggi/.test(n + " ") ? "prenotazione" : /Officina|edile|servizi|Trasporti/.test(n) ? "intervento" : "appuntamento";
    const att = priv() ? "Alessandro (esempio)" : altra() ? "la tua attività" : n.split(" / ")[0];
    const art = cosa === "prenotazione" ? "la prenotazione" : cosa === "intervento" ? "l'intervento" : "l'appuntamento";
    const giorno = /Ristorante|Bar /.test(n + " ") ? "sabato sera per 4 persone" : "giovedì mattina";
    const ore = /Ristorante|Bar /.test(n + " ") ? ["19:30", "21:00"] : ["9:30", "11:00"];
    const pres = "Ciao! Sono l'assistente virtuale di " + att + " (un programma, non una persona).";
    if (tipo === "chiamata") return [
      ["sis", "Telefono: chiamata non risposta alle 13:05 (eri occupato)"],
      ["as", pres + " Ho visto che hai chiamato e non siamo riusciti a rispondere. Come posso aiutarti?"],
      ["io", "Volevo sapere se si può fissare " + art + " la prossima settimana"],
      ["as", "Certo. Martedì ci sono " + ore[0] + " e " + ore[1] + ". Quale preferisci? Se vuoi parlare con una persona, scrivi «operatore»."],
      ["io", "Martedì alle " + ore[1]],
      ["as", "Fatto: " + art + " è segnato per martedì alle " + ore[1] + ". Il giorno prima ti arriva un promemoria."],
      ["sis", "In agenda: nuovo " + (cosa === "prenotazione" ? "posto prenotato" : cosa) + " · Nella lista di oggi: «chiamata persa, gestita»"]
    ];
    if (tipo === "domanda") return [
      ["io", sanita() ? "Buongiorno, quanto dura la prima visita e cosa devo portare?" : "Buongiorno, quali sono gli orari e come si prenota?"],
      ["as", pres + " " + (sanita() ? "La prima visita dura circa un'ora (esempio). Porta, se li hai, esami recenti e un documento. Per domande sulla salute ti risponde direttamente lo studio." : "Siamo aperti dal lunedì al sabato (orari di esempio). Puoi prenotare qui in chat, in pochi secondi.")],
      ["io", "Ok, grazie. Vorrei parlare con qualcuno"],
      ["as", "Va bene, passo la conversazione a una persona dello staff: ti risponde appena è libera. Intanto ho salvato la tua richiesta."],
      ["sis", "Avviso a chi lavora con te: «Cliente 1 vuole parlare con una persona» · conversazione già riassunta"]
    ];
    return [
      ["io", "Buonasera, avete posto " + giorno + "?"],
      ["as", pres + " Sì: ci sono " + ore[0] + " oppure " + ore[1] + ". Quale preferisci?"],
      ["io", ore[0] + ", grazie"],
      ["as", "Perfetto, ho segnato " + art + " " + giorno.replace(" per 4 persone", "") + " alle " + ore[0] + " a nome di Cliente 1. Ti arriva un promemoria il giorno prima. Per parlare con una persona scrivi «operatore»."],
      ["sis", "In agenda: nuov" + (cosa === "prenotazione" ? "a prenotazione" : "o " + cosa) + " alle " + ore[0] + " · Il titolare la vede la mattina dopo"]
    ];
  }
  function demoAss() {
    let tipo = "sera";
    apri("L'assistente che risponde per te", body => {
      const g = el("div", "ass-g"), chat = el("div", "chat"), lato = el("div", "ass-l"); chat.setAttribute("role", "log"); chat.setAttribute("aria-label", "Conversazione di esempio"); chat.setAttribute("aria-live", "polite");
      const punti = [["Dice subito di essere un assistente virtuale", /assistente virtuale/], ["Risponde anche la sera e quando sei occupato", /./], ["Propone orari liberi e prenota", /orari|ci sono|segnato|prenotare/i], ["Passa a una persona quando serve", /persona|operatore/i], ["Ti lascia tutto in ordine, senza ricopiare", /agenda|lista|avviso/i]];
      lato.append(el("h3", "", "Cosa fa l'assistente"));
      const ul = el("ul"); punti.forEach(([t]) => ul.append(el("li", "", t))); lato.append(ul, el("p", "ex", "Le regole (cosa può dire, quando passa a te) le decidiamo insieme. Puoi sempre leggere tutte le conversazioni."));
      const segna = testo => { [...ul.children].forEach((li, i) => { if (punti[i][1].test(testo)) li.classList.add("si"); }); };
      const gioca = () => { fermaTutto(); chat.replaceChildren(); [...ul.children].forEach(li => li.classList.remove("si")); let t = 300; let tutto = "";
        copione(tipo).forEach(([chi, x]) => { if (chi === "as") { dopo(() => { const s = el("div", "scrive"); s.setAttribute("aria-hidden", "true"); s.append(el("i"), el("i"), el("i")); chat.append(s); chat.scrollTop = chat.scrollHeight; }, t); t += 900; }
          dopo(() => { chat.querySelectorAll(".scrive").forEach(s => s.remove()); const m = el("div", "m " + (chi === "io" ? "io" : chi === "sis" ? "sis" : ""), x); chat.append(m); chat.scrollTop = chat.scrollHeight; tutto += " " + x; segna(tutto); }, t); t += chi === "io" ? 1100 : 1300; }); };
      const g1 = gruppo("Situazione", [["sera", "Messaggio la sera"], ["chiamata", "Chiamata persa"], ["domanda", "Domanda e passaggio a te"]], tipo, k => { tipo = k; gioca(); }); g1.querySelector("button").setAttribute("data-primo", "");
      const rif = btn("Rivedi da capo", "btn sec pic", gioca);
      g.append(chat, lato); body.append(scegliSettore(gioca), g1, g, rif); gioca();
    });
  }

  /* ---------- 5. demo della Video Factory: calendario dei contenuti ---------- */
  function contenuti() {
    const s = sett(), r = (SITO_TXT[nomeSett] || SITO_TXT["Altra attività"]).split("|"), sv = r[2].split(";"), cta = r[3];
    const tu = priv() ? "il mio progetto" : "noi";
    return [
      { g: 0, ora: "18:30", tipo: "Reel", t: "Come funziona: " + sv[0], h: "Come funziona davvero " + sv[0].toLowerCase() + "?", c: "In 30 secondi ti spieghiamo " + sv[0].toLowerCase() + ", passo per passo." },
      { g: 2, ora: "12:30", tipo: "Post", t: "3 cose da sapere prima di: " + cta.toLowerCase(), h: "3 cose da sapere prima di: " + cta.toLowerCase(), c: "Le domande che ci fate più spesso, con risposte brevi." },
      { g: 4, ora: "18:30", tipo: "Reel", t: "Dietro le quinte da " + tu, h: "Una giornata da " + tu + ", senza filtri", c: "Chi siamo e come lavoriamo, visto da dentro." },
      { g: 7, ora: "18:30", tipo: "Reel", t: sv[1] + ": la domanda più frequente", h: "La domanda che ci fanno tutti su " + sv[1].toLowerCase(), c: "Rispondiamo in un minuto, con parole semplici." },
      { g: 9, ora: "12:30", tipo: "Post", t: "Presentiamo: " + sv[2], h: sv[2] + ": cos'è e a chi serve", c: "Tutto quello che c'è da sapere, in una pagina." },
      { g: 11, ora: "18:30", tipo: "Reel", t: "Un consiglio veloce" + (s.L[0] ? " su " + s.L[0].toLowerCase() : ""), h: "Un consiglio che ti fa risparmiare tempo", c: "Salvalo: ti servirà." }
    ];
  }
  function demoVF() {
    let sel = 0; const stati = {};
    apri("Video Factory: il tuo calendario", body => {
      const g = el("div", "vf-g"), sx = el("div", ""), cal = el("div", "cal"), dx = el("div", ""), tel = el("div", "tel"), info = el("dl", "vf-info");
      const live = el("p", "sr"); live.setAttribute("aria-live", "polite");
      const GG = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
      const statoDi = (it, i) => stati[i] || (i < 2 ? "Pubblicato" : i === 3 ? "Da approvare" : "Programmato");
      const disegna = () => {
        const C = contenuti(); cal.replaceChildren(); GG.forEach(d => cal.append(el("span", "gg", d)));
        for (let d = 0; d < 14; d++) { const i = C.findIndex(x => x.g === d), giorno = GG[d % 7] + " " + (10 + d) + " nov";
          if (i < 0) { const v = el("div", "post vuoto"); v.append(el("span", "d", giorno), el("span", "t", "—")); v.setAttribute("aria-hidden", "true"); cal.append(v); continue; }
          const it = C[i], b = btn("", "post", () => { sel = i; mostra(); }); b.setAttribute("aria-pressed", String(i === sel)); if (i === 0) b.setAttribute("data-primo", "");
          b.setAttribute("aria-label", giorno + ", " + it.tipo + ": " + it.t + " (" + statoDi(it, i) + ")");
          const tp = el("span", "tipo" + (it.tipo === "Reel" ? " reel" : ""), it.tipo); b.append(el("span", "d", giorno + " · " + it.ora), tp, el("span", "t", it.t)); cal.append(b); }
        mostra();
      };
      const mostra = () => {
        const C = contenuti(), it = C[sel], st = statoDi(it, sel); cal.querySelectorAll("button.post").forEach((b, k) => b.setAttribute("aria-pressed", String(k === sel)));
        tel.replaceChildren(el("div", "sf")); const gan = el("div", "gancio"); gan.append(el("span", "", it.h)); const so = el("div", "sotto"); so.append(el("b", "", priv() ? "Il tuo profilo" : "Il profilo della tua attività"), el("span", "", it.c)); tel.append(gan, so, el("div", "bar"));
        tel.classList.remove("gira"); void tel.offsetWidth; if (it.tipo === "Reel") tel.classList.add("gira");
        info.replaceChildren(); [["Quando esce", GG[it.g % 7] + " " + (10 + it.g) + " novembre, alle " + it.ora], ["Tipo", it.tipo === "Reel" ? "Video verticale (reel) di 30-60 secondi" : "Post con immagini e testo"], ["Stato", st], ["Testo sotto il contenuto", it.c]].forEach(([a, b]) => info.append(el("dt", "", a), el("dd", "", b)));
        if (st === "Da approvare") { const ap = btn("Approva: può uscire", "btn pic", () => { stati[sel] = "Programmato"; live.textContent = "Approvato: uscirà da solo nel giorno e all'ora indicati."; disegna(); }); const dd = el("dd"); dd.style.marginTop = "12px"; dd.append(ap); info.append(dd); }
        live.textContent = it.t + ". Stato: " + st + ".";
      };
      sx.append(cal); dx.append(tel, info); g.append(sx, dx);
      body.append(scegliSettore(() => { sel = 0; disegna(); }), el("p", "ex", "Ecco come potrebbero essere due settimane di contenuti " + (priv() ? "per te" : "per " + chi()) + ": tocca un giorno per vedere l'anteprima. Niente esce senza il tuo ok; poi esce da solo, con costanza."), g, live);
      disegna();
    });
  }

  /* ---------- 6. demo dei fogli Excel e Google ---------- */
  function demoFogli() {
    apri("Il tuo foglio, messo in ordine", body => {
      const sv = (SITO_TXT[nomeSett] || SITO_TXT["Altra attività"]).split("|")[2].split(";");
      const righe = [["Cliente 1", "3/11", sv[0], "50", "sì"], ["Cliente 2", "04-11-2026", sv[1], "€ 80,00", ""], ["cliente 1 ", "3/11", sv[0], "50", "SI"], ["Cliente 3", "5 novembre", sv[2], "120 euro", "no"], ["Cliente 4", "06/11/26", sv[0], "50", "si"]];
      const passi = ["Tolgo i doppioni", "Sistemo le date", "Sistemo gli importi", "Segno chi deve pagare", "Calcolo i totali"];
      const w = el("div", "fg-w"), tab = el("table", "fg"), live = el("p", "sr"); live.setAttribute("aria-live", "polite");
      const cap = el("caption", "sr", "Foglio di esempio: clienti, date, servizi, importi e pagamenti"); tab.append(cap);
      const th = el("thead"), trh = el("tr"); ["Cliente", "Data", "Servizio", "Importo", "Pagato"].forEach(x => { const t = el("th", "", x); t.scope = "col"; trh.append(t); }); th.append(trh); tab.append(th);
      const tb = el("tbody"), tf = el("tfoot"); tab.append(tb, tf); w.append(tab);
      const ol = el("ol", "fg-pass"); passi.forEach(p => ol.append(el("li", "", p)));
      const disegna = () => { tb.replaceChildren(); tf.replaceChildren(); righe.forEach(r => { const tr = el("tr"); r.forEach(c => tr.append(el("td", "", c))); tb.append(tr); }); [...ol.children].forEach(li => li.classList.remove("fatto")); };
      const fai = () => { fermaTutto(); disegna(); vai.disabled = true; const trs = [...tb.children]; let t = 400;
        dopo(() => { trs[2].classList.add("dop"); live.textContent = passi[0]; ol.children[0].classList.add("fatto"); }, t); t += 900;
        dopo(() => { trs[2].classList.add("via"); }, t); t += 450; dopo(() => trs[2].remove(), t);
        const date = ["03/11/2026", "04/11/2026", null, "05/11/2026", "06/11/2026"], imp = [50, 80, null, 120, 50], pag = ["Sì", "No", null, "No", "Sì"];
        t += 300; dopo(() => { trs.forEach((tr, i) => { if (date[i]) { tr.children[1].textContent = date[i]; tr.children[1].className = "ok"; } }); ol.children[1].classList.add("fatto"); live.textContent = passi[1]; }, t); t += 900;
        dopo(() => { trs.forEach((tr, i) => { if (imp[i] != null) { tr.children[3].textContent = "€ " + imp[i] + ",00"; tr.children[3].className = "ok"; tr.children[1].className = ""; } }); ol.children[2].classList.add("fatto"); live.textContent = passi[2]; }, t); t += 900;
        dopo(() => { trs.forEach((tr, i) => { if (pag[i]) { tr.children[3].className = ""; tr.children[4].textContent = pag[i]; tr.children[4].className = pag[i] === "No" ? "err" : "ok"; } }); ol.children[3].classList.add("fatto"); live.textContent = passi[3]; }, t); t += 900;
        dopo(() => { const tr = el("tr"); tr.append(el("td", "", "Totale"), el("td", "", ""), el("td", "", ""), el("td", "", "€ 300,00"), el("td", "", "Da incassare € 200,00")); tf.append(tr); ol.children[4].classList.add("fatto"); live.textContent = passi[4] + ". Fatto: il foglio è in ordine."; vai.disabled = false; vai.textContent = "Rifai da capo"; fine.hidden = false; }, t);
      };
      const vai = btn("Metti in ordine", "btn pic", () => { fine.hidden = true; fai(); }); vai.setAttribute("data-primo", "");
      const fine = el("p", "ex", "Da qui si può fare un passo in più: ogni lunedì ti arriva il riepilogo e chi deve pagare riceve un promemoria gentile, da solo."); fine.hidden = true;
      body.append(scegliSettore(() => { fermaTutto(); vai.disabled = false; vai.textContent = "Metti in ordine"; fine.hidden = true; apriDi("fogli"); }), el("p", "ex", "Un foglio come tanti: doppioni, date scritte in modi diversi, importi a parole. Premi il pulsante e guarda cosa succede."), ol, w, vai, fine, live);
      disegna();
    });
  }

  const DEMO = { sito: demoSito, gest: demoGest, auto: demoAuto, ass: demoAss, vf: demoVF, fogli: demoFogli };
  function apriDi(k) { if (DEMO[k]) DEMO[k](); }
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-demo]"); if (!b) return; e.preventDefault(); apriDi(b.getAttribute("data-demo")); });
  sincronizza();
  window.AM_DEMO = { apri: apriDi, chiudi, settore: () => nomeSett };
})();
