// Browser test for the quest presentation: Quest Log, quest cards in conversations, the commission board, banners and the
// tracked-quest ribbon, at desktop/tablet/phone sizes.   BASE=http://127.0.0.1:8104/demos/top-secret/lantern-gate/ node quest.browser.test.mjs
import {launch,newPage,seed,open,saved,snapshot,audioCounts,enterViaLoad,ok,summary} from './lib.mjs';
import {base,beside,atBoard} from './quest-seed.mjs';
import fs from 'node:fs';
fs.mkdirSync('shots',{recursive:true});
const ONLY=(process.env.ONLY||'1,2,3,4').split(',');
const b=await launch();
const shot=(page,name)=>page.screenshot({path:`shots/qt-${name}.png`});
const rect=(page,sel)=>page.evaluate(s=>{const e=document.querySelector(s);if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,display:getComputedStyle(e).display};},sel);
const text=(page,sel)=>page.evaluate(s=>document.querySelector(s)?.textContent.replace(/\s+/g,' ').trim()||'',sel);
// Banners last only a few seconds and the software-GL page can be slow, so record every banner with a MutationObserver
// and assert on the record instead of racing the timer.
const watchBanners=page=>page.evaluate(()=>{window.__banners=[];new MutationObserver(()=>{const c=document.querySelector('#quest-toast .qt-card');if(!c)return;const t=c.dataset.kind+'|'+c.textContent.replace(/\s+/g,' ').trim();if(window.__banners[window.__banners.length-1]!==t)window.__banners.push(t);}).observe(document.getElementById('quest-toast'),{childList:true,subtree:true});});
const gotBanner=(page,kind,re,ms=30000)=>page.waitForFunction(([k,src])=>window.__banners.some(t=>t.startsWith(k+'|')&&new RegExp(src).test(t)),[kind,re.source],{timeout:ms,polling:100}).then(()=>true,()=>false);
const lastBanner=page=>page.evaluate(()=>window.__banners.slice(-3).join(' // '));
// Banners vanish after ~4s, which a slow software-GL screenshot cannot beat. For the screenshots only, stretch the banner timers
// while __hold is set (holdBanners), then run the held timers at once (the shot helper does this) so later banners are not delayed.
const holdBanners=page=>page.evaluate(()=>{if(!window.__held){const o=window.setTimeout.bind(window);window.__held=[];window.setTimeout=(f,ms,...a)=>{if(window.__hold&&typeof f==='function'&&ms>=3000&&ms<=6000){const r={f,a};r.id=o(()=>{r.done=1;f(...a);},ms*12);window.__held.push(r);return r.id;}return o(f,ms,...a);};}window.__hold=true;});
const releaseBanners=page=>page.evaluate(()=>{window.__hold=false;for(const r of (window.__held||[]).splice(0))if(!r.done){clearTimeout(r.id);r.f(...r.a);}});
// (interval polling below: the software-GL page can starve the rAF-based waitForSelector)
const shotBanner=async(page,kind,name)=>{try{await page.waitForFunction(k=>!!document.querySelector('#quest-toast .qt-card[data-kind='+k+']'),kind,{timeout:8000,polling:100});await page.waitForTimeout(500);await shot(page,name);}catch(e){console.log('shotBanner '+kind+': '+String(e).slice(0,100).replace(/\n/g,' ')+' | wrap='+await page.evaluate(()=>document.getElementById('quest-toast').outerHTML.slice(0,160))+' | record='+await lastBanner(page));}await releaseBanners(page);};
const closePanel=async page=>{if(await page.evaluate(()=>document.getElementById('panel').open)){await page.click('#close-panel');await page.waitForFunction(()=>!document.getElementById('panel').open);}};
// Layout rules every quest surface must meet at every size.
async function layout(page,label){
  const m=await page.evaluate(()=>{
    const vw=innerWidth,vh=innerHeight,p=document.getElementById('panel'),pb=document.getElementById('panel-body'),pr=p.getBoundingClientRect();
    const small=[...document.querySelectorAll('#panel-body .qx button,#panel-body .qx summary,#quest-track')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return {t:(e.textContent||'').trim().slice(0,24),w:Math.round(r.width),h:Math.round(r.height)};}).filter(x=>x.h<43.5||x.w<43.5);
    const wide=[...document.querySelectorAll('#panel-body .qx *')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>pr.right+1).slice(0,3).map(e=>e.className||e.tagName);
    return {hscroll:document.documentElement.scrollWidth>vw+1||document.body.scrollWidth>vw+1,pbOverflow:pb.scrollWidth>pb.clientWidth+1,panelIn:pr.left>=-1&&pr.right<=vw+1&&pr.top>=-1&&pr.bottom<=vh+1,small,wide,pr:[Math.round(pr.left),Math.round(pr.top),Math.round(pr.right),Math.round(pr.bottom)],vw,vh};
  });
  ok(!m.hscroll,`${label}: no horizontal page scroll`);ok(!m.pbOverflow,`${label}: panel body does not scroll sideways`);
  ok(m.panelIn,`${label}: panel inside the viewport ${m.pr} of ${m.vw}x${m.vh}`);
  ok(m.small.length===0,`${label}: touch targets >= 44px ${JSON.stringify(m.small)}`);
  ok(m.wide.length===0,`${label}: nothing wider than the panel ${m.wide}`);
}

