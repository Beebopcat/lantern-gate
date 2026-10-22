// Presentation only: original progression, actions, saves and world rules stay authoritative.
export function installMinimalHUD({canOpen,onChange,closePanel}) {
  const game=document.getElementById('game'), button=document.getElementById('hud-menu'), surface=document.getElementById('hud-menu-surface');
  function setOpen(open,focus=true){
    if(open&&!canOpen())return;
    surface.hidden=!open;button.setAttribute('aria-expanded',String(open));game.dataset.menuOpen=String(open);onChange();
    if(focus)(open?surface.querySelector('button:not(:disabled)'):button)?.focus();
  }
  function close(focus=true){if(!surface.hidden)setOpen(false,focus);}
  button.onclick=()=>{closePanel();setOpen(surface.hidden);};
  // Close before the existing action handlers run, keeping abilities/interaction usable.
  surface.addEventListener('click',e=>{if(e.target.closest('button'))close(false);},true);
  function resize(){
    const {width,height}=game.getBoundingClientRect();
    // Expand the original outer message height by 210%, keeping it inside the game view.
    if(width<=0||height<=0)return;
    const w=Math.min(400,width*.58),originalHeight=width*height*.035/w;
    // Leave enough room for a full touch target on unusually short views.
    const bottom=Math.min(84,Math.max(8,height-72));
    const h=Math.min(Math.max(64,originalHeight*3.1),Math.max(0,height-bottom-8));
    game.style.setProperty('--message-bottom',bottom+'px');
    document.getElementById('panel').style.setProperty('--message-bottom',bottom+'px');
    game.style.setProperty('--message-width',w+'px');game.style.setProperty('--message-height',h+'px');
    document.getElementById('panel').style.setProperty('--message-width',w+'px');document.getElementById('panel').style.setProperty('--message-height',h+'px');
  }
  const observer=new ResizeObserver(resize);observer.observe(game);resize();
  window.addEventListener('pagehide',e=>{if(!e.persisted)observer.disconnect();});
  return {get open(){return !surface.hidden;},close,toggle:()=>setOpen(surface.hidden)};
}
