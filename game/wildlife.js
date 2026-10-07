import {worldClock,worldMinute,worldWeather} from './world-conditions.js';
import * as THREE from './vendor/three.js';
import {hash} from './world.js';
// A fixed flock reuses the existing primitive meshes/materials. It adds no world
// actors, path searches, texture downloads or per-frame objects.
export class Wildlife{
 constructor(factory,scene){
  this.root=factory.group();this.clock=0;this.root.name='Local songbirds';this.birds=[];
  for(let i=0;i<4;i++){
   const g=factory.group(),color=['#42646a','#6c563d','#5b697e','#775342'][i];
   factory.ball(g,0,0,0,.16,.10,.25,color);factory.ball(g,0,.09,-.17,.105,.10,.11,color);
   factory.ball(g,0,.06,-.29,.035,.027,.09,'#cb9e56');
   factory.ball(g,0,-.015,.25,.10,.028,.16,color);
   const wings=[-1,1].map(side=>{const pivot=factory.group();pivot.position.x=side*.1;factory.ball(pivot,side*.25,0,.04,.31,.024,.17,color);g.add(pivot);return pivot;});
   this.root.add(g);this.birds.push({g,wings,phase:hash(i,451)*Math.PI*2});
  }
  this.parts=[];this.root.traverse(o=>{if(o.isMesh)this.parts.push(o);});
  this.mesh=new THREE.InstancedMesh(this.parts[0].geometry,factory.mat('#ffffff'),this.parts.length);
  this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.parts.forEach((part,i)=>this.mesh.setColorAt(i,part.material.color));scene.add(this.mesh);
 }
 update(s,dt,active,light){
  this.mesh.visible=s.player.map==='overworld'&&!light.night&&worldWeather(s)!=='rain'&&worldWeather(s)!=='snow';
  if(!this.mesh.visible)return;
  if(active)this.clock+=dt;
  const cx=Math.floor(s.player.x/32)*32+16,cy=Math.floor(s.player.y/32)*32+16;
  for(let i=0;i<this.birds.length;i++){
   const {g,wings,phase}=this.birds[i],a=this.clock*(.10+i*.007)+phase,r=8+i*2;
   g.position.set(cx+Math.cos(a)*r,6+i*.7+Math.sin(a*3)*.35,cy+Math.sin(a)*r*.65);
   g.rotation.y=Math.atan2(Math.sin(a)*r,-Math.cos(a)*r*.65);
   const flap=Math.sin(this.clock*8+i)*.48;wings[0].rotation.z=flap;wings[1].rotation.z=-flap;
  }
  this.root.updateMatrixWorld(true);for(let i=0;i<this.parts.length;i++)this.mesh.setMatrixAt(i,this.parts[i].matrixWorld);
  this.mesh.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();}
}
