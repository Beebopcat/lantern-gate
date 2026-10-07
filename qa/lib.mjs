import {chromium} from '/opt/npm-tools/node_modules/playwright/index.mjs';
export const BASE=process.env.BASE||'http://127.0.0.1:8099/demos/top-secret/lantern-gate/';
export const KEY='casey.top-secret.lantern-gate.hollow.v1';
export const results=[];let failN=0;
export const ok=(c,m)=>{results.push([!!c,m]);if(!c){failN++;console.log('  FAIL',m);}};
export const summary=()=>{const p=results.filter(r=>r[0]).length;console.log(`\n${p} passed, ${failN} failed`);return failN;};
export async function launch(){return chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--mute-audio','--autoplay-policy=user-gesture-required']});}
const INIT=()=>{
  window.__audio={ctx:0,play:0,speech:0};
  for(const n of ['AudioContext','webkitAudioContext']){const AC=window[n];if(!AC)continue;window[n]=class extends AC{constructor(...a){super(...a);window.__audio.ctx++;}};}
  const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__audio.play++;return play.call(this);};
  if(window.speechSynthesis){const sp=window.speechSynthesis.speak.bind(window.speechSynthesis);window.speechSynthesis.speak=u=>{window.__audio.speech++;return sp(u);};}
};
export async function newPage(browser,{w=480,h=300,storage=null}={}){
  const ctx=await browser.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});
  await ctx.addInitScript(INIT);
  const page=await ctx.newPage();page.setDefaultTimeout(90000);page.errors=[];
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))page.errors.push(m.text());});page.on('pageerror',e=>page.errors.push('PAGEERR '+e.message));
  page.ctx=ctx;return page;
}
// Build and store a save from inside the page origin without loading the game (so its pagehide save cannot overwrite it).
export async function seed(page,spec){
  await page.goto(BASE+'narrator-b-expected.js');
  const json=await page.evaluate(async ({KEY,spec,BASE})=>{
    const base=new URL(BASE,location.href).pathname;
    const E=await import(base+'engine.js'),J=await import(base+'journey.js'),G=await import(base+'companions.js'),L=await import(base+'life.js'),W=await import(base+'world.js');
    const s=E.fresh(Date.now());L.upgrade(s);J.upgrade(s);
    const msg=J.create(s,{name:spec.name||'Tester',classId:spec.classId,companionId:spec.companionId||null,gender:'female',skin:'warm',hair:'brown',outfit:'traveler'});
    if(!s.journey.created)throw Error(msg);
    const wolf=E.fresh(Date.now()).enemies.find(e=>e.kind==='wolf');
    // clearing
    let spot=null;for(let x=40;x<330&&!spot;x+=3)for(let y=40;y<330&&!spot;y+=3){let good=true;for(let dx=-9;dx<=9&&good;dx++)for(let dy=-9;dy<=9;dy++)if(W.solid('overworld',x+dx,y+dy)){good=false;break;}if(good)spot={x:x+.5,y:y+.5};}
    s.enemies=spec.keepEnemies?s.enemies:[];s.player.x=spot.x;s.player.y=spot.y;s.player.map='overworld';if(s.guardian)G.snap(s);
    // Keep the tester away from towns/shrines logic: no residents near.
    for(const e of spec.enemies||[])s.enemies.push({...JSON.parse(JSON.stringify(wolf)),id:e.id,x:spot.x+e.dx,y:spot.y+e.dy,home:{x:spot.x+e.dx,y:spot.y+e.dy},map:'overworld',hp:e.hp??wolf.hp,maxHp:e.hp??wolf.hp,attack:e.attack??wolf.attack,deadUntil:0,cd:0,path:[],think:0});
    if(spec.mutate)new Function('s','spot',spec.mutate)(s,spot);
    localStorage.setItem(KEY,JSON.stringify({...s,effects:[]}));
    return {spot,valid:E.valid(JSON.parse(JSON.stringify(s)))};
  },{KEY,spec,BASE});
  if(!json.valid)throw Error('seed invalid');return json;
}
export async function open(page,{waitStarter=true}={}){
  await page.goto(BASE+'index.html');
  await page.waitForFunction(()=>document.getElementById('world')?.dataset.ready==='true',null,{timeout:90000});
  if(waitStarter)await page.waitForFunction(()=>!document.getElementById('starter-menu').hidden,null,{timeout:10000});
}
export const saved=page=>page.evaluate(k=>{const r=localStorage.getItem(k);return r?JSON.parse(r):null;},KEY);
export const rawSaved=page=>page.evaluate(k=>localStorage.getItem(k),KEY);
// Suspend the page (forces a save and stops the loop), read the save, then resume.
export async function snapshot(page,resume=true){
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  const s=await saved(page);
  if(resume)await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  return s;
}
export const dataset=page=>page.evaluate(()=>({...document.getElementById('world').dataset}));
export const audioCounts=page=>page.evaluate(()=>window.__audio);
export async function enterViaLoad(page){await page.click('#starter-menu [data-starter=load]');await page.waitForFunction(()=>document.getElementById('game').dataset.arriving==='false',null,{timeout:20000});}
export async function createViaUI(page,{name='Tester',classId,companionId=null}){
  await page.click('#starter-menu [data-starter=new]');
  await page.waitForSelector('#creation-form',{timeout:10000});
  await page.fill('#character-name',name);
  await page.click(`.calling-card[data-id=${classId}]`);
  if(companionId){await page.waitForSelector(`.companion-card[data-id=${companionId}]`);await page.click(`.companion-card[data-id=${companionId}]`);}
  await page.click('[data-action=create-character]');
  await page.waitForFunction(()=>document.getElementById('game').dataset.arriving==='false',null,{timeout:20000});
}
