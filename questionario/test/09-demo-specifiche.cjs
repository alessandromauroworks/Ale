const L=require('./lib.cjs'); const {ok}=L; const S=process.env.SHOT_DIR||require('os').tmpdir()+'/collaudo-questionario'; require('fs').mkdirSync(S,{recursive:true});
async function toStep2(p,tipo,att){ await p.click('#nextBtn'); await p.fill('#fAtt',att); await L.s1(p,tipo==='privato'?null:'Titolare',tipo); await L.next(p); await L.fixGoal(p); }
(async()=>{
 const b=await L.chromium.launch(); const heroes={};
 for(const [tipo,att,key,exp] of [['dentist','Studio Sorriso','dent','Il tuo sorriso, con cura'],['ristorante','Da Marco','rist','Buon cibo, buona compagnia'],['privato','Anna','priv','Ciao, sono Anna'],['geometra','Studio Rossi','geo','Dal progetto alla pratica']]){
  const w=key==='dent'?1280:390; const p=await L.mk(b,{width:w,height:844}); await toStep2(p,tipo,att);
  await p.locator('.svcb',{hasText:/Sito/}).first().click(); await p.waitForTimeout(450); await p.locator('#svcp_sito button',{hasText:'Guarda un esempio'}).click(); await p.waitForTimeout(500);
  const h=await p.textContent('.sd-hero h3'), sub=await p.textContent('.sd-hero p'), cta=await p.textContent('.sd-hero .sd-cta'), sv=await p.locator('.sd-sec .sd-card b').allTextContents();
  heroes[key]=[h,cta]; ok('demo sito '+key+': testi del settore',h.includes(exp.replace('Anna','Anna'))||h===exp,h+' | '+cta+' | '+sv.slice(0,3).join(','));
  ok('demo sito '+key+': etichetta Esempio',(await p.textContent('#dlgB')).includes('Esempio con dati inventati'));
  if(key==='dent'||key==='rist'){ await p.screenshot({path:`${S}/demosito-${key}-${w}.png`}); }
  ok('demo '+key+': console',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close(); }
 ok('i settori hanno testi diversi',new Set(Object.values(heroes).map(x=>x.join('|'))).size===4);
 // gestionale: schermate diverse per modulo
 for(const w of [1280,390]){ const p=await L.mk(b,{width:w,height:900}); await toStep2(p,'dentist','Studio Sorriso'); await L.to(p,7,async c=>{if(c==='2')await L.fixGoal(p)}); await p.evaluate(()=>{A.gest.serve='Sì';renderGest();gShow();}); await p.waitForTimeout(600);
  const pick=async name=>{ await p.locator('#gpNav button',{hasText:name}).first().click(); await p.waitForTimeout(300); return {h:await p.locator('.gp-hd span').allTextContents(), rows:await p.locator('.gp-r:not(.gp-hd)').first().innerText(), kpi:await p.locator('.gp-c span').allTextContents(), ex:await p.textContent('.gp-ex')}; };
  const ag=await pick('Agenda'), pg=await pick('Pagamenti'), sc=await pick('Schede'), mg=await pick('Magazzino');
  ok(w+' gestionale: Agenda con orari',ag.h.join()==='Ora,Cliente,Cosa'&&/\d\d:\d\d/.test(ag.rows),ag.h.join()+' '+ag.rows.replace(/\n/g,' '));
  ok(w+' gestionale: Pagamenti con importi e stato',pg.h.join()==='Documento,Importo,Stato'&&/€ \d+/.test(pg.rows)&&pg.kpi.join().includes('Incassato'),pg.rows.replace(/\n/g,' '));
  ok(w+' gestionale: Schede con ultimo contatto',sc.h.join()==='Nome,Ultimo contatto,Stato');
  ok(w+' gestionale: Magazzino con giacenze',mg.h.join()==='Articolo,Giacenza,Stato',mg.h.join());
  ok(w+' gestionale: etichetta Esempio',ag.ex.includes('Esempio con dati inventati')&&(await p.textContent('#gpBox')).includes('dati inventati'));
  await p.locator('#gpNav button',{hasText:'Agenda'}).first().click(); await p.waitForTimeout(250); await p.locator('#gpBox').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/gest-agenda-${w}.png`});
  await p.locator('#gpNav button',{hasText:'Pagamenti'}).first().click(); await p.waitForTimeout(250); await p.screenshot({path:`${S}/gest-pagamenti-${w}.png`});
  ok(w+' gestionale: nessuno scroll orizzontale',await L.noOverflow(p)); ok(w+' gestionale: console',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close(); }
 // pacchetti come esempi
 { const p=await L.mk(b,{width:390,height:844}); await toStep2(p,'dentist','Studio Sorriso'); await p.locator('.svcb',{hasText:/Sito/}).first().click(); await L.to(p,8,async c=>{if(c==='2')await L.fixGoal(p)}); await p.waitForTimeout(700);
   ok('pacchetti: nota "esempi per orientarti" in testa',(await p.locator('#pkBox .note').first().textContent()).includes('Questi pacchetti sono esempi per orientarti')&&(await p.locator('#pkBox .note').first().textContent()).includes('il prezzo lo vedi nel preventivo'));
   await p.locator('.pkk .btn').first().click(); await L.to(p,9); await L.fin(p); await L.to(p,10); await p.waitForTimeout(600);
   ok('riepilogo: nota sul pacchetto',(await p.textContent('#sum')).includes('È un esempio per orientarsi')); ok('WhatsApp: pacchetto indicato come esempio',await p.evaluate(()=>/Pacchetto che mi interessa: .* \(un esempio: quello vero lo costruiamo insieme\)/.test(invio.testo)));
   ok('console',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close(); }
 await b.close(); L.done();
})();
