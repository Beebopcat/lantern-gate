// Turn-based JRPG battles. Pure rules: the UI only renders what this module reports.
// The world's own combat rules stay authoritative: damage to foes goes through ctx.hurt(), so gold, experience, loot,
// raid credit and respawns behave exactly like a real-time kill; damage to the companion goes through G.damage();
// items go through ctx.use(). Battles are seeded and deterministic. Nothing here is saved; a reload simply resumes.
//
// Systems (terms shared with the rest of the game):
//   Ward    each foe has a few Ward pips. Hitting one of its Frays (weak damage types) reveals that Fray and removes a pip.
//   Stagger at 0 Ward the foe is Staggered: it loses its turns for the rest of this round and all of the next, takes +50%
//           damage, and any special it was readying is broken. At the end of the next round it recovers: Ward refills and
//           it is Steadied (its Ward cannot be broken again until it has taken a turn), so stagger chains always end.
//   Kindle  the party starts with 1, gains 1 at the start of every round (max 5) and 1 for each Guard. Before a command the
//           player may kindle up to 3 points: Attack gains a hit per point; each skill documents its own scaling.
//   Order   one turn per combatant per round, ordered by speed with a small seeded per-round jitter; `timeline()` previews it.
import * as G from './companions.js';
import * as P from './progression.js';
import * as J from './journey.js';
import * as D from './battle-data.js';

export { TYPES, TYPE_INFO, SKILLSETS } from './battle-data.js';
export const GRACE = 5;           // seconds of world time after a battle before the next can begin
export const ENGAGE_RANGE = 2.2;  // tiles between the player and a hostile that starts a battle
export const GROUP_RANGE = 5;     // other hostiles this close to the first join in (max 3)
export const KINDLE_START = 1, KINDLE_MAX = 5, KINDLE_SPEND = 3;
export const FRAY_BONUS = 1.25, STAGGER_BONUS = 1.5, MARK_BONUS = 1.25;
export const FOE_POWER = 2;       // turn-based blows land less often than real-time ones, so each lands harder
export const TIMELINE_LENGTH = 8;
const PLAYER_SPEED = 2.4;

// Compatibility: the single "class skill" of the earlier battle screen. It is now the class's signature damage skill,
// and act({id:'skill'}) without an index still uses it. New code uses skillsFor()/skillList() and {id:'skill', skill:index}.
const SIGNATURE = { warrior: 1, mage: 0, ranger: 0, summoner: 0, default: 0 };
export const SKILLS = Object.fromEntries(Object.entries(SIGNATURE).map(([c, i]) => { const k = D.SKILLSETS[c][i]; return [c, { name: k.name, mp: k.mp, hint: k.hint, index: i }]; }));
export const skillFor = s => SKILLS[s.player.classId] || SKILLS.default;
export const ITEM_LIST = ['salve', 'bread', 'fish', 'tonic'];

const alive = e => e && !e.deadUntil && e.hp > 0;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const heroName = s => s.player.name || 'You';

// A small deterministic generator so a battle is reproducible from its seed (tests rely on this).
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Stateless hash in [0,1): the per-round speed jitter must be known in advance so the timeline can preview future rounds.
function jitter(seed, round, id) {
  let h = (seed ^ Math.imul(round + 1, 0x9E3779B1)) >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x85EBCA6B) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hostiles(s) {
  const p = s.player;
  return s.enemies.filter(e => alive(e) && e.map === p.map && !e.horror && !e.expired && (e.spawnAt ?? 0) <= s.elapsed);
}

// Returns the enemies that should fight now, or [] when no battle should begin.
export function encounter(s, dist) {
  const p = s.player;
  if (s.settings?.battles === 'real-time' || p.deadUntil || (s.battleGrace || 0) > s.elapsed) return [];
  if (s.journey && !s.journey.created) return [];
  const list = hostiles(s);
  const first = list.filter(e => dist(e, p) <= ENGAGE_RANGE).sort((a, b) => dist(a, p) - dist(b, p))[0];
  if (!first) return [];
  return [first, ...list.filter(e => e !== first && dist(e, first) <= GROUP_RANGE && dist(e, p) <= GROUP_RANGE + 2).sort((a, b) => dist(a, first) - dist(b, first)).slice(0, 2)];
}

export const foe = (b, s) => b.foes.map(id => s.enemies.find(e => e.id === id)).filter(Boolean);
export const livingFoes = (b, s) => foe(b, s).filter(alive);
const find = (s, id) => s.enemies.find(e => e.id === id);
const companion = s => (s.guardian && !s.guardian.fallen && G.COMPANIONS[s.guardian.kind]) ? s.guardian : null;
export const attackType = s => s.player.weapon === 'bow' ? 'bow' : 'blade';
export const staggered = (b, id) => (b.st[id]?.staggerUntil || 0) >= b.round;

