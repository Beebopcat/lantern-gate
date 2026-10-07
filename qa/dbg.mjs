import {launch,newPage,seed,open,rawSaved,dataset,enterViaLoad} from './lib.mjs';
const b=await launch();const page=await newPage(b);
await seed(page,{classId:'warrior',name:'Keeper'});await open(page);await enterViaLoad(page);
console.log('entered');
page.setDefaultTimeout(8000);
try{await page.click('#hud-menu');console.log('menu clicked');
console.log(await page.evaluate(()=>({open:!document.getElementById('hud-menu-surface').hidden,settings:!!document.getElementById('settings'),vis:document.getElementById('settings').getBoundingClientRect().toJSON(),inert:document.querySelector('.action-bar').inert})));
await page.click('#settings');console.log('settings clicked');
await page.click('[data-action=new-confirm]');console.log('new-confirm clicked');
await page.waitForSelector('#creation-form');console.log('creation form');
}catch(e){console.log('ERR',e.message.split('\n').slice(0,12).join('\n'));}
await page.screenshot({path:'dbg.png'});
await b.close();
