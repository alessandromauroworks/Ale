const L=require('./lib.cjs'); const {ok}=L; const S=process.env.SHOT_DIR||require('os').tmpdir()+'/collaudo-questionario'; require('fs').mkdirSync(S,{recursive:true});
const AXE=require('fs').readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const axe=async(p,n)=>{ await p.evaluate(AXE); const v=await p.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}})).violations.filter(x=>['serious','critical','moderate'].includes(x.impact)).map(x=>x.id+': '+x.nodes[0].target.join(' ')+' '+(x.nodes[0].failureSummary||'').split('\n')[1])); ok('axe '+n,v.length===0,JSON.stringify(v).slice(0,800)); };
const rec=p=>p.evaluate(()=>{const r=document.querySelector('.pkt th.rec b, .pkk.rec .pkh b');return r?r.textContent:null});
(async()=>{
 const b=await L.chromium.launch();
 // caso 1: solo sito
 let p=await L.mk(b,{width:390,height:844}); await p.click('#nextBtn'); await L.s1(p,'Titolare','idraul'); await L.next(p); await L.fixGoal(p); await p.locator('.svcb',{hasText:'Sito internet'}).click();
 await L.to(p,8,async c=>{if(c==='2')await L.fixGoal(p)}); await p.waitForTimeout(700);
 ok('consigliato: solo sito',await rec(p)==='Solo sito',await rec(p)); 
 ok('canone visibile con sito',await p.locator('#canoneBox').isVisible()); const ct=await p.textContent('#canoneBox'); ok('canone: testo onesto, nessun garantito/zero',!/garant|zero (attacchi|guasti|multe)|100%/i.test(ct)&&/ridurre|ridurli/i.test(ct)&&/restare in regola/.test(ct));
 ok('niente prezzi (nessun euro)', !/€|euro/i.test(await p.textContent('#pkBox'))&&(await p.textContent('#pkBox')).includes('Il prezzo lo vediamo insieme nel preventivo'));
 // tabella
 await p.screenshot({path:`${S}/pk-card-390.png`}); await p.locator('#pkBox .pkc').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/pk-schede-390.png`});
 await p.context().close();
 // desktop: tabella ✓/✗
 p=await L.mk(b,{width:1280,height:900}); await p.click('#nextBtn'); await L.s1(p,'Titolare','idraul'); await L.next(p); await L.fixGoal(p); await p.locator('.svcb',{hasText:'Sito internet'}).click();
 await L.to(p,8,async c=>{if(c==='2')await L.fixGoal(p)}); await p.waitForTimeout(700);
 const tab=await p.evaluate(()=>{const rows=[...document.querySelectorAll('.pkt tbody tr')];return rows.map(r=>[r.querySelector('th').textContent,[...r.querySelectorAll('td')].map(td=>td.querySelector('.sr').textContent)]);});
 const heads=await p.locator('.pkt thead th b').allTextContents();
 const pS=heads.indexOf('Solo sito'),pG=heads.indexOf('Solo gestionale'),pA=heads.indexOf('Assistente');
 const cell=(r,i)=>tab.find(x=>x[0]===r)[1][i-0];
 ok('tabella Solo sito: sito incluso, gestionale no',cell('Sito',pS)==='incluso'&&cell('Gestionale',pS)==='non incluso'&&cell('Manutenzione e sicurezza',pS)==='incluso');
 ok('tabella Solo gestionale',cell('Gestionale',pG)==='incluso'&&cell('Sito',pG)==='non incluso');
 ok('tabella Assistente: a scelta',cell('Assistente WhatsApp',pA).startsWith('a scelta')&&cell('Assistente telefono',pA).startsWith('a scelta'));
 ok('forma diversa dei simboli (circle/rect) e testo nascosto',await p.evaluate(()=>!!document.querySelector('.sy svg circle')&&!!document.querySelector('.sy svg rect')&&document.querySelectorAll('.sy .sr').length>20));
 await p.locator('#pkBox .pkt').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/pk-tabella-1280.png`});
 // scelgo Insieme, completo
 await p.locator('#pkBox .dg .chip',{hasText:'Pacchetto completo'}).click(); await p.waitForTimeout(300); const h2=await p.locator('.pkt thead th b').allTextContents(); ok('completo: colonna Completo',h2.includes('Completo')); 
 await p.locator('#pkBox .pkt .btn').first().click(); await p.waitForTimeout(200); let d=await p.evaluate(()=>dati()); ok('d.pacchetto standard completo',d.pacchetto.standard==='completo'&&d.pacchetto.tipo==='completo'&&Array.isArray(d.pacchetto.suMisura));
 // su misura dal vivo
 await p.locator('#pkBox .dg .chip',{hasText:'Su misura'}).click(); await p.waitForTimeout(300);
 const n0=await p.locator('#pkBox .props .prop[aria-pressed=true]').count(); await p.locator('#pkBox .props .prop',{hasText:'Automazioni'}).click(); await p.waitForTimeout(250);
 ok('su misura si aggiorna dal vivo (voce aggiunta)',(await p.locator('#pkBox .props .prop[aria-pressed=true]').count())===n0+1&&await p.evaluate(()=>pacchettoDati().suMisura.includes('Automazioni')));
 ok('su misura: colonna e tabella aggiornata',(await p.locator('.pkt tbody tr',{hasText:'Automazioni'}).locator('td').first().locator('.sr').textContent())==='incluso');
 await p.locator('#pkBox').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/pk-misura-1280.png`});
 ok('canone con su misura contenente sito',await p.locator('#canoneBox').isVisible());
 // togli sito e gestionale -> canone nascosto
 for(const t of ['Sito','Landing page','Gestionale']){ const b2=p.locator('#pkBox .props .prop',{hasText:new RegExp('^'+t+'$')}); if(await b2.getAttribute('aria-pressed')==='true') await b2.click(); }
 ok('canone nascosto senza sito/gestionale',await p.locator('#canoneBox').isHidden());
 await p.waitForTimeout(900); await axe(p,'step8 pacchetti desktop'); ok('console',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close();
 // caso 2: segretaria con chiamate perse
 p=await L.mk(b,{width:390,height:844}); await p.click('#nextBtn'); await L.s1(p,'Segretaria','dentist'); await L.next(p); await L.fixGoal(p); await L.next(p);
 await L.chip(p,'cTelQ','30-60'); await L.chip(p,'cTelN','Si perde la chiamata');
 await L.next(p); await p.waitForTimeout(500);
 ok('banner consiglio assistente (chiamate perse) a step 4',await p.locator('#consBox .cons').isVisible()&&(await p.textContent('#consBox')).includes('Consiglio:')&&(await p.textContent('#consBox')).includes('si perde la chiamata'));
 ok('banner annunciato (aria-live polite)',(await p.getAttribute('#consBox','aria-live'))==='polite');
 await p.screenshot({path:`${S}/banner-390.png`});
 await p.locator('#consBox button',{hasText:'No grazie'}).click(); await p.waitForTimeout(300); ok('No grazie chiude e registra',await p.locator('#consBox .cons').count()===0&&await p.evaluate(()=>A.consigli.rif.includes('ass-chiamate')));
 await L.next(p); await p.click('#backBtn'); await p.waitForTimeout(300); ok('non si ripresenta',await p.locator('#consBox .cons').count()===0);
 await L.to(p,8); await p.waitForTimeout(600); ok('consigliato: assistente al telefono',/assistent/i.test(await rec(p)||'')&&(await p.locator('.pkk.rec li',{hasText:'Assistente telefono'}).locator('.sr').first().textContent()).match(/incluso|a scelta/)!==null,await rec(p));
 ok('rifiutato non è riproposto in Insieme',!(await p.locator('#insCombos').textContent()).includes('Assistente che risponde al telefono'));
 await p.locator('.pkk.rec .btn').click(); await p.waitForTimeout(200); await L.to(p,9); await L.fin(p); await L.to(p,10); await p.waitForTimeout(600); d=await p.evaluate(()=>dati()); ok('d.consigli rifiutati',d.consigli.rifiutati.includes('ass-chiamate')&&Array.isArray(d.consigli.accettati));
 ok('riepilogo e whatsapp con pacchetto',(await p.textContent('#sum')).includes('Tipo di soluzione')&&await p.evaluate(()=>invio.testo.includes('Pacchetto')));
 ok('console caso 2',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close();
 // caso 3: dentista con promemoria lenti, banner Aggiungilo
 p=await L.mk(b,{width:390,height:844}); await p.click('#nextBtn'); await L.s1(p,'Titolare','dentist'); await L.to(p,4,async c=>{if(c==='2')await L.fixGoal(p)}); await p.waitForTimeout(500);
 await p.locator('.mn',{hasText:'Promemoria'}).locator('.mn-b',{hasText:'Mi porta via tempo'}).click(); await L.next(p); await p.waitForTimeout(500);
 const bt=await p.textContent('#consBox'); ok('banner dai nodi lenti (promemoria)',bt.includes('Consiglio:')&&bt.includes('Promemoria')&&/automazioni collegate/i.test(bt),bt.slice(0,160));
 await p.locator('#consBox button',{hasText:'Aggiungilo'}).click(); await p.waitForTimeout(300);
 ok('Aggiungilo seleziona i servizi',await p.evaluate(()=>A.servizi.length===2&&A.consigli.acc.includes('auto-nodo')));
 await L.to(p,8,async c=>{if(c==='2')await L.fixGoal(p)}); await p.waitForTimeout(700); const r3=await rec(p); ok('consigliato: dentista con promemoria lenti',/Automazioni|Sito \+ gestionale|Solo gestionale/.test(r3||''),r3);
 await p.locator('#insBox').scrollIntoViewIfNeeded(); ok('Insieme non ripete il consiglio accettato',!(await p.locator('#insCombos').textContent()).includes('Automazioni collegate al gestionale'));
 ok('console caso 3',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close();
 // bozza vecchia con pk vecchio
 p=await L.mk(b,{width:390,height:844}); await p.evaluate(()=>localStorage.setItem('qpc:bozza',JSON.stringify({A:{ob:['tempo'],pk:'completo',servizi:[]},f:{fNome:'X'}}))); await p.reload(); await p.waitForTimeout(500);
 ok('bozza vecchia pk=completo mappata',await p.evaluate(()=>A.pk==='completo'&&A.pkTipo==='completo'&&A.pkStd==='completo'&&A.consigli.acc.length===0)&&p.errs.length===0,JSON.stringify(p.errs));
 // niente "garantito" nell'intero file visibile
 const all=await p.evaluate(()=>document.body.innerText+' '+[...document.querySelectorAll('[hidden],aside')].map(e=>e.textContent).join(' ')); ok('nessun garantito/garantisce',!/garantit|garantisc/i.test(all));
 await p.context().close();
 // larghezze
 for(const w of [320,390,768,1280,1440]){ const q=await L.mk(b,{width:w,height:800}); await q.click('#nextBtn'); await L.s1(q,'Segretaria','dentist'); await L.to(q,8,async c=>{if(c==='2')await L.fixGoal(q); if(c==='3'){await L.chip(q,'cTelQ','30-60');}}); await q.waitForTimeout(800);
  let bad=[]; for(const t of ['singolo','insieme','completo','misura']){ await q.locator('#pkBox .dg .chip',{hasText:new RegExp(t==='singolo'?'singolo':t==='insieme'?'Più servizi':t==='completo'?'completo':'misura')}).click(); await q.waitForTimeout(400); if(!(await L.noOverflow(q))) bad.push(t+'@'+await q.evaluate(()=>document.documentElement.scrollWidth)); }
  ok(w+' pacchetti: nessuno scroll orizzontale',bad.length===0,bad.join()); await q.context().close(); }
 // reduced motion
 const r=await L.mk(b,{width:390,height:844},{reduced:true}); await r.click('#nextBtn'); await L.s1(r,'Segretaria','dentist'); await L.to(r,4,async c=>{if(c==='2')await L.fixGoal(r); if(c==='3')await L.chip(r,'cTelQ','30-60');}); await r.waitForTimeout(500);
 ok('reduced-motion: banner senza animazioni',await r.evaluate(()=>{const e=document.querySelector('.cons');return !e||parseFloat(getComputedStyle(e).animationDuration)<0.05;})&&r.errs.length===0);
 await b.close(); L.done();
})();
