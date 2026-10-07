import * as J from './journey.js';
import * as E from './engine.js';
import * as L from './life.js';
import {icon} from './icons.js';
import {NetworkSaves} from './network-saves.js';
import {CASTLE,CASTLE_LORE,FLOORS} from './castle-data.js';
import {dist} from './world.js';
import {CREATURES} from './creatures.js';
import * as G from './companions.js';
import {DIRS,drawSprite,frameIndex,poseFrame,spriteSheet} from './sprites.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,id='',extra='')=>`<button data-action="${action}" data-id="${esc(id)}" ${extra}>${esc(label)}</button>`;
const $=id=>document.getElementById(id),CREATABLE_IDS=J.CREATABLE;
export function createJourneyUI({getState,setState,panel,closePanel,save,message,renderer,narrator,begin,commitNewGame,cancelNewGame,canAct=()=>true}){
  let calling='warrior',companion=null,creating=false,committing=false,netFiles=[],networkTimer=0,drag=null;
  const network=new NetworkSaves({getState,validate:E.valid,onStatus:()=>{const el=$('network-status');if(el)el.textContent=network.status;}});
  const FRAMES={'ember-imp':{x:1.1,y:1.15,d:2.7,look:.62,turn:-.7},'bone-squire':{x:1.0,y:1.35,d:2.7,look:.7,turn:-.6},'gloam-wisp':{x:.9,y:1.2,d:2.6,look:.95,turn:-.5},'moss-golem':{x:1.3,y:1.5,d:3.5,look:.85,turn:-.6},'ash-wolf':{x:1.5,y:1.1,d:3.1,look:.55,turn:-.9},'thorn-boar':{x:1.5,y:1.05,d:3.2,look:.5,turn:-.9},'dusk-lynx':{x:1.4,y:1.1,d:3,look:.55,turn:-.9},'gale-hawk':{x:1.2,y:1.4,d:3.0,look:1.0,turn:-.7}};
  const roster=()=>G.rosterFor(calling);
  // ---- creation screen ("choose your calling"): a lit stage with a large pixel hero, turn buttons, then name, appearance, callings, companions and abilities
  const ROLES={warrior:'Front line',summoner:'Spirit binder',mage:'Arcane caster',ranger:'Hunter and beast'};
  const SKINS=['warm','earth','deep','pale','olive'],HAIRS=['brown','black','silver','auburn','gold'],GENDERS=[['female','Female'],['male','Male']];   // saves may still hold 'nonbinary' (journey.js accepts it); the creation screen offers two bodies
  const STANCES=[['idle','Stand'],['walk','Walk'],['attack','Strike'],['cast','Cast'],['guard','Guard']],FACINGS=['down','left','up','right'],FACING_NAMES={down:'front',left:'left',up:'back',right:'right'};
  const cap=s=>s[0].toUpperCase()+s.slice(1);
  const option=(id,label,items)=>`<div class="jr-option"><label for="${id}">${label}</label><div class="jr-option-ctl"><button type="button" class="jr-step" data-step="-1" data-for="${id}" aria-label="Previous ${label.toLowerCase()}"><i class="jr-tri jr-tri--l" aria-hidden="true"></i></button><select id="${id}">${items}</select><button type="button" class="jr-step" data-step="1" data-for="${id}" aria-label="Next ${label.toLowerCase()}"><i class="jr-tri jr-tri--r" aria-hidden="true"></i></button></div></div>`;
  const reduceMotion=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let stage={facing:0,pose:0,timer:0,t0:0,scale:0,actor:null,outfit:null,key:'',obs:null};
  function creation(){
    creating=true;calling=CREATABLE_IDS.includes(calling)?calling:'warrior';companion=null;stage.facing=0;stage.pose=0;
    const cards=J.CREATABLE.map(id=>{const c=J.CLASSES[id];return `<button type="button" class="calling-card" data-action="choose-calling" data-id="${id}" aria-pressed="${id===calling}"><span class="calling-emblem">${icon(c.icon)}</span><span class="calling-head"><strong>${esc(c.name)}</strong><small>${esc(ROLES[id]||'')}</small></span><span class="calling-desc">${esc(c.description)}</span><span class="calling-chips">${c.abilities.map(a=>`<span class="jr-chip">${esc(a.name)}</span>`).join('')}</span><span class="calling-gear"><b>Starts with</b> ${esc(c.gear)}</span></button>`;}).join('');
    panel('choose your calling','A name against the dark',`<p class="creation-intro">The Marches remember what you do. Choose an appearance and a calling; each has three distinct abilities. Summoners bind a minion and Rangers bond with a beast.</p>${getState().journey?.created?'<p class="creation-note">Finishing a new character replaces the saved journey in this browser. Back keeps it. Export a copy from Settings first if you want a backup.</p>':''}<div class="creation-layout"><section class="creation-stage" aria-label="Character preview"><div class="stage-scene"><div class="stage-plate"><span class="jr-eyebrow">Your calling</span><strong id="calling-name">Warrior</strong></div><span class="stage-shadow" aria-hidden="true"></span><canvas id="creation-portrait" class="jr-sprite" role="img" aria-label="Your character preview"></canvas></div><div class="stage-controls" role="group" aria-label="Turn and pose your character"><button type="button" class="stage-btn" id="stage-turn-left" aria-label="Turn left"><i class="jr-tri jr-tri--l" aria-hidden="true"></i></button><button type="button" class="stage-btn stage-pose" id="stage-pose" aria-label="Change stance"><span>Stand</span></button><button type="button" class="stage-btn" id="stage-turn-right" aria-label="Turn right"><i class="jr-tri jr-tri--r" aria-hidden="true"></i></button></div><p class="jr-sr" id="stage-status" role="status" aria-live="polite"></p></section><div class="creation-main"><form id="creation-form" autocomplete="off"><label class="creation-name">Your name<input id="character-name" maxlength="28" value="The Wayfarer" autocomplete="off" required></label><div class="appearance-fields">${option('character-gender','Identity',GENDERS.map(([v,t])=>`<option value="${v}">${t}</option>`).join(''))}${option('character-skin','Skin tone',SKINS.map(k=>`<option value="${k}">${cap(k)}</option>`).join(''))}${option('character-hair','Hair',HAIRS.map(k=>`<option value="${k}">${cap(k)}</option>`).join(''))}${option('character-outfit','Attire',Object.entries(L.OUTFITS).map(([k,v])=>`<option value="${k}">${esc(v.name)}</option>`).join(''))}</div></form><h3 class="jr-title">Choose your calling</h3><div class="calling-cards" role="group" aria-label="Calling">${cards}</div><section id="companion-picker" aria-live="polite"></section><section class="calling-abilities" aria-label="Abilities of this calling"><h3 class="jr-title">Three abilities</h3><div id="calling-description"></div></section><p id="creation-error" role="alert"></p><div class="creation-actions">${button('Back','cancel-creation','','class="creation-back"')}${button('Enter the Nine Marches','create-character','','class="creation-submit"')}</div></div></div>`,'creation-dialog');
    $('close-panel').hidden=true;
    const form=$('creation-form');form.oninput=preview;form.onchange=preview;form.onsubmit=e=>{e.preventDefault();handle('create-character');};
    for(const b of form.querySelectorAll('.jr-step'))b.onclick=()=>{const sel=$(b.dataset.for),n=sel.options.length;sel.selectedIndex=(sel.selectedIndex+Number(b.dataset.step)+n)%n;sel.dispatchEvent(new Event('change',{bubbles:true}));};
    $('stage-turn-left').onclick=()=>turn(-1);$('stage-turn-right').onclick=()=>turn(1);$('stage-pose').onclick=()=>{stage.pose=(stage.pose+1)%STANCES.length;stage.t0=performance.now();stageSay(STANCES[stage.pose][1]);drawStage();};
    // dragging the hero sideways turns it too
    const cv=$('creation-portrait');let drag0=null;
    cv.onpointerdown=e=>{drag0={x:e.clientX,f:stage.facing};try{cv.setPointerCapture(e.pointerId);}catch{}};
    cv.onpointermove=e=>{if(!drag0)return;const step=Math.round((e.clientX-drag0.x)/40);if(step&&drag0.f+step!==stage.facing){stage.facing=((drag0.f+step)%4+4)%4;drawStage();}};
    cv.onpointerup=cv.onpointercancel=()=>{if(drag0)stageSay('Facing '+FACING_NAMES[FACINGS[stage.facing]]);drag0=null;};
    stage.key='';stage.scale=0;stage.t0=performance.now();
    if(window.ResizeObserver){stage.obs=new ResizeObserver(()=>drawStage());stage.obs.observe(cv.parentElement);}
    renderPicker();preview();startStage();$('character-name').focus();
  }
  function stageSay(text){const s=$('stage-status');if(s)s.textContent=text;}
  function turn(step){stage.facing=((stage.facing+step)%4+4)%4;stageSay('Facing '+FACING_NAMES[FACINGS[stage.facing]]);drawStage();}
  // the hero is drawn one whole sprite pixel per block, at the largest whole scale that fits the lit stage
  function drawStage(){
    const cv=$('creation-portrait');if(!cv||!cv.isConnected){if(stage.timer)stopStage();return;}if(!stage.actor)return;
    const scene=cv.parentElement,h=scene.clientHeight||320,sc=Math.max(3,Math.min(9,Math.floor((h*.86-30)/46))),w=40*sc,ht=48*sc;
    if(cv.width!==w||cv.height!==ht){cv.width=w;cv.height=ht;}
    const [pose,label]=STANCES[stage.pose],still=reduceMotion(),t=(performance.now()-stage.t0)/1000,frame=still?0:poseFrame(pose,t),key=[stage.key,sc,FACINGS[stage.facing],pose,frame].join('|');
    if(cv.dataset.drawn===key)return;cv.dataset.drawn=key;
    try{drawSprite(cv,stage.actor,{dir:FACINGS[stage.facing],pose,frame,scale:sc,outfit:stage.outfit});}catch{}
    const b=$('stage-pose');if(b){const s=b.querySelector('span');if(s&&s.textContent!==label)s.textContent=label;}
  }
  function startStage(){stopStage();if(!reduceMotion())stage.timer=setInterval(()=>{if(!document.hidden)drawStage();},120);}
  function stopStage(){clearInterval(stage.timer);stage.timer=0;stage.obs?.disconnect();stage.obs=null;}
  function renderPicker(){
    const host=$('companion-picker'),r=roster();if(!host)return;
    if(!r){host.innerHTML='';host.hidden=true;return;}
    host.hidden=false;
    host.innerHTML=`<h3 class="jr-title">${esc(r.prompt)}</h3><div class="companion-cards" role="group" aria-label="${esc(r.noun)} choices">${r.choices.map(id=>{const c=G.COMPANIONS[id];return `<button type="button" class="companion-card" data-action="choose-companion" data-id="${id}" aria-pressed="${id===companion}"><canvas width="256" height="256" class="jr-sprite" aria-hidden="true" data-companion-art="${id}"></canvas><strong>${esc(c.name)}</strong><small class="companion-kind">${esc(cap(c.role||'ally'))} · ${c.ranged?'ranged':'melee'}</small><span class="companion-detail">${esc(c.detail)}</span><span class="companion-stats"><span class="jr-chip">${c.hp} health</span><span class="jr-chip">${c.dmg} damage</span><span class="jr-chip">${c.cd}s cooldown</span></span></button>`;}).join('')}</div>`;
    for(const canvas of host.querySelectorAll('canvas[data-companion-art]')){const id=canvas.dataset.companionArt;try{renderer.portrait(canvas,{id:'preview-'+id,kind:id,type:'guardian',x:0,y:0,map:'overworld',name:G.COMPANIONS[id].name},null,FRAMES[id]);}catch{}}
  }
  function preview(){
    const s=getState(),draft={...s.player,id:'player',type:'hero',name:$('character-name').value,gender:$('character-gender').value,skin:$('character-skin').value,hair:$('character-hair').value,classId:calling},outfit=L.OUTFITS[$('character-outfit').value].color;
    stage.actor=draft;stage.outfit=outfit;stage.key=[draft.name,draft.gender,draft.skin,draft.hair,calling,outfit].join('/');
    $('calling-name').textContent=J.CLASSES[calling].name;drawStage();
    $('calling-description').innerHTML=J.CLASSES[calling].abilities.map((a,i)=>`<article><b><span class="jr-chip">${i+1}</span>${esc(a.name)}</b><p>${esc(a.detail)}</p><small>${a.cost} mana · ${a.cooldown}s cooldown</small></article>`).join('');
  }
  function finishCreation(){creating=false;committing=false;stopStage();$('close-panel').hidden=false;}
  function ability(index){if(!canAct())return message('Resume exploration before using an ability.');const s=getState();message(J.ability(s,index,{hurt:E.hurt,lineOfSight:(map,a,b)=>E.lineOfSight(map,a,b,s)}));save();hud();}
  window.addEventListener('blur',()=>drag=null);
  function camera(){const s=getState();if(s.settings.cameraMode!=='third-person'&&s.settings.diorama!==false){s.settings.diorama=false;s.settings.cameraMode='third-person';}else if(s.settings.cameraMode==='third-person')s.settings.cameraMode='isometric';else s.settings.diorama=true;renderer.staticKey='';save();hud();}
  $('camera-mode').onclick=camera;
  $('world').addEventListener('contextmenu',e=>e.preventDefault());
  $('world').addEventListener('pointerdown',e=>{if(e.button!==2||$('panel').open||!$('starter-menu').hidden||getState().settings.cameraMode!=='third-person')return;drag={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);});
  $('world').addEventListener('pointermove',e=>{if(!drag)return;if($('panel').open||document.hidden){drag=null;return;}const s=getState();s.settings.azimuth=((s.settings.azimuth+(e.clientX-drag.x)*.35)%360+360)%360;s.settings.cameraPitch=Math.min(.95,Math.max(.12,s.settings.cameraPitch+(e.clientY-drag.y)*.004));drag={x:e.clientX,y:e.clientY};});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])$('world').addEventListener(name,()=>drag=null);
  $('panel').addEventListener('cancel',e=>{if(creating){e.preventDefault();handle('cancel-creation');}});
  // Character plate bust: the head and shoulders of the hero's own sprite (first idle frame, facing front), cut out and drawn with hard pixels.
  let bustKey='';
  function bust(s){
    const cv=$('hud-portrait');if(!cv)return;
    const p=s.player,px=Math.round(cv.clientWidth)||44,outfit=L.OUTFITS[s.life?.outfit]?.color,key=[p.name,p.gender,p.skin,p.hair,p.classId,outfit,px].join('/');
    if(key===bustKey)return;
    try{
      const sheet=spriteSheet({...p,id:'player',type:'hero'},outfit);if(!sheet)return;
      bustKey=key;
      const {w,h,cols,data}=sheet,col=frameIndex('idle',0),row=DIRS.indexOf('down'),at=(x,y)=>((row*h+y)*w*cols+col*w+x)*4;
      let x0=w,x1=-1,y0=h;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[at(x,y)+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);}
      if(x1<0)return;
      const sc=Math.max(1,Math.round(px/22)),side=Math.floor(px/sc),left=Math.round((x0+x1)/2-side/2),top=Math.max(0,y0-1),ctx=cv.getContext('2d');
      cv.width=cv.height=px;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,px,px);
      for(let y=0;y<side;y++)for(let x=0;x<side;x++){const sx=left+x,sy=top+y;if(sx<0||sy<0||sx>=w||sy>=h)continue;const k=at(sx,sy);if(!data[k+3])continue;ctx.fillStyle=`rgb(${data[k]},${data[k+1]},${data[k+2]})`;ctx.fillRect(x*sc,y*sc,sc,sc);}
      cv.dataset.portrait='bust';
    }catch{bustKey='';}
  }
  function hud(){
    const s=getState(),j=J.upgrade(s),c=J.CLASSES[s.player.classId],bar=$('class-abilities');bust(s);
    bar.hidden=!c;if(c){const key=s.player.classId+':'+j.cooldowns.map(n=>Math.max(0,Math.ceil(n-s.elapsed))).join(':')+':'+Math.floor(s.player.mp);if(bar.dataset.key!==key){bar.dataset.key=key;bar.innerHTML=c.abilities.map((a,i)=>{const wait=Math.max(0,Math.ceil(j.cooldowns[i]-s.elapsed));return `<button data-ability="${i}" title="${esc(a.detail)}" ${wait||s.player.mp<a.cost||s.player.deadUntil?'disabled':''}>${icon(i===0?'lantern':i===1?'heart':'leaf')}<span><b>${a.name}</b><small>${wait?wait+'s':a.cost+' mana'}</small></span><kbd>${i+1}</kbd></button>`;}).join('');bar.querySelectorAll('[data-ability]').forEach(b=>b.onclick=()=>ability(Number(b.dataset.ability)));}}
    const tutorial=$('tutorial-card'),step=J.TUTORIAL[j.tutorial];tutorial.hidden=!j.created||!step||j.tutorialHidden;if(step&&!tutorial.hidden){const key=j.tutorial+':'+s.player.classId;if(tutorial.dataset.step!==key){tutorial.dataset.step=key;tutorial.innerHTML=`<small>FIRST STEPS · ${j.tutorial+1} / 6</small><strong>${step.title}</strong><p>${step.detail}</p><div>${button('Later','tutorial-hide')}${button('Next tip','tutorial-next')}</div>`;tutorial.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>handle(b.dataset.action));}}
    const danger=$('hunt-status'),castleHunter=s.enemies.some(e=>e.hunter&&e.map===s.player.map&&!e.deadUntil&&['tracking','lunge'].includes(e.huntState)),active=castleHunter||['warning','tracking','searching'].includes(j.hunt.phase);danger.hidden=!active;danger.textContent=j.hunt.phase==='warning'?'A hunting bell sounds. Find shelter.':j.hunt.phase==='searching'?'The hunter has lost sight of you. Stay quiet.':'You are being hunted. Break line of sight or reach a ward.';
    $('camera-mode').textContent=s.settings.cameraMode==='third-person'?'ISO':s.settings.diorama===false?'RPG':'3D';$('camera-mode').setAttribute('aria-label','Switch camera view');
  }
  function settings(){
    const s=getState(),body=$('panel-body'),section=document.createElement('section');section.className='journey-settings';section.innerHTML=`<h3>Camera, learning & saves</h3><p>Current camera: ${s.settings.cameraMode==='third-person'?'Third person':s.settings.diorama===false?'Isometric':'JRPG diorama'}; look: ${s.settings.look==='classic'?'Classic 3D':'HD-2D pixel'}. C switches views; right-drag or Q / R rotates third person.</p><div class="choices">${button('Switch camera','journey-camera')}${button(s.settings.look==='classic'?'Look: Classic 3D':'Look: HD-2D pixel','journey-look')}${button(s.settings.battles==='real-time'?'Combat: Real-time':'Combat: Turn-based','journey-battles')}${button('Replay tutorial','tutorial-replay')}${button('Creature bestiary','bestiary')}${button('Castle concept study','castle-concept')}</div><h3>Shared-folder saves</h3><p>Choose a local shared folder or mapped network drive. The operating system must already have access to it. Folder access may require opening this game in its separate tab.</p><div class="choices">${button('Choose shared folder','network-choose')}${button('Save to shared folder','network-save')}${button('Load from shared folder','network-load')}${button(network.auto?'Auto backup on':'Auto backup off','network-auto','','aria-pressed="'+network.auto+'"')}</div><p id="network-status" role="status">${esc(network.status)}</p><p class="subtle">Opt-in backups run once per minute while playing. Each character has a separate file and a previous-snapshot copy. Browser saves remain available if the share disconnects. Export and import also work without folder access.</p><h3>Credits</h3><p class="subtle credits">Numerals and small labels are set in Pixelify Sans, copyright 2021 The Pixelify Sans Project Authors, used under the SIL Open Font License 1.1 (<a href="assets/fonts/Pixelify-Sans-OFL.txt" target="_blank" rel="noopener">license text</a>). The font is bundled with the game; nothing is loaded from the network.</p><p class="subtle credits">The orchestral score was composed for Lantern Gate and rendered with the MuseScore General SoundFont (MIT licence; it includes CC0 string and percussion samples from the Versilian community libraries) (<a href="audio/orchestra/SOUNDFONT-LICENSE.txt" target="_blank" rel="noopener">licence text</a>).</p>`;body.append(section);
  }
  function journal(){const j=J.upgrade(getState());return `<article class="quest-card"><h3>The Names Beneath the Crown</h3><p>${j.castleQuest==='complete'?'The stolen names have been returned. Frankenstein plants his seed beyond the castle gates.':'Visit Dracula’s Castle in the Mourning Crown. Speak with Frankenstein, free the Wolf Man’s hunting bell, and recover Dracula’s ledger.'}</p><small>${j.clues.length} / 3 clues · ${esc(j.castleQuest)}</small>${button('Walk to the castle','destination','site:dracula:1')}</article>`;}
  const mythicText={
    'castle-frankenstein':'They call me an unfinished thing. Yet the orchard remembers my hands. Bring three moonleaf, and I can teach its seed to grow in soil that has forgotten the sun. The count keeps the drowned names upstairs. Not all of them belong to the dead.',
    'castle-wolfman':'I was a keeper before I was a hunter. The bell is a chain you cannot see. Its tether can be broken with three cinder iron and two seasoned branches. Until then, leave before it rings. I cannot promise I will remember your face.',
    'castle-dracula':'A bargain is only cruel when one side forgets its terms. I kept these towns alive while their keepers slept. Bring me the seed and the silent bell, and I will hear your claim. You may purchase the drowned names, or make mercy the price of their return.'
  };
  function interact(id){const s=getState(),r=s.journey.residents.find(r=>r.id===id);if(!r)return false;if(r.map!==s.player.map||dist(r,s.player)>2.3){message('Move beside '+r.name+'.');return true;}s.journey.castleQuest=s.journey.castleQuest==='unheard'?'active':s.journey.castleQuest;panel('the Mourning Crown',r.name,`<p class="npc-detail">${esc(r.role)} · ${FLOORS[Number(r.map.at(-1))-1]}</p><p>${mythicText[id]}</p>${id==='castle-frankenstein'?button('Offer three moonleaf','castle-seed'):id==='castle-wolfman'?button('Break the bell tether','castle-bell'):button('Bargain for the names · 60 gold','castle-names')+button('Ask for mercy','castle-mercy')}${button('Leave quietly','close')}`);narrator.speak(mythicText[id],r);save();return true;}
  async function handle(action,id){
    const s=getState(),j=J.upgrade(s);
    switch(action){
      case 'choose-calling':if(!creating||!J.CREATABLE.includes(id))return true;if(calling!==id){calling=id;companion=null;}document.querySelectorAll('[data-action="choose-calling"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));$('creation-error').textContent='';renderPicker();preview();return true;
      case 'choose-companion':if(!creating||!G.inRoster(calling,id))return true;companion=id;document.querySelectorAll('[data-action="choose-companion"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));$('creation-error').textContent='';return true;
      case 'cancel-creation':if(!creating||committing)return true;finishCreation();closePanel();cancelNewGame?.();return true;
      case 'create-character':{if(!creating||committing)return true;committing=true;const draft={name:$('character-name').value,classId:calling,skin:$('character-skin').value,hair:$('character-hair').value,gender:$('character-gender').value,outfit:$('character-outfit').value,companionId:G.isCompanionClass(calling)?companion:null};let out;try{out=await commitNewGame(draft);}catch(error){out={ok:false,text:error.message||'The new journey could not start.'};}committing=false;if(!out.ok){const el=$('creation-error');if(el)el.textContent=out.text;return true;}finishCreation();closePanel();begin();message(out.text);return true;}
      case 'journey-camera':camera();break;case 'journey-battles':{const s=getState();s.settings.battles=s.settings.battles==='real-time'?'turn':'real-time';save();const b=document.querySelector('[data-action="journey-battles"]');if(b)b.textContent=s.settings.battles==='real-time'?'Combat: Real-time':'Combat: Turn-based';break;}case 'journey-look':{const s=getState();s.settings.look=s.settings.look==='classic'?'hd2d':'classic';save();hud();const b=document.querySelector('[data-action="journey-look"]');if(b)b.textContent=s.settings.look==='classic'?'Look: Classic 3D':'Look: HD-2D pixel';break;}
      case 'tutorial-hide':j.tutorialHidden=true;hud();break;
      case 'tutorial-next':j.tutorial=Math.min(6,j.tutorial+1);hud();break;
      case 'tutorial-replay':j.tutorial=0;j.tutorialHidden=false;j.origin={x:s.player.x,y:s.player.y};closePanel();hud();break;
      case 'crown-story':j.castleQuest=j.castleQuest==='unheard'?'active':j.castleQuest;panel('the northern bells','The Names Beneath the Crown',`<p>${CASTLE_LORE[0]}</p><p>Three residents hold different pieces of the bargain: Frankenstein, the Wolf Man, and Dracula. Listen before you choose what to offer.</p>${button('Walk to the castle','destination','site:dracula:1')}`);narrator.speak(CASTLE_LORE[0]);break;
      case 'castle-concept':panel('concept art only','The Mourning Crown',`<img class="castle-story-art" src="assets/castle-cinematic.webp" alt="Concept study of a Gothic castle, not an in-game scene"><p>This is a visual concept study. The playable castle is a separate 3D model with four explorable floors; this image is not a world background or a building sprite.</p>`);break;
      case 'creature-study':{const c=CREATURES[id];if(!c)return true;panel('creature concept study',c.name,`<img class="bestiary-art" src="${c.art}" alt="${esc(c.name)} concept art"><p>${esc(c.where)}</p><p>${esc(c.lore)}</p><p>${esc(c.rule)}</p><p class="subtle">The illustration defines the intended production appearance. The current active 3D creature is an animated blockout and does not yet match this artwork’s fidelity.</p>`);break;}
      case 'bestiary':panel('field bestiary','The Bellwrought',`<small>CREATURE CONCEPT STUDY</small><img class="bestiary-art" src="assets/bellwrought.webp" alt="A gaunt transformed human with stretched exposed skin, elongated limbs, sparse hair, bulging eyes and a protruding toothed face"><div class="choices">${Object.entries(CREATURES).map(([id,c])=>button(c.name,'creature-study',id)).join('')}</div><p class="subtle">Concept art guides the current animated 3D blockouts. Production sculpting, materials and animations are still pending.</p><p>These cursed hunters run at 4.1 paces per second, just faster than a wayfarer. They track sight, footsteps, and their last known position of you. They cannot see through walls.</p><p>The bell warns before a roaming hunt begins. Use a class refuge or decoy, break line of sight, or lock yourself inside a home. Reinforced doors buy time. The creature stands on its hind legs without a collar, harness, or chain. It has a heavy stalking gait, a forward chase, a searching head turn, and a lunging attack.</p>`);break;
      case 'castle-seed':case 'castle-bell':case 'castle-names':case 'castle-mercy':{const text=J.castleBargain(s,action.slice(7));message(text);if(j.castleQuest==='complete')closePanel();narrator.speak(text);break;}
      case 'network-choose':try{await network.choose();}catch(e){message(e.name==='AbortError'?'Folder selection canceled.':e.message);}break;
      case 'network-save':try{await network.write();j.exported=true;message(network.status);}catch(e){message(e.message);}break;
      case 'network-auto':network.auto=!network.auto;document.querySelectorAll('[data-action="network-auto"]').forEach(b=>{b.textContent=network.auto?'Auto backup on':'Auto backup off';b.setAttribute('aria-pressed',String(network.auto));});message(network.auto?'Shared-folder backup enabled for this session.':'Shared-folder backup paused.');break;
      case 'network-load':try{netFiles=await network.load();panel('shared-folder journeys','Choose a saved journey',`<p>Choose the character and snapshot you want to restore.</p>${netFiles.map((f,i)=>button(f.state.player.name||'The Wayfarer','network-restore',i)+`<small>${esc(f.name)} · ${new Date(f.time).toLocaleString()}</small>`).join('')||'<p>No compatible journeys were found.</p>'}`);}catch(e){message(e.message);}break;
      case 'network-restore':{const f=netFiles[Number(id)];if(!f||!E.valid(f.state)){message('That snapshot is unavailable.');break;}L.upgrade(f.state);J.upgrade(f.state);E.respawns(f.state,Date.now());E.restorePosition(f.state);E.refreshResidents(f.state);f.state.player.path=[];await setState(f.state);renderer.staticKey='';closePanel();save();message('Shared-folder journey restored.');break;}
      default:return false;
    }save();return true;
  }
  function autoSave(dt){if(!network.auto||!network.directory)return;networkTimer+=dt;if(networkTimer>=60){networkTimer=0;network.write().catch(()=>{});}}
  return {creation,handle,interact,hud,settings,ability,camera,journal,autoSave,get creating(){return creating;}};
}
