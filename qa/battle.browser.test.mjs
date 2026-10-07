// Rendered turn-based battles through the real game: every calling fights two hostiles from contact to the result screen,
// and the arena UI is checked as it goes: Ward pips, Fray glyphs, Kindle, the strip of eight turns, three skills per class,
// items, targets, fleeing, defeat, the four layouts, keyboard play and reduced motion.
//   ONLY=warrior,flee,defeat,layout,keys,motion node qa/battle.browser.test.mjs   (any subset; default is everything)
import {launch,newPage,seed,open,snapshot,enterViaLoad,audioCounts,ok,summary} from './lib.mjs';
const b=await launch();
const only=process.env.ONLY?process.env.ONLY.split(','):null;
const want=k=>!only||only.includes(k);
const LIST=[['ranger','ash-wolf'],['warrior',null],['mage',null],['summoner','bone-squire']];
const idle=(page,t=60000)=>page.waitForFunction(()=>{const r=document.getElementById('battle');return r&&r.dataset.phase==='command'&&r.dataset.mode==='menu'&&!r.querySelector('.b-menu button[disabled]');},null,{timeout:t});
const over=(page,t=120000)=>page.waitForFunction(()=>document.getElementById('battle')?.dataset.mode==='over',null,{timeout:t});
const mode=page=>page.evaluate(()=>document.getElementById('battle').dataset.mode);
const heroHitLines=page=>page.evaluate(()=>[...document.querySelectorAll('#battle .b-log p')].filter(p=>/^Tester (strikes|looses an arrow at|blasts) /.test(p.textContent)).length);
// Run one command and wait until its story has played and the hero is asked again (or the battle is over).
const turns=page=>page.evaluate(()=>Number(document.getElementById('battle').dataset.turns||0));
const afterTurn=(page,n,t=120000)=>page.waitForFunction(n=>{const r=document.getElementById('battle');return Number(r.dataset.turns||0)>n&&['menu','over'].includes(r.dataset.mode);},n,{timeout:t});
async function command(page,clicks,t=120000){const n=await turns(page);await clicks(n);await afterTurn(page,n,t);}
const pickFoe=async page=>{await page.waitForSelector('#battle button.b-foe.pick',{timeout:20000});await page.click('#battle button.b-foe.pick:not([disabled])');};
// after choosing a command: pick the first foe if the game asks for a target
const aim=async(page,n)=>{await page.waitForFunction(n=>{const r=document.getElementById('battle');return r.dataset.mode==='target'||Number(r.dataset.turns||0)>n;},n,{timeout:20000});if((await mode(page))==='target')await pickFoe(page);};
async function enter(page,spec){
  await seed(page,spec);await open(page);await enterViaLoad(page);
  await page.waitForSelector('#battle:not([hidden])',{timeout:30000}).catch(()=>{});
  return !!(await page.$('#battle:not([hidden])'));
}
const TWO=[{id:'w1',dx:1.8,dy:0,hp:35},{id:'w2',dx:3,dy:1,hp:35}];

