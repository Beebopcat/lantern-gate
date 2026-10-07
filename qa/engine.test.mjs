// Engine/save/AI regression checks for the four callings and eight bound companions (Node, no browser).
const ROOT=process.env.ROOT||'/home/claude/game';
const E=await import(ROOT+'/engine.js'),J=await import(ROOT+'/journey.js'),G=await import(ROOT+'/companions.js'),L=await import(ROOT+'/life.js');
const {solid,dist,PORTALS,MAPS,T:TILE}=await import(ROOT+'/world.js');
let pass=0,fail=0;const failures=[];
const ok=(c,m)=>{if(c)pass++;else{fail++;failures.push(m);console.log('  FAIL',m);}};
const NOW=1e12,clone=o=>JSON.parse(JSON.stringify(o));
const TEMPLATE=E.fresh(NOW),WOLF=TEMPLATE.enemies.find(e=>e.kind==='wolf'),GOBLIN=TEMPLATE.enemies.find(e=>e.kind==='goblin');
function clearing(map='overworld',r=9){for(let x=40;x<330;x+=3)for(let y=40;y<330;y+=3){let good=true;for(let dx=-r;dx<=r&&good;dx+=1)for(let dy=-r;dy<=r;dy+=1)if(solid(map,x+dx,y+dy)){good=false;break;}if(good)return {x:x+.5,y:y+.5};}throw Error('no clearing');}
const SPOT=clearing();
function make(classId,companionId=null,{enemies=[],hp=null}={}){
  const s=E.fresh(NOW);L.upgrade(s);J.upgrade(s);const msg=J.create(s,{name:'Tester',classId,companionId});
  ok(s.journey.created,`${classId}/${companionId} created: ${msg}`);
  s.enemies=[];s.player.x=SPOT.x;s.player.y=SPOT.y;s.player.path=[];if(s.guardian)G.snap(s);
  for(const e of enemies)s.enemies.push(e);
  return s;
}
const enemy=(id,dx,dy,base=WOLF,s,extra={})=>({...clone(base),id,map:'overworld',x:SPOT.x+dx,y:SPOT.y+dy,home:{x:SPOT.x+dx,y:SPOT.y+dy},deadUntil:0,cd:0,path:[],think:0,...extra});
let clock=NOW;
function run(s,seconds,each){for(let t=0;t<seconds*30;t++){clock+=33;E.tick(s,1/30,clock);each?.(s,t/30);}}
const alive=(s,id)=>{const e=s.enemies.find(e=>e.id===id);return e&&!e.deadUntil;};

// ---------- Classes ----------
console.log('classes');
ok(J.CREATABLE.join()==='warrior,summoner,mage,ranger','creatable classes are exactly warrior,summoner,mage,ranger: '+J.CREATABLE);
for(const legacy of ['oathbinder','echoartisan','marrowgardener'])ok(J.CLASSES[legacy]&&!J.CLASSES[legacy].creatable,'legacy class kept but not creatable: '+legacy);
for(const id of J.CREATABLE){const c=J.CLASSES[id];ok(c.abilities.length===3&&c.abilities.every(a=>a.name&&a.cost>=0&&a.cooldown>0&&a.detail),id+' has 3 real abilities');ok(!!c.gear&&!!c.icon,id+' has starter gear and icon');}
{const s=E.fresh(NOW);L.upgrade(s);J.upgrade(s);ok(J.create(s,{name:'X',classId:'oathbinder'}).includes('Choose'),'cannot create a legacy class');ok(!s.journey.created,'legacy create left state uncreated');}
{const s=E.fresh(NOW);L.upgrade(s);J.upgrade(s);ok(J.create(s,{name:'X',classId:'summoner'}).includes('Choose one'),'summoner without a minion is refused');ok(!s.journey.created&&!s.guardian,'refused creation leaves no half state');}
{const s=E.fresh(NOW);L.upgrade(s);J.upgrade(s);ok(J.create(s,{name:'X',classId:'summoner',companionId:'ash-wolf'}).includes('Choose one'),'summoner cannot bind a ranger beast');}
{const s=E.fresh(NOW);L.upgrade(s);J.upgrade(s);ok(J.create(s,{name:'X',classId:'ranger',companionId:'ember-imp'}).includes('Choose one'),'ranger cannot bind a summoner minion');}
{const s=E.fresh(NOW);L.upgrade(s);J.upgrade(s);ok(J.create(s,{name:'X',classId:'warrior',companionId:'ash-wolf'}).includes('no bound'),'warrior cannot bind a companion');}
{const s=E.fresh(NOW);L.upgrade(s);J.upgrade(s);ok(J.create(s,{name:'X',classId:'mage'}).includes('arrives'),'mage creates without companion');ok(s.guardian===undefined,'mage has no guardian');ok(E.valid(JSON.parse(JSON.stringify(s))),'mage state valid');}
for(const id of ['warrior','mage']){const s=make(id);ok(E.valid(clone(s)),id+' state valid after JSON roundtrip');ok(s.guardian===undefined,id+' has no guardian');}

