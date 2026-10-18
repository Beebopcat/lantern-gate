// Cascade check for the "Lantern storybook" skin: dumps computed styles of the visible UI in several states, so that two runs can be compared.
// The skin must look the same whether jrpg-theme.css is linked first (required) or after the legacy sheets (how it was first designed).
// usage: ORDER=first|last OUT=/tmp/skin-first.json BASE=... node qa/skin-diff.mjs        then   node qa/skin-diff.mjs --diff a.json b.json
import fs from 'node:fs';
import {launch,newPage,seed,open,enterViaLoad,BASE} from './lib.mjs';

const PROPS=['color','backgroundColor','backgroundImage','backgroundSize','backgroundPosition','borderTopColor','borderTopWidth','borderTopStyle','borderRightColor','borderRightWidth','borderBottomColor','borderBottomWidth','borderBottomStyle','borderLeftColor','borderLeftWidth','borderTopLeftRadius','borderBottomRightRadius','boxShadow','textShadow','fontFamily','fontSize','fontWeight','fontStyle','fontVariantCaps','letterSpacing','lineHeight','textTransform','textAlign','opacity','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','display','position','width','height','minHeight','filter','backdropFilter','outlineStyle','cursor','gridTemplateColumns','gap','flexDirection','justifyContent','alignItems','overflowY'];
const pathOf=el=>{const parts=[];for(let e=el;e&&e.nodeType===1&&e!==document.documentElement;e=e.parentElement){let s=e.tagName.toLowerCase();if(e.id){parts.unshift(s+'#'+e.id);break;}const cls=[...e.classList].slice(0,3).join('.');if(cls)s+='.'+cls;const sib=[...e.parentElement.children].filter(c=>c.tagName===e.tagName&&c.className===e.className);if(sib.length>1)s+=':'+sib.indexOf(e);parts.unshift(s);}return parts.join('>');};

async function dump(page,state){
  return page.evaluate(({PROPS,state})=>{
    const out={};
    const roots=[document.getElementById('game'),document.getElementById('panel'),document.body];
    const seen=new Set();
    const pathOf=el=>{const parts=[];for(let e=el;e&&e.nodeType===1&&e!==document.documentElement;e=e.parentElement){let s=e.tagName.toLowerCase();if(e.id){parts.unshift(s+'#'+e.id);break;}const cls=[...e.classList].slice(0,3).join('.');if(cls)s+='.'+cls;const sib=[...e.parentElement.children].filter(c=>c.tagName===e.tagName&&c.className===e.className);if(sib.length>1)s+=':'+sib.indexOf(e);parts.unshift(s);}return parts.join('>');};
    for(const root of roots)for(const el of [root,...root.querySelectorAll('*')]){
      if(seen.has(el)||['SCRIPT','STYLE','CANVAS','PATH','SVG','LINK'].includes(el.tagName))continue;seen.add(el);
      const cs=getComputedStyle(el);if(cs.display==='none')continue;
      const r=el.getBoundingClientRect();if(!r.width&&!r.height)continue;
      const row={};for(const p of PROPS)row[p]=cs[p];
      out[state+' | '+pathOf(el)]=row;
    }
    return out;
  },{PROPS,state});
}

if(process.argv[2]==='--diff'){
  // Reports the differences that start at an element. A difference in an inherited property (colour, type, spacing) is skipped when the
  // parent already differs in the same way, and a border colour that merely follows currentColor is skipped, so the list shows causes, not echoes.
  const a=JSON.parse(fs.readFileSync(process.argv[3])),b=JSON.parse(fs.readFileSync(process.argv[4]));
  const INH=new Set(['color','fontFamily','fontSize','fontWeight','fontStyle','fontVariantCaps','letterSpacing','lineHeight','textTransform','textAlign','cursor','textShadow']);
  const parentKey=k=>{const i=k.lastIndexOf('>');if(i<0)return null;const head=k.slice(0,k.indexOf(' | ')+3),rest=k.slice(head.length);const j=rest.lastIndexOf('>');return j<0?null:head+rest.slice(0,j);};
  const byEl={};let total=0,only=0;
  for(const k of Object.keys(a)){
    if(!b[k]){only++;continue;}
    const pk=parentKey(k);
    for(const p of Object.keys(a[k])){
      if(a[k][p]===b[k][p])continue;
      if(/^border(Top|Right|Bottom|Left)Color$/.test(p)&&a[k][p]===a[k].color&&b[k][p]===b[k].color)continue;
      if(INH.has(p)&&pk&&a[pk]&&b[pk]&&a[pk][p]!==b[pk][p])continue;
      (byEl[k]??=[]).push([p,a[k][p],b[k][p]]);total++;
    }
  }
  const ignore=(process.env.IGNORE||'').split(',').filter(Boolean);
  console.log(`elements compared ${Object.keys(a).length}, only-in-A ${only}, root differences ${total} on ${Object.keys(byEl).length} elements`);
  const groups={};
  for(const [k,list] of Object.entries(byEl)){
    const el=k.replace(/^[^|]*\| /,'').replace(/:\d+/g,'');
    const sig=list.filter(x=>!ignore.includes(x[0])).map(x=>x[0]+'='+String(x[1]).slice(0,60)+' -> '+String(x[2]).slice(0,60)).join('\n        ');
    if(!sig)continue;
    const g=(groups[el+'\n        '+sig]??=[]);g.push(k.split(' | ')[0]);
  }
  for(const [sig,states] of Object.entries(groups))console.log(`\n${sig.split('\n')[0]}   [${[...new Set(states)].join(' ')}]\n        ${sig.split('\n').slice(1).join('\n').trim()}`);
  process.exit(0);
}

