# Release v5: what changed against the live build, and how to ship it

For the session linked to Casey's Windows PC (device owner-pc). Everything below was prepared and tested in the cloud; **nothing from v5 is live yet** unless the section "Status" at the end says so.

- Live build: production deployment `dpl_REDACTED` (v4, dark site stylesheet, 2026-10-06). Rollback target: `dpl_REDACTED`.
- Source of this release: branch `claude/gracious-curie-6ib0fj` of `Beebopcat/lantern-gate` (pull request #1).

## 1. Read this first: the first commit is not the live build

`git diff --stat` against the first commit (`1f244c8`, "Lantern Gate project state 2026-10-06") is listed in section 3 as asked, but that commit already contained work that was never deployed: the pixel sprites, the quest log, and the mana/ally wording changes. So the exact list of files that differ from what is **live** comes from comparing the repo's `game/` folder with the live payload manifest (`site-dark-20261006-v4\public-manifest.json`). `release/prepare-v5.py --list` does that; its result is section 2.

## 2. Exact files that change on the live site (80 files, all under `demos/top-secret/lantern-gate/`)

Added (10): `battle-data.js`, `jrpg-theme.css`, `quest-meta.js`, `quest-ui.js`, `quest.css`, `sprite-actors.js`, `sprites.js`, `assets/fonts/pixelify-sans-latin-400-normal.woff2`, `assets/fonts/pixelify-sans-latin-700-normal.woff2`, `assets/fonts/Pixelify-Sans-OFL.txt`.

Modified (70):
- Game code and page (13): `battle-ui.js`, `battle.js`, `destinations.js`, `engine.js`, `journey-ui.js`, `journey.js`, `progression.js`, `render.js`, `retro-ui.js`, `rpg.js`, `stories.js`, `world.js`, `index.html`.
- Styles (9): `battle.css`, `halloween.css`, `illustrated-interface.css`, `journey.css`, `minimal-hud.css`, `retro.css`, `rpg.css`, `starter.css`, `ui-refinements.css`.
- Interface icons (48), `assets/interface/*.webp`: anvil, armor, bag, bed, bell, bookcase, bow, bread, cart, cave, chair, check, chest, coil, compass, crown, fish, flowers, grave, heart, home, interact, journal, lantern, leaf, ledger, lens, locket, map, medallion, notice, ore, oven, pearl, person, pet, ring, salve, seed, settings, stall, sword, table, tonic, town, verse, well, wood.

The authoritative list is `release-changes.json`, written by `python release\prepare-v5.py --list` (and again as `preparation.json` by the full run). `prepare-v5.py` asserts that the candidate differs from the v4 payload in exactly those files.

**Not shipped, on purpose:** everything under `game/audio/`. The repo's audio files are smaller stand-ins, not the live recordings (for example `battle.mp3` is 1.4 MB in the repo and 2.9 MB live, `dungeon.mp3` 1.4 MB vs 5.8 MB). `prepare-v5.py` never overlays `audio/`, so the live music stays byte-identical. `kokoro-daemon.py` is never shipped. Files outside `game/` (`qa/`, `worktrees/`, `tools/`, `docs/`, `release/`) are not part of the site.

## 3. `git diff --stat` against the first commit (`1f244c8`)

103 files changed, 3716 insertions(+), 569 deletions(-) for the whole repo; 70 files under `game/` (48 icons and 22 source files):

```
game/battle-data.js            |  95 +++++++
game/battle-ui.js              | 630 ++++++++++++++++++++++++++++++++++-------
game/battle.css                | 358 ++++++++++++++++++++---
game/battle.js                 | 470 ++++++++++++++++++++++--------
game/engine.js                 |  13 +-   (prop collision, "ten mana")
game/halloween.css             | 132 ++++-----
game/illustrated-interface.css |  10 +-
game/index.html                |  17 +-
game/journey-ui.js             |  74 ++++-
game/journey.css               |  28 +-
game/journey.js                |   4 +-
game/jrpg-theme.css            | 610 ++++++++++++++++++++++++++++++++++++++-
game/minimal-hud.css           |  47 ++-
game/progression.js            |   4 +-
game/render.js                 |   2 +-
game/retro-ui.js               |   2 +-
game/retro.css                 | 108 ++++---
game/rpg.css                   |  69 +++--
game/rpg.js                    |  16 +-   (eased walking)
game/starter.css               |  26 +-
game/stories.js                |   2 +-
game/ui-refinements.css        |  63 ++++-
+ 48 icons in game/assets/interface/*.webp
```

Run `git diff --stat 1f244c8 HEAD` for the exact current numbers.

## 4. What v5 contains

- Pixel-art characters and creatures in the HD-2D scene, and the chaptered quest log (Chapters, Side stories, Commissions) with banners and a tracked-quest ribbon.
- 48 original pixel-art interface icons (`tools/icons/gen.py`), 128px with transparent backgrounds.
- "Lantern storybook" interface skin: creation screen with a large sprite preview and turn buttons (Female and Male only), title menu, HUD plate, Journey Book menu, panels, dialogs, settings, toasts.
- New turn-based battle screen: Ward pips, Fray glyphs, Staggered, Kindle, an 8-turn timeline, three skills per class, items, flee, result screen.
- Hunger and nourishment are gone; food restores mana; "mana" and "ally" wording everywhere players see it.
- Smoother walking (the hero eases into and out of a walk, softer camera) and solid props (the hero can no longer walk through wells, stalls, carts, lamps, shrines, graves, braziers or furniture).

## 5. Test results on this branch

Node: engine 459, sprites 533, quest 581, battle rules 629. Browser (Chromium, software GL): flow 123, classes 139, quest 151, battle 183, skin 409, move 7, music 10, music-title 7.

## 6. How to run the release (documented flow in CLAUDE.md, v5 scripts in `release/`)

All commands run on the PC. The release clone must have `core.autocrlf=false` (Windows line-ending conversion would change the bytes).

```powershell
cd C:\AI_Workspace\Creative_Projects\Active\Casey\PC-Project-2026-10-02\work
git -c core.autocrlf=false clone --branch claude/gracious-curie-6ib0fj https://github.com/Beebopcat/lantern-gate.git lantern-gate-v5-src   # or git pull in it
cd lantern-gate-v5-src ; npm install playwright-core@1.56.1 --no-save --no-package-lock
$env:LG_REPO=(Get-Location).Path
python release\prepare-v5.py --list      # compare with the live manifest, writes ..\release-changes.json
python release\prepare-v5.py             # creates ..\jrpg-v5-20261007-v5 : candidate, public-manifest.json, preparation.json, deploy.mjs
cd ..\jrpg-v5-20261007-v5
node deploy.mjs stage                    # ONE private stage upload (about 10 minutes; run detached and poll stage-result.json)
# get a share link for stage-result.json's origin (Vercel "shareable link"), then verify in real Chrome:
node ..\lantern-gate-v5-src\release\verify-stage-v5.mjs . "<origin>/?_vercel_share=..."   # writes browser-qa.json (4 viewports, changed bytes, silent, no console errors)
node deploy.mjs promote                  # ONE promotion; keeps dpl_REDACTED as the rollback
node ..\lantern-gate-v5-src\release\verify-live-v5.mjs .                                  # hash-check the live files, writes live-verification.json
```

One deliberate change to the v4 gate: v4's `deploy.mjs promote` demanded `qa.internalBrowser===true` (a check made in Claude's built-in browser pane). `prepare-v5.py` writes the v5 `deploy.mjs` so that a real-Chrome verification (`qa.realBrowser===true`, written by `verify-stage-v5.mjs`) satisfies that line instead. Every other promote condition is unchanged.

Rollback: promote `dpl_REDACTED` again (`vercel promote`), exactly as v4 documented.

## 7. Status

(See the pull request for the latest status of staging and promotion.)
