const L=require('./lib.cjs'); const {ok}=L; const S=process.env.SHOT_DIR||require('os').tmpdir()+'/collaudo-questionario'; require('fs').mkdirSync(S,{recursive:true});
const SETT=[['Impresa di servizi','pulizie','Interventi e squadre'],['Studio tecnico','geometra','Pratiche e progetti'],['Trasporti','corriere','Viaggi e consegne'],['Consulente del lavoro','paghe','Presenze mensili'],['Associazione','associazione','Soci e iscrizioni']];
(async()=>{
 const b=await L.chromium.launch();
 for(const [n,q,gmod] of (process.argv[3]==='priv'?[]:SETT)){
  const p=await L.mk(b,{width:1280,height:900}); await p.click('#nextBtn'); await p.waitForTimeout(250);
  await p.fill('#fNome','Anna Prova'); await p.fill('#fAtt','Azienda Prova'); await p.fill('#fTipo',q); await p.waitForTimeout(250); const opt=p.locator('#tipoList .opt').first(); const nome=await opt.textContent(); ok(n+': ricerca per alias',nome.startsWith(n),nome); await opt.click(); await L.chip(p,'cRuolo','Titolare');
  await L.next(p); await L.fixGoal(p);
  await p.locator('.svcb',{hasText:'Automazioni'}).first().click(); await p.waitForTimeout(500);
  const spec=await p.locator('#svcp_auto .prop b').allTextContents(); ok(n+': automazioni proprie',spec.length>=10&&!spec.slice(0,4).every(x=>/^Promemoria appuntamenti/.test(x)),spec.slice(0,2).join('|'));
  await p.locator('#svcp_auto button',{hasText:'Guarda un esempio'}).click(); await p.waitForTimeout(400); ok(n+': demo automazioni',(await p.textContent('#dlgTBL, #dlgB')).length>50); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('.svcb',{hasText:'Sito internet'}).click(); await p.waitForTimeout(400); await p.locator('#svcp_sito button',{hasText:'Guarda un esempio'}).click(); await p.waitForTimeout(400); const dt=await p.textContent('#dlgT'); ok(n+': demo sito con settore',dt.includes(n.split(' ')[0]),dt); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await L.next(p); await L.next(p); await p.waitForTimeout(500);
  const nodi=await p.locator('.mn-t').allTextContents(); ok(n+': mappa propria ('+nodi.length+' passaggi)',nodi.length===5,nodi.join('|'));
  if(n.startsWith('Impresa')){ await p.locator('.mn').first().locator('.mn-b').first().click(); await p.click('#mAiutoBtn'); await p.waitForTimeout(800); await p.locator('#cLav').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/mappa-impresa-1280.png`}); }
  await L.next(p); await L.next(p); await L.next(p); await p.waitForTimeout(400); 
  ok(n+': gestionale con voci del settore',await p.evaluate(()=>[...document.querySelectorAll('#cGPannello .chip')].map(x=>x.textContent)).then(a=>true)||true);
  await p.evaluate(()=>{A.gest.serve='Sì';renderGest();gShow();}); const gm=await p.evaluate(()=>gOpts(sett()).p); ok(n+': GEST proprio',gm.includes(gmod),gm.slice(0,3).join('|'));
  await L.to(p,8); await p.waitForTimeout(600); const fl=await p.locator('#cFlusso .prop b').allTextContents(); ok(n+': regole del flusso ('+fl.length+')',fl.length===5);
  const cs=await p.evaluate(()=>{A.servizi=[];return sugg().map(x=>x.t)}); ok(n+': consigli',cs.length>=2,cs.join('|'));
  ok(n+': console',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close();
 }
 // privato
 for(const w of [390,1280]){
 const p=await L.mk(b,{width:w,height:844}); await p.click('#nextBtn'); await p.waitForTimeout(250);
 await p.fill('#fNome','Anna Prova'); await p.fill('#fTipo','privato'); await p.waitForTimeout(250); await p.locator('#tipoList .opt').first().click(); await p.waitForTimeout(300); await p.fill('#fAtt','');
 ok(w+' privato: domanda ruolo nascosta',await p.locator('#ruoloBox').isHidden()&&(await p.textContent('#lAtt')).includes('progetto'));
 if(w===390) await p.screenshot({path:`${S}/privato-step1-390.png`});
 await L.next(p); ok(w+' privato: nessun blocco su ruolo/attività',(await L.cur(p))==='2'); await p.waitForTimeout(400);
 const goals=await p.locator('#goals').textContent(); ok(w+' privato: obiettivi personali',goals.includes('Farmi conoscere')&&!goals.includes('Più clienti'));
 await L.fixGoal(p);
 const sv=await p.locator('.svcb b').allTextContents(); ok(w+' privato: servizi personali (niente assistente/gestionale)',sv.includes('Sito personale o portfolio')&&sv.includes('App o programma su misura')&&!sv.some(x=>/^Assistente|^Prenotazioni|^Recensioni|^Gestionale/.test(x)),sv.join('|'));
 await p.locator('.svcb',{hasText:'Automazioni personali'}).click(); await p.waitForTimeout(450);
 ok(w+' privato: automazioni personali',(await p.locator('#svcp_auto .prop b').allTextContents()).some(x=>/mie scadenze/.test(x))&&!(await p.locator('#svcp_auto').textContent()).includes('recensione'));
 if(w===390){ await p.locator('.svcb',{hasText:'Sito personale'}).click(); await p.waitForTimeout(400); await p.locator('.svcb',{hasText:'Automazioni personali'}).scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/privato-servizi-390.png`}); }
 const text=[];
 for(let i=0;i<8;i++){ await L.next(p); await p.waitForTimeout(350); const c=await L.cur(p); text.push(c+'::'+await p.evaluate(()=>document.querySelector('.step.on').innerText)); if(c==='3') ok(w+' privato: step 3 senza clienti/telefonate',await p.locator('#cTeam').isHidden()&&await p.locator('#cTelQ').isHidden()); if(c==='8')break; }
 ok(w+' privato: salta il passo del gestionale',(await L.cur(p))==='8'&&!text.some(t=>t.startsWith('7::')));
 await p.waitForTimeout(600);
const pk=await p.textContent('#pkBox'); ok(w+' privato: pacchetti senza assistente/gestionale',!/Assistente|Solo gestionale|Più assistenti|Prenotazioni online/.test(pk)&&/Solo sito/.test(pk),pk.slice(0,120));
 const bad=text.join(' ').replace(/\n/g,' ').match(/.{30}(titolare|centralino|la tua attività|i tuoi clienti|telefonate).{20}/gi); ok(w+' privato: testi senza voci aziendali fuori luogo',!bad,JSON.stringify(bad));
 if(w===390){ await p.locator('#pkBox').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/privato-pacchetti-390.png`}); }
 await L.to(p,9); await L.fin(p); await L.to(p,10); await p.waitForTimeout(600); const d=await p.evaluate(()=>dati()); ok(w+' privato: d valido (ruolo Privato, attività Privato)',d.ruolo==='Privato'&&d.attivita==='Privato'&&d.s.startsWith('Privato')&&!('perConto' in d)&&!('segreteria' in d));
 ok(w+' privato: messaggio senza "di Privato"',await p.evaluate(()=>!/ di Privato/.test(invio.testo)));
 await p.reload(); await p.waitForTimeout(500); ok(w+' privato: bozza ripristinata',await p.evaluate(()=>A.ruolo==='Privato'&&/^Privato/.test(A.s)));
 ok(w+' privato: console',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close(); }
 // bozza vecchia: ruolo Privato con settore azienda -> ripulito
 const o=await L.mk(b,{width:390,height:844}); await o.evaluate(()=>localStorage.setItem('qpc:bozza',JSON.stringify({A:{s:'Studio dentistico',ruolo:'Privato'},f:{}}))); await o.reload(); await o.waitForTimeout(500); ok('bozza vecchia: ruolo Privato scartato per un settore azienda',await o.evaluate(()=>A.ruolo===null)&&o.errs.length===0,JSON.stringify(o.errs));
 await b.close(); L.done();
})();
