import {launch,newPage,seed,open,enterViaLoad} from './lib.mjs';
const b=await launch();
for(const [w,h] of [[1280,720],[800,450],[640,360]]){
const page=await newPage(b,{w,h});await seed(page,{classId:'warrior',name:'Keeper'});await open(page);await enterViaLoad(page);
const t0=Date.now();const n=await page.evaluate(()=>new Promise(res=>{let n=0;const t=performance.now();const f=()=>{n++;if(performance.now()-t>4000)res(n);else requestAnimationFrame(f);};requestAnimationFrame(f);}));
console.log(w,h,'fps',(n/4).toFixed(1),'wall',Date.now()-t0);await page.ctx.close();}
await b.close();