for(const [classId,kind] of LIST){
  if(!want(classId))continue;console.log('battle',classId);
  const page=await newPage(b,{w:1000,h:640});
  const shown=await enter(page,{classId,companionId:kind,enemies:TWO});ok(shown,`${classId}: battle starts on contact`);
  if(!shown){console.log(page.errors);await page.ctx.close();continue;}
  await idle(page);
  await page.screenshot({path:`bt-${classId}-1.png`});
  const before=await page.evaluate(()=>({foes:document.querySelectorAll('#battle button.b-foe').length,cmds:[...document.querySelectorAll('#battle .b-menu button')].map(x=>x.textContent.trim())}));
  ok(before.foes===2,`${classId}: two foes shown`);ok(before.cmds.length===5,`${classId}: five commands ${before.cmds}`);
  // ---- the arena at the start
  const arena=await page.evaluate(()=>{const q=s=>[...document.querySelectorAll('#battle '+s)];return {
    pips:q('.b-foe').map(f=>[f.querySelectorAll('.b-pip').length,f.querySelectorAll('.b-pip[data-on=true]').length]),
    unknown:q('.b-foe').map(f=>f.querySelectorAll('.b-fray[data-known=false]').length),known:q('.b-foe .b-fray[data-known=true]').length,
    strip:q('.b-turn').map(t=>[t.dataset.side,t.dataset.current||'']),kpips:q('.b-kpip[data-on=true]').length,radios:q('.b-kbtn').length,
    k0:q('[data-kindle="0"]')[0]?.getAttribute('aria-checked'),k2off:q('[data-kindle="2"]')[0]?.disabled,k1on:!q('[data-kindle="1"]')[0]?.disabled,
    flee:q('[data-cmd=flee]')[0]?.title,hero:q('.b-hero').length,sprites:q('.b-sprite').length,letters:q('.b-foe .b-letter').map(x=>x.textContent).join('')};});
  // A companion that is quicker than the hero may open the round, so a Fray can already be revealed (each reveal costs one Ward pip).
  const standing=arena.pips.reduce((n,p)=>n+p[1],0),lost=4-standing;
  ok(arena.pips.length===2&&arena.pips.every(p=>p[0]===2&&p[1]<=2),`${classId}: each wolf shows 2 Ward pips ${JSON.stringify(arena.pips)}`);
  ok(kind?lost<=2:lost===0,`${classId}: ${kind?'at most the companion\'s opening hits':'no'} Ward lost before the hero acts (${lost})`);
  ok(arena.known===lost&&arena.unknown.reduce((n,u)=>n+u,0)+arena.known===4,`${classId}: Frays start hidden, one revealed per Ward pip lost (${arena.known} known, ${arena.unknown})`);
  ok(arena.strip.length===8,`${classId}: the turn strip shows 8 turns (${arena.strip.length})`);
  ok(arena.strip[0][0]==='hero'&&arena.strip[0][1]==='true'&&arena.strip.filter(t=>t[1]==='true').length===1,`${classId}: the hero is the one current turn`);
  ok(arena.strip.some(t=>t[0]==='foe')&&(!kind||arena.strip.some(t=>t[0]==='ally')),`${classId}: foes${kind?' and the companion':''} appear in the strip`);
  ok(arena.kpips===1&&arena.radios===4&&arena.k0==='true'&&arena.k1on&&arena.k2off===true,`${classId}: Kindle starts at 1 (1 pip lit, spend 0 or 1 only)`);
  ok(/\d+%/.test(arena.flee||''),`${classId}: Flee shows its chance (${arena.flee})`);
  ok(arena.letters==='AB'&&arena.hero===(kind?2:1)&&arena.sprites===(kind?4:3),`${classId}: drawn figures: foes A and B, hero${kind?', companion':''} (${arena.sprites} sprites)`);
  // ---- skills: three per class, named as the class abilities
  await page.click('#battle [data-cmd=skill]');await page.waitForSelector('#battle .b-sub:not([hidden]) [data-skill]');
  const skills=await page.evaluate(async()=>{const base=new URL('.',location.href).pathname,J=await import(base+'journey.js');const names=[...document.querySelectorAll('#battle [data-skill] .b-rname')].map(x=>x.textContent),costs=[...document.querySelectorAll('#battle [data-skill] .b-cost')].map(x=>x.textContent);
    const cls=J.CLASSES[document.getElementById('world').dataset.class];
    return {names,costs,abilities:(cls?.abilities||[]).map(a=>a.name),expanded:document.querySelector('#battle [data-cmd=skill]').getAttribute('aria-expanded')};});
  ok(skills.names.length===3&&skills.names.join()===skills.abilities.join(),`${classId}: three skills, the class abilities: ${skills.names}`);
  ok(skills.costs.length===3&&skills.costs.every(c=>/^\d+ mana$/.test(c)),`${classId}: skills show their mana cost: ${skills.costs}`);
  ok(skills.expanded==='true','the Skills command says its list is open');
  await page.screenshot({path:`bt-${classId}-skills.png`});
  await page.click('#battle .b-sub [data-cmd=back]');ok(!!(await page.$('#battle .b-sub[hidden]')),`${classId}: Back closes the skill list`);
  // ---- items
  await page.click('#battle [data-cmd=item]');await page.waitForSelector('#battle .b-sub:not([hidden]) [data-item]');
  const items=await page.$$eval('#battle [data-item]',e=>e.map(x=>x.dataset.item));ok(items.includes('salve')&&items.includes('bread')&&items.includes('tonic'),`${classId}: the item list shows the pack: ${items}`);
  await page.click('#battle .b-sub [data-cmd=back]');
  // ---- choosing a target: both foes light up with a preview, Escape backs out
  await page.click('#battle [data-cmd=attack]');await page.waitForSelector('#battle .b-foe.pick');
  const aimed=await page.evaluate(()=>({pick:document.querySelectorAll('#battle .b-foe.pick').length,previews:[...document.querySelectorAll('#battle .b-preview:not([hidden])')].map(x=>x.textContent)}));
  ok(aimed.pick===2&&aimed.previews.length===2&&aimed.previews.every(t=>/unknown|Fray/.test(t)),`${classId}: aiming marks both foes and previews the damage type: ${aimed.previews}`);
  await page.keyboard.press('Escape');ok(!(await page.$('#battle .b-foe.pick')),`${classId}: Escape leaves target selection`);
  // ---- the fight: Kindle spent on the first attack, a skill on the second command, then attacks
  const t0=Date.now();let step=0,skillUsed=false,reveal=null;
  while(Date.now()-t0<170000){
    if((await mode(page))==='over')break;
    await page.waitForFunction(()=>['menu','over'].includes(document.getElementById('battle').dataset.mode),null,{timeout:60000});
    if((await mode(page))==='over')break;
    if(step===0){
      const h0=await heroHitLines(page);await page.click('#battle [data-kindle="1"]');ok((await page.getAttribute('#battle [data-kindle="1"]','aria-checked'))==='true',`${classId}: Kindle +1 is selected`);
      await command(page,async n=>{await page.click('#battle [data-cmd=attack]');await aim(page,n);});
      const h1=await heroHitLines(page);ok(h1-h0>=2,`${classId}: Kindle +1 made the attack hit twice (${h1-h0} hits logged)`);
      reveal=await page.evaluate(()=>({known:document.querySelectorAll('#battle .b-fray[data-known=true]').length,tested:document.querySelectorAll('#battle .b-fray[data-known=no]').length,lost:[...document.querySelectorAll('#battle .b-foe')].reduce((a,f)=>a+f.querySelectorAll('.b-pip[data-on=false]').length,0),sk:document.querySelector('#battle .b-kindle').dataset.level}));
      step++;continue;
    }
    if(!skillUsed){skillUsed=true;await command(page,async n=>{await page.click('#battle [data-cmd=skill]');await page.waitForSelector('#battle [data-skill]:not([disabled])');const idx=await page.$eval('#battle [data-skill]:not([disabled])',e=>e.dataset.skill);await page.click(`#battle [data-skill="${idx}"]`);await aim(page,n);});step++;continue;}
    await command(page,async n=>{await page.click('#battle [data-cmd=attack]');await aim(page,n);});step++;
  }
  if(classId==='mage'){ok(reveal&&reveal.known===0&&reveal.tested>=1&&reveal.lost===0,`${classId}: an arcane hit on wolves reveals nothing and is remembered as "not a Fray" ${JSON.stringify(reveal)}`);}
  else ok(reveal&&reveal.known>=1&&reveal.lost>=1,`${classId}: a Fray was revealed and a Ward pip lost ${JSON.stringify(reveal)}`);
  const res=await page.evaluate(()=>document.querySelector('#battle .b-result')?.dataset.result);
  ok(res==='won',`${classId}: battle won (${res})`);
  const sheet=await page.evaluate(()=>({title:document.querySelector('#battle .b-ov-title')?.textContent,coin:document.querySelector('#battle .b-rw-coin b')?.textContent,xp:document.querySelector('#battle .b-rw-xp b')?.textContent,stats:document.querySelectorAll('#battle .b-stats li').length,btn:!!document.querySelector('#battle .b-over [data-cmd=done]'),focus:document.activeElement?.dataset?.cmd,text:document.querySelector('#battle .b-result')?.textContent}));
  ok(sheet.title==='Victory'&&/^\+\d+/.test(sheet.coin||'')&&/^\+\d+/.test(sheet.xp||'')&&sheet.stats===6&&sheet.btn,`${classId}: result screen: Victory, coins ${sheet.coin}, experience ${sheet.xp}, ${sheet.stats} stats`);
  ok(sheet.focus==='done'&&/Victory! \+\d+ coins, \+\d+ experience/.test(sheet.text),`${classId}: Continue has focus; the result reads "${sheet.text}"`);
  await page.screenshot({path:`bt-${classId}-2.png`});
  await page.click('#battle [data-cmd=done]');
  ok(!!(await page.$('#battle[hidden]')),`${classId}: battle closes`);
  const st=await snapshot(page);
  ok(st.kills>=2,`${classId}: kills credited (${st.kills})`);ok(st.player.gold>25,`${classId}: gold rewarded ${st.player.gold}`);ok(st.player.hp>0,`${classId}: alive ${st.player.hp}`);
  const alive=st.enemies.filter(e=>!e.deadUntil&&['w1','w2'].includes(e.id));ok(alive.length===0,`${classId}: foes defeated`);
  ok(st.battleGrace>st.elapsed,`${classId}: a grace period follows the battle (${(st.battleGrace-st.elapsed).toFixed(1)}s)`);
  ok(JSON.stringify(await audioCounts(page))==='{"ctx":0,"play":0,"speech":0}',`${classId}: silent`);
  ok(page.errors.length===0,`${classId}: no page errors ${page.errors}`);
  await page.ctx.close();
}

