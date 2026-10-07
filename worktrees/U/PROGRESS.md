# Agent U (UI skin) progress

Run tests/shots with `BASE=http://127.0.0.1:8102/demos/top-secret/lantern-gate/` (qa/lib.mjs default points to 8099).
Server: `setsid nohup node qa/server.mjs /home/user/wt-U-root 8102 > /tmp/srv-U.log 2>&1 &` (wt-U-root/demos/top-secret/lantern-gate -> game).
Screenshots: `qa/ui-shots.mjs <prefix> 1280x720 768x1024 390x844 844x390` with env `PARTS=title,create,world,menu,tabs,talk,board` (run detached, poll). Output under /tmp/shots-U (not in git).
Cascade check: `qa/skin-diff.mjs` dumps computed styles for every state; `ORDER=last` links jrpg-theme.css after the legacy sheets (the first design), `ORDER=first` is the required order. `node qa/skin-diff.mjs --diff a.json b.json` lists differences.

## Findings (before work)
- flow.test enforces: starter area ~10% of original (8.5-11.5%), 3 labels only, 44px buttons, vitals centred at bottom (vb<30), Menu bottom-left, world-status + quest-ribbon display:none in play ("no navigation text").
- Compact panels (conversation etc.) are capped by minimal-hud.js to 3.5% of view area (--message-width/height).
- Menu surface closes on any button click; tabs open #panel.
- Player-facing wording: only engine.js:169 (well: "restore ten focus") still says focus for mana; engine.js is not mine (see report).
- quest.css selectors are written against the skin's generic `#panel-body ...` rules, so those keep their specificity (no blanket prefix on the skin).

## Steps
- [x] 0 index.html link order required: jrpg-theme.css first, quest.css and battle.css last; body.jr-skin
- [x] 2 creation screen: stage + pedestal, large sprite (drawSprite, whole-pixel scale), turn left/right + stance buttons, drag to turn, name/appearance with stepper options, calling cards, companion cards, abilities, back/confirm (journey-ui.js)
- [x] HUD bust canvas (#hud-portrait) drawn from the hero sprite (journey-ui.js hud())
- [x] Pixelify Sans OFL credit in Settings (journey-ui.js settings())
- [ ] 1 legacy sheets reduced to layout-only (tool-assisted strip), skin verified with theme first (skin-diff)
- [ ] 3 starter, HUD, menu, panels, toasts verified in browser at 4 sizes
- [ ] 4 responsive shots + suites (engine 441, sprites 533, quest 581, flow 123, classes 139, music-title 7, music 10, quest.browser 151)
- [ ] report
