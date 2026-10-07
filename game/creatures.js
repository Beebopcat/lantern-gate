// Stable creature IDs shared with the illustrated Borrowed Names adventure.
import {dist} from './world.js';
export const CREATURES={
 'drowned-sexton':{name:'The Drowned Sexton',where:'Ossuary & Laboratory · the lower castle',art:'assets/creatures/drowned-sexton.webp',lore:'Tomas rang the drowned church awake. The count turned his congregation into a debt he can never finish counting.',rule:'Listens for movement within 13 paces. Stop moving and break away from its last known position; a class ward blocks its pursuit.',hp:110,attack:16,speed:1.9,range:1.45,cooldown:1.8},
 'hollow-cantor':{name:'The Hollow Cantor',where:'Candleless Galleries · the second castle level',art:'assets/creatures/hollow-cantor.webp',lore:'A stolen choir lives in an unwilling throat. Silence is the countername hidden between its notes.',rule:'Keeps watch near its gallery station. Its chant reaches 4 paces only with line of sight; pillars, wards and leaving its chamber break the attack.',hp:90,attack:12,speed:1.2,range:4,cooldown:2.6},
 'tallow-widow':{name:'The Tallow Widow',where:'Wolf Court · the third castle level',art:'assets/creatures/tallow-widow.webp',lore:'Agnes waited at a threshold until the promise became a prison. She guards a doorway in the count’s court.',rule:'Ambushes travelers within 10 paces and returns to her threshold beyond 12. Faster than the Sexton, slower than a wayfarer. Wards stop the approach.',hp:105,attack:20,speed:2.8,range:1.6,cooldown:1.7}
};
export const CASTLE_CREATURE_SLOTS=[{id:'castle-1-4',kind:'drowned-sexton'},{id:'castle-2-4',kind:'hollow-cantor'},{id:'castle-3-4',kind:'tallow-widow'}];
export function creatureTarget(s,e,dt,{lineOfSight,ward}){
 const p=s.player;if(!CREATURES[e.kind]||p.map!==e.map||p.deadUntil)return null;
 if(ward(p)||ward(e)){e.huntState='circling';return null;}
 const decoy=s.journey?.decoy,point=decoy?.map===e.map&&decoy.until>s.elapsed?decoy:p,d=dist(e,point);
 if(e.kind==='drowned-sexton'){
  if(d<13&&(point!==p||p.moving)){e.memory={x:point.x,y:point.y,map:e.map};e.lost=0;e.huntState='tracking';return point;}
  e.lost=(e.lost||0)+dt;e.huntState='searching';return e.lost<6?e.memory||null:null;
 }
 const inTerritory=dist(point,e.home)<(e.kind==='hollow-cantor'?14:12);
 if(inTerritory&&d<(e.kind==='hollow-cantor'?18:10)&&lineOfSight(e.map,e,point)){e.huntState=e.kind==='hollow-cantor'?'chanting':'tracking';return point;}
 e.huntState='stalking';return dist(e,e.home)>1?{...e.home,map:e.map}:null;
}
