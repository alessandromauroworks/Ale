// Prove della conservazione 12 mesi e dello stato «cliente» nella Mappa Call Live (connettore Supabase finto).
// uso: node mappa12.js <html> <out.json> [mcp: ok|nocap] [pulizia: vecchia|oggi]
const { chromium } = require('playwright'); const fs = require('fs');
const [html, out, mcpModo = 'ok', pul = 'vecchia'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
  const errori = []; p.on('pageerror', e => errori.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });
  await p.addInitScript(({ mcpModo, pul }) => {
    const V = Date.now() - 396 * 864e5;   // 13 mesi fa
    const q = (tel, att) => ({ v: 1, data: '2025-10-01', s: 'Ristorante / pizzeria', nome: 'Prova', attivita: att, tel });
    const base = { cliente: { attivita: 'X', tipo: 'X', lavoro: [], problemi: [], soluzioni: [], risultati: [] }, note: [], chat: [], aggiornato: V, settore: 'Ristorante / pizzeria' };
    const store = {
      'call/call-manuale-vecchia': { ...base, id: 'call-manuale-vecchia', questionario: q('+39 333 111 0001', 'Manuale Srl') },
      'call/call-manuale-cliente': { ...base, id: 'call-manuale-cliente', esito: 'cliente', questionario: q('+39 333 111 0002', "Cliente d'Oro") },
      'call/call-lead-cliente': { ...base, id: 'call-lead-cliente', leadId: 'L1', questionario: q('+39 333 111 0003', 'Lead Srl') },
      'call/call-non-questionario': { ...base, id: 'call-non-questionario' },
      'call/q-55555555-5555-4555-8555-555555555555': { ...base, id: 'q-55555555-5555-4555-8555-555555555555', questionario: q('+39 333 111 0005', 'Auto vecchia') },
      'call/q-66666666-6666-4666-8666-666666666666': { ...base, aggiornato: Date.now(), id: 'q-66666666-6666-4666-8666-666666666666', questionario: q('+39 333 111 0006', 'Da chiudere') },
      'indice/lead': { lead: [{ id: 'L1', nome: 'Lead Srl', stato: 'cliente' }, { id: 'L2', nome: 'Altro', stato: 'chiuso-senza-risposta' }] },
    };
    if (pul === 'oggi') store['indice/pulizia'] = { ultima: Date.now() - 3600e3, conSupabase: true };
    window.__store = store; window.__sql = []; window.__letture = 0; const subs = [];
    const snapOf = path => ({ exists: path in store, id: path.split('/').pop(), data: () => JSON.parse(JSON.stringify(store[path])) });
    const notif = () => subs.forEach(f => f());
    const db = {
      doc: path => ({ get: async () => { window.__letture++; return snapOf(path); }, set: async o => { store[path] = JSON.parse(JSON.stringify(o)); notif(); },
        update: async o => { const d = store[path] || {}; for (const [k, v] of Object.entries(o)) { if (v && v.__delete__) delete d[k]; else d[k] = v; } store[path] = d; notif(); },
        delete: async () => { delete store[path]; notif(); }, onSnapshot: cb => { const f = () => cb(snapOf(path)); subs.push(f); setTimeout(f, 0); return () => {}; } }),
      collection: c => { const filtri = []; const q = { where: (f, op, v) => { filtri.push([f, op, v]); return q; }, orderBy: () => q, limit: () => q,
        get: async () => { window.__letture++; return { docs: Object.keys(store).filter(k => k.startsWith(c + '/') && filtri.every(([f, op, v]) => op === '<' ? store[k][f] < v : op === '==' ? store[k][f] === v : true)).map(k => snapOf(k)) }; },
        onSnapshot: cb => { const f = () => cb({ docs: Object.keys(store).filter(k => k.startsWith(c + '/')).map(k => snapOf(k)).sort((a, b) => b.data().aggiornato - a.data().aggiornato) }); subs.push(f); setTimeout(f, 0); return () => {}; } }; return q; }
    };
    const res = rows => ({ content: [{ type: 'text', text: JSON.stringify({ result: '<untrusted-data-abcd1234>' + JSON.stringify(rows) + '</untrusted-data-abcd1234>' }) }] });
    const mcp = { callTool: async (srv, tool, args) => { window.__sql.push(args.query);
      if (/json_build_object\('id', coalesce/.test(args.query)) return res([{ j: { id: [], tel: [] } }]);
      if (/^select/i.test(args.query)) return res([{ j: [] }]);
      return res([]); } };
    window.claude = { use: async n => n === 'db' ? db : n === 'mcp' ? (mcpModo === 'nocap' ? null : mcp) : n === 'permissions' ? { state: async () => 'granted' } : null };
  }, { mcpModo, pul });
  await p.goto('file://' + html); await p.waitForTimeout(1800);
  const dopoAvvio = await p.evaluate(() => ({ docs: Object.keys(window.__store).filter(k => k.startsWith('call/')), letture: window.__letture, sql: window.__sql.length }));
  // chiusura call con esito cliente: apro la call q-666 e tocco «Cliente / acconto»
  await p.click('#callsBtn'); await p.waitForTimeout(200);
  await p.click('#callsList .opt[data-id="q-66666666-6666-4666-8666-666666666666"]'); await p.waitForTimeout(500);
  await p.click('#esito button[data-v="cliente"]'); await p.waitForTimeout(1500);
  const fine = await p.evaluate(() => ({ docs: Object.keys(window.__store).filter(k => k.startsWith('call/')),
    sync: Object.fromEntries(Object.entries(window.__store).filter(([k]) => k.startsWith('call/')).map(([k, v]) => [k.slice(5), v.clienteSync || null])),
    pulizia: window.__store['indice/pulizia'] || null, sql: window.__sql, letture: window.__letture, esitoBtn: document.querySelector('#esito button[data-v="cliente"]').getAttribute('aria-pressed') }));
  fs.writeFileSync(out, JSON.stringify({ dopoAvvio, fine, errori }, null, 1)); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
