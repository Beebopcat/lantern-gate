import {launch,newPage,seed,open,snapshot,enterViaLoad,audioCounts,ok,summary} from './lib.mjs';
const b=await launch();
const only=process.env.ONLY?process.env.ONLY.split(','):null;
const LIST=[['ranger','ash-wolf'],['warrior',null],['mage',null],['summoner','bone-squire']];
for(const [classId,kind] of LIST){
  if(only&&!only.includes(classId))continue;console.log('battle',classId);
  const page=await newPage(b,{w:1000,h:640});
  await seed(page,{classId,companionId:kind,enemies:[{id:'w1',dx:1.8,dy:0,hp:35},{id:'w2',dx:3,dy:1,hp:35}]});
  await open(page);await enterViaLoad(page);
  await page.waitForSelector('#battle:not([hidden])',{timeout:20000}).catch(()=>{});
  const shown=await page.$('#battle:not([hidden])');ok(!!shown,`${classId}: battle starts on contact`);
  if(!shown){console.log(page.errors);await page.ctx.close();continue;}
  await page.waitForFunction(()=>document.getElementById('battle').dataset.phase==='command'&&!document.querySelector('#battle .b-menu button[disabled]'),null,{timeout:20000});
  await page.screenshot({path:`bt-${classId}-1.png`});
  const before=await page.evaluate(()=>({foes:document.querySelectorAll('#battle button.b-foe').length,cmds:[...document.querySelectorAll('#battle .b-menu button')].map(x=>x.textContent.trim())}));
  ok(before.foes===2,`${classId}: two foes shown`);ok(before.cmds.length===5,`${classId}: five commands ${before.cmds}`);
  const t0=Date.now();let skillUsed=false;
  while(Date.now()-t0<150000){
    const phase=await page.evaluate(()=>document.getElementById('battle').dataset.phase);
    if(phase==='over')break;
    await page.waitForFunction(()=>{const m=document.querySelectorAll('#battle .b-menu button');return document.getElementById('battle').dataset.phase==='over'||[...m].some(x=>!x.disabled)},null,{timeout:30000});
    if((await page.evaluate(()=>document.getElementById('battle').dataset.phase))==='over')break;
    const hasTarget=await page.$('#battle button.b-foe.pick');
    if(hasTarget){await page.click('#battle button.b-foe.pick:not([disabled])');}
    else if(!skillUsed){skillUsed=true;await page.click('#battle [data-cmd=skill]');}
    else await page.click('#battle [data-cmd=attack]');
    await page.waitForTimeout(150);
  }
  const res=await page.evaluate(()=>document.querySelector('#battle .b-result')?.dataset.result);
  ok(res==='won',`${classId}: battle won (${res})`);
  await page.screenshot({path:`bt-${classId}-2.png`});
  await page.click('#battle [data-cmd=done]');
  ok(!!(await page.$('#battle[hidden]')),`${classId}: battle closes`);
  const st=await snapshot(page);
  ok(st.kills>=2,`${classId}: kills credited (${st.kills})`);ok(st.player.gold>25,`${classId}: gold rewarded ${st.player.gold}`);ok(st.player.hp>0,`${classId}: alive ${st.player.hp}`);
  const alive=st.enemies.filter(e=>!e.deadUntil&&['w1','w2'].includes(e.id));ok(alive.length===0,`${classId}: foes defeated`);
  ok(JSON.stringify(await audioCounts(page))==='{"ctx":0,"play":0,"speech":0}',`${classId}: silent`);
  ok(page.errors.length===0,`${classId}: no page errors ${page.errors}`);
  await page.ctx.close();
}
process.exit(summary()?1:0);
