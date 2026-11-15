/* GENERATORE DEL SITO di Alessandro Mauro.
   Scrive le pagine HTML statiche (già pronte, niente build per GitHub Pages) partendo dai testi qui sotto,
   così testata, menu e piè di pagina sono uguali ovunque.
   Uso, dalla radice del repo:   node sorgente-sito/genera.mjs
   Poi si fa il commit dei file HTML generati. Testi e servizi si cambiano in sorgente-sito/testi.mjs.
   Contatti, partita IVA e link di prenotazione stanno in comune/config.js (unica fonte). */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { SERVIZI, BISOGNI, PASSI_LAVORO, FAQ_HOME, PERCHE } from "./testi.mjs";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOMINIO = "https://alessandromauroworks.it/";
const OGGI = "15 novembre 2026";
const V = "20261115"; // versione dei file comuni (cambiarla quando cambiano css/js, così i browser li ricaricano)

/* contatti dal file condiviso comune/config.js */
const cfg = {}; vm.runInNewContext(readFileSync(join(RADICE, "comune/config.js"), "utf8") + ";this.C=CONTATTI;", cfg);
const C = cfg.C;
const WA = "https://wa.me/" + C.whatsapp;
/* !!! PARTITA IVA: si prende da comune/config.js (CONTATTI.partitaIva). Finché è vuota non compare da nessuna parte.
   Va scritta lì appena aperta e poi si rilancia questo generatore. Vedi DOMINIO.md, sezione «Cose da fare». */
const PIVA = (C.partitaIva || "").trim();

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* icone a linea sottile (24x24) */
const ICO = {
  clienti: '<path d="M4 19V9.5L12 4l8 5.5V19"/><path d="M9.5 19v-5h5v5"/>',
  mano: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8"/>',
  ordine: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/>',
  sito: '<rect x="3" y="4.5" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 17v3.5"/>',
  gest: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  auto: '<path d="M4 7h11M4 7l3-3M4 7l3 3"/><path d="M20 17H9m11 0l-3-3m3 3l-3 3"/>',
  ass: '<path d="M5 18.5V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H9z"/><path d="M9 9.5h6M9 12h4"/>',
  vf: '<rect x="6.5" y="3" width="11" height="18" rx="2.5"/><path d="M11 9.5v5l4-2.5z"/>',
  fogli: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17M3.5 14.5h17M9.5 4v16"/>',
  persona: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.7-5.5 7-5.5s6 1.9 7 5.5"/>',
  euro: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5"/><path d="M5 10.5h8M5 13.5h8"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5"/>'
};
const ico = (k, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k] || ""}</svg>`;

/* ---------- pezzi comuni ---------- */
function testata(B, attiva) {
  const v = (h, t, k) => `<a href="${B}${h}"${attiva === k ? ' aria-current="page"' : ""}>${t}</a>`;
  return `<a class="salta" href="#contenuto">Vai al contenuto</a>
<header class="nav"><div class="box">
  <a class="logo" href="${B || "./"}" aria-label="Alessandro Mauro, pagina iniziale"><i aria-hidden="true">AM</i>Alessandro Mauro</a>
  <button class="hamb" type="button" aria-expanded="false" aria-controls="menu" aria-label="Apri il menu"><span></span></button>
  <nav class="menu" id="menu" aria-label="Menu principale">
    ${v("servizi/", "Servizi", "servizi")}
    ${v("demo/", "Demo", "demo")}
    ${v("come-lavoro/", "Come lavoro", "come")}
    ${v("questionario/", "Questionario", "q")}
    <a class="btn" href="${B}prenota/"${attiva === "prenota" ? ' aria-current="page"' : ""}>Prenota una call</a>
  </nav>
