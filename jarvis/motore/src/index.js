// Motore Jarvis: scraper e ricerca web gratuiti su Cloudflare Workers (piano Free).
// Comandi (GET, risposta JSON):
//   /leggi?url=...&js=auto|si|no&max=60000   pagina in Markdown + email, telefoni, social, link
//   /cerca?q=...&n=10                        ricerca web (DuckDuckGo, poi Bing, poi Mojeek)
//   /mappa?url=...                           elenco pagine del sito (sitemap + link della home)
//   /sito?url=...&max=15                     legge più pagine dello stesso sito in un colpo
//   /salute                                  controllo che il motore sia acceso
// Se è impostato il segreto CHIAVE, ogni chiamata deve avere &k=<chiave>.
import puppeteer from "@cloudflare/puppeteer";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const HDR = { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "it-IT,it;q=0.9,en;q=0.8" };
const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const p = u.searchParams;
    if (req.method === "OPTIONS") return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Headers": "*" } });
    if (env.CHIAVE && p.get("k") !== env.CHIAVE) return json({ ok: false, errore: "Chiave mancante o sbagliata" }, 401);
    try {
      switch (u.pathname.replace(/\/+$/, "") || "/") {
        case "/salute": return json({ ok: true, motore: "motore-jarvis", ora: new Date().toISOString() });
        case "/leggi": {
          const url = norm(p.get("url"));
          if (!url) return json({ ok: false, errore: "Manca url. Esempio: /leggi?url=https://sito.it" }, 400);
          return json(await leggi(url, env, p.get("js") || "auto", Number(p.get("max")) || 60000));
        }
        case "/cerca": {
          const q = (p.get("q") || "").trim();
          if (!q) return json({ ok: false, errore: "Manca q. Esempio: /cerca?q=barberia foggia" }, 400);
          return json(await cerca(q, Math.min(Number(p.get("n")) || 10, 30)));
        }
        case "/mappa": {
          const url = norm(p.get("url"));
          if (!url) return json({ ok: false, errore: "Manca url" }, 400);
          return json(await mappa(url));
        }
        case "/sito": {
          const url = norm(p.get("url"));
          if (!url) return json({ ok: false, errore: "Manca url" }, 400);
          return json(await sito(url, env, Math.min(Number(p.get("max")) || 15, 30), Number(p.get("maxpagina")) || 15000));
        }
        default:
          return json({ ok: true, comandi: ["/leggi?url=", "/cerca?q=", "/mappa?url=", "/sito?url=&max=15", "/salute"] });
      }
    } catch (e) {
      return json({ ok: false, errore: String(e && e.message || e) }, 500);
    }
  },
};

function norm(u) {
  u = String(u || "").trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : "https://" + u;
}

async function scarica(url, ms = 15000) {
  const r = await fetch(url, { headers: HDR, redirect: "follow", signal: AbortSignal.timeout(ms) });
  const tipo = r.headers.get("content-type") || "";
  const testo = await r.text();
  return { stato: r.status, finale: r.url || url, tipo, testo };
}

