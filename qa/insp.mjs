import {launch,newPage,seed,BASE} from './lib.mjs';
const b=await launch();const p=await newPage(b);
await seed(p,{classId:'summoner',companionId:'bone-squire',keepEnemies:true});
const r=await p.evaluate(async(BASE)=>{const base=new URL(BASE,location.href).pathname;const E=await import(base+'engine.js');const s=JSON.parse(localStorage.getItem('casey.top-secret.lantern-gate.hollow.v1'));
const kinds={};for(const e of s.enemies)kinds[e.kind]??=e;
return JSON.stringify({kinds:Object.fromEntries(Object.entries(kinds).map(([k,e])=>[k,{...e,path:undefined}])),guardian:s.guardian,player:{...s.player,path:undefined},keys:Object.keys(s),abil:s.journey?.abilities,spells:s.spells,eff:s.effects})},BASE);
console.log(r.slice(0,6000));await b.close();
