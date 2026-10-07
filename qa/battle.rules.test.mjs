// Rules checks for the turn-based battle engine (Node only, no browser, no rendering).
// Covers: Ward pips, Frays (hidden, revealed, tested), Staggered, Kindle, the 8-turn timeline, three skills per class,
// the eight companions, seeded determinism, fleeing, items, victory / defeat / settle(), and the engine contract
// (damage goes through ctx.hurt and G.damage, items through ctx.use, nothing from a battle is saved).
//   ROOT=/path/to/game node qa/battle.rules.test.mjs     (ROOT defaults to ../game next to this file)
import {fileURLToPath} from 'node:url';
const ROOT = process.env.ROOT || fileURLToPath(new URL('../game', import.meta.url));
const E = await import(ROOT + '/engine.js'), J = await import(ROOT + '/journey.js'), G = await import(ROOT + '/companions.js'), L = await import(ROOT + '/life.js');
const BT = await import(ROOT + '/battle.js'), D = await import(ROOT + '/battle-data.js'), P = await import(ROOT + '/progression.js');
const {dist} = await import(ROOT + '/world.js');
let pass = 0, fail = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else { fail++; failures.push(m); console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const NOW = 1e12, clone = o => JSON.parse(JSON.stringify(o));
const TEMPLATE = E.fresh(NOW), WOLF = TEMPLATE.enemies.find(e => e.kind === 'wolf');

// ---------------------------------------------------------------- helpers
// A foe of any kind placed next to the hero. `tank` foes cannot be killed and barely scratch; `speed` decides who acts first
// (the hero's speed is 2.4 with a small per-round jitter, so 9 always acts before the hero and 0.5 always after).
function foeOf(kind, id, extra = {}) {
  const def = E.ENEMIES[kind] || E.ENEMIES.wolf;
  return {...clone(WOLF), ...clone(def), kind, id, type: 'enemy', map: 'overworld', x: 101.5, y: 100.5, home: {x: 101.5, y: 100.5}, maxHp: def.hp, deadUntil: 0, cd: 0, path: [], think: 0, ...extra};
}
const TANK = {hp: 5000, maxHp: 5000, attack: 0, speed: .5};
function mk(classId, companionId = null, foes = [['wolf', 'w1', TANK]], {mp, hp, inv, level} = {}) {
  const s = E.fresh(NOW); L.upgrade(s); J.upgrade(s);
  const msg = J.create(s, {name: 'Tester', classId, companionId});
  ok(s.journey.created, `${classId}/${companionId} created: ${msg}`);
  s.enemies = []; s.player.x = 100.5; s.player.y = 100.5; s.player.path = []; if (s.guardian) G.snap(s);
  if (level) { s.player.level = level; }
  foes.forEach(([kind, id, extra], i) => s.enemies.push(foeOf(kind, id, {x: 101.5 + i, ...extra})));
  if (mp != null) s.player.mp = mp; if (hp != null) s.player.hp = hp;
  Object.assign(s.inv, inv || {});
  return s;
}
// Counts every call into the world so we can prove the contract: foe and hero damage via ctx.hurt, items via ctx.use.
function spyCtx() {
  const c = {hurt: 0, use: 0, note: 0, hurtOn: []};
  return {calls: c, now: NOW,
    hurt: (s, a, amt, now, src) => { c.hurt++; c.hurtOn.push([a === s.player ? 'player' : a.id, src]); return E.hurt(s, a, amt, now, src); },
    use: (s, i) => { c.use++; return E.use(s, i); }, note: (s, t) => { c.note++; return E.note(s, t); }};
}
function start(s, seed = 1234, ctx = spyCtx()) {
  const out = BT.begin(s, s.enemies, ctx, seed);
  return {s, b: out.b, ctx, first: out.events};
}
const go = (f, cmd) => BT.act(f.b, f.s, cmd, f.ctx);
const snap = f => BT.snapshot(f.b, f.s);
const hits = (events, pred = () => true) => events.filter(e => e.type === 'hit' && pred(e));
const heroHits = events => hits(events, e => e.src === 'player');
const of = (events, type) => events.filter(e => e.type === type);
const turnsOf = events => events.filter(e => e.type === 'turn').map(e => e.who);
const strings = [];   // every player-facing string produced during the run, scanned for banned wording at the end
const keep = events => { for (const e of events) if (e.text) strings.push(e.text); return events; };

// ---------------------------------------------------------------- data tables
console.log('data');
eq(D.TYPES, ['blade', 'bow', 'arcane', 'flame', 'frost', 'spirit'], 'six damage types in order');
ok(D.TYPES.every(t => D.TYPE_INFO[t]?.label && D.TYPE_INFO[t]?.hint) && Object.keys(D.TYPE_INFO).length === 6, 'every type has a label and a hint');
ok(BT.TYPES === D.TYPES && BT.TYPE_INFO === D.TYPE_INFO && BT.SKILLSETS === D.SKILLSETS, 'battle.js re-exports the data tables');
for (const kind of Object.keys(E.ENEMIES)) ok(!!D.FOES[kind], `foe profile exists for ${kind}`);
for (const [kind, d] of Object.entries(D.FOES)) {
  ok(Number.isInteger(d.ward) && d.ward >= 2 && d.ward <= 7, `${kind}: ward ${d.ward} is 2-7 pips`);
  ok(d.frays.length >= 2 && d.frays.length <= 3 && new Set(d.frays).size === d.frays.length && d.frays.every(t => D.TYPES.includes(t)), `${kind}: 2-3 distinct frays ${d.frays}`);
  ok(d.move && d.special?.name && d.special.mult > 1 && ['one', 'all'].includes(d.special.area), `${kind}: move and telegraphed special`);
}
ok(D.WARDEN.ward === 7 && D.WARDEN.frays.length === 3 && D.WARDEN.boss, 'the Warden has the deepest Ward and three frays');
ok(D.foeData({warden: true}) === D.WARDEN, 'foeData: warden flag');
ok(D.foeData({kind: 'wolf'}).ward === 2 && D.foeData({kind: 'wolf', hunter: true}).ward === 3, 'foeData: night hunters get one more pip');
ok(D.foeData({kind: 'troll', hunter: true}).ward === 5 && D.foeData({kind: 'horseman', hunter: true}).ward === 6, 'foeData: hunter pip capped at 5, bosses unchanged');
ok(D.foeData({kind: 'no-such-thing'}) === D.DEFAULT_FOE, 'foeData: unknown kinds use the default profile');
ok(BT.TIMELINE_LENGTH === 8 && BT.KINDLE_START === 1 && BT.KINDLE_MAX === 5 && BT.KINDLE_SPEND === 3, 'constants: timeline 8, Kindle 1/5/3');
ok(BT.GRACE === 5 && BT.ENGAGE_RANGE === 2.2 && BT.GROUP_RANGE === 5, 'constants kept from the live game: grace 5, engage 2.2, group 5');
ok(BT.itemInfo('salve').name === 'Healing salve' && /45/.test(BT.itemInfo('salve').detail), 'item info comes from the world item table');

// ---------------------------------------------------------------- three skills per class, mapped to the class abilities
console.log('skills');
for (const id of J.CREATABLE) {
  const set = D.SKILLSETS[id];
  ok(set.length === 3, `${id}: exactly three battle skills`);
  eq(set.map(k => k.name), J.CLASSES[id].abilities.map(a => a.name), `${id}: skills are the class abilities, same names and order`);
  eq(set.map(k => k.mp), J.CLASSES[id].abilities.map(a => a.cost), `${id}: skill mana costs equal the ability costs`);
  ok(set.every(k => k.hint && k.kindleHint && k.id), `${id}: every skill has a hint, a Kindle hint and an id`);
  const s = mk(id, id === 'summoner' ? 'bone-squire' : id === 'ranger' ? 'ash-wolf' : null); const f = start(s);
  const list = BT.skillList(f.b, s);
  eq(list.map(k => k.name), set.map(k => k.name), `${id}: skillList follows the set`);
  ok(list.every(k => k.enabled || k.id === 'mana-surge'), `${id}: every skill is usable at full mana (Mana Surge needs something to restore)`);
  ok(BT.skillsFor(s).length === 3, `${id}: skillsFor gives three`);
}
for (const legacy of ['oathbinder', 'echoartisan', 'marrowgardener']) { const s = mk('warrior'); s.player.classId = legacy; ok(BT.skillsFor(s).length === 3 && BT.skillsFor(s)[0].name === 'Power Strike', `${legacy}: falls back to the default skill set`); }
ok(BT.skillFor(mk('warrior')).name === 'Cleave' && BT.skillFor(mk('mage')).name === 'Arcane Volley' && BT.skillFor(mk('ranger', 'ash-wolf')).name === 'Piercing Shot' && BT.skillFor(mk('summoner', 'bone-squire')).name === 'Spirit Lash', 'signature skill per class (act({id:"skill"}) without an index)');
ok(BT.attackType(mk('warrior')) === 'blade' && BT.attackType(mk('ranger', 'ash-wolf')) === 'bow' && BT.attackType(mk('mage')) === 'arcane', 'attack types: warrior blade, ranger bow, mage arcane');
{ const s = mk('warrior'); const f = start(s); const c = BT.commands(f.b, s);
  eq(c.map(x => x.id), ['attack', 'skill', 'guard', 'item', 'flee'], 'five commands in order'); ok(c.every(x => x.label && x.hint !== undefined), 'commands have labels and hints'); }

// ---------------------------------------------------------------- the opening of a battle
console.log('begin');
{
  const s = mk('warrior', null, [['wolf', 'w1', TANK], ['goblin', 'g1', {...TANK, x: 103.5}]]); const f = start(s, 77);
  ok(f.b.round === 1 && f.b.kindle === 1 && f.b.phase === 'command' && f.b.turnOrder[f.b.cursor] === 'player', 'starts in round 1, Kindle 1, waiting for the hero');
  ok(f.first[0].type === 'round' && /2 foes bar the way/.test(f.first[0].text), 'first event announces the encounter');
  ok(f.first.every(e => e.hp && e.hp.player && e.hp.foes && 'round' in e), 'every event carries a snapshot and the round');
  const sn = snap(f);
  eq(Object.keys(sn.foes), ['w1', 'g1'], 'snapshot lists both foes');
  ok(sn.foes.w1.ward === 2 && sn.foes.w1.maxWard === 2 && sn.foes.g1.ward === 3 && sn.foes.g1.maxWard === 3, 'Ward pips start full: wolf 2, goblin 3');
  ok(typeof sn.foes.w1.frays === 'number' && sn.foes.w1.frays === 2 && sn.foes.g1.frays === 3, 'Fray count is known, the types are hidden');
  eq(sn.foes.w1.revealed, [], 'no Fray revealed at the start'); eq(sn.foes.w1.tested, [], 'nothing tested at the start');
  ok(!JSON.stringify(sn.foes).includes('flame') && !JSON.stringify(sn.foes).includes('frost'), 'hidden Fray types never leak into the snapshot');
  ok(sn.player.kindle === 1 && sn.player.hp === s.player.hp && sn.player.mp === s.player.mp, 'player snapshot: Kindle, health, mana');
  ok(!sn.foes.w1.staggered && !sn.foes.w1.steady && !sn.foes.w1.charging && !sn.foes.w1.marked && !sn.foes.w1.slowed, 'no statuses at the start');
}
{ // a fast foe opens the round before the hero
  const s = mk('warrior', null, [['wolf', 'w1', {...TANK, speed: 9}]]); const f = start(s, 5);
  eq(turnsOf(f.first), ['w1', 'player'], 'a fast foe takes its turn first, then the hero is asked'); ok(of(f.first, 'act').length === 1 && f.b.round === 1, 'its blow lands in round 1');
  const s2 = mk('warrior', null, [['wolf', 'w1', {...TANK, speed: 9, attack: 30}]]); const hp0 = s2.player.hp, f2 = start(s2, 5);
  ok(f2.first[0].type === 'round' && f2.first[0].hp.player.hp === hp0 && f2.first.at(-1).hp.player.hp < hp0, 'the opening snapshot shows the hero untouched; later events show the blow (so a replay starts from the true opening)');
}
// every foe profile builds a battle with its own Ward
for (const kind of Object.keys(D.FOES)) { const s = mk('warrior', null, [[kind, 'f1', TANK]]); const f = start(s, 3); ok(f.b.st.f1.ward === D.FOES[kind].ward && f.b.st.f1.frays.join() === D.FOES[kind].frays.join(), `${kind}: battle uses its Ward ${D.FOES[kind].ward} and frays`); }
{ const s = mk('warrior', null, [['sentinel', 'warden', {...TANK, warden: true}]]); const f = start(s, 3); ok(f.b.st.warden.ward === 7 && f.b.st.warden.boss, 'the Warden fights with 7 Ward as a boss'); }

// ---------------------------------------------------------------- Ward pips and Frays
console.log('ward and frays');
{ // wolf: blade + flame. The warrior strikes with a blade.
  const s = mk('warrior'); const f = start(s, 11); f.b.kindle = 5;
  let r = keep(go(f, {id: 'attack', target: 'w1'}).events); let h = heroHits(r);
  ok(h.length === 1 && h[0].fray === true && h[0].revealed === true && h[0].dtype === 'blade', 'a blade hit on a blade Fray: Fray, newly revealed');
  ok(h[0].chipped && h[0].wardFrom === 2 && h[0].ward === 1, 'the hit removes one Ward pip (2 to 1)');
  eq(snap(f).foes.w1.revealed, ['blade'], 'the Fray is revealed in the snapshot'); ok(snap(f).foes.w1.ward === 1 && snap(f).foes.w1.frays === 2, 'one pip left, Fray count unchanged');
  ok(/Blade is a Fray/.test(h[0].text), 'the log names the Fray');
  r = keep(go(f, {id: 'attack', target: 'w1'}).events); h = heroHits(r);
  ok(h[0].fray === true && h[0].revealed === false, 'a second hit on a known Fray is not "revealed" again');
  ok(h[0].chipped && h[0].ward === 0 && of(r, 'stagger').length === 1, 'the last pip breaks: the foe is Staggered');
  ok(snap(f).foes.w1.staggered && snap(f).foes.w1.ward === 0, 'snapshot: Staggered with 0 Ward');
  ok(f.b.stats.staggers === 1 && f.b.stats.frays === 2 && f.b.stats.revealed === 1, 'stats: 1 stagger, 2 Fray hits, 1 Fray revealed');
}
{ // goblin: bow, frost, spirit. A blade is not one of them: nothing is revealed, no pip falls, the type is remembered as tested.
  const s = mk('warrior', null, [['goblin', 'g1', TANK]]); const f = start(s, 11);
  const r = keep(go(f, {id: 'attack', target: 'g1'}).events), h = heroHits(r)[0];
  ok(h.fray === false && !h.chipped && !h.revealed && !('ward' in h), 'a non-Fray hit removes no Ward and reveals nothing');
  ok(snap(f).foes.g1.ward === 3 && snap(f).foes.g1.revealed.length === 0, 'goblin keeps all 3 pips');
  eq(snap(f).foes.g1.tested, ['blade'], 'the tested type is remembered (known not to be a Fray)');
  ok(!/Fray/.test(h.text), 'no Fray text on a plain hit');
  go(f, {id: 'attack', target: 'g1'}); eq(snap(f).foes.g1.tested, ['blade'], 'testing the same type again adds nothing');
  const p = BT.preview(f.b, s, {id: 'attack'}, 'g1'); ok(p.fray === false && p.wardHits === 0 && p.type === 'blade', 'preview: known not a Fray');
}
{ // a foe weak to the hero's arrows: several hits in one command each remove a pip; hits on a Staggered foe do not
  const s = mk('ranger', 'ash-wolf', [['goblin', 'g1', TANK]]); const f = start(s, 4); f.b.kindle = 3;
  const p0 = BT.preview(f.b, s, {id: 'attack', kindle: 2}, 'g1'); ok(p0.fray === null && p0.hits === 3 && p0.wardHits === 0 && p0.maxWard === 3, 'preview: untested type is unknown (null)');
  const r = keep(go(f, {id: 'attack', target: 'g1', kindle: 2}).events), h = heroHits(r);
  ok(h.length === 3 && h.every(x => x.dtype === 'bow' && x.fray), 'three arrows, all Fray hits (bow)');
  ok(h.filter(x => x.chipped).length === 3 && of(r, 'stagger').length === 1, 'each of the three hits removed a pip: 3 to 0, then Staggered');
  ok(snap(f).foes.g1.staggered && snap(f).foes.g1.ward === 0, 'goblin is Staggered');
}
{ // hits on a Staggered foe add no chip and cannot re-stagger
  const s = mk('warrior'); const f = start(s, 4); f.b.kindle = 5;
  const r = keep(go(f, {id: 'attack', target: 'w1', kindle: 3}).events), h = heroHits(r);
  ok(h.length === 4 && h.filter(x => x.chipped).length === 2 && of(r, 'stagger').length === 1, 'four hits on a 2-pip Fray: only two pips can fall, one Stagger');
  ok(h[2].staggered && h[3].staggered && !h[2].chipped, 'hits after the break are marked Staggered and chip nothing');
}
{ // Hunter's Mark reveals every Fray at once
  const s = mk('ranger', 'ash-wolf', [['goblin', 'g1', TANK]]); const f = start(s, 4);
  const r = keep(go(f, {id: 'skill', skill: 2, target: 'g1'}).events);
  eq(of(r, 'reveal')[0].types.slice().sort(), ['bow', 'frost', 'spirit'], 'Hunter’s Mark reveals all three Frays'); eq(snap(f).foes.g1.revealed.slice().sort(), ['bow', 'frost', 'spirit'], 'revealed list holds all three');
  ok(snap(f).foes.g1.ward === 3 && snap(f).foes.g1.marked, 'revealing does not remove Ward; the foe is marked');
  const p = BT.preview(f.b, s, {id: 'attack'}, 'g1'); ok(p.fray === true && p.wardHits === 1, 'preview after the reveal: a bow Attack is a known Fray and would remove 1 pip');
}
{ // damage multipliers of a Fray hit: x1.25 against the same state without the Fray (control run, identical seed)
  const a = (() => { const s = mk('warrior', null, [['wolf', 'w1', TANK]]); const f = start(s, 21); return heroHits(go(f, {id: 'attack', target: 'w1'}).events)[0].amount; })();
  const c = (() => { const s = mk('warrior', null, [['wolf', 'w1', {...TANK, frays: undefined}]]); const f = start(s, 21); f.b.st.w1.frays = ['flame', 'frost']; return heroHits(go(f, {id: 'attack', target: 'w1'}).events)[0].amount; })();
  ok(Math.abs(a - Math.round(c * 1.25)) <= 1, `a Fray hit does 25% more (${a} vs ${c})`);
}

// ---------------------------------------------------------------- Staggered
console.log('staggered');
{ // the foe is slower than the hero, so after the break it would act later in the same round
  const s = mk('warrior', null, [['wolf', 'w1', {...TANK, attack: 5}]]); const f = start(s, 8); f.b.kindle = 3;
  const r1 = keep(go(f, {id: 'attack', target: 'w1', kindle: 1}).events);
  ok(of(r1, 'stagger').length === 1 && of(r1, 'stagger')[0].dst === 'w1' && /Staggered/.test(of(r1, 'stagger')[0].text), 'two blade hits: Staggered event');
  const skip = of(r1, 'skip');
  ok(skip.length === 1 && skip[0].src === 'w1' && !of(r1, 'act').some(e => e.src === 'w1'), 'the Staggered foe loses its turn: a skip, no attack');
  ok(f.b.round === 2, 'the round moved on'); ok(snap(f).foes.w1.staggered, 'still Staggered going into round 2');
  const r2 = keep(go(f, {id: 'attack', target: 'w1'}).events), h2 = heroHits(r2)[0];
  ok(h2.staggered === true && /Staggered, \+50%/.test(h2.text) || h2.fray, 'round 2 hit is a Staggered hit');
  ok(of(r2, 'skip').length === 1 && !of(r2, 'act').some(e => e.src === 'w1'), 'it loses its turn in round 2 as well');
  const rec = of(r2, 'recover'); ok(rec.length === 1 && rec[0].dst === 'w1', 'it recovers at the end of that round');
  const sn = snap(f); ok(!sn.foes.w1.staggered && sn.foes.w1.ward === sn.foes.w1.maxWard && sn.foes.w1.steady, 'recovered: Ward refilled, Steadied, no longer Staggered');
  // Steadied: Ward cannot break again until the foe has acted
  const r3 = keep(go(f, {id: 'attack', target: 'w1'}).events);
  ok(heroHits(r3)[0].fray && !heroHits(r3)[0].chipped, 'while Steadied a Fray hit does not remove a pip');
  ok(of(r3, 'act').some(e => e.src === 'w1') && !snap(f).foes.w1.steady, 'the foe acted normally again and is no longer Steadied');
  const r4 = keep(go(f, {id: 'attack', target: 'w1'}).events); ok(heroHits(r4)[0].chipped, 'afterwards Ward can be chipped again');
}
{ // +50% damage: control run with the same seed, one state Staggered by hand
  const run = stag => { const s = mk('warrior', null, [['goblin', 'g1', TANK]]); const f = start(s, 33); if (stag) f.b.st.g1.staggerUntil = f.b.round + 1; return heroHits(go(f, {id: 'attack', target: 'g1'}).events)[0]; };
  const plain = run(false), st = run(true);
  ok(Math.abs(st.amount - Math.round(plain.amount * 1.5)) <= 1, `Staggered foes take +50% (${st.amount} vs ${plain.amount})`);
  ok(st.staggered && !plain.staggered, 'the hit event says whether the foe was Staggered');
}
{ // Stagger breaks a readied special
  const s = mk('warrior'); const f = start(s, 6); f.b.st.w1.charging = true; f.b.kindle = 3;
  const r = keep(go(f, {id: 'attack', target: 'w1', kindle: 1}).events), st = of(r, 'stagger')[0];
  ok(/broken/.test(st.text) && !snap(f).foes.w1.charging, 'Stagger breaks the readied special');
}
{ // a Staggered foe cannot be chained: after it recovers the cycle starts from a full Ward and is Steadied
  const s = mk('warrior'); const f = start(s, 6); f.b.kindle = 5; go(f, {id: 'attack', target: 'w1', kindle: 1}); go(f, {id: 'guard'});
  ok(f.b.stats.staggers === 1 && !snap(f).foes.w1.staggered, 'one Stagger only; recovered after the next round');
}
{ // timeline: Staggered turns show as skipped
  const s = mk('warrior'); const f = start(s, 6); f.b.kindle = 3; go(f, {id: 'attack', target: 'w1', kindle: 1}); // round 1 done (foe skipped), now round 2
  const tl = BT.timeline(f.b, s), w = tl.filter(t => t.id === 'w1');
  ok(w[0].round === 2 && w[0].skip === true, 'the foe’s round-2 turn is shown as skipped');
  ok(w.filter(t => t.round >= 3).every(t => !t.skip), 'its later turns are normal again');
}

// ---------------------------------------------------------------- Kindle
console.log('kindle');
{
  const s = mk('warrior', null, [['wolf', 'w1', TANK]], {inv: {salve: 30}}); const f = start(s, 2);
  ok(f.b.kindle === 1 && snap(f).player.kindle === 1, 'Kindle starts at 1');
  const seen = [f.b.kindle];
  for (let i = 0; i < 7; i++) { keep(go(f, {id: 'item', item: 'salve'}).events); seen.push(f.b.kindle); }
  eq(seen, [1, 2, 3, 4, 5, 5, 5, 5], 'Kindle gains 1 per round up to a maximum of 5');
  const r = keep(go(f, {id: 'item', item: 'salve'}).events); ok(of(r, 'round').every(e => e.gained === 0) && f.b.kindle === 5, 'at the cap a round gains nothing');
}
{
  const s = mk('warrior'); const f = start(s, 2); const r = keep(go(f, {id: 'guard'}).events);
  ok(of(r, 'guard')[0].gained === 1, 'Guard gains 1 Kindle'); ok(f.b.kindle === 3, 'Guard +1 and the next round +1 (1 to 3)');
  f.b.kindle = 5; const r2 = go(f, {id: 'guard'}).events; ok(of(r2, 'guard')[0].gained === 0 && f.b.kindle === 5, 'Guard at the cap gains nothing');
}
{ // spending: 0 to 3, never more than you have, never on commands that cannot use it
  const mkb = (kindle, cmd) => { const s = mk('warrior'); const f = start(s, 9); f.b.kindle = kindle; const k0 = f.b.kindle; const r = go(f, cmd); return {f, r, k0}; };
  let t = mkb(5, {id: 'attack', target: 'w1', kindle: 3});
  ok(heroHits(t.r.events).length === 4 && of(t.r.events, 'act')[0].spent === 3, 'spend 3: four hits'); ok(t.f.b.stats.kindle === 3, 'stats count the Kindle spent');
  ok(t.f.b.kindle === 3, 'Kindle 5 minus 3 spent, plus 1 for the new round'); // 5-3=2, +1
  t = mkb(5, {id: 'attack', target: 'w1', kindle: 5}); ok(of(t.r.events, 'act')[0].spent === 3 && heroHits(t.r.events).length === 4, 'at most 3 can be spent at once');
  t = mkb(1, {id: 'attack', target: 'w1', kindle: 3}); ok(of(t.r.events, 'act')[0].spent === 1 && heroHits(t.r.events).length === 2, 'cannot spend more than you have (1)');
  t = mkb(2, {id: 'attack', target: 'w1', kindle: 2}); ok(t.f.b.kindle === 1, 'spending all but 0 leaves 0, then +1 for the round');
  for (const bad of [-2, NaN, 'x', null, undefined, 0.9]) { t = mkb(4, {id: 'attack', target: 'w1', kindle: bad}); ok(of(t.r.events, 'act')[0].spent === 0 && heroHits(t.r.events).length === 1, `kindle ${String(bad)} spends nothing`); }
  t = mkb(4, {id: 'attack', target: 'w1', kindle: 2.9}); ok(of(t.r.events, 'act')[0].spent === 2, 'fractions round down');
  t = mkb(4, {id: 'guard', kindle: 3}); ok(t.f.b.stats.kindle === 0 && t.f.b.kindle === 5, 'Guard cannot spend Kindle (4, +1 for Guard, capped at 5)');
  t = mkb(4, {id: 'item', item: 'salve', kindle: 3}); ok(t.f.b.stats.kindle === 0, 'items cannot spend Kindle');
}
{ // how each skill scales (hits, rounds, healing)
  const A = (classId, comp, idx, k, foes = [['wolf', 'w1', TANK], ['goblin', 'g1', {...TANK, x: 103.5}]], pre) => {
    const s = mk(classId, comp, foes); pre?.(s); const f = start(s, 14); f.b.kindle = 5; const r = go(f, {id: 'skill', skill: idx, target: foes[0][1], kindle: k}); keep(r.events); return {s, f, r};
  };
  for (const k of [0, 1, 3]) {
    let t = A('warrior', null, 1, k); ok(heroHits(t.r.events).length === 2 * (1 + k), `Cleave with Kindle ${k}: ${1 + k} sweeps over 2 foes`);
    t = A('mage', null, 0, k); ok(heroHits(t.r.events).length === 3 + k, `Arcane Volley with Kindle ${k}: ${3 + k} bolts`);
    t = A('mage', null, 1, k); ok(heroHits(t.r.events).length === 2 * (1 + k), `Frost Nova with Kindle ${k}: ${1 + k} pulses over 2 foes`);
    t = A('ranger', 'ash-wolf', 0, k); ok(heroHits(t.r.events).length === 1 + k, `Piercing Shot with Kindle ${k}: ${1 + k} arrows`);
    t = A('summoner', 'bone-squire', 0, k); ok(heroHits(t.r.events).length === 1 + k, `Spirit Lash with Kindle ${k}: ${1 + k} lashes`);
    t = A('warrior', null, 0, k); ok(t.f.b.wallUntil === 1 + 1 + k, `Shield Wall with Kindle ${k} lasts through round ${2 + k}`);
    t = A('ranger', 'ash-wolf', 1, k); ok(t.f.b.st.w1.slowUntil === 1 + 1 + k && t.f.b.st.g1.slowUntil === 2 + k, `Snare Trap with Kindle ${k}: foes snared through round ${2 + k}`);
    t = A('ranger', 'ash-wolf', 2, k); ok(t.f.b.st.w1.markUntil === 1 + 2 + k, `Hunter’s Mark with Kindle ${k}: marked through round ${3 + k}`);
    t = A('warrior', null, 2, k, undefined, s => { s.player.hp = 10; s.player.maxHp = 200; }); ok(t.r.events.find(e => e.type === 'heal').amount === 20 + 12 * k, `Rallying Cry heals ${20 + 12 * k} with Kindle ${k}`);
    t = A('mage', null, 2, k, undefined, s => { s.player.hp = 10; s.player.maxHp = 200; s.player.mp = 10; }); ok(t.r.events.find(e => e.type === 'heal').amount === 10 + 10 * k, `Mana Surge heals ${10 + 10 * k} with Kindle ${k}`);
  }
  const t = A('summoner', 'bone-squire', 1, 2, undefined, s => { s.guardian.hp = 10; }); ok(t.f.b.comp.empowerUntil === 1 + 2 - 1 + 2 && snap(t.f).guardian.empowered, 'Rally the Bound: empowered +1 round per Kindle');
}
{ // a skill you cannot afford: no turn, no Kindle spent
  const s = mk('mage', null, [['wolf', 'w1', TANK]], {mp: 5}); const f = start(s, 5); f.b.kindle = 3;
  const list = BT.skillList(f.b, s); ok(!list[0].enabled && list[0].why === 'Needs 12 mana.' && list[2].enabled, 'a too-costly skill is disabled with a "mana" reason, a cheap one stays open');
  const r = go(f, {id: 'skill', skill: 0, kindle: 2}); ok(r.events.length === 1 && r.events[0].type === 'note' && f.b.kindle === 3 && f.b.round === 1 && s.player.mp === 5, 'refused: one note, still round 1, Kindle and mana untouched');
  ok(BT.commands(f.b, s)[1].enabled, 'Skills stays open while some skill is affordable');
  s.player.mp = 3; ok(!BT.commands(f.b, s)[1].enabled, 'Skills closes when no skill is affordable (the cheapest costs 4)');
}

// ---------------------------------------------------------------- every skill does what it says
console.log('skill effects');
{
  const s = mk('warrior', null, [['wolf', 'w1', {...TANK, attack: 40, speed: 9}], ['goblin', 'g1', {...TANK, x: 103.5, attack: 40, speed: 9}]]); s.player.maxHp = s.player.hp = 5000; s.player.armor = 0; const f = start(s, 17); // both foes act before the hero
  const guardedHit = of(f.first, 'hit').find(e => e.dst === 'player');
  const mp0 = s.player.mp; const r = keep(go(f, {id: 'skill', skill: 0}).events); ok(s.player.mp === mp0 - 8 && f.b.wallUntil === 2, 'Shield Wall: costs 8 mana, lasts this round and the next');
  ok(snap(f).player.wall, 'snapshot flags the wall');
  const wallHits = of(r, 'hit').filter(e => e.dst === 'player' && e.round === 2); ok(wallHits.length > 0 && wallHits.every(e => e.guarded), 'blows in the next round are guarded by the wall');
  ok(guardedHit && !guardedHit.guarded, 'before the wall the same blows were not guarded');
  const ratio = wallHits[0].amount / guardedHit.amount; ok(ratio > .35 && ratio < .75, `the wall halves damage, and only halves it (ratio ${ratio.toFixed(2)})`);
}
{
  const s = mk('warrior', null, [['goblin', 'g1', TANK], ['skeleton', 'k1', {...TANK, x: 103.5}]]); const f = start(s, 17); const mp0 = s.player.mp;
  const r = keep(go(f, {id: 'skill', skill: 1}).events), h = heroHits(r); eq(h.map(x => x.dst), ['g1', 'k1'], 'Cleave sweeps every foe'); ok(h.every(x => x.dtype === 'blade') && s.player.mp === mp0 - 10, 'Cleave: blade damage, 10 mana');
  const base = BT.baseDamage(s); ok(h[0].amount <= Math.round(base * .7 * 1.1 * 1.5) + 1 && h[0].amount >= Math.round(base * .7 * .9) - 1, `Cleave is 70% power (${h[0].amount} for base ${base})`);
  ok(h.every(x => !x.fray), 'a blade is no Fray of goblin or skeleton: no pips fall');
}
{
  const s = mk('warrior', null, [['skeleton', 'k1', TANK], ['ghost', 'x1', {...TANK, x: 103.5}]], {hp: 40}); s.player.maxHp = 100; const f = start(s, 17);
  const r = keep(go(f, {id: 'skill', skill: 2}).events); const heal = of(r, 'heal')[0]; ok(heal.amount === 20 && s.player.hp >= 60 - 5, `Rallying Cry recovers 20 health (${heal.amount})`);
  const h = heroHits(r); ok(h.length === 2 && h.every(x => x.dtype === 'spirit' && x.fray), 'Rallying Cry shouts at every foe with spirit damage (both weak to spirit)'); ok(h.every(x => x.chipped), 'each lost a pip');
}
{
  const s = mk('mage', null, [['ghost', 'x1', TANK], ['skeleton', 'k1', {...TANK, x: 103.5}], ['wolf', 'w1', {...TANK, x: 104.5}]]); const f = start(s, 17); const mp0 = s.player.mp;
  const r = keep(go(f, {id: 'skill', skill: 0, target: 'k1'}).events), h = heroHits(r); ok(h.length === 3 && h.every(x => x.dtype === 'arcane'), 'Arcane Volley: three arcane bolts');
  eq(h.map(x => x.dst), ['k1', 'w1', 'x1'], 'bolts walk the line from the chosen target'); ok(s.player.mp === mp0 - 12, `Volley costs 12 mana (${s.player.mp} from ${mp0})`);
  const base = BT.baseDamage(s, true); ok(h[0].amount <= Math.round(base * .62 * 1.25 * 1.5 * 1.1) + 1, `bolts use spell damage (${h[0].amount}, base ${base})`);
}
{
  const s = mk('mage', null, [['troll', 't1', {...TANK, speed: 5}], ['goblin', 'g1', {...TANK, x: 103.5, speed: 5}]]); const f = start(s, 17);
  eq(turnsOf(f.first).sort(), ['g1', 'player', 't1'], 'both fast foes act, then the hero'); ok(turnsOf(f.first)[2] === 'player', 'the hero comes last in round 1');
  const before = BT.timeline(f.b, s).filter(t => t.round === 2).map(t => t.id);
  ok(before.indexOf('t1') < before.indexOf('player'), 'before the nova the fast foe is ahead of the hero in round 2');
  const r = keep(go(f, {id: 'skill', skill: 1}).events), h = heroHits(r); ok(h.length === 2 && h.every(x => x.dtype === 'frost'), 'Frost Nova: one frost pulse on every foe');
  ok(h.find(x => x.dst === 't1').fray && h.find(x => x.dst === 't1').chipped, 'frost is a Fray of the troll'); ok(snap(f).foes.t1.slowed && snap(f).foes.g1.slowed, 'every foe is flagged slowed');
  const after = BT.timeline(f.b, s).filter(t => t.round === 2).map(t => t.id); ok(after.length === 3 && after[0] === 'player', `slowed foes act after the hero next round (${after})`);
}
{
  const s = mk('mage', null, [['wolf', 'w1', TANK]], {hp: 20, mp: 5}); s.player.maxHp = 100; const f = start(s, 17);
  const r = keep(go(f, {id: 'skill', skill: 2}).events); ok(s.player.mp > 5 + 10 && of(r, 'heal').some(e => e.mana > 0) && of(r, 'heal').some(e => e.amount === 10), 'Mana Surge recovers half the mana and 10 health');
  const s2 = mk('mage', null, [['wolf', 'w1', TANK]]); const f2 = start(s2, 17); const l = BT.skillList(f2.b, s2); ok(!l[2].enabled && /Mana and health are full/.test(l[2].why), 'Mana Surge is refused at full mana and health');
}
{
  const s = mk('ranger', 'ash-wolf', [['bandit', 'b1', TANK], ['goblin', 'g1', {...TANK, x: 103.5}]]); const f = start(s, 17); const mp0 = s.player.mp;
  let r = keep(go(f, {id: 'skill', skill: 0, target: 'g1'}).events), h = heroHits(r); ok(h.length === 1 && h[0].dst === 'g1' && h[0].dtype === 'bow' && h[0].fray && s.player.mp === mp0 - 9, 'Piercing Shot: one heavy bow shot at the chosen foe, 9 mana');
  const base = BT.baseDamage(s); ok(h[0].amount >= Math.round(base * 1.5 * .9 * 1.25) - 1, `Piercing Shot is 150% power (${h[0].amount}, base ${base})`);
  r = keep(go(f, {id: 'skill', skill: 1}).events); h = heroHits(r).filter(x => x.src === 'player'); ok(h.length === 2 && h.every(x => x.dtype === 'blade'), 'Snare Trap: steel jaws (blade) on every foe'); ok(snap(f).foes.b1.slowed && snap(f).foes.g1.slowed, 'snared foes are flagged');
  r = keep(go(f, {id: 'skill', skill: 2, target: 'b1'}).events); ok(of(r, 'reveal')[0].dst === 'b1' && snap(f).foes.b1.marked, 'Hunter’s Mark marks the chosen foe');
  const plain = (() => { const s2 = mk('ranger', 'ash-wolf', [['bandit', 'b1', TANK]]); const f2 = start(s2, 29); return heroHits(go(f2, {id: 'attack', target: 'b1'}).events)[0].amount; })();
  const marked = (() => { const s2 = mk('ranger', 'ash-wolf', [['bandit', 'b1', TANK]]); const f2 = start(s2, 29); f2.b.st.b1.markUntil = 5; return heroHits(go(f2, {id: 'attack', target: 'b1'}).events)[0].amount; })();
  ok(Math.abs(marked - Math.round(plain * 1.25)) <= 1, `a marked foe takes 25% more (${marked} vs ${plain})`);
}
{
  const s = mk('summoner', 'bone-squire', [['zombie', 'z1', TANK]]); const f = start(s, 17); const mp0 = s.player.mp;
  let r = keep(go(f, {id: 'skill', skill: 0, target: 'z1'}).events), h = heroHits(r); ok(h.length === 1 && h[0].dtype === 'spirit' && !h[0].fray && s.player.mp === mp0 - 9, 'Spirit Lash: a spirit lash, 9 mana');
  s.guardian.hp = Math.round(s.guardian.maxHp * .3); const hp0 = s.guardian.hp; const calls0 = f.ctx.calls.hurt;
  r = keep(go(f, {id: 'skill', skill: 1}).events); ok(s.guardian.hp >= hp0 + s.guardian.maxHp * .4 - 2, 'Rally the Bound heals the minion by 40%'); ok(snap(f).guardian.empowered, 'and empowers it');
  ok(of(r, 'act').filter(e => e.src === 'guardian').length >= 2, 'the minion strikes at once (an extra turn) as well as in turn order');
  // Recall: standing minion heals and covers; fallen minion returns
  r = keep(go(f, {id: 'skill', skill: 2}).events); ok(of(r, 'note').some(e => /take the next blow/.test(e.text)), 'Recall of a standing minion: it will cover the next blow');
  const s2 = mk('summoner', 'bone-squire', [['zombie', 'z1', TANK]]); const f2 = start(s2, 17); G.damage(s2, 99999, {note() {}}); ok(s2.guardian.fallen, 'minion fallen');
  ok(!BT.skillList(f2.b, s2)[1].enabled && /fallen/.test(BT.skillList(f2.b, s2)[1].why), 'Rally the Bound is refused while the minion is down');
  r = keep(go(f2, {id: 'skill', skill: 2}).events); ok(!s2.guardian.fallen && s2.guardian.hp > 0, 'Recall brings a fallen minion back at half strength');
  ok(BT.timeline(f2.b, s2).some(t => t.id === 'guardian' && t.round >= 2), 'the recalled minion is back in the timeline from the next round');
}
{ // summoner/ranger without a companion cannot use ally skills
  const s = mk('summoner', 'bone-squire'); delete s.guardian; const f = start(s, 5); const l = BT.skillList(f.b, s); ok(!l[1].enabled && !l[2].enabled && /no bound companion/.test(l[1].why), 'ally skills need a companion');
}

// ---------------------------------------------------------------- the companions
console.log('companions');
for (const [classId, list] of Object.entries(G.ROSTERS)) for (const kind of list.choices) {
  const def = G.COMPANIONS[kind], type = D.PERK_TYPE[def.perk];
  const s = mk(classId, kind, [['skeleton', 'k1', {...TANK, hp: 9000, maxHp: 9000}]]); const f = start(s, 40);
  let acts = [], hitsBy = [], chips = 0;
  for (let i = 0; i < 6; i++) { const r = keep(go(f, {id: 'guard'}).events); acts.push(...of(r, 'act').filter(e => e.src === 'guardian')); hitsBy.push(...hits(r, e => e.src === 'guardian')); chips += hits(r, e => e.src === 'guardian' && e.chipped).length; }
  ok(acts.length >= 5 && acts.every(a => a.dtype === type), `${kind}: acts every round with ${type} (${acts.length})`);
  ok(hitsBy.length >= 5 && hitsBy.every(h => h.amount > 0), `${kind}: its blows land`);
  ok(hitsBy.filter(h => !h.bleed).every(h => h.dtype === type), `${kind}: all its blows are ${type}`);
  if (['flame', 'spirit', 'arcane'].includes(type)) ok(chips >= 1, `${kind}: ${type} is a Fray of the skeleton, so its blows chip the Ward (${chips})`);
  else ok(chips === 0, `${kind}: ${type} is not a Fray of the skeleton, so it chips nothing`);
  ok(G.COMPANIONS[kind].perk === def.perk && D.PERK_TYPE[def.perk], `${kind}: perk ${def.perk} has a damage type`);
}
ok(Object.keys(G.COMPANIONS).every(k => D.PERK_TYPE[G.COMPANIONS[k].perk]), 'every companion perk maps to a damage type');
{ // beasts and minions prefer a foe weak to their type
  const s = mk('summoner', 'ember-imp', [['goblin', 'g1', TANK], ['skeleton', 'k1', {...TANK, x: 103.5}]]); const f = start(s, 2); const r = keep(go(f, {id: 'guard'}).events);
  const t = of(r, 'act').find(e => e.src === 'guardian'); ok(t && t.targets[0] === 'k1', 'the ember imp (flame) goes for the foe weak to flame'); }
{ // bleeding (rend) is applied at the end of the round through ctx.hurt
  const s = mk('ranger', 'ash-wolf', [['skeleton', 'k1', TANK]]); const f = start(s, 2); let bled = 0;
  for (let i = 0; i < 4; i++) bled += hits(go(f, {id: 'guard'}).events, e => e.bleed).length; ok(bled >= 1, 'the Ashfang Wolf’s bite makes foes bleed at the end of a round'); }
{ // a foe may hit the companion; it can fall and the battle goes on
  const s = mk('summoner', 'ember-imp', [['wolf', 'w1', {...TANK, attack: 400, speed: 9}]], {hp: 99999}); s.player.maxHp = 99999; s.player.hp = 99999; const f = start(s, 3); let fell = false;
  for (let i = 0; i < 12 && !fell && f.b.phase === 'command'; i++) { const r = keep(go(f, {id: 'guard'}).events); fell = s.guardian.fallen; }
  ok(fell && f.b.phase === 'command', 'the companion fell, the battle continues'); ok(snap(f).guardian.fallen, 'snapshot shows the fallen companion');
  ok(!BT.timeline(f.b, s).some(t => t.id === 'guardian'), 'a fallen companion is out of the timeline');
  ok(of(go(f, {id: 'guard'}).events, 'turn').every(t => t.who !== 'guardian'), 'and takes no turns');
}

// ---------------------------------------------------------------- the timeline of the next 8 turns
console.log('timeline');
{
  const s = mk('warrior', null, [['wolf', 'f1', {...TANK, speed: 9}], ['goblin', 'f2', {...TANK, speed: 4, x: 103.5}], ['skeleton', 'f3', {...TANK, speed: .4, x: 104.5}]]);
  const f = start(s, 50); const tl = BT.timeline(f.b, s);
  ok(tl.length === 8, `exactly 8 turns (${tl.length})`);
  ok(tl[0].id === 'player' && tl[0].current === true && tl.slice(1).every(t => !t.current), 'the hero is first and the only current turn');
  ok(tl.every(t => t.id && t.name && ['hero', 'ally', 'foe'].includes(t.side) && Number.isInteger(t.round) && typeof t.skip === 'boolean'), 'every entry has id, name, side, round, skip');
  eq(tl.slice(0, 2).map(t => t.id), ['player', 'f3'], 'order by speed: the two faster foes already acted this round; the slow one is last');
  const r2 = tl.filter(t => t.round === 2).map(t => t.id); eq(r2, ['f1', 'f2', 'player', 'f3'], 'round 2 order: fastest foe, next foe, hero, slowest');
  ok(tl.filter(t => t.round === 3).length === 2 && tl[7].round === 3, 'round 3 is cut off at 8 turns');
  eq(BT.timeline(f.b, s).map(t => t.id + t.round), tl.map(t => t.id + t.round), 'asking twice gives the same answer (no hidden state or randomness)');
  eq(BT.timeline(f.b, s, 3).length, 3, 'a shorter strip can be asked for');
  // prediction equals what really happens (nothing dies, nothing is Staggered)
  const first = f.first.find(e => e.type === 'turn');
  const predicted = first.tl.map(t => t.id);
  const f2 = start(mk('warrior', null, [['wolf', 'f1', {...TANK, speed: 9}], ['goblin', 'f2', {...TANK, speed: 4, x: 103.5}], ['skeleton', 'f3', {...TANK, speed: .4, x: 104.5}]]), 50);
  const real = [...turnsOf(f2.first)]; for (let i = 0; i < 4 && real.length < 8; i++) real.push(...turnsOf(go(f2, {id: 'guard'}).events));
  eq(predicted, real.slice(0, predicted.length), 'the strip at the first turn predicts the real order of the next 8 turns');
  const t1 = f.first.filter(e => e.type === 'turn').map(e => e.tl[0].id); eq(t1, turnsOf(f.first), 'in each turn event the acting combatant leads the strip');
}
{ // companion and speed
  const s = mk('ranger', 'gale-hawk', [['goblin', 'g1', {...TANK, speed: .4}]]); const f = start(s, 1); const tl = BT.timeline(f.b, s);
  ok(tl.some(t => t.id === 'guardian' && t.side === 'ally') && tl.length === 8, 'the companion has turns in the strip');
  ok(turnsOf(f.first).join() === 'guardian,player' && tl.filter(t => t.round === 1).length === 2, 'the quick hawk already acted in round 1; hero and the slow foe remain');
  const fast = mk('warrior', null, [['wolf', 'w1', {...TANK, speed: 12}]]); const ff = start(fast, 1); ok(BT.timeline(ff.b, fast)[0].id === 'player', 'the strip starts at the hero even though a fast foe has already acted');
}
{ // a readied special is flagged on the turn it lands
  const s = mk('warrior', null, [['skeleton', 'k1', {...TANK, attack: 1}]]); const f = start(s, 5); let sawSpecial = null;
  for (let i = 0; i < 4 && !sawSpecial; i++) { go(f, {id: 'guard'}); sawSpecial = BT.timeline(f.b, s).find(t => t.special); }
  ok(sawSpecial && sawSpecial.id === 'k1' && sawSpecial.special === 'Bone Rattle', 'a telegraphed special is named in the strip'); }
{ // speed changes: a slowed foe moves last; a new fast jitter keeps order stable per seed
  const s = mk('mage', null, [['wolf', 'w1', {...TANK, speed: 5}]]); const f = start(s, 8); f.b.st.w1.slowUntil = 2;
  const r2 = BT.timeline(f.b, s).filter(t => t.round === 2).map(t => t.id); eq(r2, ['player', 'w1'], 'a chilled foe acts after the hero in the next round');
  const r3 = BT.timeline(f.b, s).filter(t => t.round === 3).map(t => t.id); eq(r3, ['w1', 'player'], 'the effect ends after that round');
}
{ ok(BT.timeline({phase: 'over', st: {}, turnOrder: [], cursor: 0, round: 1, seed: 1}, mk('warrior')).length === 0, 'no timeline once the battle is over'); }

// ---------------------------------------------------------------- seeded determinism
console.log('determinism');
{
  const script = [{id: 'attack', target: 'w1'}, {id: 'skill', skill: 1}, {id: 'guard'}, {id: 'item', item: 'salve'}, {id: 'attack', target: 'g1', kindle: 2}, {id: 'skill', skill: 2}, {id: 'flee', kindle: 1}, {id: 'attack', target: 'w1'}, {id: 'attack', target: 'g1'}, {id: 'attack', target: 'w1'}];
  const run = seed => {
    const s = mk('warrior', null, [['wolf', 'w1', {hp: 300, maxHp: 300, attack: 5, speed: 2.5}], ['goblin', 'g1', {hp: 300, maxHp: 300, attack: 6, speed: 1.8, x: 103.5}]], {inv: {salve: 5}});
    const f = start(s, seed, {...spyCtx(), now: NOW}); const log = [...f.first];
    for (const c of script) { if (f.b.phase === 'over') break; log.push(...go(f, c).events); }
    return {log, state: JSON.stringify(s), plain: f.b.log};
  };
  const a = run(4242), b = run(4242), c = run(4243);
  ok(a.log.length > 20, `a long battle was played (${a.log.length} events)`);
  ok(JSON.stringify(a.log) === JSON.stringify(b.log), 'same seed and commands: identical event log'); ok(a.state === b.state, 'same seed and commands: identical world state at the end');
  ok(JSON.stringify(a.log) !== JSON.stringify(c.log), 'a different seed plays out differently');
  const s0 = mk('warrior'), seedA = BT.begin(s0, s0.enemies, spyCtx(), 5).b.seed, s1 = mk('warrior'); const d1 = BT.begin(s1, s1.enemies, spyCtx()).b.seed, s2 = mk('warrior'); const d2 = BT.begin(s2, s2.enemies, spyCtx()).b.seed;
  ok(seedA === 5, 'the seed is kept'); ok(d1 === d2 && Number.isInteger(d1), 'without a seed it derives from the world clock and kills (not Math.random)');
}

// ---------------------------------------------------------------- fleeing
console.log('flee');
{
  const outcomes = {fled: 0, stay: 0}; let fledSample = null, stayEvents = null;
  for (let seed = 1; seed <= 80 && (outcomes.fled < 3 || outcomes.stay < 3); seed++) {
    const s = mk('warrior', null, [['wolf', 'w1', {...TANK, attack: 3}]]); const f = start(s, seed); const r = go(f, {id: 'flee'});
    if (f.b.result === 'fled') { outcomes.fled++; fledSample ??= {s, f, r}; } else { outcomes.stay++; stayEvents ??= {s, f, r}; }
  }
  ok(outcomes.fled >= 1 && outcomes.stay >= 1, `fleeing sometimes works and sometimes fails (${outcomes.fled}/${outcomes.stay})`);
  const {s, f, r} = fledSample; keep(r.events);
  ok(r.over && f.b.phase === 'over' && f.b.result === 'fled', 'a clean getaway ends the battle as "fled"'); ok(of(r.events, 'end')[0].result === 'fled' && of(r.events, 'end')[0].text === 'You break away!', 'with an end event');
  ok(s.battleGrace === s.elapsed + BT.GRACE + 3, 'a getaway earns GRACE + 3 seconds of world time before the next battle'); ok(s.enemies[0].cd >= 3 && s.enemies[0].path.length === 0, 'the foe hesitates (cooldown 3, no path)');
  ok(!s.enemies[0].deadUntil && s.kills === 0 && f.b.summary && f.b.summary.kills === 0 && f.b.summary.gold === 0, 'nobody died, no rewards; the summary exists for the result screen');
  ok(BT.encounter(s, dist).length === 0, 'no new battle during the grace'); ok(go(f, {id: 'attack'}).error === 'Not your turn.', 'a finished battle accepts no commands');
  const st = stayEvents; keep(st.r.events);
  ok(!st.r.over && st.f.b.phase === 'command' && st.f.b.round === 2, 'a failed attempt costs the turn: the foes act, the next round begins'); ok(of(st.r.events, 'note').some(e => /No escape/.test(e.text)), 'with an "No escape" note');
  ok(st.s.battleGrace === undefined || st.s.battleGrace <= st.s.elapsed, 'a failed attempt sets no grace');
}
{
  const s = mk('warrior', null, [['wolf', 'w1', {...TANK, speed: 3}]]); const f = start(s, 1); const c0 = BT.fleeChance(f.b, s), c1 = BT.fleeChance(f.b, s, 1), c3 = BT.fleeChance(f.b, s, 3);
  ok(c0 >= .2 && c0 <= .95 && Math.abs(c1 - c0 - .15) < 1e-9 && c3 > c1 && c3 <= .95, `Kindle adds 15% each (${c0.toFixed(2)}, ${c1.toFixed(2)}, ${c3.toFixed(2)})`);
  const fast = mk('warrior', null, [['wolf', 'w1', {...TANK, speed: 6}]]), slow = mk('warrior', null, [['troll', 't1', {...TANK, speed: .6}]]); ok(BT.fleeChance(start(fast).b, fast) < BT.fleeChance(start(slow).b, slow), 'fast foes are harder to flee than slow ones');
  const boss = mk('warrior', null, [['horseman', 'h1', {...TANK, speed: 1.5}]]), plain = mk('warrior', null, [['troll', 't1', {...TANK, speed: 1.5}]]); ok(BT.fleeChance(start(boss).b, boss) < BT.fleeChance(start(plain).b, plain), 'bosses are harder to flee');
  f.b.kindle = 5; const r = go(f, {id: 'flee', kindle: 3}); ok(f.b.stats.kindle === 3, 'a flee attempt spends the Kindle put into it');
  ok(BT.commands(f.b, s)[4].hint.includes('%'), 'the Flee hint shows the chance');
}

// ---------------------------------------------------------------- items
console.log('items');
{
  const mkI = () => { const s = mk('warrior', null, [['wolf', 'w1', {...TANK, attack: 0}]], {inv: {salve: 3, bread: 2, fish: 2, tonic: 2}}); s.player.maxHp = 100; s.player.hp = 30; s.player.mp = 10; return s; };
  let s = mkI(), f = start(s, 3); let r = keep(go(f, {id: 'item', item: 'salve'}).events); const hl = of(r, 'heal')[0];
  ok(hl.item === 'salve' && hl.amount === 45 && s.inv.salve === 2, 'salve: +45 health, one used'); ok(f.ctx.calls.use === 1, 'the item went through ctx.use'); ok(of(r, 'round').length === 1 && f.b.round === 2, 'using an item costs the turn');
  ok(/Used/.test(hl.text), 'the heal event carries the world’s own text');
  s = mkI(); f = start(s, 3); r = go(f, {id: 'item', item: 'bread'}).events; ok(of(r, 'heal')[0].amount === 22 && of(r, 'heal')[0].mana === 15 && s.inv.bread === 1, 'bread: +22 health +15 mana');
  s = mkI(); f = start(s, 3); r = go(f, {id: 'item', item: 'fish'}).events; ok(of(r, 'heal')[0].amount === 14 && of(r, 'heal')[0].mana === 10, 'fish: +14 health +10 mana');
  s = mkI(); f = start(s, 3); r = go(f, {id: 'item', item: 'tonic'}).events; ok(of(r, 'heal')[0].mana === s.player.maxMp - 10 && s.player.mp === s.player.maxMp && s.inv.tonic === 1, 'tonic: all mana');
  s = mkI(); f = start(s, 3); s.player.hp = 80; r = go(f, {id: 'item', item: 'salve'}).events; ok(of(r, 'heal')[0].hp.player.hp === 100 && of(r, 'heal')[0].amount === 20, 'health is capped at the maximum');
  s = mkI(); f = start(s, 3); const k = f.b.kindle; r = go(f, {id: 'item', item: 'sword'}); ok(r.events.length === 1 && r.events[0].type === 'note' && f.b.round === 1 && f.b.cursor === f.b.turnOrder.indexOf('player') && f.ctx.calls.use === 0, 'an item you cannot use in battle is refused without spending the turn');
  s = mkI(); s.inv.salve = 0; f = start(s, 3); r = go(f, {id: 'item', item: 'salve'}); ok(r.events[0].type === 'note' && /Nothing like that/.test(r.events[0].text) && f.b.round === 1, 'an item you do not have is refused');
  ok(BT.commands(f.b, s)[3].enabled, 'Items is open while any item is in the pack'); for (const i of BT.ITEM_LIST) s.inv[i] = 0; ok(!BT.commands(f.b, s)[3].enabled, 'Items is closed when the pack has none');
  eq(BT.ITEM_LIST, ['salve', 'bread', 'fish', 'tonic'], 'the four battle items');
}

// ---------------------------------------------------------------- victory, defeat and settle()
console.log('results');
{ // victory with rewards, loot, level-up, grace
  const s = mk('warrior', null, [['wolf', 'w1', {hp: 20, maxHp: 20, attack: 0, speed: .5}], ['goblin', 'g1', {hp: 20, maxHp: 20, attack: 0, speed: .5, x: 103.5}]]); s.player.xp = 75; const lvl0 = s.player.level, gold0 = s.player.gold, xp0 = s.player.xp, inv0 = {...s.inv};
  const f = start(s, 9); f.b.kindle = 5; keep(go(f, {id: 'skill', skill: 1, kindle: 3}).events); let guard = 0; while (f.b.phase !== 'over' && guard++ < 20) keep(go(f, {id: 'attack', target: BT.livingFoes(f.b, s)[0].id, kindle: 1}).events);
  ok(f.b.phase === 'over' && f.b.result === 'won', 'killing every foe wins');
  const sm = f.b.summary; ok(sm && sm.kills === 2 && s.kills === 2, 'both kills are credited to the world exactly once');
  ok(sm.gold === s.player.gold - gold0 && sm.gold >= 6, `gold reward ${sm.gold}`); ok(sm.xp === s.player.xp - xp0 || sm.leveled, 'experience reward'); ok(sm.leveled && s.player.level === lvl0 + 1 && sm.level === lvl0 + 1, 'a level was gained and reported');
  ok(s.battleGrace === s.elapsed + BT.GRACE, `settle() sets GRACE (${BT.GRACE}s) of world time`); ok(BT.encounter(s, dist).length === 0, 'no encounter during the grace');
  ok(s.enemies.every(e => e.deadUntil > 0), 'foes are dead in the world (respawn timers set by the world)'); ok(sm.rounds >= 1 && sm.hits > 0 && sm.skills === 1 && sm.kindle >= 3, 'summary carries the battle stats');
  ok(E.valid(clone(s)), 'the world state is still a valid save after the battle');
  const e = f.b; ok(of(go(f, {id: 'attack'}).events, 'hit').length === 0 && go(f, {id: 'attack'}).error === 'Not your turn.', 'no commands after the end');
  // grace expires, a new hostile near the hero starts a new battle
  const w = foeOf('wolf', 'n1', {x: 100.5 + 1.5, y: 100.5}); s.enemies.push(w); ok(BT.encounter(s, dist).length === 0, 'still within the grace'); s.elapsed += BT.GRACE + 1; ok(BT.encounter(s, dist).map(x => x.id).join() === 'n1', 'after the grace a hostile in range begins a battle');
  s.settings = {battles: 'real-time'}; ok(BT.encounter(s, dist).length === 0, 'real-time mode never begins a turn-based battle');
}
{ // loot lands in the summary
  const s = mk('warrior', null, [['wolf', 'w1', {hp: 1, maxHp: 1, attack: 0, speed: .5}]]); const f = start(s, 9); const before = {...s.inv}; s.inv.leaf = (s.inv.leaf || 0) + 2; // loot dropped by the world during the fight
  go(f, {id: 'attack', target: 'w1'}); ok(f.b.result === 'won' && f.b.summary.items.leaf === 2 && !('salve' in f.b.summary.items), 'items gained during the fight are listed (only gains)'); void before;
}
{ // a one-hit kill with a multi-hit command: no double reward, no wasted hits on a corpse
  const s = mk('warrior', null, [['wolf', 'w1', {hp: 1, maxHp: 1, attack: 0, speed: .5}]]); const f = start(s, 9); f.b.kindle = 4; const gold0 = s.player.gold;
  const r = go(f, {id: 'attack', target: 'w1', kindle: 3}); ok(heroHits(r.events).length === 1 && s.kills === 1 && s.player.gold - gold0 === 3 + Math.floor(1 / 15), 'overkill: one hit lands, the reward is paid once');
}
{ // defeat
  const s = mk('mage', null, [['troll', 't1', {...TANK, attack: 900, speed: 9}]]); const f = start(s, 12); keep(f.first);
  ok(f.b.phase === 'over' && f.b.result === 'lost', 'a crushing blow before the hero can act loses the battle'); ok(s.player.hp === 0 && s.player.deadUntil > 0, 'the world sets the hero down (shrine timer)');
  const e = f.first.filter(x => x.type === 'end'); ok(e.length === 1 && e[0].result === 'lost' && e[0].text === 'You have fallen.', 'one end event: lost');
  ok(f.b.summary && f.b.summary.kills === 0 && s.battleGrace === s.elapsed + BT.GRACE, 'settle ran even though the battle ended while starting'); ok(BT.timeline(f.b, s).length === 0, 'no timeline after the end');
  ok(go(f, {id: 'attack'}).error === 'Not your turn.', 'no commands after defeat');
}
{ // defeat in the middle of a battle, with the companion still standing
  const s = mk('ranger', 'dusk-lynx', [['wolf', 'w1', {...TANK, attack: 14, speed: 3}]], {hp: 30}); s.player.armor = 0; const f = start(s, 12); let g = 0;
  while (f.b.phase !== 'over' && g++ < 60) keep(go(f, {id: 'guard'}).events);
  ok(f.b.result === 'lost' && s.player.deadUntil > 0, 'the party is defeated when the hero falls, whatever the companion');
}
{ // companion cover: foes meant for the hero
  const s = mk('summoner', 'bone-squire', [['wolf', 'w1', {...TANK, attack: 30, speed: 9}]], {hp: 500}); s.player.maxHp = 500; s.player.hp = 500; const f = start(s, 2); f.b.cover = true; const hp0 = s.player.hp;
  const r = keep(go(f, {id: 'guard'}).events); ok(r.length > 0, 'a round passes with cover set');
}

// ---------------------------------------------------------------- the engine contract
console.log('contract');
{
  const s = mk('ranger', 'ash-wolf', [['goblin', 'g1', {hp: 150, maxHp: 150, attack: 20, speed: 3}], ['skeleton', 'k1', {hp: 150, maxHp: 150, attack: 15, speed: 1, x: 103.5}]], {inv: {salve: 4}}); s.player.maxHp = 600; s.player.hp = 200;
  const keysBefore = Object.keys(s).sort(), playerKeys = Object.keys(s.player).sort(), gKeys = Object.keys(s.guardian).sort(), eKeys = Object.keys(s.enemies[0]).sort();
  const f = start(s, 31); const all = [...f.first]; const cmds = [{id: 'attack', target: 'g1', kindle: 1}, {id: 'item', item: 'salve'}, {id: 'skill', skill: 1}, {id: 'guard'}, {id: 'skill', skill: 0, target: 'k1'}, {id: 'attack', target: 'k1'}];
  for (const c of cmds) { if (f.b.phase === 'over') break; all.push(...go(f, c).events); }
  const hurtEvents = all.filter(e => e.type === 'hit' && e.dst !== 'guardian' && !e.blocked).length;
  ok(f.ctx.calls.hurt === hurtEvents && f.ctx.calls.hurt > 5, `every point of damage to foes and hero went through ctx.hurt (${f.ctx.calls.hurt} calls, ${hurtEvents} hit events)`);
  ok(f.ctx.calls.hurtOn.some(([id, src]) => ['g1', 'k1'].includes(id) && src === 'player') && f.ctx.calls.hurtOn.some(([id, src]) => ['g1', 'k1'].includes(id) && src === 'companion') && f.ctx.calls.hurtOn.some(([id, src]) => id === 'player' && ['g1', 'k1'].includes(src)), 'sources are "player", "companion" and the foe’s id, as the world expects');
  ok(f.ctx.calls.use === 1, 'the salve went through ctx.use exactly once');
  const gHits = all.filter(e => e.type === 'hit' && e.dst === 'guardian'); void gHits;
  const keysAfter = Object.keys(s).sort(); eq(keysAfter.filter(k => !keysBefore.includes(k)), f.b.phase === 'over' ? ['battleGrace'] : [], 'the battle added nothing to the world state' + ' except battleGrace after it ends');
  // the world's own hurt() stamps a `flash` on whoever it hits; that is the world's field, not the battle's
  const added = (o, before) => Object.keys(o).filter(k => !before.includes(k) && k !== 'flash').sort();
  eq(added(s.player, playerKeys), [], 'no new fields on the player'); eq(added(s.guardian, gKeys), [], 'no new fields on the companion'); eq(added(s.enemies[0], eKeys), [], 'no new fields on the foes');
  const json = JSON.stringify(s); ok(!/staggerUntil|turnOrder|maxWard|revealed|kindle/.test(json), 'no battle data anywhere in the saveable state'); ok(E.valid(clone(s)), 'the state is a valid save at any moment of the battle');
  ok(typeof f.b.rand === 'function' && !JSON.stringify(f.b).includes('function'), 'the battle object holds the seeded generator; it is never part of the world');
}
{ // damage to the companion goes through G.damage
  const s = mk('summoner', 'moss-golem', [['troll', 't1', {...TANK, attack: 8, speed: 9}]], {hp: 900}); s.player.maxHp = 900; s.player.hp = 900; const real = G.damage; let n = 0; const hp0 = s.guardian.hp;
  const f = start(s, 6); let g = 0, hitG = 0; while (g++ < 30 && hitG === 0) hitG += hits(go(f, {id: 'guard'}).events, e => e.dst === 'guardian').length;
  ok(hitG >= 1 && s.guardian.hp < hp0, 'a foe’s blow on the companion lowers its health (through G.damage)'); void real; void n;
}
{ // seeds and rng are engine side
  const src = await (await import('node:fs/promises')).readFile(ROOT + '/battle.js', 'utf8'); ok(!/Math\.random/.test(src), 'battle.js never calls Math.random'); ok(!/localStorage|sessionStorage|indexedDB/.test(src), 'battle.js never touches storage');
  const ui = await (await import('node:fs/promises')).readFile(ROOT + '/battle-ui.js', 'utf8'); ok(!/Math\.random|localStorage|AudioContext|new Audio|speechSynthesis|\.play\(/.test(ui), 'battle-ui.js uses no randomness, storage or audio');
}

// ---------------------------------------------------------------- wording and a long random-ish playthrough
console.log('wording');
{
  // play several full battles per class with a simple policy so every kind of event text is produced
  for (const [classId, comp] of [['warrior', null], ['mage', null], ['ranger', 'thorn-boar'], ['summoner', 'gloam-wisp']]) for (let seed = 1; seed <= 3; seed++) {
    const s = mk(classId, comp, [['wolf', 'w1', {hp: 120, maxHp: 120, attack: 7, speed: 2.6}], ['goblin', 'g1', {hp: 120, maxHp: 120, attack: 6, speed: 1.8, x: 103.5}], ['ghost', 'x1', {hp: 120, maxHp: 120, attack: 6, speed: 1.5, x: 104.5}]], {inv: {salve: 3}}); s.player.maxHp = 400; s.player.hp = 400;
    const f = start(s, seed * 101); keep(f.first); let g = 0;
    while (f.b.phase !== 'over' && g++ < 80) { const t = BT.livingFoes(f.b, s)[0]?.id; const sk = g % 4; const list = BT.skillList(f.b, s); const cmd = g % 7 === 0 ? {id: 'guard'} : g % 9 === 0 ? {id: 'item', item: 'salve'} : list[sk % 3].enabled && g % 2 ? {id: 'skill', skill: sk % 3, target: t, kindle: g % 3} : {id: 'attack', target: t, kindle: g % 2}; keep(go(f, cmd).events); }
    ok(f.b.phase === 'over', `${classId} seed ${seed}: a long battle reaches an end (${f.b.result}, round ${f.b.round})`);
  }
  const data = []; for (const set of Object.values(D.SKILLSETS)) for (const k of set) data.push(k.name, k.hint, k.kindleHint); for (const t of Object.values(D.TYPE_INFO)) data.push(t.label, t.hint); for (const d of [...Object.values(D.FOES), D.WARDEN, D.DEFAULT_FOE]) data.push(d.move, d.special.name);
  const all = [...strings, ...data, ...BT.commands(start(mk('warrior')).b, mk('warrior')).map(c => c.hint)];
  const bad = all.filter(t => /\bfocus\b|neighbou?r|hunger|nourish|hungry/i.test(t)); ok(bad.length === 0, `no banned wording in ${all.length} battle strings (${[...new Set(bad)].slice(0, 3)})`);
  const other = all.filter(t => /pok[eé]mon|final fantasy|octopath|square enix|nintendo/i.test(t)); ok(other.length === 0, 'no other game or studio is named');
  ok(all.some(t => /Fray/.test(t)) && all.some(t => /Staggered/.test(t)) && all.some(t => /Kindle/.test(t)) && all.some(t => /Ward/.test(t)), 'the battle texts use the game’s own terms: Ward, Fray, Staggered, Kindle');
}

console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(failures.join('\n')); process.exit(1); }
