import {CASTLE} from './castle-data.js';
export function castleModel(f,cut=false){
  const g=f.group(),stone='#657078',dark='#303b44',gold='#a8845a';
  const window=(x,y,z)=>{f.box(g,x,y,z,.54,1.8,.12,'#451f2e');for(const side of [-1,1])f.box(g,x+side*.32,y,z,.1,2.0,.23,stone,5);f.mesh(g,'cone',x,y+1.05,z,.45,.6,.17,f.mat(stone));f.box(g,x,y,z+.09,.055,1.8,.05,gold);};
  f.box(g,0,.4,-9,22,.8,19,dark,5);
  for(const [x,z,r,h]of [[-9,-1,1.6,13],[9,-2,1.9,15],[-8,-16,2.3,19],[8,-17,1.8,17]]){
    f.cyl(g,x,h/2,z,r,h,stone,5);f.cyl(g,x,h-1,z,r*1.15,.6,dark,5);f.mesh(g,'cone',x,h+2.1,z,r*1.35,5,r*1.35,f.mat(dark,13));
    for(let y=3;y<h-2;y+=3.4)window(x,y,z+r+.04);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;f.box(g,x+Math.sin(a)*r,h-.2,z+Math.cos(a)*r,.38,.75,.38,stone,5);}
  }
  f.box(g,0,7,-13,15,14,9,stone,5);f.box(g,0,5.5,-5,15,11,7,stone,5);
  for(let y=2.5;y<13;y+=3.2)for(const x of [-5,-2,2,5])window(x,y,y<11?-1.43:-8.43);
  for(const x of [-6,-3,0,3,6]){f.box(g,x,6,-.92,.38,12,1.1,dark,5);f.mesh(g,'cone',x,13,-.9,.45,2,.45,f.mat(dark));}
  f.box(g,0,1.8,.55,3.3,3.4,.25,'#151d26');for(const side of [-1,1])f.box(g,side*1.75,2,.7,.4,4,1,stone,5);f.mesh(g,'cone',0,4,.7,2,1.5,.7,f.mat(stone));
  for(let i=0;i<8;i++)f.box(g,0,.06+i*.1,2.3-i*.23,4,.14+i*.13,.3,stone,5);
  for(const x of [-7,7])for(let i=0;i<4;i++)f.box(g,x,6,-6-i*2,.7,12,.7,dark,5);
  if(cut)g.traverse(o=>{if(o.isMesh)o.material=f.mat('#6d7880',5,{transparent:true,opacity:.28,depthWrite:false});});
  g.position.set(CASTLE.x,0,CASTLE.y);return g;
}
