import {installCastle} from './castle-data.js';
import {installSleepyHollow} from './sleepy-hollow.js';
import {applyResidentRoutines} from './resident-routines.js';
import {applyRoadLayout} from './road-layout.js';
export {navigationAudit} from './road-layout.js';
export const SIZE=384,START={map:'overworld',x:100,y:298};
export const T={grass:0,path:1,water:2,floor:3,wall:4,tree:5,stone:6,sand:7,snow:8,marsh:9,bridge:10};
export const hash=(x,y,s=0)=>{let a=Math.imul(x+713,s+374761393)^Math.imul(y+937,668265263);a=Math.imul(a^(a>>>13),1274126177);return ((a^(a>>>16))>>>0)/4294967296;};
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const TOWNS=[
 {id:'hearth',name:'Hearthwick',x:100,y:292,region:'The River March',motto:'Every stranger deserves a light.',color:'#c57f4c',names:['Mara','Ada','Tamsin','Orin','Bram','Nell','Edda','Galen','Wren','Corin','Jory'],rumor:'The old mill stopped turning the night our lanterns failed. Its keeper left a journal in the cellar.'},
 {id:'willow',name:'Willowmere',x:52,y:230,region:'The Greenwater',motto:'What the river takes, the reeds remember.',color:'#5b8782',names:['Iona','Vesper','Holt','Sella','Fenn','Aster','Perrin','Moss','Lark','Owen','Tilda'],rumor:'A ferryman hears bells under the water. The drowned chapel holds more than bones.'},
 {id:'copper',name:'Copperfell',x:139,y:204,region:'The Ember Hills',motto:'Honest iron. Unbroken promises.',color:'#b57655',names:['Dara','Cedric','Kestrel','Anwen','Tobin','Rusk','Beryl','Flint','Mica','Hugh','Petra'],rumor:'The quarry miners broke into a sealed vault. The stones now hum before a raid.'},
 {id:'reed',name:'Reedhaven',x:246,y:292,region:'The Salt Fen',motto:'A safe harbor in uncertain weather.',color:'#737f54',names:['Esme','Neris','Pike','Amity','Clove','Sedge','Rilla','Borin','Teal','Lyle','Ines'],rumor:'The lighthouse lens is missing. Ships follow a false light toward the salt caves.'},
 {id:'salt',name:'Saltwatch',x:324,y:229,region:'The Eastern Reach',motto:'Keep watch. Keep faith.',color:'#a38d60',names:['Elowen','Quill','Dain','Mercy','Rye','Tess','Maris','Hale','Kit','Arden','Una'],rumor:'A red-sailed smuggler buried a ledger beneath the coastal fort.'},
 {id:'grey',name:'Greyharbor',x:286,y:124,region:'The Silver Coast',motto:'A thousand stories enter by the sea.',color:'#718895',names:['Carys','Lowen','Ansel','Miri','Otto','Fern','Brigid','Rowan','Sable','Soren','Yara'],rumor:'The haunted manor on the western road still sets a place for a daughter who never returned.'},
 {id:'high',name:'Highmere',x:181,y:65,region:'The Frost Crown',motto:'Hold the flame against the winter.',color:'#7c84ac',names:['Aeron','Isolde','Garrick','Lenna','Ember','Lumi','Oren','Eira','Rook','Tor','Faye'],rumor:'The abbey beneath the glacier kept the last verse of the keeper’s oath.'},
 {id:'thorn',name:'Thornrest',x:53,y:103,region:'The Oldwood',motto:'The roots bind us to one another.',color:'#67764c',names:['Hazel','Silas','Ash','Saffron','Cedar','Hester','Nim','Briar','Finch','Reeve','Sorrel'],rumor:'The orchard east of town bears silver fruit. Its caretaker vanished into the hollow roots.'},
 {id:'sun',name:'Sunward',x:141,y:124,region:'The Golden Vale',motto:'A promise is a door left open.',color:'#b0a269',names:['Ysra','Lysander','Clem','Dove','Juniper','Pip','Maeve','Alden','Robin','Basil','Nessa'],rumor:'The Sunken Archive lies beyond the eastern hills. Three beacons remember the way: Dawn, Tide, Night.'}
];
export const SITES=[
 {id:'mill',name:'The Broken Mill',x:124,y:262,kind:'cellar',relic:'coil',lore:'A waterwheel can turn a workshop, but a promise turns a life. I have hidden my journal below the second landing. —Keeper Eren',enemy:'goblin'},
 {id:'chapel',name:'Drowned Chapel',x:66,y:187,kind:'crypt',relic:'bell',lore:'We rang the bell for the living and the lost. When the flood came, we refused to leave anyone behind.',enemy:'skeleton'},
 {id:'quarry',name:'Cinderdeep Quarry',x:184,y:212,kind:'mine',relic:'ore',lore:'The copper veins meet beneath the hill. Something on the other side answers each strike of a pick.',enemy:'troll'},
 {id:'saltcave',name:'The Singing Caves',x:276,y:320,kind:'cave',relic:'pearl',lore:'The sea writes its history in rings of salt. Listen between the waves and you will hear the first keepers singing.',enemy:'goblin'},
 {id:'fort',name:'Redwake Fort',x:326,y:168,kind:'fort',relic:'ledger',lore:'No cargo is worth a sleeping village. The captain paid us to extinguish the watchfire. I kept the ledger.',enemy:'skeleton'},
 {id:'manor',name:'Briarglass Manor',x:240,y:145,kind:'haunted',relic:'locket',lore:'Mother, leave the west window open. When the lanterns return I will find the road home. —Elin',enemy:'ghost'},
 {id:'abbey',name:'The Frostbound Abbey',x:209,y:40,kind:'abbey',relic:'verse',lore:'Dawn wakes. Tide remembers. Night keeps. Hold a light for the lost, but never mistake a gate for a prison.',enemy:'skeleton'},
 {id:'roots',name:'The Hollow Orchard',x:88,y:70,kind:'roots',relic:'seed',lore:'Roots do not choose between the graves of kings and gardeners. They carry every story into the leaves.',enemy:'wolf'},
 {id:'archive',name:'The Sunken Archive',x:217,y:112,kind:'archive',relic:'lens',lore:'The keeper’s lantern is built from memory, copper, and mercy. Its flame belongs to every road, not to the one who carries it.',enemy:'sentinel'},
 {id:'watch',name:'The Moonwatch Ruins',x:102,y:171,kind:'ruin',relic:'map',lore:'Nine watchfires once marked the roads. The towers fell, but the stones beneath them still know their names.',enemy:'wolf'},
 {id:'barrow',name:'The Whispering Barrow',x:226,y:242,kind:'crypt',relic:'crown',lore:'They buried the king with an empty crown. His last order was to feed the people waiting at the gate.',enemy:'ghost'},
 {id:'gate',name:'The Lantern Gate',x:329,y:60,kind:'gate',relic:'heart',lore:'A door can be opened by force. Only a promise can tell you whether it should be.',enemy:'sentinel'}
];
const deepRecords={
 mill:'Eren’s last maintenance entry: The lower wheel still turns, but its copper winding is cold. I sent Ada the measurements. If I do not return, bring her the journal beside the coil. She will know which part of my work to finish.',
 chapel:'A ferryman’s tally survives above the flood line: thirty-seven carried to the ridge, two boats lost, no fares collected. The final name is the bell-ringer’s. Iona has asked that the bell sound once for every name, including that one.',
 quarry:'The miners marked the seam with three iron pins. Their foreman forbade another blast after the echoes began answering in words. A note in Kestrel’s hand asks that any salvage go to the watch before it goes to market.',
 saltcave:'The cave singers tuned their pearl to the harbor bell. When smugglers raised a false beacon, the pearl fell silent. Esme believes its song can separate a safe light from a hungry one. The tide has preserved the tuning marks.',
 fort:'Quartermaster’s memorandum: the captain’s private ships received fuel while the public watchfire went dark. Names and payments fill the ledger. Elowen can bring the account to trial, or force the captain to repay the widows first.',
 manor:'Orin’s childhood height is marked on the kitchen door. Elin’s is a little higher, and then stops. A letter asks their mother to keep a place at supper. The locket below the broken stair was never meant to be a memorial.',
 abbey:'The archivist crossed out the order to seal the Gate forever. Beneath it she wrote the missing verse: a keeper tends the passage, never owns the traveler. Isolde’s copy ends one line too soon; take her the surviving page.',
 roots:'Hester’s grandmother planted these roots after the winter fires. Each family gave a name to a tree. The silver seed was kept for a spring no one was certain would come. A gardener has written: plant it anyway.',
 archive:'Inventory of the last lantern: copper to conduct, glass to remember, a hand willing to release. The lens cannot choose a worthy keeper. That burden belongs to the person carrying it. Tamsin has the tools to assemble what remains.',
 watch:'The watchfire chart records nine roads and the names of those who walked them in the snow. One route is marked only with a small open hand. Lysander’s margin note reads: this is where a stranger guided us home.',
 barrow:'The burial account lists no jewels. The crown was emptied to buy seed grain, and the king asked to be carried through the common gate. Neris is looking for the account because the songs remember a conqueror instead.',
 gate:'Elin’s final watch: I kept the door shut because I feared who might pass through. Then I forgot who was waiting outside. If Orin comes, tell him that I remember the river. Tell him I am tired of being necessary.'
};
export const ITEMS={
 bread:{name:'Hearth bread',detail:'Restore 22 health and 15 mana.',price:3},tonic:{name:'Blue tonic',detail:'Restore all of your mana.',price:7},salve:{name:'Healing salve',detail:'Restore 45 health; can heal an injured ally.',price:9},leaf:{name:'Moonleaf',detail:'A silver-veined medicinal herb.',price:2},ore:{name:'Cinder iron',detail:'Warm, workable ore from Cinderdeep.',price:5},fish:{name:'River trout',detail:'Restore 14 health and 10 mana.',price:4},wood:{name:'Seasoned wood',detail:'Useful to carpenters and beacon keepers.',price:2},
 coil:{name:'Keeper’s copper coil',detail:'A lantern part from the Broken Mill.'},journal:{name:'Eren’s journal',detail:'A millwright’s account of the failing lanterns.'},lens:{name:'Archive lens',detail:'Glass that gathers light from remembered places.'},medallion:{name:'River medallion',detail:'Orin’s keepsake, engraved with his sister Elin’s name.'},lantern:{name:'Keeper’s lantern',detail:'Reveals beacons and channels lantern fire.'},bell:{name:'The drowned bell',detail:'A small bronze chapel bell.'},pearl:{name:'Singing pearl',detail:'Hums when held near a lantern.'},ledger:{name:'Redwake ledger',detail:'Evidence of ships deliberately led into danger.'},locket:{name:'Elin’s locket',detail:'A portrait and a letter, preserved behind silver.'},verse:{name:'The final verse',detail:'The forgotten ending of the keepers’ oath.'},seed:{name:'Silver seed',detail:'The last seed of an ancient orchard.'},map:{name:'Watchfire chart',detail:'Paths drawn by the old road wardens.'},crown:{name:'Empty crown',detail:'An emblem of service rather than wealth.'},heart:{name:'The lantern heart',detail:'The Gate’s source of stolen light.'},sword:{name:'Tempered blade',detail:'Equip: 17 blade damage.',price:45},armor:{name:'Riveted coat',detail:'Equip: reduces incoming damage by 4.',price:35},bow:{name:'Yew bow',detail:'Equip: ranged attacks up to 7 paces.',price:40},ring:{name:'Warden’s ring',detail:'A reward for protecting the towns.'}
};
export const BUILDINGS=[],PROPS=[],NPCS=[],MAPS={},PORTALS=[];
const roles=['keeper','scholar','smith','healer','baker','farmer','merchant','guard','ranger','innkeeper','guard'],sprites=[3,4,5,6,7,8,9,2,12,10,2];
const jobs={keeper:'tending the square',scholar:'studying old records',smith:'working the forge',healer:'preparing remedies',baker:'baking bread',farmer:'tending the crops',merchant:'keeping shop',guard:'patrolling the road',ranger:'checking the woodline',innkeeper:'serving the evening meal'};
const layouts=[[-22,-21,9,8,'archive'],[-9,-21,9,8,'forge'],[4,-21,9,8,'clinic'],[17,-21,9,8,'bakery'],[-22,-7,9,9,'inn'],[17,-7,9,9,'shop'],[-22,9,9,8,'home'],[-9,9,9,8,'home'],[4,9,9,8,'home'],[17,9,9,8,'farm']];
const decor={archive:[['bookcase',2,2],['bookcase',5,2],['table',4,4],['lamp',7,2],['chest',2,5]],forge:[['anvil',3,3],['oven',6,2],['barrels',2,5],['table',6,5]],clinic:[['bed',2,2],['bed',6,2],['alchemy',4,4],['bookcase',6,5]],bakery:[['oven',2,2],['table',5,3],['barrels',2,5],['table',6,5]],inn:[['bed',2,2],['bed',6,2],['table',3,5],['table',6,5],['brazier',4,2]],shop:[['barrels',2,2],['chest',6,2],['table',4,4],['bookcase',6,6]],home:[['bed',2,2],['table',5,4],['bookcase',6,2],['chest',2,5]],farm:[['bed',2,2],['table',5,4],['barrels',6,2],['oven',2,5]]};
export const PROP_SPRITES={tree:0,pine:1,autumn:2,bare:3,rock:4,flowers:5,well:6,lamp:7,stall:8,cart:9,boat:10,fountain:11,bed:12,table:13,bookcase:14,anvil:15,oven:16,chest:17,alchemy:18,barrels:19,beacon:20,grave:21,crystal:22,brazier:23};
function addProp(map,id,type,x,y,extra={}){const p={id,map,type,x,y,...extra};PROPS.push(p);return p;}
function line(grid,w,a,b,r=1){let x=a.x,y=a.y;const paint=()=>{for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){if(x+i<1||y+j<1||x+i>=w-1||y+j>=w-1)continue;const k=(y+j)*w+x+i;grid[k]=grid[k]===T.water?T.bridge:T.path;}};paint();while(x!==b.x){x+=Math.sign(b.x-x);paint();}while(y!==b.y){y+=Math.sign(b.y-y);paint();}}
const ground=new Uint8Array(SIZE*SIZE);
for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){let tile=T.grass;const n=hash(x,y),river=184+Math.sin(x/29)*7;if(y<92)tile=T.snow;else if(x>290&&y>155)tile=T.sand;else if(x>220&&y>275)tile=T.marsh;if(n<.12&&tile!==T.sand)tile=T.tree;if(x<9||y<9||x>SIZE-10||y>SIZE-10||Math.abs(y-river)<2.4)tile=T.water;ground[y*SIZE+x]=tile;}
for(const town of TOWNS)for(let y=town.y-26;y<=town.y+24;y++)for(let x=town.x-27;x<=town.x+28;x++)ground[y*SIZE+x]=town.y<92?T.snow:T.grass;
for(const [a,b] of [[0,1],[0,3],[1,2],[1,7],[2,8],[3,4],[4,5],[5,6],[6,8],[7,8],[2,3],[5,8]])line(ground,SIZE,{x:TOWNS[a].x+1,y:TOWNS[a].y+3},{x:TOWNS[b].x+1,y:TOWNS[b].y+3},1);
for(const site of SITES){const nearest=TOWNS.toSorted((a,b)=>dist(a,site)-dist(b,site))[0];line(ground,SIZE,nearest,site,1);for(let y=site.y-4;y<=site.y+4;y++)for(let x=site.x-4;x<=site.x+4;x++)ground[y*SIZE+x]=T.stone;PORTALS.push({id:'entry-'+site.id,map:'overworld',x:site.x,y:site.y,to:site.id+'-1',tx:24,ty:43,name:site.name,kind:'entrance'});addProp('overworld','monument-'+site.id,'beacon',site.x,site.y-2,{name:site.name,site:site.id});}
for(const town of TOWNS){
 line(ground,SIZE,{x:town.x-25,y:town.y+3},{x:town.x+26,y:town.y+3},1);line(ground,SIZE,{x:town.x+1,y:town.y-24},{x:town.x+1,y:town.y+23},1);
 for(let i=0;i<layouts.length;i++){
  const [baseX,baseY,baseW,baseH,kind]=layouts[i],dx=baseX+(Math.floor(hash(town.x,i)*3)-1),dy=baseY+(Math.floor(hash(town.y,i)*3)-1),w=baseW+(hash(i,town.x)>.55?1:0),h=baseH+(hash(i,town.y)>.6?1:0),b={id:town.id+'-b'+i,map:'overworld',town:town.id,x:town.x+dx,y:town.y+dy,w,h,kind,name:kind==='home'?`${town.names[i%11]}’s cottage`:town.name+' '+{archive:'Archive',forge:'Forge',clinic:'Infirmary',bakery:'Bakehouse',inn:'Lantern & Lark Inn',shop:'Trading House',farm:'Farmhouse'}[kind],color:town.color};b.door={x:b.x+Math.floor(w/2),y:b.y+h-1};BUILDINGS.push(b);
  line(ground,SIZE,{x:b.door.x,y:b.door.y+1},{x:b.door.x,y:town.y+3},0);
  for(let y=b.y;y<b.y+h;y++)for(let x=b.x;x<b.x+w;x++)ground[y*SIZE+x]=(x===b.x||x===b.x+w-1||y===b.y||y===b.y+h-1)?T.wall:T.floor;ground[b.door.y*SIZE+b.door.x]=T.floor;
  addProp('overworld',b.id+'-door','door',b.door.x,b.door.y,{building:b.id,name:b.name});
  for(let p=0;p<decor[kind].length;p++){const [type,px,py]=decor[kind][p];addProp('overworld',b.id+'-p'+p,type,b.x+(hash(town.x,i)>.5?w-1-px:px),b.y+(hash(town.y,i)>.5?h-1-py:py),{rotation:hash(town.x,p)>.65?Math.PI:0,building:b.id,name:{bed:'A clean bed',table:'A laid table',bookcase:'Books and records',anvil:'The working anvil',oven:'A warm oven',chest:'A wooden chest',alchemy:'An alchemy bench',barrels:'Stored provisions',lamp:'An oil lamp',brazier:'The hearth'}[type]});}
 }
 for(const [suffix,type,dx,dy,name] of [['well','well',5,0,town.name+' well'],['notice','notice',8,4,town.name+' noticeboard'],['shrine','beacon',-3,-3,'Wayfarer shrine'],['stall','stall',-7,0,'Market stall'],['cart','cart',10,7,'Roadwarden’s wagon']])addProp('overworld',town.id+'-'+suffix,type,town.x+dx,town.y+dy,{name,town:town.id});
 for(let j=0;j<6;j++)addProp('overworld',town.id+'-lamp'+j,'lamp',town.x-12+j*7,town.y+6,{name:'Street lantern'});
 const homes=BUILDINGS.filter(b=>b.town===town.id);for(let i=0;i<town.names.length;i++){const role=roles[i],work=homes[[0,0,1,2,3,9,5,5,9,4,0][i]],home=homes[6+i%4];const id=town.id==='hearth'?town.names[i].toLowerCase():town.id+'-'+i;NPCS.push({id,name:town.names[i],role,town:town.id,sprite:sprites[i],map:'overworld',x:role==='keeper'?town.x+3:work.x+4,y:role==='keeper'?town.y+4:work.y+5,home:{x:home.x+3+i%2,y:home.y+3},work:{x:work.x+4,y:work.y+5},meal:{x:homes[4].x+3+i%3,y:homes[4].y+5},square:{x:town.x-4+i%5*2,y:town.y+7},job:jobs[role],hp:role==='guard'?95:48,attack:role==='guard'?12:role==='ranger'?10:4});}
}
// Each settlement has a genuine purchasable cottage and a public burial ground.
for(const town of TOWNS){
 const b={id:town.id+'-house',map:'overworld',town:town.id,x:town.x+30,y:town.y+10,w:10,h:9,kind:'home',purchasable:true,price:180,name:town.name+' Wayside Cottage',color:town.color};b.door={x:b.x+4,y:b.y+b.h-1};BUILDINGS.push(b);
 for(let y=b.y-6;y<b.y+b.h+6;y++)for(let x=b.x-6;x<b.x+b.w+6;x++)if([T.grass,T.tree,T.snow].includes(ground[y*SIZE+x]))ground[y*SIZE+x]=town.y<92?T.snow:T.grass;
 line(ground,SIZE,{x:b.door.x,y:b.door.y+1},{x:town.x+26,y:town.y+3},0);
 for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)ground[y*SIZE+x]=(x===b.x||x===b.x+b.w-1||y===b.y||y===b.y+b.h-1)?T.wall:T.floor;
 ground[b.door.y*SIZE+b.door.x]=T.floor;addProp('overworld',b.id+'-door','door',b.door.x,b.door.y,{building:b.id,name:b.name});
 addProp('overworld',b.id+'-deed','property',b.x+4,b.y+b.h+2,{building:b.id,name:'Cottage for sale · 180 gold'});
 const gx=town.x-32,gy=town.y+16;line(ground,SIZE,{x:gx,y:gy},{x:town.x-25,y:town.y+3},0);
 for(let y=gy-5;y<=gy+5;y++)for(let x=gx-5;x<=gx+5;x++)ground[y*SIZE+x]=T.grass;
 for(let n=0;n<9;n++)addProp('overworld',town.id+'-grave'+n,'grave',gx-3+(n%3)*3,gy-3+Math.floor(n/3)*3,{name:town.name+' memorial',text:['A name weathered from the stone. Someone still brings fresh flowers.','A roadwarden rests here, beside the road they kept safe.','The inscription asks travelers to remember the living.'][n%3]});
 addProp('overworld',town.id+'-grave-lamp','lamp',gx+4,gy+4,{name:'Memorial lantern'});addProp('overworld',town.id+'-farmwork','farmwork',town.x+25,town.y+19,{name:'The kitchen garden',town:town.id});
}
const monuments=[['waterwheel','The Eren Wheel','Hearthwick’s first mill wheel was preserved here when the river changed course. Ada still oils its axle.'],['heron','The Ferryman’s Heron','A copper heron faces the flooded chapel. Its pedestal lists every ferryman who made the last crossing.'],['anvil-monument','The Founders’ Anvil','Copperfell’s first communal forge stood here. The anvil was raised after the miners bought the quarry together.'],['ship','The Harbor Promise','A carved vessel remembers the fishing crews who carried their neighbors through the storm.'],['watchtower','The Coast Lantern','A tall public lantern marks the honest harbor road. Its flame is tended by the watch.'],['fountain','The Silver Basin','Water passes through three stone bowls, each donated by a different shipwright family.'],['obelisk','The Winter Oath','A frost-veined pillar bears the names of households who shared fuel through the longest winter.'],['root-arch','The Rootbound Arch','Two living trees meet above the old road. The orchard agreements were first spoken beneath them.'],['orrery','The Dawn Orrery','A brass model traces the sun’s path over nine stones, one for every settlement in the Marches.']];
for(let i=0;i<TOWNS.length;i++){const t=TOWNS[i],[shape,name,text]=monuments[i];addProp('overworld',t.id+'-landmark','landmark',t.x+7,t.y-6,{shape,name,text,town:t.id});}
MAPS.overworld={id:'overworld',name:'The Nine Marches',w:SIZE,h:SIZE,tiles:ground,outdoor:true};
for(let si=0;si<SITES.length;si++)for(let level=1;level<=2;level++){
 const site=SITES[si],id=site.id+'-'+level,w=48,h=48,tiles=new Uint8Array(w*h).fill(T.wall),shift=(si+level)%4,rooms=[[4+shift%2,4,11+shift,11+level],[28+shift%2,4+shift,15-shift,13],[4,28+shift%2,12+level,14-shift],[28,28,13+level,12+shift%2],[18+shift,18,11,11+level]];const dig=(x,y)=>{if(x>0&&y>0&&x<w-1&&y<h-1)tiles[y*w+x]=site.kind==='haunted'||site.kind==='cellar'?T.floor:T.stone;};
 for(const [x,y,rw,rh] of rooms)for(let yy=y;yy<y+rh;yy++)for(let xx=x;xx<x+rw;xx++)dig(xx,yy);
 for(let x=9;x<=37;x++)for(let d=-1;d<=1;d++){dig(x,10+d);dig(x,35+d);dig(x,24+d);}for(let y=9;y<=44;y++)for(let d=-1;d<=1;d++){dig(10+d,y);dig(24+d,y);dig(36+d,y);}
 // Optional chambers and broken corridors vary by site while the story route remains connected.
 for(let a=0;a<3;a++){const ax=3+Math.floor(hash(si,a,level)*35),ay=17+Math.floor(hash(si,a+8,level)*8);for(let y=ay;y<ay+4;y++)for(let x=ax;x<ax+6;x++)dig(x,y);for(let x=Math.min(ax,24);x<=Math.max(ax,24);x++)dig(x,ay+2);}
 MAPS[id]={id,name:site.name+' · '+(level===1?'Upper chambers':'Deep chambers'),w,h,tiles,outdoor:false,site:site.id,level,theme:site.kind};
 PORTALS.push({id:id+'-up',map:id,x:24,y:43,to:level===1?'overworld':site.id+'-1',tx:level===1?site.x:36,ty:level===1?site.y+1:9,name:level===1?'Return to the open road':'Upper chambers',kind:'stairsUp'});
 if(level===1)PORTALS.push({id:id+'-down',map:id,x:36,y:8,to:site.id+'-2',tx:24,ty:42,name:'Descend to the deep chambers',kind:'stairsDown'});
 addProp(id,id+'-lore','bookcase',10,8,{name:level===1?'A weathered inscription':'The surviving account',text:level===1?site.lore:deepRecords[site.id]});addProp(id,id+'-chest','chest',9,33,{name:'An old supply chest'});addProp(id,id+'-crystal','crystal',37,34,{name:'A luminous crystal'});
 const dungeonDecor=site.kind==='haunted'?['bed','table','bookcase']:['crypt','abbey'].includes(site.kind)?['grave','grave','beacon']:site.kind==='archive'?['bookcase','table','alchemy']:site.kind==='roots'?['bare','flowers','rock']:['rock','crystal','barrels'];
 for(let d=0;d<9;d++){const px=[6,14,31,40,6,15,31,40,23][d],py=[6,14,6,14,31,39,31,39,20][d];dig(px,py);addProp(id,id+'-decor'+d,dungeonDecor[d%3],px,py,{name:{grave:'A forgotten grave',rock:'Mineral-veined stone',crystal:'A luminous crystal',barrels:'Ancient supplies',bed:'An abandoned bed',table:'A table set for the absent',bookcase:'Records of the keepers',beacon:'A silent memorial',alchemy:'An old alchemy bench',bare:'Roots in the dark',flowers:'Pale underground flowers'}[dungeonDecor[d%3]],text:site.lore});}
 for(const [j,xy] of [[0,[7,13]],[1,[32,13]],[2,[7,37]],[3,[32,37]],[4,[22,22]]])addProp(id,id+'-bra'+j,'brazier',...xy,{name:'An ancient brazier'});
 if(level===2){addProp(id,site.id+'-relic','relic',10,10,{name:ITEMS[site.relic].name,item:site.relic});if(site.id==='mill')addProp(id,'eren-journal','relic',12,10,{name:'Eren’s journal',item:'journal'});}
 if(site.id==='gate'&&level===2){for(const [j,name] of ['Dawn','Tide','Night'].entries())addProp(id,'beacon-'+j,'beacon',20+j*4,23,{name:name+' beacon',beacon:j});addProp(id,'lantern-gate','gate',36,6,{name:'The Lantern Gate'});}
}
export const quests=[
 {id:'keepers',title:'A Light for Every Road',giver:'mara',kind:'main',desc:'Follow the broken lanterns from Hearthwick to the Gate. The people of the Nine Marches each hold a part of the story.',reward:100},
 {id:'medicine',title:'The Moonleaf Remedy',giver:'orin',kind:'gather',item:'leaf',count:3,desc:'Gather three moonleaf for Orin. He will tell you why his sister never came home.',reward:18},
 {id:'millwright',title:'The Millwright’s Last Page',giver:'ada',kind:'deliver',item:'journal',count:1,desc:'Recover Eren’s journal from the Broken Mill’s deep cellar and bring it to Ada.',reward:25},
 {id:'lantern',title:'Memory, Copper, and Mercy',giver:'tamsin',kind:'craft',desc:'Bring Tamsin the copper coil from the mill and the lens from the Sunken Archive.',reward:30},
 {id:'bell',title:'For Those Below the Water',giver:'willow-0',kind:'deliver',item:'bell',count:1,desc:'Recover the drowned bell. Iona wants to ring it for the people lost in the flood.',reward:35},
 {id:'iron',title:'Iron for the Watch',giver:'copper-2',kind:'gather',item:'ore',count:3,desc:'Bring Kestrel three pieces of cinder iron to repair the town guard’s armor.',reward:40},
 {id:'pearl',title:'The False Lighthouse',giver:'reed-0',kind:'deliver',item:'pearl',count:1,desc:'Find the singing pearl in the salt caves. It distinguishes the harbor light from the lure.',reward:40},
 {id:'ledger',title:'Redwake’s Reckoning',giver:'salt-0',kind:'choice',item:'ledger',count:1,desc:'Recover the fort ledger. Choose between exposing the captain publicly and securing restitution.',reward:45},
 {id:'locket',title:'A Place at the Table',giver:'grey-1',kind:'deliver',item:'locket',count:1,desc:'Find Elin’s locket in Briarglass Manor. Lowen suspects a connection to the Gate.',reward:40},
 {id:'verse',title:'The Unwritten Ending',giver:'high-1',kind:'deliver',item:'verse',count:1,desc:'Bring Isolde the oath’s final verse from the Frostbound Abbey.',reward:45},
 {id:'seed',title:'An Orchard for Tomorrow',giver:'thorn-5',kind:'deliver',item:'seed',count:1,desc:'Return the silver seed to Hester. The old orchard can take root again.',reward:35},
 {id:'chart',title:'Roads That Remember',giver:'sun-1',kind:'deliver',item:'map',count:1,desc:'Recover the watchfire chart from Moonwatch Ruins for Lysander.',reward:35},
 {id:'crown',title:'The Weight of a Crown',giver:'reed-1',kind:'deliver',item:'crown',count:1,desc:'Recover the empty crown from the Whispering Barrow for Neris.',reward:45},
 {id:'watch',title:'When the Bells Sound',giver:'galen',kind:'defend',count:1,desc:'Help defeat a town raid, then report to Galen. Protect the residents as well as the street.',reward:50},
 {id:'traveler',title:'Nine Fires, One Country',giver:'mara',kind:'explore',count:9,desc:'Visit all nine settlements. Return to Mara with news of the roads.',reward:70},
 {id:'ruins',title:'Beneath the Marches',giver:'sun-4',kind:'exploreSites',count:8,desc:'Explore eight deep sites and report to Juniper.',reward:60},
 ...TOWNS.filter(t=>t.id!=='hearth').map((t,i)=>({id:'provisions-'+t.id,title:['A Winter Pantry','Bread for the Ferrymen','The Miners’ Supper','The Harbor Table','The Watchmen’s Lunch','A Warm Welcome','Seeds and Supper','Market Morning'][i],giver:t.id+'-9',kind:'gather',item:i%2?'bread':'fish',count:3,desc:`Bring three ${i%2?'loaves of bread':'river trout'} to ${t.names[9]} at ${t.name}’s inn. The shared table is running short.`,reward:22})),
 {id:'salves',title:'A Healer’s Apprenticeship',giver:'willow-3',kind:'gather',item:'salve',count:3,desc:'Use an alchemy bench to make three salves for Sella.',reward:30},
 {id:'timber',title:'The Roadwardens’ Shelter',giver:'salt-2',kind:'gather',item:'wood',count:5,desc:'Gather five seasoned branches for Dain to repair the road shelter.',reward:28}
];
export function tileAt(map,x,y){const m=MAPS[map];x=Math.floor(x);y=Math.floor(y);return !m||x<0||y<0||x>=m.w||y>=m.h?T.wall:m.tiles[y*m.w+x];}
export function solid(map,x,y){return [T.wall,T.water,T.tree].includes(tileAt(map,x,y));}
export function buildingAt(x,y){return BUILDINGS.find(b=>x>b.x&&x<b.x+b.w-1&&y>b.y&&y<b.y+b.h-1);}
export function townAt(x,y,range=42){return TOWNS.find(t=>Math.abs(t.x-x)<range&&Math.abs(t.y-y)<range);}
export function nearestTown(x,y){return TOWNS.toSorted((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];}
export function sceneryAt(map,x,y){if(map!=='overworld')return null;const tile=tileAt(map,x,y),n=hash(x,y,8),town=townAt(x,y,27);if(tile===T.tree)return {type:y<100?'pine':n<.13?'fruit':x<110?'autumn':'tree',x,y};if([T.grass,T.snow,T.marsh].includes(tile)&&n<(town?.023:.017))return {type:town?(n<.004?'fruit':'flowers'):n<.012?'rock':'flowers',x,y};return null;}
export function gatherables(map,x,y){if(map!=='overworld'||solid(map,x,y)||townAt(x,y,25)||![T.grass,T.snow,T.marsh].includes(tileAt(map,x,y)))return null;const n=hash(x,y,19);if(n<.008)return {id:`leaf-${x}-${y}`,map,x,y,type:'plant',item:'leaf',name:'Moonleaf'};if(n<.014)return {id:`wood-${x}-${y}`,map,x,y,type:'branch',item:'wood',name:'Seasoned branch'};if(n<.017)return {id:`ore-${x}-${y}`,map,x,y,type:'ore',item:'ore',name:'Cinder iron'};return null;}
for(const [i,p] of [[0,[104,319]],[1,[112,315]],[2,[91,320]]]){addProp('overworld','starter-leaf-'+i,'plant',...p,{item:'leaf',name:'Moonleaf'});ground[p[1]*SIZE+p[0]]=T.grass;}
for(const [i,p] of [[0,[8,31]],[1,[14,34]],[2,[32,38]]])addProp('quarry-1','quarry-ore-'+i,'ore',...p,{item:'ore',name:'Cinder iron'});
export const worldStats=()=>({surfaceTiles:SIZE*SIZE,towns:TOWNS.length,buildings:BUILDINGS.length,npcs:NPCS.length,sites:SITES.length,dungeonFloors:Object.keys(MAPS).length-1,quests:quests.length,props:PROPS.length});

applyRoadLayout(ground);
applyResidentRoutines(NPCS);

installCastle({T,MAPS,SITES,PORTALS,PROPS,BUILDINGS,TOWNS});
installSleepyHollow({T,MAPS,TOWNS,BUILDINGS,PROPS,NPCS});
