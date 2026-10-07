// Screenshots of every quest screen. usage: BASE=... node q-shots.mjs [outPrefix] [scene,scene] [WxH,WxH]
import {launch,newPage,seed,open,enterViaLoad} from './lib.mjs';
const out=process.argv[2]||'shots/q';
const scenes=(process.argv[3]||'log,logsel,board,offer,ready,banner,ribbon').split(',');
const sizes=(process.argv[4]||'1280x720,390x844').split(',').map(x=>x.split('x').map(Number));
import {base,beside,atBoard} from './quest-seed.mjs';
const BUSY=base("s.quest.bell='active';s.inv.bell=1;s.trackedQuest='bell';s.quest.watch='active';");
const b=await launch();
for(const [w,h] of sizes){
  for(const scene of scenes){
    const page=await newPage(b,{w,h});
    let mutate=BUSY;
    if(scene==='offer')mutate=base(beside('willow-0'));
    if(scene==='ready')mutate=BUSY+beside('willow-0');
    if(scene==='board')mutate=BUSY+atBoard;
    if(scene==='fresh')mutate='';
    await seed(page,{classId:'warrior',name:'Tester',mutate});
    await open(page);await enterViaLoad(page);await page.waitForTimeout(1200);
    const tag=`${out}-${scene}-${w}x${h}`;
    if(scene==='log'||scene==='logsel'||scene==='fresh'||scene==='chapter'){
      await page.keyboard.press('j');await page.waitForTimeout(700);
      if(scene==='logsel'){const t=await page.$('.ql-row[data-id="q:bell"]');await t?.click();await page.waitForTimeout(500);}
      if(scene==='chapter'){const t=await page.$('.ql-row[data-id="ch:3"]');await t?.click();await page.waitForTimeout(500);}
      await page.screenshot({path:tag+'.png'});
    }else if(scene==='board'){
      // walk to the board by teleport through a fresh seed: place player beside the Hearthwick noticeboard
      await page.evaluate(()=>{});
      await page.keyboard.press('e');await page.waitForTimeout(300);
      await page.screenshot({path:tag+'.png'});
    }else if(scene==='offer'||scene==='ready'){
      await page.keyboard.press('e');await page.waitForTimeout(1200);
      await page.screenshot({path:tag+'.png'});
    }else if(scene==='ribbon'||scene==='banner'){
      await page.waitForTimeout(600);await page.screenshot({path:tag+'.png'});
    }
    console.log(tag,page.errors);
    await page.ctx.close();
  }
}
await b.close();
