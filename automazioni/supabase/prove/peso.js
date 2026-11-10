// Tempi di caricamento del questionario su un telefono lento simulato (CPU 4x più lenta, rete «Slow 4G»).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true }); const p = await ctx.newPage();
  const c = await ctx.newCDPSession(p);
  await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await c.send('Network.enable'); await c.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await p.route('**/q/', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'content-encoding': 'identity' }, body: require('fs').readFileSync(process.argv[2]) }));
  const t0 = Date.now(); await p.goto('https://esempio.test/q/', { waitUntil: 'load' });
  const m = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null, scriptMs: Math.round(n.domContentLoadedEventEnd - n.responseEnd) }; });
  console.log(JSON.stringify(m)); await b.close();
})();
