export function thirdPersonPosition({x,y,angle,pitch=.32,distance=7,blocked=()=>false}){
  pitch=Math.max(.12,Math.min(.95,pitch));distance=Math.max(2,Math.min(10,distance));
  let clear=.22;
  for(let d=.4;d<=distance;d+=.18){const xx=x+Math.sin(angle)*d,yy=y+Math.cos(angle)*d;
    if([-.24,0,.24].some(o=>blocked(xx+Math.cos(angle)*o,yy-Math.sin(angle)*o)))break;clear=d;
  }
  return {x:x+Math.sin(angle)*clear,y:1.45+Math.sin(pitch)*clear,z:y+Math.cos(angle)*clear,distance:clear};
}
