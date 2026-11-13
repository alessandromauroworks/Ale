// Come lo userebbe una persona vera: segretaria di fretta e titolare pignolo, su telefono e computer.
// Indietro e avanti, cambio di settore e di ruolo a metà, servizi tolti, ricarica a metà (e «Riprendi da dove eri»),
// doppio tocco su invio, testi lunghi con emoji e caratteri strani, fisso con spazi e +39. Più i testi del Privato.
const L=require('./lib.cjs'); const {ok}=L;
const TELOK=t=>/^[+0-9 ().\/-]{6,25}$/.test(t)&&t.replace(/\D/g,'').length>=8&&t.replace(/\D/g,'').length<=15;
(async()=>{
 const b=await L.chromium.launch();
 for(const w of [320,390,1280]){
  const p=await L.mk(b,{width:w,height:w>800?800:700}); const fuori=[]; const chk=async n=>{ if(!(await L.noOverflow(p))) fuori.push(n); };
  await p.click('#nextBtn'); await p.waitForTimeout(250);
  await p.fill('#fNome','Mària 😀 O\'Neil <b>x</b>'); await p.fill('#fTipo','dentist'); await p.waitForTimeout(200); await p.locator('#tipoList .opt').first().click();
  await L.chip(p,'cRuolo','Segretaria'); await p.fill('#fAtt','Studio "Rossi" & C. 🦷'); await chk('s1');
  await L.next(p); await L.fixGoal(p); for(const t of ['Sito','Automazioni','Assistente']) await p.locator('.svcb',{hasText:t}).first().click();
  await p.locator('#svcp_auto .prop').first().click(); await p.fill('#fProblemi','Il telefono 😀 «squilla» & <script>x</script> '.repeat(60)); await chk('s2');
  ok(w+' dentista: nota sui dati con «pazienti»',(await p.textContent('#notaDati')).includes('pazienti'));
  // indietro: cambio settore e ruolo a metà
  await p.click('#backBtn'); await p.waitForTimeout(250); await p.fill('#fTipo','pulizie'); await p.waitForTimeout(200); await p.locator('#tipoList .opt').first().click(); await L.chip(p,'cRuolo','Titolare');
  await L.next(p); await p.waitForTimeout(200);
  const st=await p.evaluate(()=>({s:A.s,spec:A.det.auto.spec,seg:isSeg(),pc:perConto(),nota:document.getElementById('notaDati').textContent}));
  ok(w+' cambio settore: automazioni del vecchio settore tolte, ramo segreteria chiuso',st.s.startsWith('Impresa di servizi')&&st.spec.length===0&&!st.seg&&!st.pc,JSON.stringify(st));
  ok(w+' impresa di pulizie: niente «pazienti»',!/pazient/i.test(st.nota)&&!/pazient/i.test(await p.evaluate(()=>document.querySelector('.step.on').innerText)));
  await p.locator('.svcb',{hasText:'Automazioni'}).first().click();   // tolgo un servizio
  // ricarico a metà (passo 4)
  await L.next(p); await L.next(p); await p.waitForTimeout(500); const prima=await L.cur(p); await p.reload(); await p.waitForTimeout(600);
  ok(w+' ricarica a metà: copertina con «Riprendi da dove eri»',(await L.cur(p))==='0'&&await p.locator('#riprendiBox').isVisible());
  await p.click('#riprendiBtn'); await p.waitForTimeout(400);
  ok(w+' riprendi: torna al passo dov\'era, con i dati',(await L.cur(p))===prima&&await p.evaluate(()=>A.s.startsWith('Impresa di servizi')&&A.servizi.length===2&&document.getElementById('fNome').value.startsWith('Mària')),'passo '+prima+' -> '+await L.cur(p));
  await L.to(p,9,async c=>{ if(c==='2') await L.fixGoal(p); await chk('s'+c); });
  await L.chip(p,'cContatto','Telefono'); await p.fill('#fTel',' +39 0881 68 61 19 '); await p.check('#fPriv'); await L.next(p); await p.waitForTimeout(800); await chk('s10');
  ok(w+' fisso con spazi e +39: si arriva al riepilogo',(await L.cur(p))==='10');
  ok(w+' riepilogo: testo dell\'utente mostrato come testo (niente tag)',await p.evaluate(()=>!document.querySelector('#sum script')&&!document.querySelector('#sum b:not(dt b)')&&document.getElementById('sum').textContent.includes('<script>')));
  await p.evaluate(()=>{document.getElementById('sendBtn').removeAttribute('href')}); await p.dblclick('#sendBtn'); await p.waitForTimeout(1200);
  const inv=p.posts.filter(x=>x.d);
  ok(w+' doppio tocco su invio: un solo salvataggio online',inv.length===1,String(inv.length));
  ok(w+' dati inviati coerenti dopo i cambi',inv[0]&&TELOK(inv[0].d.tel)&&inv[0].d.ruolo==='Titolare o socio'&&!inv[0].d.segreteria&&!inv[0].d.perConto&&!('auto' in inv[0].d.dettagli)&&inv[0].d.servizi.length===2,inv[0]&&inv[0].d.tel);
  ok(w+' dopo l\'invio niente «Riprendi» al ricaricamento',await (async()=>{ await p.reload(); await p.waitForTimeout(500); return p.locator('#riprendiBox').isHidden(); })());
  ok(w+' nessuno scroll orizzontale',fuori.length===0,fuori.join()); ok(w+' console pulita',p.errs.length===0,JSON.stringify(p.errs));
  await p.context().close();
 }
 // riprendi: se manca il consenso (non si salva) si torna al passo del contatto, non al riepilogo
 { const p=await L.mk(b,{width:390,height:844}); await p.click('#fastBtn'); await p.fill('#fNome','Anna'); await p.fill('#fAtt','Studio'); await p.fill('#fTipo','dentist'); await p.waitForTimeout(200); await p.locator('#tipoList .opt').first().click(); await L.chip(p,'cRuolo','Titolare');
   await L.next(p); await L.next(p); await p.fill('#fTel','339 111 2222'); await p.check('#fPriv'); await L.next(p); await p.waitForTimeout(500); ok('veloce: al riepilogo',(await L.cur(p))==='10');
   await p.reload(); await p.waitForTimeout(500); await p.click('#riprendiBtn'); await p.waitForTimeout(400);
   ok('riprendi veloce: torna al contatto (consenso da ridare), resta veloce',(await L.cur(p))==='9'&&await p.evaluate(()=>A.veloce===true&&document.body.classList.contains('fast')));
   ok('riprendi: console pulita',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close(); }
 // Privato: niente «pazienti», niente etichette aziendali nel riepilogo e nel messaggio
 { const p=await L.mk(b,{width:390,height:844}); await p.click('#nextBtn'); await p.fill('#fNome','Luca'); await p.fill('#fTipo','privato'); await p.waitForTimeout(200); await p.locator('#tipoList .opt').first().click(); await L.next(p);
   await L.fixGoal(p); const n=await p.locator('.svcb').count(); for(let j=0;j<n;j++) await p.locator('.svcb').nth(j).click();
   ok('privato: nota sui dati senza pazienti né clienti',/altre persone/.test(await p.textContent('#notaDati')));
   await L.to(p,9); await L.fin(p); await L.to(p,10); await p.waitForTimeout(700);
   const sum=await p.textContent('#sum'), msg=await p.evaluate(()=>invio&&invio.testo);
   ok('privato: riepilogo con i nomi dei servizi per privati',/App o programma su misura/.test(sum)&&!/su misura per noi|per l'attività/.test(sum),sum.slice(0,200));
   ok('privato: messaggio WhatsApp senza «per noi» e «per l\'attività»',msg&&!/su misura per noi|Video e foto per l'attività/.test(msg));
   ok('privato: informativa senza «la tua attività»',!/proposta per la tua attività/.test(await p.textContent('.privacy')));
   ok('privato: console pulita',p.errs.length===0,JSON.stringify(p.errs)); await p.context().close(); }
 ok('copertina: non promette WhatsApp a chi sceglie email o telefono',await (async()=>{ const p=await L.mk(b,{width:390,height:844}); const t=await p.textContent('.step[data-s="0"]'); await p.context().close(); return /se lo scegli, anche su WhatsApp/.test(t); })());
 await b.close(); L.done();
})();
