/* COLLAUDO DEL SITO (non va online). Uso dalla radice del repo:  node test-sito/collaudo.cjs
   Vedi test-sito/LEGGIMI.md. Esce con errore se anche un solo controllo fallisce. */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), { spawn } = require("child_process");
const RADICE = path.join(__dirname, "..");
const PORTA = Number(process.env.PORTA || 8812), BASE = `http://localhost:${PORTA}/`;
const SHOT = process.env.SHOT_DIR || path.join(require("os").tmpdir(), "collaudo-sito"); fs.mkdirSync(SHOT, { recursive: true });
const LARGHEZZE = [320, 390, 768, 1280, 1440];
const PROVA_URL = "https://calendar.app.google/ProvaCollaudo123";
let ok = 0, ko = 0; const errori = [];
const verifica = (nome, cond, info = "") => { if (cond) ok++; else { ko++; errori.push(nome + (info ? " → " + info : "")); console.log("   FAIL " + nome + (info ? " → " + info : "")); } };
const axePath = [path.join(__dirname, "node_modules/axe-core/axe.min.js"), path.join(RADICE, "questionario/test/node_modules/axe-core/axe.min.js")].find(f => fs.existsSync(f));
const AXE = axePath ? fs.readFileSync(axePath, "utf8") : null;
const settori = (() => { const ctx = {}; require("vm").runInNewContext(fs.readFileSync(path.join(RADICE, "comune/settori.js"), "utf8") + ";this.S=SETTORI.map(s=>s.n)", ctx); return ctx.S; })();
const pagine = [...fs.readFileSync(path.join(RADICE, "sitemap.xml"), "utf8").matchAll(/<loc>https:\/\/alessandromauroworks\.it\/([^<]*)<\/loc>/g)].map(m => m[1]);
const DEMO = ["sito", "gest", "auto", "ass", "vf", "fogli"];

async function nuova(b, w, opz = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 700 ? 800 : 900 }, deviceScaleFactor: 1, reducedMotion: opz.ridotto ? "reduce" : "no-preference" });
  await ctx.route("**/*", r => { const u = r.request().url(); if (!u.startsWith(BASE)) return r.abort(); if (opz.prenota && u.includes("comune/config.js")) return r.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(RADICE, "comune/config.js"), "utf8").replace('const PRENOTA_URL = "";', `const PRENOTA_URL = "${opz.prenota}";`) }); return r.continue(); });
  const p = await ctx.newPage(); p.errs = [];
  p.on("console", m => { if (m.type() === "error" && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
  p.on("pageerror", e => p.errs.push(e.message));
  return p;
}
const scorri = p => p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 350) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });

