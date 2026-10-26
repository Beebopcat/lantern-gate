// Quest presentation layer for the Lantern Gate: chapters, categories, recommended levels, live objective steps,
// tracking and change detection. Everything here is a pure function of the saved state (no DOM, no writes to quest
// logic or rewards). engine.js and world.js stay authoritative for what a quest needs and pays.
import {TOWNS,SITES,NPCS,ITEMS,quests,dist} from './world.js';
import {ready as engineReady,objective as engineObjective} from './engine.js';
import {CASTLE,FLOORS} from './castle-data.js';

export const CATEGORIES=Object.freeze({story:'Story',side:'Side story',commission:'Commission',event:'Event'});
export const STATUS_LABEL=Object.freeze({available:'Not yet taken',active:'In progress',ready:'Ready to report',complete:'Completed'});

// The castle arc lives in the journey state, not in `quests`. A virtual entry lets the log treat it like any other quest.
export const CASTLE_QUEST=Object.freeze({id:'castle',title:'The Names Beneath the Crown',giver:null,kind:'castle',reward:45,desc:'Visit Dracula’s Castle in the Mourning Crown. Speak with Frankenstein, free the Wolf Man’s hunting bell, and recover Dracula’s ledger.'});
export const ALL=Object.freeze([...quests,CASTLE_QUEST]);
const BYID=new Map(ALL.map(q=>[q.id,q]));
export const questById=id=>BYID.get(id)||null;
const resolve=q=>typeof q==='string'?questById(q):q||null;
const townById=id=>TOWNS.find(t=>t.id===id),npcById=id=>NPCS.find(n=>n.id===id),siteById=id=>SITES.find(x=>x.id===id);
const nearestTownTo=o=>TOWNS.reduce((b,t)=>dist(t,o)<dist(b,o)?t:b,TOWNS[0]);
const hearth=townById('hearth');

// ---------------------------------------------------------------- metadata
// Recommended levels follow the foes of the site a quest sends you to (see world.js SITES) and the distance from Hearthwick.
const provisionLevel=t=>Math.max(1,Math.min(4,1+Math.floor(dist(t,hearth)/75)));
const META={
 keepers:{category:'story',level:7,hook:'Follow the failing lanterns from the well at Hearthwick to the Lantern Gate.'},
 medicine:{category:'story',level:1,chapter:2,chapterTitle:'Silver-Veined Leaves',hook:'Three silver-veined leaves, and the first thread of a longer story.'},
 millwright:{category:'story',level:2,chapter:3,chapterTitle:'The Mill Below the Wheel',hook:'A millwright’s journal lies below the second landing of a silent mill.'},
 lantern:{category:'story',level:4,chapter:4,chapterTitle:'Copper, Glass, and Mercy',hook:'Copper to conduct, glass to remember, and a hand willing to release.'},
 bell:{category:'side',level:3,hook:'A drowned chapel still waits for its last ringing.'},
 pearl:{category:'side',level:3,hook:'One pearl in the Singing Caves can tell a harbor light from a lure.'},
 ledger:{category:'side',level:4,hook:'A captain’s accounts, and a choice about who pays.'},
 locket:{category:'side',level:4,hook:'A daughter’s place at the table has been kept for years.'},
 verse:{category:'side',level:5,hook:'The keepers’ oath is one line short of whole.'},
 seed:{category:'side',level:3,hook:'One silver seed, and a promise of fruit.'},
 chart:{category:'side',level:3,hook:'Nine watchfires once marked the roads. The chart remembers them.'},
 crown:{category:'side',level:5,hook:'The king’s last order was to feed the people waiting at the gate.'},
 traveler:{category:'side',level:3,hook:'Walk every road, then tell Mara what the country looks like now.'},
 ruins:{category:'side',level:6,hook:'Eight deep places keep their records. Someone should read them.'},
 castle:{category:'side',level:6,hook:'A castle of stolen names, a seed, a bell and a ledger.'},
 watch:{category:'event',level:2,hook:'When the bell tolls, someone must stand in the street.'},
 iron:{category:'commission',level:3,hook:'The watch cannot stand in rusted armor.'},
 salves:{category:'commission',level:1,hook:'Moonleaf, a bench, and a steady hand.'},
 timber:{category:'commission',level:2,hook:'A roadside shelter lacks five good branches.'}
};
for(const q of quests)if(q.id.startsWith('provisions-')){const t=townById(q.giver.split('-')[0]);META[q.id]={category:'commission',level:provisionLevel(t),hook:`${t.names[9]} keeps ${t.name}’s table full, and the larder is running short.`};}
// Items a quest hands over besides coins (read from engine.completeQuest).
const REWARD_ITEMS={medicine:['River medallion','Orin travels with you'],lantern:['Keeper’s lantern'],watch:['Warden’s ring'],keepers:['The lantern heart'],ledger:['A say in the captain’s fate']};
// Mirrors progression.js (`quest` source) so the log can show experience without touching the engine.
// The main quest (paid at the Gate) and the castle arc (paid in castleBargain) grant coins only.
export const questXp=q=>q.id==='keepers'||q.id==='castle'?0:Math.min(120,35+Math.floor((q.reward||20)*.65));
const CACHE=new Map();
export function metaOf(q){
 q=resolve(q);if(!q)return null;if(CACHE.has(q.id))return CACHE.get(q.id);
 const m=META[q.id]||{category:'side',level:1,hook:q.desc},npc=npcById(q.giver),town=npc?townById(npc.town):null;
 const out=Object.freeze({id:q.id,title:q.title,category:m.category,categoryLabel:CATEGORIES[m.category],level:m.level,hook:m.hook,chapter:m.chapter||null,chapterTitle:m.chapterTitle||null,
  region:town?.region||(q.id==='castle'?CASTLE.region:hearth.region),town:town?.name||(q.id==='castle'?CASTLE.name:hearth.name),giverName:npc?.name||null,
  reward:Object.freeze({coins:q.reward,xp:questXp(q),items:REWARD_ITEMS[q.id]||[]})});
 CACHE.set(q.id,out);return out;
}
export const tabOf=q=>({story:'story',side:'side',commission:'commission',event:'commission'}[metaOf(q).category]);

