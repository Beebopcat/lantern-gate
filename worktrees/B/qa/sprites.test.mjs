// Node checks for the code-drawn sprite generator: API shape, coverage of every actor kind, determinism.
// ROOT=/path/to/game node sprites.test.mjs
const ROOT = process.env.ROOT || new URL('../game/', import.meta.url).pathname;
const S = await import(ROOT + 'sprites.js'), WD = await import(ROOT + 'wardrobe.js');
const E = await import(ROOT + 'engine.js'), G = await import(ROOT + 'companions.js'), L = await import(ROOT + 'life.js'), W = await import(ROOT + 'world.js');
let pass = 0, fail = 0; const ok = (c, m) => {if (c) pass++; else {fail++; console.log('  FAIL', m);}};
ok(S.DIRS.join() === 'down,left,up,right', 'DIRS contract');
ok(S.POSES.join() === 'idle,walk,attack,cast,hurt,down,guard', 'POSES contract');
for (const n of ['spriteSpec', 'spriteSize', 'drawSprite', 'spriteFor', 'spriteSheet']) ok(typeof S[n] === 'function', n + ' exported');
const opaque = (sh, row, col) => {let n = 0; for (let y = 0; y < sh.h; y++) for (let x = 0; x < sh.w; x++) if (sh.data[((row * sh.h + y) * sh.w * sh.cols + col * sh.w + x) * 4 + 3]) n++; return n;};
const fullSheet = (a, tag) => {
  const sh = S.spriteSheet(a); ok(!!sh, tag + ' has a sheet'); if (!sh) return null;
  ok(sh.cols === 14 && sh.rows === 4 && sh.data.length === sh.w * sh.h * 56 * 4, tag + ' sheet layout');
  let empty = 0; for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) if (opaque(sh, r, c) < 20) empty++;
  ok(empty === 0, tag + ' every frame drawn (' + empty + ' empty)');
  // right row mirrors left row
  let same = true; for (let y = 0; y < sh.h && same; y++) for (let x = 0; x < sh.w; x++) {const a1 = ((1 * sh.h + y) * sh.w * sh.cols + x) * 4, b1 = ((3 * sh.h + y) * sh.w * sh.cols + (sh.w - 1 - x)) * 4; if (sh.data[a1 + 3] !== sh.data[b1 + 3]) {same = false; break;}}
  ok(same, tag + ' right = mirrored left');
  return sh;
};
// heroes: every creation option
for (const classId of ['warrior', 'mage', 'ranger', 'summoner']) for (const gender of ['female', 'male', 'nonbinary']) for (const [i, skin] of ['warm', 'earth', 'deep', 'pale', 'olive'].entries())
  fullSheet({kind: 'hero', classId, gender, skin, hair: ['brown', 'black', 'silver', 'auburn', 'gold'][i], outfit: Object.keys(L.OUTFITS)[i], name: 'Hero' + i}, `hero ${classId}/${gender}/${skin}`);
for (const legacy of ['oathbinder', 'echoartisan', 'marrowgardener', 'nonsense', undefined]) ok(!!S.spriteFor({id: 'player', type: 'hero', classId: legacy}), 'legacy/unknown class still drawn: ' + legacy);
// outfit by id and by colour give the same coat
ok(S.spriteFor({kind: 'hero', classId: 'mage', outfit: 'royal'}).key === S.spriteFor({kind: 'hero', classId: 'mage'}, L.OUTFITS.royal.color).key, 'outfit id == outfit colour');
// residents (all NPCs, with today's wardrobe and a costume), mythic residents
const s = E.fresh(1); L.upgrade(s);
for (const n of s.actors) {const sp = S.spriteFor({...n, wardrobe: WD.wardrobeFor(n, 0)}); ok(sp && sp.type === 'human', 'resident ' + n.name);}
for (const look of [...WD.DAILY_OUTFITS, ...WD.HALLOWEEN_COSTUMES]) ok(!!S.spriteSheet({type: 'npc', role: 'merchant', name: 'Edda', id: 'x-' + look.id, wardrobe: {...look, key: look.id}}), 'wardrobe ' + look.id);
for (const role of ['creation', 'count', 'clergy', 'miner']) fullSheet({type: role === 'creation' || role === 'count' ? 'mythic' : 'npc', role, profession: role, name: 'M' + role, id: 'm-' + role}, 'role ' + role);
// companions, enemies, pets; 3D-only kinds return null
for (const k of Object.keys(G.COMPANIONS)) fullSheet({type: 'guardian', kind: k, id: 'guardian'}, 'companion ' + k);
const spriteFoes = ['wolf', 'goblin', 'troll', 'ghost', 'skeleton', 'zombie', 'thief', 'bandit', 'sentinel'];
for (const k of Object.keys(E.ENEMIES)) {
  const sp = S.spriteFor({type: 'enemy', kind: k, id: 'e-' + k});
  if (spriteFoes.includes(k)) {ok(!!sp, 'enemy sprite ' + k); fullSheet({type: 'enemy', kind: k, id: 'e-' + k}, 'enemy ' + k);}
  else ok(sp === null, '3D kept for ' + k);
}
for (const k of Object.keys(L.PETS)) fullSheet({type: 'pet', kind: k, id: 'p-' + k}, 'pet ' + k);
ok(S.spriteFor({type: 'npc', kind: 'werewolf', id: 'castle-wolfman', role: 'cursed keeper'}) === null, 'Wolf Man keeps 3D');
// determinism: a fresh generation equals the cached one
const a = {kind: 'hero', classId: 'ranger', gender: 'male', skin: 'olive', hair: 'auburn', outfit: 'forest', name: 'Det'};
const f1 = S.renderFrame(S.spriteFor(a), 'down', 'walk', 1), f2 = S.renderFrame(S.spriteFor(a), 'down', 'walk', 1);
ok(Buffer.compare(Buffer.from(f1.c), Buffer.from(f2.c)) === 0, 'deterministic frames');
ok(S.spriteSize(a).w === 40 && S.spriteSize(a).h === 48, 'human frame size 40x48');
// speed: one sheet should stay cheap
const t0 = performance.now(); S.spriteSheet({type: 'npc', role: 'smith', name: 'Speedy', id: 'speedy'}); const ms = performance.now() - t0;
ok(ms < 120, `sheet generation ${ms.toFixed(1)}ms`);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
