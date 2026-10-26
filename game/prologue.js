export const PROLOGUE=[
 'Once, the Nine Marches kept a lantern at every threshold. Their light was a promise: no traveler would be left to the dark. Then the river rose, and the keepers made a bargain beneath the Gate. They saved the towns. They never named the price.',
 'Now doors are barred before dusk. Graves open where no shovel has passed. In the northern mist, Dracula’s castle has begun to ring its bells again. A count keeps his court above the clouds. A broken creation waits below. And something wearing the shape of a wolf has learned the roads home.',
 'You arrive in Hearthwick with a name, a calling, and one small light. Mara still believes the old promise can be mended. The Marches need more than a sword. They need someone willing to discover what the keepers buried. Choose who you will become. And when the bells begin, do not mistake silence for safety.'
];
// Frozen original story identity. B is selected only after all three native
// recordings match their promoted transcript QA, format and byte hashes.
export const PROLOGUE_B_IDENTITY=Object.freeze({version:1,storyId:'lantern-gate-prologue-v1',engine:'qwen3-tts-1.7b-base',voice:'qn_lorath_refined',seed:93019,textSha256:'96c28dacfc97862bd58262103319636b2859cd6c4e61ab2cb82f3bbdb803ec6f',clips:Object.freeze([
 {scene:0,textSha256:'a0033703c1aca7981493622264c8ec767e765e3331f31ca4f46e950059782307',src:'audio/narration/rpg-prologue-scene-01-a0033703c1ac.wav',samplingSeed:93019},
 {scene:1,textSha256:'fad58bac3d64ddd51364571c07cf31bb202b2849df290e295f11509182e641d3',src:'audio/narration/rpg-prologue-scene-02-fad58bac3d64.wav',samplingSeed:93020},
 {scene:2,textSha256:'71c50dea36436d34ef55f0979dcf302e4b942e561b9c5039fa80775c8be93144',src:'audio/narration/rpg-prologue-scene-03-71c50dea3643.wav',samplingSeed:93021}
])});
export function validatePrologueBManifest(manifest){
 const expected=PROLOGUE_B_IDENTITY;
 for(const key of ['version','storyId','engine','voice','seed','textSha256'])if(manifest?.[key]!==expected[key])throw Error('Approved narrator introduction identity differs.');
 if(manifest.status!=='ready'||manifest.transcriptQA!=='passed'||manifest.text!==PROLOGUE.join('\n\n')||!Array.isArray(manifest.clips)||manifest.clips.length!==3)throw Error('Approved narrator introduction is not verified.');
 for(const [index,clip]of manifest.clips.entries()){
  for(const key of ['scene','textSha256','src','samplingSeed'])if(clip?.[key]!==expected.clips[index][key])throw Error('Approved narrator scene identity differs.');
  if(clip.status!=='ready'||clip.transcriptQA!=='passed'||clip.voice!==expected.voice||clip.seed!==expected.seed||clip.sampleRate!==24000||clip.channels!==1||clip.bits!==24||!/^[a-f0-9]{64}$/.test(clip.audioSha256||'')||!Number.isFinite(clip.durationSeconds)||clip.durationSeconds<.15||clip.durationSeconds>84)throw Error('Approved narrator scene is not verified native audio.');
 }
 return manifest;
}
export function validatePrologueBWave(bytes){
 const view=new DataView(bytes),tag=at=>String.fromCharCode(...new Uint8Array(bytes,at,4));
 if(view.byteLength<44||view.byteLength>6_100_000||tag(0)!=='RIFF'||tag(8)!=='WAVE'||view.getUint32(4,true)+8!==view.byteLength)throw Error('Incomplete native introduction recording.');
 let at=12,format=false,frames=0;
 while(at<view.byteLength){
  if(at+8>view.byteLength)throw Error('Incomplete native WAV chunk.');
  const name=tag(at),size=view.getUint32(at+4,true),start=at+8,end=start+size;
  if(end>view.byteLength)throw Error('Incomplete native WAV samples.');
  if(name==='fmt '){
   if(format||size!==16||view.getUint16(start,true)!==1||view.getUint16(start+2,true)!==1||view.getUint32(start+4,true)!==24000||view.getUint32(start+8,true)!==72000||view.getUint16(start+12,true)!==3||view.getUint16(start+14,true)!==24)throw Error('Introduction must use its native PCM24 format.');
   format=true;
  }else if(name==='data'){
   if(!format||frames||!size||size%3)throw Error('Introduction samples are incomplete.');frames=size/3;
  }else throw Error('Unexpected introduction audio metadata.');
  at=end+(size%2);
 }
 if(at!==view.byteLength||!format||!frames||frames/24000<.15||frames/24000>84)throw Error('Introduction native waveform is incomplete.');
 return {frames,seconds:frames/24000};
}
export async function loadApprovedPrologueB({signal,fetcher=globalThis.fetch,cryptoImpl=globalThis.crypto}={}){
 const response=await fetcher('audio/prologue-b-manifest.json',{cache:'no-store',signal});
 if(!response.ok)throw Error('Approved narrator introduction is pending.');
 const manifest=validatePrologueBManifest(await response.json());
 if(!cryptoImpl?.subtle)throw Error('Introduction audio verification is unavailable.');
 const clips=[];
 for(const clip of manifest.clips){
  const response=await fetcher(clip.src,{cache:'no-store',signal});if(!response.ok)throw Error('Verified introduction recording could not load.');
  const bytes=await response.arrayBuffer(),technical=validatePrologueBWave(bytes);
  if(Math.abs(technical.seconds-clip.durationSeconds)>.002)throw Error('Introduction duration differs from its complete recording.');
  const digest=[...new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  if(digest!==clip.audioSha256)throw Error('Introduction recording differs from its verified bytes.');
  clips.push({bytes,scene:clip.scene});
 }
 return {manifest,clips};
}
export function playPrologue({overlay,onComplete,music,activate=async()=>{},autoStart=false}){
 let cancelled=false,playing=false,scene=0,timer=null,audio=null,finished=false,hiddenAt=null,score=null,controller=null,urls=[],fadeTimer=null,fadingScore=null;
 const title=overlay.querySelector('.cinematic-title'),caption=overlay.querySelector('.cinematic-caption'),start=overlay.querySelector('[data-prologue-start]'),skip=overlay.querySelector('[data-prologue-skip]'),mute=overlay.querySelector('[data-prologue-mute]'),status=overlay.querySelector('.prologue-status');
 overlay.hidden=false;overlay.classList.remove('story-playing');title.classList.remove('title-departed');overlay.dataset.scene='0';caption.textContent=PROLOGUE[0];start.hidden=false;start.textContent='Enter with sound';status.textContent='Approved narration awaiting review. The introduction remains readable.';mute.setAttribute('aria-pressed','false');mute.textContent='Mute narration';
 function cleanup(){clearTimeout(timer);controller?.abort();audio?.pause();urls.forEach(url=>URL.revokeObjectURL(url));urls=[];document.removeEventListener('visibilitychange',visibility);music?.duck?.(false);}
 function stopFade(){clearInterval(fadeTimer);fadeTimer=null;fadingScore?.pause();if(fadingScore)fadingScore.src='';fadingScore=null;}
 function fadeScore(){if(!score)return;stopFade();const old=score,base=old.volume,at=performance.now();fadingScore=old;score=null;fadeTimer=setInterval(()=>{old.volume=Math.max(0,base*(1-(performance.now()-at)/3000));if(old.volume<=.001)stopFade();},50);}
 function complete(){if(finished||cancelled)return;finished=true;cancelled=true;cleanup();fadeScore();title.classList.add('title-departed');overlay.classList.add('cinematic-out');timer=setTimeout(()=>{overlay.hidden=true;overlay.classList.remove('cinematic-out');onComplete();},600);}
 function readScene(){if(cancelled)return;overlay.dataset.scene=String(scene);caption.textContent=PROLOGUE[scene];if(scene>0)title.classList.add('title-departed');status.textContent='Recorded narration unavailable. Read the story and continue.';start.hidden=false;start.textContent=scene===2?'Create your character':'Continue story';start.onclick=()=>{scene++;if(scene===3)complete();else readScene();};}
 async function begin(automatic=false){
  if(playing||cancelled)return;start.hidden=true;
  controller?.abort();audio?.pause();urls.forEach(url=>URL.revokeObjectURL(url));urls=[];
  try{await activate();if(cancelled)return;score=new Audio('audio/intro.mp3');score.volume=.20;score.loop=true;await score.play();if(cancelled){score?.pause();return;}}
  catch{score?.pause();score=null;if(cancelled)return;status.textContent='One click activates music, recorded voices and world sounds.';start.hidden=false;start.textContent='Enter with sound';return;}
  playing=true;overlay.classList.add('story-playing');
  controller=new AbortController();
  try{
   const recorded=await loadApprovedPrologueB({signal:controller.signal});if(cancelled)return;
   urls=recorded.clips.map(clip=>URL.createObjectURL(new Blob([clip.bytes],{type:'audio/wav'})));
   function next(index){
    if(cancelled)return;scene=index;overlay.dataset.scene=String(scene);caption.textContent=PROLOGUE[scene];if(scene>0)title.classList.add('title-departed');
    audio=new Audio(urls[index]);audio.volume=.85;audio.muted=mute.getAttribute('aria-pressed')==='true';
    audio.onended=()=>{if(index===2)complete();else void next(index+1);};audio.onerror=()=>{audio?.pause();readScene();};
    audio.ontimeupdate=()=>{if(index===2&&audio.duration-audio.currentTime<3)audio.volume=Math.max(0,(audio.duration-audio.currentTime)/3*.85);};
    return audio.play().then(()=>{if(cancelled)audio.pause();}).catch(error=>{if(cancelled)return;if(error.name==='NotAllowedError'){playing=false;start.hidden=false;start.textContent='Enter with sound';status.textContent='One click activates music and the recorded introduction.';}else readScene();});
   }
   status.textContent='Approved narrator B recorded introduction';music?.duck?.(true);await next(0);return;
  }catch{if(cancelled)return;urls.forEach(url=>URL.revokeObjectURL(url));urls=[];}
  status.textContent='Approved narration awaiting review. Read the full introduction and continue.';
  if(automatic){score?.pause();score=null;playing=false;status.textContent='One click activates the recorded story and all sound.';start.hidden=false;start.textContent='Enter with sound';}else readScene();
 }
 function visibility(){if(document.hidden){hiddenAt=performance.now();audio?.pause();score?.pause();}else if(hiddenAt!==null&&playing){hiddenAt=null;audio?.play().catch(()=>{});score?.play().catch(()=>{});}}
 document.addEventListener('visibilitychange',visibility);start.onclick=()=>begin(false);skip.onclick=complete;
 mute.onclick=()=>{const off=mute.getAttribute('aria-pressed')==='true';mute.setAttribute('aria-pressed',String(!off));mute.textContent=off?'Mute narration':'Narration muted';if(audio)audio.muted=!off;};
 if(autoStart)void begin(true);
 return {stop:()=>{cancelled=true;cleanup();stopFade();score?.pause();overlay.hidden=true;}};
}
