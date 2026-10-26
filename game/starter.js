// The compact entry surface: exactly New Game, Load Game and Settings. It owns no game state and starts no audio.
export function createStarter({root,onNew,onLoad,onSettings}){
  const buttons=[...root.querySelectorAll('button[data-starter]')],actions={new:onNew,load:onLoad,settings:onSettings},load=root.querySelector('[data-starter="load"]');
  const usable=()=>buttons.filter(b=>!b.disabled);
  for(const b of buttons)b.addEventListener('click',event=>{if(root.hidden||b.disabled)return;event.preventDefault();actions[b.dataset.starter]?.();});
  root.addEventListener('keydown',event=>{
    const list=usable(),index=list.indexOf(document.activeElement);if(index<0)return;
    let next=null;
    if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%list.length;
    else if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index+list.length-1)%list.length;
    else if(event.key==='Home')next=0;else if(event.key==='End')next=list.length-1;
    if(next!==null){event.preventDefault();list[next].focus();}
  });
  return {
    // Load Game is disabled (with an explanatory tooltip) until this browser holds a valid created journey.
    show({hasSave=false,focus=true}={}){
      root.hidden=false;root.dataset.save=String(!!hasSave);
      load.disabled=!hasSave;
      load.title=hasSave?'Continue your saved game':'No saved game found in this browser yet. Use Settings to import one.';
      if(focus)(hasSave?load:buttons[0]).focus({preventScroll:true});
    },
    hide(){root.hidden=true;},
    get open(){return !root.hidden;}
  };
}
