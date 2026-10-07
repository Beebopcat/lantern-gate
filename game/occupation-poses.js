// Distinct work cycles act on the existing skeleton. Tools remain attached to the hand joint.
export function animateOccupation(rig,activity,time){
 if(!activity?.working)return;
 const t=time+rig.seed*.173,a=rig.arms[1],b=rig.arms[0],q=activity.animation,pulse=Math.sin(t*2.7);
 switch(q){
  case 'hammer':case 'pick':a.shoulder.rotation.x=-.65+Math.sin(t*4.2)*.75;a.elbow.rotation.x=-.8+Math.cos(t*4.2)*.33;b.shoulder.rotation.x=-.43;rig.spine.rotation.x=.12+Math.max(0,Math.cos(t*4.2))*.045;break;
  case 'knead':case 'grind':rig.spine.rotation.x=.13;for(const [i,arm]of rig.arms.entries()){arm.shoulder.rotation.x=-.73+Math.sin(t*3+i*.7)*.10;arm.elbow.rotation.x=-.57+Math.cos(t*3+i*.7)*.12;}break;
  case 'read':case 'write':b.shoulder.rotation.x=-.50;b.elbow.rotation.x=-.98;a.shoulder.rotation.x=-.49;a.elbow.rotation.x=-.84+(q==='write'?Math.sin(t*6)*.075:0);rig.head.rotation.x=.14;break;
  case 'reach':a.shoulder.rotation.x=-1.14+Math.sin(t*1.6)*.31;a.elbow.rotation.x=-.38;rig.head.rotation.x=-.05;break;
  case 'serve':b.shoulder.rotation.x=-.74;b.elbow.rotation.x=-.82;a.shoulder.rotation.x=-.68+pulse*.21;a.elbow.rotation.x=-.56;break;
  case 'inspect':for(const arm of rig.arms){arm.shoulder.rotation.x=-.47;arm.elbow.rotation.x=-1.14;}rig.head.rotation.x=.11;rig.head.rotation.y=Math.sin(t*.8)*.13;break;
  case 'hoe':case 'sweep':case 'stoke':rig.spine.rotation.x=.11;for(const [i,arm]of rig.arms.entries()){arm.shoulder.rotation.x=-.75+pulse*.30;arm.elbow.rotation.x=-.52-i*.22;}rig.spine.rotation.y=Math.sin(t*2.7)*.07;break;
  case 'harvest':a.shoulder.rotation.x=-.42+pulse*.19;a.elbow.rotation.x=-.69;b.shoulder.rotation.x=-.51;b.elbow.rotation.x=-1.02;rig.spine.rotation.x=.22+Math.sin(t*1.35)*.05;break;
  case 'pour':a.shoulder.rotation.x=-.74;a.elbow.rotation.x=-.52;a.wrist.rotation.z=-.48+Math.sin(t*1.4)*.13;b.shoulder.rotation.x=-.31;rig.spine.rotation.x=.09;break;
  case 'tend':a.shoulder.rotation.x=-.62+Math.sin(t*1.5)*.14;a.elbow.rotation.x=-.46;b.shoulder.rotation.x=-.53;b.elbow.rotation.x=-.77;rig.head.rotation.x=.13;break;
  case 'pray':for(const [i,arm]of rig.arms.entries()){arm.shoulder.rotation.x=-.41;arm.shoulder.rotation.z=(i?1:-1)*.12;arm.elbow.rotation.x=-1.45;}rig.head.rotation.x=.21;break;
  case 'gesture':a.shoulder.rotation.x=-.72+Math.sin(t*1.7)*.12;a.elbow.rotation.x=-.86;a.wrist.rotation.z=Math.sin(t*2.4)*.10;break;
  case 'watch':rig.head.rotation.y=Math.sin(t*.27)*.34;break;
 }
}
