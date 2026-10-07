// Minimal PNG encoder for the sprite lab (RGBA, no dependencies).
import {deflateSync} from 'node:zlib';
import {writeFileSync} from 'node:fs';
const table = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = buf => { let c = -1; for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length), t = Buffer.from(type, 'ascii');
  out.writeUInt32BE(data.length, 0); t.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc(Buffer.concat([t, data])), 8 + data.length); return out;
}
export function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = ihdr[11] = ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, {level: 6})), chunk('IEND', Buffer.alloc(0))]);
}
export const writePNG = (path, w, h, rgba) => writeFileSync(path, encodePNG(w, h, rgba));
// A plain RGBA canvas used to compose contact sheets.
export class Sheet {
  constructor(w, h, bg = [40, 44, 60, 255]) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) this.d.set(bg, i * 4); }
  fill(x, y, w, h, c) { for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++) for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) this.d.set(c, (j * this.w + i) * 4); }
  // Alpha-composite an RGBA image at integer scale.
  blit(img, iw, ih, x, y, s = 1) {
    for (let j = 0; j < ih; j++) for (let i = 0; i < iw; i++) {
      const k = (j * iw + i) * 4, a = img[k + 3]; if (!a) continue;
      for (let v = 0; v < s; v++) for (let u = 0; u < s; u++) {
        const X = x + i * s + u, Y = y + j * s + v; if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
        const o = (Y * this.w + X) * 4, t = a / 255;
        for (let c = 0; c < 3; c++) this.d[o + c] = img[k + c] * t + this.d[o + c] * (1 - t);
      }
    }
  }
  scaled(s) { const out = new Sheet(this.w * s, this.h * s); out.blit(this.d, this.w, this.h, 0, 0, s); return out; }
  save(path) { writePNG(path, this.w, this.h, this.d); }
}