export function begin(s, foes, ctx = {}, seed = Math.floor(s.elapsed * 1000) + s.kills * 7919) {
  seed = seed >>> 0;
  const b = {
    seed, foes: foes.map(e => e.id), round: 1, turnOrder: [], cursor: 0, phase: 'command', log: [], rand: rng(seed),
    kindle: KINDLE_START, guard: false, wallUntil: 0, shield: 0, cover: false,
    st: {}, comp: { ticks: 0, charged: false, firstHit: {}, empowerUntil: 0, bleed: {} },
    stats: { hits: 0, frays: 0, revealed: 0, staggers: 0, best: 0, kindle: 0, skills: 0 },
    result: null,
    start: { gold: s.player.gold, xp: s.player.xp, level: s.player.level, kills: s.kills, inv: { ...s.inv } }, hpAtStart: s.player.hp
  };
  for (const e of foes) { const d = D.foeData(e); b.st[e.id] = { ward: d.ward, maxWard: d.ward, frays: d.frays.slice(), revealed: [], tested: [], staggerUntil: 0, steady: false, slowUntil: 0, markUntil: 0, acts: 0, charging: false, boss: !!d.boss }; }
  b.log.push(foes.length > 1 ? `${foes.length} foes bar the way!` : `${foes[0].name} bars the way!`);
  b.turnOrder = orderFor(b, s, 1); b.cursor = 0;
  const first = advance(b, s, ctx.now ?? Date.now(), ctx);
  first.events.unshift(ev(b, s, 'round', { gained: 0, text: b.log[0] }));
  if (b.phase === 'over') settle(b, s);
  return first;
}

function speedOf(b, s, id, round) {
  let v = id === 'player' ? PLAYER_SPEED : id === 'guardian' ? (G.COMPANIONS[s.guardian?.kind]?.speed || 3) * .6 : (find(s, id)?.speed || 1.5) * 1.1;
  if (b.st[id] && b.st[id].slowUntil >= round) v *= .35;   // snared or chilled: acts last that round
  return v * (.92 + .16 * jitter(b.seed, round, id));
}
// Everyone still standing, fastest first (ties by id so the order never depends on array order).
function orderFor(b, s, round) {
  const ids = ['player'];
  if (companion(s)) ids.push('guardian');
  for (const id of b.foes) if (alive(find(s, id))) ids.push(id);
  const sp = Object.fromEntries(ids.map(id => [id, speedOf(b, s, id, round)]));
  return ids.sort((x, y) => sp[y] - sp[x] || (x < y ? -1 : 1));
}
const present = (b, s, id) => id === 'player' ? !s.player.deadUntil && s.player.hp > 0 : id === 'guardian' ? !!companion(s) : alive(find(s, id));
const nameOf = (s, id) => id === 'player' ? heroName(s) : id === 'guardian' ? s.guardian?.name || 'Companion' : find(s, id)?.name || 'Foe';

// The next `n` turns: the rest of this round, then predicted future rounds. Staggered foes stay in the strip, greyed
// (`skip`), for the turns they will lose. `special` marks the turn on which a readied special will land.
export function timeline(b, s, n = TIMELINE_LENGTH) {
  const out = [], warned = new Set();
  if (b.phase === 'over') return out;
  const push = (id, round, current) => {
    const st = b.st[id], skip = !!st && (st.staggerUntil || 0) >= round;
    let special = null;
    if (st && st.charging && !skip && !warned.has(id)) { warned.add(id); special = D.foeData(find(s, id)).special.name; }
    out.push({ id, round, current, skip, special, name: nameOf(s, id), side: id === 'player' ? 'hero' : id === 'guardian' ? 'ally' : 'foe', kind: id === 'player' ? 'hero' : id === 'guardian' ? s.guardian?.kind : find(s, id)?.kind });
  };
  for (let i = b.cursor; i < b.turnOrder.length && out.length < n; i++) if (present(b, s, b.turnOrder[i])) push(b.turnOrder[i], b.round, i === b.cursor);
  for (let r = b.round + 1; out.length < n && r <= b.round + 8; r++) for (const id of orderFor(b, s, r)) { if (out.length >= n) break; push(id, r, false); }
  return out;
}

export function baseDamage(s, spell = false) {
  const p = s.player;
  return (spell ? 25 : p.weapon === 'bow' ? 12 : s.inv.sword ? 17 : 11) + p.level * 2 + P.damageBonus(s, spell) + J.strikeBonus(s, spell);
}

