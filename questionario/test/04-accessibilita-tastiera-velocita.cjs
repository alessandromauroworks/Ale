const BASE=process.env.BASE_URL||'http://localhost:8800';
const L=require('./lib.cjs'); const {ok}=L; const S=process.env.SHOT_DIR||require('os').tmpdir()+'/collaudo-questionario'; require('fs').mkdirSync(S,{recursive:true});
const fs=require('fs'); const AXE=fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const axe=async(p,nome)=>{ await p.evaluate(AXE); const r=await p.evaluate(async()=>{const x=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}});return x.violations.map(v=>({id:v.id,imp:v.impact,n:v.nodes.length,t:v.nodes.slice(0,2).map(n=>n.target.join(' ')+' :: '+(n.failureSummary||'').split('\n')[1])}));});
  const gr=r.filter(v=>v.imp==='serious'||v.imp==='critical'||v.imp==='moderate'); ok('axe '+nome+' (serious/critical/moderate)',gr.length===0,JSON.stringify(gr).slice(0,900)); if(r.length&&!gr.length) console.log('  minor:',r.map(v=>v.id+'('+v.n+')').join(',')); };
(async()=>{
 const b=await L.chromium.launch();
 const p=await L.mk(b,{width:390,height:844});
 await p.waitForTimeout(900); await axe(p,'step0');
 await p.click('#presBtn'); await p.waitForTimeout(500); await axe(p,'presentazione'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(600); await axe(p,'presentazione-mappa'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
 await p.click('#nextBtn'); await p.waitForTimeout(300); await L.s1(p,'Segretaria','dentist'); await p.waitForTimeout(500); await axe(p,'step1');
 await L.next(p); await L.fixGoal(p);
 for(const l of ['Sito internet','Automazioni','Gestionale','Assistente che','Fogli Excel','Velocizzare']) { await p.locator('.svcb',{hasText:l}).first().click(); await p.waitForTimeout(80);} await p.waitForTimeout(500); await axe(p,'step2 pannelli aperti');
 await p.locator('#svcp_sito button',{hasText:'Guarda un esempio'}).click(); await p.waitForTimeout(500); await axe(p,'demo sito'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
 await p.locator('#svcp_auto button',{hasText:'Guarda un esempio'}).click(); await p.waitForTimeout(500); await axe(p,'demo automazioni'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
 for(const [n,name] of [[3,'step3'],[4,'step4 mappa'],[5,'step5'],[6,'step6'],[7,'step7']]){ await L.to(p,n); await p.waitForTimeout(500); if(n===4){await p.locator('.mn').first().locator('.mn-b').first().click(); await p.click('#mAiutoBtn'); await p.waitForTimeout(700);} if(n===7){ await p.locator('#cGServe .chip').first().click(); await p.waitForTimeout(400);} await axe(p,name); }
 await L.to(p,8); await p.waitForTimeout(600); await axe(p,'step8'); await L.to(p,9); await p.waitForTimeout(500); await axe(p,'step9');
 await L.fin(p,{contatto:'Email',email:'a@b.it'}); await L.to(p,10); await p.waitForTimeout(700); await axe(p,'step10'); 
 // percorso con sola tastiera
 const k=await L.mk(b,{width:1280,height:800});
 const press=async(key,n=1)=>{for(let i=0;i<n;i++){await k.keyboard.press(key);await k.waitForTimeout(40);}};
 const focusTo=async(sel,max=140)=>{for(let i=0;i<max;i++){ if(await k.evaluate(s=>document.activeElement&&document.activeElement.matches(s),sel))return true; await k.keyboard.press('Tab');} return false;};
 await focusTo('#nextBtn'); await k.keyboard.press('Enter'); await k.waitForTimeout(400);
 await k.focus('#fNome'); await k.keyboard.type('Anna Prova'); await k.keyboard.press('Tab'); await k.keyboard.type('GB Service'.slice(0,0)); 
 await k.focus('#fTipo'); await k.keyboard.type('dentist'); await k.waitForTimeout(250); await k.keyboard.press('ArrowDown'); await k.keyboard.press('ArrowUp'); await k.keyboard.press('Enter');
 ok('tastiera: tipo scelto con frecce+Invio',await k.evaluate(()=>A.s==='Studio dentistico'));
 ok('tastiera: ruolo con Tab+Spazio',await focusTo('#cRuolo .chip')&&(await (async()=>{await k.keyboard.press('Space'); return k.evaluate(()=>A.ruolo==='Titolare o socio');})()));
 await focusTo('#nextBtn'); await k.keyboard.press('Enter'); await k.waitForTimeout(400);
 ok('tastiera: obiettivo con Spazio',await focusTo('#goals .card')&&(await (async()=>{await k.keyboard.press('Space'); await k.waitForTimeout(100); return k.evaluate(()=>A.ob.length===1);})()));
 ok('tastiera: servizio con Invio apre pannello',await focusTo('.svcb')&&(await (async()=>{await k.keyboard.press('Enter'); await k.waitForTimeout(450); return k.evaluate(()=>A.servizi.length===1&&document.querySelector('.svcb[aria-expanded=true]'));})()));
 await focusTo('#nextBtn'); for(let n=0;n<2;n++){await k.keyboard.press('Enter'); await k.waitForTimeout(350); await focusTo('#nextBtn');} // step 4
 ok('tastiera: siamo alla mappa',(await L.cur(k))==='4');
 ok('tastiera: nodo segnato con Invio',await focusTo('.mn .mn-b')&&(await (async()=>{await k.keyboard.press('Enter'); return k.evaluate(()=>A.lav.length===1);})()));
 await k.keyboard.press('ArrowDown'); ok('tastiera: frecce tra i nodi',await k.evaluate(()=>document.activeElement.closest('.mn')===document.querySelectorAll('.mn')[1]));
 await focusTo('#nextBtn'); for(let n=0;n<5;n++){await k.keyboard.press('Enter'); await k.waitForTimeout(350); if((await L.cur(k))==='9')break; await focusTo('#nextBtn');}
 ok('tastiera: arrivo step 9',(await L.cur(k))==='9');
 await k.focus('#fTel'); await k.keyboard.type('0881 686119'); ok('tastiera: consenso con Spazio',await focusTo('#fPriv')&&(await (async()=>{await k.keyboard.press('Space'); return k.evaluate(()=>document.getElementById('fPriv').checked);})()));
 await focusTo('#nextBtn'); await k.keyboard.press('Enter'); await k.waitForTimeout(500); ok('tastiera: arrivo al riepilogo',(await L.cur(k))==='10');
 ok('tastiera: nessun errore console',k.errs.length===0,JSON.stringify(k.errs));
 // reduced motion
 const r=await L.mk(b,{width:390,height:844},{reduced:true}); await r.click('#presBtn'); await r.waitForTimeout(400);
 const dur=await r.evaluate(()=>{const e=document.querySelector('.pz-s');return getComputedStyle(e).animationDuration;}); ok('prefers-reduced-motion: animazioni azzerate',parseFloat(dur)<0.05,dur);
 const tr=await r.evaluate(()=>getComputedStyle(document.getElementById('dlgBox')).transitionDuration); ok('prefers-reduced-motion: transizioni azzerate',parseFloat(tr)<0.05,tr);
 await r.keyboard.press('Escape'); await r.click('#nextBtn'); await r.waitForTimeout(400); ok('prefers-reduced-motion: nessun errore',r.errs.length===0);
 // zoom 200%: 640px di larghezza css
 const z=await L.mk(b,{width:640,height:600}); await z.click('#nextBtn'); await z.waitForTimeout(300); await L.s1(z,'Segretaria','dentist'); await L.next(z); await L.fixGoal(z); for(const l of ['Sito internet','Automazioni']) {await z.locator('.svcb',{hasText:l}).first().click();} await z.waitForTimeout(500);
 ok('zoom 200% (640px): nessuno scroll orizzontale',await L.noOverflow(z));
 // prestazioni con CPU rallentata 4x
 const pf=await b.newContext({viewport:{width:390,height:844}}); const pg=await pf.newPage(); const cdp=await pf.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await pg.route(/^https?:\/\/(?!localhost)/,r=>r.fulfill({status:200,body:'{}'}));
 const t0=Date.now(); await pg.goto(BASE+'/questionario/',{waitUntil:'commit'}); await pg.waitForSelector('h1',{state:'visible'}); await pg.waitForFunction(()=>document.getElementById('nextBtn')&&!document.getElementById('nextBtn').hidden); const t=Date.now()-t0;
 const nav=await pg.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),size:n.transferSize}});
 ok('prima schermata usabile < 2 s (CPU 4x)',t<2000,t+' ms; '+JSON.stringify(nav));
 await b.close(); L.done();
})();
