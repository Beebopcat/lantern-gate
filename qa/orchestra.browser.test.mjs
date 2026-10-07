// The orchestral score in the real game: shops and inns change the music, picks favour the orchestra, the fanfare is silent unless music is on.
import {launch,newPage,seed,open,enterViaLoad,audioCounts,ok,summary,KEY} from './lib.mjs';
const BASE=process.env.BASE||'http://127.0.0.1:8099/demos/top-secret/lantern-gate/';
const b=await launch();
const scores=page=>page.evaluate(()=>[...document.querySelectorAll('audio[data-score]')].map(a=>a.dataset.score+(a.paused?':paused':':playing')));
async function inside(kind,expect,label){
  const page=await newPage(b,{w:900,h:640});
  await seed(page,{classId:'warrior',name:'Tester'});
  const spot=await page.evaluate(async ({KEY,BASE,kind})=>{const base=new URL(BASE,location.href).pathname,W=await import(base+'world.js'),s=JSON.parse(localStorage.getItem(KEY)),bd=W.BUILDINGS.find(x=>x.kind===kind);
    s.player.x=bd.x+bd.w/2;s.player.y=bd.y+bd.h/2;s.player.map='overworld';s.enemies=[];localStorage.setItem(KEY,JSON.stringify(s));return {id:bd.id,inside:!!W.buildingAt(s.player.x,s.player.y)};},{KEY,BASE,kind});
  ok(spot.inside,`${label}: the hero starts inside a ${kind} (${spot.id})`);
  await open(page);await enterViaLoad(page);
  await page.click('#hud-menu');await page.click('#settings');await page.click('#music-toggle');await page.keyboard.press('Escape');
  let got=[];for(let i=0;i<40&&!got.some(x=>x===expect+':playing');i++){await page.waitForTimeout(500);got=await scores(page);}
  ok(got.some(x=>x===expect+':playing'),`${label}: ${expect} plays inside a ${kind} (${got})`);
  ok(page.errors.length===0,`${label}: no page errors ${page.errors}`);await page.ctx.close();
}
await inside('shop','open-for-trade','shop');
await inside('inn','a-bed-for-the-night','inn');
await inside('bakery','open-for-trade','bakery');
// rules of choice, straight from the real class
{
  const page=await newPage(b,{w:640,h:400});
  await seed(page,{classId:'warrior',name:'Tester'});await open(page);
  const r=await page.evaluate(async BASE=>{const base=new URL(BASE,location.href).pathname,A=await import(base+'audio.js'),S=await import(base+'soundtrack.js'),m=new A.Music();
    const pick=mode=>m.choose(mode).id,share=(mode,n=300)=>{let hi=0;for(let i=0;i<n;i++)if(m.choose(mode,null).hifi)hi++;return hi/n;};
    const before=performance.now();m.on=true;const played=await m.stinger('victory').catch(()=>false);
    return {boss:pick('boss'),shop:pick('shop'),inn:pick('inn'),hunt:pick('hunt'),town:share('town'),wild:share('wild'),night:share('night'),dungeon:share('dungeon'),fight:share('fight'),title:share('title'),
      played,ducked:[...m.duckers],counts:window.__audio,offOk:await (async()=>{const q=new A.Music();return q.stinger('victory');})(),modes:Object.keys(S.MODE_LABELS)};},BASE);
  ok(r.boss==='the-hollow-warden'&&r.shop==='open-for-trade'&&r.inn==='a-bed-for-the-night','boss, shop and inn resolve to their own themes '+JSON.stringify([r.boss,r.shop,r.inn]));
  ok(r.hunt==='hunt','the hunt keeps its own theme');
  for(const m of ['town','wild','night','dungeon','fight','title'])ok(r[m]>.65&&r[m]<.95,`${m}: the orchestra is picked most of the time (${Math.round(r[m]*100)}%)`);
  ok(r.played===true&&r.ducked.includes('stinger'),'the victory fanfare plays and ducks the score when music is on');
  ok(r.counts.play>=1,'the browser was asked to play it');
  ok(r.offOk===false,'the fanfare stays silent when music is off');
  ok(r.modes.includes('boss')&&r.modes.includes('shop')&&r.modes.includes('inn'),'the new modes are labelled in settings');
  ok(page.errors.length===0,'no page errors '+page.errors);await page.ctx.close();
}
await b.close();process.exit(summary()?1:0);
