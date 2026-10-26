// Authored genders for fictional residents, following the existing character cast.
// Casting is deterministic: a resident keeps the same voice across saved journeys.
const female=new Set(['Mara','Ada','Tamsin','Nell','Edda','Iona','Sella','Tilda','Dara','Anwen','Beryl','Petra','Esme','Amity','Rilla','Ines','Elowen','Mercy','Tess','Maris','Una','Carys','Miri','Brigid','Yara','Isolde','Lenna','Lumi','Eira','Faye','Hazel','Saffron','Hester','Sorrel','Ysra','Dove','Juniper','Maeve','Nessa','Elin']);
export const voicePools={female:['af_heart','af_bella','af_nicole','bf_emma','bf_isabella'],male:['am_michael','am_fenrir','bm_george','bm_lewis','bm_daniel']};
export const normalizeSpeech=text=>String(text).replace(/[“”]/g,'').replace(/\s+/g,' ').trim();
// E.talk wraps its short greetings in authored stage directions. Speak only
// the actual quoted line in those two exact forms. Story histories, job
// explanations, books and every other dialogue remain complete.
export function spokenText(text,who={}){
 const value=String(text).trim();if(!who.name)return value;
 const name=String(who.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const greeting=value.match(new RegExp('^“([^”]*)” '+name+' pauses from [\\s\\S]*\\.$'));
 if(greeting)return greeting[1];
 const injured=value.match(new RegExp('^'+name+' leans against the wall, injured\\. “([^”]*)”$'));
 return injured?injured[1]:value;
}
export function speechKey(id,text){let n=2166136261;const clean=normalizeSpeech(text);for(const c of clean)n=Math.imul(n^c.charCodeAt(0),16777619);return `${id||'narrator'}-${(n>>>0).toString(16)}-${clean.length}`;}
export function castFor(n={}){
 const gender=['female','male'].includes(n.gender)?n.gender:female.has(n.name)||!n.id?'female':'male',pool=voicePools[gender];
 const seed=[...(n.id||'narrator')].reduce((v,c)=>Math.imul(v,31)+c.charCodeAt(0)>>>0,7),voice=n.id?pool[seed%pool.length]:'af_heart';
 return {gender,voice,language:voice.startsWith('b')?'en-gb':'en-us',speed:.97};
}
