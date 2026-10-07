# Lantern Gate

Casey Shingledecker's browser open-world RPG in a hand-made "storybook HD-2D" style: pixel-art characters in a miniature diorama world, turn-based battles, and a chaptered quest log. Played at caseyshingledecker.com.

- `game/`: the playable source. Static files with no build step: serve the folder and open `index.html`.
- `qa/`: Node and Playwright test suites.
- `worktrees/`: unfinished work streams (U = menu skin, B = battle screen); S and Q are already merged.
- `tools/`: art generators. `release/`: release helper scripts.
- `docs/`: hand-off, checkpoint, design brief, and the prompt for starting a Claude cloud session.

Project rules for Claude are in `CLAUDE.md`.