const vary = (b, d, spread = .1) => Math.max(1, Math.round(d * (1 - spread + b.rand() * spread * 2)));

function ev(b, s, type, data) { return { type, round: b.round, kindle: b.kindle, hp: snapshot(b, s), ...data }; }
export function snapshot(b, s) {
  const p = s.player, g = s.guardian;
  const out = { player: { hp: Math.round(p.hp), maxHp: p.maxHp, mp: Math.round(p.mp), maxMp: p.maxMp, kindle: b.kindle, guard: b.guard, wall: b.wallUntil >= b.round, shield: b.shield, cover: b.cover } };
  if (g) out.guardian = { hp: Math.round(g.hp), maxHp: g.maxHp, fallen: !!g.fallen, empowered: b.comp.empowerUntil >= b.round };
  out.foes = Object.fromEntries(foe(b, s).map(e => { const st = b.st[e.id]; return [e.id, { hp: Math.round(e.hp), maxHp: e.maxHp, dead: !alive(e), ward: st.ward, maxWard: st.maxWard, frays: st.frays.length, revealed: st.revealed.slice(), tested: st.tested.slice(), staggered: staggered(b, e.id), steady: st.steady, charging: st.charging, marked: st.markUntil >= b.round, slowed: st.slowUntil > b.round }]; }));
  return out;
}

// Skills of the hero's calling, with weapon-typed entries resolved.
export function skillsFor(s) {
  const set = D.SKILLSETS[s.player.classId] || D.SKILLSETS.default;
  return set.map((k, index) => ({ ...k, index, type: k.type === 'weapon' ? attackType(s) : k.type }));
}
export function skillList(b, s) {
  return skillsFor(s).map(k => {
    let why = s.player.mp < k.mp ? `Needs ${k.mp} focus.` : '';
    if (!why && k.target === 'ally' && !s.guardian) why = 'You have no bound companion.';
    if (!why && k.id === 'rally-the-bound' && !companion(s)) why = 'Your minion has fallen. Recall it first.';
    if (!why && k.id === 'mana-surge' && s.player.mp >= s.player.maxMp && s.player.hp >= s.player.maxHp) why = 'Focus and health are full.';
    return { ...k, enabled: !why, why };
  });
}

export function fleeChance(b, s, kindle = 0) {
  const foes = livingFoes(b, s), avg = foes.reduce((a, e) => a + (e.speed || 1.5), 0) / (foes.length || 1);
  const boss = foes.some(e => b.st[e.id]?.boss);
  return Math.min(.95, Math.max(.2, .5 + (PLAYER_SPEED / 1.1 - avg) * .18) * (boss ? .6 : 1) + kindle * .15);
}

export function commands(b, s) {
  const list = skillList(b, s), t = attackType(s);
  return [
    { id: 'attack', label: 'Attack', enabled: true, type: t, hint: `Strike one foe (${D.TYPE_INFO[t].label.toLowerCase()}). Each Kindle adds a hit.` },
    { id: 'skill', label: 'Skills', enabled: list.some(k => k.enabled), hint: list.map(k => k.name).join(' · ') },
    { id: 'guard', label: 'Guard', enabled: true, hint: 'Halve the next blows, recover 4 focus and gain 1 Kindle.' },
    { id: 'item', label: 'Items', enabled: ITEM_LIST.some(i => s.inv[i] > 0), hint: 'Use a salve, food or a tonic.' },
    { id: 'flee', label: 'Flee', enabled: true, hint: `Try to break away (${Math.round(fleeChance(b, s) * 100)}%). Each Kindle adds 15%.` }
  ];
}

// What a command would do to one foe, for the target picker: damage type, whether it is a known Fray (true), known not
// to be one (false) or untested (null), and how many Ward pips the command can remove from that foe.
export function preview(b, s, cmd, targetId) {
  const st = b.st[targetId]; if (!st) return null;
  const k = cmd.id === 'skill' ? skillsFor(s)[cmd.skill ?? skillFor(s).index] : null;
  const type = cmd.id === 'attack' ? attackType(s) : k?.type ?? null;
  const kin = clamp(Math.floor(cmd.kindle || 0), 0, KINDLE_SPEND);
  const fray = !type ? null : st.revealed.includes(type) ? true : st.tested.includes(type) ? false : null;
  let hits = 0;
  if (type) hits = cmd.id === 'attack' ? 1 + kin : k.target === 'one' ? 1 + kin : k.target === 'spread' ? Math.ceil(((k.bolts || 3) + kin) / Math.max(1, livingFoes(b, s).length)) : 1;
  const locked = staggered(b, targetId) || st.steady;
  return { type, fray, hits, wardHits: fray && !locked ? Math.min(st.ward, hits) : 0, staggered: staggered(b, targetId), steady: st.steady, ward: st.ward, maxWard: st.maxWard };
}

