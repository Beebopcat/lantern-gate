// Eight distinct procedural models for the Summoner minions and Ranger beasts.
// They use the same primitive factory as every other actor; no external artwork is required.
import {COMPANIONS} from './companions.js';
const glow=(f,color,emissive,intensity=1.5,extra={})=>f.mat(color,-1,{emissive,emissiveIntensity:intensity,...extra});
function legPair(f,g,legs,xs,zs,w,h,d,color,y=h/2){for(const x of xs)for(const z of zs){legs.push(f.box(g,x,y,z,w,h,d,color));}}
const builders={
  'ember-imp'(f,g,rig){
    const red='#c9442c',dark='#2a1a14',ember=glow(f,'#ffb04a','#ff6a14',1.8);
    f.ball(g,0,.58,0,.2,.27,.17,red);f.ball(g,0,.5,.1,.14,.18,.08,'#e98a4c');
    const head=f.group();head.position.set(0,.97,.02);g.add(head);rig.head=head;
    f.ball(head,0,0,0,.19,.17,.17,red);
    for(const s of [-1,1]){const h=f.mesh(head,'cone',s*.11,.2,-.02,.045,.22,.045,f.mat(dark));h.rotation.z=-s*.35;f.ball(head,s*.075,.03,.14,.035,.04,.02,'#ffe27a');const arm=f.box(g,s*.24,.62,.03,.06,.3,.06,red);arm.rotation.z=s*.35;rig.arms.push(arm);}
    f.mesh(head,'cone',0,.28,0,.06,.2,.06,ember);
    f.ball(head,0,-.07,.14,.06,.03,.04,dark);
    rig.tail=f.mesh(g,'cone',0,.38,-.26,.035,.5,.035,f.mat(red));rig.tail.rotation.x=-1.1;f.ball(g,0,.2,-.5,.07,.07,.07,'#ffb04a').material=ember;
    legPair(f,g,rig.legs,[-.09,.09],[0],.07,.3,.08,dark,.15);
  },
  'bone-squire'(f,g,rig){
    const bone='#d8d2bc',dark='#222018',rust='#7d5a3c';
    for(let i=0;i<4;i++)f.box(g,0,.84+i*.06,.02,.28-i*.03,.03,.16,bone);
    f.box(g,0,.7,0,.05,.26,.05,bone);f.box(g,0,.56,0,.26,.09,.14,bone);
    const head=f.group();head.position.set(0,1.18,.02);g.add(head);rig.head=head;
    f.ball(head,0,0,0,.14,.15,.14,bone);f.ball(head,0,-.1,.06,.09,.05,.07,bone);
    for(const s of [-1,1]){f.ball(head,s*.06,.02,.12,.035,.04,.03,dark);}
    f.box(head,0,-.05,.13,.02,.04,.02,dark);
    for(const s of [-1,1]){const arm=f.box(g,s*.2,.93,0,.05,.32,.05,bone);arm.rotation.z=s*.12;rig.arms.push(arm);}
    f.box(g,-.27,.82,.1,.05,.38,.3,rust);f.box(g,-.285,.82,.1,.02,.2,.15,'#b9a06a');
    const sword=f.box(g,.27,.82,.12,.04,.08,.5,'#a9aeb0');f.box(g,.27,.82,-.1,.12,.04,.04,rust);rig.weapon=sword;
    legPair(f,g,rig.legs,[-.08,.08],[0],.05,.46,.05,bone,.26);
  },
  'gloam-wisp'(f,g,rig){
    const cool=glow(f,'#7fe8d8','#38b9b0',1.2,{transparent:true,opacity:.72}),core=glow(f,'#f2fffb','#bfffee',2.2);
    const orb=f.mesh(g,'sphere',0,.95,0,.3,.34,.3,cool);rig.orb=orb;
    f.mesh(g,'sphere',0,.95,0,.14,.16,.14,core);
    for(const s of [-1,1])f.ball(g,s*.1,1,.24,.035,.05,.02,'#0a2b30');
    for(let i=0;i<3;i++){const t=f.mesh(g,'cone',(i-1)*.12,.6-i*.03,-.12,.07,.46,.07,cool);t.rotation.x=Math.PI;rig.tails.push(t);}
    rig.hover=.18;
  },
  'moss-golem'(f,g,rig){
    const stone='#7a7f78',dark='#4f5650',moss='#5f8a47';
    f.box(g,0,1.0,0,.72,.82,.5,stone);f.box(g,0,1.0,.26,.5,.5,.06,dark);
    const head=f.group();head.position.set(0,1.62,.04);g.add(head);rig.head=head;
    f.box(head,0,0,0,.42,.34,.38,stone);f.box(head,0,.0,.2,.3,.1,.04,dark);
    for(const s of [-1,1])f.ball(head,s*.1,.04,.2,.045,.045,.02,'#ffbe55').material=glow(f,'#ffbe55','#ff9a1c',2);
    for(const s of [-1,1]){const arm=f.box(g,s*.5,.98,0,.26,.78,.28,stone);rig.arms.push(arm);f.box(g,s*.5,.52,.02,.3,.2,.32,dark);}
    f.ball(g,-.34,1.46,0,.22,.08,.2,moss);f.ball(g,.3,1.42,-.05,.16,.06,.16,moss);f.ball(g,0,1.45,-.22,.2,.06,.14,moss);f.ball(g,.15,.7,.24,.1,.05,.08,moss);
    legPair(f,g,rig.legs,[-.2,.2],[0],.3,.62,.34,dark,.31);
  },
  'ash-wolf'(f,g,rig){
    const fur='#4b4e54',ash='#c9c6bd',eye='#d7ecff';
    f.ball(g,0,.62,0,.26,.3,.52,fur);f.ball(g,0,.78,.28,.28,.22,.24,'#3a3d43');
    const head=f.group();head.position.set(0,.82,.58);g.add(head);rig.head=head;
    f.ball(head,0,0,0,.2,.2,.24,fur);f.ball(head,0,-.04,.24,.12,.1,.2,ash);f.ball(head,0,-.02,.4,.05,.04,.04,'#111');
    for(const s of [-1,1]){const ear=f.mesh(head,'cone',s*.11,.22,-.04,.07,.24,.05,f.mat(fur));ear.rotation.z=-s*.12;f.ball(head,s*.09,.05,.17,.03,.03,.02,eye).material=glow(f,eye,'#9ac8ff',1.1);}
    rig.tail=f.mesh(g,'cone',0,.7,-.62,.1,.6,.09,f.mat('#3a3d43'));rig.tail.rotation.x=-1.25;
    legPair(f,g,rig.legs,[-.15,.15],[-.34,.36],.1,.5,.11,'#3a3d43',.25);
  },
  'thorn-boar'(f,g,rig){
    const hide='#6b4a33',dark='#2f2018',snout='#c98f84';
    f.ball(g,0,.62,0,.36,.38,.56,hide);f.ball(g,0,.82,.34,.3,.3,.26,hide);
    const head=f.group();head.position.set(0,.66,.66);g.add(head);rig.head=head;
    f.ball(head,0,0,0,.24,.24,.26,hide);f.mesh(head,'cylinder',0,-.04,.26,.12,.09,.1,f.mat(snout)).rotation.x=Math.PI/2;
    for(const s of [-1,1]){const tusk=f.mesh(head,'cone',s*.13,-.1,.26,.035,.22,.035,f.mat('#efe6cc'));tusk.rotation.z=-s*.5;tusk.rotation.x=-.3;f.ball(head,s*.11,.08,.2,.03,.03,.02,'#ffcf6a');const ear=f.mesh(head,'cone',s*.17,.2,-.06,.07,.18,.05,f.mat(dark));ear.rotation.z=-s*.5;}
    for(let i=0;i<6;i++){const sp=f.mesh(g,'cone',((i%2)-.5)*.16,1.0-Math.abs(i-2.5)*.03,-.3+i*.12,.045,.2,.045,f.mat(dark));sp.rotation.x=-.2;}
    rig.tail=f.mesh(g,'cone',0,.7,-.58,.04,.2,.04,f.mat(dark));rig.tail.rotation.x=-.7;
    legPair(f,g,rig.legs,[-.2,.2],[-.3,.34],.14,.4,.15,dark,.2);
  },
  'dusk-lynx'(f,g,rig){
    const fur='#9a7a5c',dark='#2a2018',cream='#e6d5b8';
    f.ball(g,0,.66,0,.2,.24,.5,fur);f.ball(g,0,.55,.1,.14,.16,.3,cream);
    for(let i=0;i<5;i++)f.ball(g,((i%2)-.5)*.22,.8,-.3+i*.17,.05,.03,.05,dark);
    const head=f.group();head.position.set(0,.86,.56);g.add(head);rig.head=head;
    f.ball(head,0,0,0,.17,.16,.17,fur);f.ball(head,0,-.05,.13,.08,.06,.08,cream);f.ball(head,0,-.02,.2,.03,.03,.02,'#e89a96');
    for(const s of [-1,1]){const ear=f.mesh(head,'cone',s*.1,.18,-.02,.055,.2,.045,f.mat(fur));f.mesh(head,'cone',s*.1,.32,-.02,.02,.1,.02,f.mat(dark));f.ball(head,s*.07,.04,.145,.035,.04,.02,'#ffd24a').material=glow(f,'#ffd24a','#d9a21c',1);f.mesh(head,'cone',s*.17,-.08,.03,.04,.14,.03,f.mat(cream)).rotation.z=s*.9;}
    rig.tail=f.mesh(g,'cone',0,.62,-.52,.06,.38,.06,f.mat(fur));rig.tail.rotation.x=-1.0;f.ball(g,0,.5,-.82,.06,.06,.06,dark);
    legPair(f,g,rig.legs,[-.11,.11],[-.32,.34],.08,.52,.09,fur,.26);
  },
  'gale-hawk'(f,g,rig){
    const brown='#7c5a36',cream='#e8d9b8',gold='#e0b84a';
    f.ball(g,0,1.05,0,.18,.2,.34,brown);f.ball(g,0,1.0,.1,.13,.15,.22,cream);
    const head=f.group();head.position.set(0,1.2,.3);g.add(head);rig.head=head;
    f.ball(head,0,0,0,.12,.12,.12,brown);f.ball(head,0,-.03,.06,.07,.05,.06,cream);
    const beak=f.mesh(head,'cone',0,-.03,.17,.035,.14,.035,f.mat(gold));beak.rotation.x=Math.PI/2;
    for(const s of [-1,1])f.ball(head,s*.065,.02,.075,.025,.025,.015,'#1c1208');
    for(const s of [-1,1]){const wing=f.group();wing.position.set(s*.16,1.1,.02);g.add(wing);f.box(wing,s*.3,0,0,.6,.04,.34,brown);f.box(wing,s*.62,0,-.04,.3,.03,.26,'#5a4126');f.box(wing,s*.3,-.03,-.02,.5,.02,.14,cream);rig.wings.push(wing);}
    const tail=f.box(g,0,1.0,-.42,.26,.03,.3,'#5a4126');tail.rotation.x=.15;rig.tail=tail;
    for(const s of [-1,1])f.box(g,s*.06,.82,.06,.025,.18,.025,gold);
    rig.hover=.55;
  }
};
export function createCompanion(f,a){
  const root=f.group(),rig={legs:[],arms:[],wings:[],tails:[],head:null,tail:null,weapon:null,orb:null,hover:0};
  (builders[a.kind]||builders['ash-wolf'])(f,root,rig);
  rig.kind=a.kind;rig.perk=COMPANIONS[a.kind]?.perk||'';
  root.userData.companionRig=rig;root.userData.limbs=rig.legs;
  const size=COMPANIONS[a.kind]?.size||.4;root.userData.size=size;
  return root;
}
// Walk cycle, hover, wing beats and an attack lunge driven by the shared motion state.
export function animateCompanion(root,m,a){
  const rig=root.userData.companionRig,t=m.clock,blend=a.fallen?0:m.blend;
  root.rotation.y=m.facing;
  const swing=Math.sin(m.phase)*.55*blend;
  rig.legs.forEach((l,i)=>{l.rotation.x=(i%2?-1:1)*swing;});
  rig.arms.forEach((l,i)=>{l.rotation.x=(i%2?1:-1)*swing*.6;});
  if(rig.tail)rig.tail.rotation.z=Math.sin(t*3.2)*.18*(1-blend)+Math.sin(m.phase)*.12*blend;
  rig.tails.forEach((x,i)=>{x.rotation.z=Math.sin(t*4+i*1.7)*.25;});
  const lunge=Math.sin(Math.min(1,m.attack)*Math.PI),bob=rig.hover?Math.sin(t*2.4+a.x)*.06+rig.hover:Math.abs(Math.sin(m.phase))*.04*blend;
  const fwd=lunge*(rig.perk==='flare'||rig.perk==='chill'||rig.perk==='dive'?.08:.3);
  root.position.x+=Math.sin(m.facing)*fwd;root.position.z+=Math.cos(m.facing)*fwd;root.position.y+=bob;
  if(rig.head)rig.head.rotation.x=lunge*.45+Math.sin(t*1.3+a.x)*.04;
  if(rig.weapon)rig.weapon.rotation.x=-lunge*1.1;
  for(const [i,w] of rig.wings.entries()){const side=i?1:-1,flap=blend>.15||rig.hover?Math.sin(t*(rig.hover?11:6))*.55:.1;w.rotation.z=side*(flap+.1);}
  if(rig.orb){const s=1+lunge*.35+Math.sin(t*3)*.05;rig.orb.scale.set(.3*s,.34*s,.3*s);}
  root.scale.setScalar(a.fallen?.01:1);
}
