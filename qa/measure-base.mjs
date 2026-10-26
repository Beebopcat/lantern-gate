import {chromium} from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--mute-audio','--autoplay-policy=user-gesture-required']});
const out={};
for(const [name,w,h] of [['desktop',1280,720],['tablet',768,1024],['phone',390,844],['phone-landscape',844,390],['user-790x241',790,241]]){
  const p=await b.newPage({viewport:{width:w,height:h}});
  await p.goto('http://127.0.0.1:8098/demos/top-secret/lantern-gate/index.html');
  await p.waitForFunction(()=>document.getElementById('world')?.dataset.ready==='true',null,{timeout:60000}).catch(()=>{});
  await p.waitForTimeout(2500);
  out[name]=await p.evaluate(()=>{const r=e=>{const b=document.querySelector(e)?.getBoundingClientRect();return b&&{w:Math.round(b.width),h:Math.round(b.height),a:Math.round(b.width*b.height)}};return {story:r('.cinematic-story'),game:r('#game')}});
  await p.close();
}
console.log(JSON.stringify(out,null,1));await b.close();
