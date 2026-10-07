import {solid,dist} from './world.js';
const alive=a=>a&&!a.deadUntil&&!a.expired;
const seed=id=>[...String(id||'resident')].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17);
export const radius=a=>a.type==='guardian' ? (a.size||.43) : a.type==='hero' ? .36 : a.kind==='troll' ? .68 : a.type==='enemy' ? .5 : .43;
function actors(s){return [s.player,...s.actors,...s.enemies,...(s.journey?.residents||[]),...(s.life?.pets||[]),...(s.guardian&&!s.guardian.fallen?[s.guardian]:[])].filter(a=>alive(a)&&(a.spawnAt??0)<=s.elapsed);}
const cell=(map,x,y)=>`${map}:${Math.floor(x/2.5)}:${Math.floor(y/2.5)}`;
function buildBuckets(list){const buckets=new Map();for(const a of list){const key=cell(a.map,a.x,a.y);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(a);}return buckets;}
function canStand(s,a,x,y,api){
  const r=radius(a)*.62;
  return ![[0,0],[r,0],[-r,0],[0,r],[0,-r]].some(([dx,dy])=>solid(a.map,x+dx,y+dy)||api.blocked?.(a,x+dx,y+dy));
}
function neighbours(buckets,a){
  const out=[],cx=Math.floor(a.x/2.5),cy=Math.floor(a.y/2.5);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)out.push(...(buckets.get(`${a.map}:${cx+dx}:${cy+dy}`)||[]));
  return out;
}
function canMove(s,a,x,y,api){
  if(!canStand(s,a,x,y,api))return false;
  // A body already touching a wall may move out of it, but cannot be pushed
  // through a closed door or across a solid tile to reach a legal endpoint.
  const cleanStart=canStand(s,a,a.x,a.y,api),steps=Math.max(1,Math.ceil(Math.hypot(x-a.x,y-a.y)/.1));
  for(let i=1;i<steps;i++){
    const px=a.x+(x-a.x)*i/steps,py=a.y+(y-a.y)*i/steps;
    if(solid(a.map,px,py)||api.blocked?.(a,px,py)||(cleanStart&&!canStand(s,a,px,py,api)))return false;
  }
  return true;
}
function pressure(a,x,y,near){
  let score=0;
  for(const b of near){if(b===a)continue;const overlap=radius(a)+radius(b)+.09-Math.hypot(x-b.x,y-b.y);if(overlap>0)score+=overlap*overlap;}
  return score;
}
function displace(s,a,ux,uy,push,api,buckets,budget){
  push=Math.min(push,budget.get(a)||0);if(push<1e-6)return false;
  const near=neighbours(buckets,a),before=pressure(a,a.x,a.y,near),goal=a.crowdGoal;
  let best=null,bestScore=before;
  // Wall contact needs a tangential escape. An axial fallback can return an
  // unchanged position forever while a second attacker keeps pushing inward.
  for(const turn of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,3*Math.PI/4,-3*Math.PI/4,Math.PI]){
    const c=Math.cos(turn),v=Math.sin(turn),dx=ux*c-uy*v,dy=ux*v+uy*c;
    for(const scale of [1,.5]){
      const x=a.x+dx*push*scale,y=a.y+dy*push*scale;if(!canMove(s,a,x,y,api))continue;
      const physical=pressure(a,x,y,near);if(physical>=before-1e-10)continue;
      const goalBias=goal&&goal.map===a.map?Math.max(-push,Math.min(push,Math.hypot(x-goal.x,y-goal.y)-dist(a,goal)))*.002:0;
      const score=physical+goalBias+(1-(dx*ux+dy*uy))*.00001;
      if(score<bestScore){best={x,y,used:push*scale};bestScore=score;}
    }
  }
  if(!best)return false;
  a.x=best.x;a.y=best.y;budget.set(a,Math.max(0,budget.get(a)-best.used));return true;
}
// Two bounded passes resolve local pressure. Candidate escapes stay on valid
// geometry and use only spatial neighbours, including at a crowded doorway.
export function separateCrowd(s,dt,api={}){
  const list=actors(s),stats={actors:list.length,comparisons:0,overlaps:0,moved:0};
  if(dt<=0)return stats;
  const limit=Math.min(.30,Math.max(.005,dt)*2.5);
  const anchored=new Set(),budget=new Map(list.map(a=>[a,limit]));
  for(const a of list){
    const q=a.crowdGoal;if(a===s.player||a.type==='mythic'||a.boundUntil>s.elapsed||api.fixed?.(a)||!q?.front||q.kind!=='door'||q.map!==a.map||dist(a,q)>.22||!canMove(s,a,q.x,q.y,api))continue;
    if([...anchored].some(b=>b.map===a.map&&dist(q,b)<radius(a)+radius(b)+.085))continue;
    // Exact front stations are spaced 1.10 units apart. Pinning a path's loose
    // arrival tolerance instead would leave those same bodies overlapping.
    a.x=q.x;a.y=q.y;anchored.add(a);
  }
  const immovable=a=>a===s.player||a.type==='mythic'||a.boundUntil>s.elapsed||anchored.has(a)||api.fixed?.(a);
  for(let pass=0;pass<2;pass++){
    const buckets=buildBuckets(list),index=new Map(list.map((a,i)=>[a,i]));
    for(let ai=0;ai<list.length;ai++){
      const a=list[ai],cx=Math.floor(a.x/2.5),cy=Math.floor(a.y/2.5);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const b of buckets.get(`${a.map}:${cx+dx}:${cy+dy}`)||[]){
        if(index.get(b)<=ai)continue;stats.comparisons++;
        const gap=radius(a)+radius(b)+.09,d=dist(a,b);if(d>=gap)continue;stats.overlaps++;
        const fixedA=immovable(a),fixedB=immovable(b);if(fixedA&&fixedB)continue;
        let ux=(a.x-b.x)/(d||1),uy=(a.y-b.y)/(d||1);
        if(d<1e-5){const angle=(seed(a.id||'player')^seed(b.id))%6283/1000;ux=Math.cos(angle);uy=Math.sin(angle);}
        const push=Math.min(limit,(gap-d)*.7),share=fixedA||fixedB?1:.5;
        if(!fixedA&&displace(s,a,ux,uy,push*share,api,buckets,budget))stats.moved++;
        if(!fixedB&&displace(s,b,-ux,-uy,push*share,api,buckets,budget))stats.moved++;
      }
    }
  }
  return stats;
}
// Six physically spaced melee stations fit inside the real attack radius.
// Outer attackers queue, then take a vacated front station when its occupant
// dies, is bound, changes map or leaves the fight. Blocked stations are removed
// before assignment, rather than sending several attackers to one fallback.
export function engagementPoint(s,a,target,api={}){
  if(!target||target.type==='door'||a.boundUntil>s.elapsed)return target;
  const pool=a.type==='enemy'?s.enemies:s.actors.filter(b=>b===a||['guard','ranger'].includes(b.role));
  const peers=pool.filter(b=>alive(b)&&b.map===a.map&&!(b.boundUntil>s.elapsed)&&(b.spawnAt??0)<=s.elapsed&&(b===a||dist(b,target)<15)).sort((b,c)=>(b.spawnAt||0)-(c.spawnAt||0)||String(b.id).localeCompare(String(c.id)));
  const largest=peers.reduce((best,b)=>radius(b)>radius(best)?b:best,a),gap=radius(largest)*2+.12;
  const distance=Math.max(.82,Math.min(1.25,...peers.map(b=>(b.range||1.45)-.15))),capacity=Math.max(3,Math.min(6,Math.floor(Math.PI/Math.asin(Math.min(.99,gap/(2*distance))))));
  const points=[];
  for(let ring=0;ring<12&&points.length<peers.length;ring++)for(let i=0;i<capacity;i++){
    const theta=i*Math.PI*2/capacity+(ring%2?Math.PI/capacity:0),r=distance+ring*(gap+.04);
    const q={map:target.map||a.map,x:target.x+Math.cos(theta)*r,y:target.y+Math.sin(theta)*r,front:ring===0};
    if(canStand(s,largest,q.x,q.y,api)&&points.every(p=>dist(p,q)>=gap-.001))points.push(q);
  }
  const key=`${target.map||a.map}:${target===s.player?'player':target.id||target.name||'victim'}`,occupied=new Map();
  for(const b of peers){const seat=b.engagement;if(seat?.target===key&&points[seat.slot]&&!occupied.has(seat.slot))occupied.set(seat.slot,b);}
  for(const b of peers)if(![...occupied.values()].includes(b)){
    let slot=0;while(occupied.has(slot)&&slot<points.length)slot++;if(slot>=points.length)continue;
    occupied.set(slot,b);b.engagement={target:key,slot};
  }
  for(let slot=0;slot<points.length;slot++)if(points[slot].front&&!occupied.has(slot)){
    const waiting=[...occupied.entries()].filter(([i])=>!points[i].front).sort(([i],[j])=>i-j)[0];
    if(waiting){occupied.delete(waiting[0]);occupied.set(slot,waiting[1]);waiting[1].engagement={target:key,slot};}
  }
  const slot=[...occupied.entries()].find(([,b])=>b===a)?.[0];return points[slot]||{map:a.map,x:a.x,y:a.y};
}
