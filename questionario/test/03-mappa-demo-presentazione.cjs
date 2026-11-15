const L=require('./lib.cjs'); const {ok}=L; const S=process.env.SHOT_DIR||require('os').tmpdir()+'/collaudo-questionario'; require('fs').mkdirSync(S,{recursive:true});
const dlgOpen=p=>p.evaluate(()=>!document.getElementById('dlg').hidden);
(async()=>{
 const b=await L.chromium.launch();
 for(const w of [320,390,768,1280,1440]){
  const nome=w;const bad=[]; const p=await L.mk(b,{width:w,height:w<700?740:860});
  const chk=async n=>{ await p.waitForTimeout(450); if(!(await L.noOverflow(p))) bad.push(n+'@'+await p.evaluate(()=>document.documentElement.scrollWidth)); };
  // presentazione
  await chk('s0'); await p.click('#presBtn'); await p.waitForTimeout(400); await chk('pres1');
  ok(w+' presentazione aperta, role dialog',await dlgOpen(p)&&(await p.getAttribute('#dlgBox','role'))==='dialog'&&(await p.getAttribute('#dlgBox','aria-modal'))==='true');
  ok(w+' focus dentro la finestra',await p.evaluate(()=>document.getElementById('dlgBox').contains(document.activeElement)));
  if(w===390||w===1280){ await p.screenshot({path:`${S}/pres-1-${w}.png`}); }
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(450); await chk('pres2');
  ok(w+' frecce avanzano (mappa concettuale)',await p.locator('.cm').count()===1);
  await p.locator('.cm-l').first().click(); ok(w+' foglia mostra la riga',(await p.textContent('.cm-d')).includes('Una pagina'));
  await p.waitForTimeout(900); if(w===390||w===1280) await p.screenshot({path:`${S}/pres-mappa-${w}.png`});
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); await chk('pres3'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); await chk('pres4'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); await chk('pres5');
  ok(w+' ultima schermata: Inizia + sito',(await p.locator('#dlgB >> text=Inizia il questionario').count())===1&&await p.locator('#dlgB a[href="https://alessandromauro.lovable.app/"]').count()===1);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(300); ok(w+' freccia indietro',await p.locator('.pc').count()===1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400); ok(w+' Esc chiude e restituisce il focus',!(await dlgOpen(p))&&(await p.evaluate(()=>document.activeElement.id))==='presBtn');
  await p.click('#presBtn'); await p.waitForTimeout(300); await p.mouse.click(3,3); await p.waitForTimeout(400); 
  ok(w+' tocco fuori chiude (solo desktop) o resta',w<768?await dlgOpen(p):!(await dlgOpen(p)));
  if(await dlgOpen(p)){ await p.click('#dlgX'); await p.waitForTimeout(350); }
  await p.click('#presBtn'); await p.waitForTimeout(300); await p.locator('text=Salta e vai alle domande').click(); await p.waitForTimeout(700);
  ok(w+' Salta porta alle domande',(await L.cur(p))==='1'&&!(await dlgOpen(p)));
  // swipe (solo mobile-like): simula eventi touch
   
  await L.s1(p,'Titolare','dentist'); await L.next(p); await L.fixGoal(p);
  // demo sito
  await p.locator('.svcb',{hasText:'Sito internet'}).click(); await p.waitForTimeout(450);
  await p.locator('#svcp_sito .prop',{hasText:'Elegante'}).click();
  await p.locator('#svcp_sito button',{hasText:'Guarda un esempio per'}).click(); await p.waitForTimeout(500); await chk('demo-sito');
  ok(w+' demo sito aperta con stile Elegante dal pannello',await p.locator('.sd.st-ele').count()===1&&(await p.textContent('#dlgB')).includes('Esempio con dati inventati'));
  if(w===390||w===1280){ await p.screenshot({path:`${S}/demo-sito-tel-${w}.png`}); }
  await p.locator('#dlgB .dg button',{hasText:'Computer'}).click(); await p.waitForTimeout(400); await chk('demo-sito-pc'); ok(w+' demo sito versione computer',await p.locator('.sd-frame.d-pc').count()===1);
  if(w===390||w===1280){ await p.screenshot({path:`${S}/demo-sito-pc-${w}.png`}); }
  await p.locator('#dlgB .dg button',{hasText:'Effetto wow'}).click(); await p.waitForTimeout(500); ok(w+' stile wow dal vivo',await p.locator('.sd.st-wow').count()===1);
  if(w===1280){ await p.locator('#dlgB .dg button',{hasText:'Telefono'}).click(); await p.waitForTimeout(500); await p.screenshot({path:`${S}/demo-sito-wow-${w}.png`}); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(400); ok(w+' demo sito chiusa con Esc, focus al bottone',!(await dlgOpen(p))&&(await p.evaluate(()=>document.activeElement.textContent)).includes('Guarda un esempio'));
  // demo automazioni
  await p.locator('.svcb',{hasText:'Automazioni'}).click(); await p.waitForTimeout(450);
  await p.locator('#svcp_auto button',{hasText:'Guarda un esempio per'}).click(); await p.waitForTimeout(500); await chk('demo-auto');
  const before=await p.locator('.fs.s-done,.fs.s-now').count(); await p.locator('#dlgB button',{hasText:'Passo dopo passo'}).click(); await p.locator('#dlgB button',{hasText:'Passo dopo passo'}).click();
  ok(w+' automazione passo per passo',(await p.locator('.fs.s-now').count())===1&&(await p.locator('.fs.s-done').count())===1&&before===0);
  await p.locator('#dlgB button',{hasText:'Riproduci'}).click(); await p.waitForTimeout(4600); ok(w+' automazione riproduce fino in fondo',(await p.locator('.fs.s-done').count())>=3);
  if(w===390||w===1280) await p.screenshot({path:`${S}/demo-auto-${w}.png`});
  await p.click('#dlgX'); await p.waitForTimeout(350);
  // demo gestionale da pannello
  await p.locator('.svcb',{hasText:'Gestionale'}).first().click(); await p.waitForTimeout(450);
  await p.locator('#svcp_gest button',{hasText:"Guarda l'anteprima"}).click(); await p.waitForTimeout(500); await chk('demo-gest');
  ok(w+' anteprima gestionale in finestra',await p.locator('#dlgB #gpNav button').count()>0&&(await p.textContent('#dlgB')).includes('dati inventati'));
  await p.locator('#dlgB #gpNav button').nth(1).click(); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok(w+' anteprima tornata al suo posto',await p.locator('#gBranch #gpBox').count()===1);
  // mappa del lavoro
  await L.to(p,4,async c=>{if(c==='2')await L.fixGoal(p)}); await p.waitForTimeout(600); await chk('mappa');
  const nodi=await p.locator('.mn').count(); ok(w+' mappa con nodi',nodi>=4,nodi);
  await p.locator('.mn').nth(0).locator('.mn-b',{hasText:'Mi porta via tempo'}).click(); await p.locator('.mn').nth(1).locator('.mn-b',{hasText:'Funziona bene'}).click();
  await p.locator('.mn').nth(2).locator('.mn-b',{hasText:'Mi porta via tempo'}).click(); await p.locator('.mn').nth(0).locator('.mn-nb').click(); await p.locator('#mn_b0').fill('Succede ogni giorno');
  await p.fill('#mNew','Consegna a domicilio'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  ok(w+' passaggio aggiunto',(await p.locator('.mn').count())===nodi+1);
  await p.locator('.mn').last().locator('.mn-b',{hasText:'Mi porta via tempo'}).click();
  await p.click('#mAiutoBtn'); await p.waitForTimeout(900); await chk('mappa-aiuto');
  ok(w+' Con il mio aiuto mostra suggerimenti su nodi lenti',(await p.locator('.mn-help:visible').count())===3);
  if(w===390||w===1280){ await p.locator('#cLav').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/mappa-aiuto-${w}.png`}); await p.click('#mOggi'); await p.waitForTimeout(500); await p.locator('#cLav').scrollIntoViewIfNeeded(); await p.screenshot({path:`${S}/mappa-oggi-${w}.png`}); await p.click('#mAiutoBtn'); }
  const d=await p.evaluate(()=>dati()); ok(w+' d.mappa e d.lav compatibili',d.mappa.nodi.length===3&&d.mappa.nodi[0].stato==='lento'&&d.mappa.nodi[0].nota.startsWith('Succede')&&d.mappa.extra[0].stato==='lento'&&d.lav.length===2,JSON.stringify(d.lav));
  await p.reload(); await p.waitForTimeout(500); ok(w+' bozza mappa dopo reload',await p.evaluate(()=>A.lav.length===2&&A.extra.length===1&&A.lavOk.length===1&&A.mnote[0]==='Succede ogni giorno'));
  ok(w+' overflow ovunque',bad.length===0,bad.join()); ok(w+' nessun errore console',p.errs.length===0,JSON.stringify(p.errs));
  await p.context().close();
 }
 await b.close(); L.done();
})();