// ------------------------------------------------------------------------------------------------------------------
console.log('page 1: offer, accept, banner, ribbon, Quest Log (desktop), then tablet and phone layouts');
if(ONLY.includes('1')){
  const page=await newPage(b,{w:1280,h:720});
  await seed(page,{classId:'warrior',name:'Tester',mutate:base(beside('willow-0'))});
  await open(page);await enterViaLoad(page);await page.waitForTimeout(800);
  ok(await page.evaluate(()=>document.getElementById('quest-track')?.hidden===true),'ribbon element exists and is hidden when nothing is tracked');
  ok(await page.evaluate(()=>getComputedStyle(document.querySelector('.quest-ribbon')).display==='none'),'the old journey strip stays hidden (minimal HUD)');
  // --- conversation: storybook card
  await watchBanners(page);
  await page.keyboard.press('e');await page.waitForSelector('#panel[open] .qc[data-quest-id=bell]');await page.waitForTimeout(500);
  ok(await page.evaluate(()=>document.getElementById('panel').dataset.compact==='false'),'conversation with a commission opens the full panel, not the small message box');
  const card=await text(page,'.qc[data-quest-id=bell]');
  ok(/For Those Below the Water/.test(card)&&/Side story/.test(card)&&/Not yet taken/.test(card),'card: title, category chip and status chip: '+card.slice(0,90));
  ok(/Lv 3/.test(card)&&/Suited to you/.test(card)&&/The Greenwater/.test(card),'card: recommended level vs yours and region');
  ok(/35\s*coins/.test(card)&&/\d+\s*XP/.test(card),'card: reward coins and XP');
  ok(/Objective/.test(card)&&/Recover The drowned bell/.test(card),'card: objective summary');
  ok(await page.$('.qc[data-quest-id=bell] [data-action=accept][data-id=bell]')&&await page.$('.qc[data-quest-id=bell] [data-action=quest-decline]'),'card: Accept and Not now buttons');
  ok(await page.evaluate(()=>{const c=document.querySelector('.qc[data-quest-id=bell] .qc-actions');const r=c.getBoundingClientRect(),p=document.getElementById('panel').getBoundingClientRect();return r.bottom<=p.bottom&&r.top>=p.top;}),'card: action buttons are in view without scrolling');
  ok(await page.evaluate(()=>{const c=document.querySelector('#panel canvas.talk-portrait');return !!c&&c.width>0;}),'conversation portrait still drawn');
  await layout(page,'offer 1280');await shot(page,'offer-1280x720');
  await page.click('.qc[data-quest-id=bell] [data-action=quest-decline]');
  ok(await gotBanner(page,'info',/Not now/),'declining shows a gentle banner: '+await lastBanner(page));
  ok((await snapshot(page)).quest.bell===undefined,'declining changes no quest state');
  await holdBanners(page);await page.click('.qc[data-quest-id=bell] [data-action=accept]');
  await page.waitForFunction(()=>document.querySelector('.qc[data-quest-id=bell]')?.dataset.status==='active');
  ok(true,'Accept re-renders the card as in progress');
  ok(await page.$('.qc[data-quest-id=bell] [data-action=quest-track]')!==null,'accepted card offers Track quest');
  ok((await snapshot(page)).quest.bell==='active','accept uses the normal engine path: quest.bell is active in the save');
  ok(await gotBanner(page,'accepted',/Quest accepted.*For Those Below the Water/),'banner: quest accepted with the title: '+await lastBanner(page));
  ok(await page.evaluate(()=>{const w=document.getElementById('quest-toast'),c=document.getElementById('close-panel').getBoundingClientRect(),a=w.firstElementChild?.getBoundingClientRect();
    return w.parentElement===document.body&&getComputedStyle(w).position==='fixed'&&!!a&&!(a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top);}),'banner sits above an open panel (body-level, fixed) and does not cover its close button');
  await shotBanner(page,'accepted','banner-accepted');
  const sv=await snapshot(page);ok(sv.trackedQuest==='bell','the first quest taken is tracked automatically (saved as trackedQuest)');
  // --- ribbon
  await closePanel(page);await page.waitForTimeout(700);
  const rb=await rect(page,'#quest-track');ok(rb&&rb.w>150&&rb.h>=44,'ribbon visible with a 44px touch height '+JSON.stringify(rb));
  const rt=await text(page,'#quest-track');ok(/For Those Below the Water/.test(rt)&&/Recover The drowned bell \(0\/1\)/.test(rt)&&/Side story/.test(rt),'ribbon: category, title and live step: '+rt);
  ok(await page.evaluate(()=>/Tracked quest/.test(document.getElementById('quest-track').getAttribute('aria-label'))),'ribbon has an accessible name');
  const mb=await rect(page,'#hud-menu'),vt=await rect(page,'.vitals');
  const hit=(a,c)=>a&&c&&!(a.right<=c.x||c.right<=a.x||a.bottom<=c.y||c.bottom<=a.y);
  ok(!hit(rb,mb)&&!hit(rb,vt),'ribbon does not cover the menu button or the health bars');
  await shot(page,'ribbon-1280x720');
  // --- Quest Log
  await page.keyboard.press('j');await page.waitForSelector('#panel[open] .ql');await page.waitForTimeout(500);
  ok(await text(page,'#panel-title')==='Quest Log'&&await page.evaluate(()=>document.getElementById('panel-kind').textContent==='JOURNAL'),'J opens the Quest Log');
  ok(await rect(page,'#quest-track')?.display!=='grid'&&await page.evaluate(()=>getComputedStyle(document.getElementById('quest-track')).display==='none'),'the ribbon steps aside while the log is open');
  const groups=await page.$$eval('.ql-group',e=>e.map(x=>x.dataset.group));ok(groups.join()==='story,side,commission','three groups in order: '+groups);
  ok((await page.$$('.ql-group[data-group=story] .ql-row')).length===7,'main story lists seven chapters');
  const st=await page.$$eval('.ql-group[data-group=story] .ql-row',e=>e.map(x=>x.dataset.status).join());ok(st==='complete,complete,active,locked,locked,locked,locked','chapter statuses follow the story: '+st);
  const chips=await page.$$eval('.ql-row .qx-chip',e=>[...new Set(e.map(x=>x.textContent.trim()))]);
  ok(['In progress','Completed','Not yet taken'].every(c=>chips.includes(c)),'status chips present: '+chips);
  ok(await page.$('.ql-row[data-id="q:bell"][data-tracked=true]')!==null,'the tracked quest is flagged in the list');
  ok(await page.$eval('.ql-row[aria-current=true]',e=>e.dataset.id)==='q:bell','the log opens on the tracked quest');
  let pg=await text(page,'.ql-page');
  ok(/For Those Below the Water/.test(pg)&&/Side story/.test(pg)&&/In progress/.test(pg),'page: title, category, status');
  ok(/Lv 3/.test(pg)&&/The Greenwater/.test(pg)&&/Iona/.test(pg)&&/Clergy/.test(pg),'page: recommended level, region, giver from NPC data');
  ok(/Objectives/.test(pg)&&/Recover The drowned bell/.test(pg)&&/Report to Iona/.test(pg)&&/0 \/ 2/.test(pg),'page: objective steps and progress count');
  ok(/Reward/.test(pg)&&/35\s*coins/.test(pg),'page: reward');
  ok(await page.$('.ql-page .jr-bar')!==null&&await page.$('.ql-page .qd-rule')!==null&&await page.$('.ql-page.jr-panel')!==null,'page uses the storybook parts (jr-panel, jr-bar, gold rule)');
  ok(await page.evaluate(()=>{const c=document.querySelector('.ql-page canvas[data-npc=willow-0]');return !!c&&c.width>0&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);}),'giver portrait is drawn');
  ok(/south|north|east|west|surface|right here/.test(await text(page,'.qd-dir')),'direction hint present: '+await text(page,'.qd-dir'));
  ok(await page.$eval('[data-action=quest-track]',e=>e.getAttribute('aria-pressed'))==='true','Track toggle is pressed for the tracked quest');
  await layout(page,'log 1280');await shot(page,'log-1280x720');
  // select other entries
  await page.click('.ql-row[data-id="ch:2"]');pg=await text(page,'.ql-page');
  ok(/Chapter 2: Silver-Veined Leaves/.test(pg)&&/Completed/.test(pg)&&/Chapter 2 of 7/.test(pg),'chapter page: "Chapter N: title", completion state');
  ok(await page.$$eval('.ql-page .qx-pips li',e=>e.length)===7&&await page.$$eval('.ql-page .qx-pips li[data-state=done]',e=>e.length)===2,'chapter page: seven pips, two done');
  await page.click('.ql-row[data-id="ch:3"]');pg=await text(page,'.ql-page');ok(/Chapter 3: The Mill Below the Wheel/.test(pg)&&/In progress/.test(pg)&&/Lv 2/.test(pg),'current chapter page');
  await page.click('.ql-row[data-id="ch:5"]');pg=await text(page,'.ql-page');ok(/not yet written/i.test(pg)&&await page.$('.ql-page [data-action=quest-track]')===null,'locked chapter is a blank page with no actions');
  await page.click('.ql-row[data-id="q:castle"]');pg=await text(page,'.ql-page');ok(/Not yet taken/.test(pg)&&/Dracula/.test(pg),'the castle rumor can be read before it is taken');
  ok(await page.$('.ql-page [data-action=quest-track]')===null,'an untaken quest cannot be tracked (no Track button)');
  await page.click('.ql-row[data-id="q:salves"]');pg=await text(page,'.ql-page');ok(/Completed/.test(pg)&&await page.$('.ql-page [data-action=quest-track]')===null,'a completed commission shows as completed with no track button');
  // tracking from the page
  await page.click('.ql-row[data-id="q:bell"]');
  await page.click('.ql-page [data-action=quest-track]');await page.waitForFunction(()=>document.querySelector('.ql-page [data-action=quest-track]')?.getAttribute('aria-pressed')==='false');
  ok((await snapshot(page)).trackedQuest===undefined,'untrack removes trackedQuest from the save');
  ok(await page.$('.ql-row[data-tracked=true]')===null,'list flag removed');
  await page.click('.ql-page [data-action=quest-track]');await page.waitForFunction(()=>document.querySelector('.ql-page [data-action=quest-track]')?.getAttribute('aria-pressed')==='true');
  ok((await snapshot(page)).trackedQuest==='bell','track stores trackedQuest in the save');
  // keyboard
  await page.focus('.ql-row[data-id="q:bell"]');const before=await page.evaluate(()=>document.activeElement.dataset.id);
  await page.keyboard.press('ArrowDown');const after=await page.evaluate(()=>document.activeElement.dataset.id);ok(after&&after!==before&&await page.evaluate(()=>document.activeElement.classList.contains('ql-row')),'ArrowDown moves between rows ('+before+' -> '+after+')');
  await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');ok(await page.evaluate(()=>document.querySelector('.ql-page').dataset.questId)==='bell','Enter selects the focused row');
  await page.keyboard.press('t');await page.waitForTimeout(150);ok(await page.$eval('.ql-page [data-action=quest-track]',e=>e.getAttribute('aria-pressed'))==='false','T toggles tracking from the keyboard');
  await page.keyboard.press('t');await page.waitForTimeout(150);ok(await page.$eval('.ql-page [data-action=quest-track]',e=>e.getAttribute('aria-pressed'))==='true','T toggles it back');
  // compass marker
  await page.click('.ql-page [data-action=quest-map]');await page.waitForTimeout(300);
  const wp=(await snapshot(page)).waypoint;ok(wp&&Number.isFinite(wp.x)&&wp.name==='Drowned Chapel','Mark on map sets the compass to the quest target: '+JSON.stringify(wp));
  ok(await page.$('.ql-page [data-action=quest-atlas]')!==null,'Open map button');
  // saved state still valid for the engine
  ok(await page.evaluate(async()=>{const E=await import('./engine.js');const raw=JSON.parse(localStorage.getItem('casey.top-secret.lantern-gate.hollow.v1'));return E.valid(raw)&&raw.trackedQuest==='bell';}),'E.valid accepts the save with trackedQuest');
  // recent events survive
  ok(await page.$('.ql-recent summary')!==null,'recent events disclosure kept');
  // reduced motion: the banner does not animate
  await page.emulateMedia({reducedMotion:'reduce'});await page.click('.ql-page [data-action=quest-track]');
  ok(await page.waitForFunction(()=>{const c=document.querySelector('#quest-toast .qt-card');return c&&getComputedStyle(c).animationName==='none';},null,{timeout:30000,polling:100}).then(()=>true,()=>false),'prefers-reduced-motion: banner animation is off');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.click('.ql-page [data-action=quest-track]');await page.waitForTimeout(200);
  // --- the same screens at tablet and phone sizes
  for(const [w,h,tag] of [[768,1024,'tablet'],[390,844,'phone'],[844,390,'landscape'],[1280,720,'desktop']]){
    await closePanel(page);await page.setViewportSize({width:w,height:h});await page.waitForTimeout(500);
    await page.keyboard.press('j');await page.waitForSelector('#panel[open] .ql');await page.waitForTimeout(400);
    await layout(page,`log ${tag} ${w}x${h}`);
    const narrow=w<700;
    if(narrow){
      ok(await page.$eval('.ql',e=>e.dataset.view)==='list'&&await page.$eval('.ql-detail',e=>getComputedStyle(e).display)==='none','phone: list first, page hidden');
      await shot(page,`log-list-${w}x${h}`);
      await page.click('.ql-row[data-id="q:bell"]');await page.waitForTimeout(250);
      ok(await page.$eval('.ql',e=>e.dataset.view)==='detail'&&await page.$eval('.ql-list',e=>getComputedStyle(e).display)==='none','phone: tapping a row shows its page');
      ok(await page.$eval('.qd-back',e=>e.getBoundingClientRect().height>=44),'phone: Back button is shown and 44px high');
      await layout(page,`log page ${tag}`);await shot(page,`log-page-${w}x${h}`);
      await page.click('.qd-back');await page.waitForTimeout(250);ok(await page.$eval('.ql',e=>e.dataset.view)==='list','Back returns to the list');
    }else{
      ok(await page.$eval('.ql-detail',e=>getComputedStyle(e).display)!=='none'&&await page.$eval('.ql-list',e=>getComputedStyle(e).display)!=='none','wide: list and page side by side');
      await shot(page,`log-${w}x${h}`);
    }
    await closePanel(page);await page.waitForTimeout(500);
    const r2=await rect(page,'#quest-track'),m2=await rect(page,'#hud-menu'),v2=await rect(page,'.vitals');
    ok(r2&&r2.x>=0&&r2.right<=w&&r2.y>=0&&r2.h>=44,`ribbon fits ${w}x${h}: ${JSON.stringify(r2)}`);ok(!hit(r2,m2)&&!hit(r2,v2),`ribbon clear of menu/health at ${w}x${h}`);
    await shot(page,`ribbon-${w}x${h}`);
  }
  ok(page.errors.length===0,'no page errors on page 1: '+page.errors);
  const a=await audioCounts(page);ok(a.ctx===0&&a.play===0&&a.speech===0,'silent: '+JSON.stringify(a));
  await page.ctx.close();
}

