import {chromium} from '/opt/npm-tools/node_modules/playwright/index.mjs';
const URL='http://127.0.0.1:8099/demos/top-secret/lantern-gate/index.html';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--mute-audio','--autoplay-policy=user-gesture-required']});
const base={desktop:191180,tablet:163554,phone:111125};
for(const [name,w,h] of [['desktop',1280,720],['tablet',768,1024],['phone',390,844],['user',790,241]]){
  const p=await b.newPage({viewport:{width:w,height:h}});
  const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.goto(URL);
  await p.waitForFunction(()=>document.getElementById('world')?.dataset.ready==='true',null,{timeout:60000}).catch(()=>errs.push('notready'));
  await p.waitForTimeout(1500);
  const r=await p.evaluate(()=>{const m=document.getElementById('starter-menu'),bb=m.getBoundingClientRect();return {hidden:m.hidden,w:bb.width,h:bb.height,a:Math.round(bb.width*bb.height),labels:[...m.querySelectorAll('button')].map(x=>x.textContent),btn:[...m.querySelectorAll('button')].map(x=>{const q=x.getBoundingClientRect();return [Math.round(q.width),Math.round(q.height),x.scrollWidth<=x.clientWidth]}),loadDisabled:m.querySelector('[data-starter=load]').disabled,arriving:document.getElementById('game').dataset.arriving}});
  console.log(name,JSON.stringify(r),'ratio',(r.a/(base[name]||190390)).toFixed(3),errs);
  await p.screenshot({path:`starter-${name}.png`});
  await p.close();
}
await b.close();
