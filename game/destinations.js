import {MAPS,TOWNS,SITES,BUILDINGS,PROPS,quests,dist,townAt,buildingAt} from './world.js';
import * as E from './engine.js';
import {doorStatus} from './life.js';
import {icon} from './icons.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roleOffers={creation:'A living-seed commission and knowledge of the drowned names','cursed keeper':'A quest to silence the hunting bell',count:'The ledger of stolen names and a choice of mercy or bargain',keeper:'Local history and news of the lanterns',scholar:'Records, local history and conversation',smith:'Blades, armor, bows and ore to buy or sell',healer:'Rest, recovery and local conversation',baker:'Bread and seasoned wood to buy or sell',farmer:'Fish, bread and moonleaf to buy or sell',merchant:'Provisions and remedies to buy or sell',guard:'News of the town and help defending it',ranger:'Local knowledge and help defending the town',innkeeper:'Rest, recovery, provisions and trade'};
const descriptions={notice:'Read local commissions and volunteer for the town watch.',lamp:'A working lantern. Kindle or extinguish its flame.',brazier:'A hearth you can light or put out.',well:'Drink cool water to recover ten mana.',cart:'Roadwarden transport between settlements you have already visited.',stall:'Buy furnishings, outfits, companions or a cottage deed.',beacon:'A memorial or shrine along the keepers’ roads.',landmark:'A local landmark with an account of the town’s past.',grave:'Read the inscription and remember the people of the Marches.',bed:'Rest for an hour to recover when the surroundings are safe.',table:'A place set for a meal; the host may offer bread.',bookcase:'Read the records and stories kept here.',anvil:'Work a paid shift or forge supplies from ore.',oven:'Work a paid shift or bake bread with seasoned wood.',alchemy:'Work a paid shift or turn moonleaf into healing salves.',farmwork:'Help in the kitchen garden to earn wages.',chest:'Inspect the contents of this supply chest.',barrels:'Check the stored provisions.',property:'A permanent cottage available through the town’s market.',crystal:'A luminous crystal that restores mana.',plant:'Gather a medicinal plant for your satchel.',branch:'Collect seasoned wood for cooking and crafting.',ore:'Gather workable cinder iron.',relic:'Recover an item connected to the Marches’ stories.',gate:'The ancient passage at the heart of the keepers’ story.',pet:'An animal companion. Ask it to follow or wait.',flowers:'A flowering plant brightening this corner of the world.',rock:'An outcrop of weathered stone.',bare:'A bare tree beside the road.'};
const buildingDescriptions={home:'A household’s private cottage.',archive:'Records and scholarship from the town’s history.',forge:'A smith’s workshop with a working anvil.',clinic:'The town’s infirmary and remedy bench.',bakery:'A bakehouse with ovens for bread and paid work.',inn:'An inn with shared meals, beds and a resident innkeeper.',shop:'A trading house for provisions and supplies.',farm:'A farmhouse serving the local fields.'};
const nearest=(x,y)=>TOWNS.reduce((best,t)=>dist(t,{x,y})<dist(best,{x,y})?t:best,TOWNS[0]);
export function catalog(s){
 return [
  ...TOWNS.map(t=>({...t,id:'town:'+t.id,town:t.id,map:'overworld',x:t.x+1,y:t.y+3,type:'town',category:'towns'})),
  ...SITES.flatMap(site=>Array.from({length:site.levels||2},(_,i)=>i+1).map(level=>({id:`site:${site.id}:${level}`,name:`${site.name} · ${site.id==='dracula'?'Level '+level:level===1?'Upper':'Deep'} chambers`,map:site.id+'-'+level,x:site.id==='dracula'?40.5:24.5,y:site.id==='dracula'?72.5:level===1?41.5:40.5,type:'site',kind:site.kind,site:site.id,town:nearest(site.x,site.y).id,category:'sites'}))),
  
  ...[...s.actors,...(s.journey?.residents||[])].filter(n=>!n.deadUntil).map(n=>({...n,category:'people'}))
 ];
}
export function directoryEntries(s,mode='nearby'){const entries=catalog(s);return mode==='nearby'?entries.filter(o=>o.category==='people'?(o.map===s.player.map&&dist(o,s.player)<24):o.category==='towns'||o.category==='sites').sort((a,b)=>(a.category==='people'?0:1)-(b.category==='people'?0:1)||dist(a,s.player)-dist(b,s.player)):entries;}
export function resolveDestination(s,id){return catalog(s).find(o=>o.id===id)||E.find(s,id);}
export function describe(s,o){
 const type=o.type||(o.to?'portal':'landmark'),b=BUILDINGS.find(b=>b.id===o.building)||(o.map==='overworld'?buildingAt(o.x,o.y):null);
 const site=SITES.find(a=>a.id===(o.site||MAPS[o.map]?.site));
 const local=o.map==='overworld'?townAt(o.x,o.y):null;
 const town=TOWNS.find(t=>t.id===(b?.town||local?.id||o.town))||(site?nearest(site.x,site.y):nearest(o.x,o.y));
 const area=o.map!=='overworld'?`${MAPS[o.map]?.name} · beneath ${site?.region||town.region}`:b?`${b.name} · ${town.name} · ${town.region}`:local||type==='town'?`${town.name} · ${town.region}`:`Near ${town.name} · ${town.region}`;
 let description=descriptions[type]||'A detail of the surrounding landscape.',offers='',badge='',art=o.item||type;
 if(type==='npc'||type==='mythic'){
  description=`${o.name} is ${o.role==='innkeeper'?'the innkeeper':/^[aeiou]/.test(o.role)?'an '+o.role:'a '+o.role}. Currently ${o.task||o.job}.`;
  offers=roleOffers[o.role]||'Conversation and local knowledge';
  const count=quests.filter(q=>q.giver===o.id&&s.quest[q.id]!=='complete').length;
  if(count)offers+=` · ${count} commission${count===1?'':'s'}`;
  if(o.id==='orin'&&s.quest.medicine==='complete')offers+=' · Traveling companion';
  art=o.role;
 }else if(type==='town'){
  description=TOWNS.find(t=>t.id===o.town).motto;offers='Market, inn, workshops, homes and commissions';badge=s.discovered.includes(o.town)?'Visited':'Unexplored';
 }else if(type==='site'){
  description=`Explore the ${site.kind==='haunted'?'haunted rooms':site.kind==='roots'?'underground roots':site.kind+' passages'} of ${site.name}.`;offers=site.id==='dracula'?'Four floors, three resident quest givers and the stolen-name mystery':'Exploration, records and relics';badge='Hostile creatures may be present';art=site.kind;
 }else if(type==='door'&&b){
  description=b.purchasable?'An unfurnished cottage with your own lock and space for furniture.':buildingDescriptions[b.kind];badge='Door '+doorStatus(s,b);art=b.kind==='forge'?'anvil':b.kind==='clinic'?'salve':b.kind==='bakery'?'oven':b.kind==='inn'?'bed':b.kind==='shop'?'stall':b.kind==='archive'?'bookcase':'home';
 }else if(type==='portal'){
  description=`An entrance leading to ${MAPS[o.to]?.name||'another part of the world'}.`;art=o.kind;
 }else if(type==='enemy'){
  description=`${o.name} is hostile. Approaching can begin combat.`;badge='Danger';art='enemy';
 }else if(type==='beacon'&&o.town){description='A wayfarer shrine that restores health and watches over the town.';}
 return {area,description,offers,badge,art,town:town.id};
}
export function destinationCard(s,o,action='destination'){
 const info=describe(s,o),same=(o.map||'overworld')===s.player.map;
 return `<button class="destination-card" data-action="${action}" data-id="${esc(o.id)}"><span class="destination-art">${icon(info.art)}</span><span class="destination-copy"><strong>${esc(o.name||o.type)}</strong><span class="destination-area">${esc(info.area)}</span><span class="destination-description">${esc(info.description)}</span>${info.offers?`<span class="destination-offers"><b>Offers</b> ${esc(info.offers)}</span>`:''}<span class="destination-meta">${same?Math.round(dist(s.player,o))+' paces away':'Route through connected entrances'}${info.badge?' · '+esc(info.badge):''}</span><span class="destination-cta">${action==='fast-travel'?'Take roadwarden transport':o.category==='towns'?'Walk to town':o.category==='sites'?'Walk into the site':'Walk here & interact'} <span aria-hidden="true">→</span></span></span></button>`;
}
export function createDirectory({getState,panel}){
 let mode='nearby',query='',category='all',town='all',page=0;
 function results(){
  const s=getState();let list=directoryEntries(s,mode);
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  list=list.filter(o=>{const d=describe(s,o);return (category==='all'||o.category===category)&&(town==='all'||d.town===town)&&words.every(w=>[o.name,o.role,d.area,d.offers,d.description].join(' ').toLowerCase().includes(w));});
  const start=page*30;document.getElementById('destination-count').textContent=list.length?`${start+1}–${Math.min(start+30,list.length)} of ${list.length} destinations`:'No destinations match your search.';
  document.getElementById('destination-results').innerHTML=list.slice(start,start+30).map(o=>destinationCard(s,o)).join('');
  document.getElementById('destination-pages').innerHTML=(page?'<button data-directory-page="-1">Previous</button>':'')+(start+30<list.length?'<button data-directory-page="1">More destinations</button>':'');
 }
 function show(next='nearby'){
  mode=next;query='';category='all';town='all';page=0;
  panel('wayfarer’s directory','People, places & roads',`<div class="directory-tabs" role="group" aria-label="Destinations"><button data-directory-mode="nearby" aria-pressed="${mode==='nearby'}">Nearby</button><button data-directory-mode="world" aria-pressed="${mode==='world'}">Across the world</button></div><p class="subtle">Choose a destination to walk there. Routes use the existing roads and entrances; locked doors and danger can interrupt the journey. Move manually or select Stop to cancel.</p><div class="directory-filters"><label>Search<input id="destination-search" type="search" placeholder="Name, place, job or service" autocomplete="off"></label>${mode==='world'?`<label>Show<select id="destination-category"><option value="all">People & regions</option><option value="towns">Towns</option><option value="sites">Ruins & dungeons</option><option value="people">People</option></select></label><label>Area<select id="destination-town"><option value="all">All nine regions</option>${TOWNS.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>`:''}</div><p class="directory-count" id="destination-count" role="status"></p><div id="destination-results" class="destination-grid"></div><div id="destination-pages" class="directory-pages"></div>`,'directory-dialog');
  const body=document.getElementById('panel-body');
  body.querySelectorAll('[data-directory-mode]').forEach(b=>b.onclick=()=>show(b.dataset.directoryMode));
  document.getElementById('destination-search').oninput=e=>{query=e.target.value;page=0;results();};
  for(const [id,set] of [['destination-category',v=>category=v],['destination-town',v=>town=v]]){const el=document.getElementById(id);if(el)el.onchange=e=>{set(e.target.value);page=0;results();};}
  document.getElementById('destination-pages').onclick=e=>{const b=e.target.closest('[data-directory-page]');if(!b)return;page+=Number(b.dataset.directoryPage);results();document.getElementById('destination-results').querySelector('button')?.focus();};
  results();
 }
 return {show};
}
