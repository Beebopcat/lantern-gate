// The orchestral score: every registered track exists on disk, is a real MP3 of the stated length, belongs to a known mode, and the
// rotation rules (orchestra preferred, one-shot fanfare outside the rotation) hold.  Node only: ROOT=$PWD/game/ node qa/orchestra.test.mjs
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const ROOT=process.env.ROOT||new URL('../game/',import.meta.url).pathname;
const S=await import(ROOT+'soundtrack.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('  FAIL',m);}};
const dur=f=>Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',f],{encoding:'utf8'}).trim());
const ids=S.TRACKS.map(t=>t.id);
ok(new Set(ids).size===ids.length,'track ids are unique');
ok(S.TRACKS.every(t=>S.MODE_LABELS[t.mode]),'every track has a labelled mode');
for(const m of ['title','town','wild','night','dungeon','fight','boss','shop','inn'])ok(S.tracksFor(m).length>=1,`mode ${m} has a track`);
ok(S.ORCHESTRA.length===11,`eleven orchestral tracks (${S.ORCHESTRA.length})`);
ok(S.ORCHESTRA.every(t=>t.hifi===true&&t.file.startsWith('orchestra/')),'orchestral tracks are flagged hi-fi and live in audio/orchestra');
for(const t of [...S.ORCHESTRA,S.STINGERS.victory]){
  const f=ROOT+'audio/'+t.file;
  ok(fs.existsSync(f),`${t.id}: file exists`);
  if(!fs.existsSync(f))continue;
  const d=dur(f);ok(Math.abs(d-t.seconds)<=2.5,`${t.id}: stated ${t.seconds}s matches the file (${d.toFixed(1)}s)`);
  ok(fs.statSync(f).size>300000&&fs.statSync(f).size<6e6,`${t.id}: sensible size (${(fs.statSync(f).size/1e6).toFixed(1)} MB)`);
  const head=fs.readFileSync(f).subarray(0,3).toString('latin1');ok(head==='ID3'||fs.readFileSync(f)[0]===0xff,`${t.id}: is an MP3`);
}
ok(!S.TRACKS.some(t=>t.id===S.STINGERS.victory.id),'the victory fanfare is not part of the rotation');
// every old track is still there (nothing was removed)
for(const id of ['hearthside','greenroad','moonlit-lanterns','low-cellar','bell-alarm','gate-at-dawn','lantern-hymn'])ok(ids.includes(id),`classic track ${id} kept`);
ok(fs.existsSync(ROOT+'audio/orchestra/SOUNDFONT-LICENSE.txt'),'soundfont licence text ships with the score');
ok(/MIT/.test(fs.readFileSync(ROOT+'audio/orchestra/SOUNDFONT-LICENSE.txt','utf8')),'licence text names the MIT licence');
ok(/MuseScore General/.test(fs.readFileSync(ROOT+'journey-ui.js','utf8')),'settings credits the soundfont');
// never any copying of another game's music: no other title names in the track list
ok(!/octopath|final fantasy|dragon quest|zelda|pokemon/i.test(JSON.stringify(S)),'no other game named in the track data');
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
