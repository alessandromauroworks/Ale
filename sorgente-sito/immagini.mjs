/* Crea le immagini del sito (icona 180 px e anteprima per i social 1200x630) con un browser di prova.
   Uso dalla radice: node sorgente-sito/immagini.mjs  (serve playwright, già in questionario/test/node_modules) */
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const R = join(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(join(R, "questionario/test/package.json"))("playwright");
const FONT = '-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.setContent(`<body style="margin:0;width:1200px;height:630px;background:#fff;font-family:${FONT};color:#1D1D1F;display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box">
<div style="display:flex;align-items:center;gap:16px;font-size:30px;font-weight:600"><span style="width:56px;height:56px;border-radius:50%;background:#1D1D1F;color:#fff;display:grid;place-items:center;font-size:21px">AM</span>Alessandro Mauro</div>
<div style="font-size:84px;font-weight:600;letter-spacing:-.03em;line-height:1.04;margin-top:40px">Meno tempo perso,<br>più clienti.</div>
<div style="font-size:30px;color:#6E6E73;margin-top:28px">Siti, gestionali, automazioni, assistenti e video per la tua attività</div>
<div style="font-size:24px;font-weight:600;margin-top:36px">alessandromauroworks.it</div></body>`);
await p.screenshot({ path: join(R, "comune/og.png") });
await p.setViewportSize({ width: 180, height: 180 });
await p.setContent(`<body style="margin:0;width:180px;height:180px;background:#1D1D1F;display:grid;place-items:center;font-family:${FONT};color:#fff;font-size:68px;font-weight:600">AM</body>`);
await p.screenshot({ path: join(R, "comune/icona-180.png") });
await b.close(); console.log("ok");
