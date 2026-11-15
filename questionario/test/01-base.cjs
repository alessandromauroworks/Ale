const BASE=process.env.BASE_URL||'http://localhost:8800';
const {chromium}=require('playwright');
const S=process.env.SHOT_DIR||require('os').tmpdir()+'/collaudo-questionario'; require('fs').mkdirSync(S,{recursive:true}); let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:'')); if(!c) fails++;};
const URL=BASE+'/questionario/?att=GB%20Service';
async function mk(b,vp,saveStatus=200){
  const ctx=await b.newContext({viewport:vp,deviceScaleFactor:1}); const p=await ctx.newPage();
  p.errs=[]; p.posts=[]; p.ext=[];
  p.on('pageerror',e=>p.errs.push(String(e))); p.on('console',m=>{if(m.type()==='error'&&!/net::|Failed to load|status of 500/.test(m.text()))p.errs.push(m.text())});
  await p.route(/^https?:\/\/(?!localhost)/,r=>{const q=r.request(); p.ext.push(q.url()); if(q.method()==='POST')p.posts.push(JSON.parse(q.postData()));
    r.fulfill({status:q.url().includes('supabase')?saveStatus:200,contentType:'application/json',body:'{"ok":true}',headers:{'access-control-allow-origin':'*'}})});
  await p.goto(URL); await p.waitForTimeout(200); return p;
}
const cur=p=>p.evaluate(()=>document.querySelector('.step.on').dataset.s);
const next=async p=>{await p.click('#nextBtn');await p.waitForTimeout(250)};
const chip=(p,id,t)=>p.locator(`#${id} .chip`,{hasText:t}).first().click();
async function s1(p,ruolo,tipo='idraul'){
  await p.fill('#fNome','Anna Prova'); await p.fill('#fTipo',tipo); await p.waitForTimeout(200); await p.locator('#tipoList .opt').first().click();
  if(ruolo) await chip(p,'cRuolo',ruolo);
}
async function to(p,target,fn){ // avanza fino allo step target; fn(step) per azioni
  for(let i=0;i<14;i++){ const c=await cur(p); if(c===String(target))return; if(fn) await fn(c); await next(p);} }
