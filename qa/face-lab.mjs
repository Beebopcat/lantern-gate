// Contact sheet of heroes with every eye colour, face mark and headwear choice (front and side).
//   ROOT=$PWD/game/ node qa/face-lab.mjs <out.png> [gender]
import {Sheet} from './png.mjs';
const ROOT = process.env.ROOT || new URL('../game/', import.meta.url).pathname;
const S = await import(ROOT + 'sprites.js'), A = await import(ROOT + 'appearance.js');
const [out = '/tmp/face-lab.png', gender = 'female'] = process.argv.slice(2);
const cases = [];
for (const eyes of A.EYE_COLORS) cases.push({eyes, hair: 'brown', skin: 'warm'});
for (const face of A.FACE_MARKS) for (const skin of ['pale', 'deep']) cases.push({face, skin, hair: 'black'});
for (const hair of A.HAIR_COLORS) cases.push({hair, skin: 'olive'});
for (const classId of ['mage', 'ranger']) for (const headwear of A.HEADWEAR) cases.push({classId, headwear, hair: 'gold', hairStyle: A.HAIR_STYLES[gender][5]});
const cols = 10, rows = Math.ceil(cases.length / cols), W = 44, H = 52;
const sheet = new Sheet(cols * W * 2 + 8, rows * H * 2 * 2 + 8, [46, 44, 70, 255]);
const frame = (sh, row) => {const img = new Uint8ClampedArray(sh.w * sh.h * 4); for (let y = 0; y < sh.h; y++) img.set(sh.data.subarray(((row * sh.h + y) * sh.w * sh.cols) * 4, ((row * sh.h + y) * sh.w * sh.cols + sh.w) * 4), y * sh.w * 4); return img;};
cases.forEach((c, i) => {
  const sh = S.spriteSheet({kind: 'hero', classId: 'warrior', gender, name: 'Lab' + i, outfit: 'traveler', ...c});
  const x = 4 + (i % cols) * W * 2, y = 4 + Math.floor(i / cols) * H * 4;
  sheet.blit(frame(sh, 0), sh.w, sh.h, x, y, 2); sheet.blit(frame(sh, 1), sh.w, sh.h, x, y + H * 2, 2);
});
sheet.scaled(2).save(out); console.log(out, cases.length);
