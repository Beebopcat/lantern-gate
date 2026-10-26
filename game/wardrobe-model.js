import * as THREE from './vendor/three.js';
const skirtGeometry=new THREE.LatheGeometry([new THREE.Vector2(.36,0),new THREE.Vector2(.30,.24),new THREE.Vector2(.245,.55),new THREE.Vector2(.23,.72)],16);
const smockGeometry=new THREE.LatheGeometry([new THREE.Vector2(.29,0),new THREE.Vector2(.27,.24),new THREE.Vector2(.22,.55)],16);
// All pieces are welded into the existing joints by characters.js. Clothing does not add draw calls.
export function dressCharacter(f,look,rig){
 if(!look)return;const {spine,pelvis,head,arms}=rig,coat=look.coat,trim=look.trim,dark='#34302e',gold='#caa977';
 const box=(g,x,y,z,w,h,d,c=trim)=>f.box(g,x,y,z,w,h,d,c);
 const ball=(g,x,y,z,w,h,d,c=trim)=>f.ball(g,x,y,z,w,h,d,c);
 const cone=(g,x,y,z,w,h,d,c=coat)=>f.mesh(g,'cone',x,y,z,w,h,d,f.mat(c));
 const ring=(g,x,y,z,w,h,d,c=trim)=>f.mesh(g,'torus',x,y,z,w,h,d,f.mat(c));
 const line=(g,a,b,r=.016,c=trim)=>f.beam(g,new THREE.Vector3(...a),new THREE.Vector3(...b),r,c);
 if(['gown','longcoat','smock'].includes(look.style)){
  const mesh=new THREE.Mesh(look.style==='smock'?smockGeometry:skirtGeometry,f.mat(coat));mesh.position.y=look.style==='smock'?-.46:-.68;mesh.scale.z=.75;mesh.castShadow=true;pelvis.add(mesh);
  for(const x of [-.20,0,.20])box(pelvis,x,-.37,.206,.018,.48,.025,trim);
 }
 if(look.style==='vest'){for(const x of [-.14,.14])box(spine,x,.30,.195,.185,.40,.044,coat);box(spine,0,.32,.221,.028,.40,.026,trim);}
 if(look.style==='apron'){box(spine,0,.29,.215,.32,.44,.028,trim);box(pelvis,0,-.28,.20,.37,.57,.025,trim);box(pelvis,0,-.17,.221,.23,.19,.02,coat);}
 if(look.style==='shawl'){for(const side of [-1,1]){const piece=box(spine,side*.14,.42,.16,.21,.34,.04,trim);piece.rotation.z=side*.53;}ball(spine,0,.36,.221,.042,.042,.02,gold);}
 if(look.style==='cloak'&&!rig.cape){for(let i=0;i<5;i++){const panel=box(spine,(i-2)*.085,.04,-.215,.095,.92,.045,coat);panel.rotation.z=(i-2)*.027;}}
 const brim=(r=.25,c=coat)=>f.cyl(head,0,.32,0,r,.036,c);
 const mask=(c=coat)=>{ball(head,0,.145,.14,.171,.105,.046,c);for(const x of [-.06,.06])ball(head,x,.15,.185,.028,.023,.014,dark);};
 const cap=(c=coat)=>ball(head,0,.29,-.01,.19,.10,.16,c);
 for(const part of look.accessories)switch(part){
  case 'cravat':box(spine,0,.51,.209,.09,.14,.035,trim);cone(spine,0,.41,.211,.056,.16,.025,trim);break;
  case 'pocketwatch':ball(spine,.16,.30,.228,.04,.045,.014,gold);line(spine,[.03,.35,.221],[.15,.31,.231],.01,gold);break;
  case 'rolledcuffs':for(const a of arms)f.cyl(a.elbow,0,-.17,0,.078,.12,trim);break;
  case 'pouch':ball(pelvis,.27,-.04,.06,.11,.135,.083,dark);box(pelvis,.27,.016,.142,.11,.036,.018,gold);break;
  case 'bonnet':ball(head,0,.29,-.04,.19,.13,.18,trim);for(const x of [-.165,.165])ball(head,x,.15,.002,.04,.11,.10,trim);box(head,0,-.02,.10,.055,.043,.021,coat);break;
  case 'wovenbelt':box(pelvis,0,.10,.025,.50,.10,.35,trim);for(let i=0;i<5;i++)box(pelvis,-.19+i*.095,.1,.21,.025,.07,.022,coat);break;
  case 'spectacles':for(const x of [-.06,.06])ring(head,x,.15,.157,.041,.031,.041,gold);box(head,0,.15,.16,.04,.01,.012,gold);break;
  case 'brooch':ball(spine,.14,.46,.20,.047,.047,.020,gold);ball(spine,.14,.46,.226,.025,.025,.012,trim);break;
  case 'scarf':f.cyl(spine,0,.60,0,.12,.115,trim);box(spine,.074,.31,.21,.09,.52,.028,trim);break;
  case 'buttons':for(let i=0;i<5;i++)ball(spine,0,.14+i*.077,.206,.025,.025,.019,trim);break;
  case 'hood':ball(head,0,.23,-.05,.204,.22,.174,coat);for(const x of [-.17,.17])box(head,x,.11,.02,.036,.31,.10,coat);break;
  case 'satchel':box(pelvis,.32,-.02,-.07,.18,.29,.22,dark);box(pelvis,.32,.04,.05,.19,.075,.025,trim);line(spine,[-.18,.52,.18],[.25,.08,.18],.025,dark);break;
  case 'headscarf':cap(trim);box(head,.12,.03,-.105,.095,.31,.034,trim);break;
  case 'necklace':for(let i=0;i<7;i++)ball(spine,(i-3)*.027,.52-Math.sin(i*Math.PI/6)*.065,.197,.016,.016,.01,gold);break;
  case 'tophat':brim(.24);f.cyl(head,0,.46,0,.155,.28,coat);f.cyl(head,0,.345,0,.159,.035,trim);break;
  case 'feathercap':cap();brim(.22);line(head,[.14,.33,-.06],[.19,.59,-.075],.03,trim);break;
  case 'bracers':for(const a of arms){f.cyl(a.elbow,0,-.14,0,.077,.21,dark);for(const y of [-.05,-.20])f.cyl(a.elbow,0,y,0,.079,.025,gold);}break;
  case 'gloves':for(const a of arms)ball(a.wrist,0,-.055,.007,.06,.082,.048,trim);break;
  case 'flatcap':ball(head,0,.29,-.016,.18,.075,.16,coat);box(head,0,.27,.147,.25,.025,.14,trim);break;
  case 'witchhat':brim(.31);{const hat=cone(head,0,.60,0,.23,.61,.21);hat.rotation.z=.12;}f.cyl(head,0,.365,0,.225,.07,trim);break;
  case 'broom':f.cyl(arms[1].wrist,.015,.27,.03,.019,1.1,dark);for(let i=0;i<6;i++)line(arms[1].wrist,[.015,-.20,.03],[(i-2.5)*.035,-.45,.03],.026,'#b7a36c');break;
  case 'starhat':brim(.24);cone(head,0,.58,0,.20,.53,.18);ball(head,0,.44,.173,.042,.05,.015,gold);break;
  case 'stars':for(let i=0;i<4;i++){const x=(i%2-.5)*.25,y=.20+Math.floor(i/2)*.17;box(spine,x,y,.215,.017,.083,.016,trim);box(spine,x,y,.217,.083,.017,.016,trim);}break;
  case 'goggles':for(const x of [-.065,.065]){ring(head,x,.16,.167,.048,.043,.048,gold);ball(head,x,.16,.174,.039,.034,.016,'#729693');}break;
  case 'gears':for(const [x,y] of [[-.11,.35],[.1,.22]]){ring(spine,x,y,.219,.061,.061,.061,gold);for(let i=0;i<6;i++){const a=i*Math.PI/3;box(spine,x+Math.cos(a)*.065,y+Math.sin(a)*.065,.22,.022,.023,.02,gold);}}break;
  case 'ravenmask':mask(dark);cone(head,0,.125,.29,.055,.27,.055,dark).rotation.x=Math.PI/2;break;
  case 'feathers':for(const side of [-1,1])for(let i=0;i<4;i++){const leaf=cone(spine,side*(.20+i*.033),.49-i*.025,-.04,.055,.17,.044,trim);leaf.rotation.z=side*(.75+i*.17);}break;
  case 'pumpkinhat':ball(head,0,.28,0,.227,.166,.21,'#b96b26');f.cyl(head,0,.47,0,.032,.14,'#665434');for(const x of [-.07,.07])cone(head,x,.32,.189,.041,.066,.02,'#493528').rotation.z=Math.PI;break;
  case 'vines':for(let i=0;i<5;i++){const x=Math.sin(i*1.9)*.2;line(spine,[x,.1+i*.09,.211],[x+.025,.17+i*.09,.218],.014,'#6f8751');ball(spine,x+.027,.16+i*.09,.223,.033,.016,.018,trim);}break;
  case 'ghosthood':ball(head,0,.22,-.03,.219,.27,.188,trim);for(const x of [-.064,.064])ball(head,x,.15,.153,.035,.049,.019,dark);break;
  case 'chains':for(let i=0;i<7;i++)ring(spine,(i-3)*.055,.17+Math.abs(i-3)*.06,.22,.032,.043,.032,'#969992');break;
  case 'skullmask':mask('#d4cdb7');for(const x of [-.065,.065])ball(head,x,.155,.187,.043,.040,.014,dark);for(let i=0;i<5;i++)box(head,(i-2)*.026,.078,.169,.016,.025,.019,dark);break;
  case 'candlecrown':for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.sin(a)*.16,z=Math.cos(a)*.13;f.cyl(head,x,.42,z,.021,.20,'#e4d1a4');cone(head,x,.555,z,.026,.07,.026,'#edb974');}brim(.19,gold);break;
  case 'mothmask':mask(trim);for(const side of [-1,1])line(head,[side*.09,.24,.08],[side*.15,.47,.075],.015,gold);break;
  case 'wings':for(const side of [-1,1]){const wing=ball(spine,side*.30,.34,-.17,.31,.41,.045,trim);wing.rotation.z=-side*.48;for(let i=0;i<3;i++)ball(spine,side*(.30+i*.04),.30+i*.08,-.226,.033,.044,.012,coat);}break;
  case 'tricorn':cap();for(const side of [-1,1]){const brimPiece=box(head,side*.11,.315,0,.23,.12,.26);brimPiece.rotation.z=side*.45;}break;
  case 'vampirecollar':for(const side of [-1,1]){const collar=box(spine,side*.145,.67,-.076,.15,.27,.036,trim);collar.rotation.z=-side*.3;}break;
  case 'medallion':f.cyl(spine,0,.63,0,.105,.05,trim);ball(spine,0,.45,.222,.057,.061,.018,gold);break;
  case 'strawhat':brim(.29,'#baa271');cone(head,0,.40,0,.17,.19,.17,'#a58c5b');break;
  case 'straw':for(const side of [-1,1])for(let i=0;i<4;i++)line(spine,[side*.20,.50,0],[side*(.29+i*.015),.58-i*.025,0],.012,trim);break;
  case 'bones':for(const x of [-.1,.1])for(let i=0;i<4;i++)box(spine,x,.18+i*.065,.214,.17,.021,.019,trim);box(spine,0,.26,.216,.023,.35,.02,trim);break;
  case 'turban':for(let i=0;i<3;i++){const band=ball(head,0,.29+i*.029,-.015,.187-i*.014,.055,.164-i*.01,trim);band.rotation.z=i*.18;}ball(head,0,.35,.14,.042,.047,.018,gold);break;
  case 'plaguemask':mask('#b1b29c');{const beak=cone(head,0,.095,.30,.075,.36,.075,'#9da087');beak.rotation.x=Math.PI/2;}break;
  case 'horns':for(const side of [-1,1]){const horn=cone(head,side*.135,.42,-.01,.057,.30,.051,trim);horn.rotation.z=-side*.3;}break;
  case 'dragonwings':for(const side of [-1,1]){const wing=cone(spine,side*.34,.29,-.12,.27,.59,.038,trim);wing.rotation.z=-side*.7;line(spine,[0,.49,-.2],[side*.55,.43,-.2],.022,coat);}break;
  case 'goblinears':for(const side of [-1,1]){const ear=cone(head,side*.22,.17,0,.067,.31,.045,trim);ear.rotation.z=-side*1.10;}break;
  case 'jesterhat':cap();for(const side of [-1,1]){const point=cone(head,side*.14,.43,0,.09,.24,.074);point.rotation.z=-side*.75;ball(head,side*.25,.51,0,.034,.034,.034,gold);}break;
  case 'bells':for(const x of [-.18,0,.18])ball(spine,x,.48,.213,.035,.036,.026,gold);break;
  case 'catears':for(const x of [-.13,.13])cone(head,x,.38,0,.068,.21,.055,dark);mask(coat);break;
  case 'tail':line(pelvis,[0,-.07,-.16],[.10,-.39,-.43],.047,coat);line(pelvis,[.1,-.39,-.43],[.29,-.38,-.54],.039,coat);break;
  case 'spidercrown':brim(.20,dark);for(const side of [-1,1])for(let i=0;i<3;i++)line(head,[side*.12,.33,0],[side*(.24+i*.026),.42+i*.025,-.04],.012,trim);break;
  case 'spiderlegs':for(const side of [-1,1])for(let i=0;i<3;i++){const y=.48-i*.13;line(spine,[side*.18,y,-.14],[side*.43,y+.10,-.20],.02,coat);line(spine,[side*.43,y+.10,-.20],[side*.56,y-.13,-.15],.015,trim);}break;
  case 'antlers':for(const side of [-1,1]){line(head,[side*.1,.29,0],[side*.16,.64,-.04],.025,trim);for(let i=0;i<3;i++)line(head,[side*.145,.43+i*.065,-.02],[side*(.23+i*.024),.52+i*.075,-.02],.017,trim);}break;
  case 'leaves':for(let i=0;i<5;i++){const leaf=ball(spine,(i-2)*.065,.53-Math.abs(i-2)*.035,.21,.05,.024,.024,trim);leaf.rotation.z=i*.7;}break;
  case 'wolfmask':mask();for(const x of [-.14,.14])cone(head,x,.32,-.01,.07,.17,.055);ball(head,0,.12,.213,.065,.044,.08,trim);break;
  case 'eyepatch':ball(head,-.06,.15,.16,.037,.027,.015,dark);line(head,[-.14,.13,.1],[.14,.18,.1],.01,dark);break;
  case 'crystalcrown':brim(.18,trim);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cone(head,Math.sin(a)*.15,.44,Math.cos(a)*.12,.035,.24,.035,trim);}break;
  case 'frogmask':mask('#698764');for(const side of [-1,1]){ball(head,side*.083,.256,.10,.066,.06,.035,'#81926a');ball(head,side*.083,.26,.132,.024,.028,.014,dark);}break;
  case 'crown':brim(.18,gold);for(const x of [-.12,0,.12])cone(head,x,.41,.1,.045,.15,.037,gold);break;
  case 'ribbon':for(const side of [-1,1]){const bow=cone(head,side*.055,.29,.12,.06,.1,.022,trim);bow.rotation.z=side*Math.PI/2;}break;
  case 'patches':for(let i=0;i<3;i++)box(spine,(i%2-.5)*.21,.18+i*.13,.215,.085,.105,.017,trim);break;
  case 'harlequinmask':mask(trim);ball(head,.062,.15,.193,.038,.027,.01,coat);break;
  case 'diamonds':for(let i=0;i<4;i++){const diamond=box(spine,(i%2-.5)*.20,.18+i*.075,.215,.056,.056,.017,trim);diamond.rotation.z=Math.PI/4;}break;
  case 'beehat':brim(.27,trim);f.cyl(head,0,.35,0,.194,.16,trim);for(const side of [-1,1])for(let i=0;i<4;i++)box(head,side*.177,.015+i*.05,.03,.014,.018,.26,coat);break;
 }
}
