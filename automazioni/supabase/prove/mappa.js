// Banco di prova della Mappa: finto window.claude (db in memoria, connettore Supabase finto).
// uso: node mappa.js <html> <righe.json> <out.json> [perm: granted|prompt] [mcp: ok|server_not_connected|nocap|approval_required]
const { chromium } = require('playwright'); const fs = require('fs');
const [html, righeF, out, perm = 'granted', mcpModo = 'ok'] = process.argv.slice(2);
const righe = JSON.parse(fs.readFileSync(righeF, 'utf8')); const lista = Array.isArray(righe) ? righe : [righe];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
  const errori = []; p.on('pageerror', e => errori.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });
  await p.addInitScript(({ lista, perm, mcpModo }) => {
    const vecchio = Date.now() - 400 * 864e5;
    const store = { 'call/q-11111111-1111-4111-8111-111111111111': { cliente: null, id: 'q-11111111-1111-4111-8111-111111111111', aggiornato: vecchio, nome: 'Vecchio non cliente' },
      'call/q-22222222-2222-4222-8222-222222222222': { id: 'q-22222222-2222-4222-8222-222222222222', aggiornato: vecchio, nome: 'Vecchio cliente' },
      'call/call-vecchia': { id: 'call-vecchia', aggiornato: vecchio, nome: 'Call a mano' } }; window.__store = store; window.__sql = []; const subs = [];
    const snapOf = path => ({ exists: path in store, id: path.split('/').pop(), data: () => JSON.parse(JSON.stringify(store[path])) });
    const notif = () => subs.forEach(f => f());
    const db = {
      doc: path => ({ get: async () => snapOf(path), set: async o => { store[path] = JSON.parse(JSON.stringify(o)); notif(); }, delete: async () => { delete store[path]; notif(); },
        onSnapshot: (cb) => { const f = () => cb(snapOf(path)); subs.push(f); setTimeout(f, 0); return () => {}; } }),
      collection: c => { const filtri = []; const q = { where: (f, op, v) => { filtri.push([f, op, v]); return q; }, orderBy: () => q, limit: () => q,
        _docs: () => Object.keys(store).filter(k => k.startsWith(c + '/') && filtri.every(([f, op, v]) => op === '<' ? store[k][f] < v : true)).map(k => snapOf(k)),
        get: async () => ({ docs: q._docs() }),
        onSnapshot: cb => { const f = () => cb({ docs: Object.keys(store).filter(k => k.startsWith(c + '/')).map(k => snapOf(k)) }); subs.push(f); setTimeout(f, 0); return () => {}; } }; return q; }
    };
    const mcp = { callTool: async (srv, tool, args) => {
      window.__sql.push(args.query);
      if (mcpModo !== 'ok') throw { code: mcpModo };
      if (/stato = 'cliente'/.test(args.query)) { const tag = 'abcd1234-0000'; return { content: [{ type: 'text', text: JSON.stringify({ result: `<untrusted-data-${tag}>` + JSON.stringify([{ j: ['22222222-2222-4222-8222-222222222222'] }]) + `</untrusted-data-${tag}>` }) }] }; }
      if (/^select/i.test(args.query)) { const tag = 'abcd1234-0000'; return { content: [{ type: 'text', text: JSON.stringify({ result: `Below...<untrusted-data-${tag}>\n` + JSON.stringify([{ j: lista }]) + `\n</untrusted-data-${tag}>` }) }] }; }
      return { content: [{ type: 'text', text: '{"result":"<untrusted-data-abcd1234-0000>[]</untrusted-data-abcd1234-0000>"}' }] };
    } };
    window.claude = { use: async n => n === 'db' ? db : n === 'mcp' ? (mcpModo === 'nocap' ? null : mcp) : n === 'permissions' ? { state: async () => perm } : null };
  }, { lista, perm, mcpModo });
  await p.goto('file://' + html); await p.waitForTimeout(1500);
  fs.writeFileSync(out.replace(/\.json$/, '-iniziale.json'), JSON.stringify(await p.evaluate(() => window.__store)));
  const stato1 = await p.evaluate(() => ({ toast: document.getElementById('toast').textContent, qAutoT: document.getElementById('qAutoT').textContent, collega: !document.getElementById('qLinkBtn').hidden, calls: document.getElementById('callsBtn').textContent }));
  // secondo controllo con la stessa riga (come se l'update di importato_il fosse fallito): non deve creare una seconda call
  await p.evaluate(() => controllaQuestionari(true)); await p.waitForTimeout(500);
  const docs = await p.evaluate(() => Object.keys(window.__store));
  // apro la call creata e provo la presentazione
  let pres = null;
  const qdoc = await p.evaluate(() => Object.keys(window.__store).find(k => k.startsWith('call/q-') && window.__store[k].cliente));
  if (qdoc) {
    await p.click('#callsBtn'); await p.waitForTimeout(200);
    const opt = await p.$(`#callsList .opt[data-id="${qdoc.slice(5)}"]`); if (opt) { await opt.click(); await p.waitForTimeout(800); }
    await p.keyboard.press('Escape'); await p.click('#board', { position: { x: 5, y: 5 } }).catch(() => {});
    await p.keyboard.press('p'); await p.waitForTimeout(500);
    pres = await p.evaluate(() => { const vis = el => !!(el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden'); const testo = document.body.innerText;
      return { present: document.body.classList.contains('present'), notesVis: vis(document.getElementById('notes')), toolsVis: vis(document.getElementById('tools')), tel: testo.includes('333 000 0002'), budget: /budget/i.test(testo), nome: testo.includes('PROVA Collaudo 2'), titolo: document.getElementById('title').textContent };
    });
    await p.screenshot({ path: out.replace(/\.json$/, '-present.png') });
  }
  fs.writeFileSync(out, JSON.stringify({ stato1, docs, sql: await p.evaluate(() => window.__sql), store: await p.evaluate(() => window.__store), pres, errori }, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
