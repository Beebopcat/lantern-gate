// Zoomed close-up of one actor: node sprite-zoom.mjs '<actor json>' [scale=8] [poses=idle] [dirs=down,left,up,right] [out]
import {Sheet} from './png.mjs';
const ROOT = process.env.ROOT || new URL('../game/', import.meta.url).pathname;
const S = await import(ROOT + 'sprites.js');
const actor = JSON.parse(process.argv[2] || '{"kind":"hero","classId":"warrior"}'), scale = +(process.argv[3] || 8);
const poses = (process.argv[4] || 'idle').split(','), dirs = (process.argv[5] || 'down,left,up,right').split(',');
const out = process.argv[6] || new URL('./sprites/zoom.png', import.meta.url).pathname;
const sh = S.spriteSheet(actor); if (!sh) {console.log('no sprite for', actor); process.exit(1);}
const cells = []; for (const d of dirs) for (const p of poses) for (let f = 0; f < S.POSE_FRAMES[p]; f++) cells.push([d, p, f]);
const per = Math.min(cells.length, +(process.env.PER || 8)), rows = Math.ceil(cells.length / per);
const s = new Sheet(per * (sh.w + 1), rows * (sh.h + 1), [24, 28, 36, 255]);
cells.forEach(([d, p, f], i) => {
  const x = (i % per) * (sh.w + 1), y = Math.floor(i / per) * (sh.h + 1), col = S.frameIndex(p, f), row = S.DIRS.indexOf(d), img = new Uint8ClampedArray(sh.w * sh.h * 4);
  s.fill(x, y, sh.w, sh.h, [70, 84, 86, 255]);
  for (let yy = 0; yy < sh.h; yy++) img.set(sh.data.subarray(((row * sh.h + yy) * sh.w * sh.cols + col * sh.w) * 4, ((row * sh.h + yy) * sh.w * sh.cols + col * sh.w + sh.w) * 4), yy * sh.w * 4);
  s.blit(img, sh.w, sh.h, x, y, 1);
});
s.scaled(scale).save(out); console.log('wrote', out);
