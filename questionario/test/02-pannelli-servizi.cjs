const L=require('./lib.cjs'); const {ok}=L; const S=process.env.SHOT_DIR||require('os').tmpdir()+'/collaudo-questionario'; require('fs').mkdirSync(S,{recursive:true});
(async()=>{
 const b=await L.chromium.launch();
 // percorso completo con pannelli, dentista, sul telefono
 for(const [nome,vp] of [['tel',{width:390,height:844}],['desk',{width:1280,height:800}]]){
  let p=await L.mk(b,vp); await p.click('#nextBtn'); await p.waitForTimeout(250);
  await L.s1(p,'Titolare','dentist'); await L.next(p); await L.fixGoal(p);
  const sv=l=>p.locator('.svcb',{hasText:l}).first();
  ok(nome+' 13 servizi con descrizione',await p.locator('.svcb').count()===13 && (await p.locator('.svcb .d').count())===13);
  await sv('Automazioni').click(); await p.waitForTimeout(500);
  ok(nome+' pannello automazioni aperto (aria-expanded)',(await sv('Automazioni').getAttribute('aria-expanded'))==='true'&&await p.locator('#svcp_auto .prop').first().isVisible());
  const spec=await p.locator('#svcp_auto .prop b').allTextContents(); ok(nome+' automazioni dentista',spec.some(x=>/igiene/i.test(x)),spec.length);
  await p.locator('#svcp_auto .prop',{hasText:'igiene'}).click(); await p.locator('#svcp_auto .prop',{hasText:'Promemoria appuntamenti'}).click();
  await p.fill('#d_auto_testo','Vorrei che scrivesse da solo');
  await sv('Sito').click(); await p.waitForTimeout(450);
  await p.locator('#svcp_sito .prop',{hasText:'Landing'}).click(); await p.locator('#svcp_sito .prop',{hasText:'Galleria'}).click(); await p.fill('#d_sito_url','www.esempio.it');
  await p.locator('#svcp_auto').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/pannello-auto-${nome}.png`});
  await p.locator('#svcp_sito').scrollIntoViewIfNeeded(); await p.waitForTimeout(100); await p.screenshot({path:`${S}/pannello-sito-${nome}.png`});
  await sv('Fogli Excel').click(); await p.waitForTimeout(400); await p.locator('#svcp_fogli .prop',{hasText:'Portarli in un gestionale'}).click();
  await sv('Social').click(); await p.waitForTimeout(400); await p.locator('#svcp_social .prop').first().click(); await sv('Social').click(); await p.waitForTimeout(450);
  ok(nome+' pannello si chiude',(await sv('Social').getAttribute('aria-expanded'))==='false'&&await p.locator('#svcp_social').isHidden());
  let d=await p.evaluate(()=>dati());
  ok(nome+' d.dettagli: auto,sito,fogli; social escluso',d.dettagli.auto&&d.dettagli.sito&&d.dettagli.fogli&&!d.dettagli.social&&d.dettagli.sito.tipo.startsWith('Landing'),Object.keys(d.dettagli).join());
  // cambio settore: patronato
  await p.click('#backBtn'); await p.waitForTimeout(250); await p.fill('#fTipo','patronato'); await p.waitForTimeout(200); await p.locator('#tipoList .opt').first().click(); await L.next(p); await L.fixGoal(p);
  const spec2=await p.locator('#svcp_auto .prop b').allTextContents(); ok(nome+' automazioni patronato diverse',spec2.some(x=>/pratica pronta/i.test(x))&&!spec2.some(x=>/igiene/i.test(x)));
  ok(nome+' scelte non valide scartate da d',!(JSON.stringify(await p.evaluate(()=>dati().dettagli.auto||{})).includes('igiene')));
  ok(nome+' generiche mantenute',(await p.evaluate(()=>dati().dettagli.auto.gen||[])).some(x=>/Promemoria appuntamenti/.test(x)));
  // bozza
  await p.reload(); await p.waitForTimeout(500); await p.click('#nextBtn'); 
  ok(nome+' nessun errore',p.errs.length===0,JSON.stringify(p.errs));
  await p.context().close();
 }
 // step: overflow su tutte le larghezze, percorso con anteprima gestionale
 for(const w of [320,390,768,1280,1440]){
  const p=await L.mk(b,{width:w,height:800}); const bad=[];
  const chk=async n=>{ await p.waitForTimeout(450); if(!(await L.noOverflow(p))) bad.push(n+'@'+await p.evaluate(()=>document.documentElement.scrollWidth)); };
  await chk('s0'); await p.click('#nextBtn'); await p.waitForTimeout(250); await L.s1(p,'Segretaria','dentist'); await chk('s1'); await L.next(p); await L.fixGoal(p);
  for(const l of ['Sito','Automazioni','Gestionale','Assistente','Fogli Excel','Velocizzare','Altro']){ await p.locator('.svcb',{hasText:l}).first().click(); await p.waitForTimeout(100);} await p.waitForTimeout(500); await chk('s2-aperti');
  await L.next(p); await chk('s3'); await L.next(p); await chk('s4'); await L.next(p); await chk('s5'); await L.next(p); await chk('s6'); await L.next(p); 
  ok(w+' step7 anteprima presente',(await L.cur(p))==='7'&&await p.locator('#gpNav button').count()>0);
  await chk('s7');
  if(w===390||w===1280){ // anteprima: naviga e sincronizza
    const nome=w===390?'tel':'desk'; const mods=await p.locator('#gpNav button').allTextContents();
    await p.locator('#gpNav button').nth(1).click(); await p.waitForTimeout(300);
    const h=await p.textContent('#gpMain h4'); ok(w+' anteprima mostra modulo scelto',h===mods[1],h);
    await p.locator('#gpMain .chip').click(); await p.waitForTimeout(150);
    ok(w+' anteprima -> pannello sincronizzato',(await p.evaluate(()=>A.gest.pannello)).includes(mods[1])&&(await p.locator('#cGPannello .chip[aria-pressed=true]').count())===1);
    await p.locator('#cGPannello .chip').nth(2).click(); await p.waitForTimeout(100);
    ok(w+' chip -> anteprima sincronizzata',(await p.locator('#gpNav button.in').count())===2);
    await p.locator('#gpBox').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({path:`${S}/anteprima-${nome}.png`});
  }
  await L.next(p); await chk('s8'); await L.next(p); await chk('s9'); await L.fin(p); await L.next(p); await chk('s10');
  await p.waitForTimeout(600); await p.evaluate(()=>{$("sendBtn").removeAttribute("href")}); await p.click('#sendBtn'); await p.waitForTimeout(700); await chk('s11');
  L.ok(w+' nessuno scroll orizzontale',bad.length===0,bad.join()); L.ok(w+' nessun errore console',p.errs.length===0,JSON.stringify(p.errs));
  await p.context().close();
 }
 // payload massimo
 const p=await L.mk(b,{width:390,height:844});
 const r=await p.evaluate(()=>{ A.s=SETTORI[0].n; A.ruolo="Segretaria / segretario"; A.contatto="Email"; A.titolareSa="Non ancora"; A.servizi=[...OPZ.servizi]; A.tipoProblema=[...OPZ.tipoProblema]; A.segPerdite=[...OPZ.segPerdite]; A.telNessuno=[...OPZ.telNessuno]; A.telMomenti=[...OPZ.telMomenti]; A.ob=GOALS.map(g=>g[0]);
  const rnd=n=>Array.from({length:n},()=>"àèéùòì€ñüßabcdefghijklmnopqrstuvwxyz0123456789 ".charAt(Math.floor(Math.random()*52))).join("");
  FIELDS.forEach(k=>{const e=$(k); if(e) e.value=rnd(+e.maxLength>0?e.maxLength:300)});
  Object.keys(PAN).forEach(k=>PAN[k].forEach(bl=>{ if(bl.k==="text"||bl.k==="url") A.det[k][bl.id]=rnd(bl.m||DET_MAX); else if(bl.k==="many"){ const o=optsOf(bl); A.det[k][bl.id]=o?[...o]:[]; } else { const o=optsOf(bl); A.det[k][bl.id]=o?o[0]:null; } }));
  const d=dati(); return { d:new TextEncoder().encode(JSON.stringify({d})).length, n:Object.keys(d.dettagli).length }; });
 ok('payload tutto pieno (random incomprimibile) < 48KB',r.d<48*1024,r.d+' byte, servizi con dettagli '+r.n);
 await b.close(); L.done();
})();
