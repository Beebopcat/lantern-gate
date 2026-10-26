// Effective world time drives lighting and wildlife. Calendar/deadline identity remains the raw simulation clock.
export function daylight(clock){
 const hour=((clock%1440)+1440)%1440/60;
 const light=Math.max(0,Math.sin((hour-6)/12*Math.PI));
 const phase=hour<5||hour>=21?'Night':hour<7?'Dawn':hour<17?'Day':hour<20?'Dusk':'Evening';
 return {hour,light,phase,night:light<.12};
}