(async () => {
  const srv = spawn("python3", ["-m", "http.server", String(PORTA)], { cwd: RADICE, stdio: "ignore" });
  await new Promise(r => setTimeout(r, 900));
  const b = await chromium.launch();
  try {
    /* 1. tutte le pagine a tutte le larghezze: niente scroll di lato, zero errori, accessibilità */
    console.log("1. Pagine e larghezze");
    const tutte = [...pagine, "strumenti/", "404.html"];
    for (const w of LARGHEZZE) for (const pg of tutte) {
      const p = await nuova(b, w); const r = await p.goto(BASE + pg); await scorri(p); await p.waitForTimeout(150);
      verifica(`${w} /${pg} si apre`, r && r.status() === 200, String(r && r.status()));
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      verifica(`${w} /${pg} niente scroll di lato`, sw <= w, "larghezza " + sw);
      verifica(`${w} /${pg} zero errori in console`, p.errs.length === 0, p.errs.join(" | "));
      if (AXE && (w === 390 || w === 1280)) {
        await p.evaluate(() => Promise.race([Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, 6000))])); /* contrasto misurato a animazioni finite */
        await p.addScriptTag({ content: AXE });
        const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations.filter(x => x.impact === "serious" || x.impact === "critical").map(x => x.id + "(" + x.nodes.length + ")"));
        verifica(`${w} /${pg} accessibilità: 0 problemi seri`, v.length === 0, v.join(", "));
      }
      if (w === 1280 && !pg.endsWith(".html")) {
        verifica(`/${pg} un solo h1`, (await p.locator("h1").count()) === 1);
        verifica(`/${pg} niente scritta Lovable`, !/lovable/i.test(await p.content()));
      }
      await p.context().close();
    }
    if (!AXE) verifica("axe-core installato", false, "manca: cd test-sito && npm install");

    /* 2. link interni: tutti esistono, anche le ancore */
    console.log("2. Link interni");
    { const p = await nuova(b, 1280); const visti = new Set(); let n = 0;
      for (const pg of [...pagine, "strumenti/"]) { await p.goto(BASE + pg);
        const hrefs = await p.evaluate(() => [...document.querySelectorAll("a[href]")].map(a => a.href));
        for (const h of hrefs) { if (!h.startsWith(BASE)) continue; const [u, anc] = h.split("#"); const k = u + "#" + (anc || "");
          if (visti.has(k)) continue; visti.add(k); n++;
          const r = await p.request.get(u); verifica(`link ${h.replace(BASE, "/")} (da /${pg})`, r.status() === 200, String(r.status()));
          if (anc) { const q = await (await p.context().newPage()); await q.goto(u); verifica(`ancora #${anc} esiste in ${u.replace(BASE, "/")}`, (await q.locator("#" + anc).count()) === 1); await q.close(); } } }
      await p.goto(BASE); const est = await p.evaluate(() => [...document.querySelectorAll("a[href^='https://wa.me/393394052935']")].length);
      verifica("link WhatsApp presenti", est > 0); console.log("   link controllati:", n);
      await p.context().close(); }

    /* 3. tutte le demo con tutti i settori: apri, usa, chiudi (Esc, X, tastiera) */
    console.log("3. Demo per ogni settore");
    for (const w of [390, 1280]) {
      const p = await nuova(b, w); await p.goto(BASE + "demo/"); let i = 0;
      for (const s of settori) {
        await p.selectOption("#settDemo", s);
        for (const d of DEMO) {
          const btn = p.locator(`.demos [data-demo="${d}"]`);
          const modo = i++ % 3;
          if (modo === 2) { await btn.focus(); await p.keyboard.press("Enter"); } else await btn.click();
          await p.waitForSelector("dialog.dlg[open]", { timeout: 3000 }).catch(() => {});
          const aperta = await p.locator("dialog.dlg[open]").count() === 1;
          verifica(`${w} demo ${d} · ${s}: si apre`, aperta);
          if (!aperta) continue;
          const info = await p.evaluate(() => { const box = document.querySelector(".dlg-box"); return { tag: !!document.querySelector(".dlg-b .esempio"), sett: (document.querySelector(".dlg-b select[data-settore]") || {}).value, larga: box.scrollWidth > box.clientWidth + 1, pag: document.documentElement.scrollWidth } ; });
          verifica(`${w} demo ${d} · ${s}: etichetta «Esempio con dati inventati»`, info.tag);
          verifica(`${w} demo ${d} · ${s}: settore giusto dentro la demo`, info.sett === s, String(info.sett));
          verifica(`${w} demo ${d} · ${s}: niente scroll di lato`, !info.larga && info.pag <= w);
          if (w === 1280) { /* un'azione per demo */
            if (d === "sito") { await p.locator(".dlg-b .chip", { hasText: "Telefono" }).click(); await p.locator(".dlg-b .chip", { hasText: "Effetto wow" }).click(); await p.fill("#dNome", "Prova"); verifica(`demo sito · ${s}: nome scritto compare`, await p.locator(".sd-logo", { hasText: "Prova" }).count() === 1); }
            if (d === "gest") { await p.locator(".gp-nav button").nth(1).click(); verifica(`demo gest · ${s}: modulo aperto`, await p.locator(".gp-main .gp-t [role=row]").count() >= 5); }
            if (d === "auto") { await p.locator(".dlg-b .chip", { hasText: "Le regole" }).click(); const sw = p.locator(".rl .sw").first(); await sw.click(); verifica(`demo auto · ${s}: regola spenta`, (await sw.getAttribute("aria-checked")) === "false"); }
            if (d === "ass") { await p.waitForFunction(() => /assistente virtuale/.test((document.querySelector(".chat") || {}).innerText || ""), null, { timeout: 6000 }).catch(() => {}); verifica(`demo ass · ${s}: la chat parte e si dichiara assistente virtuale`, /assistente virtuale/.test(await p.locator(".chat").innerText())); }
            if (d === "vf") { await p.locator(".cal button.post").nth(1).click(); verifica(`demo vf · ${s}: anteprima aggiornata`, (await p.locator(".cal button.post").nth(1).getAttribute("aria-pressed")) === "true"); }
            if (d === "fogli") { await p.locator(".dlg-b .btn", { hasText: "Metti in ordine" }).click(); await p.waitForTimeout(5200); verifica(`demo fogli · ${s}: totale calcolato`, await p.locator(".fg tfoot td", { hasText: "€ 300,00" }).count() === 1); }
          }
          const chiusura = i % 3;
          if (chiusura === 0) await p.keyboard.press("Escape");
          else if (chiusura === 1) await p.locator(".dlg-x").click();
          else { await p.locator(".dlg-x").focus(); await p.keyboard.press("Enter"); }
          await p.waitForFunction(() => !document.querySelector("dialog.dlg[open]"), null, { timeout: 2000 }).catch(() => {});
          verifica(`${w} demo ${d} · ${s}: si chiude (${["Esc", "clic sulla X", "tastiera"][chiusura]})`, await p.locator("dialog.dlg[open]").count() === 0);
          verifica(`${w} demo ${d} · ${s}: il focus torna al pulsante`, await p.evaluate(k => document.activeElement && document.activeElement.getAttribute("data-demo") === k, d));
        }
      }
      verifica(`${w} demo: zero errori in console`, p.errs.length === 0, p.errs.slice(0, 3).join(" | "));
      await p.context().close();
    }
    /* il pulsante «Prova la demo» di ogni pagina servizio apre la demo giusta */
    for (const pg of pagine.filter(x => x.startsWith("servizi/") && x !== "servizi/")) {
      const p = await nuova(b, 390); await p.goto(BASE + pg); await p.locator(".hero [data-demo]").click();
      verifica(`/${pg}: «Prova la demo» apre la finestra`, await p.locator("dialog.dlg[open]").count() === 1);
      await p.keyboard.press("Escape"); await p.waitForTimeout(300); await p.context().close();
    }

    /* 4. menu del telefono, tastiera, salta al contenuto */
    console.log("4. Menu e tastiera");
    { const p = await nuova(b, 390); await p.goto(BASE);
      await p.click(".hamb"); verifica("menu telefono si apre", await p.locator("#menu").isVisible());
      await p.keyboard.press("Escape"); verifica("menu telefono si chiude con Esc", !(await p.locator("#menu").isVisible()));
      await p.goto(BASE); await p.keyboard.press("Tab"); verifica("primo Tab: «Vai al contenuto»", await p.evaluate(() => document.activeElement.classList.contains("salta")));
      await p.context().close(); }

    /* 5. movimento ridotto: tutto visibile subito */
    console.log("5. Movimento ridotto");
    { const p = await nuova(b, 390, { ridotto: true }); await p.goto(BASE); await p.waitForTimeout(300);
      verifica("ridotto: nessuna animazione di comparsa", !(await p.evaluate(() => document.documentElement.classList.contains("anim"))));
      const op = await p.evaluate(() => [...document.querySelectorAll(".rv,.bolla")].map(e => getComputedStyle(e).opacity).filter(o => o !== "1").length);
      verifica("ridotto: tutto visibile subito", op === 0, op + " elementi trasparenti");
      await p.click("[data-demo=auto]"); verifica("ridotto: la demo si apre", await p.locator("dialog.dlg[open]").count() === 1);
      await p.context().close(); }

    /* 6. velocità: prima schermata < 2 s con CPU rallentata 4 volte */
    console.log("6. Velocità");
    for (const pg of ["", "servizi/automazioni/"]) { const p = await nuova(b, 390); const cdp = await p.context().newCDPSession(p);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); await p.goto(BASE + pg, { waitUntil: "load" });
      const fcp = await p.evaluate(() => new Promise(r => { const e = performance.getEntriesByName("first-contentful-paint")[0]; if (e) return r(e.startTime); new PerformanceObserver(l => r(l.getEntries()[0].startTime)).observe({ type: "paint", buffered: true }); }));
      verifica(`/${pg} prima schermata < 2 s (CPU 4x): ${Math.round(fcp)} ms`, fcp < 2000); await p.context().close(); }

    /* 7. prenotazione: link vuoto e link di prova */
    console.log("7. Prenota una call");
    { const p = await nuova(b, 390); await p.goto(BASE + "prenota/");
      verifica("PRENOTA_URL vuoto: pulsante calendario nascosto", !(await p.locator("[data-prenota-diretto]").isVisible()));
      verifica("PRENOTA_URL vuoto: propone WhatsApp ed email", await p.locator("[data-se-no-prenota] a[href^='https://wa.me/393394052935']").isVisible() && await p.locator("[data-se-no-prenota] a[href^='mailto:alessandromauro.works@gmail.com']").isVisible());
      verifica("percorso consigliato: questionario veloce", await p.locator(".scelta.top a[href='../questionario/?veloce=1']").count() === 1);
      const hrefs = await p.evaluate(() => [...document.querySelectorAll("a")].filter(a => a.offsetParent).map(a => a.getAttribute("href")));
      verifica("PRENOTA_URL vuoto: nessun link vuoto o rotto", hrefs.every(h => h && h !== "#" && !/undefined|null/.test(h)), hrefs.join(" "));
      await p.goto(BASE + "questionario/?veloce=1"); await p.waitForTimeout(400);
      verifica("questionario ?veloce=1 apre la versione veloce", await p.evaluate(() => { try { return JSON.stringify(A).includes('"veloce":true'); } catch (e) { return document.body.innerText.includes("veloce"); } }));
      verifica("questionario senza errori", p.errs.length === 0, p.errs.join(" | ")); await p.context().close(); }
    { const p = await nuova(b, 390, { prenota: PROVA_URL }); await p.goto(BASE + "prenota/");
      const a = p.locator("[data-prenota-diretto]");
      verifica("con link di prova: pulsante calendario visibile", await a.isVisible());
      verifica("con link di prova: porta al calendario in una nuova scheda", (await a.getAttribute("href")) === PROVA_URL && (await a.getAttribute("target")) === "_blank");
      verifica("con link di prova: WhatsApp/email non più in primo piano", !(await p.locator("[data-se-no-prenota]").isVisible()));
      await p.goto(BASE + "questionario/"); await p.waitForTimeout(300);
      verifica("con link di prova: il questionario legge lo stesso link", await p.evaluate(u => typeof PRENOTA_URL === "string" && PRENOTA_URL === u, PROVA_URL));
      verifica("con link di prova: zero errori", p.errs.length === 0, p.errs.join(" | ")); await p.context().close(); }

    /* 8. SEO di base */
    console.log("8. SEO");
    for (const pg of pagine) { const p = await nuova(b, 1280); await p.goto(BASE + pg);
      const m = await p.evaluate(() => ({ t: document.title, d: (document.querySelector("meta[name=description]") || {}).content, c: (document.querySelector("link[rel=canonical]") || {}).href, og: !!document.querySelector("meta[property='og:image']"), ico: !!document.querySelector("link[rel=icon]"), lang: document.documentElement.lang }));
      verifica(`/${pg} title e description`, m.t.length > 5 && m.t.length < 90 && m.d && m.d.length > 50 && m.d.length < 200, m.t.length + "/" + (m.d || "").length);
      verifica(`/${pg} canonical, Open Graph, favicon, lingua`, m.c === "https://alessandromauroworks.it/" + pg && m.og && m.ico && m.lang === "it");
      await p.context().close(); }
    { const r = fs.readFileSync(path.join(RADICE, "robots.txt"), "utf8"); verifica("robots: sitemap e strumenti esclusi", /Sitemap: https:\/\/alessandromauroworks\.it\/sitemap\.xml/.test(r) && /Disallow: \/strumenti\//.test(r)); }
    { const p = await nuova(b, 390); for (const pg of ["strumenti/", "questionario/", "analizza/"]) { await p.goto(BASE + pg); verifica(`/${pg} non indicizzata (noindex)`, /noindex/.test(await p.evaluate(() => (document.querySelector("meta[name=robots]") || {}).content || ""))); } await p.context().close(); }

    /* 9. screenshot da guardare */
    console.log("9. Screenshot in " + SHOT);
    for (const w of [390, 1280]) {
      const p = await nuova(b, w);
      for (const [pg, n] of [["", "home"], ["servizi/automazioni/", "servizio-automazioni"], ["prenota/", "prenota"]]) { await p.goto(BASE + pg); await scorri(p); await p.waitForTimeout(3600); await p.screenshot({ path: path.join(SHOT, `${n}-${w}.png`), fullPage: true }); }
      await p.goto(BASE + "demo/"); await p.selectOption("#settDemo", "Ristorante / pizzeria");
      for (const d of DEMO) { await p.click(`.demos [data-demo="${d}"]`); await p.waitForTimeout(d === "ass" ? 5200 : d === "fogli" ? 300 : 1200); if (d === "fogli") { await p.locator(".dlg-b .btn", { hasText: "Metti in ordine" }).click(); await p.waitForTimeout(5200); } if (d === "auto") { await p.locator(".dlg-b .btn", { hasText: "Riproduci" }).click(); await p.waitForTimeout(2800); }
        await p.screenshot({ path: path.join(SHOT, `demo-${d}-${w}.png`) }); await p.keyboard.press("Escape"); await p.waitForTimeout(300); }
      await p.context().close();
    }
  } finally { await b.close(); srv.kill(); }
  console.log(`\nTOTALE: ${ok + ko} controlli, ${ok} passati, ${ko} falliti`);
  if (ko) { console.log(errori.slice(0, 40).join("\n")); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
