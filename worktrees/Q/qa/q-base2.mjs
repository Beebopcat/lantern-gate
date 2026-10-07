import {launch,newPage,seed,open,enterViaLoad,ok,summary} from './lib.mjs';
const out=process.argv[2]||'shots/qb';
const b=await launch();
for(const [w,h] of [[1280,720],[390,844]]){
  const page=await newPage(b,{w,h});
  await seed(page,{classId:'warrior',name:'Tester',mutate:`s.flags.metMara=true;s.quest.medicine='active';s.quest.millwright='active';s.inv.leaf=3;const m=s.actors.find(a=>a.id==='orin');s.player.x=m.x-1.2;s.player.y=m.y;s.player.map=m.map;s.enemies=[];`});
  await open(page);await enterViaLoad(page);
  await page.waitForTimeout(1500);
  await page.keyboard.press('e');await page.waitForTimeout(1200);
  console.log(await page.evaluate(()=>({open:document.getElementById('panel').open,title:document.getElementById('panel-title').textContent,compact:document.getElementById('panel').dataset.compact})));
  await page.screenshot({path:`${out}-talk-${w}.png`});
  await page.ctx.close();
}
await b.close();
