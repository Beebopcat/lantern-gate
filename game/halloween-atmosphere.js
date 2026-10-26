import * as THREE from './vendor/three.js';
const clamp=n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
export function atmosphereFog({outdoor=true,mist=false,castle=false,raidFog=0,focusDistance=0}){
 const amount=clamp(raidFog),near=castle?11:outdoor&&mist?24:52,far=castle?35:outdoor&&mist?58:86;
 const requestedNear=near+((outdoor?4:8)-near)*amount,requestedFar=far+((outdoor?23:35)-far)*amount;
 // Fog is measured from the camera. Keep the player and nearby interactions
 // clear even when the isometric camera sits behind the old far threshold.
 const focus=Number.isFinite(focusDistance)?Math.max(0,focusDistance):0;
 const clearNear=Math.max(requestedNear,focus+10);
 return {near:clearNear,far:clearNear+(requestedFar-requestedNear),amount};
}
// Three transparent, shared planes simulate low drifting fog without new textures or particle allocations.
export function createRaidFog(){
 const uniforms={fogTime:{value:0},fogAmount:{value:0},fogTint:{value:new THREE.Color('#929aa0')}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:'varying vec2 uvFog; void main(){uvFog=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform float fogTime;uniform float fogAmount;uniform vec3 fogTint;varying vec2 uvFog;
  float hashFog(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noiseFog(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hashFog(i),hashFog(i+vec2(1,0)),f.x),mix(hashFog(i+vec2(0,1)),hashFog(i+vec2(1,1)),f.x),f.y);}
  void main(){vec2 drift=vec2(fogTime*.047,-fogTime*.024);float n=noiseFog(uvFog*9.0+drift)*.64+noiseFog(uvFog*19.0-drift*.7)*.36;vec2 edge=smoothstep(vec2(0),vec2(.20),uvFog)*smoothstep(vec2(0),vec2(.20),vec2(1)-uvFog);float nearPlayer=smoothstep(.04,.16,length(uvFog-vec2(.5)));float alpha=smoothstep(.28,.78,n)*edge.x*edge.y*.19*fogAmount*mix(.24,1.0,nearPlayer);gl_FragColor=vec4(fogTint,alpha);}`});
 const geometry=new THREE.PlaneGeometry(64,64),root=new THREE.Group();
 for(const y of [.28,.74,1.14]){const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.rotation.z=y*2.7;mesh.position.y=y;mesh.renderOrder=3;root.add(mesh);}root.visible=false;
 return {root,uniforms,dispose(){geometry.dispose();material.dispose();}};
}