// ---- fleeing: keep trying until the foes let the hero go; nobody is hurt or rewarded
if(want('flee')){
  console.log('battle flee');const page=await newPage(b,{w:1000,h:640});
  const shown=await enter(page,{classId:'warrior',enemies:[{id:'w1',dx:1.8,dy:0,hp:400,attack:1},{id:'w2',dx:3,dy:1,hp:400,attack:1}]});ok(shown,'flee: battle starts');
  let tries=0;
  while(tries<14){await page.waitForFunction(()=>['menu','over'].includes(document.getElementById('battle').dataset.mode),null,{timeout:90000});if((await mode(page))==='over')break;await command(page,()=>page.click('[data-cmd=flee]'));tries++;}
  const r=await page.evaluate(()=>({res:document.querySelector('#battle .b-result')?.dataset.result,title:document.querySelector('#battle .b-ov-title')?.textContent,text:document.querySelector('#battle .b-result')?.textContent,rewards:!!document.querySelector('#battle .b-rewards')}));
  ok(r.res==='fled'&&r.title==='Escaped',`flee: the hero got away after ${tries} tries (${r.res})`);ok(/escaped/i.test(r.text||'')&&!r.rewards,'flee: the result says so and shows no rewards');
  await page.click('#battle [data-cmd=done]');ok(!!(await page.$('#battle[hidden]')),'flee: battle closes');
  const st=await snapshot(page);ok(st.kills===0&&st.enemies.filter(e=>['w1','w2'].includes(e.id)&&!e.deadUntil).length===2,'flee: both foes are still alive, no kills');
  ok(st.battleGrace>st.elapsed+5,`flee: a longer grace follows a getaway (${(st.battleGrace-st.elapsed).toFixed(1)}s)`);
  ok(JSON.stringify(await audioCounts(page))==='{"ctx":0,"play":0,"speech":0}','flee: silent');ok(page.errors.length===0,'flee: no page errors '+page.errors);await page.ctx.close();
}

