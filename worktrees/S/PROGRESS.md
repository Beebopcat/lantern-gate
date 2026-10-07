# Agent S (sprites) progress

## Done
- Read BRIEF + task; studied render.js, characters.js, motion.js, hd2d.js, engine ENEMIES, companions, life PETS/OUTFITS, wardrobe, NPC roles.
- `qa/png.mjs` (new): dependency-free PNG encoder + `Sheet` compositor for contact sheets.
- `game/sprites.js` v1 (owned): palette ramps (hue-shifted), RGBA buffer, masks (rect/ellipse/poly/capsule/line), directional shading, inner contours, selective outline pass, mirroring; humanoid puppet (front/back/side views; idle/walk/attack/cast/hurt/down/guard); hero spec (class gear, gender, skin, hair, outfit); sheet cache; drawSprite. Frame 40x48, feet on row 45.
- Backups of original render.js/sprites.js in scratchpad `orig/`.

- sprites.js is ASSEMBLED from scratchpad parts by `build.sh` (core, heads, human, compose, npc, creatures, specs) in
  /tmp/claude-0/-home-claude/5f7b6492-89a7-5e7e-9a68-3c03106bd4f8/scratchpad/ (if that is lost, edit game/sprites.js directly; it is the full source).
- v2 art: template heads (skull/face + 3 hair cap families x 3 views), 10 hairstyles, hood template, wizard hat, pauldron;
  NPC specs (roles, wardrobe daily outfits + festival costumes, mythic count/creation); quadrupeds (wolf, ash wolf, dog, fox, cat, lynx, boar),
  hawk, wisp, imp, ghost, brutes (troll, golem), humanoid foes (goblin, thief, bandit, zombie, skeleton, bone squire, sentinel).
- Lab: `qa/sprite-lab.mjs [outDir] [filter]` -> qa/sprites/*-1x.png / *-6x.png ; `qa/sprite-zoom.mjs '<actor json>' scale poses dirs out`.

- render.js hooks DONE (hd2d look only): imports SpriteActors/PX + spriteFor/drawSprite; sprite entries in this.actors
  (entry.sprite), dropActor(), per-frame build budget, labels/hit sized to sprites, dataset.sprites/spriteDir/spritePose,
  portrait() draws sprites (fit + pixel shadow) else old 3D path. New file game/sprite-actors.js (billboards, CPU lighting
  from hemi/sun/fill/lantern/lamps, ground shadow, low-res grid snapping, sheet texture sharing + disposal).
- In-game shots via qa/sprite-shots.mjs -> qa/shots/s-*.png (create, town-day, town-walk, town-night, enemies, classic): working.
- Perf: ~18ms per sheet in Node (bbox masks, outline colour cache, mirrored right row).

- qa/sprite-lab.html (serve worktree root: node /home/claude/qa/server.mjs /home/claude/wt/S 8111 -> /qa/sprite-lab.html) works; shot qa/shots/sprite-lab.png.
- Suites: engine 441/441; flow 123/123 (run detached via qa/run-suites.sh -> qa/suites.log); battle/classes/music pending at time of writing.
- Battle cards show sprites (qa/bt-ranger-1.png).

- qa/sprites.test.mjs (new): 533 node checks (API contract, every creation option, all residents + wardrobe looks, companions, enemies (3D kept for bosses), pets, mirroring, determinism, speed).
- PX now 2.4/36 (1.5 low-res px per sprite px at 720p).

- Suites run 1 (21:16-21:51, code before final polish): flow 123/0, battle 44/0, classes 139/0, music 10/0, music-title 7/0, engine 441/0.

## Next / left
1. Sprite lab script `qa/sprite-lab.mjs` -> contact sheets 1x/6x; iterate hero art until good.
2. NPC/resident specs (roles, wardrobe colours/styles/hats), mythic residents.
3. Companions (8), enemies (wolf, goblin, troll, ghost, skeleton, zombie, thief, bandit, sentinel), pets (dog, cat, fox).
4. render.js: billboards in hd2d look, shadow, lighting tint, dir/pose selection, cache + dispose, hit/labels; portrait() via drawSprite.
5. qa/sprite-lab.html; in-game screenshots (creation, world, night, enemy, classic).
6. Suites: engine (fast), flow/battle/classes/music detached.
7. Final report.

## Notes
- render.js is mode r--r--r-- in the worktree (as are non-owned files); task says S owns render.js sprite hooks, so it is edited deliberately.