function hitFoe(s, target, amount, source, now, ctx) {
  const before = target.hp;
  ctx.hurt(s, target, amount, now, source);
  return Math.max(0, Math.round(before - target.hp));
}

// Stagger: lose turns through the end of next round, take +50% damage, any readied special is broken.
function stagger(b, s, e, events) {
  const st = b.st[e.id];
  st.ward = 0; st.staggerUntil = b.round + 1; b.stats.staggers++;
  const broke = st.charging; st.charging = false;
  events.push(ev(b, s, 'stagger', { dst: e.id, text: `${e.name} is Staggered!${broke ? ' Its ' + D.foeData(e).special.name + ' is broken.' : ''}` }));
}
// Remove one Ward pip (a Fray hit or a perk). Staggered and Steadied foes keep their Ward.
function chipWard(b, s, e, events) {
  const st = b.st[e.id];
  if (!alive(e) || staggered(b, e.id) || st.steady || st.ward <= 0) return false;
  st.ward--;
  if (st.ward === 0) stagger(b, s, e, events);
  return true;
}

// One hit on one foe. src: 'player' | 'guardian'. Returns the damage dealt.
function strike(b, s, e, { type, power = 1, spell = false, src = 'player', verb = 'strikes', now, ctx, events, base = null, idx = 0, n = 1, extra = {} }) {
  if (!alive(e)) return 0;
  const st = b.st[e.id];
  const fray = !!type && st.frays.includes(type), stag = staggered(b, e.id);
  let d = (base ?? baseDamage(s, spell)) * power;
  if (fray) d *= FRAY_BONUS;
  if (stag) d *= STAGGER_BONUS;
  if (st.markUntil >= b.round) d *= MARK_BONUS;
  const crit = src === 'player' && b.rand() < .08;
  if (crit) d *= 1.5;
  d = vary(b, d);
  const dealt = hitFoe(s, e, d, src === 'player' ? 'player' : 'companion', now, ctx);
  let revealed = false;
  if (fray && !st.revealed.includes(type)) { st.revealed.push(type); revealed = true; b.stats.revealed++; }
  if (type && !fray && !st.tested.includes(type)) st.tested.push(type);
  if (src === 'player') { b.stats.hits++; b.stats.best = Math.max(b.stats.best, dealt); if (fray) b.stats.frays++; }
  const who = src === 'player' ? heroName(s) : s.guardian?.name || 'Your companion';
  const tag = fray ? ` — ${D.TYPE_INFO[type].label} is a Fray!` : stag ? ' — Staggered, +50%!' : '';
  const hit = ev(b, s, 'hit', { src: src === 'player' ? 'player' : 'guardian', dst: e.id, amount: dealt, crit, dtype: type, fray, revealed, staggered: stag, idx, n, text: `${who} ${verb} ${e.name} for ${dealt}${crit ? ' (critical)' : ''}${tag}`, ...extra });
  events.push(hit);
  if (fray) { const was = st.ward; if (chipWard(b, s, e, events)) { hit.broke = true; hit.ward = st.ward; hit.hp = snapshot(b, s); events.splice(events.indexOf(hit) + 1, 0); hit.wardFrom = was; } }
  return dealt;
}

// Companion's turn: perks as in the field, tuned for turns. It favours a foe whose Fray matches its own damage type
// (beasts and minions sense weakness), then a Staggered or marked foe, then the weakest. No randomness in the choice.
function companionTarget(b, s, type) {
  const score = e => {
    const st = b.st[e.id], weak = st.frays.includes(type), open = !staggered(b, e.id) && !st.steady && st.ward > 0;
    return (weak ? (open ? 100 : 55) : 0) + (st.markUntil >= b.round ? 40 : 0) + (staggered(b, e.id) ? 30 : 0) - Math.round(e.hp / e.maxHp * 10);
  };
  return livingFoes(b, s).map(e => ({ e, v: score(e) })).sort((x, y) => y.v - x.v || x.e.hp - y.e.hp || (x.e.id < y.e.id ? -1 : 1))[0]?.e || null;
}

