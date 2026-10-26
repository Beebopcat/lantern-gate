// Summoner minions and Ranger beasts: persistent, owner-bound combat companions.
//
// Design choices (implementation decisions, not separately approved by Casey):
//   * Four minions for the Summoner and four beasts for the Ranger.
//   * One saved actor, always `state.guardian`, id "guardian". Its kind/class/role are
//     bound to the owner's class roster and can never be rerolled by a reload or import.
//   * All AI state is plain saved data. There are no timers or module-level mutable state,
//     so pausing, page suspension and save replacement cannot leak work or stale targets.
//   * Targets are held by enemy id and re-validated every tick (alive, same map, spawned,
//     reachable, inside the leash). Residents, owned pets, Orin and the Hollow Warden are never
//     considered: only `state.enemies` entries are candidates.
//   * Kill credit goes through the engine's existing hurt() path, which already refuses to
//     credit an already-dead target, so rewards cannot be granted twice.
import {MAPS,dist,solid} from './world.js';

export const ROSTERS={
  summoner:{role:'minion',noun:'Minion',prompt:'Choose the minion you bind',choices:['ember-imp','bone-squire','gloam-wisp','moss-golem']},
  ranger:{role:'beast',noun:'Beast',prompt:'Choose the beast that hunts beside you',choices:['ash-wolf','thorn-boar','dusk-lynx','gale-hawk']}
};
// hp/dmg are level-1 values. Range is in map tiles; speed in tiles per second; cd in seconds.
export const COMPANIONS={
  'ember-imp':{classId:'summoner',role:'minion',name:'Ember Imp',species:'Cinder imp',hp:46,dmg:9,range:5.5,cd:1.5,speed:3.9,size:.36,ranged:true,perk:'flare',
    detail:'A small, quick fire-spirit. Hurls embers from a distance; every third ember flares for 60% more damage.',color:'#d9573a'},
  'bone-squire':{classId:'summoner',role:'minion',name:'Bone Squire',species:'Animated skeleton',hp:70,dmg:11,range:1.5,cd:1.2,speed:3.6,size:.4,ranged:false,perk:'ward',
    detail:'A rattling sword-and-shield servant. Fights harder (+25%) when its master falls below 40% health.',color:'#d8d2bc'},
  'gloam-wisp':{classId:'summoner',role:'minion',name:'Gloam Wisp',species:'Drifting wisp',hp:38,dmg:7,range:6,cd:1,speed:4.2,size:.34,ranged:true,perk:'chill',
    detail:'A cold, hovering light. Fast ranged strikes that slow their target for 1.6 seconds.',color:'#7fe8d8'},
  'moss-golem':{classId:'summoner',role:'minion',name:'Moss Golem',species:'Mossbound golem',hp:130,dmg:14,range:1.7,cd:1.9,speed:2.6,size:.62,ranged:false,perk:'stagger',
    detail:'A slow, sturdy stone guardian. Every third blow staggers its target; heals itself quickly while idle.',color:'#7d8a76'},
  'ash-wolf':{classId:'ranger',role:'beast',name:'Ashfang Wolf',species:'Ashfang wolf',hp:62,dmg:10,range:1.5,cd:1,speed:4.4,size:.45,ranged:false,perk:'rend',
    detail:'The fastest hunter. Every third bite rends for 50% more damage.',color:'#575b62'},
  'thorn-boar':{classId:'ranger',role:'beast',name:'Thornback Boar',species:'Thornback boar',hp:98,dmg:12,range:1.6,cd:1.6,speed:3.6,size:.55,ranged:false,perk:'charge',
    detail:'A tusked bruiser. Its opening charge from a distance hits for 80% more and staggers.',color:'#6b4a33'},
  'dusk-lynx':{classId:'ranger',role:'beast',name:'Dusk Lynx',species:'Dusk lynx',hp:54,dmg:13,range:1.5,cd:1.1,speed:4.6,size:.42,ranged:false,perk:'pounce',
    detail:'A stalking cat. Its first strike against each new target is a pounce for 50% more damage.',color:'#9a7a5c'},
  'gale-hawk':{classId:'ranger',role:'beast',name:'Gale Hawk',species:'Gale hawk',hp:34,dmg:8,range:5,cd:1.2,speed:4.8,size:.34,ranged:true,perk:'dive',
    detail:'A diving raptor with ranged talon strikes, 20% stronger against a foe marked by Hunter’s Mark. Moves along open ground, not through walls.',color:'#b58a54'}
};
export const isCompanionClass=id=>Object.hasOwn(ROSTERS,id);
export const rosterFor=id=>ROSTERS[id]||null;
export const inRoster=(classId,kind)=>!!ROSTERS[classId]?.choices.includes(kind);
const T={near:1.7,far:3.4,teleport:20,threat:9,keep:13,leash:16,recover:30,attackWindow:5,unreachable:4,regen:.012,pathTick:.6,maxAttackers:8};
export const TUNING=Object.freeze({...T});
const num=(n,max=1e9)=>Number.isFinite(n)&&n>=0&&n<=max;
const record=o=>o&&typeof o==='object'&&!Array.isArray(o);
const STATES=['follow','chase','attack','return','guard','fallen'];
export function scaledHp(def,level){return Math.round(def.hp*(1+.08*(Math.max(1,level)-1)));}
export function scaledDamage(def,level){return def.dmg*(1+.06*(Math.max(1,level)-1));}
function clearSpot(s,map,x,y){
  const spots=[];for(let r=1;r<=5;r++)for(let a=0;a<12;a++){const th=a*Math.PI/6+r*.4,px=x+Math.cos(th)*(r*.9),py=y+Math.sin(th)*(r*.9);if(px>=0&&py>=0&&px<MAPS[map].w&&py<MAPS[map].h&&!solid(map,px,py))spots.push({x:px,y:py});}
  return spots[0]||{x,y};
}
export function snap(s){
  const g=s.guardian,p=s.player;if(!g)return;
  const q=clearSpot(s,p.map,p.x-1,p.y+.6);Object.assign(g,{map:p.map,x:q.x,y:q.y,path:[],think:0,targetId:null,state:g.fallen?'fallen':'follow',moving:false});
}
// Remove transient combat state after a load, import, new-game replacement or map change.
export function settle(s){
  const g=s.guardian;if(!g)return;
  g.targetId=null;g.path=[];g.think=0;g.attackers={};g.unreachable={};g.pounceId=null;g.chargeReady=false;g.moving=false;
  if(!g.fallen)g.state='follow';
  snap(s);
}
export function spawn(s,classId,kind){
  const def=COMPANIONS[kind];
  if(!inRoster(classId,kind)||!def)return null;
  const p=s.player,lvl=p.level||1,maxHp=scaledHp(def,lvl),q=clearSpot(s,p.map,p.x-1,p.y+.6);
  s.guardian={id:'guardian',type:'guardian',owner:'player',classId,role:def.role,kind,name:def.name,map:p.map,x:q.x,y:q.y,size:def.size,hp:maxHp,maxHp,cd:0,state:'follow',targetId:null,fallen:false,fallenUntil:0,path:[],think:0,moving:false,direction:1,hits:0,attackers:{},unreachable:{},pounceId:null,chargeReady:false,empoweredUntil:0};
  return s.guardian;
}
export function upgrade(s){
  const g=s.guardian;if(!g)return null;
  g.attackers??={};g.unreachable??={};g.hits??=0;g.empoweredUntil??=0;g.path??=[];g.size=COMPANIONS[g.kind]?.size??g.size;
  return g;
}
export function valid(s){
  const g=s.guardian,cls=s.player?.classId,needs=!!s.journey?.created&&isCompanionClass(cls);
  if(g===undefined)return !needs;
  if(!needs||!record(g))return false;
  const def=COMPANIONS[g.kind];
  if(g.id!=='guardian'||g.type!=='guardian'||g.owner!=='player'||!def||g.classId!==cls||def.classId!==cls||g.role!==def.role||!inRoster(cls,g.kind))return false;
  if(typeof g.name!=='string'||!g.name||g.name.length>28||!MAPS[g.map]||!num(g.x,MAPS[g.map].w)||!num(g.y,MAPS[g.map].h))return false;
  if(!num(g.maxHp,1e5)||g.maxHp<1||!num(g.hp,g.maxHp)||!num(g.cd,100)||!num(g.fallenUntil,1e12)||typeof g.fallen!=='boolean')return false;
  if(!STATES.includes(g.state)||!(g.targetId===null||typeof g.targetId==='string'&&g.targetId.length<=80))return false;
  if(g.fallen&&g.hp!==0)return false;
  if(g.attackers!==undefined&&(!record(g.attackers)||Object.keys(g.attackers).length>T.maxAttackers||!Object.values(g.attackers).every(v=>num(v,1e12))))return false;
  if(g.unreachable!==undefined&&(!record(g.unreachable)||Object.keys(g.unreachable).length>32||!Object.values(g.unreachable).every(v=>num(v,1e12))))return false;
  if(g.path!==undefined&&(!Array.isArray(g.path)||g.path.length>400||!g.path.every(q=>record(q)&&Number.isFinite(q.x)&&Number.isFinite(q.y))))return false;
  // A second actor with this identity would be a duplicate companion.
  return ![...(s.actors||[]),...(s.enemies||[]),...(s.life?.pets||[]),...(s.journey?.residents||[])].some(a=>a.id==='guardian');
}
export function noteAttack(s,enemy){
  const g=s.guardian;if(!g||!enemy?.id)return;
  g.attackers??={};g.attackers[enemy.id]=s.elapsed;
  const keys=Object.keys(g.attackers);if(keys.length>T.maxAttackers)for(const k of keys.sort((a,b)=>g.attackers[a]-g.attackers[b]).slice(0,keys.length-T.maxAttackers))delete g.attackers[k];
}
export function restore(s,full=true){
  const g=s.guardian;if(!g)return false;
  if(g.fallen){g.fallen=false;g.state='follow';snap(s);g.hp=Math.ceil(g.maxHp*(full?1:.5));}else if(full)g.hp=g.maxHp;
  return true;
}
// Summoner "Recall": revive a fallen minion at half health or pull a live one to the owner.
export function recall(s,empower=0){
  const g=s.guardian;if(!g)return 'You have no bound companion.';
  const was=g.fallen;restore(s,false);if(!was){snap(s);}g.targetId=null;g.path=[];g.state='follow';if(empower)g.empoweredUntil=s.elapsed+empower;
  return was?`${g.name} returns at half strength.`:`${g.name} rejoins you.`;
}
export function heal(s,fraction){
  const g=s.guardian;if(!g||g.fallen)return false;g.hp=Math.min(g.maxHp,g.hp+g.maxHp*fraction);return true;
}
export function damage(s,amount,api){
  const g=s.guardian;if(!g||g.fallen)return;
  g.hp=Math.max(0,g.hp-Math.max(1,amount));g.flash=s.elapsed+.23;
  if(g.hp>0)return;
  g.fallen=true;g.fallenUntil=s.elapsed+T.recover;g.targetId=null;g.path=[];g.state='fallen';g.moving=false;
  api?.note?.(s,`${g.name} falls, but the bond holds. It will return to your side in ${T.recover} seconds, or at a shrine or bed.`);
}
export const hostile=(s,g,e)=>!!e&&e.type==='enemy'&&!e.deadUntil&&!e.expired&&!e.warden&&!e.fleeing&&e.map===g.map&&(e.spawnAt??0)<=s.elapsed;
function threatPriority(s,g,p,e){
  const d=dist(e,p),at=g.attackers?.[e.id];
  if(e.markedUntil>s.elapsed&&d<=T.keep)return 0;
  if(at!==undefined&&s.elapsed-at<=T.attackWindow&&d<=T.keep+2)return 1;
  if(d<=T.threat)return 2;
  return -1;
}
export function chooseTarget(s,g,p){
  const keep=g.targetId&&s.enemies.find(e=>e.id===g.targetId);
  if(keep&&hostile(s,g,keep)&&threatPriority(s,g,p,keep)>=0&&!(g.unreachable?.[keep.id]>s.elapsed))return keep;
  const list=[];
  for(const e of s.enemies){
    if(!hostile(s,g,e)||g.unreachable?.[e.id]>s.elapsed)continue;
    const pr=threatPriority(s,g,p,e);if(pr<0)continue;list.push({e,pr,d:dist(e,p)});
  }
  list.sort((a,b)=>a.pr-b.pr||Math.round(a.d*100)-Math.round(b.d*100)||String(a.e.id).localeCompare(String(b.e.id)));
  return list[0]?.e||null;
}
function strike(s,g,def,e,p,api,now){
  const lvl=p.level||1;let d=scaledDamage(def,lvl);const n=g.hits=(g.hits||0)+1;
  switch(def.perk){
    case 'flare':if(n%3===0)d*=1.6;break;
    case 'ward':if(p.hp<p.maxHp*.4)d*=1.25;break;
    case 'chill':e.slowUntil=Math.max(e.slowUntil||0,s.elapsed+1.6);break;
    case 'stagger':if(n%3===0)e.boundUntil=Math.max(e.boundUntil||0,s.elapsed+.5);break;
    case 'rend':if(n%3===0)d*=1.5;break;
    case 'charge':if(g.chargeReady){d*=1.8;e.boundUntil=Math.max(e.boundUntil||0,s.elapsed+.6);g.chargeReady=false;}break;
    case 'pounce':if(g.pounceId!==e.id){d*=1.5;g.pounceId=e.id;}break;
    case 'dive':if(e.markedUntil>s.elapsed)d*=1.2;break;
  }
  if(g.empoweredUntil>s.elapsed)d*=1.5;
  d=Math.max(1,Math.round(d));
  g.cd=def.cd;g.direction=e.y<g.y?-1:1;
  s.effects??=[];s.effects.push({type:def.ranged?'spell':'strike',from:{x:g.x,y:g.y},to:{x:e.x,y:e.y},until:s.elapsed+.32});
  api.hurt(s,e,d,now,'companion');
  return d;
}
export function tick(s,dt,api,now=Date.now()){
  const g=upgrade(s);if(!g)return;
  const p=s.player,def=COMPANIONS[g.kind];if(!def)return;
  const maxHp=scaledHp(def,p.level||1);
  if(g.maxHp!==maxHp){const ratio=g.maxHp?g.hp/g.maxHp:1;g.maxHp=maxHp;g.hp=g.fallen?0:Math.max(1,Math.min(maxHp,Math.round(maxHp*ratio)));}
  g.cd=Math.max(0,g.cd-dt);g.think-=dt;
  for(const [id,t] of Object.entries(g.attackers))if(s.elapsed-t>T.attackWindow+1)delete g.attackers[id];
  for(const [id,t] of Object.entries(g.unreachable))if(t<=s.elapsed)delete g.unreachable[id];
  if(g.fallen){
    g.moving=false;g.targetId=null;
    if(s.elapsed>=g.fallenUntil&&!p.deadUntil){g.fallen=false;g.hp=Math.ceil(g.maxHp*.5);snap(s);api.note?.(s,`${g.name} returns to your side.`);}
    return;
  }
  // Follow across maps/portals, shrine respawns and long separations: one stable actor, moved, never copied.
  if(g.map!==p.map||dist(g,p)>T.teleport){snap(s);}
  if(p.deadUntil){g.state='guard';g.targetId=null;g.path=[];g.moving=false;return;}
  const speedBoost=dist(g,p)>8?1.35:1;
  let target=chooseTarget(s,g,p);
  if(target&&dist(g,p)>T.leash){g.unreachable[target.id]=s.elapsed+T.unreachable;target=null;}
  if(!target){
    if(g.targetId){g.targetId=null;g.path=[];g.state='return';g.pounceId=null;}
    const d=dist(g,p);
    if(g.state==='return'&&d<=T.near+.4)g.state='follow';
    if(g.state==='guard')g.state='follow';
    const need=d>T.far||(g.trail||g.state==='return')&&d>T.near;
    g.trail=need;
    if(need){
      if(g.state!=='return')g.state='follow';
      if(g.think<=0||!g.path.length){g.path=api.path(g,p,2200,true);g.think=T.pathTick;}
      api.follow(g,dt,def.speed*speedBoost);
    }else{g.moving=false;g.path=[];if(g.state==='follow')g.hp=Math.min(g.maxHp,g.hp+g.maxHp*T.regen*(def.perk==='stagger'?2.5:1)*dt);}
    return;
  }
  // Acquire / keep a target.
  if(g.targetId!==target.id){g.targetId=target.id;g.path=[];g.think=0;g.state='chase';g.pounceId=g.pounceId===target.id?g.pounceId:null;if(def.perk==='charge')g.chargeReady=dist(g,target)>3.4;}
  const d=dist(g,target),sight=api.lineOfSight(g.map,g,target),reach=d<=def.range&&sight;
  if(reach){
    g.state='attack';g.moving=false;g.path=[];g.direction=target.y<g.y?-1:1;
    if(g.cd<=0)strike(s,g,def,target,p,api,now);
    return;
  }
  g.state='chase';
  if(g.think<=0||!g.path.length){
    g.path=api.path(g,target,2200,true);g.think=T.pathTick;
    // No route (walls, locked doors, water): do not butt against geometry; stand down for a while.
    if(!g.path.length){g.unreachable[target.id]=s.elapsed+T.unreachable;g.targetId=null;g.state='return';g.moving=false;return;}
  }
  api.follow(g,dt,def.speed*speedBoost);
}
// Enemies fighting the companion in melee strike back on their normal cooldown, but only when
// the owner is not already in that enemy's reach (the owner stays the primary target).
export function retaliate(s,api){
  const g=s.guardian;if(!g||g.fallen||!g.targetId)return;
  const e=s.enemies.find(e=>e.id===g.targetId);if(!hostile(s,g,e))return;
  const reach=(e.range??1.45)+.2;
  if(e.cd<=0&&dist(e,g)<=reach&&dist(e,s.player)>reach+.3&&api.lineOfSight(g.map,e,g)){
    e.cd=e.cooldown??1.35;damage(s,Math.round((e.attack||5)*.55),api);
  }
}
