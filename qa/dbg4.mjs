const R='/home/claude/game';
const E=await import(R+'/engine.js'),J=await import(R+'/journey.js'),G=await import(R+'/companions.js'),L=await import(R+'/life.js'),W=await import(R+'/world.js');
const s=E.fresh(1e12);L.upgrade(s);J.upgrade(s);J.create(s,{name:'T',classId:'ranger',companionId:'ash-wolf'});
const wolf=E.fresh(1e12).enemies.find(e=>e.kind==='wolf');let spot;for(let x=40;x<330&&!spot;x+=3)for(let y=40;y<330&&!spot;y+=3){let g=true;for(let dx=-9;dx<=9&&g;dx++)for(let dy=-9;dy<=9;dy++)if(W.solid('overworld',x+dx,y+dy)){g=false;break;}if(g)spot={x:x+.5,y:y+.5};}
s.enemies=[{...JSON.parse(JSON.stringify(wolf)),id:'hunter',map:'overworld',x:spot.x+8,y:spot.y,home:{x:spot.x+8,y:spot.y},hp:40,maxHp:40,deadUntil:0,cd:0}];s.player.x=spot.x;s.player.y=spot.y;G.snap(s);
console.log('kills0',s.kills,s.player.xp);let t=1e12;for(let i=0;i<30*40;i++){t+=33;E.tick(s,1/30,t);if(s.enemies[0].deadUntil){console.log('dead at',i/30,'kills',s.kills,'xp',s.player.xp,'hp',s.player.hp);break;}}
console.log(s.kills,Object.keys(s).filter(k=>/kill/i.test(k)));
console.log(JSON.stringify({g:{...s.guardian,path:undefined},e:{x:s.enemies[0].x,y:s.enemies[0].y,hp:s.enemies[0].hp,dead:s.enemies[0].deadUntil},p:{x:s.player.x,y:s.player.y,hp:s.player.hp,dead:s.player.deadUntil}}));
const e=s.enemies[0];console.log('hostile',G.hostile(s,s.guardian,e),'dist',Math.hypot(e.x-s.player.x,e.y-s.player.y),'map',e.map,s.guardian.map,'spawnAt',e.spawnAt,'elapsed',s.elapsed,'type',e.type,'fleeing',e.fleeing,'expired',e.expired,'kind',e.kind);
console.log(G.chooseTarget(s,s.guardian,s.player)?.id);
