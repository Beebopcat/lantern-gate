// Turn-based JRPG battles. Pure rules: the UI only renders what this module reports.
// The world's own combat rules stay authoritative: damage to foes goes through hurt(), so gold, experience, loot,
// raid credit and respawns behave exactly like a real-time kill. Nothing here is saved; a reload simply resumes.
import * as G from './companions.js';
import * as P from './progression.js';
import * as J from './journey.js';

export const GRACE = 5;           // seconds of world time after a battle before the next can begin
export const ENGAGE_RANGE = 2.2;  // tiles between the player and a hostile that starts a battle
export const GROUP_RANGE = 5;     // other hostiles this close to the first join in (max 3)

export const SKILLS = {
  warrior:  { name: 'Cleave',        mp: 8,  hint: 'Hits every foe for 70% damage.' },
  mage:     { name: 'Arcane Bolt',   mp: 10, hint: 'One foe takes heavy arcane damage.' },
  ranger:   { name: 'Piercing Volley', mp: 8, hint: 'Three arrows at random foes.' },
  summoner: { name: 'Rally',         mp: 10, hint: 'Your minion strikes twice, stronger.' },
  default:  { name: 'Power Strike',  mp: 8,  hint: 'One foe takes 160% damage.' }
};
export const skillFor = s => SKILLS[s.player.classId] || SKILLS.default;
export const ITEM_LIST = ['salve', 'bread', 'fish', 'tonic'];

const alive = e => e && !e.deadUntil && e.hp > 0;

// A small deterministic generator so a battle is reproducible from its seed (tests rely on this).
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

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
  const group = [first, ...list.filter(e => e !== first && dist(e, first) <= GROUP_RANGE && dist(e, p) <= GROUP_RANGE + 2).sort((a, b) => dist(a, first) - dist(b, first)).slice(0, 2)];
  return group;
}

export function begin(s, foes, ctx = {}, seed = Math.floor(s.elapsed * 1000) + s.kills * 7919) {
  const g = s.guardian && !s.guardian.fallen ? s.guardian : null;
  const b = {
    foes: foes.map(e => e.id), round: 1, turnOrder: [], cursor: 0, phase: 'command', log: [], rand: rng(seed),
    guard: false, shield: 0, skip: {}, bleed: {}, firstHit: {}, charged: false, ticks: 0, result: null,
    start: { gold: s.player.gold, xp: s.player.xp, level: s.player.level, kills: s.kills }, hpAtStart: s.player.hp
  };
  b.log.push(foes.length > 1 ? `${foes.length} foes bar the way!` : `${foes[0].name} bars the way!`);
  orderRound(b, s, g);
  const first = advance(b, s, ctx.now ?? Date.now(), ctx);
  if (b.phase === 'over') settle(b, s);
  return first;
}

const speedOf = (b, s, id) => {
  if (id === 'player') return 2.4;
  if (id === 'guardian') return (G.COMPANIONS[s.guardian?.kind]?.speed || 3) * .6;
  return (s.enemies.find(e => e.id === id)?.speed || 1.5) * 1.1;
};

function orderRound(b, s) {
  const ids = ['player'];
  if (s.guardian && !s.guardian.fallen) ids.push('guardian');
  for (const id of b.foes) if (alive(s.enemies.find(e => e.id === id))) ids.push(id);
  b.turnOrder = ids.sort((x, y) => speedOf(b, s, y) - speedOf(b, s, x) || x.localeCompare(y));
  b.cursor = 0;
}

export const foe = (b, s) => b.foes.map(id => s.enemies.find(e => e.id === id)).filter(Boolean);
export const livingFoes = (b, s) => foe(b, s).filter(alive);

export function baseDamage(s, spell = false) {
  const p = s.player;
  return (spell ? 25 : p.weapon === 'bow' ? 12 : s.inv.sword ? 17 : 11) + p.level * 2 + P.damageBonus(s, spell) + J.strikeBonus(s, spell);
}

