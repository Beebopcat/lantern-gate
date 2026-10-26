import {TOWNS,SITES,BUILDINGS,quests} from './world.js';
import {progressionSummary,damageBonus} from './progression.js';
export const RETRO_TABS=Object.freeze([
  ['inventory','Inventory'],['quests','Quest Log'],['achievements','Achievements'],
  ['abilities','Abilities'],['skills','Skill Tree'],['stats','Stats'],
  ['character','Character'],['map','Map'],['menu','Menu'],['conditions','Time / Weather / Season']
]);
// Evidence is scoped to the currently loaded save. Never create rewards, dates,
// counters or inferred historic events merely because this view is opened.
export function achievements(s){
  const rows=[
    ['commission','First commission','Complete a commission.',quests.some(q=>q.id!=='keepers'&&s.quest[q.id]==='complete')],
    ['road','Beyond Hearthwick','Discover another settlement.',TOWNS.some(t=>t.id!=='hearth'&&s.discovered.includes(t.id))],
    ['depths','Into the depths','Reach the deep floor of a site.',SITES.some(t=>s.sites.includes(t.id))],
    ['defense','A town saved','A completed town defense is recorded.',Number.isInteger(s.raidsWon)&&s.raidsWon>0],
    ['home','A home of your own','Own a home.',BUILDINGS.some(b=>b.purchasable&&s.life?.homes?.includes(b.id))],
    ['level','Growing stronger','Reach level 2.',s.player.level>=2],
    ['gate','The Gate opened','Restore the Gate in this expanded journey.',s.won===true],
    ['names','Names returned','Complete The Names Beneath the Crown.',s.journey?.castleQuest==='complete']
  ];
  return rows.map(([id,name,detail,earned])=>({id,name,detail,earned:!!earned}));
}
export function combatStats(s){
  const p=s.player,progress=progressionSummary(s);
  return {level:p.level,hp:p.hp,maxHp:p.maxHp,focus:p.mp,maxFocus:p.maxMp,armor:p.armor,
    hunger:p.hunger,gold:p.gold,weapon:p.weapon==='bow'?'Yew bow':s.inv.sword?'Tempered blade':'Traveler’s blade',
    strike:(p.weapon==='bow'?12:s.inv.sword?17:11)+p.level*2+damageBonus(s,false),
    lantern:25+p.level*2+damageBonus(s,true),range:p.weapon==='bow'?7:1.8,
    cooldownPercent:Math.round((1-progress.cooldownScale)*100),progress};
}
