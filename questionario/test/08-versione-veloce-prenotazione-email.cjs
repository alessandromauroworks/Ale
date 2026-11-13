const BASE=process.env.BASE_URL||'http://localhost:8800';
const L=require('./lib.cjs'); const {ok}=L; const S=process.env.SHOT_DIR||require('os').tmpdir()+'/collaudo-questionario'; require('fs').mkdirSync(S,{recursive:true});
const TELOK=t=>/^[+0-9 ().\/-]{6,25}$/.test(t)&&t.replace(/\D/g,'').length>=8&&t.replace(/\D/g,'').length<=15;
async function conUrl(b,vp,prenota){ const ctx=await b.newContext({viewport:vp,deviceScaleFactor:1}); const p=await ctx.newPage(); p.errs=[]; p.posts=[];
  p.on('pageerror',e=>p.errs.push(String(e))); p.on('console',m=>{if(m.type()==='error'&&!/net::|Failed to load/.test(m.text()))p.errs.push(m.text())});
  await p.route(/^https?:\/\/(?!localhost)/,r=>{const q=r.request(); if(q.method()==='POST')p.posts.push(JSON.parse(q.postData())); r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}',headers:{'access-control-allow-origin':'*'}})});
  if(prenota!==undefined) await p.route(u=>u.href.startsWith(BASE+'/questionario/'),async r=>{const res=await r.fetch(); let t=await res.text(); t=t.replace('const PRENOTA_URL = "";','const PRENOTA_URL = "'+prenota+'";'); r.fulfill({response:res,body:t});});
  await p.goto(BASE+'/questionario/'); await p.waitForTimeout(250); return p; }
(async()=>{
 const b=await L.chromium.launch();
 // ---- versione veloce
 for(const w of [390,1280]){
  const p=await conUrl(b,{width:w,height:844}); const bad=[]; const chk=async n=>{await p.waitForTimeout(450); if(!(await L.noOverflow(p))) bad.push(n)};
  ok(w+' step0: due percorsi e pulsanti',await p.locator('#fastBtn').isVisible()&&(await p.textContent('#nextBtn')).includes('Inizia il questionario')&&(await p.textContent('#fastBtn')).includes('Versione veloce')); await chk('s0'); if(w===390) await p.screenshot({path:`${S}/veloce-step0-390.png`});
  await p.click('#fastBtn'); await p.waitForTimeout(450); ok(w+' veloce: "1 di 3"',(await p.textContent('#count')).includes('1 di 3')&&await p.evaluate(()=>document.body.classList.contains('fast')));
  ok(w+' veloce: città nascosta',await p.locator('#fCitta').isHidden());
  await p.fill('#fNome','Anna Prova'); await p.fill('#fAtt','Studio Prova'); await p.fill('#fTipo','dentist'); await p.waitForTimeout(250); await p.locator('#tipoList .opt').first().click(); await L.chip(p,'cRuolo','Titolare'); await chk('s1');
  if(w===390) await p.screenshot({path:`${S}/veloce-step1-390.png`});
  await L.next(p); ok(w+' veloce: step 2 "2 di 3", obiettivi e dettagli nascosti',(await L.cur(p))==='2'&&(await p.textContent('#count')).includes('2 di 3')&&await p.locator('#goals').isHidden()&&await p.locator('#cTipoProb').isHidden()&&(await p.textContent('#h2s2')).includes('Su cosa ti posso aiutare'));
  await p.locator('.svcb',{hasText:'Sito internet'}).click(); await p.fill('#fProblemi','Il telefono squilla sempre'); await chk('s2'); if(w===390){ await p.locator('#fProblemi').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/veloce-step2-390.png`}); }
  await L.next(p); await p.waitForTimeout(300); ok(w+' veloce: salta a "Contatto 3 di 3" senza obbligo di obiettivo',(await L.cur(p))==='9'&&(await p.textContent('#count')).includes('3 di 3')&&await p.locator('#cTempi').isHidden()&&await p.locator('#cPag').isHidden());
  await p.click('#backBtn'); await p.waitForTimeout(300); ok(w+' veloce: indietro torna al 2',(await L.cur(p))==='2'); await L.next(p);
  await p.fill('#fTel','0881 686119'); await L.next(p); ok(w+' veloce: senza consenso resta qui',(await L.cur(p))==='9'); await p.check('#fPriv'); await L.chip(p,'cContatto','Telefono'); await chk('s9'); if(w===390) await p.screenshot({path:`${S}/veloce-step9-390.png`});
  await L.next(p); ok(w+' veloce: riepilogo',(await L.cur(p))==='10'); await p.waitForTimeout(700); await p.evaluate(()=>{document.getElementById('sendBtn').removeAttribute('href')}); await p.click('#sendBtn'); await p.waitForTimeout(900);
  const post=p.posts.find(x=>x.d); ok(w+' veloce: invio online con d.versione=veloce e telefono valido',post&&post.d.versione==='veloce'&&TELOK(post.d.tel)&&post.d.attivita==='Studio Prova'&&post.d.consenso&&typeof post.codice==='string',post&&post.d.tel);
  ok(w+' veloce: invito a continuare',await p.locator('#piuBox').isVisible()); await chk('s11'); if(w===390){ await p.screenshot({path:`${S}/veloce-fine-390.png`}); }
  await p.click('#piuBtn'); await p.waitForTimeout(500); ok(w+' continua: riprende dal passo 2 con i dati',(await L.cur(p))==='2'&&await p.evaluate(()=>!A.veloce&&!document.body.classList.contains('fast')&&A.servizi.length===1)&&(await p.inputValue('#fProblemi')).includes('squilla')&&(await p.inputValue('#fNome'))==='Anna Prova'&&await p.locator('#goals').isVisible());
  await L.to(p,10,async c=>{if(c==='2')await L.fixGoal(p)}); await p.waitForTimeout(700); await p.evaluate(()=>{document.getElementById('sendBtn').removeAttribute('href')}); await p.click('#sendBtn'); await p.waitForTimeout(900);
  const post2=p.posts.filter(x=>x.d).pop(); ok(w+' continua: secondo invio completo',p.posts.filter(x=>x.d).length===2&&post2.d.versione==='completa'&&TELOK(post2.d.tel));
  ok(w+' veloce: overflow',bad.length===0,bad.join()); ok(w+' veloce: console',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close();
 }
 // bozza veloce dopo reload
 { const p=await conUrl(b,{width:390,height:844}); await p.click('#fastBtn'); await p.fill('#fNome','Luca'); await p.waitForTimeout(500); await p.reload(); await p.waitForTimeout(500);
   ok('bozza: la versione veloce resta dopo il ricaricamento',await p.evaluate(()=>A.veloce===true&&document.body.classList.contains('fast'))); await p.click('#nextBtn'); await p.waitForTimeout(300); ok('bozza: "Inizia" porta alla versione completa',await p.evaluate(()=>!A.veloce)); await p.context().close(); }
 // overflow step 0 su tutte le larghezze
 for(const w of [320,390,768,1280,1440]){ const p=await conUrl(b,{width:w,height:800}); await p.waitForTimeout(600); ok(w+' step 0 senza scroll orizzontale',await L.noOverflow(p)); await p.context().close(); }
 // ---- prenotazione
 const prenotaCase=async(url,contatto,nome)=>{ const p=await conUrl(b,{width:390,height:844},url); await p.click('#fastBtn'); await p.fill('#fNome','Anna Prova'); await p.fill('#fAtt','Studio Prova'); await p.fill('#fTipo','dentist'); await p.waitForTimeout(250); await p.locator('#tipoList .opt').first().click(); await L.chip(p,'cRuolo','Titolare'); await L.next(p); await L.next(p);
   await L.chip(p,'cContatto',contatto); if(contatto==='Email') await p.fill('#fEmail','anna@azienda.it'); await p.fill('#fTel','339 111 2222'); await p.check('#fPriv'); await L.next(p); await p.waitForTimeout(700); await p.evaluate(()=>{document.getElementById('sendBtn').removeAttribute('href')}); await p.click('#sendBtn'); await p.waitForTimeout(900);
   const r={txt:await p.textContent('#bookBtn'),href:await p.getAttribute('#bookBtn','href'),hint:await p.textContent('#bookHint'),errs:p.errs}; await p.screenshot({path:`${S}/prenota-${nome}.png`}); await p.context().close(); return r; };
 let r=await prenotaCase('https://calendar.app.google/XXXX','WhatsApp','google'); ok('prenota: Google Calendar',r.txt==='Scegli giorno e ora'&&r.href==='https://calendar.app.google/XXXX'&&r.hint.includes('Google Meet')&&r.hint.includes('invito via email'),JSON.stringify(r));
 r=await prenotaCase('https://calendar.google.com/calendar/appointments/schedules/ABC','WhatsApp','google2'); ok('prenota: calendar.google.com',r.txt==='Scegli giorno e ora'&&r.href.startsWith('https://calendar.google.com/')&&r.hint.includes('Google Meet'));
 r=await prenotaCase('https://cal.com/esempio/call-conoscitiva','WhatsApp','cal'); ok('prenota: cal.com con name e notes',r.txt==='Scegli giorno e ora'&&/name=Anna\+Prova|name=Anna%20Prova/.test(r.href)&&r.href.includes('notes='),r.href.slice(0,140));
 r=await prenotaCase('','WhatsApp','vuoto-wa'); ok('prenota: vuoto + WhatsApp -> wa.me',r.href.startsWith('https://wa.me/')&&/WhatsApp/.test(r.txt));
 r=await prenotaCase('','Email','vuoto-email'); ok('prenota: vuoto + Email -> niente WhatsApp, mailto e "Ti scrivo io"',r.href.startsWith('mailto:alessandromauro.works@gmail.com')&&!/WhatsApp/.test(r.txt+r.hint)&&r.hint.includes('Ti scrivo io per fissare la call'),JSON.stringify(r).slice(0,200));
 r=await prenotaCase('','Telefono (anche fisso)','vuoto-tel'); ok('prenota: vuoto + Telefono -> "Ti chiamo io", niente WhatsApp',r.href.startsWith('mailto:')&&r.hint.includes('Ti chiamo io')&&!/WhatsApp/.test(r.txt+r.hint));
 r=await prenotaCase('http://cal.com/x','WhatsApp','http'); ok('prenota: link non https ignorato (fallback)',r.href.startsWith('https://wa.me/'));
 // ---- copia per email
 { const p=await conUrl(b,{width:390,height:844}); await p.click('#nextBtn'); await p.fill('#fAtt','Studio Prova'); await L.s1(p,'Titolare','dentist'); await L.to(p,9,async c=>{if(c==='2')await L.fixGoal(p)});
   await L.chip(p,'cContatto','WhatsApp'); ok('copia: casella nascosta senza email',await p.locator('#copiaBox').isHidden());
   await L.chip(p,'cContatto','Email'); ok('copia: ancora nascosta con campo email vuoto',await p.locator('#copiaBox').isHidden()); await p.fill('#fEmail','anna@azienda.it'); ok('copia: compare con un\'email',await p.locator('#copiaBox').isVisible());
   await p.check('#fCopia'); await p.fill('#fTel','339 111 2222'); await p.check('#fPriv'); await L.next(p); await p.waitForTimeout(600); let d=await p.evaluate(()=>dati()); ok('copia: d.copiaEmail e d.email',d.copiaEmail===true&&d.email==='anna@azienda.it');
   ok('informativa: servizio di invio email',(await p.evaluate(()=>document.querySelector('.privacy').textContent)).includes('servizio di invio email'));
   await p.click('#backBtn'); await p.waitForTimeout(300); await p.fill('#fEmail','sbagliata'); d=await p.evaluate(()=>dati()); ok('copia: email non valida -> copiaEmail falso',d.copiaEmail===false);
   await p.screenshot({path:`${S}/copia-email-390.png`}); ok('copia: console',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close(); }
 await b.close(); L.done();
})();
