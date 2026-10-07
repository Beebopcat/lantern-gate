// Sprite lab: headless contact sheets of the code-drawn pixel sprites.
// Usage: node sprite-lab.mjs [outDir] [only]   (writes <name>-1x.png and <name>-6x.png)
import {Sheet} from './png.mjs';
import {mkdirSync} from 'node:fs';
const ROOT = process.env.ROOT || new URL('../game/', import.meta.url).pathname;
const S = await import(ROOT + 'sprites.js');
const out = process.argv[2] || new URL('./sprites/', import.meta.url).pathname, only = process.argv[3] || '';
mkdirSync(out, {recursive: true});
const BG = [58, 70, 74, 255], BG2 = [66, 80, 84, 255];

function frame(actor, dir, pose, f) {
  const sh = S.spriteSheet(actor); if (!sh) return null;
  const col = S.frameIndex(pose, f), row = S.DIRS.indexOf(dir), w = sh.w, h = sh.h, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) d.set(sh.data.subarray(((row * h + y) * w * sh.cols + col * w) * 4, ((row * h + y) * w * sh.cols + col * w + w) * 4), y * w * 4);
  return {w, h, d};
}
// grid: rows of cells [{actor, dir, pose, f}]
function sheet(name, rows, pad = 2) {
  if (only && !name.includes(only)) return;
  const cells = rows.map(r => r.map(c => c && frame(c.actor, c.dir || 'down', c.pose || 'idle', c.f || 0)));
  const cw = Math.max(...cells.flat().filter(Boolean).map(c => c.w)), ch = Math.max(...cells.flat().filter(Boolean).map(c => c.h));
  const cols = Math.max(...rows.map(r => r.length)), W = cols * (cw + pad) + pad, H = rows.length * (ch + pad) + pad, s = new Sheet(W, H, [30, 34, 44, 255]);
  cells.forEach((r, j) => r.forEach((c, i) => {
    const x = pad + i * (cw + pad), y = pad + j * (ch + pad);
    s.fill(x, y, cw, ch, (i + j) % 2 ? BG : BG2);
    if (c) s.blit(c.d, c.w, c.h, x + Math.floor((cw - c.w) / 2), y + ch - c.h, 1);
  }));
  s.save(`${out}/${name}-1x.png`); s.scaled(6).save(`${out}/${name}-6x.png`);
  console.log('wrote', name, W + 'x' + H);
}
const hero = (classId, gender = 'female', skin = 'warm', hair = 'brown', outfit = 'traveler', name = 'Tester') => ({kind: 'hero', classId, gender, skin, hair, outfit, name});
const CLASSES = ['warrior', 'mage', 'ranger', 'summoner'], GENDERS = ['female', 'male', 'nonbinary'];
const DIR3 = ['down', 'left', 'up', 'right'];
// 1. classes x genders, four directions idle
sheet('heroes', CLASSES.flatMap(c => GENDERS.map(g => DIR3.map(d => ({actor: hero(c, g, ['warm', 'deep', 'pale'][GENDERS.indexOf(g)], ['brown', 'black', 'gold'][GENDERS.indexOf(g)], ['traveler', 'burgundy', 'royal'][GENDERS.indexOf(g)], g + c), dir: d}))))
  .reduce((rows, r, i) => {if (i % 3 === 0) rows.push([]); rows[rows.length - 1].push(...r, null); return rows;}, []));
