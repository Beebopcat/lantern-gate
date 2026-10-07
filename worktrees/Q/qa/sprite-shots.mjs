// In-game sprite screenshots: creation preview, town with hero/companion/residents, night, an enemy, classic look.
// node sprite-shots.mjs [outPrefix] [w] [h]
import {launch, newPage, open, seed, enterViaLoad, dataset} from './lib.mjs';
const out = process.argv[2] || new URL('./shots/s', import.meta.url).pathname, W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720);
import {mkdirSync} from 'node:fs'; mkdirSync(new URL('./shots/', import.meta.url).pathname, {recursive: true});
const b = await launch();
const page = await newPage(b, {w: W, h: H}); const warns = []; page.on('console', m => {if (m.type() === 'warning') warns.push(m.text().slice(0, 160));});
const shot = async name => {await page.screenshot({path: `${out}-${name}.png`}); console.log('shot', name, JSON.stringify(await dataset(page).catch(() => ({})), ['sprites', 'fps', 'spriteDir', 'spritePose', 'look', 'motion']));};
const only = process.env.ONLY || '';
if (!only || only.includes('create')) {
  await open(page);
  await page.click('#starter-menu [data-starter=new]'); await page.waitForSelector('#creation-form'); await page.waitForTimeout(800);
  await page.fill('#character-name', 'Rowan');
  for (const c of ['warrior', 'mage']) {await page.click(`.calling-card[data-id=${c}]`); await page.waitForTimeout(500);}
  await shot('create-mage');
  await page.click('.calling-card[data-id=ranger]'); await page.waitForSelector('.companion-card'); await page.waitForTimeout(600);
  await shot('create-ranger');
}
// Town: Hearthwick square with residents, a summoner and minion, day then night.
const town = (cls, comp, clock, extra = '') => seed(page, {classId: cls, companionId: comp, mutate: `s.player.x=100.5;s.player.y=300.5;s.player.map='overworld';s.clock=${clock};${extra}if(s.guardian){s.guardian.x=98.6;s.guardian.y=301.2;s.guardian.map='overworld';}const near=[[103,299],[96,302],[104,303],[97,298],[101,304],[94,300]];s.actors.filter(n=>n.town==='hearth').slice(0,6).forEach((n,i)=>{n.x=near[i][0]+.5;n.y=near[i][1]+.5;n.path=[];});`});
if (!only || only.includes('town')) {
  await town('summoner', 'ember-imp', 600);
  await open(page); await enterViaLoad(page); await page.waitForTimeout(5000);
  await shot('town-day');
  await page.keyboard.down('d'); await page.waitForTimeout(700); await page.keyboard.up('d'); await page.waitForTimeout(300); await shot('town-walk');
}
if (!only || only.includes('square')) {
  // an open lawn north of the square, residents gathered around, closer zoom
  await seed(page, {classId: 'warrior', mutate: `s.player.x=95.5;s.player.y=285.5;s.player.map='overworld';s.clock=640;s.settings.zoom=1.35;const near=[[98,284],[92,286],[97,288],[93,283],[99,287],[91,289],[96,282],[100,285]];s.actors.filter(n=>n.town==='hearth').slice(0,8).forEach((n,i)=>{n.x=near[i][0]+.5;n.y=near[i][1]+.5;n.path=[];});`});
  await open(page); await enterViaLoad(page); await page.waitForTimeout(3500);
  await shot('square');
}
if (!only || only.includes('night')) {
  await town('mage', null, 23 * 60);
  await open(page); await enterViaLoad(page); await page.waitForTimeout(5000);
  await shot('town-night');
}
if (!only || only.includes('enemy')) {
  await seed(page, {classId: 'ranger', companionId: 'ash-wolf', enemies: [{id: 'w1', dx: 4, dy: 2}], mutate: `s.clock=700;s.settings.battles='real-time';s.enemies.push({...s.enemies[0],id:'g1',kind:'goblin',name:'Redcap raider',x:spot.x-4,y:spot.y+1,home:{x:spot.x-4,y:spot.y+1}});s.enemies.push({...s.enemies[0],id:'t1',kind:'troll',name:'Cinder troll',hp:90,maxHp:90,x:spot.x+1,y:spot.y-3,home:{x:spot.x+1,y:spot.y-3}});for(const e of s.enemies){e.speed=0;e.attack=0;}`});
  await open(page); await enterViaLoad(page); await page.waitForTimeout(5000);
  await shot('enemies');
}
if (!only || only.includes('classic')) {
  await town('warrior', null, 600, `s.settings.look='classic';`);
  await open(page); await enterViaLoad(page); await page.waitForTimeout(5000);
  await shot('classic');
}
console.log('errors', JSON.stringify(page.errors)); console.log('warnings', JSON.stringify([...new Set(warns)].slice(0, 12)));
await b.close();