</div></header>`;
}
function piede(B) {
  const s = SERVIZI.map(x => `<li><a href="${B}servizi/${x.slug}/">${esc(x.nome)}</a></li>`).join("");
  return `<footer class="piede" id="contatti"><div class="box">
  <div class="cols">
    <div><h2>Alessandro Mauro</h2><p>Siti, gestionali, automazioni, assistenti e video per attività, studi, professionisti e privati. Lavoro con clienti in tutta Italia, online.</p></div>
    <div><h2>Servizi</h2><ul>${s}</ul></div>
    <div><h2>Il sito</h2><ul><li><a href="${B}demo/">Demo</a></li><li><a href="${B}come-lavoro/">Come lavoro</a></li><li><a href="${B}prenota/">Prenota una call</a></li><li><a href="${B}questionario/">Questionario</a></li></ul></div>
    <div><h2>Contatti</h2><ul><li><a href="${WA}" data-wa>WhatsApp ${esc(C.telefono)}</a></li><li><a href="mailto:${C.email}" data-mail>${esc(C.email)}</a></li><li><a href="${B}privacy/">Privacy e note legali</a></li></ul></div>
  </div>
  <div class="legale"><span>© <span data-anno>2026</span> Alessandro Mauro${PIVA ? " · P. IVA " + esc(PIVA) : ""}<!-- PARTITA IVA: segnaposto, si compila in comune/config.js (CONTATTI.partitaIva) e si rilancia sorgente-sito/genera.mjs --></span><span>Nessun cookie di profilazione o statistica. <a href="${B}privacy/">Privacy</a></span></div>
</div></footer>`;
}
const JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Person", "@id": DOMINIO + "#alessandro", name: "Alessandro Mauro", url: DOMINIO, email: "mailto:" + C.email, telephone: C.telefono.replace(/\s/g, ""), jobTitle: "Creatore e sviluppatore di soluzioni digitali" },
    { "@type": "ProfessionalService", "@id": DOMINIO + "#servizi", name: "Alessandro Mauro", url: DOMINIO, email: C.email, telephone: C.telefono.replace(/\s/g, ""), areaServed: { "@type": "Country", name: "Italia" }, founder: { "@id": DOMINIO + "#alessandro" },
      description: "Siti e landing page, gestionali, automazioni, assistenti WhatsApp e telefono, Video Factory e sistemazione di fogli Excel e Google per attività, studi, professionisti e privati." }
  ]
});
function pagina({ path, titolo, desc, corpo, attiva, demo = false, noindex = false, home = false }) {
  const depth = path ? path.split("/").filter(Boolean).length : 0, B = "../".repeat(depth);
  const url = DOMINIO + path, tt = home ? titolo : titolo + " · Alessandro Mauro";
  const html = `<!doctype html>
<html lang="it" data-base="${B}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(tt)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,nofollow">' : `<link rel="canonical" href="${url}">`}
<meta name="theme-color" content="#ffffff">
<meta property="og:type" content="website"><meta property="og:locale" content="it_IT"><meta property="og:site_name" content="Alessandro Mauro">
<meta property="og:title" content="${esc(tt)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${DOMINIO}comune/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${B}favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="${B}comune/icona-180.png">
<link rel="stylesheet" href="${B}comune/sito.css?v=${V}">
${home ? `<script type="application/ld+json">${JSONLD}</script>` : ""}
<script defer src="${B}comune/config.js?v=${V}"></script>
${demo ? `<script defer src="${B}comune/settori.js?v=${V}"></script>\n<script defer src="${B}comune/demo.js?v=${V}"></script>` : ""}
<script defer src="${B}comune/sito.js?v=${V}"></script>
</head>
<body>
${testata(B, attiva)}
<main id="contenuto" tabindex="-1">
${corpo(B)}
</main>
${piede(B)}
</body>
</html>
`;
  const f = join(RADICE, path, "index.html"); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, html);
  return path;
}

/* blocchi riusabili */
const fine = (B, tit = "Parliamo della tua attività", testo = "Una call conoscitiva di circa 30 minuti, online e senza impegno: guardiamo come lavori oggi e cosa si può sistemare. Se vuoi, prima compili il questionario veloce, così parto già preparato.") => `<section class="sez corta"><div class="box"><div class="fine rv">
  <h2 class="tit">${tit}</h2>
  <p class="lead centro">${testo}</p>
  <div class="azioni"><a class="btn" href="${B}prenota/">Prenota una call</a><a class="btn sec" href="${B}questionario/?veloce=1">Compila il questionario</a></div>
  <p class="contatti"><span>Oppure scrivimi:</span><a href="${WA}" data-wa>WhatsApp ${esc(C.telefono)}</a><a href="mailto:${C.email}" data-mail>${esc(C.email)}</a></p>
