export const CASTLE = {id:'dracula', name:'Dracula’s Castle', region:'The Mourning Crown', x:263, y:61, radius:25};
export const FLOORS = ['The Ossuary & Laboratory','The Candleless Galleries','The Wolf Court','The Astral Throne'];
export const CASTLE_LORE = [
 'The keepers did not offer Dracula blood. They offered him the names of those the river would take. The laboratory below his court tried to return a body to every stolen name.',
 'The Wolf Man guarded the keepers before the bargain. Each bell stroke now calls him to a different road. Sever the bell’s silver tether, or the next hunt will begin again.',
 'Frankenstein remembers hands teaching him to plant an apple seed. The count calls this an error in his construction. The creature calls it a reason to live.',
 'Dracula keeps the missing names in an astronomical ledger. His court has no sunrise. The Gate can be repaired only if the names are returned to the people who lost them.'
];
export function installCastle({T,MAPS,SITES,PORTALS,PROPS,BUILDINGS,TOWNS}) {
  if(MAPS['dracula-1'])return;
  const surface=MAPS.overworld;
  // Put the entrance on the closest existing road. No road segment is added.
  let best=null;
  for(let y=22;y<144;y++)for(let x=200;x<345;x++)if([T.path,T.bridge,T.stone].includes(surface.tiles[y*surface.w+x])){
    if(TOWNS.some(t=>Math.hypot(t.x-x,t.y-y)<65)||BUILDINGS.some(b=>x+12>b.x&&x-12<b.x+b.w&&y>b.y&&y-22<b.y+b.h))continue;
    const d=Math.hypot(x-CASTLE.x,y-CASTLE.y);if(!best||d<best.d)best={x,y,d};
  }
  if(!best)throw Error('No existing road with a clear castle footprint was found.');
  CASTLE.x=best.x;CASTLE.y=best.y;
  SITES.push({id:CASTLE.id,name:CASTLE.name,x:CASTLE.x,y:CASTLE.y,kind:'castle',enemy:'zombie',lore:CASTLE_LORE[0],levels:4,region:CASTLE.region});
  PORTALS.push({id:'entry-dracula',map:'overworld',x:CASTLE.x,y:CASTLE.y,to:'dracula-1',tx:40,ty:73,name:CASTLE.name,kind:'entrance'});
  const layouts=[
    [[7,7,22,22],[49,8,23,20],[8,45,24,21],[48,43,24,25],[30,28,19,24]],
    [[8,9,22,17],[48,7,24,25],[8,44,25,23],[47,49,25,18],[30,29,20,20]],
    [[6,6,27,25],[48,8,24,20],[8,48,21,20],[45,40,28,29],[31,30,18,15]],
    [[8,8,23,22],[48,9,22,21],[6,44,27,24],[49,46,22,23],[28,27,24,25]]
  ];
  for(let level=1;level<=4;level++){
    const id=`dracula-${level}`,w=80,h=80,tiles=new Uint8Array(w*h).fill(T.wall),rooms=layouts[level-1];
    const dig=(x,y)=>{if(x>1&&y>1&&x<w-2&&y<h-2)tiles[y*w+x]=level===1?T.stone:T.floor;};
    for(const [x,y,rw,rh]of rooms)for(let yy=y;yy<y+rh;yy++)for(let xx=x;xx<x+rw;xx++)dig(xx,yy);
    const centers=rooms.map(([x,y,rw,rh])=>({x:Math.floor(x+rw/2),y:Math.floor(y+rh/2)}));
    const corridor=(a,b)=>{let {x,y}=a;while(x!==b.x){for(let o=-1;o<=1;o++)dig(x,y+o);x+=Math.sign(b.x-x);}while(y!==b.y){for(let o=-1;o<=1;o++)dig(x+o,y);y+=Math.sign(b.y-y);}dig(x,y);};
    for(let i=0;i<4;i++)corridor(centers[i],centers[4]);
    corridor({x:40,y:73},centers[4]);corridor({x:69,y:12},centers[1]);
    MAPS[id]={id,name:`${CASTLE.name} · ${FLOORS[level-1]}`,w,h,tiles,site:'dracula',level,outdoor:false,castle:true,rooms};
    PORTALS.push({id:id+'-up',map:id,x:40,y:73,to:level===1?'overworld':`dracula-${level-1}`,tx:level===1?CASTLE.x:69,ty:level===1?CASTLE.y:12,name:level===1?'Return to the Mourning Crown':FLOORS[level-2],kind:'stairsUp'});
    if(level<4)PORTALS.push({id:id+'-down',map:id,x:69,y:12,to:`dracula-${level+1}`,tx:40,ty:73,name:'Ascend to '+FLOORS[level],kind:'stairsDown'});
    const furnishings=level===1?['alchemy','bookcase','grave','anvil']:level===2?['table','bookcase','brazier','bed']:level===3?['bare','grave','barrels','brazier']:['beacon','bookcase','table','crystal'];
    for(let i=0;i<4;i++){
      const c=centers[i];PROPS.push({id:id+'-record-'+i,type:'bookcase',name:['The drowned names','The keeper’s bargain','An unfinished creation','A bell without a clapper'][i],map:id,x:c.x,y:c.y,text:CASTLE_LORE[i]});
      for(let j=0;j<3;j++)PROPS.push({id:id+'-furn-'+i+'-'+j,type:furnishings[(i+j)%4],name:'Castle '+furnishings[(i+j)%4],map:id,x:c.x-5+j*3,y:c.y-5,text:CASTLE_LORE[i]});
    }
  }
}
