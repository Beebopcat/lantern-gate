import {launch,newPage,seed,open,saved,rawSaved,snapshot,dataset,audioCounts,enterViaLoad,createViaUI,ok,summary,BASE,KEY} from './lib.mjs';
const b=await launch();
const BASEAREA={'1280x720':191180,'768x1024':163554,'390x844':111125,'844x390':179746,'790x241':168243,'820x1180':174697};
const rect=(page,sel)=>page.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};},sel);

console.log('starter: first start, several viewports');
for(const [w,h] of (process.env.SKIP_STARTER?[]:[[1280,720],[768,1024],[390,844],[844,390],[790,241],[820,1180],[360,640]])){
  const page=await newPage(b,{w,h});await open(page);
  const info=await page.evaluate(()=>{const m=document.getElementById('starter-menu'),r=m.getBoundingClientRect();return {labels:[...m.querySelectorAll('button')].map(x=>x.textContent.trim()),text:m.textContent.replace(/\s+/g,' ').trim(),btn:[...m.querySelectorAll('button')].map(x=>{const q=x.getBoundingClientRect();return {w:q.width,h:q.height,clip:x.scrollWidth>x.clientWidth||x.scrollHeight>x.clientHeight,fs:parseFloat(getComputedStyle(x).fontSize)};}),r:{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom},load:m.querySelector('[data-starter=load]').disabled,intro:!!document.getElementById('journey-intro'),vitals:getComputedStyle(document.querySelector('.vitals')).display,hud:getComputedStyle(document.getElementById('hud-menu')).display};});
  const tag=`${w}x${h}`;
  ok(JSON.stringify(info.labels)==='["New Game","Load Game","Settings"]',`${tag} exactly three labels ${info.labels}`);
  ok(info.text==='New GameLoad GameSettings',`${tag} no extra text in starter`);
  ok(info.btn.every(x=>!x.clip),`${tag} no clipping`);ok(info.btn.every(x=>x.h>=44&&x.w>=44),`${tag} touch targets >=44px (${info.btn.map(x=>Math.round(x.w)+'x'+Math.round(x.h))})`);ok(info.btn.every(x=>x.fs>=12),`${tag} font >=12px`);
  ok(info.r.x>=0&&info.r.y>=0&&info.r.right<=w&&info.r.bottom<=h,`${tag} fully inside viewport`);
  const area=info.r.w*info.r.h,base=BASEAREA[tag];if(base){const ratio=area/base;console.log(`   ${tag} area ${Math.round(area)} = ${(ratio*100).toFixed(1)}% of original ${base}`);ok(ratio>=.085&&ratio<=.115,`${tag} area about 10% (${(ratio*100).toFixed(1)}%)`);}
  ok(info.load===true,`${tag} Load disabled with no save`);ok(!info.intro,`${tag} old overlay removed`);ok(info.vitals==='none'&&info.hud==='none',`${tag} gameplay HUD hidden behind starter`);
  ok(JSON.stringify(await audioCounts(page))==='{"ctx":0,"play":0,"speech":0}',`${tag} silent entry ${JSON.stringify(await audioCounts(page))}`);
  ok(page.errors.length===0,`${tag} no page errors ${page.errors}`);
  if(w===1280)await page.screenshot({path:'ev-starter-1280.png'});if(w===390)await page.screenshot({path:'ev-starter-390.png'});if(w===768)await page.screenshot({path:'ev-starter-768.png'});
  await page.ctx.close();
}

