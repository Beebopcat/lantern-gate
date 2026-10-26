import {launch,newPage,seed,open,snapshot,dataset,enterViaLoad} from './lib.mjs';
const b=await launch();const page=await newPage(b,{w:400,h:260});
await seed(page,{classId:'ranger',companionId:'ash-wolf',enemies:[{id:'hunter',dx:8,dy:0,hp:40}]});
await open(page);await enterViaLoad(page);
for(let i=0;i<40;i++){await page.waitForTimeout(3000);const st=await snapshot(page);const h=st.enemies.find(e=>e.id==='hunter');console.log(i,'hp',h.hp,'dead',h.deadUntil,'kills',st.kills,'xp',st.player.xp,'g',st.guardian.state,'elapsed',st.elapsed.toFixed(1));if(h.deadUntil){console.log('log',JSON.stringify(st.log.slice(-4)));break;}}
await b.close();