// ---------------------------------------------------------------- the main story, in chapters
// Chapters follow engine.objective() exactly: the first chapter whose condition is not met is the current one.
export const CHAPTERS=Object.freeze([
 {n:1,id:'lamps',title:'The Lamps Fail',quest:'keepers',level:1,place:'Hearthwick',blurb:'Hearthwick’s lanterns went dark three nights ago, and things are coming down from the hills. Mara waits at the well with a cold lantern.',recap:'You met Mara at the well and took the first road.',done:s=>!!s.flags?.metMara},
 {n:2,id:'leaves',title:'Silver-Veined Leaves',quest:'medicine',level:1,place:'Hearthwick',blurb:'The infirmary is full and Orin is out of moonleaf. A small errand, and the first thread of a longer story.',recap:'You carried moonleaf to Orin. He gave you his sister’s medallion and now walks beside you.',done:s=>s.quest?.medicine==='complete'},
 {n:3,id:'mill',title:'The Mill Below the Wheel',quest:'millwright',level:2,place:'The Broken Mill',blurb:'The old mill stopped turning the night the lanterns failed. Its keeper left a journal in the cellar.',recap:'You brought Eren’s journal to Ada. The failure runs back through the mill and into the Gate.',done:s=>s.quest?.millwright==='complete'},
 {n:4,id:'lantern',title:'Copper, Glass, and Mercy',quest:'lantern',level:4,place:'The Sunken Archive',blurb:'Tamsin can build a keeper’s lantern from the mill’s coil and the archive’s lens, if someone will fetch them.',recap:'Tamsin built the keeper’s lantern. It can wake the three beacons beneath the Gate.',done:s=>!!s.inv?.lantern||s.quest?.lantern==='complete'},
 {n:5,id:'beacons',title:'Dawn, Tide, Night',quest:'keepers',level:6,place:'The Lantern Gate',blurb:'Three beacons stand in the Gate’s deep chambers. Kindle them in order: Dawn, then Tide, then Night.',recap:'You kindled Dawn, Tide and Night, and the Warden’s shield fell.',done:s=>(s.beacons?.length||0)>=3},
 {n:6,id:'warden',title:'The Hollow Warden',quest:'keepers',level:7,place:'The Lantern Gate',blurb:'Elin has kept the Gate so long she has forgotten she may leave. Remember her promise, or fight.',recap:'Elin’s long watch is over.',done:s=>!!s.flags?.warden},
 {n:7,id:'gate',title:'A Light for Every Road',quest:'keepers',level:7,place:'The Lantern Gate',blurb:'The stolen light waits in the Gate. Release it, and every road may be lit again.',recap:'The Gate is open and the lanterns shine.',done:s=>!!s.won}
]);
export const chapterDone=(s,c)=>!!s.won||c.done(s);
export const currentChapter=s=>s.won?null:CHAPTERS.find(c=>!c.done(s))||null;
// 'done' | 'current' | 'open' (its quest is already in your log) | 'locked'
export function chapters(s){
 const cur=currentChapter(s);
 return CHAPTERS.map(c=>{let state='locked';if(chapterDone(s,c))state='done';else if(cur&&c.n===cur.n)state='current';else if(c.quest!=='keepers'&&s.quest?.[c.quest])state='open';return {...c,state};});
}