function companionTurn(b, s, now, ctx, events, boost = 1) {
  const g = companion(s), def = g && G.COMPANIONS[g.kind];
  if (!g) return;
  const type = D.PERK_TYPE[def.perk] || 'blade';
  const target = companionTarget(b, s, type);
  if (!target) return;
  const emp = b.comp.empowerUntil >= b.round ? 1.5 : 1;
  const base = G.scaledDamage(def, s.player.level) * 1.25 * boost * emp;
  const say = t => events.push(ev(b, s, 'note', { src: 'guardian', text: t }));
  const hit = (t, m, verb, extra) => strike(b, s, t, { type, power: m, src: 'guardian', verb, base, now, ctx, events, extra });
  events.push(ev(b, s, 'act', { src: 'guardian', label: g.name, dtype: type, targets: [target.id] }));
  const third = b.comp.ticks % 3 === 2;
  switch (def.perk) {
    case 'flare': hit(target, third ? 1.6 : 1, third ? 'flares an ember at' : 'hurls an ember at'); break;
    case 'ward': {
      if (s.player.hp < s.player.maxHp * .5 && b.shield <= 0) { b.shield = Math.round(10 + s.player.level * 2); say(`${g.name} raises its shield: the next ${b.shield} damage to you is absorbed.`); }
      else hit(target, s.player.hp < s.player.maxHp * .4 ? 1.25 : 1, 'slashes');
      break;
    }
    case 'chill': { if (hit(target, 1, 'chills') && alive(target) && b.rand() < .5 && b.st[target.id].slowUntil <= b.round) { b.st[target.id].slowUntil = b.round + 1; say(`${target.name} is numbed and will act last next round.`); } break; }
    case 'stagger': { hit(target, 1, third ? 'crushes' : 'pounds'); if (third && chipWard(b, s, target, events)) say(`The crushing blow cracks ${target.name}'s Ward.`); break; }
    case 'rend': { hit(target, third ? 1.5 : 1, third ? 'rends' : 'bites'); if (alive(target)) b.comp.bleed[target.id] = 2; break; }
    case 'charge': { const first = !b.comp.charged; b.comp.charged = true; hit(target, first ? 1.8 : 1, first ? 'charges into' : 'gores'); if (first && chipWard(b, s, target, events)) say(`The charge cracks ${target.name}'s Ward.`); break; }
    case 'pounce': { const first = !b.comp.firstHit[target.id]; b.comp.firstHit[target.id] = true; hit(target, first ? 1.5 : 1, first ? 'pounces on' : 'rakes'); break; }
    case 'dive': { hit(target, .62, 'dives at'); const t2 = companionTarget(b, s, type); if (t2) hit(t2, .62, 'dives at'); break; }
    default: hit(target, 1, 'strikes');
  }
  b.comp.ticks++;
}

function hurtPlayer(b, s, e, raw, now, ctx, events, label) {
  let scale = 1;
  if (b.guard) scale *= .5;
  if (b.wallUntil >= b.round) scale *= .5;
  let d = Math.max(1, Math.round(raw * Math.max(.3, scale)));
  if (b.shield > 0) {
    const absorbed = Math.min(b.shield, d); b.shield -= absorbed; d -= absorbed;
    if (d <= 0) { events.push(ev(b, s, 'hit', { src: e.id, dst: 'player', amount: 0, blocked: true, text: `The shield swallows ${e.name}'s ${label}.` })); return; }
  }
  const before = s.player.hp;
  ctx.hurt(s, s.player, d, now, e.id);
  const taken = Math.max(0, Math.round(before - s.player.hp));
  events.push(ev(b, s, 'hit', { src: e.id, dst: 'player', amount: taken, guarded: scale < 1, text: `${e.name}'s ${label} hits ${heroName(s)} for ${taken}${scale < 1 ? ' (guarded)' : ''}.` }));
}
function hurtCompanion(b, s, e, raw, now, ctx, events, label) {
  const g = companion(s); if (!g) return;
  const d = Math.max(1, Math.round(raw * (b.wallUntil >= b.round ? .5 : 1)));
  const before = g.hp;
  G.damage(s, d, { note: ctx.note });
  events.push(ev(b, s, 'hit', { src: e.id, dst: 'guardian', amount: Math.round(before - g.hp), text: `${e.name}'s ${label} hits ${g.name} for ${Math.round(before - g.hp)}.` }));
  if (g.fallen) events.push(ev(b, s, 'note', { dst: 'guardian', text: `${g.name} falls! Recall can bring it back.` }));
}

