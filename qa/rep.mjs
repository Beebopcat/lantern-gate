import {launch,newPage,open,createViaUI,snapshot} from './lib.mjs';
const b=await launch();const page=await newPage(b);await open(page);await createViaUI(page,{classId:'summoner',companionId:'bone-squire'});await page.waitForTimeout(1500);
console.log('battle visible?',await page.evaluate(()=>!document.getElementById('battle')?.hidden&&!!document.getElementById('battle')));
await page.click('#hud-menu');await page.click('#settings');await page.waitForTimeout(800);
console.log(await page.evaluate(()=>({panel:document.getElementById('panel').open,btn:!!document.querySelector('[data-action=new-confirm]'),title:document.querySelector('#panel h2,#panel-title')?.textContent,body:document.getElementById('panel-body')?.innerText.slice(0,300)})));
await page.screenshot({path:'rep.png'});console.log(page.errors);await b.close();