// ---------------------------------------------------------------- objective steps
const have=(s,id)=>s.inv?.[id]||0,clamp=(n,max)=>Math.max(0,Math.min(max,n));
// Where the game itself says to find each material (engine.interact, world.js gatherables and shops).
const ITEM_HINT={leaf:'Silver-veined plants grow in meadows; three stand south of Hearthwick’s cottages.',ore:'Three veins lie in the upper chambers of Cinderdeep Quarry; more lie on open ground.',wood:'Seasoned branches lie along the roads and meadows.',bread:'Bake it at an oven with a seasoned branch, or buy it from a baker.',fish:'Farmers stock river trout at the market.',salve:'Mix two moonleaf at an alchemy bench for each salve.'};
const relicSite=item=>item==='journal'?siteById('mill'):SITES.find(x=>x.relic===item)||null;
const sitePlace=x=>x?`${x.name}, ${nearestTownTo(x).region}`:'';
function giverInfo(s,q){
 if(q.id==='castle'){
  const next=nextClue(s)||'names',r=s.journey?.residents?.find(r=>r.id===CLUE_NPC[next]),floor=r?FLOORS[Number(r.map.at(-1))-1]:'';
  return {kind:'place',id:r?.id||'castle',name:r?.name||'Dracula',role:r?.role||'count',townId:'dracula',town:CASTLE.name,region:CASTLE.region,where:`${CASTLE.name}${floor?', '+floor:''}`,x:CASTLE.x,y:CASTLE.y,map:'overworld',alive:true,walk:'site:dracula:1'};
 }
 const npc=npcById(q.giver);if(!npc)return null;
 const town=townById(npc.town),live=s.actors?.find(a=>a.id===npc.id),map=live?.map??npc.map,outside=map==='overworld';
 // Indoors the NPC's own x/y belong to an interior map; the compass can only use overworld points, so point at the town.
 return {kind:'npc',id:npc.id,name:npc.name,role:npc.profession||npc.role,townId:town.id,town:town.name,region:town.region,where:`${town.name}, ${town.region}`,x:outside?(live?.x??npc.x):town.x+1,y:outside?(live?.y??npc.y):town.y+3,map:'overworld',inside:!outside,alive:!live?.deadUntil};
}
const gatePlace=()=>{const g=siteById('gate');return {kind:'place',id:'gate',name:'The Lantern Gate',role:'gate',townId:nearestTownTo(g).id,town:nearestTownTo(g).name,region:nearestTownTo(g).region,where:sitePlace(g),x:g.x,y:g.y,map:'overworld',alive:true,walk:'site:gate:1'};};