function foeTurn(b, s, e, now, ctx, events) {
  const st = b.st[e.id], d = D.foeData(e);
  if (staggered(b, e.id)) { events.push(ev(b, s, 'skip', { src: e.id, text: `${e.name} is Staggered and cannot act.` })); return; }
  st.steady = false;
  const special = st.charging, move = special ? d.special : { name: d.move, mult: 1, area: 'one' };
  st.charging = false; st.acts++;
  const raw = () => vary(b, e.attack * FOE_POWER * move.mult * (e.hunter ? 1.1 : 0) + e.attack * FOE_POWER * move.mult * (e.hunter ? 0 : 1), .12);
  const ally = companion(s);
  let pick = 'player';
  if (move.area === 'all') pick = 'all';
  else if (ally && b.rand() < .35) pick = 'guardian';
  if (pick === 'player' && ally && b.cover) { pick = 'guardian'; b.cover = false; events.push(ev(b, s, 'note', { src: 'guardian', text: `${ally.name} leaps in front of the blow!` })); }
  events.push(ev(b, s, 'act', { src: e.id, label: move.name, special, targets: pick === 'all' ? ['player', ...(ally ? ['guardian'] : [])] : [pick] }));
  if (pick === 'player' || pick === 'all') hurtPlayer(b, s, e, raw(), now, ctx, events, move.name);
  if ((pick === 'guardian' || pick === 'all') && companion(s)) hurtCompanion(b, s, e, raw() * (b.cover === false && pick === 'guardian' && !special ? 1 : 1), now, ctx, events, move.name);
  const every = st.boss ? 2 : 3;
  if (alive(e) && st.acts % every === every - 1) { st.charging = true; events.push(ev(b, s, 'telegraph', { src: e.id, move: d.special.name, text: `${e.name} readies ${d.special.name}! Stagger it to break it.` })); }
}

function endRound(b, s, now, ctx, events) {
  for (const e of livingFoes(b, s)) if (b.comp.bleed[e.id] > 0) {
    b.comp.bleed[e.id]--;
    const dealt = hitFoe(s, e, 3 + Math.floor(s.player.level / 2), 'companion', now, ctx);
    events.push(ev(b, s, 'hit', { src: 'guardian', dst: e.id, amount: dealt, bleed: true, text: `${e.name} bleeds for ${dealt}.` }));
  }
  for (const e of livingFoes(b, s)) {
    const st = b.st[e.id];
    if (st.staggerUntil && st.staggerUntil <= b.round) { st.staggerUntil = 0; st.ward = st.maxWard; st.steady = true; events.push(ev(b, s, 'recover', { dst: e.id, text: `${e.name} recovers. Its Ward is whole again.` })); }
  }
  b.round++;
  const gained = b.kindle < KINDLE_MAX ? 1 : 0;
  b.kindle = Math.min(KINDLE_MAX, b.kindle + 1);
  b.turnOrder = orderFor(b, s, b.round); b.cursor = 0;
  events.push(ev(b, s, 'round', { gained, text: `Round ${b.round}.${gained ? ' +1 Kindle.' : ''}` }));
}

// Run automatic turns until the player must choose or the battle ends. Returns {b, events}.
export function advance(b, s, now = Date.now(), ctx = {}) {
  const events = [];
  const finish = (result, text) => { b.result = result; b.phase = 'over'; events.push(ev(b, s, 'end', { result, text })); };
  // Every round contains the player, so this always stops within two rounds; the bound is only a safety net.
  for (let guard = 0; guard < 400 && b.phase !== 'over'; guard++) {
    if (s.player.deadUntil || s.player.hp <= 0) { finish('lost', 'You have fallen.'); break; }
    if (!livingFoes(b, s).length) { finish('won', 'Victory!'); break; }
    if (b.cursor >= b.turnOrder.length) { endRound(b, s, now, ctx, events); continue; }
    const id = b.turnOrder[b.cursor];
    if (id === 'player') { b.phase = 'command'; events.push(ev(b, s, 'turn', { who: 'player', tl: timeline(b, s) })); return { b, events }; }
    b.cursor++;
    if (!present(b, s, id)) continue;
    events.push(ev(b, s, 'turn', { who: id, tl: timeline(b, s) }));
    if (id === 'guardian') companionTurn(b, s, now, ctx, events);
    else foeTurn(b, s, find(s, id), now, ctx, events);
  }
  if (b.phase !== 'over') { b.turnOrder = orderFor(b, s, b.round); b.cursor = b.turnOrder.indexOf('player'); b.phase = 'command'; }
  return { b, events };
}

