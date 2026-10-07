// Baseline screenshots of journal / conversation / board (before the quest overhaul).
import {launch,newPage,seed,open,enterViaLoad,ok,summary} from './lib.mjs';
const out=process.argv[2]||'shots/qb';
const b=await launch();
for(const [w,h] of [[1280,720],[390,844]]){
  const page=await newPage(b,{w,h});
  await seed(page,{classId:'warrior',name:'Tester',mutate:`s.flags.metMara=true;s.quest.medicine='active';s.quest.millwright='active';s.quest.bell='active';s.inv.leaf=2;`});
  await open(page);await enterViaLoad(page);
  await page.waitForTimeout(1500);
  await page.keyboard.press('j');await page.waitForTimeout(900);
  await page.screenshot({path:`${out}-journal-${w}.png`});
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  // conversation with mara: teleport next to her via a direct state edit through localStorage reseed is complex, so use the board prop through E.find
  const info=await page.evaluate(()=>({panel:document.getElementById('panel').open}));
  console.log(w,info,page.errors);
  await page.ctx.close();
}
await b.close();