const CLUE_NPC={seed:'castle-frankenstein',bell:'castle-wolfman',names:'castle-dracula'};
const nextClue=s=>['seed','bell','names'].find(k=>!(s.journey?.clues||[]).includes(k))||null;
const castleAsked=s=>!!s.journey?.castleQuest&&s.journey.castleQuest!=='unheard';
const castleDone=s=>s.journey?.castleQuest==='complete';
const isComplete=(s,q)=>q.id==='castle'?castleDone(s):s.quest?.[q.id]==='complete';
const isAccepted=(s,q)=>q.id==='castle'?castleAsked(s):!!s.quest?.[q.id];
function castleSteps(s){
 const clues=s.journey?.clues||[],done=castleDone(s),seed=done||clues.includes('seed'),bell=done||clues.includes('bell'),names=done||clues.includes('names');
 const part=(noun,n,need,fin)=>({noun,count:fin?need:clamp(n,need),need}),sum=(parts)=>({count:parts.reduce((a,p)=>a+p.count,0),need:parts.reduce((a,p)=>a+p.need,0)});
 const sp=[part('Moonleaf',have(s,'leaf'),3,seed)],bp=[part('Cinder iron',have(s,'ore'),3,bell),part('Seasoned wood',have(s,'wood'),2,bell)],np=[part('Gold',s.player?.gold||0,60,names)];
 const out=[];
 if(!castleAsked(s)&&!done)out.push({id:'visit',label:'Travel to Dracula’s Castle in the Mourning Crown',done:false,where:CASTLE.region});
 out.push(
  {id:'seed',label:'Wake Frankenstein’s seed',parts:sp,...sum(sp),done:seed,hint:'Frankenstein, in the laboratory, needs three moonleaf.'},
  {id:'bell',label:'Silence the Wolf Man’s bell',parts:bp,...sum(bp),done:bell,hint:'The Wolf Man, in the Wolf Court, needs three cinder iron and two seasoned branches.'},
  {id:'names',label:'Return the drowned names to Dracula',parts:np,...sum(np),done:names,blocked:!names&&!(seed&&bell),hint:'Pay sixty gold for the ledger, or ask for mercy. Settle the seed and the bell first.'});
 return out;
}
// The castle arc is "ready" when the next clue can be offered right now.
const castleReady=s=>{if(!castleAsked(s)||castleDone(s))return false;const n=nextClue(s);return n==='seed'?have(s,'leaf')>=3:n==='bell'?have(s,'ore')>=3&&have(s,'wood')>=2:n==='names'?true:false;};

