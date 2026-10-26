import {chromium} from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
for(const port of [8098,8099]){
const p=await b.newPage({viewport:{width:640,height:360}});
await p.goto(`http://127.0.0.1:${port}/demos/top-secret/lantern-gate/index.html`);
await p.waitForFunction(()=>document.getElementById('world')?.dataset.ready==='true',null,{timeout:90000});await p.waitForTimeout(1500);
const n=await p.evaluate(()=>new Promise(res=>{let n=0;const t=performance.now();const f=()=>{n++;if(performance.now()-t>4000)res(n);else requestAnimationFrame(f);};requestAnimationFrame(f);}));
console.log(port,'fps',(n/4).toFixed(2));await p.close();}
await b.close();
