import {animateOccupation} from './occupation-poses.js';
const TAU=Math.PI*2;
export const damp=(value,target,rate,dt)=>target+(value-target)*Math.exp(-rate*dt);
export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
export const turn=(value,target,rate,dt)=>value+angleDelta(value,target)*(1-Math.exp(-rate*dt));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));

export function createMotion(a){return {x:a.x,y:a.y,targetX:a.x,targetY:a.y,facing:0,targetFacing:0,phase:0,speed:0,blend:0,attack:0,lastCd:a.cd||0,map:a.map,clock:0,hit:0};}
export function stepMotion(m,a,dt,active=true){
  dt=clamp(dt,0,.1);const jump=Math.hypot(a.x-m.x,a.y-m.y)>4||m.map!==a.map;
  if(jump){m.x=a.x;m.y=a.y;m.speed=m.blend=0;m.map=a.map;}
  const ox=m.x,oy=m.y;m.x=damp(m.x,a.x,26,dt);m.y=damp(m.y,a.y,26,dt);
  const dx=m.x-ox,dy=m.y-oy,distance=Math.hypot(dx,dy),speed=dt>0?distance/dt:0;
  if(distance>.0003){m.targetFacing=Math.atan2(dx,dy);m.phase=(m.phase+distance*TAU/1.62)%TAU;}
  m.facing=turn(m.facing,m.targetFacing,13,dt);m.speed=damp(m.speed,active?speed:0,11,dt);m.blend=damp(m.blend,clamp(m.speed/.8,0,1),active?12:20,dt);
  if((a.cd||0)>m.lastCd+.1){m.attack=1;}
  m.lastCd=a.cd||0;if(active){m.attack=Math.max(0,m.attack-dt*2.8);m.clock+=dt;}
  m.targetX=a.x;m.targetY=a.y;return m;
}

// Two-bone inverse kinematics: the stance foot stays level while the swing foot clears the ground.
export function legPose(phase,blend,run=0,bob=0){
  const swing=Math.max(0,Math.sin(phase)),z=-Math.cos(phase)*(.26+.12*run)*blend;
  const y=-.82+swing*(.13+.07*run)*blend-bob;
  const length=clamp(Math.hypot(z,y),.08,.829),knee=Math.acos(clamp((length*length-.4*.4-.43*.43)/(2*.4*.43),-1,1));
  const hip=Math.atan2(-z,-y)-Math.atan2(.43*Math.sin(knee),.4+.43*Math.cos(knee));
  return {hip,knee,ankle:-hip-knee+swing*.12*blend};
}
export function animateCharacter(root,m,a,active=true,working=false){
  const rig=root.userData.rig,t=m.clock,dead=!!a.deadUntil,sleep=(a.activity?.animation==='sleep'||a.task==='sleeping')&&m.blend<.1,blend=dead||sleep?0:m.blend;
  root.rotation.y=m.facing;root.rotation.z=dead||sleep?Math.PI/2:0;
  if(!rig){for(const [i,l] of (root.userData.limbs||[]).entries())l.rotation.x=Math.sin(m.phase+(i===0||i===3?0:Math.PI))*.45*blend;return;}
  const run=clamp((m.speed-2)/2,0,1),phase=m.phase,breath=Math.sin(t*2.1+rig.seed)*.008,bob=-Math.cos(phase*2)*.012*blend;
  rig.pelvis.position.y=.95+bob;rig.pelvis.rotation.z=Math.sin(phase)*.034*blend;rig.pelvis.rotation.y=Math.sin(phase)*.07*blend;
  rig.spine.position.y=.02+breath;rig.spine.rotation.set(run*.09*blend,Math.sin(phase)*-.12*blend,Math.sin(phase)*-.019*blend);
  rig.head.rotation.set(Math.sin(t*1.4+rig.seed)*.015*(1-blend)-run*.055*blend,Math.sin(t*.5+rig.seed)*.085*(1-blend),-rig.pelvis.rotation.z*.6);
  // Seeded blink timing prevents a town of synchronized faces.
  const blink=(t+rig.seed*.137)%4.7,eyeScale=blink<.13?Math.max(.08,Math.abs(blink-.065)/.065):1;for(const eye of rig.eyes)eye.scale.y=eyeScale;
  for(let i=0;i<2;i++){
    const offset=phase+i*Math.PI,leg=legPose(offset,blend,run,bob),l=rig.legs[i],arm=rig.arms[i];
    l.thigh.rotation.x=leg.hip;l.knee.rotation.x=leg.knee;l.foot.rotation.x=leg.ankle;
    arm.shoulder.rotation.set(Math.cos(offset)*(.33+run*.15)*blend-.10,0,(i===0?1:-1)*(.065+Math.sin(t*1.7+rig.seed)*.009));
    arm.elbow.rotation.x=-.15-run*.48*blend-Math.max(0,-Math.cos(offset))*.22*blend;arm.wrist.rotation.set(.04,0,0);
    if(rig.heavy){arm.shoulder.rotation.x*=.3;arm.elbow.rotation.x=-.48;}
  }
  if(rig.role==='scholar'){rig.arms[0].shoulder.rotation.x=-.42;rig.arms[0].elbow.rotation.x=-.83;}
  if(working&&!dead&&active&&blend<.3){rig.arms[1].shoulder.rotation.x=-.65+Math.sin(t*5)*.55;rig.arms[1].elbow.rotation.x=-.8+Math.cos(t*5)*.3;rig.spine.rotation.x=.10;}
  if(!dead&&!sleep&&active&&blend<.3)animateOccupation(rig,a.activity,t);
  if(m.attack>0&&!dead){const hit=Math.sin((1-m.attack)*Math.PI);rig.arms[1].shoulder.rotation.x=-.45-hit*1.45;rig.arms[1].shoulder.rotation.z=-hit*.50;rig.arms[1].elbow.rotation.x=-.12-hit*.65;rig.spine.rotation.y-=hit*.32;if(m.casting){rig.arms[0].shoulder.rotation.x=-hit*1.1;rig.arms[0].elbow.rotation.x=-.5;rig.arms[1].elbow.rotation.x=-.6;}}
  if(rig.cape){rig.cape.rotation.x=.08+blend*.22+Math.sin(t*3+rig.seed)*(.018+blend*.035);rig.cape.rotation.z=-rig.pelvis.rotation.z*.7;}
  if(rig.coatTail)rig.coatTail.rotation.x=-.04-Math.abs(Math.sin(phase))*.18*blend;
  if(dead||sleep){rig.spine.rotation.set(.03,0,0);for(const arm of rig.arms){arm.shoulder.rotation.x=-.24;arm.elbow.rotation.x=-.3;}}
}