const mk=(id,label,done,extra={})=>({id,label,done:!!done,...extra});
const counted=(id,label,noun,n,need,done,extra={})=>({id,label,noun,count:done?need:clamp(n,need),need,done:!!done,...extra});
function chapterSteps(s,n){
 const gate=siteById('gate'),wherever=sitePlace(gate);
 if(n===1)return [mk('mara','Speak with Mara at Hearthwick’s well',s.flags?.metMara,{where:'Hearthwick, The River March'})];
 if(n===5)return [mk('descend','Descend to the Gate’s deep chambers',(s.sites||[]).includes('gate')||(s.beacons?.length||0)>0,{where:wherever}),
  ...['Dawn','Tide','Night'].map((name,i)=>mk('beacon-'+i,`Kindle the ${name} beacon`,(s.beacons||[]).includes(i),{hint:i?'':'The order is Dawn, then Tide, then Night. A wrong beacon puts the others out.'}))];
 if(n===6)return [mk('reach','Reach Elin in the Gate’s deep chambers',(s.sites||[]).includes('gate')||s.flags?.warden,{where:wherever}),
  mk('free','Free Elin with Orin’s medallion, or break her hold',s.flags?.warden,{hint:s.inv?.medallion?'You carry Orin’s river medallion.':'Orin’s river medallion comes from the Moonleaf Remedy.'})];
 if(n===7)return [mk('release','Release the stolen light at the Lantern Gate',s.won,{where:wherever})];
 return [];
}
// Generic steps by quest kind. `raw` is engine.ready(): items in the pack, raids won, towns found...
function stepsFor(s,q,giver,complete,accepted,raw){
 const gname=giver?.name||'the giver',report=(label)=>mk('report',label||`Report to ${gname}`,complete,{ready:raw&&!complete,where:giver?.where,final:true}),out=[];
 const item=q.item&&ITEMS[q.item]?.name;
 if(q.id==='castle')return castleSteps(s);
 if(q.kind==='main'){return chapters(s).map(c=>mk('chapter-'+c.n,`Chapter ${c.n} · ${c.title}`,c.state==='done',{chapter:c.n,current:c.state==='current'}));}
 if(!accepted&&!complete&&!raw)out.push(mk('speak',`Speak with ${gname} to take this on`,false,{where:giver?.where}));
 if(q.kind==='gather')out.push(counted('gather',`Gather ${item}`,item,have(s,q.item),q.count,complete||have(s,q.item)>=q.count,{hint:ITEM_HINT[q.item]}),report());
 else if(q.kind==='deliver'||q.kind==='choice'){const site=relicSite(q.item);out.push(counted('recover',`Recover ${item}`,item,have(s,q.item),q.count,complete||have(s,q.item)>=q.count,{where:site?`${sitePlace(site)} · deep chambers`:'',hint:site?`Found in the deep chambers of ${site.name}.`:''}),report(q.kind==='choice'?`Decide the ledger’s fate with ${gname}`:null));}
 else if(q.kind==='craft')out.push(counted('coil','Recover the copper coil','Keeper’s copper coil',have(s,'coil'),1,complete||have(s,'coil')>0,{where:`${sitePlace(siteById('mill'))} · deep chambers`,hint:'Found beside Eren’s journal in the deep chambers of The Broken Mill.'}),counted('lens','Recover the archive lens','Archive lens',have(s,'lens'),1,complete||have(s,'lens')>0,{where:`${sitePlace(siteById('archive'))} · deep chambers`,hint:'Found in the deep chambers of The Sunken Archive.'}),report('Bring both to '+gname));
 else if(q.kind==='defend')out.push(counted('raid','Help defeat a town raid','Raids defended',s.raidsWon||0,q.count,complete||(s.raidsWon||0)>=q.count,{hint:'Ring the warning bell at a town noticeboard, then fight beside the guard.'}),report());
 else if(q.kind==='explore')out.push(counted('towns','Visit all nine settlements','Settlements',s.discovered?.length||0,q.count,complete||(s.discovered?.length||0)>=q.count,{hint:'Walk into each town. Every shrine you find unlocks road travel.'}),report('Return to '+gname));
 else if(q.kind==='exploreSites')out.push(counted('sites','Explore deep sites','Deep sites',s.sites?.length||0,q.count,complete||(s.sites?.length||0)>=q.count,{hint:'Descend to the deep chambers of any ruin. Each counts once.'}),report());
 else out.push(report());
 return out;
}
const stepLine=st=>!st?'':st.parts?`${st.label} (${st.parts.map(p=>`${p.noun} ${p.count}/${p.need}`).join(', ')})`:st.need>1?`${st.label} (${st.count}/${st.need})`:st.noun&&st.need===1&&!st.done?`${st.label} (${st.count}/${st.need})`:st.label;
export {stepLine};
export const stepText=st=>st.parts?st.parts.map(p=>`${p.noun} ${p.count}/${p.need}`).join(' · '):st.need?`${st.noun||''} ${st.count}/${st.need}`.trim():'';
const stepFraction=st=>st.done?1:st.need?st.count/st.need:0;

export function isReady(s,q){q=resolve(q);return !isComplete(s,q)&&(q.id==='castle'?castleReady(s):engineReady(s,q));}
export function statusOf(s,q){q=resolve(q);if(isComplete(s,q))return 'complete';if(!isAccepted(s,q))return 'available';return isReady(s,q)?'ready':'active';}

// progress(state, quest) -> everything the UI needs about one quest right now.
export function progress(s,q){
 q=resolve(q);if(!q)return null;
 const m=metaOf(q),giver=giverInfo(s,q),complete=isComplete(s,q),accepted=isAccepted(s,q),raw=isReady(s,q);
 const steps=stepsFor(s,q,giver,complete,accepted,raw),current=steps.find(x=>!x.done)||null;
 const status=complete?'complete':!accepted?'available':raw?'ready':'active';
 const done=steps.filter(x=>x.done).length;
 const line=complete?'Completed':raw&&current?.final?current.label+(giver?` in ${giver.town}`:''):stepLine(current);
 return {id:q.id,quest:q,meta:m,status,accepted,complete,ready:raw,steps,current,done,total:steps.length,fraction:steps.length?steps.reduce((a,x)=>a+stepFraction(x),0)/steps.length:0,giver,line,summary:q.desc,
  chapter:q.id==='keepers'?currentChapter(s):CHAPTERS.find(c=>c.quest===q.id)||null};
}
// The main story's current chapter as a quest-shaped record (steps are the chapter's own).
export function chapterProgress(s,n){
 const c=CHAPTERS[n-1];if(!c)return null;
 if(c.quest!=='keepers')return {...progress(s,c.quest),chapter:c};
 const base=progress(s,'keepers'),steps=chapterSteps(s,n),giver=n===1?giverInfo(s,questById('keepers')):gatePlace(),cur=steps.find(x=>!x.done)||null;
 return {...base,steps,current:cur,done:steps.filter(x=>x.done).length,total:steps.length,fraction:steps.reduce((a,x)=>a+stepFraction(x),0)/steps.length,giver:n===1?giverInfo(s,{id:'keepers',giver:'mara'}):giver,line:stepLine(cur),chapter:c,status:chapterDone(s,c)?'complete':base.status};
}

