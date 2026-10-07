# Agent U (UI skin) progress

Run tests/shots with `BASE=http://127.0.0.1:8102/demos/top-secret/lantern-gate/` (qa/lib.mjs default points to 8101).
Server restart: `setsid nohup node /home/claude/qa/server.mjs /home/claude/wt/U/site 8102 > /tmp/srv-U.log 2>&1 &`
Screenshot script: `qa/ui-shots.mjs <prefix> 1280x720 768x1024 ...` (env PARTS=title,create,world,menu,tabs,talk,board). Run detached, poll log.

## Findings (before work)
- CSS cascade: rpg, ui-refinements, journey, halloween, illustrated-interface, retro, minimal-hud (Casey's minimal HUD, uses !important), starter, battle.
- flow.test enforces: starter area ~10% of original (8.5-11.5%), 3 labels only, 44px buttons, vitals centred at bottom (vb<30), Menu bottom-left, world-status + quest-ribbon display:none in play ("no navigation text").
- Compact panels (conversation etc.) are capped by minimal-hud.js to 3.5% of view area (--message-width/height).
- Menu surface closes on any button click; tabs open #panel.

## Steps
- [ ] 1 theme + index.html links (jrpg-theme.css after starter.css, then quest.css, then battle.css last so B/Q win ties)
- [ ] 2 creation screen
- [ ] 3 starter, HUD, menu, panels, toasts
- [ ] 4 responsive shots + suites
- [ ] report
- 15:50 index.html rewritten: theme+quest.css links (before battle.css), vitals canvas #hud-portrait, menu surface reordered (h2.book-title, nav tabs+tools, header masthead w/ .masthead-tools), quest.css placeholder. minimal-hud.css rewritten as layout-only (visuals move to theme). Originals backed up in scratchpad/orig.