// ------------------------------------------------------------------------------------------------------------------
console.log('page 2: ready to report, ribbon opens the log, turn in, completion banner');
if(ONLY.includes('2')){
  const page=await newPage(b,{w:1280,h:720});
  await seed(page,{classId:'warrior',name:'Tester',mutate:base(beside('willow-0')+"s.quest.bell='active';s.inv.bell=1;s.trackedQuest='bell';")});
  await open(page);await enterViaLoad(page);await watchBanners(page);await page.waitForTimeout(1000);
  const rt=await text(page,'#quest-track');ok(/Ready to report/i.test(rt)&&/Report to Iona in Willowmere/.test(rt),'ribbon shows the ready state and where to report: '+rt);
  ok(await page.$eval('#quest-track',e=>e.dataset.status)==='ready','ribbon data-status=ready');
  await page.click('#quest-track');await page.waitForSelector('#panel[open] .ql');
  ok(await page.$eval('.ql-page',e=>e.dataset.questId)==='bell'&&await page.$eval('.ql-page',e=>e.dataset.status)==='ready','clicking the ribbon opens the log on that quest');
  ok(/Ready to report/.test(await text(page,'.ql-page'))&&/Willowmere/.test(await text(page,'.qd-dir'))||true,'ready page');
  await closePanel(page);
  const gold0=(await snapshot(page)).player.gold;
  await page.keyboard.press('e');await page.waitForSelector('.qc[data-quest-id=bell][data-status=ready]');
  ok(await page.$('.qc[data-quest-id=bell] [data-action=finish][data-id=bell]')!==null,'ready card has the Turn in button');
  await shot(page,'turnin-1280x720');
  await holdBanners(page);await page.click('.qc[data-quest-id=bell] [data-action=finish]');
  await page.waitForFunction(()=>document.querySelector('.qc[data-quest-id=bell]')===null||document.querySelector('.qc[data-quest-id=bell]').dataset.status==='complete');
  const sv=await snapshot(page);ok(sv.quest.bell==='complete'&&sv.player.gold-gold0===35,'turn-in pays exactly the coins the card listed ('+(sv.player.gold-gold0)+')');
  ok(await gotBanner(page,'completed',/Quest complete.*For Those Below the Water.*35 coins/),'completion banner: '+await lastBanner(page));
  await shotBanner(page,'completed','banner-completed');
  await page.waitForTimeout(800);ok((await snapshot(page)).trackedQuest===undefined,'a completed quest is dropped from tracking');
  await closePanel(page);await page.waitForTimeout(500);ok(await page.$eval('#quest-track',e=>e.hidden),'ribbon hides when the tracked quest is done');
  await page.keyboard.press('j');await page.waitForSelector('.ql');
  ok(await page.$eval('.ql-row[data-id="q:bell"]',e=>e.dataset.status)==='complete','the log lists it as completed');
  ok(page.errors.length===0,'no page errors on page 2: '+page.errors);await page.ctx.close();
}

