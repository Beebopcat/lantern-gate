// Calendar/deadline identity always remains s.clock / s.elapsed. These helpers
// project the chosen world hour and weather without advancing or rewinding either.
export const SEASON_NAMES = Object.freeze(['Spring','Summer','Autumn','Winter']);
export const WEATHER_NAMES = Object.freeze(['clear','rain','snow','mist']);
const record = v => v && typeof v === 'object' && !Array.isArray(v);
const own = (v,k) => Object.hasOwn(v,k);
export const validTime = v => v === 'auto' || Number.isInteger(v) && v >= 0 && v < 1440;
export const validWeather = v => v === 'auto' || WEATHER_NAMES.includes(v);
export const validSeason = v => v === 'auto' || SEASON_NAMES.includes(v);
export function validConditions(settings){
  if(!record(settings))return false;
  return ['timeOverride','weatherOverride','season'].every(k => !own(settings,k) ||
    (k === 'timeOverride' ? validTime(settings[k]) : k === 'weatherOverride' ? validWeather(settings[k]) : validSeason(settings[k]))) &&
    ['music','voice','effects','clickMovement'].every(k => !own(settings,k) || typeof settings[k] === 'boolean');
}
export function upgradeConditions(s){
  if(!validConditions(s.settings))throw Error('Invalid world options.');
  s.settings.timeOverride ??= 'auto';s.settings.weatherOverride ??= 'auto';
  s.settings.season ??= 'auto';s.settings.clickMovement ??= true;
  s.settings.music ??= true;s.settings.voice ??= true;s.settings.effects ??= true;
}
export function worldClock(s){
  const value = s.settings?.timeOverride;
  return value === undefined || value === 'auto' ? s.clock : Math.floor(s.clock / 1440) * 1440 + value;
}
export const worldMinute = s => worldClock(s) % 1440;
export function worldSeason(s){
  const selected=s.settings?.season;
  return selected && selected!=='auto' ? selected : SEASON_NAMES[Math.floor(s.clock / 4320) % 4];
}
export function naturalWeather(s){
  if(s.weather==='rain' && worldSeason(s)==='Winter')return 'snow';
  if(s.weather==='snow' && worldSeason(s)!=='Winter')return 'rain';
  return s.weather;
}
export function worldWeather(s){
  const selected=s.settings?.weatherOverride;
  return selected === undefined || selected === 'auto' ? naturalWeather(s) : selected;
}
export const conditionsDraft = s => ({timeOverride:s.settings.timeOverride??'auto',weatherOverride:s.settings.weatherOverride??'auto',season:s.settings.season??'auto'});
export function validDraft(draft){
  return record(draft) && Reflect.ownKeys(draft).length===3 &&
    ['timeOverride','weatherOverride','season'].every(k=>own(draft,k)) &&
    validTime(draft.timeOverride) && validWeather(draft.weatherOverride) && validSeason(draft.season);
}
export function applyConditions(s,draft){
  if(!validDraft(draft))return {ok:false,text:'Choose a valid time, weather and season.'};
  const changed = Object.entries(draft).some(([k,v]) => (s.settings[k]??'auto')!==v);
  Object.assign(s.settings,draft);
  // Preserve the existing season conversion for the natural weather layer.
  s.weather=naturalWeather(s);
  return {ok:true,changed,text:'World options applied. The calendar continues naturally.'};
}
export const naturalDraft = () => ({timeOverride:'auto',weatherOverride:'auto',season:'auto'});
