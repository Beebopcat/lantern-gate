import {worldClock,worldMinute,worldWeather} from './world-conditions.js';
import {speechKey,normalizeSpeech,spokenText,castFor} from './voice-cast.js';
import {townAt,buildingAt,dist,BUILDINGS} from './world.js';
import {RecordedNarratorB} from './narrator-b.js';
import {TRACKS,HUNT,STINGERS,trackById,tracksFor} from './soundtrack.js';
export class Music{
 constructor(){this.on=false;this.volume=.3;this.ducked=false;this.duckers=new Set();this.mode='town';this.track=null;this.current=null;this.fading=null;this.lastSwitch=0;this.trackStart=0;this.timer=null;this.pending=null;this.activationVersion=0;this.failedMode=null;this.retryAt=0;this.disposed=false;this.forced=null;this.title=false;this.fight=false;this.boss=false;this.fanfare=null;}
 get nowPlaying(){return this.track?.name||'';}
 score(track){const audio=new Audio('audio/'+track.file);audio.dataset.score=track.id;audio.hidden=true;document.body.append(audio);audio.loop=true;audio.preload='none';audio.volume=0;return audio;}
 // Pick a track for a mode: the listener's chosen track wins, otherwise a different one from the mode's list each time.
 choose(mode,avoid=this.track?.id){if(mode==='hunt')return HUNT;const forced=this.forced&&trackById(this.forced);if(forced&&!['fight','boss','title'].includes(mode))return forced;if(forced&&forced.mode===mode)return forced;const list=tracksFor(mode),others=list.filter(t=>t.id!==avoid),from=others.length?others:list,fresh=from.filter(t=>t.hifi),pool=fresh.length&&Math.random()<.8?fresh:from;return pool[Math.floor(Math.random()*pool.length)]||tracksFor('town')[0];}
 cancelSwitch(){const request=this.pending;this.pending=null;if(request){request.audio.pause();request.audio.remove();}}
 async enable(on){
  if(this.disposed)return false;
  const version=++this.activationVersion;this.on=on;clearInterval(this.timer);this.timer=null;this.cancelSwitch();
  if(!on){this.current?.pause();this.fading?.pause();this.endStinger();return true;}
  if(!this.track){if(this.title)this.mode='title';this.track=this.choose(this.mode);}this.current??=this.score(this.track);this.trackStart=performance.now();const audio=this.current;
  try{await audio.play();}catch(error){if(version!==this.activationVersion||!this.on||this.disposed)return false;this.on=false;this.activationVersion++;this.cancelSwitch();this.current?.pause();this.fading?.pause();throw error;}
  if(version!==this.activationVersion||!this.on||this.disposed){if(!this.on||this.disposed)audio.pause();return false;}
  this.timer=setInterval(()=>{if(!this.on||this.disposed||version!==this.activationVersion)return;const target=this.volume*(this.ducked?.17:.6);this.current.volume=Math.min(target,this.current.volume+.025);if(this.fading){this.fading.volume=Math.max(0,this.fading.volume-.025);if(this.fading.volume===0){this.fading.pause();this.fading.remove();this.fading=null;}}},100);return true;
 }
 duck(on,source='story'){if(on)this.duckers.add(source);else this.duckers.delete(source);this.ducked=this.duckers.size>0;}
 async switch(mode,track=this.choose(mode),urgent=false){
  if(!this.on||this.disposed||this.timer===null||!track)return false;
  if(this.pending&&this.pending.track.id!==track.id)this.cancelSwitch();
  const now=performance.now(),quick=urgent||['hunt','fight','boss','title'].includes(mode);if(track.id===this.track?.id||this.pending?.track.id===track.id||track.id===this.failedMode&&now<this.retryAt||!quick&&now-this.lastSwitch<6000)return false;
  const request={mode,track,audio:this.score(track),version:this.activationVersion};this.pending=request;this.lastSwitch=now;
  // Keep the working score audible until the replacement really starts. A
  // failed or superseded load must not fade it away or pin the requested track.
  try{await request.audio.play();}catch{
   if(this.pending===request){this.pending=null;this.failedMode=track.id;this.retryAt=performance.now()+2000;}
   request.audio.pause();request.audio.remove();return false;
  }
  if(this.pending!==request||!this.on||this.disposed||request.version!==this.activationVersion){request.audio.pause();request.audio.remove();return false;}
  if(this.fading){this.fading.pause();this.fading.remove();}
  this.fading=this.current;this.current=request.audio;this.mode=mode;this.track=track;this.trackStart=performance.now();this.pending=null;this.failedMode=null;this.retryAt=0;return true;
 }
 // Move to a different track in the current mode (the Settings "Next track" button).
 skip(){
  this.forced=null;let next=this.choose(this.mode);
  // shop, inn and boss each have one track: step into the town (or battle) list instead of doing nothing
  if(next.id===this.track?.id){const pool=tracksFor({shop:'town',inn:'town',boss:'fight'}[this.mode]||this.mode).filter(t=>t.id!==this.track?.id);if(pool.length)next=pool[Math.floor(Math.random()*pool.length)];}
  return this.switch(this.mode,next,true);
 }
 // A short fanfare over the score (for example after a victory). Silent unless the player has turned music on.
 async stinger(name){
  const st=STINGERS[name];if(!st||!this.on||this.disposed||this.volume<=0)return false;
  this.endStinger();
  const a=new Audio('audio/'+st.file);a.volume=Math.min(1,this.volume*.9);this.fanfare=a;this.duck(true,'stinger');
  // the score comes back when the fanfare ends, errors, is paused by the browser, or is cut short by music off / page hide / dispose
  const done=()=>{if(this.fanfare===a){this.fanfare=null;this.duck(false,'stinger');}};
  for(const ev of ['ended','error','pause'])a.addEventListener(ev,done,{once:true});
  try{await a.play();}catch{done();return false;}
  if(this.fanfare!==a||!this.on||this.disposed){a.pause();return false;}
  return true;
 }
 // Silence a fanfare that is still playing and give the score its volume back.
 endStinger(){const a=this.fanfare;if(!a)return;this.fanfare=null;this.duck(false,'stinger');a.pause();}
 update(s){this.volume=s.settings.volume;if(this.fanfare){if(this.volume<=0)this.endStinger();else this.fanfare.volume=Math.min(1,this.volume*.9);}if(this.current&&this.current.volume>this.volume*.6)this.current.volume=this.volume*.6;const h=worldMinute(s)/60;this.forced=s.settings.musicTrack&&s.settings.musicTrack!=='auto'&&trackById(s.settings.musicTrack)?s.settings.musicTrack:null;
  const hunt=['warning','tracking'].includes(s.horror?.horseman?.phase)||s.raidAtmosphere?.active||s.raid||['warning','tracking','searching'].includes(s.journey?.hunt.phase)||s.enemies.some(e=>e.hunter&&e.map===s.player.map&&!e.deadUntil&&['tracking','lunge'].includes(e.huntState)),
   room=s.player.map==='overworld'?buildingAt(s.player.x,s.player.y):null,indoor=room?(room.kind==='inn'?'inn':['shop','forge','bakery','clinic'].includes(room.kind)?'shop':null):null,
   mode=this.title?'title':this.boss?'boss':this.fight?'fight':hunt?'hunt':s.player.map!=='overworld'?'dungeon':indoor?indoor:h<6||h>=20?'night':townAt(s.player.x,s.player.y,38)?'town':'wild';
  if(this.pending?.mode===mode)return;
  const want=this.choose(mode,this.track?.id);
  if(this.forced&&!['hunt','fight','boss','title'].includes(mode)){this.switch(want.mode,want);return;}
  // A track picked from the list that belongs to the screen already showing (title or battle) plays right away.
  if(this.forced&&['fight','boss','title'].includes(mode)&&want.id===this.forced&&want.id!==this.track?.id){this.switch(mode,want);return;}
  // Rotate to another track of the same mode once the current one has played all the way through.
  if(mode===this.mode&&this.track&&!this.forced&&mode!=='hunt'&&performance.now()-this.trackStart>this.track.seconds*1000&&tracksFor(mode).length>1){this.switch(mode,want);return;}
  if(mode!==this.mode)this.switch(mode,want);}
 dispose(){this.disposed=true;this.on=false;this.activationVersion++;clearInterval(this.timer);this.timer=null;this.cancelSwitch();this.current?.pause();this.fading?.pause();this.endStinger();}
}
export class Narrator{
 constructor(music=null){this.enabled=true;this.volume=.85;this.token=0;this.recordings={};this.hasKokoro=false;this.music=music;this.approvedB=new RecordedNarratorB();this.bRequest=null;this.objectURL=null;this.ready=fetch('audio/kokoro/manifest.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(m=>{if(m?.engine==='kokoro-onnx'){this.recordings=m.recordings||{};this.hasKokoro=Object.keys(this.recordings).length>0;}}).catch(()=>{});this.audio=new Audio();this.audio.hidden=true;this.audio.dataset.narration='ready';document.body.append(this.audio);this.audio.onended=this.audio.onerror=()=>this.music?.duck(false,'dialogue');}
 async speak(text,who={}){text=normalizeSpeech(spokenText(text,who));if(!this.enabled)return false;this.stop();const token=this.token;let native=null;
  if(!who.id){const request=new AbortController();this.bRequest=request;try{native=await this.approvedB.load(text,{signal:request.signal});}catch{if(token===this.token)this.audio.dataset.narration='text-only';return false;}if(token!==this.token||!this.enabled)return false;}
  if(native){this.objectURL=URL.createObjectURL(new Blob([native.bytes],{type:'audio/wav'}));this.audio.src=this.objectURL;this.audio.dataset.narration='approved-B';}
  else{await this.ready;if(token!==this.token||!this.enabled)return false;const entry=this.recordings[speechKey(who.id,text)],cast=castFor(who);if(!entry||entry.text!==normalizeSpeech(text)||entry.voice!==cast.voice||entry.gender!==cast.gender||!/^[a-z0-9-]+\.mp3$/.test(entry.file)){this.audio.dataset.narration='text-only';return false;}this.audio.src='audio/kokoro/'+entry.file;this.audio.dataset.narration='kokoro:'+cast.voice;}
  this.audio.volume=this.volume;try{await this.audio.play();if(token!==this.token)return false;this.music?.duck(true,'dialogue');return true;}catch{if(token===this.token){this.music?.duck(false,'dialogue');this.releaseNative();}return false;}}
 releaseNative(){if(this.objectURL){URL.revokeObjectURL(this.objectURL);this.objectURL=null;this.audio.removeAttribute('src');this.audio.load();}}
 stop(){this.token++;this.bRequest?.abort();this.bRequest=null;this.audio.pause();this.releaseNative();this.music?.duck(false,'dialogue');}
}
export class RaiderVoices{
 // Retain the exported controller name for existing clients and save events.
 // Casey removed spoken hunting/door taunts; only physical raid effects remain.
 constructor(_narrator,_music,sounds){this.sounds=sounds;this.seen=new Set();}
 async update(s){for(const e of s.raidEvents||[]){if(this.seen.has(e.id))continue;this.seen.add(e.id);if(e.type!=='door-impact'||document.hidden||!s.settings.effects)continue;const enemy=s.enemies.find(n=>n.id===e.enemyId),door=e.buildingId&&MAP_BUILDING(s,e.buildingId),point=enemy||door;if(point&&audible(s.player,point))this.sounds.noiseBurst(.23,190,.32);}if(this.seen.size>256)this.seen=new Set((s.raidEvents||[]).map(e=>e.id));}
 stop(){}
 reset(state=null){this.seen=new Set((state?.raidEvents||[]).map(event=>event.id));}
}
function audible(player,point){return (player.map||'overworld')===(point.map||'overworld')&&dist(player,point)<=26;}
function MAP_BUILDING(s,id){const door=BUILDINGS.find(b=>b.id===id)?.door;return door?{map:'overworld',x:door.x+.5,y:door.y+.5}:null;}
export class Soundscape{
 constructor(){this.ctx=null;this.on=false;this.lastStep=0;this.lastBird=0;this.lastEffect='';}
 async enable(on){this.on=on;if(!on){this.ctx?.suspend();return;}if(!this.ctx){this.ctx=new AudioContext({sampleRate:48000});this.master=this.ctx.createGain();this.master.gain.value=.24;this.master.connect(this.ctx.destination);this.noise=this.ctx.createBuffer(1,48000*4,48000);const data=this.noise.getChannelData(0);let prev=0;for(let i=0;i<data.length;i++){prev=(prev+((Math.random()*2-1)*.02))/1.02;data[i]=prev*3.5;}this.wind=this.ctx.createBufferSource();this.wind.buffer=this.noise;this.wind.loop=true;this.filter=this.ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=400;this.ambient=this.ctx.createGain();this.ambient.gain.value=.04;this.wind.connect(this.filter);this.filter.connect(this.ambient);this.ambient.connect(this.master);this.wind.start();}await this.ctx.resume();}
 note(freq,duration,volume=.06,pan=0,type='sine',end=freq){if(!this.on||this.ctx?.state!=='running')return;const c=this.ctx,o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner(),t=c.currentTime;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);p.pan.value=pan;o.connect(g);g.connect(p);p.connect(this.master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};}
 noiseBurst(duration,frequency,gain,pan=0){if(!this.on||this.ctx?.state!=='running')return;const c=this.ctx,n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),p=c.createStereoPanner(),t=c.currentTime;n.buffer=this.noise;f.type='bandpass';f.frequency.value=frequency;f.Q.value=.8;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);p.pan.value=pan;n.connect(f);f.connect(g);g.connect(p);p.connect(this.master);n.start(t,Math.random()*2);n.stop(t+duration);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect();p.disconnect();};}
 update(s,renderer){if(!this.on||!this.ctx)return;const now=performance.now(),outside=s.player.map==='overworld'&&!buildingAt(s.player.x,s.player.y),night=worldMinute(s)<360||worldMinute(s)>1200;this.master.gain.setTargetAtTime(s.settings.volume*.55,this.ctx.currentTime,.4);this.filter.frequency.setTargetAtTime(worldWeather(s)==='rain'?2300:outside?450:190,this.ctx.currentTime,.6);this.ambient.gain.setTargetAtTime(outside?worldWeather(s)==='rain'?.13:.055:.014,this.ctx.currentTime,.6);
  if(s.player.moving&&now-this.lastStep>370){this.noiseBurst(.11,outside?700:230,.22,Math.sin(now/400)*.15);this.lastStep=now;}
  const horror=['warning','tracking'].includes(s.horror?.horseman?.phase)||s.raidAtmosphere?.active||['warning','tracking','searching'].includes(s.journey?.hunt.phase)||s.player.map.startsWith('dracula-');if(horror&&now-(this.lastHorror||0)>6200){this.noiseBurst(1.4,170,.16,-.6);this.note(82,.9,.10,-.6,'triangle',51);if(s.journey.hunt.phase==='warning'||s.raidAtmosphere?.phase==='warning'){this.note(220,2,.15,.4,'sine',216);this.note(577,2.3,.04,.4,'sine',570);}this.lastHorror=now;}
  if(!horror&&outside&&now-this.lastBird>(night?6500:9500)){const pan=Math.sin(now/7000)*.8;if(night){this.note(2800,.08,.023,pan,'sine',3400);setTimeout(()=>this.note(3000,.08,.02,pan,'sine',3600),170);}else{this.note(1650,.13,.045,pan,'sine',2450);setTimeout(()=>this.note(2600,.17,.035,pan,'sine',1800),210);}this.lastBird=now;}
  const effect=s.effects?.at(-1),key=effect?effect.until+':'+effect.type:'';if(effect&&key!==this.lastEffect){const q=renderer.project(effect.to.x,effect.to.y),pan=Math.max(-1,Math.min(1,q.x/renderer.w*2-1));this.noiseBurst(effect.type==='spell'?.45:.17,effect.type==='spell'?1100:3500,.26,pan);this.note(effect.type==='spell'?420:980,.3,.08,pan,'sine',effect.type==='spell'?850:570);this.lastEffect=key;}}
 dispose(){this.ctx?.close();}
}
