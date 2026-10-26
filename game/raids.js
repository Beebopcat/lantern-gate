import {worldClock,worldMinute,worldWeather} from './world-conditions.js';
// Persistent, seeded raid director. Uses existing creatures, buildings and navigation.
import {BUILDINGS,TOWNS,dist,townAt,buildingAt,solid} from './world.js';
import * as P from './progression.js';

export const RAID_RULES={minParty:5,maxParty:11,warning:15,arrivalSpread:42,duration:240,minQuietNights:2,maxQuietNights:4,soloDoorSeconds:24,pairDoorSeconds:18,groupDoorSeconds:14};
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const record=o=>o&&typeof o==='object'&&!Array.isArray(o);
const finite=n=>Number.isFinite(n)&&n>=0&&n<1e12;

export function upgrade(s){
 if(!s.raidDirector){const seed=((Math.floor(s.lastReal||1)^0x5f3759df)>>>0)||1;s.raidDirector={version:1,seed,serial:0,eventSerial:0,nextClock:0,lastStartDay:-1,recoveryUntil:0,nextTaunt:0};scheduleNext(s,true);}
 s.raidEvents??=[];
 s.raidAtmosphere??={active:false,intensity:0,fog:0,music:'quiet',phase:'quiet',town:null};
 return s.raidDirector;
}
export function random(s){const d=s.raidDirector;let x=d.seed;x^=x<<13;x^=x>>>17;x^=x<<5;d.seed=(x>>>0)||1;return d.seed/4294967296;}
export function scheduleNext(s,initial=false){
 const d=s.raidDirector,days=initial?1+Math.floor(random(s)*3):RAID_RULES.minQuietNights+Math.floor(random(s)*(RAID_RULES.maxQuietNights-RAID_RULES.minQuietNights+1));
 // A night starts at 22:00 and can continue past midnight. At least one whole quiet night remains between raids.
 const base=Math.max(Math.floor(s.clock/1440),d.lastStartDay),offset=22*60+10+Math.floor(random(s)*260);
 d.nextClock=(base+days)*1440+offset;s.nextRaid=s.elapsed+Math.max(0,(d.nextClock-s.clock)/1.2);return d.nextClock;
}
export function emitRaidEvent(s,type,detail={}){
 const d=upgrade(s),event={id:++d.eventSerial,type,at:s.elapsed,...detail};s.raidEvents.push(event);if(s.raidEvents.length>64)s.raidEvents.splice(0,s.raidEvents.length-64);return event;
}
function say(s,text){s.notice=text;s.noticeUntil=s.elapsed+7;s.log.push({at:Math.floor(s.clock),text});s.log=s.log.slice(-60);}
const night=s=>worldMinute(s)>=22*60||worldMinute(s)<5*60;
const living=a=>!a.deadUntil&&!a.expired&&a.hp>0;

