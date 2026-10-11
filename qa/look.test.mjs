// Character look options (Node, no browser): the choice lists, the save check, creation, and that every choice draws a different sprite.
//   ROOT=$PWD/game/ node qa/look.test.mjs
import {createHash} from 'node:crypto';
const ROOT = (process.env.ROOT || new URL('../game/', import.meta.url).pathname).replace(/\/?$/, '/');
const A = await import(ROOT + 'appearance.js'), S = await import(ROOT + 'sprites.js'), J = await import(ROOT + 'journey.js');
const E = await import(ROOT + 'engine.js'), L = await import(ROOT + 'life.js');
let pass = 0, fail = 0; const ok = (c, m) => {if (c) pass++; else {fail++; console.log('  FAIL', m);}};
const NOW = 1e12;
const hash = a => {const sh = S.spriteSheet(a); return createHash('sha1').update(Buffer.from(sh.data.buffer, sh.data.byteOffset, sh.data.byteLength)).digest('hex');};
const hero = (o = {}) => ({kind: 'hero', classId: 'warrior', gender: 'female', skin: 'warm', hair: 'brown', name: 'Lena', outfit: 'traveler', ...o});

// ---- lists
for (const g of ['female', 'male']) ok(A.HAIR_STYLES[g].length >= 8 && new Set(A.HAIR_STYLES[g]).size === A.HAIR_STYLES[g].length, g + ' has at least eight distinct hairstyles');
ok(A.HAIR_COLORS.length >= 10 && A.HAIR_COLORS.slice(0, 5).join() === 'brown,black,silver,auburn,gold', 'ten hair colours, the original five first');
ok(A.EYE_COLORS.slice(0, 5).join() === 'brown,green,blue,amber,grey', 'the original five eye colours come first');
for (const k of A.ALL_HAIR_STYLES) ok(typeof A.HAIR_STYLE_NAMES[k] === 'string' && A.HAIR_STYLE_NAMES[k].length > 2, 'hairstyle has a name: ' + k);
for (const k of A.HAIR_COLORS) ok(A.HAIR_COLOR_NAMES[k], 'hair colour has a name: ' + k);
ok(!/hunger|nourish|focus|neighbor/i.test(JSON.stringify([A.HAIR_STYLE_NAMES, A.HAIR_COLOR_NAMES, A.EYE_COLOR_NAMES, A.FACE_MARK_NAMES, A.HEADWEAR_NAMES])), 'option names follow the wording rules');
ok(S.HAIR_STYLES === A.HAIR_STYLES, 'sprites re-exports the same style table');

// ---- every hairstyle draws, and each one is different from the others (per gender, three views come from one sheet)
for (const g of ['female', 'male', 'nonbinary']) {
  const seen = new Map();
  for (const st of A.HAIR_STYLES[g]) {
    const sh = S.spriteSheet(hero({gender: g, hairStyle: st}));
    ok(!!sh, `${g}/${st} draws`);
    const h = hash(hero({gender: g, hairStyle: st}));
    ok(!seen.has(h), `${g}/${st} looks different from ${seen.get(h)}`); seen.set(h, st);
  }
}
// a hairstyle that does not belong to the body is ignored, so a mismatched save still draws
ok(hash(hero({gender: 'female', hairStyle: 'topknot'})) === hash(hero({gender: 'female'})), 'a style for another body falls back to the default');
// no saved style: the same pick by name as before the choice existed (first four styles)
for (const [g, name] of [['female', 'Lena'], ['male', 'Orrin'], ['female', 'The Wayfarer'], ['male', 'Brannoch']]) {
  const sp = S.spriteFor(hero({gender: g, name}));
  ok(A.HAIR_STYLES[g].indexOf(sp.hairStyle) >= 0 && A.HAIR_STYLES[g].indexOf(sp.hairStyle) < A.DEFAULT_STYLES, `${g}/${name} default style is one of the original four (${sp.hairStyle})`);
}
// ---- hair colours, eyes, face marks, headwear each change the picture
{
  const seen = new Set();
  for (const c of A.HAIR_COLORS) {const h = hash(hero({hair: c})); ok(!seen.has(h), 'hair colour differs: ' + c); seen.add(h);}
  const eyes = new Set(); for (const c of A.EYE_COLORS) {const h = hash(hero({eyes: c})); ok(!eyes.has(h), 'eye colour differs: ' + c); eyes.add(h);}
  const marks = new Set(); for (const c of A.FACE_MARKS) {const h = hash(hero({face: c})); ok(!marks.has(h), 'face mark differs: ' + c); marks.add(h);}
  for (const skin of A.SKIN_TONES) for (const c of A.FACE_MARKS.slice(1)) ok(hash(hero({skin, face: c})) !== hash(hero({skin})), `face mark ${c} shows on ${skin}`);
  for (const classId of A.HEADWEAR_CALLINGS) ok(hash(hero({classId, headwear: 'bare'})) !== hash(hero({classId, headwear: 'worn'})), classId + ' bare head differs from worn');
  for (const classId of ['warrior', 'summoner']) ok(hash(hero({classId, headwear: 'bare'})) === hash(hero({classId})), classId + ' has no headwear to remove');
  ok(hash(hero({eyes: 'nonsense', face: 'x', headwear: 'x'})) === hash(hero()), 'unknown look values are ignored when drawing');
}
// with the hat or hood off, the chosen style shows
for (const classId of ['mage', 'ranger']) ok(hash(hero({classId, headwear: 'bare', hairStyle: 'twintails'})) !== hash(hero({classId, headwear: 'bare', hairStyle: 'bob'})), classId + ' bare head shows the chosen style');