</div></div></section>`;
const faq = items => `<div class="faq">${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`;
const selettore = (id, testo = "La tua attività") => `<div class="sett"><label for="${id}">${testo}</label><select class="sel" id="${id}" data-settore>${opzioniSettori()}</select></div>`;
let _op = null;
function opzioniSettori() {
  if (_op) return _op;
  const ctx = {}; vm.runInNewContext(readFileSync(join(RADICE, "comune/settori.js"), "utf8") + ";this.S=SETTORI;", ctx);
  _op = ctx.S.map(s => `<option${s.n === "Studio dentistico" ? " selected" : ""}>${esc(s.n)}</option>`).join("");
  return _op;
}
const mappa = () => `<ol class="mappa">${PASSI_LAVORO.map((p, i) => `<li style="--i:${i}"><span class="pallino" aria-hidden="true">${i + 1}</span><div><h3>${esc(p[0])}</h3><p>${esc(p[1])}</p></div></li>`).join("")}</ol>`;
const demoBtn = s => `<button type="button" class="dbtn" data-demo="${s.demo}"><b>${esc(s.demoTit)}</b><span>${esc(s.demoSub)}</span></button>`;
const tutteDemo = () => `<div class="demos">${SERVIZI.map(demoBtn).join("")}</div>`;

const scritte = [];

/* ---------- HOME ---------- */
scritte.push(pagina({ path: "", home: true, demo: true, titolo: "Alessandro Mauro · Siti, gestionali, automazioni e video per la tua attività",
  desc: "Siti, gestionali, automazioni, assistenti WhatsApp e video per i social per attività, studi, professionisti e privati. Meno lavoro a mano, più clienti. Prenota una call conoscitiva.",
  corpo: B => `<section class="hero"><div class="box">
  <div>
    <p class="chi">Alessandro Mauro · per attività, studi, professionisti e privati</p>
    <h1>Meno tempo perso,<br>più clienti.</h1>
    <p class="lead">Faccio siti, gestionali, automazioni, assistenti WhatsApp e video per i social. <strong>Tolgo il lavoro che si ripete ogni giorno e ti aiuto a farti trovare</strong>, con soluzioni semplici da usare.</p>
    <div class="azioni"><a class="btn" href="${B}prenota/">Prenota una call</a><a class="btn sec" href="${B}questionario/?veloce=1">Compila il questionario</a></div>
    <ul class="fid"><li>Parli direttamente con me</li><li>Prima vedi una demo, poi decidi</li><li>Preventivo scritto, senza costi nascosti</li></ul>
  </div>
  <div class="scena" aria-label="Esempio animato: un cliente scrive la sera e trova subito risposta" role="img">
    <span class="es">Esempio</span>
    <div class="bolla" style="--i:0"><small>Nuovo messaggio · 21:14</small>Buonasera, avete posto sabato mattina?</div>
    <div class="bolla dx" style="--i:1"><small>Assistente virtuale · subito</small>Buonasera! Sabato c'è posto alle 9:30 o alle 11:00. Quale preferisce?</div>
    <div class="bolla" style="--i:2"><small>Cliente</small>Alle 9:30, grazie</div>
    <div class="bolla ok" style="--i:3"><span><b>In agenda: sabato 9:30</b><br><small>Promemoria il giorno prima, in automatico</small></span></div>
  </div>
</div></section>

<section class="sez alt" id="servizi"><div class="box">
  <div class="testa"><span class="etic">Di cosa hai bisogno?</span><h2 class="tit">Parti dal problema, non dallo strumento.</h2><p class="lead">Scegli quello che ti serve di più. Ogni servizio ha la sua pagina, con una demo da provare.</p></div>
  <div class="bisogni">${BISOGNI.map((b, i) => `<article class="bis rv" style="--d:${i}">
    <span class="ico">${ico(b.ico)}</span><h3>${esc(b.tit)}</h3><p>${esc(b.testo)}</p>
    <ul>${b.servizi.map(k => { const s = SERVIZI.find(x => x.slug === k); return `<li><a href="${B}servizi/${s.slug}/"><span><b>${esc(s.nome)}</b><span>${esc(s.breve)}</span></span></a></li>`; }).join("")}</ul>
  </article>`).join("")}</div>
</div></section>

<section class="sez" id="demo"><div class="box">
  <div class="testa"><span class="etic">Demo</span><h2 class="tit">Guarda come sarebbe per la tua attività.</h2><p class="lead">Scegli il tuo settore e apri una demo: cambiano esempi, moduli e messaggi. <span class="esempio">Esempio con dati inventati</span></p></div>
  <div class="demo-pan rv">${selettore("settHome")}${tutteDemo()}</div>
</div></section>

<section class="sez alt"><div class="box">
  <div class="testa"><span class="etic">Come lavoro</span><h2 class="tit">Dal problema alla soluzione, in cinque passaggi.</h2><p class="lead">Sai sempre cosa succede e cosa riceverai.</p></div>
  ${mappa()}
  <p style="margin-top:32px"><a class="link" href="${B}come-lavoro/">Vedi nel dettaglio come lavoro</a></p>
</div></section>

<section class="sez"><div class="box">
  <div class="testa"><span class="etic">Perché con me</span><h2 class="tit">Il tuo tempo è prezioso.</h2><p class="lead">Non ti vendo promesse: ti propongo soluzioni semplici ed efficaci, spiegate con parole semplici.</p></div>
  <div class="griglia">${PERCHE.map((p, i) => `<div class="card rv" style="--d:${i}"><span class="ico">${ico(p[0])}</span><h3>${esc(p[1])}</h3><p>${esc(p[2])}</p></div>`).join("")}</div>
</div></section>

<section class="sez alt"><div class="box">
  <div class="testa"><span class="etic">Domande frequenti</span><h2 class="tit">Prima di scrivermi.</h2></div>
  ${faq(FAQ_HOME)}
</div></section>
${fine(B)}` }));

/* ---------- ELENCO SERVIZI ---------- */
scritte.push(pagina({ path: "servizi/", attiva: "servizi", titolo: "Servizi", desc: "Siti e landing page, gestionali, automazioni, assistenti WhatsApp e telefono, Video Factory e fogli Excel e Google: cosa fa ogni servizio e per chi.",
  corpo: B => `<section class="sez corta"><div class="box">
  <div class="testa"><span class="etic">Servizi</span><h1 class="tit">Sei servizi, un solo referente.</h1><p class="lead">Puoi prenderne uno solo o unirli: per esempio un sito che porta le richieste direttamente nel gestionale, con i promemoria che partono da soli.</p></div>
  <div class="griglia">${SERVIZI.map((s, i) => `<a class="card rv" style="--d:${i % 3};text-decoration:none;display:flex;flex-direction:column;gap:6px" href="${B}servizi/${s.slug}/"><span class="ico">${ico(s.demo === "sito" ? "sito" : s.demo)}</span><h2 style="font-size:21px">${esc(s.nome)}</h2><p>${esc(s.breve)}</p><span class="link" style="margin-top:auto;padding-top:8px">Scopri e prova la demo</span></a>`).join("")}</div>
</div></section>
${fine(B, "Non sai da dove partire?", "Raccontami il problema in una call di circa 30 minuti: ti dico io quale servizio serve davvero, anche se è uno solo e piccolo.")}` }));

/* ---------- PAGINE SERVIZIO ---------- */
for (const s of SERVIZI) {
  scritte.push(pagina({ path: `servizi/${s.slug}/`, attiva: "servizi", demo: true, titolo: s.nome, desc: s.desc,
    corpo: B => `<section class="hero" style="padding-bottom:56px"><div class="box" style="grid-template-columns:minmax(0,1fr)">
  <div class="stretto">
    <p class="chi"><a class="link" style="font-weight:600;color:var(--text-2)" href="${B}servizi/">Servizi</a> · ${esc(s.nome)}</p>
    <h1>${s.h1}</h1>
    <p class="lead">${esc(s.lead)}</p>
    <div class="azioni"><button type="button" class="btn" data-demo="${s.demo}">Prova la demo</button><a class="btn sec" href="${B}prenota/">Prenota una call</a></div>
  </div>
</div></section>

<section class="sez alt corta"><div class="box">
  <div class="testa"><span class="etic">Il problema</span><h2 class="tit">Ti riconosci?</h2></div>
  <ul class="prob">${s.problemi.map(p => `<li class="rv">${esc(p)}</li>`).join("")}</ul>
</div></section>

<section class="sez corta"><div class="box">
  <div class="testa"><span class="etic">Cosa ottieni</span><h2 class="tit">${esc(s.ottieniTit)}</h2></div>
  <div class="griglia">${s.ottieni.map((o, i) => `<div class="card rv" style="--d:${i}"><h3>${esc(o[0])}</h3><p>${esc(o[1])}</p></div>`).join("")}</div>
</div></section>

<section class="sez alt corta"><div class="box">
  <div class="testa"><span class="etic">Come funziona</span><h2 class="tit">Tre passi, e sai sempre a che punto siamo.</h2></div>
  <ol class="passi">${s.passi.map((p, i) => `<li class="rv" style="--d:${i}"><h3>${esc(p[0])}</h3><p>${esc(p[1])}</p></li>`).join("")}</ol>
</div></section>

<section class="sez corta" id="demo"><div class="box">
  <div class="testa"><span class="etic">Demo</span><h2 class="tit">${esc(s.demoTit)}: provala tu.</h2><p class="lead">${esc(s.demoSub)} Scegli la tua attività: la demo si adatta. <span class="esempio">Esempio con dati inventati</span></p></div>
  <div class="demo-pan rv"><div class="demo-uno">${selettore("sett-" + s.slug)}<button type="button" class="btn" data-demo="${s.demo}">Apri la demo</button></div></div>
</div></section>

<section class="sez alt corta"><div class="box">
  <div class="testa"><span class="etic">Domande frequenti</span><h2 class="tit">In breve.</h2></div>
  ${faq(s.faq)}
</div></section>
${fine(B, s.fineTit)}` }));
}

/* ---------- TUTTE LE DEMO ---------- */
scritte.push(pagina({ path: "demo/", attiva: "demo", demo: true, titolo: "Demo da provare", desc: "Prova le demo per la tua attività: sito, gestionale, automazioni, assistente WhatsApp, Video Factory e fogli in ordine. Esempi con dati inventati.",
  corpo: B => `<section class="sez corta"><div class="box">
  <div class="testa"><span class="etic">Demo</span><h1 class="tit">Prova prima di decidere.</h1><p class="lead">Sei demo interattive. Scegli il tuo tipo di attività e aprile: esempi, moduli e messaggi cambiano con il settore. Niente viene salvato o inviato. <span class="esempio">Esempio con dati inventati</span></p></div>
  <div class="demo-pan rv">${selettore("settDemo")}${tutteDemo()}</div>
  <p class="nota" style="margin-top:18px">Le demo sono esempi per farti un'idea. Il lavoro vero lo costruiamo insieme sui tuoi dati, i tuoi testi e il tuo modo di lavorare.</p>
</div></section>
${fine(B, "Ti piace quello che hai visto?", "In call ti mostro una demo preparata sulla tua attività e ti dico con calma tempi e costi, per iscritto.")}` }));

/* ---------- COME LAVORO ---------- */
scritte.push(pagina({ path: "come-lavoro/", attiva: "come", titolo: "Come lavoro", desc: "Ascolto, mappa del tuo lavoro, prova concreta, costruzione e assistenza: come lavora Alessandro Mauro, passo per passo.",
  corpo: B => `<section class="sez corta"><div class="box">
  <div class="testa"><span class="etic">Come lavoro</span><h1 class="tit">Prima capisco, poi costruisco.</h1><p class="lead">Un percorso in cinque passaggi. Parli sempre con me, dall'idea all'assistenza, e prima di decidere hai tutto per iscritto.</p></div>
  ${mappa()}
</div></section>
<section class="sez alt corta"><div class="box">
  <div class="testa"><h2 class="tit">Cosa succede in ogni passaggio</h2></div>
  <ol class="passi" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${PASSI_LAVORO.map((p, i) => `<li class="rv" style="--d:${i % 3}"><h3>${esc(p[0])}</h3><p>${esc(p[2])}</p></li>`).join("")}</ol>
</div></section>
<section class="sez corta"><div class="box">
  <div class="griglia">${PERCHE.map((p, i) => `<div class="card rv" style="--d:${i}"><span class="ico">${ico(p[0])}</span><h3>${esc(p[1])}</h3><p>${esc(p[2])}</p></div>`).join("")}</div>
</div></section>
${fine(B, "Il primo passo è ascoltarti", "Prenota una call conoscitiva: circa 30 minuti, online, nessun impegno.")}` }));

/* ---------- PRENOTA ---------- */
scritte.push(pagina({ path: "prenota/", attiva: "prenota", titolo: "Prenota una call", desc: "Prenota una call conoscitiva con Alessandro Mauro: circa 30 minuti, online, senza impegno. Consigliato: prima il questionario veloce di 2 minuti.",
  corpo: B => `<section class="sez corta"><div class="box">
  <div class="testa"><span class="etic">Prenota una call</span><h1 class="tit">Una call di circa 30 minuti, online.</h1><p class="lead">Guardiamo insieme come lavori oggi, dove si perdono tempo e clienti e cosa si può sistemare. <strong>Nessun impegno</strong>: il preventivo arriva dopo, per iscritto, e decidi tu.</p></div>
  <div class="scelte">
    <article class="scelta top rv">
      <span class="badge">Consigliato</span>
      <h2>Prima il questionario veloce, poi prenoti</h2>
      <p>Due minuti di domande sulla tua attività. Così arrivo alla call già preparato e non partiamo da zero.</p>
      <ol><li>Rispondi al questionario veloce (circa 2 minuti).</li><li>Alla fine scegli il giorno e l'ora della call.</li><li>Ricevi l'invito con il link della videochiamata.</li></ol>
      <div class="azioni"><a class="btn" href="${B}questionario/?veloce=1">Inizia il questionario veloce</a></div>
    </article>
    <article class="scelta rv" style="--d:1">
      <h2>Prenota subito</h2>
      <p>Hai poco tempo o preferisci raccontarmi tutto a voce? Va benissimo.</p>
      <div data-se-prenota hidden>
        <ol><li>Scegli giorno e ora nel calendario.</li><li>Ricevi l'invito con il link Google Meet.</li></ol>
        <div class="azioni"><a class="btn sec" href="${B}questionario/?veloce=1" data-prenota-diretto>Apri il calendario</a></div>
      </div>
      <div data-se-no-prenota>
        <ol><li>Scrivimi su WhatsApp o per email.</li><li>Ti propongo due o tre orari liberi.</li><li>Ti mando l'invito con il link della videochiamata.</li></ol>
        <div class="azioni"><a class="btn sec" href="${WA}" data-wa="Ciao Alessandro, vorrei fissare una call conoscitiva. Sono disponibile: ">Scrivimi su WhatsApp</a><a class="btn sec" href="mailto:${C.email}" data-mail="Call conoscitiva">Scrivimi un'email</a></div>
      </div>
    </article>
  </div>
  <p class="nota" style="margin-top:22px">Se prenoti dal calendario, il tuo nome e la tua email passano al servizio di prenotazione di Google solo per fissare l'appuntamento. Dettagli nella <a class="link" href="${B}privacy/">privacy</a>.</p>
</div></section>
<section class="sez alt corta"><div class="box">
  <div class="testa"><h2 class="tit">Cosa succede in call</h2></div>
  <ol class="passi"><li><h3>Mi racconti</h3><p>Come lavori oggi e cosa ti fa perdere tempo o clienti, anche senza termini tecnici.</p></li><li><h3>Ti mostro</h3><p>Una demo vicina alla tua attività e le soluzioni possibili, dalla più semplice.</p></li><li><h3>Decidi con calma</h3><p>Se ti interessa, ti mando un preventivo scritto con cosa faccio, tempi e costi. Nessun impegno.</p></li></ol>
</div></section>` }));

/* ---------- PRIVACY E NOTE LEGALI ---------- */
scritte.push(pagina({ path: "privacy/", titolo: "Privacy e note legali", desc: "Informativa privacy e note legali del sito di Alessandro Mauro: quali dati, perché, per quanto tempo, i tuoi diritti. Nessun cookie di profilazione.",
  corpo: B => `<section class="testo"><div class="box stretto">
  <h1>Privacy e note legali</h1>
  <p class="agg">Ultimo aggiornamento: ${OGGI}</p>
  <p>Questa pagina spiega, in parole semplici, come vengono trattati i dati di chi visita questo sito (regolamento UE 2016/679, «GDPR»).</p>
  <h2>Chi è il titolare</h2>
  <p>Alessandro Mauro. Contatti: <a href="mailto:${C.email}">${esc(C.email)}</a>, WhatsApp e telefono ${esc(C.telefono)}.</p>
  <h2>Cosa raccoglie il sito</h2>
  <ul>
    <li><b>Navigare il sito:</b> il sito non ha moduli, non chiede dati e non usa cookie di profilazione, di statistica o pubblicità. Per questo non c'è un banner dei cookie.</li>
    <li><b>Dati tecnici del server:</b> il sito è ospitato da GitHub Pages (GitHub, Inc.). Come ogni server, registra dati tecnici come l'indirizzo IP per sicurezza e funzionamento. Io non li vedo e non li uso.</li>
    <li><b>Memoria del browser:</b> le demo ricordano il tipo di attività che hai scelto (solo sul tuo dispositivo, nella memoria locale del browser), per comodità. Non arriva a me e lo puoi cancellare dalle impostazioni del browser.</li>
    <li><b>Se mi scrivi</b> su WhatsApp o per email, uso i dati che mi mandi solo per risponderti e, se vuoi, prepararti una proposta. WhatsApp è un servizio di Meta e l'email passa dal tuo fornitore di posta, con le loro regole sulla privacy.</li>
    <li><b>Se prenoti la call</b> dal calendario online, nome ed email passano al servizio di prenotazione di Google Calendar solo per fissare l'appuntamento e mandarti l'invito.</li>
    <li><b>Il questionario</b> ha la sua informativa, scritta prima del pulsante di invio, che spiega dove vanno le risposte.</li>
  </ul>
  <h2>Perché e su quale base</h2>
  <p>Per rispondere alle tue richieste e preparare un'eventuale proposta, su tua richiesta (art. 6.1.b GDPR). Per la sicurezza del sito, per interesse legittimo (art. 6.1.f). I dati non vengono venduti, ceduti o usati per pubblicità.</p>
  <h2>Per quanto tempo</h2>
  <p>I dati dei contatti che non diventano un lavoro insieme vengono cancellati entro 12 mesi dall'ultimo contatto. Se lavoriamo insieme, i documenti si conservano per il tempo richiesto dalla legge.</p>
  <h2>I tuoi diritti</h2>
  <p>Puoi chiedere in qualsiasi momento di vedere, correggere o cancellare i tuoi dati, limitarne l'uso o opporti, scrivendo a <a href="mailto:${C.email}">${esc(C.email)}</a>. Puoi anche fare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).</p>
  <h2>Note legali</h2>
  <p>Sito di Alessandro Mauro, domicilio Via Soldato Paolo Vitale 3, 71040 Ordona (FG). Email <a href="mailto:${C.email}">${esc(C.email)}</a>.${PIVA ? " Partita IVA " + esc(PIVA) + "." : ""}<!-- PARTITA IVA: segnaposto. Appena aperta va scritta in comune/config.js (CONTATTI.partitaIva) e si rilancia node sorgente-sito/genera.mjs: comparirà qui e nel piè di pagina. --></p>
  <p>Le demo del sito usano solo dati inventati: nomi, numeri, messaggi e recensioni che vi compaiono sono esempi e non riguardano persone o clienti reali. Gli assistenti virtuali che realizzo dichiarano sempre di essere un programma e permettono di parlare con una persona.</p>
</div></section>` }));

/* ---------- STRUMENTI PERSONALI (non indicizzati) ---------- */
{
  const f = join(RADICE, "strumenti/index.html"); mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Strumenti · Alessandro Mauro</title><link rel="icon" href="../favicon.svg" type="image/svg+xml"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f5f7;color:#1d1d1f;font:17px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;text-align:center;padding:16px}a{color:#1d1d1f;display:block;padding:10px 0;font-weight:600}ul{list-style:none;padding:0;margin:16px 0 0}</style></head><body><main><h1 style="font-size:28px;letter-spacing:-.02em;margin:0 0 8px">Alessandro Mauro</h1><p style="color:#6e6e73;margin:0">Pagina degli strumenti personali (non compare su Google).</p><ul><li><a href="../">Il sito</a></li><li><a href="../questionario/">Questionario per i clienti</a></li><li><a href="../analizza/">Analizza (link e video)</a></li><li><a href="../privacy-contatti/">Informativa per le attività contattate</a></li></ul></main></body></html>
`);
}