// One row per chapter for the log's Main story group. `status` is what the chip shows: complete | ready | active | available | locked.
export function chapterRows(s){
 return chapters(s).map(c=>{
  const prog=c.state==='locked'?null:chapterProgress(s,c.n);
  const status=c.state==='done'?'complete':c.state==='locked'?'locked':prog.ready&&!prog.complete?'ready':prog.accepted?'active':'available';
  return {chapter:c,n:c.n,state:c.state,status,progress:prog,trackId:c.quest,title:c.title,hook:c.blurb,
   doneSteps:prog?prog.steps.filter(x=>x.done).length:0,totalSteps:prog?prog.steps.length:0};
 });
}
export const storyCount=s=>({done:CHAPTERS.filter(c=>chapterDone(s,c)).length,total:CHAPTERS.length});

// How the player's level compares with a recommendation: 'easy' (two or more levels above it), 'fair', 'hard' (two or more below).
export function levelFit(s,level){
 const mine=s?.player?.level||1,gap=level-mine;
 return {mine,level,gap,tone:gap>=2?'hard':gap<=-2?'easy':'fair',label:gap>=2?'Above your level':gap<=-2?'Well within reach':'Suited to you'};
}
// Board jobs may be taken straight from a noticeboard; chapters of the main story are always taken from their giver.
export const boardAcceptable=(s,q)=>{q=resolve(q);return !!q&&q.id!=='castle'&&metaOf(q).category!=='story'&&statusOf(s,q)==='available';};

// ---------------------------------------------------------------- tracking
// `state.trackedQuest` is an OPTIONAL top-level string. engine.valid() ignores unknown top-level fields, so old saves
// stay valid and a save without the field simply means "nothing chosen" (the log then follows the main story).
export function trackedQuest(s){
 const id=s?.trackedQuest;if(typeof id!=='string')return null;
 const q=questById(id);if(!q)return null;const st=statusOf(s,q);return st==='active'||st==='ready'?id:null;
}
export function setTracked(s,id){
 if(!id){delete s.trackedQuest;return true;}
 const q=questById(id);if(!q)return false;const st=statusOf(s,q);if(st!=='active'&&st!=='ready')return false;
 s.trackedQuest=q.id;return true;
}
// What the log shows at the top: the tracked quest, else the main story's current chapter, else any ready/active quest.
export function focus(s){
 const id=trackedQuest(s);
 if(id){const q=questById(id),ch=q.id==='keepers'?currentChapter(s):CHAPTERS.find(c=>c.quest===q.id)||null;return {source:'tracked',id,progress:q.id==='keepers'&&ch?chapterProgress(s,ch.n):progress(s,q),chapter:ch};}
 const ch=currentChapter(s);
 if(ch)return {source:'story',id:ch.quest,progress:chapterProgress(s,ch.n),chapter:ch};
 const list=ALL.map(q=>progress(s,q)).filter(p=>p.status==='ready'||p.status==='active'),p=list.find(x=>x.status==='ready')||list[0];
 return p?{source:'auto',id:p.id,progress:p,chapter:null}:null;
}
// HUD ribbon text: the tracked quest's current step, otherwise the existing main objective.
export function objectiveText(s){
 const id=trackedQuest(s);if(!id)return engineObjective(s);
 const f=focus(s),p=f?.progress;return p?`${p.meta.title} · ${p.line}`:engineObjective(s);
}
// Compass target for the quest's current step: {x,y,name} on the overworld, or null.
export function target(s,q){
 q=resolve(q);if(!q)return null;
 const p=progress(s,q),g=p.giver,giverPoint=g&&{x:g.x,y:g.y,name:g.name};
 if(p.ready)return q.id==='castle'?{x:CASTLE.x,y:CASTLE.y,name:CASTLE.name}:giverPoint;
 const site=id=>{const x=siteById(id);return x&&{x:x.x,y:x.y,name:x.name};},pl=s.player||{x:0,y:0};
 const nearest=list=>list.length?list.reduce((b,t)=>dist(t,pl)<dist(b,pl)?t:b,list[0]):null;
 if(q.id==='keepers'){const ch=currentChapter(s);if(!ch)return null;if(ch.quest!=='keepers')return target(s,ch.quest);return ch.n===1?giverPoint:site('gate');}
 if(q.id==='medicine')return {x:104,y:319,name:'Moonleaf meadow'};
 if(q.id==='millwright')return site('mill');
 if(q.id==='lantern')return have(s,'coil')?site('archive'):site('mill');
 if(q.id==='castle')return {x:CASTLE.x,y:CASTLE.y,name:CASTLE.name};
 if(q.kind==='explore'){const t=nearest(TOWNS.filter(t=>!s.discovered.includes(t.id)));return t?{x:t.x,y:t.y+3,name:t.name}:giverPoint;}
 if(q.kind==='exploreSites'){const t=nearest(SITES.filter(x=>x.id!=='dracula'&&!s.sites.includes(x.id)));return t?{x:t.x,y:t.y,name:t.name}:giverPoint;}
 const relic=q.item&&relicSite(q.item);if(relic&&q.kind!=='gather')return {x:relic.x,y:relic.y,name:relic.name};
 if(q.item==='ore'){const x=siteById('quarry');return {x:x.x,y:x.y,name:x.name};}
 return giverPoint;
}

