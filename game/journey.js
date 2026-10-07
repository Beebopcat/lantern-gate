import {worldMinute} from './world-conditions.js';
import {MAPS,PROPS,NPCS,TOWNS,ITEMS,dist,townAt,buildingAt,solid,hash} from './world.js';
import {CASTLE} from './castle-data.js';
import {CREATURES,CASTLE_CREATURE_SLOTS} from './creatures.js';
import {OUTFITS} from './life.js';
import {classCooldownScale} from './progression.js';
import * as G from './companions.js';
const hasClass=id=>Object.hasOwn(CLASSES,id);

export const CLASSES = {
  warrior:{name:'Warrior',creatable:true,icon:'sword',description:'Hold the line. A tempered blade, a riveted coat and the discipline to stand where others run.',gear:'Tempered blade · riveted coat · +25 health · +5 blade damage',abilities:[{name:'Shield Wall',cost:8,cooldown:16,detail:'Halve all damage you take for 6 seconds.'},{name:'Cleave',cost:10,cooldown:9,detail:'Sweep every foe within 2.8 paces for heavy damage.'},{name:'Rallying Cry',cost:14,cooldown:24,detail:'Recover 20 health and stagger foes within 5 paces for 2 seconds.'}],color:'#c97b5a'},
  summoner:{name:'Summoner',creatable:true,icon:'lens',description:'Bind a spirit servant that guards you, follows you across every road and fights anything that threatens you. Choose one of four minions.',gear:'Spirit-binding focus · two tonics · +20 mana · one bound minion',abilities:[{name:'Spirit Lash',cost:9,cooldown:8,detail:'Strike the nearest foe within 7 paces for heavy damage.'},{name:'Rally the Bound',cost:14,cooldown:22,detail:'Heal your minion by 40% and empower it for 8 seconds (+50% damage).'},{name:'Recall',cost:6,cooldown:12,detail:'Pull your minion to your side. A fallen minion returns at half strength.'}],color:'#b86fd1'},
  mage:{name:'Mage',creatable:true,icon:'lantern',description:'Command raw arcane force. Cast an arcane bolt with F without any lantern, scorch several foes at once and freeze the ground around you.',gear:'Arcane focus · three tonics · +30 mana · +8 spell damage',abilities:[{name:'Arcane Volley',cost:12,cooldown:8,detail:'Hit up to three foes within 7 paces.'},{name:'Frost Nova',cost:16,cooldown:18,detail:'Damage foes within 3.6 paces, slow them for 6 seconds and hold them for a moment.'},{name:'Mana Surge',cost:4,cooldown:30,detail:'Recover half your mana and 10 health.'}],color:'#8e7cf0'},
  ranger:{name:'Ranger',creatable:true,icon:'leaf',description:'A yew bow and a hunting beast that guards you, follows you across every road and fights beside you. Choose one of four beasts.',gear:'Yew bow · +10 health · +6 bow damage · one bonded beast',abilities:[{name:'Piercing Shot',cost:9,cooldown:7,detail:'Loose a heavy arrow at the nearest foe within 9 paces.'},{name:'Snare Trap',cost:12,cooldown:16,detail:'Root foes within 5 paces for 4 seconds.'},{name:'Hunter’s Mark',cost:10,cooldown:20,detail:'Mark the nearest foe for 10 seconds: it takes 25% more damage and your beast hunts it first.'}],color:'#6fa86b'},
  // Legacy callings stay valid so existing saves keep their own abilities. They are not offered to new characters.
  oathbinder:{name:'Oathbinder',legacy:true,icon:'lantern',description:'Turn promises into shelter. Place a threshold ward, bind a hunter with a spoken oath, and shelter your allies.',abilities:[{name:'Threshold',cost:10,cooldown:14,detail:'Raise a ward for 8 seconds. Hunters cannot enter it.'},{name:'Stay your hand',cost:14,cooldown:18,detail:'Bind nearby enemies for 4 seconds.'},{name:'Shared candle',cost:18,cooldown:25,detail:'Heal you and nearby residents for 25 health.'}],color:'#d7b367'},
  echoartisan:{name:'Echo Artisan',legacy:true,icon:'lens',description:'Work with sound left in stone. Throw your footsteps elsewhere, fracture a hunting bell, and hear through the mist.',abilities:[{name:'Borrowed footsteps',cost:9,cooldown:12,detail:'Leave a decoy that draws hunters away for 7 seconds.'},{name:'Glass note',cost:15,cooldown:16,detail:'A ringing wave deals 24 damage and staggers nearby foes.'},{name:'Listen beyond',cost:12,cooldown:20,detail:'Reveal hunters and slow their approach for 8 seconds.'}],color:'#79b8cf'},
  marrowgardener:{name:'Marrow Gardener',legacy:true,icon:'leaf',description:'Grow life in places that forgot it. Raise thorn roots, harvest strength from danger, and seed a refuge in dead soil.',abilities:[{name:'Briar cradle',cost:11,cooldown:13,detail:'Root nearby enemies for 5 seconds.'},{name:'Borrowed bloom',cost:15,cooldown:17,detail:'Deal 20 damage to a nearby foe and recover 18 health.'},{name:'Green vigil',cost:20,cooldown:26,detail:'Grow a protective refuge for 10 seconds and heal slowly within it.'}],color:'#92b779'}
};
export const CREATABLE=Object.entries(CLASSES).filter(([,c])=>c.creatable).map(([id])=>id);
const record=o=>o&&typeof o==='object'&&!Array.isArray(o);
const finite=(n,max=1e10)=>Number.isFinite(n)&&n>=0&&n<=max;
const integer=(n,max=1e6)=>Number.isInteger(n)&&finite(n,max);
export function upgrade(s){
  if(!s.journey)s.journey={version:1,created:false,introSeen:false,tutorial:0,origin:{x:s.player.x,y:s.player.y},cooldowns:[0,0,0],wards:[],decoy:null,hunt:{phase:'quiet',next:s.elapsed+150,until:0},markets:{},marketDay:Math.floor(s.clock/1440),castleQuest:'unheard',clues:[],residents:[
    {id:'castle-frankenstein',name:'Frankenstein',role:'creation',type:'mythic',map:'dracula-1',x:59.5,y:18.5,gender:'male',task:'tending a seed in the laboratory'},
    {id:'castle-wolfman',name:'The Wolf Man',role:'cursed keeper',type:'mythic',kind:'werewolf',map:'dracula-3',x:59.5,y:18.5,gender:'male',task:'listening for the hunting bell'},
    {id:'castle-dracula',name:'Dracula',role:'count',type:'mythic',map:'dracula-4',x:40.5,y:38.5,gender:'male',task:'reading the ledger of drowned names'}
  ]};
  s.settings.cameraMode??='third-person';s.settings.cameraPitch??=.32;if(!s.settings.jrpgLook){s.settings.jrpgLook=1;s.settings.look='hd2d';s.settings.diorama=true;s.settings.cameraMode='isometric';}s.settings.look??='hd2d';s.settings.diorama??=false;s.settings.battles??='turn';
  return s.journey;
}
export function valid(s){
  if(s.journey===undefined)return s.guardian===undefined;const j=s.journey;
  if(!record(j)||j.version!==1||typeof j.created!=='boolean'||typeof j.introSeen!=='boolean'||!integer(j.tutorial,6)||!record(j.origin)||!finite(j.origin.x,384)||!finite(j.origin.y,384)||!Array.isArray(j.cooldowns)||j.cooldowns.length!==3||!j.cooldowns.every(n=>finite(n))||!Array.isArray(j.wards)||j.wards.length>3||!j.wards.every(w=>MAPS[w.map]&&finite(w.x,384)&&finite(w.y,384)&&finite(w.until)&&['threshold','garden'].includes(w.kind))||!record(j.hunt)||!['quiet','warning','tracking','searching','recovery'].includes(j.hunt.phase)||!finite(j.hunt.next)||!finite(j.hunt.until)||!record(j.markets)||!integer(j.marketDay)||!['unheard','active','mercy','defiance','complete'].includes(j.castleQuest)||!Array.isArray(j.clues)||!j.clues.every(c=>['names','bell','seed'].includes(c))||!Array.isArray(j.residents)||j.residents.length!==3)return false;
  if(['castlePopulated','traded','exported','tutorialHidden'].some(k=>j[k]!==undefined&&typeof j[k]!=='boolean')||j.revealUntil!==undefined&&!finite(j.revealUntil)||j.guardUntil!==undefined&&!finite(j.guardUntil)||new Set(j.clues).size!==j.clues.length)return false;
  if(j.created&&!['female','male','nonbinary'].includes(s.player.gender)||j.castleResolution!==undefined&&!['mercy','bargain'].includes(j.castleResolution))return false;
  if(!j.residents.every(r=>['castle-frankenstein','castle-wolfman','castle-dracula'].includes(r.id)&&MAPS[r.map]&&finite(r.x,80)&&finite(r.y,80))||new Set(j.residents.map(r=>r.id)).size!==3)return false;
  if(j.decoy&&(!MAPS[j.decoy.map]||!finite(j.decoy.x,384)||!finite(j.decoy.y,384)||!finite(j.decoy.until)))return false;
  if(!Object.entries(j.markets).every(([id,m])=>NPCS.some(n=>n.id===id)&&record(m)&&finite(m.cash)&&record(m.stock)&&Object.entries(m.stock).every(([k,v])=>ITEMS[k]?.price&&integer(v,200))))return false;
  return (!j.created||(typeof s.player.name==='string'&&s.player.name.length>0&&s.player.name.length<=28&&hasClass(s.player.classId)&&['warm','earth','deep','pale','olive'].includes(s.player.skin)&&['black','brown','silver','auburn','gold'].includes(s.player.hair)))&&['isometric','third-person'].includes(s.settings.cameraMode??'third-person')&&finite(s.settings.cameraPitch??.32,1.2)&&G.valid(s);
}
export function create(s,{name,classId,skin='warm',hair='brown',outfit='traveler',gender='female',companionId=null}){
  const j=upgrade(s);if(j.created)return 'This character already has a calling.';
  name=String(name).trim().replace(/[\x00-\x1f<>]/g,'').slice(0,28);if(!name||!CREATABLE.includes(classId)||!Object.hasOwn(OUTFITS,outfit)||!['warm','earth','deep','pale','olive'].includes(skin)||!['black','brown','silver','auburn','gold'].includes(hair)||!['female','male','nonbinary'].includes(gender))return 'Choose a name, appearance, and calling.';
  // Summoners and Rangers must bind exactly one companion from their own roster; every other calling must bind none.
  if(G.isCompanionClass(classId)){if(!G.inRoster(classId,companionId))return `Choose one ${G.rosterFor(classId).role} from the ${CLASSES[classId].name} roster.`;}
  else if(companionId)return 'This calling has no bound companion.';
  Object.assign(s.player,{name,classId,skin,hair,gender});j.created=true;j.introSeen=true;j.tutorial=0;j.origin={x:s.player.x,y:s.player.y};
  // Creation colors are cosmetic. A calling's starter kit is modest, fixed, and granted only once here.
  s.life.outfit=outfit; if(!s.life.outfits.includes(outfit))s.life.outfits.push(outfit);
  const p=s.player,inv=s.inv,kit={warrior(){inv.sword=(inv.sword||0)+1;inv.armor=(inv.armor||0)+1;p.armor=4;p.maxHp+=25;p.hp=p.maxHp;},summoner(){inv.tonic=(inv.tonic||0)+2;p.maxMp+=20;p.mp=p.maxMp;},mage(){inv.tonic=(inv.tonic||0)+3;p.maxMp+=30;p.mp=p.maxMp;},ranger(){inv.bow=(inv.bow||0)+1;p.weapon='bow';p.maxHp+=10;p.hp=p.maxHp;}};
  kit[classId]();
  let extra='';if(G.isCompanionClass(classId)){const g=G.spawn(s,classId,companionId);extra=` ${g.name} answers your call.`;}
  return `${name}, the ${CLASSES[classId].name}, arrives in Hearthwick.${extra}`;
}
// Warrior Shield Wall halves damage taken. Class passives add a small, fixed bonus to the matching attack.
export const guardScale=s=>(s.journey?.guardUntil??0)>s.elapsed?.5:1;
export function strikeBonus(s,spell=false){const c=s.player.classId;return c==='warrior'&&!spell&&s.player.weapon==='blade'?5:c==='ranger'&&!spell&&s.player.weapon==='bow'?6:c==='mage'&&spell?8:0;}
export function protectedByWard(s,a){return upgrade(s).wards.some(w=>w.map===a.map&&w.until>s.elapsed&&dist(w,a)<3.2);}
export function ability(s,index,api){
  const j=upgrade(s),p=s.player,c=hasClass(p.classId)?CLASSES[p.classId]:null,a=c?.abilities[index];if(!a||p.deadUntil)return 'Choose a living character and a calling.';
  if(j.cooldowns[index]>s.elapsed)return `${a.name} is ready in ${Math.ceil(j.cooldowns[index]-s.elapsed)} seconds.`;
  if(p.mp<a.cost)return `You need ${a.cost} mana.`;
  const sight=e=>!api.lineOfSight||api.lineOfSight(p.map,p,e),live=e=>e.map===p.map&&!e.deadUntil&&!e.expired&&(e.spawnAt??0)<=s.elapsed&&!e.warden;
  const reach=r=>s.enemies.filter(e=>live(e)&&dist(e,p)<r&&sight(e)).sort((x,y)=>dist(x,p)-dist(y,p)),foes=s.enemies.filter(e=>e.map===p.map&&!e.deadUntil&&!e.expired&&dist(e,p)<6&&sight(e)).sort((x,y)=>dist(x,p)-dist(y,p)),code=p.classId+':'+index,lvl=p.level||1,now=Date.now();
  const need={'marrowgardener:1':[foes,'No foe is close enough to draw a bloom.'],'warrior:1':[reach(2.8),'No foe is within reach of your blade.'],'summoner:0':[reach(7),'No foe is within seven paces.'],'mage:0':[reach(7),'No foe is within seven paces.'],'ranger:0':[reach(9),'No foe is within nine paces.'],'ranger:2':[reach(9),'No foe is within nine paces.'],'ranger:1':[reach(5),'No foe is close enough to snare.'],'mage:1':[reach(3.6),'No foe is close enough for a frost nova.']}[code];
  if(need&&!need[0].length)return need[1];
  if(code==='summoner:1'){if(!s.guardian)return 'You have no bound minion.';if(s.guardian.fallen)return 'Your minion has fallen. Use Recall to bring it back.';}
  p.mp-=a.cost;j.cooldowns[index]=s.elapsed+a.cooldown*classCooldownScale(s);
  const beam=(e,type='spell')=>{s.effects??=[];s.effects.push({type,from:{x:p.x,y:p.y},to:{x:e.x,y:e.y},until:s.elapsed+.45});};
  if(code==='oathbinder:0'||code==='marrowgardener:2')j.wards.push({map:p.map,x:p.x,y:p.y,until:s.elapsed+(index===2?10:8),kind:index===2?'garden':'threshold'});
  if(code==='oathbinder:1'||code==='marrowgardener:0')for(const e of foes)e.boundUntil=s.elapsed+(index===1?4:5);
  if(code==='oathbinder:2'){p.hp=Math.min(p.maxHp,p.hp+25);for(const n of s.actors.filter(n=>n.map===p.map&&!n.deadUntil&&dist(n,p)<6))n.hp=Math.min(n.maxHp,n.hp+25);}
  if(code==='echoartisan:0')j.decoy={map:p.map,x:p.x,y:p.y,until:s.elapsed+7};
  if(code==='echoartisan:1')for(const e of foes){api.hurt(s,e,24,now,'player');e.boundUntil=s.elapsed+1.4;}
  if(code==='echoartisan:2'){j.revealUntil=s.elapsed+8;for(const e of foes)e.slowUntil=s.elapsed+8;}
  if(code==='marrowgardener:1'){api.hurt(s,foes[0],20,now,'player');p.hp=Math.min(p.maxHp,p.hp+18);}
  // Warrior
  if(code==='warrior:0')j.guardUntil=s.elapsed+6;
  if(code==='warrior:1')for(const e of need[0]){beam(e,'strike');api.hurt(s,e,24+lvl*2,now,'player');}
  if(code==='warrior:2'){p.hp=Math.min(p.maxHp,p.hp+20);for(const e of reach(5))e.boundUntil=Math.max(e.boundUntil||0,s.elapsed+2);}
  // Summoner
  if(code==='summoner:0'){const e=need[0][0];beam(e);api.hurt(s,e,22+lvl*2,now,'player');}
  if(code==='summoner:1'){G.heal(s,.4);s.guardian.empoweredUntil=s.elapsed+8;}
  if(code==='summoner:2')s.notice=G.recall(s);
  // Mage
  if(code==='mage:0')for(const e of need[0].slice(0,3)){beam(e);api.hurt(s,e,18+lvl*2,now,'player');}
  if(code==='mage:1')for(const e of need[0]){e.slowUntil=Math.max(e.slowUntil||0,s.elapsed+6);e.boundUntil=Math.max(e.boundUntil||0,s.elapsed+1.2);api.hurt(s,e,14+lvl,now,'player');}
  if(code==='mage:2'){p.mp=Math.min(p.maxMp,p.mp+p.maxMp*.5);p.hp=Math.min(p.maxHp,p.hp+10);}
  // Ranger
  if(code==='ranger:0'){const e=need[0][0];beam(e,'strike');api.hurt(s,e,30+lvl*2,now,'player');}
  if(code==='ranger:1')for(const e of need[0])e.boundUntil=Math.max(e.boundUntil||0,s.elapsed+4);
  if(code==='ranger:2'){const e=need[0][0];e.markedUntil=s.elapsed+10;beam(e);}
  s.effects??=[];s.effects.push({type:'spell',from:{x:p.x,y:p.y},to:{x:p.x+.3,y:p.y+.3},until:s.elapsed+.6});return `${a.name}. ${a.detail}`;
}
const roleStock={smith:{sword:2,armor:2,bow:2,ore:12},baker:{bread:18,wood:9},farmer:{fish:12,bread:6,leaf:10},merchant:{bread:9,fish:7,tonic:5,salve:5,wood:10},innkeeper:{bread:12,fish:8,tonic:3,salve:3,wood:6}};
export function market(s,traderId){
  const j=upgrade(s),n=s.actors.find(n=>n.id===traderId);if(!n||!roleStock[n.role])return null;
  return j.markets[n.id]??=( {stock:{...roleStock[n.role]},cash:n.role==='smith'?180:90});
}
export function quote(s,traderId,item){
  const m=market(s,traderId),base=ITEMS[item]?.price;if(!m||!base)return null;const n=s.actors.find(n=>n.id===traderId),target=roleStock[n.role][item]??6,stock=m.stock[item]||0;
  const scarcity=Math.max(-.12,Math.min(.45,(target-stock)/Math.max(1,target)*.35)),danger=s.raid?.town===n.town||s.life.nightEvent?.town===n.town;
  const buy=Math.ceil(base*(1+scarcity+(danger?.12:0)));return {buy,sell:Math.min(buy-1,Math.max(1,Math.floor(base*(.45+scarcity*.25)))),stock,cash:m.cash};
}
export function trade(s,traderId,item,sell=false){
  const n=s.actors.find(n=>n.id===traderId),m=market(s,traderId),p=s.player;if(!n||!m||!ITEMS[item]?.price)return 'This resident does not trade that item.';
  if(n.deadUntil||p.deadUntil||n.map!==p.map||dist(n,p)>2.3)return 'Stand beside the living trader.';
  const hour=worldMinute(s)/60;if(hour<7||hour>=21)return 'The shop is closed. Trading resumes at seven in the morning.';
  const q=quote(s,traderId,item);
  if(sell){if(!s.inv[item])return 'You do not have one to sell.';if(m.cash<q.sell)return 'This trader needs tomorrow’s takings before buying more.';if(q.stock>=200)return 'This trader’s store is full.';s.inv[item]--;m.cash-=q.sell;m.stock[item]=(m.stock[item]||0)+1;p.gold+=q.sell;return `Sold ${ITEMS[item].name} for ${q.sell} gold.`;}
  if(!q.stock)return 'Sold out. Production replenishes stock at dawn.';if(p.gold<q.buy)return `You need ${q.buy} gold.`;
  p.gold-=q.buy;m.cash+=q.buy;m.stock[item]--;s.inv[item]=(s.inv[item]||0)+1;return `Bought ${ITEMS[item].name} for ${q.buy} gold.`;
}
export function tick(s,dt,api){
  const j=upgrade(s),p=s.player;
  j.wards=j.wards.filter(w=>w.until>s.elapsed);if(j.decoy?.until<=s.elapsed)j.decoy=null;
  if(j.wards.some(w=>w.kind==='garden'&&w.map===p.map&&dist(w,p)<3.2)&&!p.deadUntil)p.hp=Math.min(p.maxHp,p.hp+dt*2);
  const day=Math.floor(s.clock/1440);if(day>j.marketDay){const days=Math.min(3,day-j.marketDay);for(const [id,m]of Object.entries(j.markets)){const n=s.actors.find(n=>n.id===id);if(!n||n.deadUntil)continue;for(const [item,target]of Object.entries(roleStock[n.role]))m.stock[item]=Math.min(target*2,(m.stock[item]||0)+Math.max(1,Math.ceil(target*.4))*days);m.cash=Math.min(250,m.cash+24*days);}j.marketDay=day;}
  const inCrown=p.map==='overworld'&&dist(p,CASTLE)<CASTLE.radius,night=worldMinute(s)<360||worldMinute(s)>=1200,h=j.hunt;
  let live=s.enemies.filter(e=>e.hunter&&!e.headlessHorseman&&!e.coachAmbusher&&!e.id.startsWith('castle-')&&!e.deadUntil&&!e.expired);
  if(!s.raid&&!p.deadUntil&&j.created&&(night||inCrown)&&!townAt(p.x,p.y,22)&&p.map==='overworld'&&!buildingAt(p.x,p.y)&&s.elapsed>=h.next&&h.phase==='quiet'){
    h.phase='warning';h.until=s.elapsed+9;s.notice='A hunting bell sounds. Reach a locked door, a ward, or break the hunter’s line of sight.';
  }
  if(h.phase==='warning'&&s.elapsed>=h.until){
    if(p.deadUntil||p.map!=='overworld'||townAt(p.x,p.y,22)||buildingAt(p.x,p.y)){h.phase='recovery';h.until=s.elapsed+25;h.next=s.elapsed+160;return;}
    const count=inCrown?2:1;for(let i=0;i<count;i++){let spot=null;for(let k=0;k<24;k++){const angle=k*Math.PI/12+i;const x=p.x+Math.cos(angle)*(13+i*2),y=p.y+Math.sin(angle)*(13+i*2);if(!solid(p.map,x,y)&&!buildingAt(x,y)){spot={x,y};break;}}if(spot)s.enemies.push(api.enemy('hunt-'+Math.floor(s.elapsed)+'-'+i,'werewolf',p.map,spot.x,spot.y,{hunter:true,horror:true,huntState:'tracking',memory:{x:p.x,y:p.y,map:p.map},lost:0,home:{...spot}}));}
    live=s.enemies.filter(e=>e.hunter&&!e.headlessHorseman&&!e.coachAmbusher&&!e.id.startsWith('castle-')&&!e.deadUntil&&!e.expired);
    h.phase='tracking';h.until=s.elapsed+90;h.next=s.elapsed+180;
  }
  if(['tracking','searching'].includes(h.phase)){
    if(!live.length||s.elapsed>h.until||p.deadUntil){for(const e of live)e.expired=true;h.phase='recovery';h.until=s.elapsed+25;h.next=s.elapsed+160;}
    else h.phase=live.some(e=>e.huntState==='tracking'||e.huntState==='lunge')?'tracking':'searching';
  }
  if(h.phase==='recovery'&&s.elapsed>h.until)h.phase='quiet';
  if(!j.castlePopulated){
    for(let level=1;level<=4;level++){const map='dracula-'+level,m=MAPS[map];for(let i=0;i<6;i++){const [x,y,rw,rh]=m.rooms[i%4],sx=x+3+(i%3)*3,sy=y+3+(i%2)*3;s.enemies.push(api.enemy(`castle-${level}-${i}`,CASTLE_CREATURE_SLOTS.find(c=>c.id===`castle-${level}-${i}`)?.kind||(i===5?'werewolf':i===3?'paleguest':'zombie'),map,sx,sy,{horror:true,hunter:i===5,huntState:'stalking',lost:0}));}}
    for(let i=0;i<12;i++){const a=i*Math.PI/6,x=CASTLE.x+Math.cos(a)*16,y=CASTLE.y+Math.sin(a)*16;if(!solid('overworld',x,y)&&!townAt(x,y,28))s.enemies.push(api.enemy('crown-dead-'+i,i%4===0?'paleguest':'zombie','overworld',x,y,{horror:true}));}j.castlePopulated=true;
  }
  // Older review saves reuse the same three slots, preserving total enemy count.
  for(const slot of CASTLE_CREATURE_SLOTS){const e=s.enemies.find(e=>e.id===slot.id);if(e?.kind==='zombie'){const c=CREATURES[slot.kind],fraction=e.hp/e.maxHp;Object.assign(e,{kind:slot.kind,name:c.name,maxHp:c.hp,hp:Math.round(c.hp*fraction),attack:c.attack,speed:c.speed,path:[],think:0});}}
}
export function hunterTarget(s,e,dt,api){
  const p=s.player,j=upgrade(s);if(e.map!==p.map||p.deadUntil)return null;
  if(protectedByWard(s,p)||protectedByWard(s,e)){e.huntState='circling';e.lost=(e.lost||0)+dt;return null;}
  if(e.boundUntil>s.elapsed){e.moving=false;e.huntState='bound';return null;}
  if(j.decoy&&j.decoy.map===e.map&&dist(e,j.decoy)<25){e.huntState='tracking';return j.decoy;}
  if(protectedByWard(s,p)){e.huntState='circling';e.lost=(e.lost||0)+dt;return null;}
  const visible=dist(e,p)<27&&api.lineOfSight(e.map,e,p),heard=p.moving&&dist(e,p)<13;
  if(visible||heard){e.memory={x:p.x,y:p.y,map:p.map};e.lost=0;e.huntState=dist(e,p)<2.2?'lunge':'tracking';return p;}
  e.lost=(e.lost||0)+dt;e.huntState='searching';
  if(e.lost<10&&e.memory)return e.memory;
  if(e.hunter&&!e.id.startsWith('castle-'))e.expired=true;return null;
}
export const TUTORIAL = [
  {title:'Find your footing',detail:'Click clear ground or use WASD / arrow keys. Walk three paces from your starting point.'},
  {title:'A person, not a prop',detail:'Open Nearby and walk to Mara. Speak with her about the lanterns and your first commissions.'},
  {title:'Earn an honest wage',detail:'Enter a workshop or garden and work a paid shift. You can also complete commissions and sell crafted goods.'},
  {title:'Make a choice at market',detail:'Speak to a trader during opening hours. Buy a provision or sell something you gathered. Stock and prices respond to supply.'},
  {title:'Practice your calling',detail:'Use one of your three class abilities with keys 1, 2, or 3. Your mana and cooldowns are shown on the ability bar.'},
  {title:'Keep your place',detail:'Open Settings and export a save, or choose a shared folder in the separate game tab. The tutorial can be dismissed or replayed.'}
];
export function tutorialTick(s){const j=upgrade(s);if(j.tutorial===0&&dist(s.player,j.origin)>3)j.tutorial=1;if(j.tutorial===1&&s.flags.metMara)j.tutorial=2;if(j.tutorial===2&&Object.values(s.life.jobs).some(n=>n>0))j.tutorial=3;if(j.tutorial===3&&Object.keys(j.markets).length&&j.traded)j.tutorial=4;if(j.tutorial===4&&j.cooldowns.some(n=>n>0))j.tutorial=5;if(j.tutorial===5&&j.exported)j.tutorial=6;}