// residents (named townspeople) keep the original four styles: the new ones are for the creation screen
{
  const st = E.fresh(1); L.upgrade(st); let n = 0, bad = [];
  for (const r of st.actors) {const sp = S.spriteFor({...r}); if (!sp || sp.type !== 'human') continue; n++; const ix = A.HAIR_STYLES[sp.gender].indexOf(sp.hairStyle); if (ix < 0 || ix >= A.DEFAULT_STYLES) bad.push(r.name + ':' + sp.hairStyle);}
  ok(n > 60 && bad.length === 0, `${n} residents use only the original four hairstyles ${bad.slice(0, 5)}`);
}
// the classic 3D builder knows every hair colour the creation screen offers
{
  const src = (await import('node:fs')).readFileSync(ROOT + 'characters.js', 'utf8');
  for (const c of A.HAIR_COLORS) ok(new RegExp(c + ":'#[0-9a-f]{6}'").test(src), '3D look has a colour for ' + c + ' hair');
}
// the knocked-out pose: tall knots and curls are drawn as their flat cousins, so nothing runs off the frame
{
  const ko = o => {const sh = S.spriteSheet(hero(o)), col = S.frameIndex('down', 0), f = new Uint8Array(sh.w * sh.h * 4); for (let y = 0; y < sh.h; y++) f.set(sh.data.subarray(((0 * sh.h + y) * sh.w * sh.cols + col * sh.w) * 4, ((0 * sh.h + y) * sh.w * sh.cols + col * sh.w + sh.w) * 4), y * sh.w * 4); return createHash('sha1').update(f).digest('hex');};
  ok(ko({gender: 'male', hairStyle: 'topknot', name: 'KO'}) === ko({gender: 'male', hairStyle: 'tied', name: 'KO'}), 'knocked out, a topknot is drawn as tied-back hair');
  ok(ko({gender: 'male', hairStyle: 'curls', name: 'KO'}) === ko({gender: 'male', hairStyle: 'short', name: 'KO'}), 'knocked out, curls are drawn as short hair');
  ok(ko({gender: 'male', hairStyle: 'mane', name: 'KO'}) !== ko({gender: 'male', hairStyle: 'short', name: 'KO'}), 'other styles still differ when knocked out');
}

// ---- saves
const fresh = () => {const s = E.fresh(NOW); L.upgrade(s); J.upgrade(s); return s;};
{
  const s = fresh(); const msg = J.create(s, {name: 'Tester', classId: 'warrior'});
  ok(s.journey.created && E.valid(s), 'creation without any look option still works: ' + msg);
  ok(['hairStyle', 'eyes', 'face', 'headwear'].every(k => !(k in s.player)), 'unset look options are not written to the save');
}
{
  const s = fresh(); const msg = J.create(s, {name: 'Tester', classId: 'mage', gender: 'male', hair: 'violet', hairStyle: 'curls', eyes: 'teal', face: 'scar', headwear: 'bare'});
  ok(s.journey.created, 'creation with every look option: ' + msg);
  ok(s.player.hairStyle === 'curls' && s.player.eyes === 'teal' && s.player.face === 'scar' && s.player.headwear === 'bare' && s.player.hair === 'violet', 'the choices are stored on the player');
  ok(E.valid(s), 'a save with look options is valid');
  const back = JSON.parse(JSON.stringify(s)); ok(E.valid(back) && back.player.hairStyle === 'curls', 'look options survive a save round trip');
  ok(!!S.spriteSheet({...back.player, id: 'player', type: 'hero'}), 'the saved player record draws');
}
for (const [bad, why] of [[{hairStyle: 'mohawk'}, 'unknown hairstyle'], [{eyes: 'red'}, 'unknown eye colour'], [{face: 'tattoo'}, 'unknown face mark'], [{headwear: 'crown'}, 'unknown headwear'], [{hair: 'green'}, 'unknown hair colour'], [{gender: 'male', hairStyle: 'long'}, 'a style from the other body']]) {
  const s = fresh(); const msg = J.create(s, {name: 'Tester', classId: 'warrior', ...bad});
  ok(!s.journey.created && /Choose/.test(msg), `creation refuses ${why}`);
}
// a saved game from before the options existed stays valid, whatever its hair colour
for (const hair of ['black', 'brown', 'silver', 'auburn', 'gold']) {const s = fresh(); J.create(s, {name: 'Old', classId: 'ranger', companionId: 'ash-wolf', hair}); ok(E.valid(s), 'old-style save with ' + hair + ' hair is valid');}
{ // tampered values in a loaded save are caught
  for (const [k, v] of [['hairStyle', 'bad'], ['eyes', 'bad'], ['face', 'bad'], ['headwear', 'bad'], ['hair', 'bad']]) {const s = fresh(); J.create(s, {name: 'T', classId: 'warrior'}); s.player[k] = v; ok(!E.valid(s), 'a save with an unknown ' + k + ' is refused');}
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
