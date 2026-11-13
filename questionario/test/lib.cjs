// Funzioni comuni dei collaudi: apre la pagina con la rete esterna bloccata (Supabase e WhatsApp non vengono mai chiamati davvero).
const {chromium}=require('playwright');
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+x:'')); if(!c) fails++;};
const BASE=process.env.BASE_URL||'http://localhost:8800';
const URL=BASE+'/questionario/?att=GB%20Service';
async function mk(b,vp,o={}){
  const ctx=await b.newContext({viewport:vp,deviceScaleFactor:1,reducedMotion:o.reduced?'reduce':'no-preference'}); const p=await ctx.newPage();
  p.errs=[]; p.posts=[];
  p.on('pageerror',e=>p.errs.push(String(e))); p.on('console',m=>{if(m.type()==='error'&&!/net::|Failed to load|status of 500/.test(m.text()))p.errs.push(m.text())});
  await p.route(u=>/^https?:/.test(u.href)&&!u.href.startsWith(BASE),r=>{const q=r.request(); if(q.method()==='POST')p.posts.push(JSON.parse(q.postData()));
    r.fulfill({status:q.url().includes('supabase')?(o.save||200):200,contentType:'application/json',body:'{"ok":true}',headers:{'access-control-allow-origin':'*'}})});
  await p.goto(o.url||URL); await p.waitForTimeout(200); return p;
}
const cur=p=>p.evaluate(()=>document.querySelector('.step.on').dataset.s);
const next=async p=>{await p.click('#nextBtn');await p.waitForTimeout(250)};
const chip=(p,id,t)=>p.locator(`#${id} .chip`,{hasText:t}).first().click();
async function s1(p,ruolo,tipo='idraul',pick=0){
  await p.fill('#fNome','Anna Prova'); await p.fill('#fTipo',tipo); await p.waitForTimeout(200); await p.locator('#tipoList .opt').nth(pick).click();
  if(ruolo) await chip(p,'cRuolo',ruolo);
}
async function to(p,target,fn){ for(let i=0;i<14;i++){ const c=await cur(p); if(c===String(target))return; if(fn) await fn(c); await next(p);} }
const goal=async c=>{};
async function fixGoal(p){ if(!(await p.locator('#goals button[aria-pressed=true]').count())) await p.click('#goals button >> nth=0'); }
async function fin(p,{contatto='WhatsApp',tel='339 111 2222',email}={}){
  await chip(p,'cContatto',contatto); if(email) await p.fill('#fEmail',email); await p.fill('#fTel',tel); await p.check('#fPriv');
}
const noOverflow=p=>p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
const SHOT=process.env.SHOT_DIR||require('os').tmpdir()+'/collaudo-questionario'; require('fs').mkdirSync(SHOT,{recursive:true});
module.exports={BASE,SHOT,chromium,ok,mk,cur,next,chip,s1,to,fixGoal,fin,noOverflow,done:()=>{console.log('FAILS',fails);},get fails(){return fails}};
