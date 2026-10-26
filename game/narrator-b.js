import {NARRATOR_B_IDENTITY as EXPECTED} from './narrator-b-expected.js';
import {normalizeSpeech,speechKey} from './voice-cast.js';
import {validatePrologueBWave} from './prologue.js';

const SHA=/^[a-f0-9]{64}$/;
const SAME=['id','jobKey','key','text','textSha256','sourceFileSha256','src','samplingSeed'];
function abort(signal){if(signal?.aborted)throw new DOMException('Narration was cancelled.','AbortError');}
function exact(condition,message){if(!condition)throw Error(message);}
function sanitize(clip){
 const result={};for(const key of [...SAME,'status','voice','seed','sourceSha256','format','sampleRate','channels','bits','transcriptQA','audioSha256','byteLength','frames','durationSeconds','humanListeningReviewed'])if(clip[key]!==undefined)result[key]=clip[key];
 return Object.freeze(result);
}
export function validateNarratorBManifest(manifest){
 for(const key of ['version','storyId','engine','voice','seed','jobsSha256','sourceSha256'])exact(manifest?.[key]===EXPECTED[key],'Approved narrator catalog identity differs.');
 exact(['pending','partial','ready'].includes(manifest.status),'Approved narrator catalog has an invalid state.');
 exact(manifest.clips&&typeof manifest.clips==='object'&&!Array.isArray(manifest.clips),'Approved narrator catalog is incomplete.');
 let ready=0;
 for(const [key,clip]of Object.entries(manifest.clips)){
  const expected=EXPECTED.clips[key];exact(expected,'Unknown narrator recording identity.');
  for(const field of SAME)exact(clip?.[field]===expected[field],'Narrator recording source identity differs.');
  for(const[field,value]of Object.entries({voice:EXPECTED.voice,seed:EXPECTED.seed,sourceSha256:EXPECTED.sourceSha256,format:'native-pcm24-wav',sampleRate:24000,channels:1,bits:24}))exact(clip[field]===value,'Narrator recording voice or native format differs.');
  exact(['pending','ready'].includes(clip.status),'Narrator recording has an invalid state.');
  if(clip.status==='pending'){exact(clip.transcriptQA==='pending','Pending narrator recording cannot claim verified speech.');continue;}
  ready++;
  exact(clip.transcriptQA==='passed'&&SHA.test(clip.audioSha256||''),'Narrator recording has not passed exact speech verification.');
  exact(Number.isSafeInteger(clip.byteLength)&&clip.byteLength>=44&&clip.byteLength<=6_100_000,'Narrator recording byte count differs.');
  exact(Number.isSafeInteger(clip.frames)&&clip.frames>=3600&&clip.frames<=2_016_000,'Narrator recording frame count differs.');
  exact(Number.isFinite(clip.durationSeconds)&&Math.abs(clip.durationSeconds-clip.frames/24000)<1/24000,'Narrator recording duration differs.');
 }
 const count=Object.keys(EXPECTED.clips).length;
 exact(manifest.status!=='pending'||ready===0,'Pending narrator catalog claims ready clips.');
 exact(manifest.status!=='ready'||ready===count,'Complete narrator catalog is missing verified clips.');
 exact(manifest.transcriptQA===(ready===count?'passed':'pending'),'Narrator catalog speech verification state differs.');
 return manifest;
}

// The controller owns playback and Blob URLs. This loader never synthesizes,
// starts Audio, substitutes another narrator, or exposes private provenance.
export class RecordedNarratorB{
 constructor({fetcher=globalThis.fetch,cryptoImpl=globalThis.crypto,signal}={}){
  this.fetcher=fetcher===globalThis.fetch?fetcher.bind(globalThis):fetcher;this.cryptoImpl=cryptoImpl;this.catalog=null;this.error=null;
  // NPC dialogue may be played before the default narrator. Initialization
  // therefore resolves safely while load() retains and reports real corruption.
  this.ready=this.refresh(signal).catch(error=>{this.error=error;return null;});
 }
 async refresh(signal){
  abort(signal);const response=await this.fetcher('audio/narrator-b-manifest.json',{cache:'no-store',signal});abort(signal);
  if(!response.ok){if([404,410].includes(response.status)){this.catalog=null;this.error=null;return null;}throw Error('Recorded narrator catalog could not load.');}
  const value=await response.json();abort(signal);this.catalog=validateNarratorBManifest(value);this.error=null;return this.catalog;
 }
 async load(text,{signal}={}){
  abort(signal);await this.ready;abort(signal);
  let refreshed=false;
  if(this.error){
   try{await this.refresh(signal);abort(signal);refreshed=true;}
   catch(error){this.error=error;throw error;}
  }
  const clean=normalizeSpeech(text),key=speechKey('',clean),expected=EXPECTED.clips[key];
  if(!expected||clean!==expected.text)return null;
  let clip=this.catalog?.clips[key];
  // Only a new explicit read retries a previously absent/pending recording.
  // This permits a newly promoted clip without polling or a permanent cache.
  if((!clip||clip.status==='pending')&&!refreshed){await this.refresh(signal);abort(signal);clip=this.catalog?.clips[key];}
  if(!clip||clip.status==='pending')return null;
  exact(this.cryptoImpl?.subtle,'Narrator byte verification is unavailable.');
  const sourceDigest=await this.cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(clean));abort(signal);
  const hex=bytes=>[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
  exact(hex(sourceDigest)===expected.textSha256,'Narrator text does not match its approved recording.');
  const response=await this.fetcher(clip.src,{cache:'no-store',signal});abort(signal);
  exact(response.ok,'Verified narrator recording could not load.');
  const bytes=await response.arrayBuffer();abort(signal);
  exact(bytes.byteLength===clip.byteLength,'Narrator recording byte count changed.');
  const technical=validatePrologueBWave(bytes);
  exact(technical.frames===clip.frames&&Math.abs(technical.seconds-clip.durationSeconds)<1/24000,'Narrator recording is not the complete verified waveform.');
  const digest=await this.cryptoImpl.subtle.digest('SHA-256',bytes);abort(signal);
  exact(hex(digest)===clip.audioSha256,'Narrator recording differs from its verified bytes.');
  return {bytes,clip:sanitize(clip)};
 }
}
