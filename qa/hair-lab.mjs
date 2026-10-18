// Contact sheet of every hero hairstyle (front, side, back) for a quick look. Writes a PNG.
//   ROOT=$PWD/game/ node qa/hair-lab.mjs <out.png> [female|male|nonbinary] [hairColour] [skin] [classId]
import {Sheet} from './png.mjs';
const ROOT = process.env.ROOT || new URL('../game/', import.meta.url).pathname;
const S = await import(ROOT + 'sprites.js');
const [out = '/tmp/hair-lab.png', gender = 'female', hair = 'brown', skin = 'warm', classId = 'warrior'] = process.argv.slice(2);
const styles = S.HAIR_STYLES?.[gender] || [];
const cell = 56, sc = 4;
const sheet = new Sheet(styles.length * cell * sc / 2 + 8, 3 * 52 * sc / 2 + 8, [46, 44, 70, 255]);
const frame = (sh, row, col) => {const img = new Uint8ClampedArray(sh.w * sh.h * 4); for (let y = 0; y < sh.h; y++) for (let x = 0; x < sh.w; x++) img.set(sh.data.subarray(((row * sh.h + y) * sh.w * sh.cols + col * sh.w + x) * 4, ((row * sh.h + y) * sh.w * sh.cols + col * sh.w + x) * 4 + 4), (y * sh.w + x) * 4); return img;};
styles.forEach((st, i) => {
  const sh = S.spriteSheet({kind: 'hero', classId, gender, skin, hair, hairStyle: st, name: 'Lab', outfit: 'traveler'});
  [['down', 0], ['left', 1], ['up', 2]].forEach(([d, r], k) => sheet.blit(frame(sh, r, 0), sh.w, sh.h, 4 + i * (sh.w * 2 + 4), 4 + k * (sh.h * 2 + 2), 2));
});
sheet.scaled(2).save(out);
console.log(out, styles.join(','));