// Plain-words bearing from the player to a quest's compass target ("about 140 paces north-east"). Map y grows southward.
const BEARING=['east','north-east','north','north-west','west','south-west','south','south-east'];
export function direction(s,q){
 const t=target(s,q);if(!t)return null;
 if(s.player?.map!=='overworld')return {name:t.name,paces:null,bearing:null,deg:null,text:`${t.name}. Return to the surface to follow the road.`,point:t};
 const dx=t.x-s.player.x,dy=t.y-s.player.y,paces=Math.round(Math.hypot(dx,dy));
 if(paces<6)return {name:t.name,paces,bearing:null,deg:null,text:`${t.name} is right here.`,point:t};
 const bearing=BEARING[(Math.round(Math.atan2(-dy,dx)/(Math.PI/4))+8)%8],deg=Math.round(Math.atan2(dx,-dy)*180/Math.PI);
 return {name:t.name,paces,bearing,deg,text:`${t.name}, about ${paces>=100?Math.round(paces/10)*10:paces} paces ${bearing}.`,point:t};
}

// ---------------------------------------------------------------- lists for the log, the board and conversations
export function listQuests(s,tab){
 const out=[];
 for(const q of ALL){
  const st=statusOf(s,q);
  if(tab==='done'){if(st==='complete')out.push(progress(s,q));continue;}
  if(st==='complete'||tabOf(q)!==tab)continue;
  // Rumors: the castle arc is always listed so the log can point at it before it is heard.
  if(st==='available'&&q.id!=='castle')continue;
  out.push(progress(s,q));
 }
 const rank={ready:0,active:1,available:2};return out.sort((a,b)=>rank[a.status]-rank[b.status]);
}
export function summary(s){
 const done=ALL.filter(q=>isComplete(s,q)).length,jobs=ALL.filter(q=>metaOf(q).category==='commission');
 const sts=ALL.map(q=>statusOf(s,q));
 return {done,total:ALL.length,commissionsDone:jobs.filter(q=>isComplete(s,q)).length,commissionsTotal:jobs.length,towns:s.discovered?.length||0,townsTotal:TOWNS.length,sites:s.sites?.length||0,sitesTotal:SITES.length,raids:s.raidsWon||0,ready:sts.filter(x=>x==='ready').length,active:sts.filter(x=>x==='active').length,
  counts:{story:listQuests(s,'story').length,side:listQuests(s,'side').filter(p=>p.status!=='available').length,commission:listQuests(s,'commission').length,done}};
}