const vary = (b, d, spread = .15) => Math.max(1, Math.round(d * (1 - spread + b.rand() * spread * 2)));

function ev(b, s, type, data) { return { type, round: b.round, hp: snapshot(b, s), ...data }; }
export function snapshot(b, s) {
  const out = { player: { hp: Math.round(s.player.hp), maxHp: s.player.maxHp, mp: Math.round(s.player.mp), maxMp: s.player.maxMp } };
  if (s.guardian) out.guardian = { hp: Math.round(s.guardian.hp), maxHp: s.guardian.maxHp, fallen: !!s.guardian.fallen };
  out.foes = Object.fromEntries(foe(b, s).map(e => [e.id, { hp: Math.round(e.hp), maxHp: e.maxHp, dead: !alive(e) }]));
  return out;
}

export function commands(b, s) {
  const k = skillFor(s);
  return [
    { id: 'attack', label: 'Attack', enabled: true },
    { id: 'skill', label: k.name, enabled: s.player.mp >= k.mp, cost: k.mp, hint: k.hint },
    { id: 'guard', label: 'Guard', enabled: true, hint: 'Halve the next blow and recover mana.' },
    { id: 'item', label: 'Item', enabled: ITEM_LIST.some(i => s.inv[i] > 0) },
    { id: 'flee', label: 'Flee', enabled: true }
  ];
}

function hitFoe(s, b, target, amount, source, now, ctx) {
  const before = target.hp;
  ctx.hurt(s, target, amount, now, source);
  return Math.max(0, Math.round(before - target.hp));
}

function playerStrike(b, s, target, mult, spell, now, ctx, events, verb) {
  let d = baseDamage(s, spell) * mult;
  const crit = b.rand() < .1;
  if (crit) d *= 1.5;
  d = vary(b, d);
  const dealt = hitFoe(s, b, target, d, 'player', now, ctx);
  events.push(ev(b, s, 'hit', { src: 'player', dst: target.id, amount: dealt, crit, text: `${s.player.name || 'You'} ${verb} ${target.name} for ${dealt}${crit ? ' — critical!' : '.'}` }));
}

function companionTurn(b, s, now, ctx, events, boost = 1) {
  const g = s.guardian, def = G.COMPANIONS[g?.kind];
  if (!g || g.fallen || !def) return;
  const foes = livingFoes(b, s);
  if (!foes.length) return;
  const tgt = () => foes[Math.floor(b.rand() * foes.length)];
  const target = b.rand() < .5 ? foes.slice().sort((x, y) => x.hp - y.hp)[0] : tgt();
  const dmg = G.scaledDamage(def, s.player.level) * 1.25 * boost;
  const say = t => events.push(ev(b, s, 'note', { text: t }));
  const strike = (t, m, label, extra = {}) => {
    if (!alive(t)) return 0;
    const d = vary(b, dmg * m, .12), dealt = hitFoe(s, b, t, d, 'companion', now, ctx);
    events.push(ev(b, s, 'hit', { src: 'guardian', dst: t.id, amount: dealt, text: `${g.name} ${label} ${t.name} for ${dealt}.`, ...extra }));
    return dealt;
  };
  switch (def.perk) {
    case 'flare': { const flare = b.ticks % 3 === 2; strike(target, flare ? 1.6 : 1, flare ? 'flares an ember at' : 'hurls an ember at'); break; }
    case 'ward': {
      const hurting = s.player.hp < s.player.maxHp * .5;
      if (hurting && b.shield <= 0) { b.shield = Math.round(10 + s.player.level * 2); say(`${g.name} raises its shield — ${b.shield} damage will be absorbed.`); }
      else strike(target, s.player.hp < s.player.maxHp * .4 ? 1.25 : 1, 'slashes');
      break;
    }
    case 'chill': { if (strike(target, 1, 'chills') && alive(target) && b.rand() < .45) { b.skip[target.id] = (b.skip[target.id] || 0) + 1; say(`${target.name} is slowed.`); } break; }
    case 'stagger': { const thud = b.ticks % 3 === 2; strike(target, 1, thud ? 'crushes' : 'smashes'); if (thud && alive(target)) { b.skip[target.id] = (b.skip[target.id] || 0) + 1; say(`${target.name} is staggered.`); } break; }
    case 'rend': {
      const bite = b.ticks % 3 === 2; strike(target, bite ? 1.5 : 1, bite ? 'rends' : 'bites');
      if (alive(target)) b.bleed[target.id] = 2;
      break;
    }
    case 'charge': { const first = !b.charged; b.charged = true; strike(target, first ? 1.8 : 1, first ? 'charges into' : 'gores'); if (first && alive(target)) { b.skip[target.id] = (b.skip[target.id] || 0) + 1; say(`${target.name} reels from the charge.`); } break; }
    case 'pounce': { const first = !b.firstHit[target.id]; b.firstHit[target.id] = true; strike(target, first ? 1.5 : 1, first ? 'pounces on' : 'rakes'); break; }
    case 'dive': { for (let i = 0; i < 2; i++) { const t = livingFoes(b, s); if (!t.length) break; strike(t[Math.floor(b.rand() * t.length)], .62, 'dives at'); } break; }
    default: strike(target, 1, 'strikes');
  }
  b.ticks++;
}

