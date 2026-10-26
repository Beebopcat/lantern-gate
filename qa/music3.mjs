import {launch,newPage,BASE} from './lib.mjs';
const b=await launch();const page=await newPage(b,{w:600,h:400});
await page.goto(BASE+'narrator-b-expected.js');await page.mouse.click(10,10);
const r=await page.evaluate(async(BASE)=>{
 const base=new URL(BASE,location.href).pathname;const A=await import(base+'audio.js'),E=await import(base+'engine.js');
 const s=E.fresh(Date.now());const m=new A.Music();const op=HTMLMediaElement.prototype.play;const errs=[];HTMLMediaElement.prototype.play=function(){return op.call(this).catch(e=>{errs.push(this.dataset.score+':'+e.name+':'+e.message);throw e;});};const wait=ms=>new Promise(r=>setTimeout(r,ms));const log=[];
 const st=(k)=>log.push([k,m.mode,m.track?.id,m.pending?.track?.id||null,m.failedMode,Math.round(performance.now()-m.lastSwitch)]);
 m.title=true;await m.enable(true);st('enabled');
 m.title=false;await wait(6200);try{m.update(s);}catch(e){log.push('ERR '+e.message)}st('upd1');await wait(2500);st('after1');
 try{m.update(s);}catch(e){log.push('ERR '+e.message)}await wait(2000);st('upd2');
 return {log,errs};
},BASE);
console.log(JSON.stringify(r,null,0));await b.close();