// ---- defeat: a crushing foe; the result says the shrine will call the hero back
if(want('defeat')){
  console.log('battle defeat');const page=await newPage(b,{w:1000,h:640});
  const shown=await enter(page,{classId:'mage',enemies:[{id:'w1',dx:1.8,dy:0,hp:900,attack:400}]});ok(shown,'defeat: battle starts');
  for(let i=0;i<8;i++){await page.waitForFunction(()=>['menu','over'].includes(document.getElementById('battle').dataset.mode),null,{timeout:90000});if((await mode(page))==='over')break;await command(page,()=>page.click('[data-cmd=guard]'));}
  const r=await page.evaluate(()=>({res:document.querySelector('#battle .b-result')?.dataset.result,title:document.querySelector('#battle .b-ov-title')?.textContent,text:document.querySelector('#battle .b-result')?.textContent,rewards:!!document.querySelector('#battle .b-rewards')}));
  ok(r.res==='lost'&&r.title==='Defeated',`defeat: the battle is lost (${r.res})`);ok(/wayfarer shrine/.test(r.text||'')&&!r.rewards,'defeat: the shrine will call the hero back; no rewards shown');
  await page.screenshot({path:'/tmp/shots-B/bt-defeat.png'});
  // The engine sets the hero down the moment the blow lands and logs it; the shrine calls them back 10 seconds later, and a slow
  // machine can replay the story for longer than that, so the log (not the current hp) is the proof that the hero fell.
  const down=await snapshot(page);ok(down.log.some(l=>/You have fallen/.test(l.text)),`defeat: the world logged that the hero fell (hp now ${down.player.hp})`);
  await page.click('#battle [data-cmd=done]');ok(!!(await page.$('#battle[hidden]')),'defeat: battle closes');
  const st=await snapshot(page,false);ok((st.player.hp===0&&st.player.deadUntil>0)||(st.player.hp>0&&!st.player.deadUntil),`defeat: the hero is still down or already called back (hp ${st.player.hp})`);
  ok(page.errors.length===0,'defeat: no page errors '+page.errors);await page.ctx.close();
}