async function fin(p,{contatto,tel='339 111 2222',email}){
  await chip(p,'cContatto',contatto); if(email) await p.fill('#fEmail',email); await p.fill('#fTel',tel); await p.check('#fPriv');
}
(async()=>{
 const b=await chromium.launch();
 for(const [nome,vp] of [['tel',{width:390,height:844}],['desk',{width:1280,height:800}]]){
  // ---- titolare
  let p=await mk(b,vp); await next(p); await s1(p,null);
  await next(p); ok(nome+' errore se manca ruolo',(await cur(p))==='1' && /ruolo/i.test(await p.textContent('#err1')));
  await chip(p,'cRuolo','Titolare'); ok(nome+' titolare: per-conto nascosto',await p.locator('#cBranch').isHidden());
  await p.locator('#cRuolo').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/ruolo-${nome}.png`});
  await next(p); await p.click('#goals button >> nth=0'); await next(p); // step3
  ok(nome+' titolare: ramo segreteria nascosto',await p.locator('#sBranch').isHidden());
  await to(p,9,async c=>{if(c==='2'&&!(await p.locator('#goals button[aria-pressed=true]').count()))await p.click('#goals button >> nth=0')});
  await fin(p,{contatto:'WhatsApp'}); await to(p,10);
  await p.waitForTimeout(700); let d=await p.evaluate(()=>invio.d);
  ok(nome+' titolare: d senza segreteria/perConto',!('segreteria' in d)&&!('perConto' in d)&&d.ruolo==='Titolare o socio'&&d.contatto==='WhatsApp');
  ok(nome+' titolare: errori console',p.errs.length===0,JSON.stringify(p.errs));
  await p.context().close();
  // ---- segretaria con email e fisso
  p=await mk(b,vp); await next(p); await s1(p,'Segretaria');
  ok(nome+' segretaria: per-conto visibile',await p.locator('#cBranch').isVisible());
  await p.fill('#fTitolare','Massimo B'); await chip(p,'cTitSa','Non ancora');
  await next(p); await p.click('#goals button >> nth=0');
  await p.locator('.svcb',{hasText:'Assistente che'}).click(); await p.locator('.svcb',{hasText:'Sito internet'}).click(); await chip(p,'cTipoProb','Troppe telefonate'); await chip(p,'cDim','Più cose');
  await p.fill('#fProblemi','Il telefono squilla sempre');
  ok(nome+' etichetta segretaria',/per il titolare/.test(await p.textContent('#lProblemi')));
  await next(p); // step 3
  ok(nome+' segretaria: ramo visibile',await p.locator('#sBranch').isVisible());
  await chip(p,'cTelQ','30-60'); await chip(p,'cTelN','Si perde la chiamata'); await chip(p,'cTelM','Pausa pranzo');
  await chip(p,'cSegPerdite','Il telefono che squilla'); await chip(p,'cSegPerdite','Fissare'); await p.fill('#fSegAiuto','Rispondere alle solite domande');
  await p.locator('#sBranch').scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.screenshot({path:`${S}/segreteria-${nome}.png`});
  await p.reload(); await p.waitForTimeout(500);
  ok(nome+" bozza: ramo e testi",await p.evaluate(()=>!$("sBranch").hidden)&&(await p.inputValue('#fSegAiuto')).includes('solite')&&(await p.locator('#cSegPerdite .chip[aria-pressed=true]').count())===2&&(await p.locator('#cTelM .chip[aria-pressed=true]').count())===1);
  // step 9 validazioni
  await to(p,9,async c=>{if(c==='2'&&!(await p.locator('#goals button[aria-pressed=true]').count()))await p.click('#goals button >> nth=0')});
  await chip(p,'cContatto','Email'); ok(nome+' campo email visibile',await p.locator('#fEmail').isVisible());
  await p.fill('#fTel','0881 686119'); await p.check('#fPriv'); await next(p);
  ok(nome+' errore email mancante',(await cur(p))==='9'&&/email/i.test(await p.textContent('#err7')));
  await p.fill('#fEmail','sbagliata'); await next(p); ok(nome+' errore email non valida',(await cur(p))==='9');
  await p.fill('#fEmail','anna@azienda.it'); await p.fill('#fTel','abc'); await next(p); ok(nome+' errore telefono',(await cur(p))==='9');
  await p.fill('#fTel','0881 686119'); await next(p); ok(nome+' arrivo step 10',(await cur(p))==='10');
  await p.waitForTimeout(700);
  const sm=await p.textContent('#sum'); d=await p.evaluate(()=>invio.d); const txt=await p.evaluate(()=>invio.testo);
  ok(nome+' riepilogo',/Segretaria/.test(sm)&&/Non ancora/.test(sm)&&/30-60/.test(sm)&&/Rispondere alle solite/.test(sm)&&/anna@azienda.it/.test(sm));
  ok(nome+' d segretaria',d.segreteria&&d.segreteria.perdite.length===2&&d.perConto.titolare==='Massimo B'&&d.telefono.quante==='30-60'&&d.email==='anna@azienda.it'&&d.contatto==='Email'&&d.dimensione==='Più cose da mettere in ordine');
  ok(nome+' WhatsApp testo',['Per conto di','Telefono:','Nel lavoro di ogni giorno','Un aiuto in più','Dimensione','Ricontattami: Email'].every(x=>txt.includes(x)));
  await p.evaluate(()=>{$("sendBtn").removeAttribute("href")}); await p.click('#sendBtn'); await p.waitForTimeout(900);
  const post=p.posts.find(x=>x.d); const tel=post&&post.d.tel, cif=tel.replace(/\D/g,'').length;
  ok(nome+' payload tel valido per Edge Function',/^[+0-9 ().\/-]{6,25}$/.test(tel)&&cif>=8&&cif<=15,tel);
  ok(nome+' avviso "già arrivate" dopo ok',await p.locator('#noWa').isVisible()&&await p.locator('#mailBox').isHidden());
  ok(nome+' errori console',p.errs.length===0,JSON.stringify(p.errs)); await p.screenshot({path:`${S}/finale-${nome}.png`});
  await p.locator('#editBtn').click().catch(()=>{});
  await p.evaluate(()=>{go(8)}); await p.waitForTimeout(600);
  await p.screenshot({path:`${S}/pacchetti-seg-${nome}.png`,fullPage:false});
  await p.context().close();
  // ---- salvataggio fallito -> mailto
  p=await mk(b,vp,500); await next(p); await s1(p,'Titolare'); await to(p,9,async c=>{if(c==='2'&&!(await p.locator('#goals button[aria-pressed=true]').count()))await p.click('#goals button >> nth=0')});
  await fin(p,{contatto:'Telefono',}); await to(p,10); await p.waitForTimeout(700);
  await p.evaluate(()=>{$("sendBtn").removeAttribute("href")}); await p.click('#sendBtn'); await p.waitForTimeout(1000);
  const mh=await p.getAttribute('#mailBtn','href');
  ok(nome+' save fallito: mailto, niente "già arrivate"',await p.locator('#mailBox').isVisible()&&await p.locator('#noWa').isHidden()&&mh.startsWith('mailto:alessandromauro.works@gmail.com?subject=')&&mh.length<2500,mh.length);
  await p.context().close();
  p=await mk(b,vp); await next(p); await s1(p,'Titolare'); await next(p); await p.click('#goals button >> nth=0'); await p.locator('.svcb',{hasText:'Sito internet'}).first().click();
  await to(p,8); await p.waitForTimeout(500); pk=await p.textContent('#pkBox');
  await p.screenshot({path:`${S}/pacchetti-sito-${nome}.png`});
  ok(nome+' privacy aggiornata',(await p.evaluate(()=>document.querySelector('.privacy').textContent)).includes('solo se scegli WhatsApp'));
  await p.context().close();
 }
 // ---- bozza vecchia + dimensione 96KB
 const p=await mk(b,{width:390,height:844});
 await p.evaluate(()=>localStorage.setItem('qpc:bozza',JSON.stringify({A:{ob:['tempo'],servizi:['x'],ruolo:'boh',telQuante:5,segPerdite:'no'},f:{fNome:'X'}})));
 await p.reload(); await p.waitForTimeout(500);
 ok('bozza vecchia: normalizzata',await p.evaluate(()=>A.ruolo===null&&A.telQuante===null&&Array.isArray(A.segPerdite)&&Array.isArray(A.telNessuno)&&A.servizi.length===0)&&p.errs.length===0,JSON.stringify(p.errs));
 await p.evaluate(()=>{ A.s=SETTORI[0].n; A.ruolo="Segretaria / segretario"; A.contatto="Email"; A.titolareSa="Non ancora"; A.servizi=[...OPZ.servizi]; A.tipoProblema=[...OPZ.tipoProblema]; A.segPerdite=[...OPZ.segPerdite]; A.telNessuno=[...OPZ.telNessuno]; A.telMomenti=[...OPZ.telMomenti]; A.telQuante="Non so"; A.dimensione=OPZ.dimensione[2]; A.ob=GOALS.map(g=>g[0]);
  FIELDS.forEach(k=>{ const e=$(k); if(e) e.value=("àèé€ù".repeat(2000)).slice(0,+e.maxLength>0?e.maxLength:300); }); });
 const kb=await p.evaluate(()=>new TextEncoder().encode(JSON.stringify({d:dati(),codice:'x'.repeat(0),hp:''})).length);
 ok('payload tutto pieno < 96KB',kb<96_000,kb+' byte');
 await b.close(); console.log('FAILS',fails);
})();
