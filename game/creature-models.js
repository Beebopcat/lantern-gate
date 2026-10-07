import {createWerewolf} from './werewolf.js';
// Art-direction blockouts. These are animated 3D meshes, not concept-art billboards.
// Production sculpt, retopology, texture and skinning work remains necessary.
export function createCreature(f,a){
 const root=createWerewolf(f,a),r=root.userData.wolfRig;
 root.userData.creatureKind=a.kind;
 if(a.kind==='drowned-sexton'){
  root.scale.set(.94,1.04,1.08);r.head.scale.set(.91,1,1.12);r.arms[0].arm.position.y+=.13;r.arms[1].elbow.scale.y=1.12;
  root.userData.creaturePose={lean:.12,twist:.14,jaw:.18,head:-.08};
 }else if(a.kind==='hollow-cantor'){
  root.scale.set(.87,1.14,.90);r.head.position.y+=.14;r.jaw.scale.y=1.35;
  root.userData.creaturePose={lean:.10,twist:-.035,jaw:.68,head:.09};
 }else{
  root.scale.set(.91,1.02,.94);r.head.scale.set(.83,.98,.72);
  f.ball(r.torso,0,.44,-.02,.39,.56,.24,'#282c33');
  const skirt=f.mesh(r.torso,'cone',0,-.53,-.02,.56,1.94,.40,f.mat('#20252c'));skirt.rotation.z=0;
  for(const arm of r.arms)f.ball(arm.arm,0,-.26,0,.15,.43,.14,'#30313a');
  f.ball(r.head,0,.26,-.11,.23,.32,.20,'#242931');
  root.userData.creaturePose={lean:.22,twist:-.11,jaw:.20,head:-.17};
 }
 return root;
}
