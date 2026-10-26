// Quest presentation for the Lantern Gate: the Quest Log, storybook quest cards for conversations, the commission board,
// quest banners and the tracked-quest ribbon. Pure presentation: quest rules, rewards and saves stay in engine.js/world.js;
// quest-meta.js supplies the facts. The only state written here is the optional `state.trackedQuest` id and, for board
// jobs, the same `state.quest[id]='active'` flag that speaking to the giver sets.
import * as Q from './quest-meta.js';
import {TOWNS,NPCS,quests} from './world.js';
import {ready as engineReady} from './engine.js';

const LABEL=Q.STATUS_LABEL,GROUPS=[['story','Main story'],['side','Side stories'],['commission','Commissions']];
const cap=t=>String(t||'').replace(/^./,c=>c.toUpperCase());
const shown=p=>p.complete?'complete':p.ready?'ready':p.accepted?'active':'available';

export function createQuestUI({getState,panel,esc,message,closePanel,approach,setWaypoint,openMap,save,renderer,hud}){
 const $=id=>document.getElementById(id),game=$('game'),body=$('panel-body');
 let surface='',sel=null,view='list',boardTown=null,openedBy=null;

 // ------------------------------------------------------------------ small pieces
 const chip=(status,label)=>`<span class="qx-chip" data-status="${status}">${esc(label||LABEL[status]||cap(status))}</span>`;
 const catChip=m=>`<span class="qx-cat" data-cat="${m.category}">${esc(m.categoryLabel)}</span>`;
 const btn=(label,action,id='',{primary=false,pressed,disabled=false,cls=''}={})=>`<button type="button" class="jr-btn${primary?' jr-btn--primary':''} ${cls}" data-action="${action}" data-id="${esc(id)}"${pressed===undefined?'':` aria-pressed="${pressed}"`}${disabled?' disabled':''}>${esc(label)}</button>`;
 const level=(s,lv)=>{const f=Q.levelFit(s,lv);return `<b class="jr-num qx-lv">Lv ${lv}</b> <em class="qx-fit" data-tone="${f.tone}" title="You are level ${f.mine}">${f.label}</em>`;};
 const reward=m=>`<ul class="qx-reward" aria-label="Reward"><li class="qx-coin"><i aria-hidden="true"></i><b class="jr-num">${m.reward.coins}</b> coins</li>${m.reward.xp?`<li><b class="jr-num">${m.reward.xp}</b> XP</li>`:''}${m.reward.items.map(i=>`<li class="qx-item">${esc(i)}</li>`).join('')}</ul>`;
 const bar=(f,cls='jr-bar--xp')=>`<span class="jr-bar ${cls}" aria-hidden="true"><i style="width:${Math.round(Math.max(0,Math.min(1,f))*100)}%"></i></span>`;
 const actorOf=(s,id)=>s.actors?.find(a=>a.id===id)||s.journey?.residents?.find(a=>a.id===id)||null;
 const isTracked=(s,id)=>Q.trackedQuest(s)===id;
 const pips=(s,caption=false)=>{const rows=Q.chapterRows(s),n=Q.storyCount(s).done;return `<ol class="qx-pips" aria-label="${n} of ${rows.length} chapters complete">${rows.map(r=>`<li data-state="${r.state}" title="Chapter ${r.n}"></li>`).join('')}</ol>${caption?`<p class="qx-pipcap"><b class="jr-num">${n} / ${rows.length}</b> chapters complete</p>`:''}`;};
 // The conversation-friendly objective: what to do, never "go and speak to the person you are speaking to".
 function objective(s,p){
  if(p.id==='keepers'){const c=Q.currentChapter(s);return c?Q.chapterProgress(s,c.n).line:'The lights are restored.';}
  if(p.ready)return 'You carry what is needed. Turn it in.';
  const st=p.steps.find(x=>!x.done&&x.id!=='speak')||p.current;return st?Q.stepLine(st):'';
 }
 function portraits(root=body){
  const s=getState();
  for(const c of root.querySelectorAll('canvas[data-npc]')){
   const a=actorOf(s,c.dataset.npc);if(!a)continue;
   try{renderer.portrait(c,a,null,{scale:Number(c.dataset.scale)||2,shadow:true,dir:'down'});}catch{c.hidden=true;}
  }
 }
 // Conversations and boards are "compact" message boxes in the minimal HUD; quest cards need the full panel.
 function roomy(){const p=$('panel');if(p)p.dataset.compact='false';}

 // ------------------------------------------------------------------ banners (quest accepted / progress / ready / done)
 const wrap=document.createElement('div');wrap.id='quest-toast';wrap.className='qt-wrap';wrap.setAttribute('role','status');wrap.setAttribute('aria-live','polite');wrap.setAttribute('aria-atomic','true');document.body.append(wrap);  // body-level, after the panel dialog: #game is an isolated stacking context, so a child of it would sit under the open panel
 let queue=[],showing=null,timer=0;
 function paint(b){
  wrap.innerHTML=`<div class="qt-card jr-panel" data-kind="${esc(b.kind||'info')}"><i class="qt-gem" aria-hidden="true"></i><div class="qt-text"><span class="jr-eyebrow">${esc(b.kicker)}</span><strong>${esc(b.title)}</strong>${b.line?`<span class="qt-line">${esc(b.line)}</span>`:''}</div></div>`;
 }
 function pump(){
  if(showing||!queue.length)return;
  const bt=$('battle');if((bt&&!bt.hidden)||game.dataset.arriving==='true'){timer=setTimeout(pump,700);return;}  // hold banners until the fight or the arrival scene is over
  showing=queue.shift();paint(showing);
  timer=setTimeout(()=>{wrap.innerHTML='';showing=null;timer=setTimeout(pump,260);},showing.ms||4200);
 }
 function banner(b){
  // Never build a long backlog: keep the newest few, and let a more important banner jump the queue.
  if(b.priority&&queue.length)queue.unshift(b);else queue.push(b);
  while(queue.length>3){const i=queue.findIndex(x=>x.kind==='updated');queue.splice(i>=0?i:0,1);}
  pump();
 }
 const T=Q.QUEST_TEXT;
 function announce(events,s){
  const done=events.filter(e=>e.kind==='completed'),ready=events.filter(e=>e.kind==='ready'),acc=events.filter(e=>e.kind==='accepted'),upd=events.filter(e=>e.kind==='updated'),chap=events.filter(e=>e.kind==='chapter');
  for(const e of done)banner({...T.banner(e,s),kind:'completed',priority:true,ms:5200});
  for(const e of chap)banner({...T.banner.call(T,e,s),kind:'chapter',ms:5200});
  for(const e of ready)banner({...T.banner(e,s),kind:'ready',ms:4600});
  if(acc.length>1)banner({kicker:T.kicker.accepted,title:`${acc.length} new quests`,line:acc.map(e=>e.quest.title).join(' · '),kind:'accepted'});
  else if(acc.length)banner({...T.banner(acc[0],s),kind:'accepted'});
  for(const e of upd.slice(0,2))banner({...T.banner(e,s),kind:'updated',ms:3400});
  // A newly accepted quest takes the ribbon if nothing else holds it.
  if(acc.length&&!Q.trackedQuest(s)){const first=acc.find(e=>Q.setTracked(s,e.id));if(first){save();}}
 }

 // ------------------------------------------------------------------ the tracked-quest ribbon
 const rib=document.createElement('button');rib.id='quest-track';rib.type='button';rib.className='qt-ribbon';rib.hidden=true;
 rib.innerHTML='<span class="qt-top"><i class="qt-gem" aria-hidden="true"></i><span class="qt-kicker"></span><span class="qt-state"></span></span><strong class="qt-title"></strong><span class="qt-step"></span><span class="jr-bar" aria-hidden="true"><i></i></span>';
 game.append(rib);let ribKey='';
 // Blur first: the world's key handler ignores WASD/E while a button has focus, and closing the log returns focus to where it was.
 rib.onclick=()=>{const id=Q.trackedQuest(getState());rib.blur();if(id)showLog(id);};
 function paintRibbon(){
  const s=getState(),id=s?Q.trackedQuest(s):null;
  if(!id){if(!rib.hidden){rib.hidden=true;game.dataset.qtrack='off';wrap.dataset.qtrack='off';}ribKey='';return;}
  const f=Q.focus(s),p=f?.progress;if(!p){rib.hidden=true;return;}
  const st=shown(p),ch=p.chapter,kicker=ch&&p.meta.category==='story'?`Chapter ${ch.n}`:p.meta.categoryLabel;
  const title=ch&&p.meta.category==='story'?(ch.quest==='keepers'?ch.title:p.meta.title):p.meta.title,line=p.line;
  const key=[id,kicker,title,line,st,Math.round(p.fraction*100)].join('|');
  if(key===ribKey&&!rib.hidden)return;ribKey=key;
  rib.hidden=false;game.dataset.qtrack='on';wrap.dataset.qtrack='on';rib.dataset.status=st;rib.dataset.questId=id;
  rib.querySelector('.qt-kicker').textContent=kicker;rib.querySelector('.qt-state').textContent=st==='ready'?'Ready to report':'';
  rib.querySelector('.qt-title').textContent=title;rib.querySelector('.qt-step').textContent=line;rib.querySelector('.jr-bar i').style.width=Math.round(p.fraction*100)+'%';
  rib.setAttribute('aria-label',`Tracked quest: ${title}. ${line}. Open the quest log.`);
 }

 // ------------------------------------------------------------------ change detection, driven from the game's HUD refresh
 let base=null,baseState=null,last=0;
 function update(force=false){
  const s=getState(),now=performance.now();
  if(!s||game.dataset.arriving==='true'||!s.journey?.created){base=null;baseState=null;paintRibbon();return;}
  if(!force&&base&&now-last<350)return;last=now;
  const snap=Q.snapshot(s);
  if(!base||baseState!==s){base=snap;baseState=s;paintRibbon();return;}
  const ev=Q.diff(base,snap);base=snap;
  if(ev.length)announce(ev,s);
  if(s.trackedQuest&&!Q.trackedQuest(s))delete s.trackedQuest;
  paintRibbon();
 }

 // ------------------------------------------------------------------ Quest Log
 function entries(s){
  const out=[];
  for(const r of Q.chapterRows(s)){
   const locked=r.status==='locked';
   out.push({key:'ch:'+r.n,group:'story',kind:'chapter',row:r,p:r.progress,status:r.status,title:locked?`Chapter ${r.n}`:r.title,sub:locked?'Not yet written':`Chapter ${r.n}`,level:r.chapter.level,region:locked?'':r.progress.giver?.region||'',trackId:r.trackId,current:r.state==='current'});
  }
  const done=Q.listQuests(s,'done');
  for(const tab of ['side','commission'])for(const p of [...Q.listQuests(s,tab),...done.filter(d=>Q.tabOf(d.quest)===tab)])
   out.push({key:'q:'+p.id,group:tab,kind:'quest',p,status:shown(p),title:p.meta.title,level:p.meta.level,region:p.meta.region,trackId:p.id});
  return out;
 }
 function keyFor(s,id){
  const q=Q.questById(id);if(!q)return null;
  if(Q.metaOf(q).category==='story'){const c=id==='keepers'?Q.currentChapter(s):Q.CHAPTERS.find(c=>c.quest===id);return 'ch:'+(c?.n||7);}
  return 'q:'+id;
 }
 function rowHTML(s,e){
  const tracked=e.trackId&&e.status!=='locked'&&e.status!=='complete'&&isTracked(s,e.trackId)&&(e.kind==='quest'||e.current||e.trackId!=='keepers');
  return `<li><button type="button" class="jr-btn ql-row${sel===e.key?' is-selected':''}" data-action="quest-select" data-id="${esc(e.key)}" data-status="${e.status}"${sel===e.key?' aria-current="true"':''}${tracked?' data-tracked="true"':''}>
   <span class="ql-main"><span class="ql-name">${esc(e.title)}</span><span class="ql-sub">${e.status==='locked'?'':chip(e.status)}${e.status==='locked'?`<span class="ql-region">${esc(e.sub)}</span>`:`<span class="jr-num ql-lv">Lv ${e.level}</span>`}${e.region&&e.kind==='quest'?`<span class="ql-region">${esc(e.region)}</span>`:''}${e.kind==='chapter'&&e.status!=='locked'?`<span class="ql-region">${esc(e.sub)}</span>`:''}</span></span>${tracked?'<span class="ql-flag" title="Tracked">Tracked</span>':''}</button></li>`;
 }
 function listHTML(s,all){
  const sum=Q.storyCount(s),empty=Q.QUEST_TEXT.empty;
  return GROUPS.map(([g,name])=>{
   const rows=all.filter(e=>e.group===g),count=g==='story'?`${sum.done}/${sum.total}`:`${rows.filter(e=>e.status==='complete').length}/${rows.filter(e=>e.status!=='available'||e.key==='q:castle').length}`;
   const ordered=g==='story'?rows:[...rows.filter(e=>e.status!=='complete'),...rows.filter(e=>e.status==='complete')];
   return `<section class="ql-group" data-group="${g}" aria-labelledby="qg-${g}"><h3 class="ql-gh" id="qg-${g}"><span>${name}</span><span class="jr-num">${count}</span></h3>${g==='story'?pips(s):''}${rows.length?`<ul class="ql-rows">${ordered.map(e=>rowHTML(s,e)).join('')}</ul>`:`<p class="ql-empty">${esc(empty[g])}</p>`}</section>`;
  }).join('');
 }
 function giverBlock(s,g,size,extra=''){
  if(!g)return extra;
  const a=g.kind==='npc'||g.id&&g.id!=='gate'?actorOf(s,g.id):null,cvs=a?`<canvas class="qx-portrait jr-sprite" data-npc="${esc(g.id)}" data-scale="${size==='s'?1:2}" width="${size==='s'?48:80}" height="${size==='s'?56:96}" aria-hidden="true"></canvas>`:`<span class="qx-gate" aria-hidden="true"></span>`;
  return `<div class="qx-giver">${cvs}<div class="qx-giver-main"><span class="qx-label">${g.kind==='place'?'Where':'Quest giver'}</span><b>${esc(g.name)}</b><small>${esc(cap(g.role==='gate'?'The place where it ends':g.role))}${g.town?' · '+esc(g.town):''}</small>${g.alive===false?`<small class="qx-warn">${esc(T.toast.fallen(g.name))}</small>`:''}${extra}</div></div>`;
 }
 function stepsHTML(p){
  const first=p.steps.findIndex(x=>!x.done);
  return `<ol class="qd-steps">${p.steps.map((st,i)=>{
   const counted=st.need>0,frac=st.done?1:counted?st.count/st.need:0;
   return `<li class="qd-step" data-done="${st.done}"${i===first?' data-current="true"':''}${st.blocked?' data-blocked="true"':''}><span class="qd-mark" aria-hidden="true"></span><div class="qd-step-main"><span class="qd-step-label">${esc(st.label)}<span class="sr-only">${st.done?' (done)':i===first?' (current)':''}</span></span>${st.parts?`<span class="qd-parts">${st.parts.map(x=>`<span class="jr-num">${esc(x.noun)} ${x.count}/${x.need}</span>`).join('')}</span>`:counted&&st.need>1||counted&&st.noun?`<span class="qd-count jr-num">${esc(st.noun||'')} ${st.count}/${st.need}</span>`:''}${counted&&st.need>1?bar(frac,'jr-bar--mp'):''}${st.hint&&!st.done?`<small class="qd-hint">${esc(st.hint)}</small>`:''}${st.where&&!st.done?`<small class="qd-where">${esc(st.where)}</small>`:''}</div></li>`;}).join('')}</ol>`;
 }
 // One storybook page. `o`: {kicker,title,sub,hook,desc,status,m,lv,p,trackId,chapterNo}
 function pageHTML(s,o){
  const {p,m}=o,live=o.status==='active'||o.status==='ready',tracked=o.trackId&&isTracked(s,o.trackId),dir=live?Q.direction(s,o.trackId||p.id):null,g=p.giver;
  const canGiver=g&&g.kind==='npc'&&p.quest?.giver&&g.alive!==false;
  return `<article class="ql-page jr-panel" data-quest-id="${esc(p.id)}" data-status="${o.status}" tabindex="-1" aria-label="${esc(o.title)}">
   <button type="button" class="jr-btn qd-back" data-action="quest-back">‹ All quests</button>
   <header class="qd-head"><div class="qd-kick"><span class="jr-eyebrow">${esc(o.kicker)}</span>${o.chapter?catChip(m):''}${chip(o.status)}</div><h2 class="qd-title">${esc(o.title)}</h2>${o.sub?`<p class="qd-sub">${esc(o.sub)}</p>`:''}${o.hook?`<p class="qd-hook">${esc(o.hook)}</p>`:''}</header>
   ${o.pips||''}<div class="qd-rule" aria-hidden="true"></div>
   <div class="qd-meta">${giverBlock(s,g,'l',`<dl class="qd-facts"><div><dt>Recommended</dt><dd>${level(s,o.lv)}</dd></div><div><dt>Region</dt><dd>${esc(g?.region||m.region)}</dd></div></dl>`)}</div>
   ${o.desc?`<p class="qd-desc">${esc(o.desc)}</p>`:''}
   <h3 class="jr-title qd-h">Objectives</h3>
   <div class="qd-prog">${bar(p.fraction)}<span class="jr-num">${p.done} / ${p.total}</span></div>
   ${stepsHTML(p)}
   ${dir?`<p class="qd-dir"><span class="qd-needle" style="--deg:${dir.deg??0}deg"${dir.deg===null?' data-still="true"':''} aria-hidden="true"></span><span>${esc(dir.text)}</span></p>`:''}
   ${o.showReward!==false?`<h3 class="jr-title qd-h">Reward</h3>${reward(m)}`:''}
   <div class="qd-actions">${live?btn('Track quest','quest-track',o.trackId,{primary:true,pressed:!!tracked})+btn('Mark on map','quest-map',o.trackId,{disabled:!dir})+btn('Open map','quest-atlas'):''}${live&&canGiver?btn('Find '+g.name,'giver',p.id):''}${g?.walk&&o.status!=='complete'?btn('Walk to the castle','destination',g.walk):''}${o.status==='available'?`<span class="qd-note">Take this quest to track it.</span>`:''}</div>
  </article>`;
 }
 function detailHTML(s,e){
  if(!e)return `<article class="ql-page jr-panel" tabindex="-1"><button type="button" class="jr-btn qd-back" data-action="quest-back">‹ All quests</button><p class="ql-empty">${esc(T.empty.focus)}</p></article>`;
  if(e.kind==='chapter'){
   const r=e.row,c=r.chapter;
   if(r.status==='locked')return `<article class="ql-page jr-panel qd-blank" data-status="locked" tabindex="-1" aria-label="Chapter ${c.n}"><button type="button" class="jr-btn qd-back" data-action="quest-back">‹ All quests</button><header class="qd-head"><div class="qd-kick"><span class="jr-eyebrow">Chapter ${c.n} of ${Q.CHAPTERS.length}</span>${chip('locked')}</div><h2 class="qd-title">A page not yet written</h2></header>${pips(s,true)}<div class="qd-rule" aria-hidden="true"></div><p class="qd-desc">${esc(T.empty.story)} Finish the chapters before it and this one will fill itself in.</p></article>`;
   const p=r.progress,done=r.status==='complete',own=p.id!=='keepers';
   const m={...p.meta,reward:own||c.n===7?p.meta.reward:{coins:0,xp:0,items:[]}};
   return pageHTML(s,{chapter:true,kicker:`Chapter ${c.n} of ${Q.CHAPTERS.length}`,title:`Chapter ${c.n}: ${c.title}`,sub:own?`Quest: ${p.meta.title}`:'',hook:done?c.recap:c.blurb,desc:own?p.summary:'',status:r.status,m,lv:c.level,p,trackId:r.trackId,pips:pips(s,true),showReward:own||c.n===7});
  }
  const p=e.p,m=p.meta;
  return pageHTML(s,{kicker:m.categoryLabel,title:m.title,hook:m.hook,desc:p.summary,status:e.status,m,lv:m.level,p,trackId:p.id});
 }
 function shell(s){
  const all=entries(s),sum=Q.summary(s);
  const e=all.find(x=>x.key===sel);
  return `<div class="qx ql" data-view="${view}" role="region" aria-label="Quest log">
   <div class="ql-strip"><span><b class="jr-num">${sum.done}</b>/${sum.total} stories told</span><span>Towns <b class="jr-num">${sum.towns}/${sum.townsTotal}</b></span><span>Deep sites <b class="jr-num">${sum.sites}/${sum.sitesTotal}</b></span><span>Raids <b class="jr-num">${sum.raids}</b></span><span class="ql-you">You are <b class="jr-num">Lv ${s.player.level}</b></span></div>
   <div class="ql-cols"><nav class="ql-list" aria-label="Quests">${listHTML(s,all)}<details class="ql-recent"><summary>Recent events</summary>${s.log.toReversed().slice(0,14).map(x=>`<p>${esc(x.text)}</p>`).join('')||'<p>'+esc(T.empty.log)+'</p>'}</details></nav><div class="ql-detail">${detailHTML(s,e)}</div></div></div>`;
 }
 function ensureSel(s,want){
  const all=entries(s);
  if(want){const k=all.some(e=>e.key===want)?want:keyFor(s,want);if(k&&all.some(e=>e.key===k)){sel=k;return;}}
  if(sel&&all.some(e=>e.key===sel))return;
  const f=Q.focus(s);sel=(f&&keyFor(s,f.id))||'ch:1';
  if(!all.some(e=>e.key===sel))sel=all[0]?.key||null;
 }
 // Re-render in place (no panel() call, so focus and scroll stay where the player left them).
 function render(focusId){
  const s=getState(),root=body.querySelector('.ql');if(!root){return;}
  const keep=root.querySelector('.ql-list')?.scrollTop||0,detailTop=root.querySelector('.ql-detail')?.scrollTop||0,had=document.activeElement?.dataset?.id,hadAction=document.activeElement?.dataset?.action;
  root.outerHTML=shell(s);
  const now=body.querySelector('.ql');now.querySelector('.ql-list').scrollTop=keep;now.querySelector('.ql-detail').scrollTop=detailTop;
  portraits(now);
  const want=focusId??had,target=want&&[...now.querySelectorAll('button[data-id]')].find(b=>b.dataset.id===want&&(!hadAction||b.dataset.action===hadAction));
  target?.focus({preventScroll:true});
 }
 function showLog(want=null){
  const s=getState();ensureSel(s,want);surface='log';
  view=want?'detail':'list';
  panel('journal','Quest Log',shell(s),'quest-dialog');
  portraits();
 }
 // ------------------------------------------------------------------ conversation cards
 function cardHTML(s,q,{board=false}={}){
  const p=Q.progress(s,q),m=p.meta,st=shown(p),g=p.giver,fin=q.kind==='choice';
  let acts='';
  if(st==='complete')acts='';
  else if(board){
   if(Q.boardAcceptable(s,q))acts+=btn('Accept','quest-accept',q.id,{primary:true});
   if(st==='active')acts+=btn('Track quest','quest-track',q.id,{primary:true,pressed:isTracked(s,q.id)});
   if(g?.kind==='npc'&&g.alive!==false)acts+=btn(st==='ready'?'Report to '+g.name:'Find '+g.name,'giver',q.id,{primary:st==='ready'});
   if(st==='active'||st==='ready')acts+=btn('Quest log','quest-open',q.id);
  }else if(engineReady(s,q))acts=fin?btn('Expose the captain','finish',q.id+':expose',{primary:true})+btn('Secure restitution','finish',q.id+':restitution',{primary:true}):btn('Turn in','finish',q.id,{primary:true});
  else{
   acts=btn(p.accepted?'Review quest':'Accept','accept',q.id,{primary:!p.accepted});
   acts+=p.accepted?btn('Track quest','quest-track',q.id,{pressed:isTracked(s,q.id)}):btn('Not now','quest-decline',q.id);
  }
  const obj=st==='complete'||board&&st==='available'?'':objective(s,p);
  return `<article class="qc jr-panel jr-panel--flat" data-quest-id="${esc(q.id)}" data-status="${st}">
   ${board&&g?.kind==='npc'?`<canvas class="qx-portrait qc-portrait jr-sprite" data-npc="${esc(g.id)}" data-scale="1" width="48" height="56" aria-hidden="true"></canvas>`:''}
   <div class="qc-main"><div class="qc-top">${catChip(m)}${chip(st)}</div><h3 class="qc-title">${esc(m.title)}</h3>
   ${board||st==='complete'?`<p class="qc-hook">${esc(m.hook)}</p>`:`<p class="qc-desc">${esc(q.desc)}</p>`}
   <dl class="qc-facts"><div><dt>Recommended</dt><dd>${level(s,m.level)}</dd></div><div><dt>Region</dt><dd>${esc(board?m.town+', '+m.region:m.region)}</dd></div>${board&&g?`<div><dt>Giver</dt><dd>${esc(g.name)}</dd></div>`:''}</dl>
   ${obj?`<p class="qc-obj"><span class="qx-label">Objective</span> ${esc(obj)}</p>`:''}
   ${st==='complete'?'':`<div class="qc-foot">${reward(m)}${acts?`<div class="qc-actions">${acts}</div>`:''}</div>`}</div></article>`;
 }
 function offers(npc){
  const s=getState(),own=quests.filter(q=>q.giver===npc.id);
  surface='offer';
  if(!own.length)return {html:'',open:false};
  const open=own.some(q=>s.quest[q.id]!=='complete');
  if(!open)return {html:'',open:false};
  return {html:`<section class="dialog-section qx qo" aria-label="Commissions and stories"><h3 class="jr-title">Commissions &amp; stories</h3>${own.map(q=>cardHTML(s,q)).join('')}</section>`,open};
 }
 // ------------------------------------------------------------------ the noticeboard
 function boardHTML(s,town){
  const ids=NPCS.filter(n=>n.town===town.id).map(n=>n.id),work=quests.filter(q=>ids.includes(q.giver)&&q.id!=='keepers').map(q=>Q.progress(s,q));
  const rank={ready:0,available:1,active:2,complete:3},by=(a,b)=>rank[shown(a)]-rank[shown(b)]||a.meta.level-b.meta.level||b.meta.reward.coins-a.meta.reward.coins||a.meta.title.localeCompare(b.meta.title);
  work.sort(by);
  const sec=(title,list,cls='')=>list.length?`<section class="qb-sec ${cls}"><h3 class="jr-title">${title} <span class="jr-num">${list.length}</span></h3>${list.map(p=>cardHTML(s,p.quest,{board:true})).join('')}</section>`:'';
  const ready=work.filter(p=>shown(p)==='ready'),fresh=work.filter(p=>shown(p)==='available'),act=work.filter(p=>shown(p)==='active'),done=work.filter(p=>shown(p)==='complete');
  const open=work.length-done.length;
  return `<div class="qx qb" data-town="${esc(town.id)}" role="region" aria-label="${esc(town.name)} noticeboard">
   <header class="qb-head jr-panel jr-panel--flat"><span class="jr-eyebrow">${esc(town.name)} noticeboard</span><p class="qb-motto">“${esc(town.motto)}”</p><p class="qb-meta"><span>${esc(town.region)}</span><span><b class="jr-num">${open}</b> ${open===1?'notice':'notices'} pinned</span><span>You are <b class="jr-num">Lv ${s.player.level}</b></span></p></header>
   ${work.length?'':`<p class="ql-empty">${esc(T.empty.board)}</p>`}
   ${sec('Ready to report',ready,'qb-ready')}${sec('New notices',fresh)}${sec('In your log',act)}
   ${done.length?`<details class="qb-done"><summary>Finished <span class="jr-num">${done.length}</span></summary>${done.map(p=>cardHTML(s,p.quest,{board:true})).join('')}</details>`:''}
   <section class="qb-watch jr-panel jr-panel--flat"><h3 class="jr-title">The town watch</h3><p>Volunteer at the warning bell for a defense encounter. An unpredictable hunting party can break into homes and shops. Guards will help; fallen residents return after five minutes.</p>${btn('Volunteer for the watch','raid-confirm',town.id)}</section></div>`;
 }
 function showBoard(townId){
  const s=getState(),town=TOWNS.find(t=>t.id===townId);if(!town)return;
  boardTown=townId;surface='board';
  panel('town noticeboard',town.name,boardHTML(s,town),'board-dialog');roomy();portraits();
 }
 function renderBoard(){
  const s=getState(),town=TOWNS.find(t=>t.id===boardTown),root=body.querySelector('.qb');if(!town||!root)return;
  const top=body.scrollTop,panelTop=$('panel').scrollTop,had=document.activeElement?.dataset;
  root.outerHTML=boardHTML(s,town);portraits();body.scrollTop=top;$('panel').scrollTop=panelTop;
  const t=had?.id&&[...body.querySelectorAll('button[data-id]')].find(b=>b.dataset.id===had.id&&b.dataset.action===had.action);t?.focus({preventScroll:true});
 }
 // Refresh whatever quest surface is on screen after a tracking/accept change.
 function refresh(){
  if(!$('panel').open)return;
  if(surface==='log')render();else if(surface==='board')renderBoard();
  else for(const b of body.querySelectorAll('[data-action=quest-track]'))b.setAttribute('aria-pressed',String(isTracked(getState(),b.dataset.id)));
 }

 // ------------------------------------------------------------------ actions
 function handle(a,id){
  if(!a.startsWith('quest-'))return false;
  const s=getState();
  switch(a){
   case 'quest-select':{sel=id;view='detail';render(id);const narrow=(body.querySelector('.ql')?.clientWidth||999)<560;if(narrow)body.querySelector('.ql-page')?.focus({preventScroll:true});break;}
   case 'quest-back':{view='list';render();const row=[...body.querySelectorAll('.ql-row')].find(b=>b.dataset.id===sel);row?.focus();break;}
   case 'quest-track':{
    const q=Q.questById(id);if(!q)break;
    if(isTracked(s,id)){Q.setTracked(s,null);banner({kicker:'Tracking stopped',title:q.title,line:T.toast.untracked(),kind:'info',ms:2800});}
    else if(Q.setTracked(s,id)){banner({kicker:T.kicker.tracking,title:q.title,line:Q.objectiveText(s).replace(q.title+' · ',''),kind:'info',ms:2800});}
    save();update(true);refresh();break;
   }
   case 'quest-map':{
    const q=Q.questById(id),d=q&&Q.direction(s,id);
    if(!d?.point){banner({kicker:'No marker',title:q?.title||'',line:q?T.toast.noTarget(q):'',kind:'info',ms:3000});break;}
    setWaypoint(d.point);banner({kicker:'Marked on your compass',title:d.name,line:d.text,kind:'info',ms:3200});refresh();break;
   }
   case 'quest-atlas':openMap?.();break;
   case 'quest-open':showLog(id);break;
   case 'quest-decline':banner({kicker:'Not now',title:Q.questById(id)?.title||'',line:T.toast.declined(),kind:'info',ms:3000});break;
   case 'quest-accept':{
    const q=Q.questById(id);
    if(q&&Q.boardAcceptable(s,q)){s.quest[q.id]??='active';save();update(true);renderBoard();hud?.();}
    break;
   }
   default:return false;
  }
  return true;
 }
 // Arrow keys move between rows of the log; T toggles tracking for the quest on the page.
 body.addEventListener('keydown',e=>{
  if(surface!=='log'||!$('panel').open)return;
  const row=e.target.closest?.('.ql-row');
  if(row&&(e.key==='ArrowDown'||e.key==='ArrowUp')){
   const rows=[...body.querySelectorAll('.ql-row')],i=rows.indexOf(row),n=rows[(i+(e.key==='ArrowDown'?1:rows.length-1))%rows.length];
   e.preventDefault();n.focus();
  }else if((e.key==='t'||e.key==='T')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target.closest?.('input,select,textarea')){
   const b=body.querySelector('.ql-page [data-action=quest-track]:not(:disabled)');if(b){e.preventDefault();b.click();}
  }
 });
 $('panel').addEventListener('close',()=>{surface='';});
 return {showLog,showBoard,offers,roomy,handle,update,banner,paintRibbon,get selected(){return sel;},get surface(){return surface;}};
}