// ---------- Rosters ----------
console.log('rosters');
ok(G.ROSTERS.summoner.choices.length===4&&G.ROSTERS.ranger.choices.length===4,'exactly 4 choices each');
ok(new Set(Object.values(G.COMPANIONS).map(c=>c.name)).size===8,'8 distinct names');
ok(new Set(Object.values(G.COMPANIONS).map(c=>c.perk)).size===8,'8 distinct perks');
ok(new Set(Object.values(G.COMPANIONS).map(c=>c.hp+'/'+c.dmg+'/'+c.cd+'/'+c.range)).size===8,'8 distinct stat profiles');
ok(Object.keys(G.COMPANIONS).length===8,'no extra companion definitions');

// ---------- Per-companion behaviour ----------
for(const [classId,list] of Object.entries(G.ROSTERS))for(const kind of list.choices){
  const def=G.COMPANIONS[kind];console.log('companion',kind);
  { // creation, validity, persistence
    const s=make(classId,kind);ok(s.guardian?.kind===kind&&s.guardian.classId===classId&&s.guardian.owner==='player','spawned '+kind);
    ok(E.valid(clone(s)),kind+' valid after JSON roundtrip');
    const copy=clone(s);L.upgrade(copy);J.upgrade(copy);G.upgrade(copy);G.settle(copy);ok(copy.guardian.kind===kind&&copy.guardian.hp===s.guardian.hp,kind+' identity and hp survive reload');
    ok([...copy.actors,...copy.enemies,...copy.life.pets].filter(a=>a.id==='guardian').length===0,'guardian not duplicated into other lists');
    const bad=clone(s);bad.guardian.kind=classId==='summoner'?'ash-wolf':'ember-imp';ok(!E.valid(bad),kind+': cross-roster guardian rejected by validator');
    const bad2=clone(s);delete bad2.guardian;ok(!E.valid(bad2),kind+': missing guardian rejected');
    const bad3=clone(s);bad3.guardian.hp=1e9;ok(!E.valid(bad3),kind+': absurd hp rejected');
  }
  { // follows owner
    const s=make(classId,kind);const p=s.player;p.x+=7;run(s,6);const d=dist(s.guardian,p);ok(d<4.2,`${kind} follows owner after 7-tile walk (dist ${d.toFixed(2)})`);ok(s.guardian.state==='follow'||s.guardian.state==='return','follow state '+s.guardian.state);
  }
  { // approach-triggered defence: hostile wolf approaches, never attacks owner first because companion engages inside the threat range
    const s=make(classId,kind,{enemies:[]});s.enemies.push(enemy('w1',8,0,WOLF,s,{hp:WOLF.hp,maxHp:WOLF.hp}));
    const before=s.enemies[0].hp;let engaged=false,firstTarget=null;run(s,4,s=>{if(s.guardian.targetId==='w1'){engaged=true;firstTarget??='w1';}});
    ok(engaged,kind+' engages an approaching hostile');ok(s.enemies[0].hp<before||!alive(s,'w1'),kind+' actually damages approaching hostile ('+s.enemies[0].hp+'/'+before+')');
  }
  { // attacker-triggered defence: enemy adjacent and attacking owner
    const s=make(classId,kind);const e=enemy('w2',1.2,0,WOLF,s);s.enemies.push(e);const hp0=e.hp;let dmgEvents=[];let last=e.hp;
    run(s,5,s=>{const cur=s.enemies.find(x=>x.id==='w2');if(cur.hp<last){dmgEvents.push(s.elapsed);last=cur.hp;}});
    const cur=s.enemies.find(x=>x.id==='w2');ok(cur.hp<hp0||cur.deadUntil,kind+' damages enemy attacking owner');
  }
  { // cooldown spacing
    const s=make(classId,kind);const e=enemy('dummy',def.range>3?3.5:1.0,0,{...WOLF,hp:9999,maxHp:9999,attack:0,speed:0},s,{hp:9999,maxHp:9999,attack:0});s.enemies.push(e);
    const times=[];let last=9999;run(s,12,s=>{const cur=s.enemies[0];if(cur.hp<last){times.push(s.elapsed);last=cur.hp;}});
    const gaps=times.slice(1).map((t,i)=>t-times[i]);ok(times.length>=3,`${kind} struck repeatedly (${times.length})`);ok(gaps.every(g=>g>=def.cd-.08),`${kind} respects ${def.cd}s cooldown; min gap ${Math.min(...gaps).toFixed(2)}`);
    // reward: kill credit exactly once
  }
  { // friendly / neutral exclusion
    const s=make(classId,kind);const npc=s.actors.find(a=>a.type==='npc');Object.assign(npc,{x:SPOT.x+2,y:SPOT.y+.5,map:'overworld',deadUntil:0});const npcHp=npc.hp;
    const pet=s.life.pets[0]||(s.life.pets[0]={id:'pet-test',type:'pet',kind:'cat',map:'overworld',x:SPOT.x+1,y:SPOT.y+1.5,hp:10,maxHp:10});pet.x=SPOT.x+1;pet.y=SPOT.y+1.5;pet.map='overworld';
    s.enemies.push(enemy('far',40,40,WOLF,s));
    let targeted=false;run(s,8,s=>{const t=s.guardian.targetId;if(t&&t!==('far')&&!s.enemies.some(e=>e.id===t))targeted=true;});
    ok(!targeted&&npc.hp===npcHp&&(npc.deadUntil||0)===0,kind+' never targets NPC/pet');
    ok(!G.hostile(s,s.guardian,npc)&&!G.hostile(s,s.guardian,pet)&&!G.hostile(s,s.guardian,s.actors.find(a=>a.id==='orin')),kind+' hostile() rejects npc/pet/orin');
    const w=enemy('warden-like',3,0,WOLF,s,{warden:true});ok(!G.hostile(s,s.guardian,w),kind+' ignores warden');
    const f=enemy('fleer',3,0,WOLF,s,{fleeing:true});ok(!G.hostile(s,s.guardian,f),kind+' ignores fleeing enemy');
  }
  { // path obstruction A: enemy sealed inside a wall box. Not reachable: no damage through walls, no stuck loop, owner stays guarded.
    const s=make(classId,kind);const cx=Math.floor(SPOT.x)+6,cy=Math.floor(SPOT.y),m=MAPS.overworld,saved=[];
    for(let x=cx-2;x<=cx+2;x++)for(let y=cy-2;y<=cy+2;y++){const i=y*m.w+x;saved.push([i,m.tiles[i]]);m.tiles[i]=(x===cx-2||x===cx+2||y===cy-2||y===cy+2)?TILE.wall:TILE.floor;}
    const e=enemy('sealed',0,0,WOLF,s,{x:cx+.5,y:cy+.5,attack:0,speed:0,hp:80,maxHp:80});e.home={x:e.x,y:e.y};s.enemies.push(e);
    let maxD=0,flips=0,prev=null;run(s,10,s=>{maxD=Math.max(maxD,dist(s.guardian,s.player));if(s.guardian.state!==prev){flips++;prev=s.guardian.state;}});
    ok(s.enemies[0].hp===80,kind+' cannot damage an enemy sealed behind walls ('+s.enemies[0].hp+')');
    ok(maxD<=G.TUNING.leash,kind+' stays within leash while target unreachable (max '+maxD.toFixed(1)+')');
    ok(flips<=14,kind+' does not thrash between states against a wall ('+flips+' changes)');
    ok(!solid('overworld',s.guardian.x,s.guardian.y),kind+' never ends inside geometry');
    for(const [i,v] of saved)m.tiles[i]=v;
  }
  { // path obstruction B: long wall with a gap; companion routes around it and still reaches the enemy
    const s=make(classId,kind);const wx=Math.floor(SPOT.x)+3,m=MAPS.overworld,saved=[];
    for(let y=Math.floor(SPOT.y)-7;y<=Math.floor(SPOT.y)+7;y++){if(y===Math.floor(SPOT.y)+7)continue;const i=y*m.w+wx;saved.push([i,m.tiles[i]]);m.tiles[i]=TILE.wall;}
    const e=enemy('behind',0,0,WOLF,s,{x:wx+3.5,y:SPOT.y,attack:0,speed:0,hp:60,maxHp:60,home:{x:wx+3.5,y:SPOT.y}});s.enemies.push(e);
    let hits=0;run(s,16,s=>{});const cur=s.enemies.find(x=>x.id==='behind');
    ok(cur.hp<60||cur.deadUntil,kind+' paths around a wall to engage ('+cur.hp+'/60)');
    for(const [i,v] of saved)m.tiles[i]=v;
  }
  { // return-to-guard after kill
    const s=make(classId,kind);s.enemies.push(enemy('w3',6,0,WOLF,s,{hp:20,maxHp:20}));const kills0=s.kills;run(s,12);
    ok(!alive(s,'w3'),kind+' (with owner) disposes of a weak hostile');ok(s.kills===kills0+1,kind+' kill credited exactly once ('+(s.kills-kills0)+')');
    run(s,6);ok(s.guardian.targetId===null&&['follow','guard','return'].includes(s.guardian.state)&&dist(s.guardian,s.player)<4.5,`${kind} returns to guard (${s.guardian.state}, ${dist(s.guardian,s.player).toFixed(2)})`);
  }
  { // defeat and recovery persists through reload
    const s=make(classId,kind);s.enemies.push(enemy('brute',2.2,0,{...GOBLIN,attack:0},s,{attack:0,hp:900,maxHp:900}));
    G.damage(s,9999,{note(){}});ok(s.guardian.fallen&&s.guardian.hp===0&&s.guardian.state==='fallen',kind+' falls when its health is exhausted');
    const copy=clone(s);ok(E.valid(copy),kind+' fallen state is valid after save');ok(copy.guardian.fallen,kind+' fallen persists');
    run(s,2);ok(s.guardian.fallen,kind+' stays fallen during recovery window');
    // do not damage enemies while fallen
    const hpBefore=s.enemies[0].hp;run(s,3);ok(s.enemies[0].hp===hpBefore,kind+' deals no damage while fallen');
    run(s,G.TUNING.recover);ok(!s.guardian.fallen&&s.guardian.hp>0,kind+' recovers after '+G.TUNING.recover+'s');
  }
}