// ---- the four layouts: one battle, resized through every viewport
if(want('layout')){
  console.log('battle layout');const page=await newPage(b,{w:1280,h:720});
  const shown=await enter(page,{classId:'summoner',companionId:'bone-squire',enemies:[{id:'w1',dx:1.8,dy:0,hp:400,attack:1},{id:'w2',dx:3,dy:1,hp:400,attack:1},{id:'w3',dx:3,dy:-1,hp:400,attack:1}]});ok(shown,'layout: battle starts');
  await idle(page,90000);
  const check=async(tag,vw,vh)=>page.evaluate(({tag,vw,vh})=>{
    const out=[],R=s=>[...document.querySelectorAll('#battle '+s)].filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed');
    const doc=document.documentElement;if(doc.scrollWidth>doc.clientWidth+0)out.push(`page scrolls sideways (${doc.scrollWidth}>${doc.clientWidth})`);
    const root=document.getElementById('battle');if(root.scrollWidth>root.clientWidth+1)out.push(`battle overflows sideways (${root.scrollWidth}>${root.clientWidth})`);
    const inside=(sel,name)=>{for(const e of R(sel)){const r=e.getBoundingClientRect();if(r.width&&(r.left<-1||r.top<-1||r.right>vw+1||r.bottom>vh+1))out.push(`${name} outside the viewport: ${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)} of ${vw}x${vh}`);}};
    for(const [s,n] of [['.b-top','top bar'],['.b-arena','arena'],['.b-menu','menu'],['.b-kindle','Kindle'],['.b-status','party cards'],['.b-log','log'],['.b-sub','panel'],['.b-timeline','strip']])inside(s,n);
    for(const e of R('button')){const r=e.getBoundingClientRect();if(r.width<43.5||r.height<43.5)out.push(`small touch target ${e.className||e.dataset.cmd} ${Math.round(r.width)}x${Math.round(r.height)}`);}
    const px=parseFloat(getComputedStyle(root).getPropertyValue('--b-px'));if(![1,1.5,2,3,4].includes(px))out.push('unexpected sprite scale: '+px);
    for(const c of R('.b-sprite')){const k=c.clientWidth/c.width*2;if(c.width%2===0&&Math.abs(k-Math.round(k))>1e-6)out.push(`sprite ${c.width}x${c.height} drawn ${c.clientWidth}x${c.clientHeight} is not a whole or half pixel multiple`);}
    const strip=document.querySelector('#battle .b-timeline').getBoundingClientRect();for(const t of R('.b-turn')){const r=t.getBoundingClientRect();if(r.left<strip.left-1||r.right>strip.right+1)out.push('turn chip outside its strip');}
    if(R('.b-turn').length!==8)out.push('strip has '+R('.b-turn').length+' turns');
    // figures must not hang outside the arena
    const ar=document.querySelector('#battle .b-arena').getBoundingClientRect();for(const e of R('.b-foe,.b-hero')){const r=e.getBoundingClientRect();if(r.left<ar.left-2||r.right>ar.right+2||r.top<ar.top-2||r.bottom>ar.bottom+2)out.push(`figure ${e.dataset.target||e.dataset.id} outside the arena`);}
    return {tag,problems:out,px,stack:root.dataset.stack};
  },{tag,vw,vh});
  for(const [vw,vh] of [[1280,720],[768,1024],[390,844],[844,390]]){
    await page.setViewportSize({width:vw,height:vh});await page.waitForTimeout(500);
    let r=await check('menu',vw,vh);ok(r.problems.length===0,`layout ${vw}x${vh} (command menu, scale ${r.px}, ${r.stack==='true'?'stacked':'side by side'}): ${r.problems.join('; ')||'fits'}`);
    await page.screenshot({path:`bt-layout-${vw}x${vh}-menu.png`});
    await page.click('#battle [data-cmd=skill]');await page.waitForTimeout(300);r=await check('skills',vw,vh);ok(r.problems.length===0,`layout ${vw}x${vh} (skill list): ${r.problems.join('; ')||'fits'}`);
    const scrolls=await page.evaluate(()=>{const s=document.querySelector('#battle .b-sub');return {h:s.scrollHeight,c:s.clientHeight,o:getComputedStyle(s).overflowY};});ok(scrolls.h<=scrolls.c+1||['auto','scroll'].includes(scrolls.o),`layout ${vw}x${vh}: a tall skill list scrolls inside its panel (${scrolls.h}/${scrolls.c}, ${scrolls.o})`);
    await page.screenshot({path:`bt-layout-${vw}x${vh}-skills.png`});
    await page.click('#battle .b-sub [data-cmd=back]');
    await page.click('#battle [data-cmd=attack]');await page.waitForSelector('#battle .b-foe.pick');await page.waitForTimeout(300);r=await check('aim',vw,vh);ok(r.problems.length===0,`layout ${vw}x${vh} (choosing a target): ${r.problems.join('; ')||'fits'}`);
    await page.hover('#battle .b-foe.pick');await page.screenshot({path:`bt-layout-${vw}x${vh}-aim.png`});
    await page.keyboard.press('Escape');
  }
  ok(page.errors.length===0,'layout: no page errors '+page.errors);await page.ctx.close();
}

