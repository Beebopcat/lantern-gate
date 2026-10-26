// Track list for the in-game score. Each file lives in audio/ and loops until the game picks another.
export const MODE_LABELS={title:"Title screen",town:"Towns & villages",wild:"Roads & wilds",night:"Night",dungeon:"Cellars, crypts & castle",fight:"Battles",boss:"Boss battles",shop:"Shops & workshops",inn:"Inns"};
const CLASSIC=[
 {id:"hearthside",name:"Hearthside",mode:"town",file:"town.mp3",seconds:161},
 {id:"greenroad",name:"Greenroad",mode:"wild",file:"wild.mp3",seconds:184},
 {id:"moonlit-lanterns",name:"Moonlit Lanterns",mode:"night",file:"night.mp3",seconds:220},
 {id:"low-cellar",name:"Low Cellar",mode:"dungeon",file:"dungeon.mp3",seconds:241},
 {id:"bell-alarm",name:"Bell Alarm",mode:"fight",file:"battle.mp3",seconds:123},
 {id:"market-morning",name:"Market Morning",mode:"town",file:"market-morning.mp3",seconds:72},
 {id:"fountain-song",name:"Fountain Song",mode:"town",file:"fountain-song.mp3",seconds:93},
 {id:"heather-hills",name:"Heather Hills",mode:"wild",file:"heather-hills.mp3",seconds:85},
 {id:"river-crossing",name:"River Crossing",mode:"wild",file:"river-crossing.mp3",seconds:78},
 {id:"owl-hours",name:"Owl Hours",mode:"night",file:"owl-hours.mp3",seconds:118},
 {id:"candle-lullaby",name:"Candle Lullaby",mode:"night",file:"candle-lullaby.mp3",seconds:129},
 {id:"dripstone",name:"Dripstone",mode:"dungeon",file:"dripstone.mp3",seconds:138},
 {id:"ash-corridor",name:"Ash Corridor",mode:"dungeon",file:"ash-corridor.mp3",seconds:102},
 {id:"steel-and-lantern",name:"Steel and Lantern",mode:"fight",file:"steel-and-lantern.mp3",seconds:71},
 {id:"last-light-skirmish",name:"Last Light Skirmish",mode:"fight",file:"last-light-skirmish.mp3",seconds:64},
 {id:"hollow-march",name:"Hollow March",mode:"fight",file:"hollow-march.mp3",seconds:70},
 {id:"gate-at-dawn",name:"Gate at Dawn",mode:"title",file:"gate-at-dawn.mp3",seconds:108},
 {id:"lantern-hymn",name:"Lantern Hymn",mode:"title",file:"lantern-hymn.mp3",seconds:118},
];
// The orchestral score (original compositions; see tools/music). `hifi` tracks are chosen about four times in five when a mode has them.
export const ORCHESTRA=[
 {id:"gate-of-lanterns",name:"Gate of Lanterns",mode:"title",file:"orchestra/gate-of-lanterns.mp3",seconds:139,hifi:true},
 {id:"hearthwick-morning",name:"Hearthwick Morning",mode:"town",file:"orchestra/hearthwick-morning.mp3",seconds:120,hifi:true},
 {id:"market-square",name:"Market Square",mode:"town",file:"orchestra/market-square.mp3",seconds:106,hifi:true},
 {id:"the-river-road",name:"The River Road",mode:"wild",file:"orchestra/the-river-road.mp3",seconds:129,hifi:true},
 {id:"moors-at-dusk",name:"Moors at Dusk",mode:"wild",file:"orchestra/moors-at-dusk.mp3",seconds:131,hifi:true},
 {id:"lanterns-on-the-water",name:"Lanterns on the Water",mode:"night",file:"orchestra/lanterns-on-the-water.mp3",seconds:182,hifi:true},
 {id:"beneath-the-keepers-hall",name:"Beneath the Keeper’s Hall",mode:"dungeon",file:"orchestra/beneath-the-keepers-hall.mp3",seconds:175,hifi:true},
 {id:"steel-and-starlight",name:"Steel and Starlight",mode:"fight",file:"orchestra/steel-and-starlight.mp3",seconds:92,hifi:true},
 {id:"the-hollow-warden",name:"The Hollow Warden",mode:"boss",file:"orchestra/the-hollow-warden.mp3",seconds:93,hifi:true},
 {id:"open-for-trade",name:"Open for Trade",mode:"shop",file:"orchestra/open-for-trade.mp3",seconds:120,hifi:true},
 {id:"a-bed-for-the-night",name:"A Bed for the Night",mode:"inn",file:"orchestra/a-bed-for-the-night.mp3",seconds:109,hifi:true},
];
// One-shot jingles (never part of the rotation).
export const STINGERS={victory:{id:"lantern-raised",name:"Lantern Raised",file:"orchestra/lantern-raised.mp3",seconds:17}};
export const TRACKS=[...ORCHESTRA,...CLASSIC];
export const HUNT={id:'hunt',name:'The Bell Remembers',mode:'hunt',file:'hunt.mp3',seconds:93};
export const trackById=id=>TRACKS.find(t=>t.id===id)||null;
export const tracksFor=mode=>TRACKS.filter(t=>t.mode===mode);
