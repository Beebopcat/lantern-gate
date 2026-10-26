# Prompt to start the Claude cloud session (paste everything below the line)

---

You are continuing Casey's Lantern Gate project (a browser JRPG at caseyshingledecker.com). This repository is the whole project state. Read `CLAUDE.md` first and follow it, then read `docs/HANDOFF-Cloud-Session-2026-10-06.md`, `docs/CHECKPOINT-2026-10-06.md` and `docs/BRIEF.md`.

Where things stand:
- `game/` is the current source. It is the live build plus the merged pixel-art sprites and the new quest log, and Casey's latest small request is already applied: hunger and nourishment removed, food restores mana, "focus" renamed "mana" everywhere players see it, and "ally" instead of "neighbor". The fast suites pass: engine 441, sprites 533 and quest 581. The browser suites have not been re-run since the merge.
- `worktrees/U` holds the partial storybook menu skin and `worktrees/B` the battle rules (`battle.js`, `battle-data.js`; the battle screen is not built). Each folder has `game/` and `qa/` files changed relative to the source they started from, plus a `PROGRESS.md` (B has none). `worktrees/S` and `worktrees/Q` are already merged into `game/`; keep them for reference.
- `tools/icons/gen.py` draws 48 original 32x32 pixel-art interface icons. It has never been run.

Do this, in order, verifying each step with tests and screenshots you actually look at:
1. Set up the test server (see `CLAUDE.md`) and run every suite on `game/`. Fix anything the merge or the mana/ally changes broke, without weakening any test.
2. Item icons. Run `python3 tools/icons/gen.py out/` and review a contact sheet of all icons at 1x and 4x. Polish any icon that reads poorly at 40px (food, potions, tools and keepsakes must be recognizable). Then replace `game/assets/interface/<name>.webp` (same names, 128px, transparent background, nearest-neighbour upscale), check the satchel, shop, quest cards and HUD menu at all four viewport sizes, and keep the icons consistent with the sprite style.
3. Satchel check: the header row must show coins, level, "Mana X / Y" and the weapon. No hunger or nourishment anywhere: grep the source and also check the screens.
4. Finish the menu skin from `worktrees/U` (start from its `PROGRESS.md`): creation screen with a large sprite preview and turn buttons, title/starter menu, HUD, menu tabs, panels, dialogs, settings and toasts. Keep every id and data attribute that the tests use, and keep the `flow.test` layout rules (starter area about 10%, 44px buttons, vitals bottom centre, Menu bottom-left). Link order in `index.html`: `jrpg-theme.css` first, `quest.css` and `battle.css` last.
5. Battle screen from `worktrees/B`. Add a node rules test for Ward, Frays, Staggered, Kindle and the 8-turn timeline. Build the arena UI in `battle-ui.js` and `battle.css` with sprite poses, Ward pips, Fray glyphs, Kindle spending, the turn timeline, three skills per class, items, flee and a result screen. Keep the engine contract: `ctx.hurt`, `G.damage`, `ctx.use`, seeded rng, nothing saved, `settle`/`battleGrace`.
6. After each of steps 2 to 5 that leaves everything green, commit with a clear message and push to this repository. Open a pull request titled "Release v5: <summary>" with test results and screenshot links.
7. Deploying needs Casey's Windows PC, so do not attempt it from here unless a session linked to his PC is available. Instead, write `docs/RELEASE-v5.md` listing exactly which files changed against the live build (`git diff --stat` against the first commit), for the PC-linked session to run the release flow in `CLAUDE.md`.

Work hands-off. Use helper agents if you need them, at most two at a time to stay within usage limits, and give each a `PROGRESS.md`. When everything is finished, send Casey a 3-sentence plain-language update.