// ---- keyboard only: arrows, Enter, Escape, number keys and K for Kindle
if(want('keys')){
  console.log('battle keys');const page=await newPage(b,{w:1000,h:640});
  const shown=await enter(page,{classId:'warrior',enemies:[{id:'w1',dx:1.8,dy:0,hp:400,attack:1},{id:'w2',dx:3,dy:1,hp:400,attack:1}]});ok(shown,'keys: battle starts');await idle(page,90000);
  const active=()=>page.evaluate(()=>document.activeElement?.dataset?.cmd||document.activeElement?.dataset?.skill&&('skill'+document.activeElement.dataset.skill)||document.activeElement?.dataset?.target||document.activeElement?.tagName);
  ok(await active()==='attack','keys: focus starts on Attack ('+await active()+')');
  await page.keyboard.press('ArrowDown');ok(await active()==='skill','keys: ArrowDown moves to Skills');
  await page.keyboard.press('Enter');await page.waitForSelector('#battle .b-sub:not([hidden]) [data-skill]');ok((await active()).startsWith('skill'),'keys: Enter opens the skill list and focuses a skill ('+await active()+')');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowUp');await page.keyboard.press('Escape');ok(!!(await page.$('#battle .b-sub[hidden]')),'keys: Escape closes the skill list');
  await page.keyboard.press('k');ok((await page.getAttribute('#battle [data-kindle="1"]','aria-checked'))==='true','keys: K spends 1 Kindle');
  await page.keyboard.press('k');ok((await page.getAttribute('#battle [data-kindle="0"]','aria-checked'))==='true','keys: K again cycles back to 0 (only 1 is available)');
  await page.keyboard.press('k');const h0=await heroHitLines(page);
  await page.keyboard.press('1');await page.waitForSelector('#battle .b-foe.pick');ok((await active())==='w1','keys: 1 starts an Attack, asks for a target and focuses the first foe ('+await active()+')');
  let n=await turns(page);await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await afterTurn(page,n);
  ok((await heroHitLines(page))-h0>=2,'keys: the attack with Kindle hit twice ('+((await heroHitLines(page))-h0)+')');
  n=await turns(page);await page.keyboard.press('2');await page.waitForSelector('#battle .b-sub:not([hidden]) [data-skill]');await page.keyboard.press('1');await afterTurn(page,n);
  const logs=await page.$$eval('#battle .b-log p',e=>e.map(x=>x.textContent));ok(logs.some(t=>/raises a shield wall/.test(t)),'keys: 2 then 1 used the first skill (Shield Wall)');
  n=await turns(page);await page.keyboard.press('3');await afterTurn(page,n);
  ok((await page.$$eval('#battle .b-log p',e=>e.map(x=>x.textContent))).some(t=>/braces for the next blows/.test(t)),'keys: 3 is Guard');
  // Tab stays inside the battle
  for(let i=0;i<30;i++)await page.keyboard.press('Tab');ok(await page.evaluate(()=>document.getElementById('battle').contains(document.activeElement)),'keys: Tab never leaves the battle');
  ok(page.errors.length===0,'keys: no page errors '+page.errors);await page.ctx.close();
}

