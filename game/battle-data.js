// Battle data tables for the turn-based encounters: damage types, foe Wards and Frays, foe moves, class skills.
// Pure data (no state). battle.js applies the rules; battle-ui.js only reads labels and hints from here.

// The six damage types. Every attack, skill and companion strike carries exactly one (or none for support skills).
export const TYPES = ['blade', 'bow', 'arcane', 'flame', 'frost', 'spirit'];
export const TYPE_INFO = {
  blade:  { label: 'Blade',  hint: 'Edged steel: swords, axes, fangs and tusks.' },
  bow:    { label: 'Bow',    hint: 'Piercing shots and diving talons.' },
  arcane: { label: 'Arcane', hint: 'Raw lantern-craft and bound magic.' },
  flame:  { label: 'Flame',  hint: 'Fire, embers and cinders.' },
  frost:  { label: 'Frost',  hint: 'Cold, ice and numbing light.' },
  spirit: { label: 'Spirit', hint: 'Shouts, oaths and the will of the bound.' }
};

// Ward = pips a foe must lose (one per Fray hit) before it is Staggered. Frays = its 2-3 weaknesses.
// `move` is its ordinary blow; `special` is telegraphed one turn ahead (every third action) and is cancelled by a Stagger.
// area: 'one' strikes the player or the companion, 'all' strikes the whole party.
export const FOES = {
  wolf:      { ward: 2, frays: ['blade', 'flame'],           move: 'Bite',         special: { name: 'Rending Lunge', mult: 1.7, area: 'one' } },
  goblin:    { ward: 3, frays: ['bow', 'frost', 'spirit'],   move: 'Hack',         special: { name: 'Cinder Jar',    mult: 1.2, area: 'all' } },
  skeleton:  { ward: 3, frays: ['arcane', 'flame', 'spirit'], move: 'Rusted Cut',  special: { name: 'Bone Rattle',   mult: 1.7, area: 'one' } },
  ghost:     { ward: 3, frays: ['flame', 'spirit', 'arcane'], move: 'Chill Touch', special: { name: 'Hollow Wail',   mult: 1.2, area: 'all' } },
  troll:     { ward: 4, frays: ['frost', 'bow'],             move: 'Club',         special: { name: 'Cinder Slam',   mult: 1.4, area: 'all' } },
  sentinel:  { ward: 4, frays: ['arcane', 'frost'],          move: 'Halberd',      special: { name: 'Ashen Sweep',   mult: 1.3, area: 'all' } },
  bandit:    { ward: 3, frays: ['bow', 'arcane'],            move: 'Cudgel',       special: { name: 'Ironjack Rush', mult: 1.8, area: 'one' } },
  thief:     { ward: 2, frays: ['blade', 'frost'],           move: 'Knife',        special: { name: 'Glass Flurry',  mult: 1.6, area: 'one' } },
  zombie:    { ward: 3, frays: ['flame', 'blade'],           move: 'Claw',         special: { name: 'Grave Grip',    mult: 1.7, area: 'one' } },
  paleguest: { ward: 4, frays: ['flame', 'spirit'],          move: 'Cold Kiss',    special: { name: 'Pallid Feast',  mult: 1.7, area: 'one' } },
  werewolf:  { ward: 4, frays: ['flame', 'arcane'],          move: 'Maul',         special: { name: 'Moon Frenzy',   mult: 1.4, area: 'all' } },
  horseman:  { ward: 6, frays: ['flame', 'spirit', 'bow'],   move: 'Scythe',       special: { name: 'Night Ride',    mult: 1.5, area: 'all' }, boss: true },
  'drowned-sexton': { ward: 5, frays: ['flame', 'spirit'],   move: 'Bell Swing',   special: { name: 'Drowned Toll',  mult: 1.4, area: 'all' }, boss: true },
  'hollow-cantor':  { ward: 5, frays: ['blade', 'frost'],    move: 'Discord',      special: { name: 'Stolen Choir',  mult: 1.3, area: 'all' }, boss: true },
  'tallow-widow':   { ward: 5, frays: ['frost', 'bow', 'arcane'], move: 'Wick Lash', special: { name: 'Threshold Embrace', mult: 1.8, area: 'one' }, boss: true }
};
export const DEFAULT_FOE = { ward: 3, frays: ['blade', 'arcane'], move: 'Strike', special: { name: 'Heavy Blow', mult: 1.7, area: 'one' } };
// The Hollow Warden (a sentinel flagged `warden`) is a boss with a deeper Ward and a third Fray.
export const WARDEN = { ward: 7, frays: ['arcane', 'frost', 'spirit'], move: 'Warden’s Halberd', special: { name: 'Gate Toll', mult: 1.4, area: 'all' }, boss: true };