// ---------- LEGGI ----------
async function leggi(url, env, js = "auto", max = 60000) {
  let risultato = null, nota;
  if (js !== "si") {
    try {
      const r = await scarica(url);
      if (/json/.test(r.tipo)) return { ok: r.stato < 400, url, stato_http: r.stato, fonte: "diretto", tipo: "json", markdown: r.testo.slice(0, max) };
      risultato = analizza(r.testo, r.finale, max);
      risultato.stato_http = r.stato;
      risultato.ok = r.stato < 400;
      risultato.fonte = "diretto";
    } catch (e) { nota = "Lettura diretta fallita: " + e.message; }
  }
  const serveJs = js === "si" || !risultato || risultato.serve_browser || [403, 429, 503].includes(risultato.stato_http);
  if (serveJs && js !== "no" && env.BROWSER) {
    try {
      const html = await conBrowser(env, url);
      const r2 = analizza(html, url, max);
      if (!risultato || r2.caratteri > risultato.caratteri) {
        r2.ok = r2.caratteri > 0; r2.fonte = "browser"; r2.stato_http = risultato ? risultato.stato_http : null;
        if (risultato) { r2.email = unici([...risultato.email, ...r2.email]); r2.telefoni = unici([...risultato.telefoni, ...r2.telefoni]); }
        risultato = r2;
      }
    } catch (e) { nota = "Browser non disponibile ora (limite gratuito 10 min/giorno?): " + e.message; }
  }
  if (!risultato) return { ok: false, url, errore: nota || "Pagina non leggibile" };
  if (nota) risultato.nota = nota;
  if (risultato.serve_browser) risultato.consiglio = "Pagina quasi vuota o protetta: usare il browser integrato o Scrapling sul PC.";
  return risultato;
}

async function conBrowser(env, url) {
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.setExtraHTTPHeaders({ "Accept-Language": "it-IT,it;q=0.9" });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 }).catch(() => {});
    await page.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 800)); }).catch(() => {});
    return await page.content();
  } finally {
    await browser.close();
  }
}

const unici = (a) => [...new Set(a.filter(Boolean))];
const dec = (s) => String(s)
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'").replace(/&agrave;/g, "à").replace(/&egrave;/g, "è")
  .replace(/&eacute;/g, "é").replace(/&igrave;/g, "ì").replace(/&ograve;/g, "ò").replace(/&ugrave;/g, "ù").replace(/&euro;/g, "€")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
const abs = (h, base) => { try { const x = dec(h).trim(); if (!x || x.startsWith("#") || /^javascript:/i.test(x)) return ""; return new URL(x, base).href; } catch { return ""; } };
const RE_SOCIAL = /instagram\.com|facebook\.com|tiktok\.com|linkedin\.com|youtube\.com|wa\.me|whatsapp\.com|x\.com\/|twitter\.com/i;
const RE_FILE = /\.(png|jpe?g|webp|gif|svg|ico|css|js|woff2?|ttf|mp4|webm)(\?|$)/i;
const RE_TEL = /(?<![\d+])(?:\+39[\s.]?)?(?:3\d{2}|0[1-9]\d{0,2})[\s./-]?\d{3,4}[\s./-]?\d{3,4}(?!\d)/g;