/* ---------- 404, sitemap, robots ---------- */
writeFileSync(join(RADICE, "404.html"), `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Pagina non trovata · Alessandro Mauro</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;color:#1d1d1f;font:17px/1.47 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;text-align:center;padding:16px}h1{font-size:32px;margin:0 0 8px}p{color:#6e6e73}a{display:inline-block;margin:6px;padding:12px 22px;border-radius:980px;background:#1d1d1f;color:#fff;text-decoration:none}a.s{background:none;color:#1d1d1f;border:1px solid rgba(0,0,0,.18)}</style></head><body><main><h1>Pagina non trovata</h1><p>L'indirizzo è sbagliato o la pagina è stata spostata.</p><a href="/" data-r="">Vai alla pagina iniziale</a><a class="s" href="/prenota/" data-r="prenota/">Prenota una call</a></main><script>/* funziona sia su alessandromauroworks.it sia sul vecchio indirizzo github.io/Ale/ */var b=location.pathname.indexOf("/Ale/")===0?"/Ale/":"/";document.querySelectorAll("a[data-r]").forEach(function(a){a.href=b+a.getAttribute("data-r")});</script></body></html>
`);
const pubbliche = scritte;
writeFileSync(join(RADICE, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pubbliche.map(p => `  <url><loc>${DOMINIO}${p}</loc><lastmod>2026-11-15</lastmod></url>`).join("\n")}
</urlset>
`);
writeFileSync(join(RADICE, "robots.txt"), `User-agent: *
Allow: /
Disallow: /strumenti/
Disallow: /analizza/
Disallow: /jarvis/
Disallow: /privacy-contatti/
Disallow: /questionario/test/
Disallow: /sorgente-sito/
Disallow: /test-sito/

Sitemap: ${DOMINIO}sitemap.xml
`);
console.log("Pagine scritte:", pubbliche.length + 2, "(" + pubbliche.map(p => "/" + p).join(" ") + " /strumenti/ /404.html)");