// ---- reduced motion: nothing animates, the story still plays through quickly
if(want('motion')){
  console.log('battle motion');const page=await newPage(b,{w:1000,h:640});await page.emulateMedia({reducedMotion:'reduce'});
  const shown=await enter(page,{classId:'warrior',enemies:[{id:'w1',dx:1.8,dy:0,hp:400,attack:5},{id:'w2',dx:3,dy:1,hp:400,attack:5}]});ok(shown,'motion: battle starts');await idle(page,90000);
  let maxAnim=0,samples=0;const sampler=setInterval(async()=>{try{const n=await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.closest?.('#battle')).length);maxAnim=Math.max(maxAnim,n);samples++;}catch{}},120);
  const t0=Date.now();await command(page,async n=>{await page.click('[data-cmd=attack]');await aim(page,n);});const took=Date.now()-t0;clearInterval(sampler);
  ok(samples>=3&&maxAnim===0,`motion: no animation or transition runs inside the battle (${samples} samples, max ${maxAnim})`);
  // Wall-clock time depends on the machine (software GL here renders about 3 frames a second), so check what the screen asked for.
  const waited=Number(await page.evaluate(()=>document.getElementById('battle').dataset.waited||0));
  ok(waited>0&&waited<=1500,`motion: a whole round asks for at most 1.5 s of pauses, each at most 50 ms (${waited} ms requested; ${took} ms wall clock)`);
  ok(await page.evaluate(()=>[...document.querySelectorAll('#battle .b-bar>i')].every(i=>getComputedStyle(i).transitionDuration==='0s')),'motion: gauges jump instead of sliding');
  ok(page.errors.length===0,'motion: no page errors '+page.errors);await page.ctx.close();
}
process.exit(summary()?1:0);