function analizza(html, base, max = 60000) {
  html = String(html || "");
  const pick = (re) => { const m = html.match(re); return m ? m[1].trim() : ""; };
  const meta = (n) => dec(pick(new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]+content=["']([^"']*)["']`, "i")) || pick(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${n}["']`, "i")));
  const titolo = dec(pick(/<title[^>]*>([\s\S]*?)<\/title>/i)).replace(/\s+/g, " ").trim() || meta("og:title");
  const descrizione = meta("description") || meta("og:description");
  const immagine = meta("og:image");

  // dati strutturati (indirizzo, orari, telefono delle attività locali)
  const strutturati = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { strutturati.push(JSON.parse(m[1].trim())); } catch {}
  }

  const body = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, "");
  const links = [];
  for (const m of body.matchAll(/<a\b[^>]*?href=["']([^"']+)["']/gi)) { const x = abs(m[1], base); if (x) links.push(x); }
  const tutti = unici(links);
  const host = hostOf(base);
  const interni = tutti.filter(l => /^https?:/.test(l) && hostOf(l) === host && !RE_FILE.test(l)).map(l => l.replace(/#.*$/, ""));
  const esterni = tutti.filter(l => /^https?:/.test(l) && hostOf(l) !== host && !RE_FILE.test(l));

  let md = body
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => "\n\n" + "#".repeat(+n) + " " + t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() + "\n\n")
    .replace(/<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => { const tx = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); const x = abs(h, base); return tx ? (x ? `[${tx}](${x})` : tx) : ""; })
    .replace(/<img\b[^>]*?alt=["']([^"']+)["'][^>]*>/gi, (_, a) => ` (immagine: ${a}) `)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${t.replace(/<[^>]+>/g, " ").trim()}**`)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|ul|ol|table|tr|h[1-6]|blockquote|main|nav|form|pre)>/gi, "\n\n")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
  md = dec(md).replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").replace(/\*\*\s*\*\*/g, "").trim();

  const piatto = md.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  const email = unici([
    ...(html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []),
    ...tutti.filter(l => l.startsWith("mailto:")).map(l => decodeURIComponent(l.slice(7).split("?")[0])),
  ].map(e => e.toLowerCase().trim()).filter(e => !RE_FILE.test(e) && !/sentry|wixpress|example\.|@2x|domain\.com/.test(e)));
  const telefoni = unici([
    ...(piatto.match(RE_TEL) || []),
    ...(JSON.stringify(strutturati).match(RE_TEL) || []),
    ...tutti.filter(l => l.startsWith("tel:")).map(l => decodeURIComponent(l.slice(4))),
    ...tutti.filter(l => /wa\.me\/|api\.whatsapp\.com\/send\?phone=/.test(l)).map(l => (l.match(/(?:wa\.me\/|phone=)\+?(\d{8,15})/) || [])[1]),
  ].filter(Boolean).map(t => t.replace(/[\s./()-]/g, "").replace(/^(\+|00)?39(?=\d{9,10}$)/, "")).filter(t => t.length >= 9 && t.length <= 13));

  return {
    url: base, titolo, descrizione, immagine,
    caratteri: piatto.length,
    serve_browser: piatto.length < 400,
    markdown: md.slice(0, max), troncato: md.length > max,
    email, telefoni,
    social: unici(esterni.filter(l => RE_SOCIAL.test(l))),
    link_interni: unici(interni).slice(0, 300),
    link_esterni: esterni.slice(0, 200),
    dati_strutturati: strutturati.slice(0, 5),
    letto_il: new Date().toISOString(),
  };
}

// ---------- CERCA ----------
async function cerca(q, n) {
  const motori = [cercaDDG, cercaBing, cercaMojeek];
  const errori = [];
  for (const m of motori) {
    try {
      const r = await m(q);
      if (r.length) return { ok: true, q, motore: m.name.replace("cerca", "").toLowerCase(), risultati: r.slice(0, n) };
      errori.push(m.name + ": nessun risultato");
    } catch (e) { errori.push(m.name + ": " + e.message); }
  }
  return { ok: false, q, risultati: [], errori };
}
const pulisci = (s) => dec(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function cercaDDG(q) {
  const r = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { ...HDR, "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://html.duckduckgo.com/" },
    body: "q=" + encodeURIComponent(q) + "&kl=it-it",
    signal: AbortSignal.timeout(12000),
  });
  const h = await r.text();
  const out = [];
  for (const blocco of h.split(/class="result results_links/).slice(1)) {
    const a = blocco.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    let link = dec(a[1]);
    const ud = link.match(/[?&]uddg=([^&]+)/);
    if (ud) link = decodeURIComponent(ud[1]);
    if (/duckduckgo\.com\/y\.js|ad_domain/.test(link)) continue;
    const sn = blocco.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    out.push({ titolo: pulisci(a[2]), url: link.startsWith("//") ? "https:" + link : link, estratto: pulisci(sn && sn[1]) });
  }
  return out;
}

async function cercaBing(q) {
  const r = await fetch("https://www.bing.com/search?setlang=it&cc=IT&q=" + encodeURIComponent(q), { headers: HDR, signal: AbortSignal.timeout(12000) });
  const h = await r.text();
  const out = [];
  for (const blocco of h.split(/<li class="b_algo"/).slice(1)) {
    const a = blocco.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    let link = dec(a[1]);
    const enc = link.match(/[?&]u=a1([^&]+)/);
    if (enc) { try { link = atob(enc[1].replace(/-/g, "+").replace(/_/g, "/")); } catch {} }
    const sn = blocco.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    out.push({ titolo: pulisci(a[2]), url: link, estratto: pulisci(sn && sn[1]) });
  }
  return out;
}

async function cercaMojeek(q) {
  const r = await fetch("https://www.mojeek.com/search?lb=it&q=" + encodeURIComponent(q), { headers: HDR, signal: AbortSignal.timeout(12000) });
  const h = await r.text();
  const out = [];
  for (const blocco of h.split(/<li class="r\d*"|<li class="result"/).slice(1)) {
    const a = blocco.match(/<a[^>]+class="ob"[^>]+href="([^"]+)"/) || blocco.match(/<h2>\s*<a[^>]+href="([^"]+)"[^>]*>/);
    const t = blocco.match(/<h2>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const sn = blocco.match(/<p class="s">([\s\S]*?)<\/p>/);
    out.push({ titolo: pulisci(t && t[1]), url: dec(a[1]), estratto: pulisci(sn && sn[1]) });
  }
  return out;
}

// ---------- MAPPA E SITO ----------
async function mappa(url) {
  const origine = new URL(url).origin;
  const host = hostOf(url);
  const trovate = new Set();
  let sitemaps = [origine + "/sitemap.xml", origine + "/sitemap_index.xml"];
  try {
    const robots = await scarica(origine + "/robots.txt", 8000);
    const dichiarate = [...robots.testo.matchAll(/^sitemap:\s*(\S+)/gim)].map(m => m[1]);
    if (dichiarate.length) sitemaps = unici([...dichiarate, ...sitemaps]);
  } catch {}
  let lette = 0;
  for (let i = 0; i < sitemaps.length && lette < 8; i++) {
    try {
      lette++;
      const s = await scarica(sitemaps[i], 10000);
      if (s.stato >= 400 || !/<(urlset|sitemapindex)/i.test(s.testo)) continue;
      for (const m of s.testo.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        const loc = dec(m[1]);
        if (/\.xml(\.gz)?$/i.test(loc)) { if (!sitemaps.includes(loc)) sitemaps.push(loc); }
        else if (hostOf(loc) === host) trovate.add(loc);
      }
    } catch {}
  }
  const daSitemap = trovate.size;
  try {
    const home = await scarica(url);
    for (const l of analizza(home.testo, home.finale, 1000).link_interni) trovate.add(l);
  } catch {}
  return { ok: trovate.size > 0, url, pagine: [...trovate].slice(0, 1000), totale: trovate.size, da_sitemap: daSitemap };
}

async function sito(url, env, max, maxPagina) {
  const m = await mappa(url);
  const elenco = unici([url, ...m.pagine]).slice(0, max);
  const pagine = [];
  // a gruppi di 5 per non pesare sul sito e restare nei limiti gratuiti (50 richieste per chiamata)
  for (let i = 0; i < elenco.length; i += 5) {
    const gruppo = await Promise.all(elenco.slice(i, i + 5).map(u => leggi(u, env, "no", maxPagina).catch(e => ({ ok: false, url: u, errore: e.message }))));
    pagine.push(...gruppo);
  }
  const vuote = pagine.filter(p => p.serve_browser).map(p => p.url);
  return {
    ok: pagine.some(p => p.ok), url, pagine_totali_sito: m.totale, lette: pagine.length,
    email: unici(pagine.flatMap(p => p.email || [])),
    telefoni: unici(pagine.flatMap(p => p.telefoni || [])),
    social: unici(pagine.flatMap(p => p.social || [])),
    pagine_js_da_rileggere: vuote,
    pagine: pagine.map(p => ({ url: p.url, titolo: p.titolo, caratteri: p.caratteri, markdown: p.markdown, errore: p.errore })),
  };
}
