// UI review screenshots for the "Lantern storybook HD-2D" skin.
// usage: node ui-shots.mjs <outPrefix> [WxH ...]   (env PARTS=title,create,world,menu,tabs,talk,compact,toast,board)
import {launch,newPage,seed,open,enterViaLoad,BASE} from './lib.mjs';
const out=process.argv[2]||'shots/ui';
const sizes=(process.argv.slice(3).length?process.argv.slice(3):['1280x720']).map(s=>s.split('x').map(Number));
const PARTS=(process.env.PARTS||'title,create,world,menu,tabs,talk,compact,toast,board').split(',');
const has=p=>PARTS.includes(p);
const b=await launch();
const errors=[];
const shot=async(page,name)=>{await page.screenshot({path:`${out}-${name}.png`});console.log('  saved',`${out}-${name}.png`);};
for(const [w,h] of sizes){
  const tag=`${w}x${h}`;console.log('viewport',tag);
  if(has('title')||has('create')){
    const page=await newPage(b,{w,h});await open(page);await page.waitForTimeout(2500);
    if(has('title'))await shot(page,`${tag}-title`);
    if(has('create')){
      await page.click('#starter-menu [data-starter=new]');await page.waitForSelector('#creation-form');await page.waitForTimeout(1200);
      await shot(page,`${tag}-create`);
      await page.click('.calling-card[data-id=mage]');await page.click('#stage-turn-left');await page.click('#stage-pose');await page.waitForTimeout(500);
      await page.evaluate(()=>document.querySelector('.creation-stage')?.scrollIntoView({block:'start'}));await page.waitForTimeout(200);
      await shot(page,`${tag}-create-mage`);
      await page.click('.calling-card[data-id=ranger]');await page.waitForSelector('.companion-card');await page.waitForTimeout(900);
      await page.click('.companion-card >> nth=1');await page.waitForTimeout(300);
      await page.evaluate(()=>document.querySelector('.calling-cards')?.scrollIntoView({block:'start'}));await page.waitForTimeout(300);
      await shot(page,`${tag}-create-cards`);
      await page.evaluate(()=>document.querySelector('#companion-picker')?.scrollIntoView({block:'start'}));await page.waitForTimeout(300);
      await shot(page,`${tag}-create-companions`);
      await page.evaluate(()=>document.querySelector('.creation-actions')?.scrollIntoView({block:'end'}));await page.waitForTimeout(300);
      await shot(page,`${tag}-create-end`);
    }
    errors.push(...page.errors.map(e=>tag+' '+e));await page.ctx.close();
  }
  if(has('world')||has('menu')||has('tabs')||has('board')){
    const page=await newPage(b,{w,h});
    await seed(page,{classId:'ranger',companionId:'ash-wolf',name:'Rowan Vale',mutate:`s.player.gold=137;s.player.xp=(s.player.xp||0)+30;`});
    // move the player beside Hearthwick's noticeboard (a clear spot, no residents adjacent)
    await page.evaluate(async ({KEY,BASE})=>{const base=new URL(BASE,location.href).pathname;const W=await import(base+'world.js');const s=JSON.parse(localStorage.getItem(KEY));const n=W.PROPS.find(p=>p.id==='hearth-notice');if(n){s.player.x=n.x+1.2;s.player.y=n.y+.6;}localStorage.setItem(KEY,JSON.stringify(s));},{KEY:'casey.top-secret.lantern-gate.hollow.v1',BASE});
    await open(page);await enterViaLoad(page);await page.waitForTimeout(3500);
    if(has('world'))await shot(page,`${tag}-world`);
    if(has('menu')){await page.click('#hud-menu');await page.waitForTimeout(500);await shot(page,`${tag}-menu`);await page.click('#hud-menu');await page.waitForTimeout(200);}
    if(has('tabs'))for(const id of (process.env.TABS||'bag,journal,achievements,abilities,skills,stats,character,atlas,settings,world-options').split(',')){
      await page.click('#hud-menu');await page.waitForTimeout(250);await page.click('#'+id);await page.waitForTimeout(700);await shot(page,`${tag}-tab-${id}`);
      await page.keyboard.press('Escape');await page.waitForTimeout(250);if(await page.evaluate(()=>document.getElementById('panel').open))await page.click('#close-panel');
    }
    if(has('board')){await page.focus('#world');await page.keyboard.press('e');await page.waitForTimeout(800);await shot(page,`${tag}-board`);await page.keyboard.press('Escape');await page.waitForTimeout(200);}
    errors.push(...page.errors.map(e=>tag+' '+e));await page.ctx.close();
  }
  if(has('compact')||has('toast')){
    const page=await newPage(b,{w,h});
    // a resident with nothing to offer: the conversation opens in the small message window
    await seed(page,{classId:'mage',name:'Rowan Vale',mutate:`const n=s.actors.find(a=>a.id==='wren')||s.actors.find(a=>a.id==='jory');s.player.x=n.x+.8;s.player.y=n.y;n.path=[];n.think=30;`});
    await open(page);await enterViaLoad(page);await page.waitForTimeout(600);
    if(has('compact')){await page.focus('#world');await page.keyboard.press('e');await page.waitForTimeout(1200);await shot(page,`${tag}-compact`);await page.keyboard.press('Escape');await page.waitForTimeout(300);if(await page.evaluate(()=>document.getElementById('panel').open))await page.click('#close-panel');}
    if(has('toast')){await page.click('#hud-menu');await page.waitForTimeout(300);await page.click('#spell',{force:true}).catch(()=>{});await page.evaluate(()=>{const t=document.getElementById('toast'),keep=t.textContent;new MutationObserver(()=>{if(!t.textContent)t.textContent=keep;}).observe(t,{childList:true,characterData:true,subtree:true});});await page.waitForTimeout(500);await page.screenshot({path:`${out}-${tag}-toast.png`});console.log('  saved',`${out}-${tag}-toast.png`);}
    errors.push(...page.errors.map(e=>tag+' '+e));await page.ctx.close();
  }
  if(has('talk')){
    const page=await newPage(b,{w,h});
    await seed(page,{classId:'warrior',name:'Rowan Vale',mutate:`const n=s.actors.find(a=>a.id==='mara')||s.actors.find(a=>a.type==='npc'&&a.map==='overworld');s.player.x=n.x+.8;s.player.y=n.y;n.path=[];n.think=30;`});
    await open(page);await enterViaLoad(page);await page.waitForTimeout(600);
    await page.focus('#world');await page.keyboard.press('e');await page.waitForTimeout(1200);await shot(page,`${tag}-talk`);
    errors.push(...page.errors.map(e=>tag+' '+e));await page.ctx.close();
  }
}
console.log('errors',errors);
await b.close();
