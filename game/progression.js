// Shared XP rules. Every activity goes through this module so paid shifts and
// exploration can level a character just as combat and quests do.
export const MAX_LEVEL=30;
export const TALENTS={
  vigor:{name:'Unbroken heart',detail:'Gain 8 maximum health per rank.',max:12},
  focus:{name:'Candle keeper',detail:'Gain 4 maximum mana and faster mana recovery per rank.',max:12},
  mastery:{name:'Practiced hand',detail:'Gain 1 strike damage and 2 spell damage per rank.',max:12}
};
const record=o=>o&&typeof o==='object'&&!Array.isArray(o);
const integer=(v,max=1e9)=>Number.isInteger(v)&&v>=0&&v<=max;
export const threshold=level=>80+40*(level-1)+12*(level-1)*(level-1);
export function upgradeProgression(s){
  const p=s.player;
  if(!s.progression)s.progression={version:1,points:Math.max(0,Math.min(MAX_LEVEL,p.level||1)-1),talents:{vigor:0,focus:0,mastery:0},earned:0,receipts:[],lastReward:null};
  s.progression.craftSerial??=0;
  return s.progression;
}
function rewardFor(source,context){
  if(Number.isFinite(context.amount))return Math.max(0,Math.min(500,Math.floor(context.amount)));
  if(source==='combat')return context.enemy?.warden?100:Math.min(36,8+Math.floor((context.enemy?.maxHp||40)/10));
  if(source==='quest')return Math.min(120,35+Math.floor((context.reward||20)*.65));
  return {work:16,craft:8,discovery:25,site:35,raid:50}[source]||0;
}
export function awardExperience(s,source,context={}){
  const progress=upgradeProgression(s),p=s.player,amount=rewardFor(source,context),messages=[];
  if(!amount||p.deadUntil)return messages;
  const once=context.once??['quest','discovery','site','raid','work'].includes(source);
  const receipt=context.id?`${source}:${context.id}`:null;
  if(once&&(!receipt||progress.receipts.includes(receipt)))return messages;
  if(once){progress.receipts.push(receipt);progress.receipts=progress.receipts.slice(-1500);}
  progress.earned=Math.min(1e9,progress.earned+amount);
  progress.lastReward={source,amount,label:String(context.label||source).slice(0,100)};
  if(p.level>=MAX_LEVEL){p.xp=0;return messages;}
  p.xp+=amount;
  while(p.level<MAX_LEVEL&&p.xp>=threshold(p.level)){
    p.xp-=threshold(p.level);p.level++;progress.points++;
    // Growth restores only the new capacity, not all health. It cannot turn a
    // nearly fatal encounter into a free full heal.
    p.maxHp+=10;p.maxMp+=4;p.hp=Math.min(p.maxHp,p.hp+10);p.mp=Math.min(p.maxMp,p.mp+4);
    messages.push(`Level ${p.level}. Your health and mana grow. Choose a talent in the Skill Tree.`);
    if([3,6,10,15,20,25,30].includes(p.level))messages.push('Your calling grows more practiced. Class abilities recover sooner.');
  }
  if(p.level===MAX_LEVEL)p.xp=0;
  return messages;
}
// Call only after one batch of resources becomes a real crafted result. The
// persisted serial identifies that production across saves; retries of the
// same receipt never award it again. A second consumed batch is a new craft.
export function awardCraftExperience(s,label){
  const progress=upgradeProgression(s);if(progress.craftSerial>=1e9)return [];
  const id='production:'+ ++progress.craftSerial;
  return awardExperience(s,'craft',{id,label,once:true});
}
export function spendTalent(s,id){
  const progress=upgradeProgression(s),talent=TALENTS[id],p=s.player;
  if(!talent)return 'Choose a known talent.';
  if(!progress.points)return 'Earn another level to learn a talent.';
  if(progress.talents[id]>=talent.max)return 'You have mastered this talent.';
  progress.points--;progress.talents[id]++;
  if(id==='vigor'){p.maxHp+=8;p.hp=Math.min(p.maxHp,p.hp+8);}
  if(id==='focus'){p.maxMp+=4;p.mp=Math.min(p.maxMp,p.mp+4);}
  s.revision=(s.revision||0)+1;
  return `${talent.name}, rank ${progress.talents[id]}. ${talent.detail}`;
}
export const damageBonus=(s,spell=false)=>(s.progression?.talents.mastery||0)*(spell?2:1);
export const focusRecoveryBonus=s=>(s.progression?.talents.focus||0)*.025;
export function classCooldownScale(s){return 1-Math.min(.21,[3,6,10,15,20,25,30].filter(n=>s.player.level>=n).length*.03);}
export function progressionSummary(s){
  const progress=upgradeProgression(s),p=s.player;
  return {level:p.level,xp:p.xp,next:p.level>=MAX_LEVEL?0:threshold(p.level),percent:p.level>=MAX_LEVEL?100:Math.min(100,Math.floor(p.xp/threshold(p.level)*100)),points:progress.points,talents:{...progress.talents},earned:progress.earned,rank:[3,6,10,15,20,25,30].filter(n=>p.level>=n).length,cooldownScale:classCooldownScale(s)};
}
export function validProgression(s){
  if(s.progression===undefined)return true;const p=s.progression;
  return record(p)&&p.version===1&&integer(p.points,MAX_LEVEL)&&integer(p.earned)&&(p.craftSerial===undefined||integer(p.craftSerial))&&record(p.talents)&&Object.keys(TALENTS).every(k=>integer(p.talents[k],TALENTS[k].max))&&p.points+Object.values(p.talents).reduce((a,b)=>a+b,0)<=s.player.level-1&&Array.isArray(p.receipts)&&p.receipts.length<=1500&&p.receipts.every(k=>typeof k==='string'&&k.length<=220)&&new Set(p.receipts).size===p.receipts.length&&(!p.lastReward||(record(p.lastReward)&&integer(p.lastReward.amount,500)&&typeof p.lastReward.source==='string'&&typeof p.lastReward.label==='string'&&p.lastReward.label.length<=100));
}
