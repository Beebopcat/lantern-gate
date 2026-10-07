# Agent Q progress (quests)
Updated: after step 1

## Done
- quest-meta.js reviewed + fixed (indoor givers point at town, chapter/keepers double events, added chapterRows/storyCount/levelFit/boardAcceptable/direction).
- qa/quest.test.mjs (node, 581 checks) green: `cd qa; ROOT=/home/claude/wt/Q/game node quest.test.mjs`.
- Baseline "before" shots: qa/shots/qb-*.png (journal, conversation). NOTE: minimal-hud.css makes conversation + board panels a tiny 80px "compact" box and hides .quest-ribbon; my plan = expand panel in place (dataset.compact='false') when quest cards are shown; ribbon is a NEW element #quest-track.

## Left (in order)
2. quest-ui.js + quest.css (log, offer cards, board, toasts #quest-toast, ribbon #quest-track)
3. wire rpg.js (showJournal/showBoard/conversation offers/update hook), index.html link lines (quest.css, jrpg-theme.css)
4. qa/quest.browser.test.mjs + screenshots at 1280x720, 768x1024, 390x844, 844x390
5. regression suites (engine 441, flow 123, battle, classes 139, music 10, music-title 7)
6. final report (also: E.valid ignores unknown top-level fields so state.trackedQuest needs no engine change)

## Update (step 3)
- quest-ui.js, quest.css written and wired into rpg.js (import + createQuestUI after createDirectory; conversation() uses questUI.offers + roomy; showJournal/showBoard delegate; click handler calls questUI.handle first; updateHUD calls questUI.update()).
- index.html: added jrpg-theme.css (first) and quest.css (last) link lines.
- Screens seen so far: log (wide + phone), offer card, board look right; polishing in progress. Browser test qa/quest.browser.test.mjs written (first run in progress -> qa/quest-browser.log).
- Backups of the originals: /home/claude/wt/Q/rpg.orig.js and index.orig.html (diff against them to see exactly what changed).

## Update (step 5, verification)
- qa/quest.browser.test.mjs: pages 2-4 green (42 checks); page 1 green earlier. Full 4-page rerun in progress (qa/quest-browser3.log).
- Node suites: engine.test.mjs 441 passed; quest.test.mjs 581 passed.
- Polish applied: compact detail page for short windows (<=760px high), landscape (<=520px high) hides the stats strip and un-sticks the action bar; banner screenshots now hold the banner timers (test-only) so the shot catches them.
- NEXT: view banner shots, run browser suites with BASE=http://127.0.0.1:8104/demos/top-secret/lantern-gate/ (flow 123, battle, classes 139, music 10, music-title 7) via setsid nohup ./run-suites.sh (log: qa/suites.log), then final report via SubagentHandback.
- NOTE: qa/lib.mjs defaults BASE to port 8101 (S's server); always export BASE for port 8104.

## Update (step 6)
- Full quest.browser.test.mjs: 150 passed, 0 failed (before the banner-stacking fix); page 1 re-run after: 109 passed, 0 failed.
- FIX: banners were hidden under the open panel (#game is isolation:isolate and the panel dialog is a later sibling). The #quest-toast wrap is now a body-level fixed element (z-index 60); with a full panel open it moves to top-right (>=1000px) or the bottom edge (smaller) so it never covers the close button. Banners also wait while the arrival scene plays.
- Suites running detached: qa/run-suites.sh (BASE=...:8104), results in qa/suites.log + qa/log-*.txt.

## Update (step 7)
- Regression suites all green with Q worktree (BASE port 8104): engine 441, flow 123, battle 44, classes 139, music 10, music-title 7. Logs: qa/suites.log, qa/log-*.txt.
- Final quest.browser run (after CSS tweaks) in progress -> qa/quest-browser5.log. Then: look at banner/tablet shots, final report via SubagentHandback.

## FINAL (step 8)
- All done. Suites (Q worktree, BASE :8104): engine 441, quest.test 581, quest.browser 151 (pages 1-4; page 4 re-run 5/5 after harness polling change), flow 123, battle 44, classes 139, music 10, music-title 7. No failures.
- Final shots: qa/shots/qt-*.png (before: qb-*.png). Name scan for other games/studios: clean.
- Report delivered via SubagentHandback.