// Perform the player's command, then run everyone else's turns up to the next command. Returns {events, over}.
// cmd: {id:'attack'|'skill'|'guard'|'item'|'flee', target?, skill?: 0..2, item?, kindle?: 0..3}
export function act(b, s, cmd, ctx) {
  const now = ctx.now ?? Date.now(), events = [];
  if (b.phase !== 'command' || b.turnOrder[b.cursor] !== 'player') return { events, over: b.phase === 'over', error: 'Not your turn.' };
  const foes = livingFoes(b, s);
  const target = foes.find(e => e.id === cmd.target) || foes[0];
  const p = s.player;
  const spendable = ['attack', 'skill', 'flee'].includes(cmd.id) ? Math.min(KINDLE_SPEND, b.kindle) : 0;
  const k = clamp(Math.floor(Number(cmd.kindle) || 0), 0, spendable);
  let spent = true;
  const spend = () => { if (k) { b.kindle -= k; b.stats.kindle += k; } };
  const opts = extra => ({ now, ctx, events, ...extra });
  b.guard = false;
  switch (cmd.id) {
    case 'attack': {
      const type = attackType(s); spend();
      events.push(ev(b, s, 'act', { src: 'player', label: 'Attack', dtype: type, kindle: k, targets: [target.id] }));
      const verb = p.weapon === 'bow' ? 'looses an arrow at' : 'strikes';
      for (let i = 0; i <= k; i++) { const t = alive(target) ? target : livingFoes(b, s)[0]; if (!t) break; strike(b, s, t, opts({ type, verb, idx: i, n: k + 1 })); }
      break;
    }
    case 'skill': {
      const list = skillList(b, s), sk = list[Number.isInteger(cmd.skill) ? cmd.skill : skillFor(s).index];
      if (!sk || !sk.enabled) { spent = false; events.push(ev(b, s, 'note', { text: sk?.why || 'Choose a skill.' })); break; }
      p.mp -= sk.mp; spend(); b.stats.skills++;
      useSkill(b, s, sk, target, k, now, ctx, events);
      break;
    }
    case 'guard':
      b.guard = true; p.mp = Math.min(p.maxMp, p.mp + 4);
      { const gained = b.kindle < KINDLE_MAX ? 1 : 0; b.kindle = Math.min(KINDLE_MAX, b.kindle + 1);
        events.push(ev(b, s, 'guard', { src: 'player', gained, text: `${heroName(s)} braces for the next blows.${gained ? ' +1 Kindle.' : ''}` })); }
      break;
    case 'item': {
      const item = ITEM_LIST.includes(cmd.item) ? cmd.item : null;
      if (!item || !(s.inv[item] > 0)) { spent = false; events.push(ev(b, s, 'note', { text: 'Nothing like that in your pack.' })); break; }
      const hp = p.hp, mp = p.mp, text = ctx.use ? ctx.use(s, item) : 'Used.';
      events.push(ev(b, s, 'heal', { src: 'player', dst: 'player', item, amount: Math.round(p.hp - hp), focus: Math.round(p.mp - mp), text }));
      break;
    }
    case 'flee': {
      const chance = fleeChance(b, s, k); spend();
      if (b.rand() < chance) {
        events.push(ev(b, s, 'end', { result: 'fled', text: 'You break away!' })); b.result = 'fled'; b.phase = 'over';
        for (const e of foes) { e.cd = Math.max(e.cd || 0, 3); e.path = []; }
        s.battleGrace = s.elapsed + GRACE + 3;
        return { events, over: true };
      }
      events.push(ev(b, s, 'note', { text: 'No escape — they cut you off!' }));
      break;
    }
    default: spent = false;
  }
  if (!spent) return { events, over: false };
  b.cursor++;
  const rest = advance(b, s, now, ctx);
  events.push(...rest.events);
  if (b.phase === 'over') settle(b, s);
  return { events, over: b.phase === 'over' };
}

