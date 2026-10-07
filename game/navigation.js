import * as E from './engine.js';
import {MAPS,PORTALS,dist,buildingAt} from './world.js';
import {doorStatus} from './life.js';

// Portals are the existing world connections; routes never invent a shortcut or teleport.
export function mapRoute(from,to){
 if(!MAPS[from]||!MAPS[to])return null;
 const queue=[{map:from,legs:[]}],seen=new Set([from]);
 for(let i=0;i<queue.length;i++){
  const step=queue[i];if(step.map===to)return step.legs;
  for(const portal of PORTALS.filter(p=>p.map===step.map)){
   if(seen.has(portal.to))continue;seen.add(portal.to);
   queue.push({map:portal.to,legs:[...step.legs,portal]});
  }
 }
 return null;
}

export function createNavigator({getState,interact,notify}){
 let journey=null,leg=null,plannedMap=null,stall=0,cooldown=0,previous=null,health=0;
 function cancel(){getState().player.path=[];journey=null;leg=null;stall=0;}
 function fail(text){cancel();notify(text);return false;}
 function target(){return journey?.id?E.find(getState(),journey.id):journey;}
 function plan(){
  const s=getState(),o=target();
  if(!o||o.deadUntil)return fail('That destination is no longer available.');
  const connections=mapRoute(s.player.map,o.map||'overworld');
  if(!connections)return fail('No connected walking route reaches this area.');
  leg=connections[0]||{...o,map:o.map||'overworld'};
  plannedMap=s.player.map;cooldown=1.5;stall=0;
  if(!E.setDestination(s,leg.x,leg.y,true)){
   const b=o.map==='overworld'?buildingAt(o.x,o.y):null;
   return fail(b&&doorStatus(s,b)==='locked'?`${b.name} is locked. Return when it opens.`:'The walking route is blocked. Unlock the door or choose another destination.');
  }
  previous={x:s.player.x,y:s.player.y};health=s.player.hp;return true;
 }
 function go(destination,id=null){
  cancel();const s=getState();
  if(s.player.deadUntil)return fail('Wait for the shrine before setting out.');
  if(!destination||!Number.isFinite(destination.x)||!Number.isFinite(destination.y))return false;
  journey={...destination,map:destination.map||'overworld',id};
  if(!plan())return false;
  notify(`Walking to ${destination.name||'your destination'}. Move manually or choose Stop to cancel.`);return true;
 }
 function update(dt){
  if(!journey)return;
  const s=getState(),p=s.player,o=target();
  if(p.deadUntil||p.hp<health-.01)return fail('Walking stopped because you were hurt.');
  health=p.hp;cooldown-=dt;
  if(!o||o.deadUntil)return fail('That destination is no longer available.');
  if(p.map!==plannedMap)return plan();
  const crossing=leg.to&&p.map!==(o.map||'overworld');
  if(dist(p,leg)<1.85&&E.lineOfSight(p.map,p,leg)){
   if(crossing){E.enter(s,leg);return plan();}
   // Residents can keep moving while the player follows them.
   if(journey.id&&dist(p,o)>2.1){if(cooldown<=0)return plan();return;}
   const id=journey.id,name=journey.name;cancel();
   if(id)interact(id);else notify(`Arrived at ${name||'your destination'}.`);
   return;
  }
  const moved=dist(p,previous);previous={x:p.x,y:p.y};stall=moved<.001?stall+dt:0;
  if(stall>1.5||!p.path?.length||(journey.id&&!crossing&&dist(o,leg)>2.5&&cooldown<=0))return plan();
 }
 return {go,cancel,update,get active(){return !!journey;},get name(){return journey?.name||'';}};
}
