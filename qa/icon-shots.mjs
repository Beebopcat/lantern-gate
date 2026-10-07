// Screens that show the interface icons: HUD menu, satchel, shop, quest log.
// usage: node icon-shots.mjs <outPrefix> [WxH ...]
import {launch,newPage,seed,open,enterViaLoad} from './lib.mjs';
const out=process.argv[2]||'shots/icons';
const sizes=(process.argv.slice(3).length?process.argv.slice(3):['1280x720','768x1024','390x844','844x390']).map(s=>s.split('x').map(Number));
const b=await launch();const errors=[];
const shot=async(page,name)=>{await page.screenshot({path:`${out}-${name}.png`});console.log('  saved',`${out}-${name}.png`);};
const INV='s.inv={bread:2,tonic:1,salve:2,fish:1,leaf:3,ore:2,wood:4,coil:1,lens:1,medallion:1,pearl:1,locket:1,seed:1,ring:1,verse:1,crown:1,ledger:1,journal:1,heart:1};s.player.gold=137;';
for(const [w,h] of sizes){
  const tag=`${w}x${h}`;console.log('viewport',tag);
  // menu, satchel, quest log
  let page=await newPage(b,{w,h});
  await seed(page,{classId:'ranger',companionId:'ash-wolf',name:'Rowan Vale',mutate:INV});
  await open(page);await enterViaLoad(page);await page.waitForTimeout(2500);
  await page.click('#hud-menu');await page.waitForTimeout(500);await shot(page,`${tag}-menu`);
  await page.click('#bag');await page.waitForTimeout(800);await shot(page,`${tag}-satchel`);
  const head=await page.evaluate(()=>[...document.querySelectorAll('#panel-body .stat-row span')].map(e=>e.textContent));console.log('  satchel header',JSON.stringify(head));
  await page.keyboard.press('Escape');await page.waitForTimeout(250);if(await page.evaluate(()=>document.getElementById('panel').open))await page.click('#close-panel');
  await page.click('#hud-menu').catch(()=>{});await page.waitForTimeout(300);
  await page.click('#journal');await page.waitForTimeout(900);await shot(page,`${tag}-quests`);
  errors.push(...page.errors.map(e=>tag+' '+e));await page.ctx.close();
  // shop
  page=await newPage(b,{w,h});
  await seed(page,{classId:'warrior',name:'Rowan Vale',mutate:INV+`const n=s.actors.find(a=>a.role==='smith'&&a.map==='overworld')||s.actors.find(a=>a.type==='npc'&&a.map==='overworld');s.player.x=n.x+.8;s.player.y=n.y;n.path=[];n.think=30;`});
  await open(page);await enterViaLoad(page);await page.waitForTimeout(600);
  await page.focus('#world');await page.keyboard.press('e');await page.waitForTimeout(1200);
  const tb=page.locator('button[data-action=trade]');
  if(await tb.count()){await tb.first().click();await page.waitForTimeout(800);}else console.log('  no trade button');
  await shot(page,`${tag}-shop`);
  errors.push(...page.errors.map(e=>tag+' '+e));await page.ctx.close();
}
console.log('errors',errors);
await b.close();