// ---------------------------------------------------------------- change detection (drives the quest banner)
// snapshot() is cheap: only quests in the log are expanded. diff(prev,next) returns banner events, never anything on first sight.
export function snapshot(s){
 const out={chapter:currentChapter(s)?.n||8,quests:{}};
 for(const q of ALL){
  const st=statusOf(s,q);if(st==='available')continue;
  if(st==='complete'){out.quests[q.id]={status:st,score:1e6,text:''};continue;}
  // Chapters 2-4 are tracked through their own quests (medicine, millwright, lantern); only the Gate's chapters belong to 'keepers'.
  const ch=q.id==='keepers'?currentChapter(s):null,p=ch&&ch.quest==='keepers'?chapterProgress(s,ch.n):progress(s,q);
  let score=p.steps.reduce((a,x)=>a+(x.done?1000:x.count||0),0);
  out.quests[q.id]={status:st,score,text:p.line};
 }
 return out;
}
export function diff(prev,next){
 const ev=[];if(!prev||!next)return ev;
 for(const [id,n] of Object.entries(next.quests)){
  const p=prev.quests[id],q=questById(id);
  if(n.status==='complete'){if(!p||p.status!=='complete')ev.push({kind:'completed',id,quest:q});continue;}
  if(!p||p.status==='available'){ev.push({kind:'accepted',id,quest:q,text:n.text});continue;}
  if(n.status==='ready'&&p.status!=='ready'){ev.push({kind:'ready',id,quest:q,text:n.text});continue;}
  if(n.status===p.status&&n.score>p.score&&!(id==='keepers'&&next.chapter!==prev.chapter))ev.push({kind:'updated',id,quest:q,text:n.text});
 }
 if(next.chapter>prev.chapter)ev.push({kind:'chapter',id:'chapter-'+next.chapter,chapter:next.chapter});
 return ev;
}

// ---------------------------------------------------------------- words (banner, toasts, empty states)
const coinXp=q=>{const m=metaOf(q);return `+${m.reward.coins} coins${m.reward.xp?` · +${m.reward.xp} XP`:''}`;};
export const QUEST_TEXT=Object.freeze({
 kicker:{accepted:'Quest accepted',updated:'Quest updated',ready:'Ready to report',completed:'Quest complete',chapter:'New chapter',tracking:'Now tracking'},
 // Banner copy for one diff event -> {kicker,title,line}.
 banner(ev,s){
  if(ev.kind==='chapter'){const c=CHAPTERS[ev.chapter-1];return c?{kicker:`Chapter ${c.n} of ${CHAPTERS.length}`,title:c.title,line:c.place}:{kicker:'The story rests',title:'The lights return',line:'The open world and its people remain.'};}
  const q=ev.quest,m=metaOf(q);
  if(ev.kind==='completed')return {kicker:this.kicker.completed,title:q.title,line:coinXp(q)};
  if(ev.kind==='ready'){const g=giverInfo(s,q);return {kicker:this.kicker.ready,title:q.title,line:g?`Return to ${g.name} · ${g.town}`:'Report in'};}
  if(ev.kind==='accepted')return {kicker:this.kicker.accepted,title:q.title,line:m.hook};
  return {kicker:this.kicker.updated,title:q.title,line:ev.text};
 },
 toast:{
  tracking:q=>`Tracking “${q.title}”.`,untracked:()=>'No longer tracking. Your compass is clear.',
  declined:()=>'Of course. The offer stands whenever you are ready.',noGiver:()=>'You cannot find anyone to ask.',noTarget:q=>`“${q.title}” has no place to mark on the map yet.`,
  fallen:name=>`${name} is resting at the shrine and cannot be found right now.`
 },
 empty:{
  focus:'Your page is blank. Speak with Mara at the well, or take any road and see who needs a hand.',
  focusDone:'Every thread is tied off for now. Walk the roads; the Marches always have one more story.',
  story:'The next page is not written yet.',
  side:'No side stories on the page. Some residents carry tales older than the roads; ask about their past and about the lanterns.',
  commission:'No commissions pinned. Town noticeboards and innkeepers are always short of a hand or two.',
  done:'No tale has been finished yet. Every long road starts with a small errand.',
  board:'The board is bare tonight. Only the pins remain.',
  log:'Nothing has happened yet.'
 }
});
