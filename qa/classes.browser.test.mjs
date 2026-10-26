// Rendered creation of every class/companion through the real UI, persistence across reload, replacement and cancel.
import {launch,newPage,open,rawSaved,snapshot,dataset,audioCounts,enterViaLoad,createViaUI,ok,summary} from './lib.mjs';
const b=await launch();
const COMBOS=[['warrior',null],['mage',null],...['ember-imp','bone-squire','gloam-wisp','moss-golem'].map(k=>['summoner',k]),...['ash-wolf','thorn-boar','dusk-lynx','gale-hawk'].map(k=>['ranger',k])];
const only=process.env.ONLY?process.env.ONLY.split(','):null;
for(const [classId,kind] of COMBOS){
  const tag=`${classId}/${kind||'-'}`;if(only&&!only.includes(kind||classId))continue;console.log('create',tag);
  const page=await newPage(b);await open(page);
  // companion picker rules
  await page.click('[data-starter=new]');await page.waitForSelector('#creation-form');
  await page.click(`.calling-card[data-id=${classId}]`);
  const cards=await page.$$eval('.companion-card',e=>e.map(x=>x.dataset.id));
  if(classId==='summoner')ok(cards.join()==='ember-imp,bone-squire,gloam-wisp,moss-golem',`${tag} picker lists exactly 4 minions: ${cards}`);
  else if(classId==='ranger')ok(cards.join()==='ash-wolf,thorn-boar,dusk-lynx,gale-hawk',`${tag} picker lists exactly 4 beasts: ${cards}`);
  else ok(cards.length===0,`${tag} shows no companion picker`);
  if(kind){ // must choose one: submitting without a choice is refused and creates nothing
    await page.click('[data-action=create-character]');await page.waitForTimeout(600);
    ok((await page.textContent('#creation-error')).includes('Choose one'),`${tag} refuses creation until a companion is chosen`);
    ok(await page.evaluate(()=>document.getElementById('game').dataset.arriving==='true'),`${tag} still in creation after refusal`);
    ok((await page.$$eval('.companion-card[aria-pressed=true]',e=>e.length))===0,`${tag} no companion preselected`);
    await page.click(`.companion-card[data-id=${kind}]`);ok((await page.$$eval('.companion-card[aria-pressed=true]',e=>e.length))===1,`${tag} exactly one selected`);
    await page.screenshot({path:`ev-create-${kind}.png`});
  }else await page.screenshot({path:`ev-create-${classId}.png`});
  await page.fill('#character-name','Hero '+tag.slice(0,10));
  await page.click('[data-action=create-character]');
  await page.waitForFunction(()=>document.getElementById('game').dataset.arriving==='false',null,{timeout:90000});
  await page.waitForTimeout(1500);
  let d=await dataset(page);ok(d.class===classId,`${tag} class in play (${d.class})`);
  if(kind)ok(d.companion.startsWith(kind+'|'),`${tag} companion in play: ${d.companion}`);else ok(d.companion==='',`${tag} no companion`);
  if(kind)ok(/^[^|]+\|follow\|/.test(d.companion),`${tag} companion starts in follow state`);
  const s1=await snapshot(page);ok(s1.journey.created&&s1.player.classId===classId&&(kind?s1.guardian?.kind===kind:s1.guardian===undefined),`${tag} saved correctly`);
  if(kind)ok([...s1.actors,...s1.enemies,...(s1.life.pets||[])].filter(a=>a.id==='guardian').length===0,`${tag} no duplicate guardian actor`);
  ok(JSON.stringify(await audioCounts(page))==='{"ctx":0,"play":0,"speech":0}',`${tag} creation and entry silent`);
  if(kind){await page.screenshot({path:`ev-play-${kind}.png`});
    // reload -> Load Game -> same identity
    await page.reload();await page.waitForFunction(()=>!document.getElementById('starter-menu').hidden);await enterViaLoad(page);await page.waitForTimeout(1500);
    d=await dataset(page);ok(d.companion.startsWith(kind+'|'),`${tag} identity after reload: ${d.companion}`);
    const s2=await snapshot(page);ok(s2.guardian.kind===kind&&s2.guardian.id==='guardian',`${tag} persisted after reload`);
  }
  ok(page.errors.length===0,`${tag} no page errors ${page.errors}`);
  await page.ctx.close();
}
if(!only||only.includes('replace')){
  console.log('replace and cancel in play');
  const page=await newPage(b);await open(page);await createViaUI(page,{classId:'summoner',companionId:'bone-squire'});await page.waitForTimeout(1000);
  const before=await snapshot(page);
  await page.click('#hud-menu');await page.click('#settings');await page.click('[data-action=new-confirm]');await page.waitForSelector('#creation-form');
  await page.click('.calling-card[data-id=ranger]');await page.click('.companion-card[data-id=gale-hawk]');await page.click('[data-action=cancel-creation]');await page.waitForTimeout(800);
  let d=await dataset(page);ok(d.class==='summoner'&&d.companion.startsWith('bone-squire|'),'cancelled replacement keeps summoner + Bone Squire '+d.companion);
  const mid=await snapshot(page);ok(mid.guardian.kind==='bone-squire'&&mid.player.name===before.player.name,'save unchanged after cancel');
  await page.click('#hud-menu');await page.click('#settings');await page.click('[data-action=new-confirm]');await page.waitForSelector('#creation-form');
  await page.fill('#character-name','Second Hero');await page.click('.calling-card[data-id=ranger]');await page.click('.companion-card[data-id=gale-hawk]');await page.click('[data-action=create-character]');
  await page.waitForFunction(()=>document.getElementById('world').dataset.class==='ranger',null,{timeout:90000});await page.waitForTimeout(1200);
  d=await dataset(page);ok(d.class==='ranger'&&d.companion.startsWith('gale-hawk|'),'replacement installs ranger + Gale Hawk '+d.companion);
  const after=await snapshot(page);ok(after.guardian.kind==='gale-hawk'&&after.player.name==='Second Hero','replacement saved');ok([after.actors,after.enemies].flat().filter(a=>a.id==='guardian').length===0&&after.life.pets.every(p=>p.id!=='guardian'),'old companion gone; no duplicate');
  ok(page.errors.length===0,'no page errors '+page.errors);await page.ctx.close();
}
if(!only||only.includes('legacy')){
  console.log('legacy classes');
  for(const legacy of ['oathbinder','echoartisan','marrowgardener']){
    const {seed}=await import('./lib.mjs');const page=await newPage(b);await seed(page,{classId:'warrior',mutate:`s.player.classId='${legacy}';`});
    await open(page);await enterViaLoad(page);await page.waitForTimeout(1000);const d=await dataset(page);ok(d.class===legacy&&d.companion==='',`${legacy} loads unchanged ${d.class}`);
    await page.click('#hud-menu');await page.click('#abilities');await page.waitForSelector('.ability-card');const names=await page.$$eval('.ability-card h3',e=>e.map(x=>x.textContent));ok(names.length===3,`${legacy} abilities listed: ${names}`);
    ok(page.errors.length===0,`${legacy} no page errors ${page.errors}`);await page.ctx.close();
  }
}
process.exit(summary()?1:0);
