import {launch,newPage,BASE} from './lib.mjs';
const b=await launch();
for(const v of [0,1,2]){
 const p=await newPage(b,{w:1000,h:640});
 await p.goto(BASE+'index.html?vista='+v);
 await p.waitForFunction(()=>document.getElementById('world')?.dataset.ready==='true',null,{timeout:90000});
 await p.waitForTimeout(4000);
 await p.screenshot({path:`vista-${v}.png`});
 console.log(v,p.errors.join('|'));
 await p.ctx.close();
}
await b.close();
