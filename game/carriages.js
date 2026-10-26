import {worldClock,worldMinute,worldWeather} from './world-conditions.js';
import {COACH_STOPS} from './sleepy-hollow.js';
import {MAPS,T,tileAt,solid,dist,buildingAt} from './world.js';
export const AMBUSH_CHANCE=.15,HORSEMAN_CHANCE=.07,COACH_SPEED=5.4;
 const roads=new Set([T.path,T.bridge,T.stone]);
const actor=(s,id)=>id==='player'?s.player:s.actors.find(a=>a.id===id);
export function upgrade(s){if(s.horror?.version===1)return s.horror;const origin=COACH_STOPS[0];s.horror={version:1,rng:((Math.floor(s.lastReal||1)^0x5e17ab1e)>>>0)||1,serial:0,nightRolls:[],trips:[],vehicles:[{id:'hollow-coach',name:'The Hollow coach',type:'coach',map:'overworld',x:origin.x,y:origin.y,angle:0,stop:origin.id,path:[],passengers:[],moving:false,trip:null}],horseman:null};return s.horror;}
function draw(h,rng){h.rng=(Math.imul(h.rng,1664525)+1013904223)>>>0;const value=rng?rng():h.rng/4294967296;if(!Number.isFinite(value)||value<0||value>=1)throw Error('Random source must return [0,1).');return value;}
export function valid(s){if(!s.horror)return true;const h=s.horror,num=n=>Number.isFinite(n)&&n>=0;return h.version===1&&Number.isInteger(h.rng)&&h.rng>=0&&h.rng<=0xffffffff&&Number.isInteger(h.serial)&&h.serial>=0&&h.serial<1e7&&Array.isArray(h.nightRolls)&&h.nightRolls.length<=32&&h.nightRolls.every(n=>Number.isInteger(n.night)&&num(n.roll)&&n.roll<1&&typeof n.spawned==='boolean')&&Array.isArray(h.trips)&&h.trips.length<=40&&h.trips.every(t=>typeof t.id==='string'&&COACH_STOPS.some(p=>p.id===t.from)&&COACH_STOPS.some(p=>p.id===t.to)&&num(t.roll)&&t.roll<1&&t.ambush===(t.roll<AMBUSH_CHANCE)&&['pending','ambushed','arrived','abandoned'].includes(t.outcome))&&Array.isArray(h.vehicles)&&h.vehicles.length===1&&h.vehicles.every(v=>v.id==='hollow-coach'&&v.map==='overworld'&&num(v.x)&&num(v.y)&&v.x<MAPS.overworld.w&&v.y<MAPS.overworld.h&&Number.isFinite(v.angle)&&Array.isArray(v.path)&&v.path.length<2000&&v.path.every(q=>num(q.x)&&num(q.y)&&!solid('overworld',q.x,q.y)&&roads.has(tileAt('overworld',q.x,q.y)))&&Array.isArray(v.passengers)&&v.passengers.length<=3&&new Set(v.passengers).size===v.passengers.length&&v.passengers.every(id=>id==='player'||s.actors.some(a=>a.id===id))&&(!v.trip||h.trips.some(t=>t.id===v.trip)));
}
export function route(from,to,pathfind){return pathfind('overworld',from,to,70000,false,(x,y)=>roads.has(tileAt('overworld',x,y)));}
export function beginTrip(s,toId,{pathfind,rng,player=true,npcIds=[]}={}){
 const h=upgrade(s),v=h.vehicles[0],to=COACH_STOPS.find(p=>p.id===toId),from=COACH_STOPS.find(p=>p.id===v.stop);
 if(v.trip||v.path.length)return {ok:false,text:'The coach is already on the road.'};
 if(!from||!to||from.id===to.id)return {ok:false,text:'Choose the other coach station.'};
 if(player&&(s.player.map!=='overworld'||s.player.deadUntil||dist(s.player,v)>3.3))return {ok:false,text:'Come beside the waiting coach to board.'};
 if(player&&s.player.gold<4)return {ok:false,text:'The coach fare is four coins.'};
 const passengers=[...(player?['player']:[]),...npcIds.filter(id=>id!=='player'&&actor(s,id)&&!actor(s,id).deadUntil&&actor(s,id).map===v.map&&dist(actor(s,id),v)<3.3)].slice(0,3);
 if(!passengers.length)return {ok:false,text:'The coach needs a passenger.'};
 const path=route(v,to,pathfind);if(!path.length)return {ok:false,text:'The coach road is blocked. No fare was charged.'};
 // A single persistent PRNG draw determines the entire trip before movement or payment.
 // Restoring a pre-departure save with the same serial/seed produces the same roll.
 const roll=draw(h,rng),id='coach-trip-'+(++h.serial),trip={id,from:from.id,to:to.id,roll,ambush:roll<AMBUSH_CHANCE,outcome:'pending',departed:s.elapsed,progress:0,length:path.length,passengers:[...passengers]};
 h.trips.push(trip);h.trips=h.trips.slice(-40);Object.assign(v,{trip:id,path,passengers,stop:null,moving:true});if(player)s.player.gold-=4;
 for(const id of passengers){const a=actor(s,id);a.transportId=v.id;a.path=[];a.task='riding the Hollow coach';a.activity={id:'coach-ride',animation:'rest',working:false};}
 anchorPassengers(s,v);s.revision++;return {ok:true,text:'The coach departs for '+to.name+'. Your fare and trip outcome have been saved.',trip};
}
export function anchorPassengers(s,v){v.passengers.forEach((id,i)=>{const a=actor(s,id);if(!a)return;const lateral=i===0?-.6:i===1?.6:0,along=i<2?.7:-.65;Object.assign(a,{map:v.map,x:v.x+Math.cos(v.angle)*lateral+Math.sin(v.angle)*along,y:v.y-Math.sin(v.angle)*lateral+Math.cos(v.angle)*along,moving:false,transportId:v.id,transportHeight:.50,transportAngle:v.angle});});}
function clearPoint(s,v,index){const radius=2.5+Math.floor(index/6)*1.7;for(let j=0;j<24;j++){const angle=(j+index*5)*Math.PI/12,q={map:v.map,x:v.x+Math.cos(angle)*radius,y:v.y+Math.sin(angle)*radius};if(!solid(q.map,q.x,q.y)&&!buildingAt(q.x,q.y)&&![s.player,...s.actors,...s.enemies].some(a=>a.map===q.map&&!a.deadUntil&&!a.transportId&&!a.expired&&dist(a,q)<1.25))return q;}return null;}
function unload(s,v){for(let i=0;i<v.passengers.length;i++){const a=actor(s,v.passengers[i]);if(!a)continue;const q=clearPoint(s,v,i);if(q)Object.assign(a,q);delete a.transportId;delete a.transportHeight;delete a.transportAngle;a.path=[];a.think=0;a.activity={id:'coach-arrival',animation:'gesture',working:false};a.task='arriving by coach';}v.passengers=[];}
export function finish(s,v,outcome,note){const h=upgrade(s),trip=h.trips.find(t=>t.id===v.trip);if(trip){trip.outcome=outcome;trip.finished=s.elapsed;}unload(s,v);v.path=[];v.moving=false;v.trip=null;v.stop=outcome==='arrived'?trip?.to:trip?.from;v.nextNpcAt=s.elapsed+(outcome==='arrived'?35:150);if(note)note(s,outcome==='arrived'?'The coach arrives. Mind the last bell before returning after dark.':'The horses rear. An ambush has stopped the coach; your trip will never roll again.');}
export function tickTransport(s,dt,{enemy,note,pathfind,rng}={}){
 const h=upgrade(s),v=h.vehicles[0];if(!v.trip){v.moving=false;const hour=worldMinute(s)/60,commuters=s.actors.filter(a=>['coachman','courier'].includes(a.profession)&&a.town==='sleepy');for(const a of commuters){delete a.coachWait;if(hour>=7&&hour<18&&!a.deadUntil&&s.elapsed>=(v.nextNpcAt??20)&&!s.enemies.some(e=>!e.deadUntil&&!e.expired&&e.map===a.map&&dist(e,a)<18)){a.coachWait=true;a.task='walking to the coach for a postal run';a.activity={id:'coach-post',animation:'walk',working:true};if(a.map==='overworld'&&(a.think<=0||!a.path?.length)){a.path=pathfind('overworld',a,v,70000);a.think=4;}}}const waiting=commuters.filter(a=>a.coachWait&&dist(a,v)<3.3);if(waiting.length&&s.elapsed>=(v.nextNpcAt??20)){const to=COACH_STOPS.find(p=>p.id!==v.stop);beginTrip(s,to.id,{pathfind,rng,player:false,npcIds:waiting.map(a=>a.id)});}return;}
 const trip=h.trips.find(t=>t.id===v.trip);if(!trip||trip.outcome!=='pending'){finish(s,v,'abandoned',note);return;}
 if(v.passengers.some(id=>!actor(s,id)||actor(s,id).deadUntil)){finish(s,v,'abandoned',note);return;}
 let distance=COACH_SPEED*dt;while(distance>0&&v.path.length){const next=v.path[0],d=dist(v,next);if(solid(v.map,next.x,next.y)||!roads.has(tileAt(v.map,next.x,next.y))){finish(s,v,'abandoned',note);return;}if(d<.001){v.path.shift();trip.progress++;continue;}const step=Math.min(distance,d);v.angle=Math.atan2(next.x-v.x,next.y-v.y);v.x+=(next.x-v.x)/d*step;v.y+=(next.y-v.y)/d*step;distance-=step;if(step===d){v.path.shift();trip.progress++;}}
 v.moving=true;anchorPassengers(s,v);
 if(trip.ambush&&trip.progress>=trip.length*.48){finish(s,v,'ambushed',note);for(let i=0;i<3;i++){const q=clearPoint(s,v,i+3);if(q)s.enemies.push(enemy(trip.id+'-ambusher-'+i,i===0?'werewolf':'paleguest',q.map,q.x,q.y,{hunter:true,coachAmbusher:true,coachTrip:trip.id,expiresAt:s.elapsed+120,spawnAt:s.elapsed+i*1.6,huntState:'tracking',attack:i===0?18:12}));}return;}
 if(!v.path.length){const to=COACH_STOPS.find(p=>p.id===trip.to);Object.assign(v,{x:to.x,y:to.y});finish(s,v,'arrived',note);}
}
export function nightIndex(clock){return Math.floor((clock+360)/1440);}
export const isNight=clock=>clock%1440>=1260||clock%1440<360;
export const inHollow=a=>a.map==='overworld'&&a.x>20&&a.x<110&&a.y>312&&a.y<376;
export function huntTarget(s,e){const p=s.player;if(p.deadUntil||p.map!==e.map||!inHollow(p))return null;if(p.x>=79&&p.x<=87&&p.y>=316&&p.y<=324)return null;return p;}
export function tickHorseman(s,dt,{enemy,note,rng}={}){
 const h=upgrade(s),night=nightIndex(s.clock),record=h.nightRolls.find(r=>r.night===night);
 if(isNight(worldClock(s))&&inHollow(s.player)&&!record&&!s.player.deadUntil){const roll=draw(h,rng),r={night,roll,spawned:false};h.nightRolls.push(r);h.nightRolls=h.nightRolls.slice(-32);if(roll<HORSEMAN_CHANCE&&!s.raid){const q=clearPoint(s,{...s.player},8);if(q){const id='hollow-horseman-'+night;s.enemies.push(enemy(id,'horseman','overworld',q.x,q.y,{headlessHorseman:true,hunter:true,huntState:'tracking',expiresAt:s.elapsed+110,spawnAt:s.elapsed+4}));r.spawned=true;h.horseman={id,night,started:s.elapsed,phase:'warning'};note?.(s,'The last bell stops. Hooves answer from the fog. Reach the Old Hollow Bridge or shelter behind a sturdy door.');}}}
 const e=s.enemies.find(e=>e.id===h.horseman?.id);if(e){const target=huntTarget(s,e);if(!isNight(worldClock(s))||e.deadUntil||e.expiresAt<=s.elapsed||!target){e.expired=true;h.horseman.phase=e.deadUntil?'defeated':'escaped';}else{h.horseman.phase=(e.spawnAt??0)>s.elapsed?'warning':'tracking';}}
 for(const e of s.enemies.filter(e=>e.coachAmbusher))if(e.expiresAt<=s.elapsed||e.deadUntil)e.expired=true;
}
export function atmosphere(s){const h=s.horror?.horseman;return !!h&&['warning','tracking'].includes(h.phase)&&inHollow(s.player)?{active:true,fog:.88,phase:h.phase}: {active:false,fog:0,phase:'quiet'};}