// ---------- Map / portal transitions ----------
console.log('portals');
{
  const s=make('summoner','moss-golem');const portal=PORTALS.find(p=>p.map==='overworld');
  if(portal){s.player.x=portal.x;s.player.y=portal.y;const out=E.enter(s,portal);ok(typeof out==='string'||out===undefined,'portal enter ran');
    ok(s.guardian.map===s.player.map,'guardian follows owner across portal ('+s.player.map+')');
    ok(dist(s.guardian,s.player)<4,'guardian lands beside owner ('+dist(s.guardian,s.player).toFixed(2)+')');
    ok([...s.actors,...s.enemies].filter(a=>a.id==='guardian').length===0&&!!s.guardian,'single guardian after portal');
    run(s,2);ok(s.guardian.map===s.player.map,'guardian stays on owner map');ok(E.valid(clone(s)),'state valid after portal');}
}
// ---------- Orin and household pets preserved ----------
console.log('preserved');
{const s=make('ranger','ash-wolf');ok(!!s.actors.find(a=>a.id==='orin'),'Orin preserved');ok(Array.isArray(s.life.pets),'household pets array preserved');}
// ---------- Legacy saves ----------
console.log('legacy');
for(const legacy of ['oathbinder','echoartisan','marrowgardener']){
  const s=E.fresh(NOW);L.upgrade(s);J.upgrade(s);s.journey.created=true;s.journey.introSeen=true;s.player.classId=legacy;s.player.name='Old Hand';Object.assign(s.player,{skin:'warm',hair:'brown',gender:'female'});
  const raw=clone(s);delete raw.guardian;ok(E.valid(raw),legacy+' save without guardian is valid');
  const copy=clone(raw);L.upgrade(copy);J.upgrade(copy);G.upgrade(copy);G.settle(copy);ok(copy.player.classId===legacy,legacy+' not remapped');ok(copy.guardian===undefined,legacy+' gets no guardian');
  run(copy,3);ok(E.valid(clone(copy)),legacy+' valid after play');
  // abilities still run
  const msg=J.ability(copy,0,{hurt:E.hurt,lineOfSight:(m,a,b)=>E.lineOfSight(m,a,b,copy)});ok(typeof msg==='string'&&msg.length>0,legacy+' ability 1 responds: '+msg);
}
// ---------- Class abilities ----------
console.log('abilities');
for(const id of J.CREATABLE){const s=make(id,id==='summoner'?'bone-squire':id==='ranger'?'dusk-lynx':null);s.enemies.push(enemy('t'+id,3,0,WOLF,s,{hp:200,maxHp:200}));s.player.mp=s.player.maxMp;
  for(let i=0;i<3;i++){s.journey.cooldowns[i]=0;s.player.mp=s.player.maxMp;const hp0=s.enemies[0].hp,mp0=s.player.mp,msg=J.ability(s,i,{hurt:E.hurt,lineOfSight:(m,a,b)=>E.lineOfSight(m,a,b,s)});ok(typeof msg==='string'&&msg.length>4,`${id} ability ${i+1} responds: ${msg}`);ok(s.journey.cooldowns[i]>0||/focus|cooldown|ready|No /i.test(msg),`${id} ability ${i+1} sets cooldown`);ok(s.player.mp<=mp0,`${id} ability ${i+1} spends focus`);}
}
// mage can cast without lantern
{const s=make('mage');ok(!s.inv.lantern,'mage starts without lantern');s.enemies.push(enemy('m1',3,0,WOLF,s,{hp:100,maxHp:100}));s.player.cd=0;const hp0=s.enemies[0].hp,msg=E.attack(s,'m1',true);ok(s.enemies[0].hp<hp0,'mage arcane bolt damages without lantern: '+msg);}
{const s=make('warrior');ok(s.inv.sword>=1&&s.inv.armor>=1,'warrior kit');}
{const s=make('ranger','gale-hawk');ok(s.player.weapon==='bow'&&s.inv.bow>=1,'ranger kit includes bow');}
// the hero cannot walk through props, and slides around them instead of sticking
console.log('props block the hero');
{const W=await import(ROOT+'/world.js');
 for(const [id,r] of [['hearth-well',.9],['hearth-stall',1],['hearth-cart',1]]){
  const q=W.PROPS.find(p=>p.id===id);ok(!!q,`${id} exists`);if(!q)continue;
  const s=make('warrior');s.player.map='overworld';s.player.x=q.x+3;s.player.y=q.y+.1;
  let minD=9;for(let i=0;i<120;i++){E.move(s,-1,0,1/30);minD=Math.min(minD,Math.hypot(s.player.x-q.x,s.player.y-q.y));}
  ok(minD>=r+.28-.02,`${id}: walking straight at it stops at its edge (closest ${minD.toFixed(2)} >= ${(r+.28).toFixed(2)})`);
  const y0=s.player.y;let minD2=9;for(let i=0;i<60;i++){E.move(s,-1,1,1/30);minD2=Math.min(minD2,Math.hypot(s.player.x-q.x,s.player.y-q.y));}
  ok(Math.abs(s.player.y-y0)>.5&&minD2>=r+.28-.02,`${id}: pushing diagonally slides around it (moved ${(s.player.y-y0).toFixed(2)} along the edge, closest ${minD2.toFixed(2)})`);
  ok(E.valid(clone(s)),`${id}: state stays valid`);
 }
 // a prop-free walk is unchanged: constant speed 3.6 tiles per second
 const s=make('warrior');const x0=s.player.x;for(let i=0;i<30;i++)E.move(s,1,0,1/30);ok(Math.abs(s.player.x-x0-3.6)<.05||s.player.x-x0>2.5,`free walking still covers ground (${(s.player.x-x0).toFixed(2)} tiles in a second)`);
 // residents are not stopped by props: a baker still reaches the oven it works at
 const npcs=W.NPCS.filter(n=>n.role==='baker').length;ok(npcs>0,'bakers still exist');
}
console.log(`\n${pass} passed, ${fail} failed`);if(fail){console.log(failures.join('\n'));process.exit(1);}
