# Lantern Gate: project rules for Claude

Owner: Casey Shingledecker. Lantern Gate is a browser open-world RPG (three.js r186 vendored, ES modules, no build step, plain JS) that ships at caseyshingledecker.com under `demos/top-secret/lantern-gate/`.

## Hard rules
- Original design only. Never copy, trace or imitate another commercial game's UI, art, icons, names, terms or assets, and never name other games or studios in code, comments, UI text or file names. Battle terms are our own: Ward, Frays, Staggered, Kindle. Quest terms: Chapters, Side stories, Commissions.
- Saves must stay compatible. Save key: `casey.top-secret.lantern-gate.hollow.v1`. Never rename or remove saved fields; additions are optional with defaults; `E.valid` must accept old saves. `player.hunger` stays in the save (fixed at 100) for compatibility.
- The game is silent until the player turns music on. No console errors. No new audio without Casey asking.
- Must work at 1280x720, 768x1024, 390x844 and 844x390. Touch targets of at least 44px, no horizontal scroll, keyboard accessible, and `prefers-reduced-motion` respected.
- Player-facing wording: "mana" (never "focus" for MP), "ally" or "party member" (never "neighbor"), no hunger or nourishment anywhere in the UI.
- Look: "Lantern storybook HD-2D". Midnight-indigo panels, antique-gold double rules, parchment text, lantern-gold selection glow, serif small-caps headings, Pixelify Sans numerals, and code-drawn pixel art with dark tinted outlines. Tokens are in `game/jrpg-theme.css` (`--jr-*`). The website itself must stay dark, with no white areas.
- Never deploy `kokoro-daemon.py` (it has a known IndentationError). Never upload private reference recordings. No paid subscriptions.
- Keep replies to Casey brief: about 3 sentences, plain words, no jargon.

## Testing
- Serve: `node qa/server.mjs <root> 8099`, where `<root>` contains `demos/top-secret/lantern-gate/` (symlink it to `game/`). Use `curl --noproxy '*'` for local checks.
- Fast node suites: `ROOT=$PWD/game/ node qa/engine.test.mjs` (441), `qa/sprites.test.mjs` (533) and `qa/quest.test.mjs` (581).
- Browser suites use Playwright with Chromium and are slow under software GL, so run them detached and poll: `qa/flow.test.mjs` (123), `qa/battle.browser.test.mjs` (44), `qa/classes.browser.test.mjs` (139), `qa/music.browser.test.mjs` (10), `qa/music-title.test.mjs` (7), `qa/quest.browser.test.mjs` (151). Set `BASE=http://127.0.0.1:8099/demos/top-secret/lantern-gate/`.
- Look at screenshots of every changed screen before calling work done.

## Releases (live site)
The live site is released from Casey's PC through a stage, verify and promote flow. The release details are kept in Casey's private notes, not in this public repository. Casey pre-authorized deploying finished, verified changes. A cloud session that cannot reach his PC should prepare and test the release, then hand the deploy step to a session linked to his PC.
