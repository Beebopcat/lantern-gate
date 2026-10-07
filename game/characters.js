import * as THREE from './vendor/three.js';
import {dressCharacter} from './wardrobe-model.js';

// Rigid pieces are welded per joint, preserving articulation without a draw call per button or lock of hair.
const bodyGeometry = new THREE.LatheGeometry([
  new THREE.Vector2(.20,0),new THREE.Vector2(.235,.08),new THREE.Vector2(.22,.22),
  new THREE.Vector2(.25,.45),new THREE.Vector2(.225,.55),new THREE.Vector2(.11,.62)
],16);
const palette = {guard:'#54788b',keeper:'#8e4f58',scholar:'#777198',smith:'#8a7159',healer:'#5d9290',baker:'#d4c5a7',farmer:'#8a9560',merchant:'#985a7c',ranger:'#5b7960',innkeeper:'#657e97'};
const braided=new Set(['Mara','Ada','Tamsin','Nell','Edda','Iona','Sella','Tilda','Dara','Anwen','Beryl','Petra','Esme','Amity','Rilla','Ines','Elowen','Mercy','Tess','Maris','Una','Carys','Miri','Brigid','Yara','Isolde','Lenna','Lumi','Eira','Faye','Hazel','Saffron','Hester','Sorrel','Ysra','Dove','Juniper','Maeve','Nessa','Elin']);
const skinGeometry=new THREE.SphereGeometry(1,20,14);
export const characterSeed = a => Math.abs([...(a.name||a.id||'Wayfarer')].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0)|0,7));
export function weld(root,material) {
  for(const child of [...root.children]) if(child.isGroup) weld(child,material);
  const meshes=root.children.filter(o=>o.isMesh); if(!meshes.length)return;
  const positions=[],normals=[],colors=[];
  for(const m of meshes){m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);const p=g.attributes.position,n=g.attributes.normal,c=m.material.color;
    for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));colors.push(c.r,c.g,c.b);}g.dispose();root.remove(m);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=false;mesh.userData.ownedGeometry=true;root.add(mesh);
}
export function createCharacter(f,a,outfit) {
  const root=f.group(),seed=characterSeed(a),role=a.role||'traveler',enemy=a.type==='enemy',heavy=role==='guard'||a.kind==='bandit',scholar=role==='scholar',hero=a.id==='player'||a.type==='hero';
  const skin=({warm:'#d1a381',earth:'#936345',deep:'#6a4938',pale:'#e0b697',olive:'#b88360'}[a.skin])|| (a.kind==='zombie'?'#8b9a85':a.id==='castle-frankenstein'?'#9aa493':a.kind==='goblin'?'#849574':a.kind==='skeleton'?'#c9c8af':a.kind==='troll'?'#8b9077':['#d1a381','#936345','#e0b697','#6a4938','#b88360'][seed%5]),hair=({black:'#292b2d',brown:'#815d40',silver:'#b7b6ab',auburn:'#8b4b37',gold:'#bea176'}[a.hair])||['#352e28','#815d40','#bea176','#b7b6ab','#58332a'][Math.floor(seed/7)%5];
  const wardrobe=a.wardrobe,tint=new THREE.Color(wardrobe?.coat||outfit||({count:'#58263d',creation:'#4f605b','cursed keeper':'#64534d'}[role])||palette[role]||(enemy?'#65525c':'#347e80'));tint.offsetHSL((seed%9-4)*.006,0,(seed%7-3)*.009);
  const coat='#'+tint.getHexString(),lining=wardrobe?.trim||(hero?'#d2b67e':['#d7c7a3','#b7b5a6','#ddba91'][seed%3]),leather=heavy?'#414749':'#554336',metal=heavy?'#a5b3b5':'#c5ad76',pants=wardrobe?.pants||(scholar?'#5a5265':'#4e4b44');
  const joint=(parent,name,x=0,y=0,z=0)=>{const g=f.group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
  const capsule=(g,x,y,z,w,h,d,c)=>{const mesh=f.ball(g,x,y,z,w,h,d,c);mesh.geometry=skinGeometry;return mesh;};
  const pelvis=joint(root,'pelvis',0,.95,0),spine=joint(pelvis,'spine',0,.02,0),head=joint(spine,'head',0,.67,0);
  const torso=new THREE.Mesh(bodyGeometry,f.mat(coat));torso.scale.z=.72;torso.castShadow=torso.receiveShadow=true;spine.add(torso);
  // Tailored collar, lapels, seams, belt, a layered hem and equipment harness.
  for(const side of [-1,1]){
    const lapel=f.box(spine,side*.074,.46,.19,.105,.30,.028,lining);lapel.rotation.z=side*.28;
    const seam=f.box(spine,side*.188,.29,.139,.013,.38,.018,lining);seam.rotation.z=side*.075;
    const hem=f.box(pelvis,side*.124,-.04,.123,.224,.22,.035,coat);hem.rotation.z=side*.09;
    capsule(spine,side*.115,.567,-.01,.125,.063,.137,coat);
  }
  for(const y of [.19,.28,.37])capsule(spine,0,y,.178,.022,.023,.014,metal);
  f.box(pelvis,0,.095,.002,.48,.085,.35,leather);f.box(pelvis,.035,.10,.19,.093,.066,.032,metal);f.box(pelvis,.035,.10,.208,.050,.037,.010,leather);
  const strap=f.box(spine,-.06,.34,.186,.047,.57,.028,leather);strap.rotation.z=-.49;
  capsule(pelvis,-.27,-.01,.055,.10,.13,.10,leather);f.box(pelvis,-.27,.056,.13,.10,.035,.025,metal);
  f.cyl(spine,0,.624,0,.071,.15,skin);
  // Different jaw, cheek, hair and facial profiles remain stable for each named resident.
  capsule(head,0,.13,0,.153+(seed%3)*.004,.202,.144,skin);capsule(head,0,.044,.041,.119,.11,.123,skin);
  const eyes=[];
  for(const side of [-1,1]){
    capsule(head,side*.156,.115,-.002,.03,.055,.03,skin);capsule(head,side*.081,.072,.102,.052,.047,.043,skin);
    const eye=joint(head,'eyelid',side*.059,.151,.130);capsule(eye,0,0,0,.025,.014,.012,'#d1cebc');capsule(eye,0,0,.014,.011,.012,.007,['#587376','#716345','#537457'][seed%3]);capsule(eye,0,0,.021,.006,.010,.004,'#172c2e');eyes.push(eye);
    const brow=f.box(head,side*.058,.187,.127,.057,.013,.019,hair);brow.rotation.z=side*.07;
  }
  capsule(head,0,.116,.151,.025,.047,.033,skin);capsule(head,0,.091,.177,.023,.018,.020,skin);f.box(head,0,.017,.141,.061,.012,.012,'#8b594e');
  capsule(head,0,.274,-.03,.164,.085,.14,hair);
  const hairStyle=braided.has(a.name)?1+seed%3:Math.floor(seed/13)%5;
  for(let i=0;i<6;i++){const lock=capsule(head,-.124+i*.043,.276+Math.sin(i*.8)*.015,.060,.039,.025,.081,hair);lock.rotation.z=-.3;}
  if(hairStyle===0){for(const x of [-.137,.137])capsule(head,x,.19,-.07,.033,.105,.085,hair);}
  if(hairStyle===1){capsule(head,0,.18,-.14,.151,.14,.052,hair);capsule(head,0,.21,-.208,.095,.081,.078,hair);}
  if(hairStyle===2){for(const x of [-.143,.143])capsule(head,x,.07,-.064,.043,.179,.079,hair);capsule(head,0,.01,-.147,.13,.19,.05,hair);}
  if(hairStyle===3){capsule(head,0,.175,-.144,.14,.15,.042,hair);for(let i=0;i<5;i++)capsule(head,(i%2-.5)*.026,-i*.063,-.155,.038,.051,.04,hair);}
  if(hairStyle===4){capsule(head,0,-.017,.102,.108,.061,.059,hair);for(const side of [-1,1])capsule(head,side*.046,.043,.154,.048,.018,.016,hair);}
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const thigh=joint(pelvis,'hip',side*.125,0,0),knee=joint(thigh,'knee',0,-.40,0),foot=joint(knee,'ankle',0,-.43,0);
    capsule(thigh,0,-.20,0,.098,.239,.112,pants);capsule(knee,0,-.19,0,.079,.226,.084,pants);
    capsule(knee,0,-.285,.015,.09,.152,.10,leather);f.cyl(knee,0,-.16,0,.094,.052,lining);
    capsule(foot,0,-.04,.05,.099,.075,.184,leather);f.box(foot,0,-.096,.04,.183,.029,.30,'#363534');f.box(knee,0,-.227,.101,.051,.032,.018,metal);
    if(heavy)capsule(knee,0,0,.054,.094,.080,.065,metal);
    legs.push({thigh,knee,foot});
    const shoulder=joint(spine,'shoulder',side*.25,.52,0),elbow=joint(shoulder,'elbow',0,-.28,0),wrist=joint(elbow,'wrist',0,-.27,0);
    capsule(shoulder,side*.008,-.13,0,.079,.163,.084,coat);capsule(elbow,0,-.114,0,.060,.151,.067,role==='smith'?skin:coat);f.cyl(elbow,0,-.218,0,.078,.07,leather);
    capsule(wrist,0,-.051,.006,.055,.079,.043,skin);capsule(wrist,-side*.039,-.036,.025,.028,.042,.027,skin);
    for(let finger=0;finger<3;finger++)capsule(wrist,-.03+finger*.029,-.096,.026,.013,.037,.017,skin);
    if(heavy){capsule(shoulder,side*.015,-.026,-.004,.157,.099,.164,metal);capsule(elbow,0,-.108,.042,.085,.121,.049,'#84979c');}
    arms.push({shoulder,elbow,wrist});
  }
  const right=arms[1].wrist,left=arms[0].wrist;
  let cape=null,coatTail=null;
  if(heavy){
    capsule(head,0,.276,-.014,.179,.108,.163,'#9cabad');f.box(head,0,.302,.123,.027,.153,.05,'#bdc8c5');
    for(const side of [-1,1])f.box(head,side*.156,.13,-.005,.042,.19,.104,'#9cabad');
    f.cyl(right,0,.26,.02,.024,1.55,'#78624b');f.mesh(right,'cone',0,1.07,.02,.052,.20,.052,f.mat(metal));
    const shield=joint(left,'shield',0,.02,.13);capsule(shield,0,0,0,.21,.29,.045,leather);f.mesh(shield,'torus',0,0,.012,.20,.275,.20,f.mat(metal));f.box(shield,0,0,.054,.029,.39,.017,metal);capsule(shield,0,0,.065,.057,.057,.024,metal);
  }else if(role==='farmer'){
    f.cyl(head,0,.295,0,.279,.038,'#c9b780');f.mesh(head,'cone',0,.382,0,.167,.195,.16,f.mat('#b3a16a'));f.cyl(right,0,.17,0,.025,1.03,leather);f.box(right,0,.71,.05,.30,.044,.10,'#8f9e95');
  }
  if(role==='smith'||role==='baker'){
    f.box(spine,0,.325,.20,.32,.40,.036,role==='smith'?'#664c38':'#e1d7b9');
    coatTail=joint(pelvis,'apron',0,.10,.193);f.box(coatTail,0,-.22,0,.35,.44,.035,role==='smith'?'#664c38':'#e1d7b9');
    if(role==='smith'){f.cyl(right,0,.065,.024,.028,.43,leather);f.box(right,0,.29,.024,.26,.108,.105,'#899a9b');}
    else {capsule(head,0,.34,-.015,.19,.13,.17,'#e9e1cd');f.cyl(head,0,.245,-.01,.173,.08,'#d2c5a4');f.cyl(right,0,.12,.015,.04,.55,'#ae8b5b');}
  }
  if(scholar){f.box(left,0,.03,.092,.235,.30,.07,'#86664f');f.box(left,0,.03,.135,.18,.245,.024,'#dbd0b2');f.box(left,-.093,.03,.145,.025,.29,.02,metal);for(const side of [-1,1])f.mesh(head,'torus',side*.061,.15,.158,.047,.037,.047,f.mat(metal));}
  if(role==='healer'){capsule(right,0,.01,.077,.066,.095,.06,'#7ba8a4');f.cyl(right,0,.13,.077,.028,.064,metal);f.box(spine,0,.29,.214,.052,.18,.026,lining);f.box(spine,0,.29,.216,.14,.052,.026,lining);}
  if(hero||['ranger','keeper','merchant','innkeeper'].includes(role)||enemy){
    cape=joint(spine,'cloak',0,.56,-.10);for(let i=0;i<5;i++){const panel=f.box(cape,(i-2)*.083,-.36,-.094,.089,.74,.04,i%2?coat:'#'+tint.clone().multiplyScalar(.82).getHexString());panel.rotation.x=-.09;panel.rotation.z=(i-2)*.023;}
    capsule(spine,.15,.46,.184,.046,.047,.018,metal);
    // Drawn weapons follow the wrist; the scabbard follows the hip.
    if(hero||enemy||role==='ranger'){f.box(right,0,.30,.025,.043,.59,.027,'#c2cecc');f.box(right,0,-.019,.025,.19,.035,.053,metal);f.cyl(right,0,-.089,.025,.032,.13,leather);const scabbard=f.box(pelvis,.282,-.22,-.01,.072,.66,.08,leather);scabbard.rotation.z=-.16;}
    if(role==='merchant'){for(let i=0;i<3;i++)capsule(spine,-.10+i*.10,.41,.20,.029,.029,.022,metal);}
  }
  if(a.kind==='thief'){capsule(head,0,.24,-.08,.195,.17,.14,'#3b4853');f.box(head,0,.055,.143,.265,.115,.03,'#323d44');}
  if(a.kind==='goblin'){for(const side of [-1,1]){const ear=f.mesh(head,'cone',side*.217,.13,0,.05,.22,.05,f.mat(skin));ear.rotation.z=-side*1.2;}root.scale.set(.84,.83,.86);}
  if(a.kind==='skeleton'){for(const side of [-1,1])capsule(head,side*.062,.15,.15,.041,.038,.019,'#303a35');for(let i=0;i<4;i++)f.box(head,-.054+i*.035,.01,.15,.021,.037,.026,'#d4d1b9');for(let i=0;i<4;i++)capsule(spine,0,.22+i*.07,.193,.16-i*.012,.022,.019,skin);}
  if(a.id==='castle-frankenstein'){root.scale.set(1.32,1.35,1.25);for(let i=0;i<7;i++)f.box(head,-.11+i*.035,.24,.19,.025,.012,.014,'#394741');}if(a.kind==='troll'){root.scale.set(1.6,1.48,1.5);for(const side of [-1,1])f.mesh(head,'cone',side*.13,.021,.16,.03,.16,.033,f.mat('#e4d6ad'));}
  else if(a.kind!=='goblin'&&a.id!=='castle-frankenstein')root.scale.set(1+(seed%5-2)*.035,1+(seed%7-3)*.015,1+(seed%3-1)*.025);
  dressCharacter(f,wardrobe,{pelvis,spine,head,arms,cape});
  const material=f.mat('#ffffff',-1,{vertexColors:true,roughness:.72,...(a.kind==='ghost'?{transparent:true,opacity:.55,depthWrite:false}:{})});
  weld(root,material);
  root.userData.rig={pelvis,spine,head,eyes,legs,arms,cape,coatTail,heavy,role,seed};root.userData.seed=seed;root.userData.wardrobe=wardrobe?{id:wardrobe.id,name:wardrobe.name,festive:wardrobe.festive}:null;
  return root;
}
export function disposeCharacter(root){root.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.dispose();});}