export function foeData(e) {
  if (e?.warden) return WARDEN;
  const d = FOES[e?.kind] || DEFAULT_FOE;
  // Night hunters (coach ambushers, crown hunts) are a little sturdier than their ordinary kin.
  return e?.hunter && !d.boss ? { ...d, ward: Math.min(5, d.ward + 1) } : d;
}

// Companion strike types, by perk (the companion's identity): see companions.js for the perks themselves.
export const PERK_TYPE = { flare: 'flame', ward: 'blade', chill: 'frost', stagger: 'arcane', rend: 'flame', charge: 'blade', pounce: 'spirit', dive: 'bow' };

// Three battle skills per class, mapped one-to-one to the class's field abilities in journey.js (same names, same order).
// type: damage type (null = support). target: 'one' (choose a foe), 'all' (every foe), 'spread' (bolts start at the chosen foe
// and walk along the line), 'self' (the hero), 'ally' (the bound companion). power: multiple of base damage per hit.
// kindle: how each Kindle point scales the skill (shown to the player as `kindleHint`).
export const SKILLSETS = {
  warrior: [
    { id: 'shield-wall', name: 'Shield Wall', mp: 8, type: null, target: 'self', rounds: 2,
      hint: 'Halve all damage to you and your ally for 2 rounds.', kindleHint: '+1 round per Kindle.' },
    { id: 'cleave', name: 'Cleave', mp: 10, type: 'blade', target: 'all', power: .7,
      hint: 'Sweep every foe with your blade.', kindleHint: '+1 sweep per Kindle.' },
    { id: 'rallying-cry', name: 'Rallying Cry', mp: 14, type: 'spirit', target: 'all', power: .45, heal: 20,
      hint: 'Recover 20 health and shout at every foe (spirit).', kindleHint: '+12 health per Kindle.' }
  ],
  mage: [
    { id: 'arcane-volley', name: 'Arcane Volley', mp: 12, type: 'arcane', target: 'spread', power: .62, spell: true, bolts: 3,
      hint: 'Three bolts walk along the foes from your target.', kindleHint: '+1 bolt per Kindle.' },
    { id: 'frost-nova', name: 'Frost Nova', mp: 16, type: 'frost', target: 'all', power: .6, spell: true, slow: 1,
      hint: 'Chill every foe; they act last next round.', kindleHint: '+1 frost pulse per Kindle.' },
    { id: 'mana-surge', name: 'Mana Surge', mp: 4, type: null, target: 'self', heal: 10,
      hint: 'Recover half your mana and 10 health.', kindleHint: '+10 health per Kindle.' }
  ],
  ranger: [
    { id: 'piercing-shot', name: 'Piercing Shot', mp: 9, type: 'bow', target: 'one', power: 1.5,
      hint: 'A heavy arrow at one foe.', kindleHint: '+1 arrow per Kindle.' },
    { id: 'snare-trap', name: 'Snare Trap', mp: 12, type: 'blade', target: 'all', power: .45, slow: 1,
      hint: 'Steel jaws bite every foe; they act last next round.', kindleHint: '+1 round snared per Kindle.' },
    { id: 'hunters-mark', name: 'Hunter’s Mark', mp: 10, type: null, target: 'one', mark: 3,
      hint: 'Reveal every Fray of one foe; it takes 25% more damage for 3 rounds and your beast hunts it.', kindleHint: '+1 round per Kindle.' }
  ],
  summoner: [
    { id: 'spirit-lash', name: 'Spirit Lash', mp: 9, type: 'spirit', target: 'one', power: 1.15, spell: true,
      hint: 'Lash one foe with a spirit whip.', kindleHint: '+1 lash per Kindle.' },
    { id: 'rally-the-bound', name: 'Rally the Bound', mp: 14, type: null, target: 'ally', heal: .4, empower: 2,
      hint: 'Heal your minion by 40%; it strikes at once and deals +50% for 2 rounds.', kindleHint: '+1 empowered round per Kindle.' },
    { id: 'recall', name: 'Recall', mp: 6, type: null, target: 'ally', heal: .25,
      hint: 'A fallen minion returns at half strength; a standing one heals 25% and shields you from the next blow.', kindleHint: '+15% healing per Kindle.' }
  ],
  // Legacy callings and characters without a calling.
  default: [
    { id: 'power-strike', name: 'Power Strike', mp: 8, type: 'weapon', target: 'one', power: 1.6,
      hint: 'One foe takes 160% damage.', kindleHint: '+1 strike per Kindle.' },
    { id: 'sweeping-blow', name: 'Sweeping Blow', mp: 10, type: 'weapon', target: 'all', power: .6,
      hint: 'Strike every foe.', kindleHint: '+1 sweep per Kindle.' },
    { id: 'second-wind', name: 'Second Wind', mp: 6, type: null, target: 'self', heal: 25,
      hint: 'Recover 25 health.', kindleHint: '+10 health per Kindle.' }
  ]
};
