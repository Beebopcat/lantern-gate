// Character look options: one list per choice, shared by the creation screen, the save check and the sprite drawing.
// Everything here is cosmetic. A save that has none of the optional fields (hairStyle, eyes, face, headwear) keeps the look it always had.

// The first four styles of each list are the original ones: a character with no saved style still picks from them by name.
export const HAIR_STYLES = {
  female: ['long', 'ponytail', 'braid', 'bun', 'bob', 'twintails', 'crown', 'waves'],
  male: ['short', 'spiky', 'swept', 'tied', 'shaggy', 'topknot', 'curls', 'mane'],
  nonbinary: ['bob', 'shaggy', 'swept', 'tied', 'curls', 'topknot', 'waves', 'crown']
};
export const DEFAULT_STYLES = 4;
export const HAIR_STYLE_NAMES = {long: 'Long', ponytail: 'Ponytail', braid: 'Braid', bun: 'Bun', bob: 'Bob', twintails: 'Twin tails', crown: 'Crown braid', waves: 'Waves',
  short: 'Short', spiky: 'Spiky', swept: 'Swept', tied: 'Tied back', shaggy: 'Shaggy', topknot: 'Topknot', curls: 'Curls', mane: 'Mane'};
export const ALL_HAIR_STYLES = [...new Set(Object.values(HAIR_STYLES).flat())];

export const SKIN_TONES = ['warm', 'earth', 'deep', 'pale', 'olive'];
// The original five come first so older saves read the same.
export const HAIR_COLORS = ['brown', 'black', 'silver', 'auburn', 'gold', 'rose', 'copper', 'sky', 'teal', 'violet'];
export const HAIR_COLOR_NAMES = {brown: 'Brown', black: 'Black', silver: 'Silver', auburn: 'Auburn', gold: 'Gold', rose: 'Rose', copper: 'Copper', sky: 'Sky blue', teal: 'Teal', violet: 'Violet'};
// Eye colours: the first five are what a character got by name before the choice existed.
export const EYE_COLORS = ['brown', 'green', 'blue', 'amber', 'grey', 'violet', 'teal'];
export const EYE_DEFAULTS = 5;
export const EYE_COLOR_NAMES = {brown: 'Brown', green: 'Green', blue: 'Blue', amber: 'Amber', grey: 'Grey', violet: 'Violet', teal: 'Teal'};
export const FACE_MARKS = ['none', 'freckles', 'scar', 'mark'];
export const FACE_MARK_NAMES = {none: 'None', freckles: 'Freckles', scar: 'Scar', mark: 'Beauty mark'};
// Mages wear a hat and Rangers a hood by default; Bare shows the hair instead.
export const HEADWEAR = ['worn', 'bare'];
export const HEADWEAR_NAMES = {worn: 'Worn', bare: 'Bare'};
export const HEADWEAR_CALLINGS = ['mage', 'ranger'];

const known = (list, v) => v === undefined || list.includes(v);
// True when every optional look field on a player record is absent or a known choice.
export const lookValid = p => !!p && known(ALL_HAIR_STYLES, p.hairStyle) && known(EYE_COLORS, p.eyes) && known(FACE_MARKS, p.face) && known(HEADWEAR, p.headwear);