function spawnSpot(t,angle,used,api,target){
 for(let radius=33;radius<=45;radius+=3)for(let k=0;k<36;k++){
  const a=angle+k*.37,x=Math.floor(t.x+Math.cos(a)*radius)+.5,y=Math.floor(t.y+Math.sin(a)*radius)+.5;
  if(solid('overworld',x,y)||buildingAt(x,y)||used.some(p=>dist(p,{x,y})<2.1))continue;
  if(api.path&& !api.path({map:'overworld',x,y},target,12000,true).length)continue;
  used.push({x,y});return {x,y};
 }
 return null;
}
export function start(s,townId,api){
 const d=upgrade(s),t=TOWNS.find(t=>t.id===townId);if(!t||s.raid)return false;
 const id=`raid-${++d.serial}-${Math.floor(s.elapsed)}`,count=RAID_RULES.minParty+Math.floor(random(s)*(RAID_RULES.maxParty-RAID_RULES.minParty+1));
 const homes=BUILDINGS.filter(b=>b.town===townId&&['home','farm','inn'].includes(b.kind));
 if(!homes.length)return false;
 const residents=s.actors.filter(n=>n.town===townId),playerHome=s.player.map==='overworld'?buildingAt(s.player.x,s.player.y):null;
 // Rotate the target list each time. One party can split into a three-member door team and separate house stalkers.
 const rotation=Math.floor(random(s)*homes.length),targets=homes.map((_,i)=>homes[(i+rotation)%homes.length]);
 if(playerHome?.town===townId&&!targets.some(b=>b.id===playerHome.id))targets.push(playerHome);
 const grouped=count>=8&&random(s)<.7,used=[],party=[];
 for(let i=0;i<count;i++){
  const b=grouped&&i<3?targets[0]:targets[(i-(grouped?2:0)+targets.length)%targets.length],spot=spawnSpot(t,random(s)*Math.PI*2,used,api,b.door);
  if(!spot)continue;
  const roll=random(s),kind=i===0?'werewolf':roll<.24?'werewolf':roll<.47?'paleguest':roll<.8?'zombie':'skeleton';
  const inhabitants=residents.filter(n=>n.homeBuilding===b.id),target=inhabitants[i%Math.max(1,inhabitants.length)];
  const delay=RAID_RULES.warning+(i===0?0:Math.floor(random(s)*RAID_RULES.arrivalSpread)+i*.6);
  party.push(api.enemy(`${id}-${i}`,kind,'overworld',spot.x,spot.y,{raid:id,horror:true,raidRole:i===count-1?'stalker':'house-breaker',targetBuilding:b.id,targetResident:target?.id||null,spawnAt:s.elapsed+delay,attack:(kind==='werewolf'?21:kind==='zombie'?12:16),speed:kind==='werewolf'?4.05:kind==='paleguest'?2.45:kind==='zombie'?1.6:1.9,raidTauntAt:s.elapsed+delay+4+random(s)*12}));
 }
 if(!party.length)return false;
 d.lastStartDay=Math.floor(s.clock/1440);d.nextTaunt=s.elapsed+RAID_RULES.warning+4;
 s.raid={id,town:townId,started:s.elapsed,killsBefore:s.kills,total:party.length,waves:3,contribution:0,grouped};s.enemies.push(...party);scheduleNext(s);
 say(s,`The bells of ${t.name} falter. Fog is rolling between the houses. Bar your door: something is coming from more than one road.`);
 emitRaidEvent(s,'raid-start',{town:townId,total:party.length});atmosphere(s);return true;
}
export function target(s,e,api){
 if(!s.raid||e.raid!==s.raid.id)return null;
 const p=s.player,building=BUILDINGS.find(b=>b.id===e.targetBuilding),nearGuard=s.actors.filter(n=>living(n)&&n.map===e.map&&['guard','ranger'].includes(n.role)&&dist(e,n)<2.7).sort((a,b)=>dist(e,a)-dist(e,b))[0];
 if(nearGuard)return nearGuard;
 if(p.map===e.map&&!p.deadUntil&&(e.raidRole==='stalker'&&dist(p,e)<48||dist(p,e)<4.5&&api.lineOfSight(e.map,e,p)||building&&buildingAt(p.x,p.y)?.id===building.id))return p;
 const assigned=s.actors.find(n=>n.id===e.targetResident&&living(n)&&n.map===e.map);
 if(assigned&& (dist(e,assigned)<12||buildingAt(assigned.x,assigned.y)?.id===building?.id))return assigned;
 if(building){
  const inside=s.actors.filter(n=>living(n)&&n.map===e.map&&buildingAt(n.x,n.y)?.id===building.id).sort((a,b)=>dist(e,a)-dist(e,b));
  if(inside.length)return inside[Math.abs(Number(e.id.split('-').at(-1))||0)%inside.length];
  // Search the assigned house rather than collapsing every party member onto the player.
  if(buildingAt(e.x,e.y)?.id!==building.id)return {map:'overworld',x:building.x+building.w/2,y:building.y+building.h/2};
 }
 if(assigned)return assigned;
 const residents=s.actors.filter(n=>living(n)&&n.town===s.raid.town&&n.map===e.map);
 if(residents.length){const n=residents[(Number(e.id.split('-').at(-1))||0)%residents.length];e.targetResident=n.id;e.targetBuilding=n.homeBuilding;return n;}
 return null;
}
// Barred doors have three physical front stations, then spaced exterior queue
// rows. A raider cannot add pressure merely by crowding the doorway tile.
export function doorApproach(s,e,b,api={}){
 const peers=s.enemies.filter(a=>living(a)&&a.map===e.map&&(a.spawnAt??0)<=s.elapsed&&!(a.boundUntil>s.elapsed)&&(a===e||a.targetBuilding===b.id||a.doorAssignedBuilding===b.id&&s.elapsed-(a.doorAssignedAt??0)<2.6)).sort((a,c)=>String(a.id).localeCompare(String(c.id))).slice(0,32);
 if(!peers.includes(e))peers.push(e);
 const legal=q=>![[0,0],[.31,0],[-.31,0],[0,.31],[0,-.31]].some(([x,y])=>solid(e.map,q.x+x,q.y+y)||api.blocked?.(e,q.x+x,q.y+y));
 const station=([x,y])=>({map:e.map,x:b.door.x+.5+x,y:b.door.y+.5+y,front:true});
 // Narrow tree-lined entrances can use a staggered triangle. Each body still
 // fits the existing ground, keeps >=1.09 spacing and reaches the actual door.
 const layouts=[[[-1.10,.84],[0,.84],[1.10,.84]],[[-.18,.82],[1.16,.82],[.49,1.68]],[[-1.16,.82],[.18,.82],[-.49,1.68]]].map(rows=>rows.map(station));
 const frontPoints=layouts.find(rows=>rows.every(legal))||layouts[0].filter(legal),points=[...frontPoints],queueStart=Math.max(b.door.y+1.34,...frontPoints.map(q=>q.y));
 for(let row=1;row<12;row++)for(const dx of [-1.10,0,1.10]){
  const q={map:e.map,x:b.door.x+.5+dx,y:queueStart+row*1.2,front:false};if(legal(q))points.push(q);
 }
 const occupied=new Map();
 for(const a of peers)if(a.doorAssignedBuilding===b.id&&Number.isInteger(a.doorSlot)&&points[a.doorSlot]&&!occupied.has(a.doorSlot))occupied.set(a.doorSlot,a);
 for(const a of peers)if(![...occupied.values()].includes(a)){let slot=0;while(occupied.has(slot)&&slot<points.length)slot++;if(slot>=points.length)continue;occupied.set(slot,a);a.doorSlot=slot;a.doorAssignedBuilding=b.id;}
 // Waiting attackers advance only into vacated stations. Existing front actors
 // retain their places, so no living attacker must swap through another body.
 const front=points.map((q,i)=>q.front?i:-1).filter(i=>i>=0);
 for(const slot of front)if(!occupied.has(slot)){
  const waiting=[...occupied.entries()].filter(([i])=>!points[i].front).sort(([i],[j])=>i-j)[0];
  if(waiting){occupied.delete(waiting[0]);occupied.set(slot,waiting[1]);waiting[1].doorSlot=slot;}
 }
 e.doorAssignedBuilding=b.id;e.doorAssignedAt=s.elapsed;
 const slot=[...occupied.entries()].find(([,a])=>a===e)?.[0],q=points[slot];
 if(!q){e.crowdGoal=null;return null;}
 e.crowdGoal={map:q.map,x:q.x,y:q.y,kind:'door',building:b.id,slot,front:q.front};
 return {...e.crowdGoal,pounding:q.front&&dist(e,q)<.22};
}
export function taunt(s,e,kind='hunt-taunt',detail={}){
 const d=upgrade(s);if(s.elapsed<d.nextTaunt||s.elapsed<(e.raidTauntAt||0))return false;
 if(e.map!==s.player.map||dist(e,s.player)>24)return false;
 const text=kind==='door-taunt'?"Open the door, it's safe out here. We won't eat you alive, we promise.":"We're going to get you, and we're going to eat you.";
 emitRaidEvent(s,kind,{enemyId:e.id,kind:e.kind,text,...detail});d.nextTaunt=s.elapsed+12+random(s)*7;e.raidTauntAt=s.elapsed+24+random(s)*14;return true;
}
export function atmosphere(s){
 const d=upgrade(s),r=s.raid,a=s.raidAtmosphere;
 const intensity=r?clamp((s.elapsed-r.started)/2.5,0,1):clamp((d.recoveryUntil-s.elapsed)/12,0,1);
 Object.assign(a,{active:!!r,intensity,fog:intensity,music:r?'raid':'quiet',phase:r?(s.elapsed-r.started<RAID_RULES.warning?'warning':'hunting'):intensity?'recovery':'quiet',town:r?.town||a.town});if(!r&&!intensity)a.town=null;return a;
}
export function tick(s,dt,api){
 const d=upgrade(s);
 if(!s.raid&&s.clock>=d.nextClock){
  const town=s.player.map==='overworld'&&!s.player.deadUntil?townAt(s.player.x,s.player.y,48):null;
  if(town&&night(s))start(s,town.id,api);
  else if(!night(s))scheduleNext(s); // An absent player does not bank several simultaneous raids.
 }
 if(s.raid){
  const raid=s.raid,remaining=s.enemies.filter(e=>e.raid===raid.id&&living(e));
  if(!remaining.length||s.elapsed-raid.started>=RAID_RULES.duration){
   const cleared=!remaining.length,t=TOWNS.find(t=>t.id===raid.town);for(const e of remaining)e.expired=true;
   if(cleared){s.raidsWon++;if(raid.contribution>0){P.awardExperience(s,'raid',{id:raid.id,label:'Town defense'}).forEach(message=>say(s,message));s.player.gold+=30;say(s,`${t.name} is safe. The town rewards your defense with thirty coins.`);}else say(s,`${t.name}'s defenders have driven off the raiders.`);}
   else say(s,'The raiders withdraw into the fog. The broken houses and wounded still need care.');
   emitRaidEvent(s,'raid-end',{town:raid.town,cleared});s.raid=null;d.recoveryUntil=s.elapsed+12;
  }
 }
 atmosphere(s);
}
export function valid(s){
 if(s.raidDirector===undefined)return true;const d=s.raidDirector;
 if(!record(d)||d.version!==1||!Number.isInteger(d.seed)||d.seed<1||d.seed>4294967295||!Number.isInteger(d.serial)||d.serial<0||!Number.isInteger(d.eventSerial)||d.eventSerial<0||!finite(d.nextClock)||!Number.isInteger(d.lastStartDay)||d.lastStartDay< -1||!finite(d.recoveryUntil)||!finite(d.nextTaunt))return false;
 if(!Array.isArray(s.raidEvents)||s.raidEvents.length>64||!s.raidEvents.every(e=>record(e)&&Number.isInteger(e.id)&&finite(e.at)&&['raid-start','raid-end','hunt-taunt','door-taunt','door-impact','door-breached'].includes(e.type)))return false;
 if(s.raid&&(!record(s.raid)||typeof s.raid.id!=='string'||!TOWNS.some(t=>t.id===s.raid.town)||!finite(s.raid.started)||!Number.isInteger(s.raid.total)||s.raid.total<1||s.raid.total>32))return false;
 return true;
}
