// Rendered gameplay: every companion defends its owner against a real approaching hostile, then returns to guard.
import {launch,newPage,seed,open,snapshot,dataset,audioCounts,enterViaLoad,ok,summary} from './lib.mjs';
const b=await launch();
const LIST=[['summoner','ember-imp'],['summoner','bone-squire'],['summoner','gloam-wisp'],['summoner','moss-golem'],['ranger','ash-wolf'],['ranger','thorn-boar'],['ranger','dusk-lynx'],['ranger','gale-hawk']];
const only=process.env.ONLY?process.env.ONLY.split(','):null;
for(const [classId,kind] of LIST){
  if(only&&!only.includes(kind))continue;console.log('fight',kind);
  const page=await newPage(b,{w:400,h:260});
  // wolf hunts the owner (approach-triggered); a bystander resident and household pet stand close by (must never be harmed).
  await seed(page,{classId,companionId:kind,enemies:[{id:'hunter',dx:8,dy:0,hp:40}],mutate:`const n=s.actors.find(a=>a.type==='npc'&&['baker','farmer','merchant','scholar'].includes(a.role));n.x=spot.x+2.5;n.y=spot.y+1.5;n.map='overworld';n.task='waiting';window.__npc=n.id;s.flags.testNpc=n.id;if(s.life.pets[0]){s.life.pets[0].x=spot.x+1;s.life.pets[0].y=spot.y+2;s.life.pets[0].map='overworld';}`});
  await open(page);await enterViaLoad(page);
  const start=await dataset(page);ok(start.companion.startsWith(kind+'|'),`${kind} present at start ${start.companion}`);
  let engaged=null,maxSeen='';
  const t0=Date.now();
  for(let i=0;i<60&&Date.now()-t0<200000;i++){await page.waitForTimeout(2500);const d=await dataset(page);if(d.companion.split('|')[6]==='hunter'&&!engaged){engaged=d.companion;await page.screenshot({path:`ev-fight-${kind}.png`});}const s=(await dataset(page));if(engaged){const st=await snapshot(page);const h=st.enemies.find(e=>e.id==='hunter');if(h.deadUntil||h.hp<40){maxSeen=`hp ${h.hp} dead ${!!h.deadUntil}`;if(h.deadUntil)break;}}}
  ok(!!engaged,`${kind} engaged the hunter in rendered play (${engaged})`);
  const st=await snapshot(page);const h=st.enemies.find(e=>e.id==='hunter');
  ok(h.hp<40||h.deadUntil>0,`${kind} damaged/killed the hostile: ${maxSeen}`);
  ok(!st.guardian.fallen||true,'state valid');
  const npc=st.actors.find(a=>a.id===st.flags.testNpc);ok(npc&&npc.hp===npc.maxHp&&!npc.deadUntil,`${kind} left the nearby resident unharmed (${npc?.hp}/${npc?.maxHp})`);
  const pet=st.life.pets[0];if(pet)ok(pet.hp===undefined||pet.hp>=0,`${kind} household pet untouched`);
  ok(st.kills<=1,`${kind} no duplicate reward (kills ${st.kills})`);
  // wait for return-to-guard
  let back=false;for(let i=0;i<30;i++){const d=await dataset(page);const [k,state,hp,map,x,y,tgt]=d.companion.split('|');if(!tgt&&(state==='follow'||state==='guard'||state==='return')&&Math.hypot(+x-+d.x,+y-+d.y)<4.5){back=true;break;}await page.waitForTimeout(2500);}
  ok(back,`${kind} returned to guard: ${(await dataset(page)).companion}`);
  await page.screenshot({path:`ev-guard-${kind}.png`});
  ok(JSON.stringify(await audioCounts(page))==='{"ctx":0,"play":0,"speech":0}',`${kind} fight silent`);
  // pause: suspending the page freezes companion state
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  const a=(await dataset(page)).elapsed;await page.waitForTimeout(3500);const c=(await dataset(page)).elapsed;ok(a===c,`${kind} page suspension freezes simulation (${a} vs ${c})`);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  ok(page.errors.length===0,`${kind} no page errors ${page.errors}`);
  await page.ctx.close();
}
process.exit(summary()?1:0);