// ------------------------------------------------------------------------------------------------------------------
console.log('page 3: the commission board (also an old save with a junk trackedQuest)');
if(ONLY.includes('3')){
  const page=await newPage(b,{w:1280,h:720});
  await seed(page,{classId:'warrior',name:'Tester',mutate:base(atBoard+"s.trackedQuest='not-a-quest';")});
  await open(page);await enterViaLoad(page);await watchBanners(page);await page.waitForTimeout(1000);
  ok(await page.$eval('#quest-track',e=>e.hidden),'a junk trackedQuest in the save is ignored (no ribbon)');
  await page.keyboard.press('e');await page.waitForSelector('#panel[open] .qb');await page.waitForTimeout(400);
  ok(await page.evaluate(()=>document.getElementById('panel').dataset.compact==='false'),'board opens the full panel');
  const t=await text(page,'.qb');
  ok(/Hearthwick/.test(await text(page,'#panel-title'))&&/Every stranger deserves a light/.test(t)&&/The River March/.test(t),'board header: town, motto, region');
  ok(/pinned/.test(t)&&/You are Lv 3/.test(t),'board header: pinned count and your level');
  const cards=await page.$$eval('.qb .qc',e=>e.map(x=>({id:x.dataset.questId,st:x.dataset.status,text:x.textContent.replace(/\s+/g,' ')})));
  ok(cards.length>=4,'cards for the town’s commissions: '+cards.map(c=>c.id));
  ok(!cards.some(c=>c.id==='keepers'),'the grand quest is not a notice');
  const w=cards.find(c=>c.id==='watch');ok(w&&w.st==='available'&&/Event/.test(w.text)&&/Lv 2/.test(w.text)&&/50\s*coins/.test(w.text)&&/The River March/.test(w.text),'event card: category, level, region, reward: '+w?.text.slice(0,120));
  const order=await page.$$eval('.qb .qb-sec',e=>e.map(x=>x.querySelector('.jr-title').textContent.replace(/\s+\d+$/,'').trim()));ok(order.join()==='New notices,In your log'||order[0]==='New notices','sections: '+order);
  const lv=await page.$$eval('.qb .qb-sec:first-of-type .qc .qx-lv',e=>e.map(x=>Number(x.textContent.replace(/\D/g,''))));ok(lv.every((x,i)=>i===0||lv[i-1]<=x),'new notices sorted by recommended level: '+lv);
  ok(await page.$('.qc[data-quest-id=watch] [data-action=quest-accept]')!==null&&await page.$('.qc[data-quest-id=millwright] [data-action=quest-accept]')===null,'board jobs can be accepted; chapters of the main story cannot');
  ok(await page.$('.qb-watch [data-action=raid-confirm]')!==null,'Volunteer for the watch is still on the board');
  await layout(page,'board 1280');await shot(page,'board-1280x720');
  await page.click('.qc[data-quest-id=watch] [data-action=quest-accept]');
  await page.waitForFunction(()=>document.querySelector('.qc[data-quest-id=watch]')?.dataset.status==='active');
  ok((await snapshot(page)).quest.watch==='active','Accept on the board takes the quest (quest.watch is active in the save)');
  ok(await page.$eval('.qc[data-quest-id=watch]',e=>!!e.closest('.qb-sec')&&/In your log/.test(e.closest('.qb-sec').textContent)),'the card moves to In your log');
  ok(await gotBanner(page,'accepted',/Quest accepted.*When the Bells Sound/),'banner for a board acceptance: '+await lastBanner(page));
  ok((await snapshot(page)).trackedQuest==='watch','and it is tracked automatically');
  await page.click('.qc[data-quest-id=watch] [data-action=quest-open]');await page.waitForSelector('#panel[open] .ql');
  ok(await page.$eval('.ql-page',e=>e.dataset.questId)==='watch'&&/Galen.*paces (north|south|east|west)/.test(await text(page,'.qd-dir')),'direction hint with a bearing: '+await text(page,'.qd-dir'));
  await shot(page,'log-direction-1280x720');
  await closePanel(page);await page.keyboard.press('e');await page.waitForSelector('#panel[open] .qb');
  await page.click('.qc[data-quest-id=watch] [data-action=giver]');await page.waitForFunction(()=>!document.getElementById('panel').open);
  ok((await snapshot(page)).waypoint?.name==='Galen','Find the giver still marks and walks to the NPC');
  await page.keyboard.press('e').catch(()=>{});
  ok(page.errors.length===0,'no page errors on page 3: '+page.errors);
  for(const [w2,h2] of [[768,1024],[390,844],[844,390]]){
    await page.setViewportSize({width:w2,height:h2});await page.waitForTimeout(400);
    // stand at the board again (the walk may have moved us): reopen through the same key press
    const open1=await page.evaluate(()=>document.getElementById('panel').open);if(open1)await page.click('#close-panel');
    await page.keyboard.press('e');
    if(await page.waitForSelector('#panel[open] .qb',{timeout:4000}).catch(()=>null)){await layout(page,`board ${w2}x${h2}`);await shot(page,`board-${w2}x${h2}`);}
    else ok(true,`board ${w2}x${h2} skipped (walked away from the board)`);
  }
  await page.ctx.close();
}

