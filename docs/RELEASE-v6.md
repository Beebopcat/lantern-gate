# Release v6: orchestral music and character looks

For the session linked to Casey's Windows PC (device owner-pc). Prepared and tested in the cloud. The "Status" section at the end says whether it is live.

- Live before this release: production deployment `dpl_REDACTED` (v5, 2026-10-07, built from `work\jrpg-v5-20261007-v5`).
- Rollback after this release: `dpl_REDACTED` (v5). `dpl_REDACTED` (v4) is also kept.
- Source: branch `claude/gracious-curie-6ib0fj` of `Beebopcat/lantern-gate`.

## 1. What is in v6
- **Orchestral soundtrack**: 11 original hi-fi tracks and a victory stinger in `audio/orchestra/` (12 mp3, 32 MB) plus the soundfont licence file. Rendered with FluidSynth and the MuseScore General SoundFont (MIT, CC0 parts; licence shipped beside the files and linked from the credits). New music modes: boss, shop, inn. The 18 classic tracks stay and the hi-fi ones are chosen 80% of the time. The game stays silent until the player turns music on. Built by `tools/music/` (not part of the site).
- **Character looks** (creation screen): 8 hairstyles per body, 10 hair colours, 7 eye colours, face marks (freckles, scar, beauty mark), and bare head for Mage and Ranger. The hairstyle list follows the chosen body (Female / Male). Optional save fields `hairStyle`, `eyes`, `face`, `headwear`: old saves keep their look and stay valid.
- Not in v6: building/shop redesign and world dressing (see `HANDOFF-v6.md`).

## 2. Exact files that change on the live site (22, all under `demos/top-secret/lantern-gate/`)
Modified (8): `audio.js`, `battle-ui.js`, `journey-ui.js`, `journey.js`, `render.js`, `rpg.js`, `soundtrack.js`, `sprites.js`.
Added (14): `appearance.js`, `audio/orchestra/SOUNDFONT-LICENSE.txt`, and 12 mp3 in `audio/orchestra/`: `a-bed-for-the-night`, `beneath-the-keepers-hall`, `gate-of-lanterns`, `hearthwick-morning`, `lantern-raised`, `lanterns-on-the-water`, `market-square`, `moors-at-dusk`, `open-for-trade`, `steel-and-starlight`, `the-hollow-warden`, `the-river-road`.
The authoritative list is `release/expected-changes-v6.json`; `release/prepare-v6.py` asserts that the candidate differs from the live v5 payload in exactly those files. Every other file under `audio/` (the live recordings) is never overlaid. `kokoro-daemon.py` is never shipped.

## 3. Test results on this branch
RESULTS_PLACEHOLDER

## 4. How to run the release (documented flow in CLAUDE.md, v6 scripts in `release/`)
All commands run on the PC. Git is not on the PATH of the Desktop Commander shell: use `C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd\git.exe`. The release clone must keep `core.autocrlf=false`.

```powershell
cd C:\AI_Workspace\Creative_Projects\Active\Casey\PC-Project-2026-10-02\work\lantern-gate-v5-src
git pull origin claude/gracious-curie-6ib0fj
$env:LG_REPO=(Get-Location).Path
python release\prepare-v6.py --list      # compare with the live v5 manifest, writes ..\release-changes.json
python release\prepare-v6.py             # creates ..\jrpg-v6-20261009-v6 : candidate, public-manifest.json, preparation.json, deploy.mjs
cd ..\jrpg-v6-20261009-v6
node deploy.mjs stage                    # ONE private stage upload (run detached and poll stage-result.json)
# get a share link for stage-result.json's origin (Vercel "shareable link"), then verify in real Chrome:
node ..\lantern-gate-v5-src\release\verify-stage-v6.mjs . "<origin>/?_vercel_share=..."   # writes browser-qa.json
node deploy.mjs promote                  # ONE promotion; keeps dpl_REDACTED as the rollback
node ..\lantern-gate-v5-src\release\verify-live-v6.mjs .                                  # hash-check the live files, writes live-verification.json
```

Rollback: promote `dpl_REDACTED` again (`vercel promote`), exactly as v5 documented.

## 5. Status
STATUS_PLACEHOLDER
