import * as THREE from './vendor/three.js';
import {weld} from './characters.js';
const joint=(f,parent,x,y,z)=>{const g=f.group();g.position.set(x,y,z);parent.add(g);return g;};

// A separate modeled creature: pallid sockets, yellow eyes and an articulated toothed jaw.
export function createPaleGuest(f,a){
  const root=f.group(),body=joint(f,root,0,.92,0),head=joint(f,body,0,.78,.03),jaw=joint(f,head,0,-.05,.12),skin='#b9b2b5',hair='#202426',shirt='#729e91';
  f.ball(body,0,.34,0,.26,.36,.16,shirt);f.ball(body,0,.12,0,.22,.20,.17,'#547c73');f.cyl(body,0,.69,0,.07,.18,skin);
  for(const side of [-1,1]){const collar=f.box(body,side*.076,.63,.15,.12,.16,.033,'#a1bbaf');collar.rotation.z=side*.40;}
  for(let i=0;i<4;i++)f.ball(body,0,.18+i*.11,.18,.016,.016,.011,'#c1cfbf');
  f.ball(head,0,.11,-.01,.20,.26,.17,skin);f.ball(head,0,-.025,.04,.15,.17,.15,skin);
  for(const side of [-1,1]){
    f.ball(head,side*.21,.06,0,.037,.08,.04,skin);f.ball(head,side*.09,.12,.16,.072,.078,.030,'#30313d');
    const brow=f.ball(head,side*.087,.198,.17,.075,.028,.045,hair);brow.rotation.z=-side*.33;
    f.ball(head,side*.128,-.011,.117,.046,.093,.026,'#7d7483');
    const crease=f.box(head,side*.035,.036,.187,.014,.115,.012,'#6a6170');crease.rotation.z=side*.14;
  }
  f.ball(head,0,.073,.19,.034,.081,.05,skin);f.ball(head,0,.009,.214,.055,.029,.033,'#998991');
  f.ball(head,0,-.084,.18,.137,.073,.026,'#241b27');
  f.ball(jaw,0,-.111,.047,.133,.081,.096,skin);f.ball(jaw,0,-.04,.105,.113,.035,.021,'#572432');
  for(let i=0;i<9;i++){const x=(i-4)*.025,z=.212-Math.abs(i-4)*.006;const tooth=f.mesh(head,'cone',x,-.074,z,.012,i===1||i===7?.054:.027,.015,f.mat('#d8cfaf'));tooth.rotation.z=Math.PI;f.box(jaw,x,-.042,z-.11,.017,.03,.012,'#d8cfaf');}
  f.ball(head,0,.305,-.044,.211,.097,.164,hair);
  for(let i=0;i<27;i++){const a=i*2.4,x=Math.cos(a)*.19,y=.19+(i%4)*.06,z=Math.sin(a)*.12-.04;const lock=f.ball(head,x,y,z,.047,.071,.044,i%4?'#232828':'#393b3b');lock.rotation.z=Math.sin(a)*.6;}
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const shoulder=joint(f,body,side*.255,.54,0),elbow=joint(f,shoulder,0,-.30,0),hand=joint(f,elbow,0,-.31,.03);
    f.ball(shoulder,0,-.12,0,.091,.18,.092,shirt);f.ball(elbow,0,-.14,0,.062,.20,.063,skin);f.ball(hand,0,-.02,.022,.066,.082,.038,skin);
    for(let i=0;i<4;i++){const finger=f.ball(hand,(i-1.5)*.032,-.105,.029,.013,.081,.016,skin);finger.rotation.x=-.15;}arms.push({shoulder,elbow,hand,side});
    const hip=joint(f,body,side*.12,0,0),knee=joint(f,hip,0,-.41,0),foot=joint(f,knee,0,-.40,0);
    f.ball(hip,0,-.19,0,.09,.24,.095,'#444e51');f.ball(knee,0,-.18,0,.074,.23,.077,'#303a3e');f.ball(foot,0,-.025,.062,.095,.08,.16,'#2b3237');legs.push({hip,knee,foot});
  }
  weld(root,f.mat('#ffffff',-1,{vertexColors:true,roughness:.79}));
  for(const side of [-1,1]){f.mesh(head,'sphere',side*.088,.12,.185,.036,.037,.02,f.mat('#c6bc4b',-1,{emissive:'#7a6d10',emissiveIntensity:.32}));f.ball(head,side*.088,.12,.206,.013,.018,.007,'#101b1d');}
  root.userData.guestRig={body,head,jaw,arms,legs};return root;
}
export function animatePaleGuest(root,m,a){
  const r=root.userData.guestRig,t=m.clock,stride=m.phase,blend=a.deadUntil?0:m.blend,hit=Math.sin(m.attack*Math.PI);
  root.rotation.y=m.facing;root.rotation.z=a.deadUntil?Math.PI/2:0;
  r.body.position.y=.92+Math.sin(stride*2)*.015*blend;r.body.rotation.set(.13*blend,Math.sin(stride)*.13*blend,.06);
  r.head.rotation.set(-.08+Math.sin(t*1.4)*.023,Math.sin(t*.8+a.x)*.15*(1-blend),-.11);r.jaw.rotation.x=.1+hit*.58;
  for(let i=0;i<2;i++){const phase=stride+i*Math.PI,arm=r.arms[i],leg=r.legs[i];leg.hip.rotation.x=Math.sin(phase)*.39*blend;leg.knee.rotation.x=Math.max(0,-Math.sin(phase))*.55*blend;leg.foot.rotation.x=-leg.hip.rotation.x-leg.knee.rotation.x;arm.shoulder.rotation.x=Math.sin(phase+.8)*.24*blend-.32-hit*.95;arm.elbow.rotation.x=-.17-hit*.5;arm.hand.rotation.z=Math.sin(t*1.1+i)*.12;}
}