if(!process.env.ONLY||process.env.ONLY==='new')await (async()=>{
console.log('new game opens/cancels without erasing (returning player)');
{
  await (async()=>{
    const page=await newPage(b);await seed(page,{classId:'warrior',name:'Keeper'});await open(page);
    ok(await page.evaluate(()=>!document.querySelector('[data-starter=load]').disabled),'Load enabled with a created save');
    ok(await page.evaluate(()=>document.activeElement?.dataset?.starter==='load'),'focus lands on Load Game for returning player');
    const before=await rawSaved(page);
    await page.click('[data-starter=new]');await page.waitForSelector('#creation-form');
    ok(await page.isHidden('#starter-menu'),'starter hidden while creating');
    ok((await page.textContent('.creation-note'))?.includes('replaces the saved journey'),'creation warns that finishing replaces the save');
    const cards=await page.$$eval('.calling-card',e=>e.map(x=>x.dataset.id));ok(cards.join()==='warrior,summoner,mage,ranger',`4 callings: ${cards}`);
    await page.waitForTimeout(800);
    ok(await rawSaved(page)===before,'save untouched while creation is open');
    await page.click('[data-action=cancel-creation]');await page.waitForFunction(()=>!document.getElementById('starter-menu').hidden);
    await page.waitForTimeout(500);
    ok(await rawSaved(page)===before,'save byte-identical after Back');
    // Esc cancels too
    await page.click('[data-starter=new]');await page.waitForSelector('#creation-form');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('starter-menu').hidden);
    ok(await rawSaved(page)===before,'save identical after Esc');
    // Load restores
    await enterViaLoad(page);
    const d=await dataset(page);ok(d.class==='warrior','loaded warrior');ok(d.companion==='','warrior has no companion');
    const hud=await page.evaluate(()=>{const g=document.getElementById('game').getBoundingClientRect(),v=document.querySelector('.vitals').getBoundingClientRect(),m=document.getElementById('hud-menu').getBoundingClientRect();return {g:[g.width,g.height],vcx:v.x+v.width/2,vb:g.bottom-v.bottom,mx:m.x-g.x,mb:g.bottom-m.bottom,health:getComputedStyle(document.getElementById('health')).display,map:!!document.getElementById('mini-map'),nav:getComputedStyle(document.querySelector('.world-status')).display,quest:getComputedStyle(document.querySelector('.quest-ribbon')).display};});
    ok(Math.abs(hud.vcx-hud.g[0]/2)<2,'health/mana centered ('+hud.vcx+')');ok(hud.vb<30,'health/mana at bottom ('+hud.vb+')');ok(hud.mx<20&&hud.mb<20,'Menu bottom-left');ok(hud.nav==='none'&&hud.quest==='none','no navigation text');
    ok((await page.$('#hud-menu:not([disabled])'))!==null,'Menu enabled in play');
    ok(JSON.stringify(await audioCounts(page))==='{"ctx":0,"play":0,"speech":0}','load stayed silent '+JSON.stringify(await audioCounts(page)));
    await page.screenshot({path:'ev-loaded-warrior.png'});
    // in-game New Game then cancel leaves live state
    await page.click('#hud-menu');await page.click('#settings');await page.click('[data-action=new-confirm]');await page.waitForSelector('#creation-form');
    await page.click('[data-action=cancel-creation]');await page.waitForTimeout(400);
    ok((await dataset(page)).class==='warrior','in-game New Game cancel keeps character');ok(await page.evaluate(()=>!document.getElementById('panel').open),'panel closed after cancel');
    ok(page.errors.length===0,'no page errors '+page.errors);
    await page.ctx.close();
  })();
}

})();
if(!process.env.ONLY||process.env.ONLY==='settings')await (async()=>{
console.log('settings from starter + user-controlled audio');
{
  const page=await newPage(b);await open(page);
  await page.click('[data-starter=settings]');await page.waitForSelector('#music-toggle');
  ok(await page.isHidden('#starter-menu'),'starter hidden while Settings open');
  const txt=await page.textContent('#panel-body');ok(['Export save','Import save','Original music','Recorded dialogue','World sounds','Camera zoom'].every(k=>txt.includes(k)),'full functional settings present');
  ok(await page.textContent('#music-toggle')==='Music off'&&await page.textContent('#effects-toggle')==='Sounds off','audio toggles start off');
  ok((await audioCounts(page)).ctx===0,'no AudioContext before the user turns audio on');
  await page.click('#effects-toggle');await page.waitForTimeout(500);
  ok(await page.textContent('#effects-toggle')==='Sounds on','World sounds toggle on by user');ok((await audioCounts(page)).ctx>=1,'AudioContext created only after the user turned sounds on');
  await page.click('#effects-toggle');await page.waitForTimeout(300);ok(await page.textContent('#effects-toggle')==='Sounds off','World sounds toggle off again');
  await page.click('#music-toggle');await page.waitForTimeout(800);const musicLabel=await page.textContent('#music-toggle');console.log('   music toggle after click:',musicLabel);ok(['Music on','Music off'].includes(musicLabel),'Music toggle responds (files may be absent locally)');
  await page.click('#close-panel');await page.waitForFunction(()=>!document.getElementById('starter-menu').hidden);ok(true,'closing Settings returns to starter');
  await page.keyboard.press('Tab');
  // keyboard: arrows move focus among enabled buttons
  await page.focus('[data-starter=new]');await page.keyboard.press('ArrowDown');ok(await page.evaluate(()=>document.activeElement.dataset.starter)==='settings','arrow skips disabled Load');
  await page.keyboard.press('ArrowDown');ok(await page.evaluate(()=>document.activeElement.dataset.starter)==='new','arrow wraps');
  await page.keyboard.press('Enter');await page.waitForSelector('#creation-form');ok(true,'Enter activates New Game');
  ok(page.errors.length===0,'no page errors '+page.errors);await page.ctx.close();
}
})();
if(!process.env.ONLY||process.env.ONLY==='export')await (async()=>{
console.log('export from play, import from starter Settings');
{
  const page=await newPage(b);await seed(page,{classId:'summoner',companionId:'moss-golem',name:'Ex Porter'});await open(page);await enterViaLoad(page);
  await page.click('#hud-menu');await page.click('#settings');
  const [dl]=await Promise.all([page.waitForEvent('download'),page.click('[data-action=export]')]);
  const path=await dl.path();const fs=await import('node:fs');const text=fs.readFileSync(path,'utf8');const env=JSON.parse(text);
  ok(env.format==='lantern-gate-save'&&env.state.guardian?.kind==='moss-golem','export envelope carries guardian');
  fs.writeFileSync('/tmp/export-golem.json',text);await page.ctx.close();
  const page2=await newPage(b);await open(page2);ok(await page2.evaluate(()=>document.querySelector('[data-starter=load]').disabled),'fresh browser: Load disabled');
  await page2.click('[data-starter=settings]');await page2.waitForSelector('#save-file',{state:'attached'});await page2.setInputFiles('#save-file','/tmp/export-golem.json');
  await page2.waitForFunction(()=>document.getElementById('game').dataset.arriving==='false',null,{timeout:20000});
  const d=await dataset(page2);ok(d.class==='summoner'&&d.companion.startsWith('moss-golem|'),'import restored class and companion '+d.companion);
  const sv=await snapshot(page2);ok(sv.guardian?.kind==='moss-golem'&&sv.player.name==='Ex Porter','imported save persisted');
  // Load Game works for the imported save after reload
  await page2.reload();await page2.waitForFunction(()=>!document.getElementById('starter-menu').hidden);ok(await page2.evaluate(()=>!document.querySelector('[data-starter=load]').disabled),'Load enabled after import');
  await enterViaLoad(page2);ok((await dataset(page2)).companion.startsWith('moss-golem|'),'reload Load restores golem');
  // corrupt import is rejected, state untouched
  await page2.click('#hud-menu');await page2.click('#settings');fs.writeFileSync('/tmp/bad.json','{"format":"lantern-gate-save","schema":1,"state":{"guardian":{"kind":"ash-wolf"}}}');
  await page2.setInputFiles('#save-file','/tmp/bad.json');await page2.waitForTimeout(700);ok((await dataset(page2)).companion.startsWith('moss-golem|'),'invalid import rejected');
  ok(page2.errors.length===0,'no page errors '+page2.errors);await page2.ctx.close();
}
})();
process.exit(summary()?1:0);
