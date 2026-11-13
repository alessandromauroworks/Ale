// Pagina e funzione parlano la stessa lingua: i «d» veri prodotti dalla pagina (percorsi ricchi, campi pieni fino al limite,
// emoji e accenti) passano dalla pulizia della funzione «questionario-ricevi» senza perdere niente.
// Poi prova la funzione intera con un database finto (prova-funzione.mts): doppio invio, estraneo che prova a sovrascrivere, limiti.
const L=require('./lib.cjs'); const {ok}=L; const fs=require('fs'), path=require('path'), os=require('os'), {spawnSync}=require('child_process');
const PERCORSI=[["titolare dentista, tutti i servizi","Studio dentistico","Titolare o socio"],["segretaria studio medico","Studio medico / poliambulatorio","Segretaria / segretario"],
  ["privato","Privato (per me o la mia famiglia)","Privato"],["dipendente impresa di pulizie","Impresa di servizi / pulizie / manutenzioni","Dipendente o responsabile d'ufficio"],["altra attività","Altra attività","Altro"]];
(async()=>{
 const b=await L.chromium.launch(); const out={};
 for(const [nome,sett,ruolo] of PERCORSI){
  const p=await L.mk(b,{width:390,height:844});
  // tutto pieno: ogni servizio, ogni opzione, ogni campo al massimo della pagina, con emoji e accenti
  const r=await p.evaluate(async([sett,ruolo])=>{
   const P=(n,s="àèìòù «€» 😀 ")=>{let t="";while(Array.from(t).length<n)t+=s;return Array.from(t).slice(0,n).join("")};
   pickTipo(sett); A.ruolo=ruolo; A.servizi=OPZ.servizi.slice();
   Object.keys(PAN).forEach(k=>PAN[k].forEach(bk=>{const o=optsOf(bk); if(bk.k==="many")A.det[k][bk.id]=o?o.slice():[]; else if(bk.k==="one")A.det[k][bk.id]=o?o[0]:null; else A.det[k][bk.id]=P(bk.m||DET_MAX);}));
   FIELDS.forEach(f=>{const el=document.getElementById(f); el.value=P(el.maxLength>0?el.maxLength:300);});
   document.getElementById("fTel").value="+39 06 1234 5678"; document.getElementById("fEmail").value="anna@esempio.it";
   const s=SETTORI.find(x=>x.n===A.s); A.lav=s.L.map((_,i)=>i); s.L.forEach((_,i)=>A.mnote[i]=P(200)); A.extra=[0,1,2,3,4,5].map(()=>({t:P(60),st:"lento",n:P(200)}));
   s.P.forEach((_,i)=>A.prob[i]={si:true,o:3}); A.ob=(priv()?GOALS_PRIV:GOALS).map(g=>g[0]);
   ["can","str","tipoProblema","segPerdite","telNessuno","telMomenti"].forEach(k=>A[k]=OPZ[k].slice());
   A.gest.serve="Sì"; const go=gOpts(s); A.gest.pannello=go.p.slice(); A.gest.perdite=go.l.slice(); A.gest.dove=G_DOVE.slice();
   A.flusso=flowRules().map(r=>r.label); A.pkTipo="misura"; A.pkVoci=PR_ID.slice(); A.copia=true; A.contatto="Email";
   const d=dati(), cod=await codice(d); return {d,codice:cod,byte:new TextEncoder().encode(JSON.stringify({d,codice:cod,hp:""})).length};
  },[sett,ruolo]);
  out[nome]=r; ok(nome+': sessione casuale nei dati',/^[a-f0-9]{32}$/.test(r.d.sessione||'')); await p.context().close();
 }
 // versione veloce e poi «continua»: i due invii hanno la STESSA sessione (così la funzione aggiorna invece di duplicare)
 { const p=await L.mk(b,{width:390,height:844}); await p.click('#fastBtn'); await p.fill('#fNome','Anna Prova'); await p.fill('#fAtt','Studio Prova'); await p.fill('#fTipo','dentist'); await p.waitForTimeout(250); await p.locator('#tipoList .opt').first().click(); await L.chip(p,'cRuolo','Titolare');
   await L.next(p); await p.locator('.svcb',{hasText:'Sito internet'}).click(); await L.next(p); await p.fill('#fTel','0881 686119'); await p.check('#fPriv'); await L.chip(p,'cContatto','Telefono');
   await L.next(p); await p.waitForTimeout(700); await p.evaluate(()=>{document.getElementById('sendBtn').removeAttribute('href')}); await p.click('#sendBtn'); await p.waitForTimeout(900);
   await p.click('#piuBtn'); await p.waitForTimeout(400); await L.to(p,10,async c=>{if(c==='2')await L.fixGoal(p)}); await p.waitForTimeout(700); await p.evaluate(()=>{document.getElementById('sendBtn').removeAttribute('href')}); await p.click('#sendBtn'); await p.waitForTimeout(900);
   const inv=p.posts.filter(x=>x.d); ok('veloce poi continua: due invii con la stessa sessione',inv.length===2&&/^[a-f0-9]{32}$/.test(inv[0].d.sessione)&&inv[0].d.sessione===inv[1].d.sessione&&inv[1].d.versione==='completa');
   out['veloce poi continua']={d:inv[1].d,codice:inv[1].codice,byte:Buffer.byteLength(JSON.stringify(inv[1]))};
   await p.context().close(); }
 // la sessione resta dopo il ricaricamento (bozza) ed è diversa per un'altra persona
 { const p=await L.mk(b,{width:390,height:844}); await p.click('#nextBtn'); await p.fill('#fNome','Luca'); await p.waitForTimeout(500); const s1=await p.evaluate(()=>A.sid); await p.reload(); await p.waitForTimeout(400); const s2=await p.evaluate(()=>A.sid);
   const q=await L.mk(b,{width:390,height:844}); const s3=await q.evaluate(()=>A.sid);
   ok('sessione: resta dopo il ricaricamento, diversa in un altro browser',/^[a-f0-9]{32}$/.test(s1)&&s1===s2&&s1!==s3);
   await p.evaluate(()=>{localStorage.setItem('qpc:bozza',JSON.stringify({A:{sid:'<img src=x onerror=alert(1)>',s:null},f:{}}))}); await p.reload(); await p.waitForTimeout(400);
   ok('sessione: valore strano nella bozza sostituito',await p.evaluate(()=>/^[a-f0-9]{32}$/.test(A.sid))); await p.context().close(); await q.context().close(); }
 await b.close();
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'dati-pagina-')),'dati.json'); fs.writeFileSync(file,JSON.stringify(out));
 const r=spawnSync(process.execPath,['--experimental-strip-types','--no-warnings',path.join(__dirname,'prova-funzione.mts'),file],{encoding:'utf8'});
 const righe=(r.stdout||'').split('\n').filter(x=>/^(PASS|FAIL) /.test(x)); righe.forEach(x=>{ const pass=x.startsWith('PASS '); ok('funzione: '+x.slice(5),pass); });
 ok('funzione: la prova è partita e finita',r.status===0||righe.some(x=>x.startsWith('FAIL ')),(r.stderr||'').slice(0,400));
 L.done();
})();