export function castleBargain(s,action){
 const j=upgrade(s),id=action==='seed'?'castle-frankenstein':action==='bell'?'castle-wolfman':'castle-dracula',r=j.residents.find(r=>r.id===id);
 if(!['seed','bell','names','mercy'].includes(action))return 'That bargain is unknown.';
 if(s.player.deadUntil||r.map!==s.player.map||dist(r,s.player)>2.3)return 'Stand beside the resident to settle the bargain.';
 const clue=action==='mercy'?'names':action;if(j.clues.includes(clue))return 'That part of the bargain is already settled.';
 if(action==='seed'){if((s.inv.leaf||0)<3)return 'Frankenstein needs three moonleaf.';s.inv.leaf-=3;}
 if(action==='bell'){if((s.inv.ore||0)<3||(s.inv.wood||0)<2)return 'Bring three cinder iron and two seasoned branches.';s.inv.ore-=3;s.inv.wood-=2;}
 if(clue==='names'){
  if(!j.clues.includes('seed')||!j.clues.includes('bell'))return 'First awaken the seed and silence the hunting bell.';
  if(action==='names'&&s.player.gold<60)return 'The count asks sixty gold for the ledger.';
  if(action==='names')s.player.gold-=60;j.castleResolution=action==='mercy'?'mercy':'bargain';
 }
 j.clues.push(clue);j.castleQuest='active';
 if(j.clues.length===3){j.castleQuest='complete';s.player.gold+=45;return 'The stolen names are returned. The Marches reward you with 45 gold.';}
 return action==='seed'?'A living seed wakes in Frankenstein’s hands.':'The Wolf Man’s bell falls silent.';
}