// 2. variety: skins x hair x outfits
const SKINS = ['warm', 'earth', 'deep', 'pale', 'olive'], HAIRS = ['brown', 'black', 'silver', 'auburn', 'gold'], OUTFITS = ['traveler', 'burgundy', 'royal', 'gold', 'forest'];
sheet('variety', [0, 1, 2, 3].map(r => SKINS.map((s, i) => ({actor: hero(CLASSES[(r + i) % 4], GENDERS[(r * 2 + i) % 3], s, HAIRS[(i + r) % 5], OUTFITS[(i + r * 2) % 5], 'Name' + r + i)}))));
// 2b. hairstyles: each gender with names that hit every style
const names = {}; for (const g of GENDERS) {names[g] = []; for (let i = 0; names[g].length < 4 && i < 400; i++) {const sp = S.spriteFor(hero('warrior', g, 'warm', 'auburn', 'traveler', 'N' + i)); if (!names[g].some(n => S.spriteFor(hero('warrior', g, 'warm', 'auburn', 'traveler', n)).hairStyle === sp.hairStyle)) names[g].push('N' + i);}}
sheet('hair', GENDERS.map(g => names[g].flatMap(n => ['down', 'left', 'up'].map(d => ({actor: hero('summoner', g, 'olive', ['auburn', 'silver', 'black'][GENDERS.indexOf(g)], 'forest', n), dir: d})))));
// 3. animation: all poses per class, down + left
for (const c of CLASSES) sheet('anim-' + c, ['down', 'left', 'up'].map(d => S.POSES.flatMap(p => Array.from({length: S.POSE_FRAMES[p]}, (_, f) => ({actor: hero(c, 'female', 'warm', 'brown', 'traveler', 'Tester'), dir: d, pose: p, f})))));
// 4. NPCs and other kinds, if the generator knows them
const npcRoles = ['keeper', 'scholar', 'smith', 'healer', 'baker', 'farmer', 'merchant', 'guard', 'ranger', 'innkeeper'];
const npcs = npcRoles.map((role, i) => ({id: 'n' + i, type: 'npc', role, name: ['Mara', 'Galen', 'Bram', 'Nell', 'Edda', 'Orin', 'Wren', 'Corin', 'Jory', 'Ada'][i]}));
if (npcs.some(n => S.spriteFor(n))) sheet('npcs', [npcs.map(n => ({actor: n})), npcs.map(n => ({actor: n, dir: 'left'})), npcs.map(n => ({actor: n, dir: 'up'}))]);
const kinds = ['ember-imp', 'bone-squire', 'gloam-wisp', 'moss-golem', 'ash-wolf', 'thorn-boar', 'dusk-lynx', 'gale-hawk'];
const comps = kinds.map(k => ({id: 'guardian', type: 'guardian', kind: k, name: k}));
if (comps.some(n => S.spriteFor(n))) sheet('companions', ['down', 'left', 'up'].map(d => comps.map(a => ({actor: a, dir: d}))).concat([comps.map(a => ({actor: a, dir: 'left', pose: 'walk', f: 1})), comps.map(a => ({actor: a, dir: 'left', pose: 'attack', f: 1}))]));
const foes = ['wolf', 'goblin', 'troll', 'ghost', 'skeleton', 'zombie', 'thief', 'bandit', 'sentinel'].map(k => ({id: 'e-' + k, type: 'enemy', kind: k, name: k}));
if (foes.some(n => S.spriteFor(n))) sheet('enemies', ['down', 'left', 'up'].map(d => foes.map(a => ({actor: a, dir: d}))).concat([foes.map(a => ({actor: a, dir: 'left', pose: 'attack', f: 1})), foes.map(a => ({actor: a, dir: 'down', pose: 'down'}))]));
const pets = ['dog', 'cat', 'fox'].map(k => ({id: 'p-' + k, type: 'pet', kind: k, name: k}));
if (pets.some(n => S.spriteFor(n))) sheet('pets', ['down', 'left', 'up'].map(d => pets.map(a => ({actor: a, dir: d}))).concat([pets.map(a => ({actor: a, dir: 'left', pose: 'walk', f: 1}))]));
// 5. residents in the daily wardrobe and in festival costumes
const WD = await import(ROOT + 'wardrobe.js');
const looks = [...WD.DAILY_OUTFITS.map(l => ({...l, festive: false, key: 'daily:' + l.id})), ...WD.HALLOWEEN_COSTUMES.map(l => ({...l, festive: true, key: 'costume:' + l.id}))];
const people = ['Mara', 'Galen', 'Bram', 'Nell', 'Edda', 'Orin', 'Wren', 'Corin', 'Jory', 'Ada', 'Iona', 'Vesper', 'Holt', 'Sella', 'Fenn'];
const roles = ['keeper', 'scholar', 'smith', 'healer', 'baker', 'farmer', 'merchant', 'guard', 'ranger', 'innkeeper', 'clergy', 'miner', 'keeper', 'merchant', 'scholar'];
const wardRows = []; for (let i = 0; i < looks.length; i += 15) wardRows.push(looks.slice(i, i + 15).map((w, j) => ({actor: {id: 'w' + i + j, type: 'npc', name: people[j], role: roles[(i / 15 + j) % roles.length], wardrobe: w}})));
sheet('wardrobe', wardRows);
const mythic = [{id: 'castle-frankenstein', name: 'Frankenstein', role: 'creation', type: 'mythic', gender: 'male'}, {id: 'castle-dracula', name: 'Dracula', role: 'count', type: 'mythic', gender: 'male'}];
sheet('mythic', ['down', 'left', 'up'].map(d => mythic.map(a => ({actor: a, dir: d}))));
