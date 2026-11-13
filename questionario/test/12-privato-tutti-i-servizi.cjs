// Privato con TUTTI i servizi disponibili aperti: nessuna parola da azienda nel testo visibile
// (pannelli, consigli, pacchetti, riepilogo, messaggio WhatsApp).
const L=require('./lib.cjs'); const {ok}=L;
const VIETATE=/\bclient[ie]\b|attivit[àa]|titolare|pazient[ei]|Gestionale fatto su misura|Video e foto per l'attivit|Testimonianze dei client|Post nati dalle domande dei client|Gestire clienti e pratiche|Clienti persi/gi;
const trova=t=>[...new Set((t.match(new RegExp('.{0,40}('+VIETATE.source+').{0,30}','gi'))||[]).map(x=>x.replace(/\s+/g,' ')))].slice(0,60);
(async()=>{
 const b=await L.chromium.launch();
 for(const w of [390,1280]){
  const p=await L.mk(b,{width:w,height:844}); await p.click('#nextBtn'); await p.waitForTimeout(250);
  await p.fill('#fNome','Anna Prova'); await p.fill('#fTipo','privato'); await p.waitForTimeout(250); await p.locator('#tipoList .opt').first().click(); await p.waitForTimeout(300); await p.fill('#fAtt','');
  await L.next(p); await L.fixGoal(p); await p.waitForTimeout(300);
  const n=await p.locator('.svcb').count(); ok(w+' privato: servizi disponibili ('+n+')',n>=4);
  for(let i=0;i<n;i++){ const bt=p.locator('.svcb').nth(i); if(await bt.getAttribute('aria-pressed')!=='true'){ await bt.click(); await p.waitForTimeout(350);} }
  const aperti=await p.locator('.svcb[aria-pressed=true]').count(); ok(w+' privato: tutti i servizi aperti',aperti===n,aperti+'/'+n);
  // scelgo anche tutte le voci dei pannelli e i tipi di problema, così finiscono nel riepilogo e nel messaggio
  await p.evaluate(()=>{ document.querySelectorAll('.svc .prop,#cTipoProb .chip').forEach(x=>{ if(x.getAttribute('aria-pressed')!=='true') x.click(); }); });
  await p.waitForTimeout(300);
  ok(w+' privato: voci dei pannelli scelte',await p.evaluate(()=>Object.keys(dettagli()).length>=4));
  const testi=[];
  const leggi=async()=>{ const c=await L.cur(p); testi.push([c,await p.evaluate(()=>{const e=document.querySelector('.step.on');return [...e.querySelectorAll('*')].filter(x=>x.offsetParent!==null||x.getClientRects().length).length?e.innerText:''})]); return c; };
  // passo 2: pannelli aperti, anche i campi (placeholder, suggerimenti)
  testi.push(['2-attr',await p.evaluate(()=>[...document.querySelectorAll('.step.on [placeholder],.step.on [aria-label]')].map(e=>(e.placeholder||'')+' '+(e.getAttribute('aria-label')||'')).join(' | '))]);
  for(let i=0;i<9;i++){ const c=await leggi(); if(c==='10')break; if(c==='9'){ await L.fin(p); } await L.next(p); await p.waitForTimeout(400); }
  await p.waitForTimeout(600);
  const t=await p.evaluate(()=>({pk:document.querySelector('#pkBox')?.innerText||'',ins:document.querySelector('#insBox,#cIns')?.innerText||'',cons:[...document.querySelectorAll('.sugg,.cons,.consiglio,[class*=cons]')].map(e=>e.innerText).join(' '),sg:typeof sugg==='function'?sugg().map(x=>x.t+' '+(x.d||x.s||'')).join(' '):'',wa:(typeof invio!=='undefined'&&invio&&invio.testo)||'',riep:document.querySelector('#riep,#riepilogo,.riep')?.innerText||'',rp:typeof riepilogo==='function'?String(riepilogo()&&riepilogo().innerText||riepilogo()):''}));
  const tutto=testi.map(x=>x[0]+'::'+x[1]).join('\n')+'\n'+Object.values(t).join('\n');
  const bad=trova(tutto); ok(w+' privato (tutti i servizi): niente parole aziendali',bad.length===0,JSON.stringify(bad));
  ok(w+' privato: messaggio WhatsApp senza parole aziendali',trova(t.wa).length===0,JSON.stringify(trova(t.wa)));
  ok(w+' privato: console',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close();
 }
 await b.close(); L.done();
})();
