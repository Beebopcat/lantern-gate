// Simple interface vectors; character/world art remains owned by the renderer.
import {interfaceIconId} from './interface-icon-map.js';
const names=new Set(["bread","tonic","salve","sword","armor","bow","lantern","journal","map","home","cave","town","notice","well","anvil","bed","flowers","pet","bag","settings","compass","interact","person","chest","check","fish","leaf","ore","wood","coil","lens","medallion","bell","pearl","ledger","locket","verse","seed","crown","heart","ring","cart","grave","table","chair","oven","bookcase","stall"]);
const aliases={blade:'sword',attack:'sword',spell:'lantern',lamp:'lantern',brazier:'oven',beacon:'lantern',nearby:'compass',atlas:'map',life:'home',property:'home',door:'home',portal:'cave',entrance:'cave',stairsUp:'cave',stairsDown:'cave',ruin:'cave',haunted:'home',crypt:'grave',abbey:'grave',fort:'town',gate:'lantern',archive:'bookcase',cellar:'cave',mine:'ore',roots:'leaf',landmark:'town',tableware:'table',barrels:'chest',alchemy:'salve',farmwork:'leaf',crystal:'heart',plant:'leaf',branch:'wood',relic:'heart',wardrobe:'armor',rug:'map',petbed:'bed',cat:'pet',dog:'pet',fox:'pet',keeper:'lantern',scholar:'journal',smith:'anvil',healer:'salve',baker:'bread',farmer:'leaf',merchant:'stall',guard:'armor',ranger:'bow',innkeeper:'bed',enemy:'sword',rock:'ore',bare:'wood',gold:'ring',search:'lens',furniture:'chair',outfit:'armor'};
const controls={arrow:'➜',pause:'Ⅱ',play:'▶',close:'×',help:'?'};
export function icon(key,extra=''){
 const known=names.has(key)||Object.hasOwn(aliases,key)||Object.hasOwn(controls,key);
 const name=interfaceIconId(known?key:'heart'),classes='game-icon '+(Object.hasOwn(controls,key)?'game-control-art ':'')+extra;
 return '<img class="'+classes+'" src="assets/interface-vector/'+name+'.svg" width="72" height="72" alt="" aria-hidden="true" draggable="false" decoding="async">';
}
export const itemIcon=id=>icon(id,'inventory-art');
export function decorateControls(root=document){
 const controls={interact:'interact',attack:'sword',spell:'lantern',nearby:'compass',bag:'bag',journal:'journal',atlas:'map',life:'home',settings:'settings',help:'help',pause:'pause','close-panel':'close'};
 for(const [id,key] of Object.entries(controls)){
  const el=root.getElementById(id);if(!el)continue;
  if(['help','pause','close-panel'].includes(id)){el.innerHTML=icon(key);continue;}
  const existing=el.querySelector('.game-icon,svg');if(existing)existing.outerHTML=icon(key);else el.insertAdjacentHTML('afterbegin',icon(key));
 }
 const mark=root.querySelector('.gate-mark');if(mark)mark.innerHTML=icon('lantern');
 const coin=root.querySelector('.wallet > span:first-child');if(coin)coin.innerHTML=icon('gold');
 for(const el of root.querySelectorAll('[data-move]')){
  const angle={'0,-1':-90,'-1,0':180,'0,1':90,'1,0':0}[el.dataset.move];el.innerHTML=icon('arrow');el.querySelector('.game-icon').style.transform='rotate('+angle+'deg)';
 }
}