const ORDER=process.env.ORDER||'first',OUT=process.env.OUT||`/tmp/skin-${ORDER}.json`;
const SIZE=(process.env.SIZE||'1280x720').split('x').map(Number);
const b=await launch();
const result={};
const route=async page=>{
  await page.route('**/index.html*',async route=>{
    const res=await route.fetch();let html=await res.text();
    if(ORDER==='last'){const link='<link rel="stylesheet" href="jrpg-theme.css">';html=html.replace(link,'').replace('<link rel="stylesheet" href="starter.css">','<link rel="stylesheet" href="starter.css">'+link);}
    await route.fulfill({response:res,body:html,headers:{...res.headers(),'content-type':'text/html'}});
  });
};
{ // title and creation
  const page=await newPage(b,{w:SIZE[0],h:SIZE[1]});await route(page);await open(page);await page.waitForTimeout(1500);
  Object.assign(result,await dump(page,'title'));
  await page.click('#starter-menu [data-starter=new]');await page.waitForSelector('#creation-form');await page.waitForTimeout(800);
  Object.assign(result,await dump(page,'create'));
  await page.click('.calling-card[data-id=ranger]');await page.waitForSelector('.companion-card');await page.waitForTimeout(500);await page.click('.companion-card >> nth=1');await page.waitForTimeout(200);
  Object.assign(result,await dump(page,'create-ranger'));
  await page.ctx.close();
}
{ // play, menu, panels
  const page=await newPage(b,{w:SIZE[0],h:SIZE[1]});await route(page);
  await seed(page,{classId:'ranger',companionId:'ash-wolf',name:'Rowan Vale',mutate:`s.player.gold=137;s.player.xp=(s.player.xp||0)+30;`});
  await page.evaluate(async ({KEY,BASE})=>{const base=new URL(BASE,location.href).pathname;const W=await import(base+'world.js');const s=JSON.parse(localStorage.getItem(KEY));const n=W.PROPS.find(p=>p.id==='hearth-notice');if(n){s.player.x=n.x+1.2;s.player.y=n.y+.6;}localStorage.setItem(KEY,JSON.stringify(s));},{KEY:'casey.top-secret.lantern-gate.hollow.v1',BASE});
  await open(page);await enterViaLoad(page);await page.waitForTimeout(2500);
  Object.assign(result,await dump(page,'world'));
  await page.click('#hud-menu');await page.waitForTimeout(400);Object.assign(result,await dump(page,'menu'));await page.click('#hud-menu');await page.waitForTimeout(200);
  for(const id of (process.env.TABS||'bag,journal,achievements,abilities,skills,stats,character,atlas,settings,world-options').split(',')){
    await page.click('#hud-menu');await page.waitForTimeout(200);await page.click('#'+id);await page.waitForTimeout(600);
    Object.assign(result,await dump(page,'tab-'+id));
    await page.keyboard.press('Escape');await page.waitForTimeout(200);if(await page.evaluate(()=>document.getElementById('panel').open))await page.click('#close-panel');
  }
  await page.focus('#world');await page.keyboard.press('e');await page.waitForTimeout(800);Object.assign(result,await dump(page,'board'));await page.keyboard.press('Escape');await page.waitForTimeout(200);
  console.log('errors',page.errors);await page.ctx.close();
}
{ // conversation (compact window)
  const page=await newPage(b,{w:SIZE[0],h:SIZE[1]});await route(page);
  await seed(page,{classId:'warrior',name:'Rowan Vale',mutate:`const n=s.actors.find(a=>a.id==='mara')||s.actors.find(a=>a.type==='npc'&&a.map==='overworld');s.player.x=n.x+.8;s.player.y=n.y;n.path=[];n.think=30;`});
  await open(page);await enterViaLoad(page);await page.waitForTimeout(600);
  await page.focus('#world');await page.keyboard.press('e');await page.waitForTimeout(1200);Object.assign(result,await dump(page,'talk'));
  console.log('errors',page.errors);await page.ctx.close();
}
fs.writeFileSync(OUT,JSON.stringify(result));
console.log('saved',OUT,Object.keys(result).length,'elements');
await b.close();
