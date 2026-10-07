// Screenshot tour of the battle screen (not a test): node qa/battle.shots.mjs <outDir> <WxH> [classId] [kind] [foeKind]
// Seeds a save next to two hostiles, starts a battle through the real game and photographs the arena at the start, the
// skill menu, target selection, a Fray reveal, Staggered, Kindle spent, items and the result screen.
import {launch,newPage,seed,open,enterViaLoad,ok,summary} from './lib.mjs';
import fs from 'node:fs';
const [out='/tmp/shots-B',size='1280x720',classId='warrior',kind='',foeKind='wolf']=process.argv.slice(2);
const [w,h]=size.split('x').map(Number);fs.mkdirSync(out,{recursive:true});
const tag=`${classId}-${size}${foeKind!=='wolf'?'-'+foeKind:''}`;
const b=await launch();const page=await newPage(b,{w,h});
const foes=process.env.FOES==='3'?[{id:'w1',dx:1.8,dy:0,hp:Number(process.env.HP||60)},{id:'w2',dx:3,dy:1,hp:Number(process.env.HP||60)},{id:'w3',dx:3,dy:-1,hp:Number(process.env.HP||60)}]:[{id:'w1',dx:1.8,dy:0,hp:Number(process.env.HP||60)},{id:'w2',dx:3,dy:1,hp:Number(process.env.HP||60)}];
const mutate=foeKind==='wolf'?'':`for(const e of s.enemies){e.kind='${foeKind}';e.name=${JSON.stringify(foeKind)};}`;
await seed(page,{classId,companionId:kind||null,enemies:foes,mutate});
await open(page);await enterViaLoad(page);
await page.waitForSelector('#battle:not([hidden])',{timeout:30000});
const idle=()=>page.waitForFunction(()=>{const r=document.getElementById('battle');return r&&r.dataset.phase==='command'&&r.dataset.mode==='menu'&&!r.querySelector('.b-menu button[disabled]');},null,{timeout:60000});
const shot=async n=>{await page.screenshot({path:`${out}/${tag}-${n}.png`});console.log('shot',n);};
await idle();await page.waitForTimeout(300);await shot('1-start');
const metrics=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bw:document.getElementById('battle').scrollWidth,px:getComputedStyle(document.getElementById('battle')).getPropertyValue('--b-px'),stack:document.getElementById('battle').dataset.stack}));
console.log(JSON.stringify(metrics));ok(metrics.sw<=metrics.cw,'no horizontal scroll');
// skills
await page.click('#battle [data-cmd=skill]');await page.waitForTimeout(250);await shot('2-skills');
// pick a skill that needs a target when there are several foes, else the first enabled
const skills=await page.$$eval('#battle [data-skill]:not([disabled])',e=>e.map(x=>x.dataset.skill));
await page.click('#battle .b-sub [data-cmd=back]');
await page.click('#battle [data-cmd=attack]');await page.waitForTimeout(250);
const aiming=await page.$('#battle .b-foe.pick');
if(aiming){await page.hover('#battle .b-foe.pick');await page.waitForTimeout(250);await shot('3-target');}
// Kindle 1 then attack the first foe, photographing the story as it plays
await page.keyboard.press('Escape');await page.waitForTimeout(150);
await page.click('#battle [data-kindle="1"]');await page.waitForTimeout(150);await shot('4-kindle');
await page.click('#battle [data-cmd=attack]');
if(await page.$('#battle .b-foe.pick'))await page.click('#battle .b-foe.pick');
let snaps=0,lastCap='';const t0=Date.now();
while(Date.now()-t0<60000){
  const st=await page.evaluate(()=>({mode:document.getElementById('battle').dataset.mode,cap:document.querySelector('#battle .b-caption.show')?.textContent||''}));
  if(st.cap&&st.cap!==lastCap&&snaps<4){lastCap=st.cap;snaps++;await shot('5-play-'+snaps+'-'+st.cap.replace(/\W+/g,'_').slice(0,18));}
  if(st.mode==='menu')break;await page.waitForTimeout(60);
}
await idle();await shot('6-after');
// items
if(await page.$('#battle [data-cmd=item]:not([disabled])')){await page.click('#battle [data-cmd=item]');await page.waitForTimeout(250);await shot('7-items');await page.click('#battle .b-sub [data-cmd=back]');}
// fight on until the end, with a skill or two on the way, photographing the Staggered state and the result
let used=0;const t1=Date.now();let stag=false;
while(Date.now()-t1<240000){
  const mode=await page.evaluate(()=>document.getElementById('battle').dataset.mode);
  if(mode==='over')break;
  if(mode==='menu'){
    const seen=await page.evaluate(()=>!!document.querySelector('#battle .b-foe.is-staggered'));
    if(seen&&!stag){stag=true;await shot('8-staggered');}
    if(used<2&&skills.length){used++;await page.click('#battle [data-cmd=skill]');await page.click(`#battle [data-skill="${skills[used%skills.length]}"]`);}
    else await page.click('#battle [data-cmd=attack]');
    if(await page.waitForSelector('#battle .b-foe.pick',{timeout:600}).catch(()=>null))await page.click('#battle .b-foe.pick');
  }
  await page.waitForTimeout(250);
}
await page.waitForSelector('#battle .b-result',{timeout:60000}).catch(()=>{});await page.waitForTimeout(400);await shot('9-result');
console.log('errors',JSON.stringify(page.errors));
await b.close();process.exit(0);
