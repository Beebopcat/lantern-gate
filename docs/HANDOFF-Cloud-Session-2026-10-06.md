# Hand-off to a new Claude cloud session (2026-10-06, evening)

## State in one paragraph
caseyshingledecker.com is live on deployment dpl_REDACTED (Lantern Gate HD-2D game with turn-based battles and 18 music tracks, plus the new all-dark site windows). The JRPG overhaul (original design, never a copy of another game) is in progress and NOT live: pixel sprites done and tested; quest log/board/banners/ribbon done and tested; menu skin (U) started (index.html, theme and HUD CSS partly rewritten, creation screen not done); battle UI (B) not done (rules written, untested).

## Where everything is (Windows, folder `C:\AI_Workspace\Creative_Projects\Active\Casey\PC-Project-2026-10-02\work\`)
- `jrpg-overhaul-20261006\jrpg-overhaul-wip2-2026-10-06.tar.gz` (newest bundle: S, U, B, Q work, each with game/ and qa/ files changed since the brief, PROGRESS.md files, BRIEF.md). Older bundle and CHECKPOINT-2026-10-06.md beside it.
- `site-dark-20261006-v4\` is the live release folder (candidate payload, manifest, prepare.py, deploy.mjs, receipts). Use it as the previous payload for the next release.
- `jrpg-music-20261005-v3b\src-lantern-gate\` is the game source of the live build.

## Overhaul pieces
- S sprites: `sprites.js`, `sprite-actors.js`, `render.js` (HD-2D look only; classic keeps 3D). sprites test 533/533; flow 123, battle 44, classes 139, music 10, music-title 7, engine 441 all green.
- Q quests: `quest-meta.js`, `quest-ui.js` (new), `quest.css` (new), `rpg.js` (about 15 lines), tests `quest.test.mjs` 581/581 and `quest.browser.test.mjs` 151/151; all other suites green. Saves: optional `state.trackedQuest`. Needs `jrpg-theme.css` linked first and `quest.css` linked in index.html.
- U menu skin: partial. Files: index.html, jrpg-theme.css, minimal-hud.css (layout-only rewrite), starter.css, retro.css, journey.css, halloween.css. See U/PROGRESS.md. Must keep flow.test rules (starter ~10% area, 44px buttons, vitals bottom centre, Menu bottom-left).
- B battle: `battle.js` + `battle-data.js` rules (Ward, Frays, Staggered, Kindle, 8-turn timeline, 3 skills per class); battle-ui.js and battle.css not started; no rules test yet.

## Next steps
1. Restore: copy the live game source, overlay S then Q files (merge rpg.js and index.html by hand), run all suites. Ship as release v5 (sprites + quest log) using the v4 release flow below.
2. Finish U (creation screen with sprite preview, menus, panels) and B (battle arena UI + rules test), one or two agents at a time; each writes PROGRESS.md.
3. Still open: Casey's feedback on the music; Hungry Moors mobile title overlap; 404 legacy images in demos/aetherglass/world.mjs and demos/lesson-mode-rpg.html; Kokoro voices / Desktop Pixel Companions (not started; never deploy kokoro-daemon.py).

## Release flow (worked twice)
New `work\<topic>-<date>-vN` folder; prepare.py copies the previous candidate, swaps exactly the changed files, asserts the change set and writes the manifest; `deploy.mjs stage` once (run detached on Windows, poll; a transient "fetch failed" with no deployment created may be retried once after renaming the attempt files); verify the private stage in the built-in browser with a Vercel share link; write browser-qa.json (UTF-8, no BOM); `deploy.mjs promote` once; hash-check the live files. Base for the next release: dpl_REDACTED (rollback dpl_REDACTED). Casey pre-authorized deploying finished, verified changes.

## Paste-ready prompt for the new session
> Continue Casey's Lantern Gate JRPG overhaul and caseyshingledecker.com work. Read `C:\AI_Workspace\Creative_Projects\Active\Casey\PC-Project-2026-10-02\work\jrpg-overhaul-20261006\HANDOFF-Cloud-Session-2026-10-06.md` and CHECKPOINT-2026-10-06.md first, unpack `jrpg-overhaul-wip2-2026-10-06.tar.gz` into the cloud workspace, and restore the game source from `work\jrpg-music-20261005-v3b\src-lantern-gate\`. Original design only (no copying another game's UI, art or names). Next: merge sprites (S) and quest log (Q), run every test suite, ship it as release v5 using the documented stage/verify/promote flow (deploying finished, verified changes is pre-authorized), then finish the menu skin (U) and battle UI (B). Keep replies brief; give me a short update when each release is live.
