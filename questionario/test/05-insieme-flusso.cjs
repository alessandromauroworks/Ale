const L=require('./lib.cjs'); const {ok}=L; const S=process.env.SHOT_DIR||require('os').tmpdir()+'/collaudo-questionario'; require('fs').mkdirSync(S,{recursive:true});
const dOpen=p=>p.evaluate(()=>!document.getElementById('dlg').hidden);
(async()=>{
 const b=await L.chromium.launch();
 for(const w of [320,390,768,1280,1440]){
  const bad=[]; const p=await L.mk(b,{width:w,height:w<700?760:860});
  const chk=async n=>{ await p.waitForTimeout(450); if(!(await L.noOverflow(p))) bad.push(n+'@'+await p.evaluate(()=>document.documentElement.scrollWidth)); };
  await p.click('#nextBtn'); await p.waitForTimeout(300); await L.s1(p,'Titolare','palestra'); await L.next(p); await L.fixGoal(p);
  await p.locator('.svcb',{hasText:'Sito internet'}).click(); await p.waitForTimeout(300);
  await L.to(p,8,async c=>{if(c==='2')await L.fixGoal(p)}); await p.waitForTimeout(700); await chk('s8');
  const t=await p.textContent('#insBox'); ok(w+' sezione Insieme + testi onesti',t.includes('Insieme funzionano meglio')&&t.includes('approvati da Meta')&&t.includes('solo a chi ha dato il consenso'));
  const cb=await p.locator('.combo h4').allTextContents(); ok(w+' abbinamento per Sito',cb.some(x=>/Sito \+ Prenotazioni/.test(x)),cb.join('|'));
  if(w===390||w===1280){ await p.locator('#insBox').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({path:`${S}/insieme-${w}.png`}); }
  await p.locator('.combo',{hasText:'Sito + Prenotazioni'}).locator('button').click(); await p.waitForTimeout(400);
  ok(w+' Aggiungilo seleziona i servizi mancanti',await p.evaluate(()=>A.servizi.length===3&&A.servizi.some(x=>/Prenotazioni/.test(x))&&A.servizi.some(x=>/Automazioni/.test(x))));
  ok(w+' abbinamenti cambiano (Sito+Pren già completo)',!(await p.locator('.combo h4').allTextContents()).some(x=>/Sito \+ Prenotazioni/.test(x)));
  // collegamenti utili
  await p.locator('#cFlusso .prop').first().click(); await p.locator('#cFlusso .prop').nth(2).click(); await p.fill('#fFlusso','Un messaggio dopo la lezione');
  let d=await p.evaluate(()=>dati()); ok(w+' d.flusso',d.flusso.scelte.length===2&&d.flusso.testo.startsWith('Un messaggio'));
  ok(w+' pacchetti tengono conto dei collegamenti (automazioni)',/lavori ripetitivi|Promemoria|automatic|Lavori ripetitivi/i.test(await p.textContent('#pkBox')));
  // demo flusso
  await p.click('#flussoBtn'); await p.waitForTimeout(500); await chk('demo');
  ok(w+' demo flusso aperta, esempio e nota',await dOpen(p)&&(await p.textContent('#dlgB')).includes('le modifiche non si salvano')&&(await p.textContent('#dlgB')).includes('approvati da Meta'));
  await p.locator('#dlgB button',{hasText:'Passo dopo passo'}).click(); await p.locator('#dlgB button',{hasText:'Passo dopo passo'}).click(); ok(w+' flusso a passi',(await p.locator('.fs.s-now').count())===1&&(await p.locator('.fs.s-done').count())===1);
  await p.locator('#dlgB button',{hasText:'Riproduci'}).click(); await p.waitForTimeout(4500); ok(w+' flusso riprodotto',(await p.locator('.fs.s-done').count())>=3);
  const sw=p.locator('.rl .sw').first(); await sw.click(); ok(w+' interruttore spegne la regola',(await sw.getAttribute('aria-checked'))==='false'&&(await p.locator('.rl').first().textContent()).includes('Spenta'));
  await sw.click(); await p.locator('.rl textarea').first().fill('Ciao {nome}, a {data} MODIFICATO'); ok(w+' anteprima messaggio con variabili',(await p.locator('.rl .wa-b').first().textContent()).includes('Cliente 1, a giovedì 12 MODIFICATO'));
  await p.locator('.rl select').first().selectOption('La sera alle 18:00'); ok(w+' scelta orario',(await p.locator('.rl .wa-w').first().textContent()).includes('La sera alle 18:00'));
  ok(w+' regole per settore (palestra: pacchetto)',(await p.locator('.rl-t').allTextContents()).some(x=>/Pacchetto, abbonamento/.test(x)));
  if(w===390||w===1280){ await p.locator('.rls').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({path:`${S}/pannello-regole-${w}.png`}); await p.locator('#dlgB').evaluate(e=>e.scrollTo(0,0)); await p.waitForTimeout(200); await p.screenshot({path:`${S}/flusso-${w}.png`}); }
  await chk('demo-regole');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400); ok(w+' demo chiusa con Esc',!(await dOpen(p))&&(await p.evaluate(()=>document.activeElement.id))==='flussoBtn');
  d=await p.evaluate(()=>JSON.stringify(dati())); ok(w+' nessun dato della demo in d',!d.includes('MODIFICATO')&&!d.includes('La sera alle 18:00'));
  await p.click('#flussoBtn'); await p.waitForTimeout(400); await p.click('#dlgX'); await p.waitForTimeout(300); ok(w+' chiusura con X',!(await dOpen(p)));
  await p.click('#flussoBtn'); await p.waitForTimeout(400); await p.keyboard.press('Tab'); ok(w+' tastiera dentro la finestra',await p.evaluate(()=>document.getElementById('dlgBox').contains(document.activeElement))); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(500); ok(w+' bozza flusso',await p.evaluate(()=>A.flusso.length===2)&&(await p.evaluate(()=>document.getElementById('fFlusso').value)).startsWith('Un messaggio'));
  ok(w+' overflow',bad.length===0,bad.join()); ok(w+' console',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close();
 }
 // altri abbinamenti: gestionale, fogli, assistente
 const p=await L.mk(b,{width:390,height:844}); await p.click('#nextBtn'); await L.s1(p,'Titolare','dentist'); await L.next(p); await L.fixGoal(p);
 for(const [l,re] of [['Gestionale',/Gestionale \+ Automazioni/],['Fogli Excel',/fogli/i],['Assistente che',/Assistente telefono/]]){ await p.evaluate(()=>{A.servizi=[]}); await p.locator('.svcb',{hasText:l}).first().click(); const t=await p.evaluate(()=>{renderIns();return [...document.querySelectorAll('.combo h4')].map(x=>x.textContent).join('|')}); ok('abbinamento per '+l,re.test(t),t); await p.locator('.svcb',{hasText:l}).first().click(); }
 // reduced motion
 const r=await L.mk(b,{width:390,height:844},{reduced:true}); await r.click('#nextBtn'); await L.s1(r,'Titolare','dentist'); await L.to(r,8,async c=>{if(c==='2')await L.fixGoal(r)}); await r.click('#flussoBtn'); await r.waitForTimeout(400);
 ok('reduced-motion: animazioni flusso azzerate',await r.evaluate(()=>{const e=document.querySelector('.fs');const c=getComputedStyle(e);return parseFloat(c.transitionDuration)<0.05&&parseFloat(getComputedStyle(document.querySelector('.combo')||e).animationDuration)<0.05;})); ok('reduced-motion: nessun errore',r.errs.length===0);
 // axe
 const AXE=require('fs').readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
 await r.context().close(); const a=await L.mk(b,{width:390,height:844}); await a.click('#nextBtn'); await L.s1(a,'Titolare','dentist'); await L.to(a,8,async c=>{if(c==='2')await L.fixGoal(a)}); await a.waitForTimeout(900);
 const run=async n=>{ await a.evaluate(AXE); const v=await a.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}})).violations.filter(x=>['serious','critical','moderate'].includes(x.impact)).map(x=>x.id+': '+x.nodes[0].target.join(' ')+' '+(x.nodes[0].failureSummary||'').split('\n')[1])); ok('axe '+n,v.length===0,JSON.stringify(v).slice(0,700)); };
 await run('step8 + Insieme'); await a.click('#flussoBtn'); await a.waitForTimeout(600); await run('demo flusso e regole');
 await b.close(); L.done();
})();