function foeTurn(b, s, e, now, ctx, events) {
  if (b.skip[e.id] > 0) { b.skip[e.id]--; events.push(ev(b, s, 'note', { text: `${e.name} loses its footing and cannot act.` })); return; }
  const guardian = s.guardian && !s.guardian.fallen ? s.guardian : null;
  const pick = guardian && b.rand() < .35 ? 'guardian' : 'player';
  let d = vary(b, e.attack * (1 + (e.hunter ? .1 : 0)), .15);
  if (pick === 'guardian') {
    G.damage(s, d, { note: ctx.note });
    events.push(ev(b, s, 'hit', { src: e.id, dst: 'guardian', amount: d, text: `${e.name} mauls ${guardian.name} for ${d}.` }));
    return;
  }
  if (b.guard) { d = Math.max(1, Math.round(d / 2)); }
  if (b.shield > 0) { const absorbed = Math.min(b.shield, d); b.shield -= absorbed; d -= absorbed; if (d <= 0) { events.push(ev(b, s, 'note', { text: `The shield swallows ${e.name}'s blow.` })); return; } }
  const before = s.player.hp;
  ctx.hurt(s, s.player, d, now, e.id);
  const taken = Math.max(0, Math.round(before - s.player.hp));
  events.push(ev(b, s, 'hit', { src: e.id, dst: 'player', amount: taken, text: `${e.name} hits ${s.player.name || 'you'} for ${taken}${b.guard ? ' (guarded)' : ''}.` }));
}

// Run automatic turns until the player must choose or the battle ends. Returns {b, events}.
export function advance(b, s, now = Date.now(), ctx = {}) {
  const events = [];
  const finish = result => { b.result = result; b.phase = 'over'; return result; };
  for (let guard = 0; guard < 200 && b.phase !== 'over'; guard++) {
    if (s.player.deadUntil || s.player.hp <= 0) { finish('lost'); events.push(ev(b, s, 'end', { result: 'lost', text: 'You have fallen.' })); break; }
    if (!livingFoes(b, s).length) { finish('won'); events.push(ev(b, s, 'end', { result: 'won', text: 'Victory!' })); break; }
    if (b.cursor >= b.turnOrder.length) {
      // end of round: bleeding, then a fresh order
      for (const e of livingFoes(b, s)) if (b.bleed[e.id] > 0) {
        b.bleed[e.id]--;
        const dealt = ctx.hurt ? hitFoe(s, b, e, 3 + Math.floor(s.player.level / 2), 'companion', now, ctx) : 0;
        events.push(ev(b, s, 'hit', { src: 'guardian', dst: e.id, amount: dealt, text: `${e.name} bleeds for ${dealt}.` }));
      }
      b.round++; orderRound(b, s);
      continue;
    }
    const id = b.turnOrder[b.cursor];
    if (id === 'player') {
      b.phase = 'command'; break;
    }
    b.cursor++;
    if (id === 'guardian') { companionTurn(b, s, now, ctx, events); continue; }
    const e = s.enemies.find(x => x.id === id);
    if (alive(e)) foeTurn(b, s, e, now, ctx, events);
  }
  return { b, events };
}

