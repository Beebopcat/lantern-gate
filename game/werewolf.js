import * as THREE from './vendor/three.js';
import {weld} from './characters.js';
const joint=(parent,x,y,z)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
// Approved direction: a gaunt human transformation, exposed skin and sparse strands.
export function createWerewolf(f,a){
 const root=f.group(),torso=joint(root,0,1.52,-.09),chest=joint(torso,0,.43,.08),head=joint(chest,0,.54,.36),jaw=joint(head,0,-.09,.12),skin='#a698a1',crease='#766975',bone='#b5a9ad',hair='#292d31',nail='#56534b';
 const g=new THREE.LatheGeometry([new THREE.Vector2(.22,0),new THREE.Vector2(.20,.12),new THREE.Vector2(.17,.26),new THREE.Vector2(.20,.36),new THREE.Vector2(.34,.55),new THREE.Vector2(.42,.68),new THREE.Vector2(.32,.81),new THREE.Vector2(.095,.92)],24);
 const body=new THREE.Mesh(g,f.mat(skin));body.scale.z=.59;body.userData.ownedGeometry=true;torso.add(body);body.castShadow=true;
 f.ball(torso,0,.23,.015,.165,.25,.105,crease);
 for(let i=0;i<8;i++){const y=.37+i*.059,w=.24+Math.sin(i/8*Math.PI)*.095;for(const side of [-1,1]){const rib=f.ball(torso,side*w*.54,y,.14,.16,.023,.09,i%2?bone:skin);rib.rotation.z=side*.13;}}
 f.ball(torso,0,.02,-.015,.23,.12,.14,skin);
 for(let i=0;i<12;i++){const y=.13+i*.065;f.ball(torso,0,y,-.11-Math.sin(i/11*Math.PI)*.13,.045,.039,.044,bone);}
 f.ball(chest,0,.37,.16,.14,.22,.16,skin);f.ball(chest,0,.20,.07,.21,.18,.15,skin);
 f.ball(head,0,.105,.015,.19,.245,.18,skin);f.ball(head,0,-.035,.155,.12,.17,.215,skin);
 // Protruding facial bones remain human: no animal snout, dog nose or upright ears.
 f.ball(head,0,.04,.27,.105,.09,.16,skin);f.ball(head,0,.055,.373,.042,.044,.045,'#8d7380');
 f.ball(head,0,-.12,.23,.105,.125,.099,'#251e28');f.ball(jaw,0,-.12,.16,.105,.095,.21,skin);
 f.ball(jaw,0,-.045,.30,.079,.027,.055,'#623441');
 for(const side of [-1,1]){
  f.ball(head,side*.197,.06,-.035,.028,.071,.041,skin);f.ball(head,side*.10,.13,.163,.084,.075,.036,crease);
  f.ball(head,side*.101,.13,.197,.052,.050,.039,'#cdc5a1');f.ball(head,side*.103,.132,.232,.027,.029,.019,'#bea963');f.ball(head,side*.103,.131,.250,.009,.018,.006,'#20262b');
  const brow=f.ball(head,side*.10,.212,.173,.082,.027,.052,skin);brow.rotation.z=side*.19;
  const cheek=f.ball(head,side*.125,-.05,.138,.041,.12,.051,crease);cheek.rotation.z=-side*.25;
  for(let i=0;i<8;i++){const z=.16+i*.029,x=side*(.082-Math.sin(i/7*Math.PI)*.024);const tooth=f.mesh(head,'cone',x,-.090,z,.012,.051+(i%3)*.009,.014,f.mat('#d6c6aa'));tooth.rotation.z=Math.PI;f.mesh(jaw,'cone',x,-.035,z-.12,.012,.040+(i%2)*.011,.014,f.mat('#cabba5'));}
 }
 // Coarse, isolated hair strands instead of a continuous fur coat.
 for(let i=0;i<24;i++){const x=(i%5-2)*.034,z=-.095-(i%3)*.025;const strand=f.mesh(head,'cone',x,.28-(i%4)*.03,z,.012,.24+(i%3)*.075,.009,f.mat(hair));strand.rotation.x=-.36;}
 for(let i=0;i<38;i++){const y=.23+(i%11)*.058,x=(i%3-1)*.036;const strand=f.mesh(torso,'cone',x,y,-.23,.010,.25+(i%4)*.044,.008,f.mat(hair));strand.rotation.x=-.3;}
 const arms=[],legs=[];
 for(const side of [-1,1]){
  const arm=joint(chest,side*.37,.33,0),elbow=joint(arm,side*.045,-.61,.09),paw=joint(elbow,0,-.72,.08);
  f.ball(arm,0,-.24,0,.11,.37,.10,skin);f.ball(arm,side*.022,-.48,.03,.069,.072,.069,bone);f.ball(elbow,0,0,.018,.078,.11,.075,skin);f.ball(elbow,0,-.28,.035,.075,.41,.069,skin);f.ball(paw,0,-.055,.03,.113,.126,.065,skin);
  // Fingers follow the hand as a single rigid piece. Keeping an unused joint per
  // finger would add eight draw calls without changing their animation.
  for(let i=0;i<4;i++){const x=(i-1.5)*.056;f.ball(paw,x,-.186,.063,.023,.084,.025,bone);f.ball(paw,x,-.255,.089,.019,.078,.02,skin);const claw=f.mesh(paw,'cone',x,-.355,.139,.020,.18,.014,f.mat(nail));claw.rotation.x=-.38;}
  f.ball(paw,-side*.115,-.043,.11,.028,.10,.029,skin);
  for(let i=0;i<7;i++){const strand=f.mesh(elbow,'cone',(i%2-.5)*.09,-.13-i*.054,-.054,.008,.17,.009,f.mat(hair));strand.rotation.z=side*.14;}
  arms.push({arm,elbow,paw,side});
  const hip=joint(root,side*.19,1.46,-.09),knee=joint(hip,side*.026,-.61,.20),hock=joint(knee,-side*.023,-.52,-.17),foot=joint(hock,0,-.29,.08);
  f.ball(hip,0,-.23,.07,.14,.37,.125,skin);f.ball(knee,0,-.008,0,.084,.085,.080,bone);f.ball(knee,0,-.24,-.041,.069,.34,.065,skin);f.ball(hock,0,.035,.012,.065,.12,.062,skin);f.ball(hock,0,-.10,.023,.056,.20,.051,skin);f.ball(foot,0,-.006,.10,.106,.041,.20,skin);
  for(let i=0;i<4;i++){const x=(i-1.5)*.053;f.ball(foot,x,-.017,.268,.024,.029,.064,bone);const claw=f.mesh(foot,'cone',x,-.013,.34,.017,.16,.016,f.mat(nail));claw.rotation.x=Math.PI/2;}
  for(let i=0;i<7;i++){const strand=f.mesh(knee,'cone',side*.05,-.07-i*.057,-.084,.010,.16,.009,f.mat(hair));strand.rotation.x=-.18;}
  legs.push({hip,knee,hock,foot,side});
 }
 if(a.type==='mythic')root.scale.setScalar(1.10);
 weld(root,f.mat('#ffffff',-1,{vertexColors:true,roughness:.83}));g.dispose();root.userData.wolfRig={torso,chest,head,jaw,legs,arms};return root;
}
export function wolfPose({phase=0,blend=0,clock=0,attack=0,state='stalking',dead=false}){
 const sprint=['tracking','lunge'].includes(state),cycle=phase*(sprint?1.17:.71);
 return {lean:dead?0:sprint?.27:.15,bob:Math.sin(cycle*2)*.035*blend,head:state==='searching'?Math.sin(clock*1.2)*.38:attack*.10,jaw:.14+attack*.55,front:[Math.sin(cycle)*.46*blend,Math.sin(cycle+Math.PI)*.51*blend],rear:[Math.sin(cycle+1.1)*.44*blend,Math.sin(cycle+Math.PI+1.1)*.48*blend],reach:Math.sin(attack*Math.PI)*.97};
}
export function animateWerewolf(root,m,a){
 const r=root.userData.wolfRig,p=wolfPose({...m,state:a.huntState,dead:!!a.deadUntil});root.rotation.y=m.facing;root.rotation.z=a.deadUntil?Math.PI/2:0;
 r.torso.position.y=1.52+p.bob;r.torso.rotation.x=-.12;r.chest.rotation.x=p.lean;r.chest.rotation.z=Math.sin(m.clock*.75)*.025;r.head.rotation.set(-p.lean*.45,p.head,-.05);r.jaw.rotation.x=p.jaw;
 const profile=root.userData.creaturePose;if(profile){r.chest.rotation.x+=profile.lean;r.chest.rotation.z+=profile.twist;r.jaw.rotation.x+=profile.jaw;r.head.rotation.z+=profile.head;}
 r.arms.forEach((arm,i)=>{arm.arm.rotation.x=p.front[i]-p.reach;arm.arm.rotation.z=arm.side*(.06+Math.sin(m.clock*1.1+i)*.025);arm.elbow.rotation.x=-.22+Math.max(0,-p.front[i])*.55;arm.paw.rotation.x=-arm.arm.rotation.x*.2;});
 r.legs.forEach((leg,i)=>{leg.hip.rotation.x=p.rear[i];leg.knee.rotation.x=.22+Math.max(0,-p.rear[i])*.49;leg.hock.rotation.x=-.19;leg.foot.rotation.x=-leg.hip.rotation.x*.4;});
}