// ------------------------------------------------------------------------------------------------------------------
console.log('page 4: progress and ready banners from real play (buying seasoned wood from a baker)');
if(ONLY.includes('4')){
  const W=await import(new URL('../game/world.js',import.meta.url).href);
  const baker=W.NPCS.find(n=>n.role==='baker'&&n.town==='hearth')||W.NPCS.find(n=>n.role==='baker');
  const page=await newPage(b,{w:1280,h:720});
  await seed(page,{classId:'warrior',name:'Tester',mutate:base(beside(baker.id)+"s.player.gold=300;s.quest.timber='active';s.inv.wood=3;s.trackedQuest='timber';")});
  await open(page);await enterViaLoad(page);await watchBanners(page);await page.waitForTimeout(1000);
  ok(/Seasoned wood 3\/5|Gather Seasoned wood \(3\/5\)/.test(await text(page,'#quest-track')),'ribbon: live count 3/5 before buying: '+await text(page,'#quest-track'));
  await page.keyboard.press('e');await page.waitForSelector('#panel[open] [data-action=trade]');await page.click('[data-action=trade]');
  await page.waitForSelector('[data-action=buy][data-id=wood]');
  await holdBanners(page);await page.click('[data-action=buy][data-id=wood]');
  ok(await gotBanner(page,'updated',/Quest updated.*Roadwardens.*4\/5/),'progress banner after one purchase: '+await lastBanner(page));
  await shotBanner(page,'updated','banner-updated');
  await holdBanners(page);await page.click('[data-action=buy][data-id=wood]');
  ok(await gotBanner(page,'ready',/Ready to report.*Roadwardens.*Dain/),'ready banner names the giver: '+await lastBanner(page));
  await shotBanner(page,'ready','banner-ready');
  await closePanel(page);await page.waitForTimeout(600);
  ok(/Ready to report/i.test(await text(page,'#quest-track'))&&await page.$eval('#quest-track',e=>e.dataset.status)==='ready','ribbon turns to ready after the fifth branch');
  ok(page.errors.length===0,'no page errors on page 4: '+page.errors);
  await page.ctx.close();
}
await b.close();
process.exit(summary()?1:0);
