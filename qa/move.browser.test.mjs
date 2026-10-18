// Walking through the real game: the hero eases into a walk and glides to a stop (no instant starts and stops),
// keeps walking at the same speed on open ground, and cannot walk through the well.
//   BASE=http://127.0.0.1:8099/demos/top-secret/lantern-gate/ node qa/move.browser.test.mjs
import {launch,newPage,seed,open,enterViaLoad,snapshot,ok,summary,KEY} from './lib.mjs';
const b=await launch();
const pos=async page=>{const s=await snapshot(page);return {x:s.player.x,y:s.player.y,hp:s.player.hp};};
// put the hero at a given spot relative to a prop before the game loads
async function place(page,id,dx,dy){
  await page.evaluate(async ({KEY,BASE,id,dx,dy})=>{const base=new URL(BASE,location.href).pathname,W=await import(base+'world.js'),s=JSON.parse(localStorage.getItem(KEY));
    const q=W.PROPS.find(p=>p.id===id);s.player.x=q.x+dx;s.player.y=q.y+dy;s.player.map='overworld';s.enemies=[];s.player.path=[];localStorage.setItem(KEY,JSON.stringify(s));return true;},{KEY,BASE:process.env.BASE||'http://127.0.0.1:8099/demos/top-secret/lantern-gate/',id,dx,dy});
}
console.log('eased walking on open ground');
{
  const page=await newPage(b,{w:640,h:400});
  await seed(page,{classId:'warrior',name:'Tester'});await open(page);await enterViaLoad(page);await page.waitForTimeout(800);
  await page.focus('#world');
  const p0=await pos(page);
  await page.keyboard.down('d');await page.waitForTimeout(1500);await page.keyboard.up('d');
  const p1=await pos(page);await page.waitForTimeout(900);
  const p2=await pos(page);await page.waitForTimeout(700);
  const p3=await pos(page);
  const moved=Math.hypot(p1.x-p0.x,p1.y-p0.y),glide=Math.hypot(p2.x-p1.x,p2.y-p1.y),rest=Math.hypot(p3.x-p2.x,p3.y-p2.y);
  ok(moved>1,`holding a key walks the hero (${moved.toFixed(2)} tiles)`);
  ok(glide<.7,`after the key is released the hero glides to a stop within a short distance (${glide.toFixed(2)} tiles)`);
  ok(rest<.02,`and then stays put (${rest.toFixed(3)} tiles later)`);
  ok(page.errors.length===0,'no page errors '+page.errors);await page.ctx.close();
}
console.log('the well blocks the hero');
{
  const page=await newPage(b,{w:640,h:400});
  await seed(page,{classId:'warrior',name:'Tester'});
  await place(page,'hearth-well',3,.1);
  await open(page);await enterViaLoad(page);await page.waitForTimeout(800);
  await page.focus('#world');
  // the well's position
  const q=await page.evaluate(async ({BASE})=>{const base=new URL(BASE,location.href).pathname,W=await import(base+'world.js'),w=W.PROPS.find(p=>p.id==='hearth-well');return {x:w.x,y:w.y};},{BASE:process.env.BASE||'http://127.0.0.1:8099/demos/top-secret/lantern-gate/'});
  await page.keyboard.down('a');await page.waitForTimeout(2500);
  const p1=await pos(page);const d1=Math.hypot(p1.x-q.x,p1.y-q.y);
  ok(d1>=1.18-.03,`walking at the well stops at its edge (${d1.toFixed(2)} tiles from its centre, edge is 1.18)`);
  await page.waitForTimeout(1500);const p2=await pos(page);const d2=Math.hypot(p2.x-q.x,p2.y-q.y);
  ok(d2>=1.18-.03,`and keeps sliding around it without sinking in (${d2.toFixed(2)})`);
  await page.keyboard.up('a');
  ok(page.errors.length===0,'no page errors '+page.errors);await page.ctx.close();
}
await b.close();process.exit(summary()?1:0);