function useSkill(b, s, sk, target, k, now, ctx, events) {
  const p = s.player, name = heroName(s), say = (t, data = {}) => events.push(ev(b, s, 'note', { src: 'player', text: t, ...data }));
  const act = targets => events.push(ev(b, s, 'act', { src: 'player', label: sk.name, skill: sk.id, dtype: sk.type, kindle: k, spell: !!sk.spell, targets }));
  const hitAll = (power, verb) => { for (const e of livingFoes(b, s)) strike(b, s, e, { type: sk.type, power, spell: sk.spell, verb, now, ctx, events }); };
  const healHero = n => { const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + n); events.push(ev(b, s, 'heal', { src: 'player', dst: 'player', amount: Math.round(p.hp - before), text: `${name} recovers ${Math.round(p.hp - before)} health.` })); };
  const ids = () => livingFoes(b, s).map(e => e.id);
  switch (sk.id) {
    case 'shield-wall': act(['player']); b.wallUntil = b.round + sk.rounds - 1 + k; b.guard = true; say(`${name} raises a shield wall: half damage to the party for ${sk.rounds + k} rounds.`); break;
    case 'cleave': act(ids()); hitAll(sk.power * (1 + .4 * k), 'cleaves'); break;
    case 'rallying-cry': act(ids()); healHero(sk.heal + 12 * k); hitAll(sk.power, 'shouts down'); break;
    case 'arcane-volley': {
      act(ids()); const n = sk.bolts + k;
      // Bolts walk along the line of foes starting at the chosen target, so the player decides where most of them land.
      for (let i = 0; i < n; i++) { const list = livingFoes(b, s); if (!list.length) break; const start = Math.max(0, list.indexOf(alive(target) ? target : list[0])); strike(b, s, list[(start + i) % list.length], { type: sk.type, power: sk.power, spell: true, verb: 'blasts', now, ctx, events, idx: i, n }); }
      break;
    }
    case 'frost-nova': act(ids()); hitAll(sk.power * (1 + .4 * k), 'freezes'); for (const e of livingFoes(b, s)) b.st[e.id].slowUntil = Math.max(b.st[e.id].slowUntil, b.round + sk.slow); say('The frost slows every foe: they act last next round.'); break;
    case 'mana-surge': { act(['player']); const before = p.mp; p.mp = Math.min(p.maxMp, p.mp + Math.round(p.maxMp / 2)); healHero(sk.heal + 10 * k); events.push(ev(b, s, 'heal', { src: 'player', dst: 'player', amount: 0, focus: Math.round(p.mp - before), text: `${name} draws in ${Math.round(p.mp - before)} focus.` })); break; }
    case 'piercing-shot': case 'spirit-lash': case 'power-strike': {
      act([target.id]);
      const verb = sk.id === 'piercing-shot' ? 'pierces' : sk.id === 'spirit-lash' ? 'lashes' : 'smashes';
      for (let i = 0; i <= k; i++) { const t = alive(target) ? target : livingFoes(b, s)[0]; if (!t) break; strike(b, s, t, { type: sk.type, power: sk.power, spell: sk.spell, verb, now, ctx, events, idx: i, n: k + 1 }); }
      break;
    }
    case 'snare-trap': act(ids()); hitAll(sk.power, 'snares'); for (const e of livingFoes(b, s)) b.st[e.id].slowUntil = Math.max(b.st[e.id].slowUntil, b.round + sk.slow + k); say(`Snared foes act last for ${sk.slow + k} round${sk.slow + k > 1 ? 's' : ''}.`); break;
    case 'hunters-mark': {
      act([target.id]); const st = b.st[target.id];
      for (const t of st.frays) if (!st.revealed.includes(t)) { st.revealed.push(t); b.stats.revealed++; }
      st.markUntil = b.round + sk.mark - 1 + k;
      events.push(ev(b, s, 'reveal', { src: 'player', dst: target.id, types: st.frays.slice(), text: `${target.name} is marked for ${sk.mark + k} rounds. Frays: ${st.frays.map(t => D.TYPE_INFO[t].label).join(', ')}.` }));
      break;
    }
    case 'rally-the-bound': {
      act(['guardian']); const g = companion(s);
      G.heal(s, sk.heal); b.comp.empowerUntil = b.round + sk.empower - 1 + k;
      say(`${g.name} is healed and empowered for ${sk.empower + k} rounds!`);
      companionTurn(b, s, now, ctx, events);
      break;
    }
    case 'recall': {
      act(['guardian']); const g = s.guardian, was = g.fallen;
      if (was) { const text = G.recall(s); say(text); if (k) G.heal(s, .15 * k); }
      else { G.heal(s, sk.heal + .15 * k); b.cover = true; say(`${g.name} returns to your side, healed, and will take the next blow meant for you.`); }
      // A recalled companion joins the turn order from the next round (orderFor reads it fresh).
      break;
    }
    case 'sweeping-blow': act(ids()); hitAll(sk.power * (1 + .4 * k), 'sweeps'); break;
    case 'second-wind': act(['player']); healHero(sk.heal + 10 * k); break;
    default: act([target.id]); strike(b, s, target, { type: sk.type, power: sk.power || 1, spell: sk.spell, now, ctx, events });
  }
}

export function settle(b, s) {
  s.battleGrace = s.elapsed + GRACE;
  const items = Object.fromEntries(Object.keys({ ...b.start.inv, ...s.inv }).map(k => [k, (s.inv[k] || 0) - (b.start.inv?.[k] || 0)]).filter(([, n]) => n > 0));
  b.summary = { gold: s.player.gold - b.start.gold, xp: s.player.xp - b.start.xp, level: s.player.level, leveled: s.player.level > b.start.level, kills: s.kills - b.start.kills, rounds: b.round, items, ...b.stats };
  for (const e of foe(b, s)) if (alive(e)) e.cd = Math.max(e.cd || 0, 2);
}
