// Shared seeds for the quest browser test and screenshots. All mutations run inside the page origin before the game loads.
// A mid-journey state: Chapter 3 current, a ready side story (bell), commissions in several states, three towns found.
export const base=(extra='')=>`s.flags.metMara=true;s.quest.medicine='complete';s.player.gold=120;s.player.level=3;s.progression={version:1,points:2,talents:{vigor:0,focus:0,mastery:0},earned:200,receipts:['quest:medicine'],lastReward:null,craftSerial:0};s.quest.millwright='active';s.quest.timber='active';s.inv.wood=2;s.quest.iron='active';s.inv.ore=1;s.quest.salves='complete';s.discovered=['hearth','willow','copper'];s.flags.medallion=true;s.inv.medallion=1;s.enemies=[];${extra}`;
export const beside=id=>`{const m=s.actors.find(a=>a.id==='${id}');s.player.x=m.x-1.2;s.player.y=m.y;s.player.map=m.map;}`;
export const atBoard=`s.player.x=106.8;s.player.y=296.5;s.player.map='overworld';`;