// Perform the player's command, then run everyone else's turns up to the next command. Returns {events, over}.
export function act(b, s, cmd, ctx) {
  const now = ctx.now ?? Date.now(), events = [];
  if (b.phase !== 'command' || b.turnOrder[b.cursor] !== 'player') return { events, over: b.phase === 'over', error: 'Not your turn.' };
  const foes = livingFoes(b, s);
  const target = foes.find(e => e.id === cmd.target) || foes[0];
  const p = s.player, skill = skillFor(s);
  let spent = true;
  b.guard = false;
  switch (cmd.id) {
    case 'attack': playerStrike(b, s, target, 1, false, now, ctx, events, p.weapon === 'bow' ? 'looses an arrow at' : 'strikes'); break;
    case 'skill': {
      if (p.mp < skill.mp) { spent = false; events.push(ev(b, s, 'note', { text: 'Not enough mana.' })); break; }
      p.mp -= skill.mp;
      if (p.classId === 'warrior') { events.push(ev(b, s, 'note', { text: `${p.name || 'You'} sweep a wide arc!` })); for (const e of foes) playerStrike(b, s, e, .7, false, now, ctx, events, 'cleaves'); }
      else if (p.classId === 'mage') playerStrike(b, s, target, 1.5, true, now, ctx, events, 'blasts');
      else if (p.classId === 'ranger') { for (let i = 0; i < 3; i++) { const l = livingFoes(b, s); if (!l.length) break; playerStrike(b, s, l[Math.floor(b.rand() * l.length)], .62, false, now, ctx, events, 'pierces'); } }
      else if (p.classId === 'summoner') { if (s.guardian && !s.guardian.fallen) { events.push(ev(b, s, 'note', { text: `${s.guardian.name} answers the call!` })); companionTurn(b, s, now, ctx, events, 1.4); companionTurn(b, s, now, ctx, events, 1.4); } else playerStrike(b, s, target, 1.6, false, now, ctx, events, 'smashes'); }
      else playerStrike(b, s, target, 1.6, false, now, ctx, events, 'smashes');
      break;
    }
    case 'guard': b.guard = true; p.mp = Math.min(p.maxMp, p.mp + 4); events.push(ev(b, s, 'note', { text: `${p.name || 'You'} brace${p.name ? 's' : ''} for the next blow.` })); break;
    case 'item': {
      const item = ITEM_LIST.includes(cmd.item) ? cmd.item : null;
      if (!item || !(s.inv[item] > 0)) { spent = false; events.push(ev(b, s, 'note', { text: 'Nothing like that in your pack.' })); break; }
      events.push(ev(b, s, 'note', { text: ctx.use ? ctx.use(s, item) : 'Used.' }));
      break;
    }
    case 'flee': {
      const avg = foes.reduce((a, e) => a + (e.speed || 1.5), 0) / (foes.length || 1);
      const chance = Math.min(.9, Math.max(.2, .5 + (2.4 / 1.1 - avg) * .18));
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

export function settle(b, s) {
  s.battleGrace = s.elapsed + GRACE;
  b.summary = { gold: s.player.gold - b.start.gold, xp: s.player.xp - b.start.xp, level: s.player.level, leveled: s.player.level > b.start.level, kills: s.kills - b.start.kills };
  for (const e of foe(b, s)) if (alive(e)) e.cd = Math.max(e.cd || 0, 2);
}
