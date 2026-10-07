// Track list for the in-game score. Each file lives in audio/ and loops until the game picks another.
export const MODE_LABELS={title:"Title screen",town:"Towns & villages",wild:"Roads & wilds",night:"Night",dungeon:"Cellars, crypts & castle",fight:"Battles"};
export const TRACKS=[
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
export const HUNT={id:'hunt',name:'The Bell Remembers',mode:'hunt',file:'hunt.mp3',seconds:93};
export const trackById=id=>TRACKS.find(t=>t.id===id)||null;
export const tracksFor=mode=>TRACKS.filter(t=>t.mode===mode);
