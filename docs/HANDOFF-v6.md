# Hand-off for tomorrow: what v6 shipped, and what is left of the v6 brief

Casey's v6 brief: "Add orchestral, hi-fi music suitable for a high-end 2.5D JRPG. Provide more attractive character-creation models and hairstyles. Enhance world design, including towns, scenery, creatures, NPCs, and monsters. Clearly mark shops and distinguish their buildings from others. Ensure every home and building has its own creative, unique design and interior/exterior." (Do not name any other game in code, comments, UI text or file names.)

## Done in release v6 (see `RELEASE-v6.md`)
1. **Music**: 11 original orchestral tracks + a victory stinger in `game/audio/orchestra/`, rendered by `tools/music/` (FluidSynth + MuseScore General SoundFont, licence shipped beside the files). New modes boss / shop / inn. The classic 18 tracks stay; the hi-fi ones are picked 80% of the time. Measured, not listened to: Casey should listen and say what to change.
2. **Character looks**: `game/appearance.js` is the single list of options. Eight hairstyles per body, ten hair colours, seven eye colours, freckles / scar / beauty mark, bare head for Mage and Ranger. Optional save fields `hairStyle`, `eyes`, `face`, `headwear` (old saves keep their look; a character with no saved style still picks from the original four by name).

## Not started (do these next, in this order)
### A. Buildings: every home and building unique, shops clearly marked
Where things are now:
- `game/models.js` `house(b, cut, season, azimuth)` builds every building from the same box walls. Only wood/plaster colour, roof by seed, a small sign colour by kind, a planter and the jack-o-lantern vary.
- `game/world.js` generates 10 buildings per town from `layouts` (archive, forge, clinic, bakery, inn, shop, home x3, farm) with `decor` props per kind. `solid()` is tile based (wall/water/tree).
- Residents and their routines depend on prop ids and types (`game/resident-routines.js`), so interiors may change in look and layout but prop ids and types must stay stable.

Plan:
1. New generator in `models.js`, keyed by building id (stable hash): footprint variants (L-shape, tower corner, porch, lean-to, two storeys), roof family (gable, hip, gambrel, turret, thatch, slate), chimney, shutters, door style, window pattern, trim colour, per-kind signature (forge: chimney + anvil yard; bakery: oven chimney + bread sign; clinic: green cross-free lantern and herb boxes; inn: hanging bed-and-lantern sign, upper floor; archive: round tower and book banner; farm: barn + silo).
2. Shops: distinct awning in the shop's colour, hanging sign with the interface icon for what it sells (`assets/interface/*.webp`: anvil, bread, bag, salve, ledger...), lit window at night, a stall out front, and a marker on the minimap/HUD. A shop must be recognisable from across the square. Keep sign text out of other games' vocabulary.
3. Interiors: per building id, room layout (floor colour, rug, hearth, furniture set) so no two homes look alike; keep prop ids/types for NPC routines.
4. Test `qa/buildings.test.mjs`: build every building of every town, hash the exterior mesh summary and the interior prop layout, assert all are different, shops carry a sign + awning + marker, and prop ids/types for routines are unchanged. Screenshots at 1280x720, 768x1024, 390x844, 844x390.

### B. World dressing and creature variety
- Per-town identity (palette, props, lamp style), scenery clusters (orchards, stone walls, wells, market stalls, cemetery fences, reeds and boats by the river), more NPC variety (use the 8 hairstyles x 10 colours already in `sprites.js`, plus hats/aprons by role), and creature and monster silhouettes in `sprites.js` (`creatureSpec`, quad creatures) and `creatures.js`.
- Keep `solid()` collisions consistent with new props (`PROP_RADIUS`, `slideOffProps` in `engine.js`).

### C. Then release v7
Same flow as v6 (`RELEASE-v6.md`): `release/prepare-v7.py` from `prepare-v6.py` (base = the v6 release folder, which becomes the live payload). Never overlay the repo's old audio files.

## Rules to keep in mind (from CLAUDE.md)
Original design only; saves compatible (key `casey.top-secret.lantern-gate.hollow.v1`, additions optional, `E.valid` accepts old saves, `player.hunger` stays 100); silent until music is on; 1280x720 / 768x1024 / 390x844 / 844x390, 44px targets, no horizontal scroll, keyboard accessible, reduced motion; "mana", "ally", no hunger wording; dark site; never ship `kokoro-daemon.py`; reply to Casey in about 3 plain sentences.
