// Node tests for the quest presentation layer (quest-meta.js): metadata, chapters, live progress, tracking,
// change detection and compatibility with old saves. No browser.   ROOT=/path/to/game node quest.test.mjs
const ROOT=process.env.ROOT||'/home/claude/wt/Q/game';
const E=await import(ROOT+'/engine.js'),J=await import(ROOT+'/journey.js'),L=await import(ROOT+'/life.js'),W=await import(ROOT+'/world.js');
const Q=await import(ROOT+'/quest-meta.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('  FAIL',m);}};
const NOW=1e12,clone=o=>JSON.parse(JSON.stringify(o)),eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const make=(classId='warrior')=>{const s=E.fresh(NOW);L.upgrade(s);J.upgrade(s);const m=J.create(s,{name:'Tester',classId,gender:'female',skin:'warm',hair:'brown',outfit:'traveler',companionId:classId==='summoner'?'moss-golem':classId==='ranger'?'ash-wolf':null});ok(s.journey.created,'created '+m);s.enemies=[];return s;};
const near=(s,id)=>{const n=s.actors.find(a=>a.id===id);Object.assign(s.player,{map:n.map,x:n.x-1,y:n.y,path:[]});return n;};
const get=(s,id)=>Q.progress(s,id);

console.log('metadata');
{
 ok(Q.ALL.length===W.quests.length+1&&Q.questById('castle')?.kind==='castle','castle is a virtual quest after the world quests');
 ok(Q.questById('nope')===null&&Q.metaOf('nope')===null&&Q.progress(make(),'nope')===null,'unknown ids are null, not a throw');
 const cats=new Set(Object.keys(Q.CATEGORIES));
 for(const q of Q.ALL){
  const m=Q.metaOf(q);
  ok(cats.has(m.category)&&m.categoryLabel===Q.CATEGORIES[m.category],`${q.id}: category ${m.category}`);
  ok(Number.isInteger(m.level)&&m.level>=1&&m.level<=8,`${q.id}: recommended level ${m.level}`);
  ok(typeof m.region==='string'&&m.region.length>2&&m.town,`${q.id}: region ${m.region}`);
  ok(m.hook&&m.hook!==q.desc,`${q.id}: has its own hook line`);
  ok(m.reward.coins===q.reward&&Number.isInteger(m.reward.xp)&&Array.isArray(m.reward.items),`${q.id}: reward mirrors world.js (${q.reward})`);
  if(q.id!=='castle'){const npc=W.NPCS.find(n=>n.id===q.giver);ok(npc&&m.giverName===npc.name&&m.region===W.TOWNS.find(t=>t.id===npc.town).region,`${q.id}: giver ${m.giverName} and region come from NPC data`);}
  ok(Q.tabOf(q)==='story'||Q.tabOf(q)==='side'||Q.tabOf(q)==='commission',`${q.id}: log tab ${Q.tabOf(q)}`);
 }
 ok(Q.ALL.filter(q=>Q.metaOf(q).category==='story').map(q=>q.id).sort().join()==='keepers,lantern,medicine,millwright','story quests are the chapter quests');
 ok(Q.ALL.filter(q=>q.id.startsWith('provisions-')).every(q=>Q.metaOf(q).category==='commission'),'provisions are commissions');
 ok(Q.metaOf('watch').category==='event'&&Q.tabOf('watch')==='commission','the watch is an event listed with commissions');
 ok(Q.metaOf('provisions-willow').level<=Q.metaOf('provisions-high').level,'provisions scale with distance from Hearthwick');
 ok(Q.metaOf('castle').region==='The Mourning Crown','castle region');
 // XP mirrors progression: quest XP is paid by P.awardExperience(...'quest'...) when a quest completes
 const s=make(),before=s.player.xp;s.inv.leaf=3;near(s,'orin');E.talk(s,'orin','quest:medicine');E.talk(s,'orin','finish:medicine');
 ok(s.quest.medicine==='complete'&&s.player.xp-before===Q.metaOf('medicine').reward.xp,`medicine pays ${Q.metaOf('medicine').reward.xp} XP as listed (got ${s.player.xp-before})`);
 ok(Q.metaOf('medicine').reward.coins===18&&s.player.gold===25+18,'medicine pays its coins');
 ok(Q.metaOf('keepers').reward.xp===0&&Q.metaOf('castle').reward.xp===0,'main quest and castle arc list no XP (they pay coins only)');
}

console.log('chapters');
{
 ok(Q.CHAPTERS.length===7&&Q.CHAPTERS.every((c,i)=>c.n===i+1&&c.title&&c.blurb&&c.recap&&c.place&&Q.questById(c.quest)),'seven ordered chapters with title/blurb/recap/place and a real quest');
 const s=make(),st=()=>Q.chapters(s).map(c=>c.state[0]).join('');
 ok(st()==='cllllll','chapter 1 is current and the rest are locked on a fresh journey: '+st());
 ok(Q.currentChapter(s).n===1&&Q.objectiveText(s)===E.objective(s),'chapter 1 matches the engine objective');
 near(s,'mara');s.flags.metMara=true;
 ok(Q.currentChapter(s).n===2,'meeting Mara opens chapter 2');
 // each chapter becomes current exactly where engine.objective changes its text
 const seq=[];const record=()=>seq.push(Q.currentChapter(s)?.n??0);
 record();s.quest.medicine='complete';record();s.quest.millwright='complete';record();s.inv.lantern=1;record();s.beacons=[0,1,2];record();s.flags.warden=true;record();s.won=true;s.quest.keepers='complete';record();
 ok(seq.join()==='2,3,4,5,6,7,0',`chapter order follows the story: ${seq}`);
 ok(Q.chapters(s).every(c=>c.state==='done'),'all chapters done after the ending');
 ok(Q.storyCount(s).done===7&&Q.storyCount(make()).done===0,'story completion count');
 // out-of-order play: millwright first -> chapter 2 stays current, chapter 3 is done, nothing is lost
 const t=make();t.flags.metMara=true;t.quest.medicine='active';t.quest.millwright='complete';
 const c=Q.chapters(t);ok(c[1].state==='current'&&c[2].state==='done'&&c[3].state==='locked','out-of-order: chapter 2 current, chapter 3 done');
 const rows=Q.chapterRows(t);ok(rows.length===7&&rows[2].status==='complete'&&rows[1].status==='active'&&rows[6].status==='locked'&&rows[6].progress===null,'chapterRows statuses: '+rows.map(r=>r.status));
 ok(rows.every(r=>r.state==='locked'?r.totalSteps===0:r.totalSteps>=1),'locked chapters hide their steps, others have steps');
 // chapter rows never leak a quest that is not in the world
 ok(rows.every(r=>Q.questById(r.trackId)),'every chapter row can be tracked through a real quest id');
}

console.log('live progress');
{
 const s=make();
 let p=get(s,'medicine');
 ok(p.status==='available'&&!p.accepted&&p.steps[0].id==='speak'&&p.steps.length===3,'untaken quest: first step is to speak with the giver');
 ok(p.giver.name==='Orin'&&p.giver.region==='The River March'&&Number.isFinite(p.giver.x),'giver info from NPC data');
 near(s,'orin');E.talk(s,'orin','quest:medicine');
 p=get(s,'medicine');ok(p.status==='active'&&p.accepted&&p.steps[0].id==='gather'&&p.steps[0].count===0&&p.steps[0].need===3,'accepted: Gather Moonleaf 0/3');
 ok(p.line==='Gather Moonleaf (0/3)'&&p.current.hint,'live objective line with a hint: '+p.line);
 s.inv.leaf=2;p=get(s,'medicine');ok(p.steps[0].count===2&&p.fraction>0&&p.fraction<1&&!p.ready,'two leaves: partial progress '+p.fraction.toFixed(2));
 s.inv.leaf=9;p=get(s,'medicine');ok(p.status==='ready'&&p.ready&&p.steps[0].count===3&&p.steps[0].done&&p.current.id==='report','nine leaves is clamped to 3/3 and ready to report');
 ok(p.line==='Report to Orin in Hearthwick','ready line names the giver and town: '+p.line);
 ok(E.ready(s,p.quest)===p.ready,'ready flag agrees with engine.ready');
 E.talk(s,'orin','finish:medicine');p=get(s,'medicine');ok(p.status==='complete'&&p.complete&&p.fraction===1&&p.steps.every(x=>x.done)&&p.line==='Completed','completed');
 // craft quest: two items
 s.quest.lantern='active';p=get(s,'lantern');ok(p.steps.length===3&&p.steps[0].id==='coil'&&p.steps[1].id==='lens','lantern quest has coil and lens steps');
 s.inv.coil=1;p=get(s,'lantern');ok(p.steps[0].done&&!p.steps[1].done&&p.current.id==='lens'&&!p.ready,'coil only');
 s.inv.lens=1;p=get(s,'lantern');ok(p.ready&&p.status==='ready','coil and lens: ready');
 // choice quest
 s.quest.ledger='active';s.inv.ledger=1;p=get(s,'ledger');ok(p.ready&&/Decide the ledger/.test(p.line),'choice quest: ledger decision');
 // counted explore/defend quests follow state counters
 s.quest.traveler='active';p=get(s,'traveler');ok(p.steps[0].count===s.discovered.length&&p.steps[0].need===9,'traveler counts discovered towns');
 s.discovered=W.TOWNS.slice(0,9).map(t=>t.id);p=get(s,'traveler');ok(p.ready&&p.steps[0].done,'nine towns: ready');
 s.quest.watch='active';s.raidsWon=1;p=get(s,'watch');ok(p.ready,'one raid won: watch ready');
 s.quest.ruins='active';s.sites=['mill','chapel','quarry'];p=get(s,'ruins');ok(p.steps[0].count===3&&!p.ready,'deep sites counted');
 // provisions needs bread or trout depending on the town
 const bread=W.quests.find(q=>q.id.startsWith('provisions-')&&q.item==='bread'),fish=W.quests.find(q=>q.id.startsWith('provisions-')&&q.item==='fish');
 ok(get(s,bread.id).steps.some(x=>x.noun==='Hearth bread')&&get(s,fish.id).steps.some(x=>x.noun==='River trout'),'provisions name the right item');
 // every quest, in every plausible state, yields a well-formed record
 const states=[make(),(()=>{const t=make();for(const q of W.quests)t.quest[q.id]='active';t.inv.leaf=3;return t;})(),(()=>{const t=make();for(const q of W.quests)t.quest[q.id]='complete';t.won=true;t.flags.metMara=true;t.flags.warden=true;t.beacons=[0,1,2];t.journey.castleQuest='complete';t.journey.clues=['seed','bell','names'];return t;})()];
 for(const [i,t] of states.entries())for(const q of Q.ALL){const r=Q.progress(t,q);
  ok(r&&Array.isArray(r.steps)&&r.fraction>=0&&r.fraction<=1&&['available','active','ready','complete'].includes(r.status)&&typeof r.line==='string',`state ${i} ${q.id}: well-formed progress (${r?.status})`);
  ok(r.steps.every(x=>x.label&&typeof x.done==='boolean'&&(!x.need||x.count<=x.need)),`state ${i} ${q.id}: steps have labels and bounded counts`);
  if(r.status==='complete')ok(r.fraction===1,`state ${i} ${q.id}: complete means full bar`);}
}

console.log('castle arc');
{
 const s=make();let p=get(s,'castle');
 ok(p.status==='available'&&p.steps[0].id==='visit'&&p.giver.town==='Dracula’s Castle','castle: not yet heard, first step is to travel');
 s.journey.castleQuest='active';p=get(s,'castle');ok(p.status==='active'&&p.steps.map(x=>x.id).join()==='seed,bell,names'&&p.steps[2].blocked,'castle: three clue steps, ledger blocked until the others');
 s.inv.leaf=3;p=get(s,'castle');ok(p.ready&&p.steps[0].count===3,'castle: three moonleaf makes the seed clue ready');
 s.journey.clues=['seed'];s.inv.ore=3;s.inv.wood=2;p=get(s,'castle');ok(p.steps[0].done&&p.ready,'castle: bell is ready after the seed');
 s.journey.clues=['seed','bell'];p=get(s,'castle');ok(p.ready&&!p.steps[2].blocked,'castle: ledger unblocked');
 s.journey.castleQuest='complete';p=get(s,'castle');ok(p.status==='complete'&&p.fraction===1,'castle complete');
 ok(Q.target(make(),'castle').name==='Dracula’s Castle','castle compass target');
}

console.log('tracking');
{
 const s=make();
 ok(Q.trackedQuest(s)===null&&Q.objectiveText(s)===E.objective(s),'nothing tracked by default, ribbon text is the main objective');
 ok(Q.setTracked(s,'bell')===false&&!('trackedQuest' in s),'an untaken quest cannot be tracked');
 ok(Q.setTracked(s,'nope')===false,'unknown id cannot be tracked');
 s.quest.bell='active';ok(Q.setTracked(s,'bell')===true&&s.trackedQuest==='bell'&&Q.trackedQuest(s)==='bell','active quest can be tracked');
 ok(/^For Those Below the Water · /.test(Q.objectiveText(s)),'ribbon text leads with the tracked quest: '+Q.objectiveText(s));
 ok(Q.focus(s).source==='tracked'&&Q.focus(s).id==='bell','focus follows the tracked quest');
 s.inv.bell=1;ok(Q.trackedQuest(s)==='bell'&&/Report to Iona/.test(Q.objectiveText(s)),'ready quest stays tracked and points at the giver');
 s.quest.bell='complete';ok(Q.trackedQuest(s)===null&&Q.focus(s).source==='story','a finished quest is no longer tracked; the log falls back to the story');
 s.trackedQuest='nope';ok(Q.trackedQuest(s)===null,'a stale or unknown id is ignored');
 s.trackedQuest=42;ok(Q.trackedQuest(s)===null,'a non-string value is ignored');
 s.quest.iron='active';Q.setTracked(s,'iron');ok(Q.setTracked(s,null)===true&&!('trackedQuest' in s),'untrack clears the field');
 // tracked ids in saves: engine.valid must accept it, with or without the field
 const t=make();t.quest.timber='active';Q.setTracked(t,'timber');
 ok(E.valid(clone(t)),'valid save with trackedQuest');delete t.trackedQuest;ok(E.valid(clone(t)),'valid save without trackedQuest');
 t.trackedQuest='garbage-id';ok(E.valid(clone(t))&&Q.trackedQuest(t)===null,'garbage trackedQuest does not invalidate a save and is ignored');
}

console.log('change detection');
{
 const s=make();s.flags.metMara=true;
 ok(eq(Q.diff(null,Q.snapshot(s)),[])&&eq(Q.diff(Q.snapshot(s),null),[]),'no events on first sight');
 let a=Q.snapshot(s);ok(eq(Q.diff(a,Q.snapshot(s)),[]),'identical snapshots: no events');
 near(s,'orin');E.talk(s,'orin','quest:medicine');
 let b=Q.snapshot(s),ev=Q.diff(a,b);ok(ev.length===1&&ev[0].kind==='accepted'&&ev[0].id==='medicine','accepting reports accepted: '+ev.map(e=>e.kind));
 a=b;s.inv.leaf=1;b=Q.snapshot(s);ev=Q.diff(a,b);ok(ev.length===1&&ev[0].kind==='updated'&&/1\/3/.test(ev[0].text),'one leaf: updated 1/3 ('+ev[0]?.text+')');
 a=b;s.inv.leaf=2;b=Q.snapshot(s);ev=Q.diff(a,b);ok(ev.length===1&&ev[0].kind==='updated'&&/2\/3/.test(ev[0].text),'two leaves: updated 2/3');
 a=b;s.inv.leaf=1;b=Q.snapshot(s);ev=Q.diff(a,b);ok(ev.length===0,'losing an item is silent');
 a=b;s.inv.leaf=3;b=Q.snapshot(s);ev=Q.diff(a,b);ok(ev.length===1&&ev[0].kind==='ready','third leaf: ready to report, no separate update: '+ev.map(e=>e.kind));
 a=b;s.inv.leaf=4;b=Q.snapshot(s);ok(Q.diff(a,b).length===0,'a fourth leaf adds nothing');
 a=b;E.talk(s,'orin','finish:medicine');b=Q.snapshot(s);ev=Q.diff(a,b);ok(ev.some(e=>e.kind==='completed'&&e.id==='medicine'),'completion reported: '+ev.map(e=>e.kind));
 ok(ev.some(e=>e.kind==='chapter'),'and the story moves to a new chapter');
 a=b;ok(Q.diff(a,Q.snapshot(s)).length===0,'a completed quest stays quiet');
 // talking to Mara: two quests accepted and chapter 2 begins in one tick
 const t=make();a=Q.snapshot(t);near(t,'mara');E.talk(t,'mara');t.flags.metMara=true;b=Q.snapshot(t);ev=Q.diff(a,b);
 ok(ev.filter(e=>e.kind==='accepted').length>=1&&ev.some(e=>e.kind==='chapter'&&e.chapter===2),'Mara: accepted + chapter 2: '+ev.map(e=>e.kind+':'+e.id));
 // main quest: a beacon changes the step but a chapter change is not announced twice
 const u=make();u.flags.metMara=true;u.quest.medicine='complete';u.quest.millwright='complete';u.inv.lantern=1;u.sites=['gate'];a=Q.snapshot(u);u.beacons=[0];b=Q.snapshot(u);ev=Q.diff(a,b);
 ok(ev.length===1&&ev[0].kind==='updated'&&ev[0].id==='keepers'&&/Tide/.test(ev[0].text),'first beacon: next step is the Tide beacon: '+JSON.stringify(ev.map(e=>[e.kind,e.text])));
 a=b;u.beacons=[0,1,2];b=Q.snapshot(u);ev=Q.diff(a,b);ok(ev.some(e=>e.kind==='chapter'&&e.chapter===6)&&!ev.some(e=>e.kind==='updated'&&e.id==='keepers'),'chapter 6 announced once, without an extra step update: '+ev.map(e=>e.kind));
 a=b;u.won=true;u.quest.keepers='complete';b=Q.snapshot(u);ev=Q.diff(a,b);ok(ev.some(e=>e.kind==='completed'&&e.id==='keepers')&&ev.some(e=>e.kind==='chapter'&&e.chapter===8),'ending: keepers completed and the story rests');
 // banner copy for every kind
 for(const e of ev){const t=Q.QUEST_TEXT.banner(e,u);ok(t.kicker&&t.title&&typeof t.line==='string','banner text for '+e.kind);}
 const v=make();near(v,'orin');a=Q.snapshot(v);E.talk(v,'orin','quest:medicine');v.inv.leaf=3;b=Q.snapshot(v);
 for(const e of Q.diff(a,b)){const t=Q.QUEST_TEXT.banner.call(Q.QUEST_TEXT,e,v);ok(t.kicker&&t.title&&t.line,'banner (method form) '+e.kind+': '+t.kicker+' / '+t.title+' / '+t.line);}
 ok(JSON.stringify(Q.snapshot(v)).length<6000,'snapshots stay small ('+JSON.stringify(Q.snapshot(v)).length+' bytes)');
}

console.log('lists, summary, direction');
{
 const s=make();s.flags.metMara=true;s.quest.medicine='active';s.quest.bell='active';s.inv.bell=1;s.quest.iron='complete';
 const side=Q.listQuests(s,'side'),com=Q.listQuests(s,'commission'),story=Q.listQuests(s,'story'),done=Q.listQuests(s,'done');
 ok(side[0].id==='bell'&&side[0].status==='ready','ready quests sort first: '+side.map(p=>p.id+':'+p.status));
 ok(side.some(p=>p.id==='castle'&&p.status==='available'),'the castle rumor is always in the side stories');
 ok(!side.some(p=>p.status==='complete')&&done.length===1&&done[0].id==='iron'&&!com.some(p=>p.id==='iron'),'completed quests only appear under done');
 ok(story.map(p=>p.id).includes('medicine')&&story.map(p=>p.id).includes('keepers'),'story list has the chapter quests');
 const sum=Q.summary(s);ok(sum.done===1&&sum.total===27&&sum.ready===1&&sum.active>=2,'summary counts: '+JSON.stringify([sum.done,sum.total,sum.ready,sum.active]));
 ok(sum.commissionsTotal===11,'11 commissions in the world');
 // direction and compass targets
 s.player.map='overworld';const pr=Q.target(s,'medicine');ok(pr&&pr.x===104&&pr.y===319,'medicine points at the moonleaf meadow');
 s.player.x=pr.x;s.player.y=pr.y-50;let d=Q.direction(s,'medicine');ok(d.bearing==='south'&&d.paces===50&&/50 paces south/.test(d.text),'direction: 50 paces south: '+d.text);
 s.player.x=pr.x-80;s.player.y=pr.y;d=Q.direction(s,'medicine');ok(d.bearing==='east','direction: east');
 s.player.x=pr.x+30;s.player.y=pr.y+30;d=Q.direction(s,'medicine');ok(d.bearing==='north-west','direction: north-west');
 s.player.x=pr.x+2;s.player.y=pr.y+1;ok(/right here/.test(Q.direction(s,'medicine').text),'direction: arrived');
 s.player.map='mill-2';ok(/surface/.test(Q.direction(s,'medicine').text),'direction underground asks to return to the surface');
 s.player.map='overworld';s.inv.leaf=3;const g=Q.target(s,'medicine');ok(g&&g.name==='Orin','ready quest points at its giver');
 for(const q of Q.ALL){const t=Q.target(make(),q);ok(t===null||Number.isFinite(t.x)&&Number.isFinite(t.y)&&t.name,`${q.id}: compass target is a point or null`);}
 const fit=Q.levelFit(s,4);ok(fit.tone==='hard'&&Q.levelFit({player:{level:5}},4).tone==='fair'&&Q.levelFit({player:{level:9}},3).tone==='easy','levelFit tones');
 ok(Q.boardAcceptable(make(),'timber')&&!Q.boardAcceptable(make(),'medicine')&&!Q.boardAcceptable(make(),'castle')&&!Q.boardAcceptable(s,'bell'),'board accepts jobs, never chapters, the castle, or taken quests');
}

console.log('old saves');
{
 // A save written before the quest log existed: no trackedQuest, maybe no journey extras.
 const s=make();const old=clone(s);delete old.trackedQuest;
 ok(E.valid(old),'old-style save is valid');
 for(const q of Q.ALL)ok(Q.progress(old,q)?.id===q.id,'old save: progress works for '+q.id);
 ok(Q.focus(old).source==='story'&&typeof Q.objectiveText(old)==='string','old save: focus and ribbon text');
 // v1 migrated saves and minimal states
 const mig=E.migrate({version:1,gold:50,inv:{leaf:2},quests:{healer:true},party:true},NOW);
 ok(Q.statusOf(mig,'medicine')==='complete'&&Q.chapters(mig).length===7,'migrated v1 save: medicine complete');
 const bare=E.fresh(NOW);bare.journey=undefined;delete bare.discovered;bare.discovered=['hearth'];
 let threw=false;try{for(const q of Q.ALL)Q.progress(bare,q);Q.snapshot(bare);Q.summary(bare);Q.focus(bare);}catch(e){threw=e.message;}ok(!threw,'a state with no journey block does not throw: '+threw);
 // JSON round trip of a busy state is stable
 const busy=make();busy.quest.medicine='active';busy.quest.timber='active';busy.trackedQuest='timber';busy.inv.wood=3;
 const again=clone(busy);ok(E.valid(again)&&Q.trackedQuest(again)==='timber'&&eq(Q.snapshot(busy),Q.snapshot(again)),'snapshot and tracking survive a JSON round trip');
 ok(Object.isFrozen(Q.CATEGORIES)&&Object.isFrozen(Q.metaOf('bell')),'metadata is frozen');
}
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
