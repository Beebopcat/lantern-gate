// Authored wardrobe pieces use the existing articulated character rig and shared geometry.
// A resident keeps one outfit for an entire day; loading a save does not reroll it.
const look=(id,name,coat,trim,pants,style,accessories)=>Object.freeze({id,name,coat,trim,pants,style,accessories:Object.freeze(accessories)});
export const DAILY_OUTFITS=Object.freeze([
 look('copper-waistcoat','Copper waistcoat','#735045','#d5b28a','#403936','vest',['cravat','pocketwatch']),
 look('river-worker','Riverwork linen','#617c80','#cfc8ab','#435158','tunic',['rolledcuffs','pouch']),
 look('orchard-smock','Orchard smock','#758054','#d4b777','#514d3e','smock',['bonnet','wovenbelt']),
 look('ink-and-brass','Ink and brass','#433d53','#c2ad78','#353440','longcoat',['spectacles','brooch']),
 look('russet-cardigan','Russet cardigan','#985b43','#d8bc94','#4a3c32','vest',['scarf','buttons']),
 look('salt-cloak','Salt-weather cloak','#53636e','#a6b5bb','#3b4951','cloak',['hood','satchel']),
 look('sage-layers','Sage and linen','#607567','#d7d0ad','#3c5149','shawl',['headscarf','pouch']),
 look('honey-tunic','Honey wool tunic','#af9056','#eee0b7','#544e3a','tunic',['wovenbelt','necklace']),
 look('midnight-coat','Midnight frock coat','#383e52','#bec3cf','#333342','longcoat',['tophat','pocketwatch']),
 look('plum-workdress','Plum workdress','#705065','#d9b8c2','#473e4b','gown',['bonnet','brooch']),
 look('forest-jerkin','Forest jerkin','#465d48','#bcb780','#3b463c','vest',['feathercap','bracers']),
 look('chalk-apron','Chalk linen apron','#777363','#ede5cd','#474841','apron',['rolledcuffs','buttons']),
 look('indigo-wrap','Indigo woven wrap','#535a85','#c2b9d9','#3b4059','shawl',['scarf','necklace']),
 look('burgundy-tails','Burgundy coat tails','#76424e','#d1ae81','#413339','longcoat',['cravat','satchel']),
 look('moss-pinafore','Moss pinafore','#627552','#d7c18f','#42543f','apron',['headscarf','wovenbelt']),
 look('silver-collar','Silver-collared wool','#666b72','#d1d5cf','#414449','tunic',['brooch','gloves']),
 look('umber-overcoat','Umber overcoat','#725543','#b5a184','#44372e','longcoat',['flatcap','scarf']),
 look('blue-velvet','Blue velvet vest','#3e647b','#dccb94','#384954','vest',['pocketwatch','necklace']),
 look('amber-shawl','Amber stitched shawl','#a17142','#efcf89','#5a4433','shawl',['bonnet','buttons']),
 look('pearl-bodice','Pearl linen bodice','#928b78','#efe9d5','#595447','gown',['headscarf','brooch']),
 look('iron-leather','Iron and leather','#65564b','#b7aca0','#42403e','vest',['bracers','satchel']),
 look('reed-smock','Reed-green smock','#717e68','#d2d3aa','#484f3f','smock',['flatcap','pouch']),
 look('rose-waistcoat','Dust-rose waistcoat','#9a6b70','#e3c4b2','#52424a','vest',['cravat','buttons']),
 look('storm-robe','Storm-grey robe','#545c65','#a9b5c3','#3b414b','gown',['hood','necklace']),
 look('ochre-mantle','Ochre travelling mantle','#9d8148','#ead2a4','#5a4d35','cloak',['feathercap','satchel']),
 look('teal-cuffs','Teal tailored tunic','#46726d','#d2c393','#35504e','tunic',['gloves','brooch']),
 look('mulberry-apron','Mulberry market apron','#785568','#e0c3cf','#4b3e4d','apron',['bonnet','pouch']),
 look('pine-doublet','Pine embroidered doublet','#4b665e','#b5bf98','#354b45','vest',['wovenbelt','bracers']),
 look('ivory-knit','Ivory knit and shawl','#b6ad94','#e8dec5','#625b4b','shawl',['scarf','pocketwatch']),
 look('wine-traveller','Wine travelling coat','#6e3e4b','#cbaa8d','#42313c','cloak',['flatcap','gloves'])
]);
export const HALLOWEEN_COSTUMES=Object.freeze([
 look('hedge-witch','Hedge witch','#483b55','#c9956e','#332b3c','gown',['witchhat','broom']),
 look('moon-astrologer','Moon astrologer','#364668','#d4c799','#303b54','gown',['starhat','stars']),
 look('clockwork-pilgrim','Clockwork pilgrim','#745745','#d8b35d','#494138','longcoat',['goggles','gears']),
 look('raven-warden','Raven warden','#292f3b','#697b8f','#292b33','cloak',['ravenmask','feathers']),
 look('pumpkin-keeper','Pumpkin keeper','#8d5028','#ffc573','#4a4432','smock',['pumpkinhat','vines']),
 look('paper-ghost','Paper lantern ghost','#d6d4c5','#f0e7be','#a6aaa2','gown',['ghosthood','chains']),
 look('grave-gardener','Grave gardener','#4b5c4e','#c6b489','#354039','smock',['skullmask','vines']),
 look('candle-saint','Candle saint','#bfae84','#f3d59a','#716450','gown',['candlecrown','necklace']),
 look('moth-oracle','Moth oracle','#786877','#dfcbba','#4c4553','shawl',['mothmask','wings']),
 look('drowned-admiral','Drowned admiral','#36566a','#8eb8b1','#2c3e4c','longcoat',['tricorn','chains']),
 look('velvet-vampire','Velvet vampire','#582f48','#d9bfc0','#302537','cloak',['vampirecollar','medallion']),
 look('old-harvest','Old harvest scarecrow','#9c824f','#d9b97d','#5c5038','smock',['strawhat','straw']),
 look('bone-fiddler','Bone fiddler','#41434d','#e1d7b7','#2f333b','vest',['skullmask','bones']),
 look('fortune-teller','Midnight fortune teller','#755276','#dec183','#4c3655','shawl',['turban','stars']),
 look('plague-physician','Plague physician','#303b39','#aab29b','#2b3230','longcoat',['plaguemask','tophat']),
 look('ember-dragon','Ember dragon','#744736','#c8945b','#4c3931','tunic',['horns','dragonwings']),
 look('garden-goblin','Garden goblin','#5b774c','#b4c984','#3c4e32','tunic',['goblinears','vines']),
 look('bell-jester','Bell jester','#74548b','#d8b279','#493b59','tunic',['jesterhat','bells']),
 look('black-cat','Black cat masquerade','#30303b','#c18ca8','#282734','tunic',['catears','tail']),
 look('spider-duchess','Spider duchess','#4a384d','#b7a4bd','#302936','gown',['spidercrown','spiderlegs']),
 look('antler-spirit','Autumn antler spirit','#695b45','#d4c3a0','#434437','cloak',['antlers','leaves']),
 look('silver-skeleton','Silver skeleton','#3b454d','#d8d2c4','#303a42','tunic',['skullmask','bones']),
 look('wolf-masquerade','Wolf masquerade','#625968','#b5acba','#423d49','cloak',['wolfmask','feathers']),
 look('storybook-pirate','Storybook pirate','#75464b','#d6b27e','#45383b','longcoat',['tricorn','eyepatch']),
 look('crystal-seer','Crystal seer','#4f667b','#b5d6dd','#354558','gown',['crystalcrown','medallion']),
 look('frog-prince','Frog prince','#507153','#d5c574','#364c39','vest',['frogmask','crown']),
 look('patchwork-doll','Patchwork doll','#9a6574','#e4c395','#56434c','gown',['ribbon','patches']),
 look('masked-harlequin','Masked harlequin','#694e69','#d2baa0','#43364a','tunic',['harlequinmask','diamonds']),
 look('tomb-explorer','Tomb explorer','#8f7954','#d8c495','#5b4b35','vest',['goggles','satchel']),
 look('midnight-beekeeper','Midnight beekeeper','#a89364','#efd996','#665337','smock',['beehat','wings'])
]);
const dailyLooks=DAILY_OUTFITS.map(a=>Object.freeze({...a,festive:false,key:'daily:'+a.id})),costumeLooks=HALLOWEEN_COSTUMES.map(a=>Object.freeze({...a,festive:true,key:'costume:'+a.id}));
export function wardrobeSeed(actor){let n=2166136261;for(const c of String(actor.id||actor.name||'resident'))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function wardrobeFor(actor,clock=0){
 if(actor.type!=='npc')return null;
 const seed=wardrobeSeed(actor),day=Math.max(0,Math.floor(Number.isFinite(clock)?clock/1440:0));
 // About one resident in five celebrates. Each day changes the group, rather than everyone wearing costumes.
 const festive=((Math.imul(seed^day,1103515245)>>>0)%100)<22;
 const catalog=festive?costumeLooks:dailyLooks,index=((seed%30)+(day%30)*7)%30;
 return catalog[index];
}
