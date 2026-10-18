// Pixel-art actor sprites: drawn entirely in code, no image assets.
// API CONTRACT (other modules import only these names; extra exports are additive):
//   DIRS   = ['down','left','up','right']            facing, as seen by the camera
//   POSES  = ['idle','walk','attack','cast','hurt','down','guard']
//   spriteSpec(actor) -> normalized spec; `actor` is a world actor / enemy / companion / the player, or a hero spec
//        {kind:'hero', classId, gender, skin, hair, outfit, name} (creation preview before a save exists)
//   spriteSize(actor) -> {w,h} frame size in sprite pixels (before scaling)
//   drawSprite(canvas, actor, {dir='down', pose='idle', t=0 (seconds, drives animation), scale=4, clear=true, bg=null})
//        draws one frame centred on a 2D canvas with hard pixels (caller sets canvas size; scale is an integer)
// Additions:
//   spriteFor(actor[, outfit]) -> spec or null (null: the actor keeps its 3D model)
//   spriteSheet(actor[, outfit]) -> cached {key,w,h,cols,rows,data:Uint8ClampedArray RGBA,anchor} sheet of every frame
//   frameIndex(pose,frame) / frameCol(pose,t) helpers, POSE_FRAMES, SHEET_COLS
// Everything below the API renders into plain RGBA buffers so the generator also runs in Node (sprite lab).
import {HAIR_STYLES, DEFAULT_STYLES, EYE_COLORS, EYE_DEFAULTS} from './appearance.js';
export {HAIR_STYLES};
export const DIRS = ['down', 'left', 'up', 'right'];
export const POSES = ['idle', 'walk', 'attack', 'cast', 'hurt', 'down', 'guard'];
export const POSE_FRAMES = {idle: 2, walk: 4, attack: 3, cast: 2, hurt: 1, down: 1, guard: 1};
const POSE_COL = {}; {let c = 0; for (const p of POSES) {POSE_COL[p] = c; c += POSE_FRAMES[p];}}
export const SHEET_COLS = 14;
export const frameIndex = (pose, frame = 0) => (POSE_COL[pose] ?? 0) + Math.max(0, Math.min(POSE_FRAMES[pose] - 1, frame | 0));
// Time-driven frame for poses that loop on their own (idle breathing, cast shimmer); attack uses progress.
export function poseFrame(pose, t = 0) {
  if (pose === 'idle') return Math.floor(t * 1.7) % 2;
  if (pose === 'walk') return Math.floor(t * 7) % 4;
  if (pose === 'cast') return Math.floor(t * 6) % 2;
  if (pose === 'attack') return Math.min(2, Math.floor((t % 1.2) / .4));
  return 0;
}

// ---------------------------------------------------------------- colour
const hex = s => {s = String(s || '#888').replace('#', ''); if (s.length === 3) s = s.replace(/./g, c => c + c); const n = parseInt(s.slice(0, 6), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255];};
const toHsv = ([r, g, b]) => {r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) {h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360;} return [h, mx ? d / mx : 0, mx];};
const fromHsv = ([h, s, v]) => {const f = n => {const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));}; return [f(5), f(3), f(1)];};
const toward = (h, t, amt) => {const d = ((t - h + 540) % 360) - 180; return (h + Math.max(-amt, Math.min(amt, d)) + 360) % 360;};
const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
// A hue-shifted six tone ramp from one base colour: shadows drift toward violet, lights toward warm yellow.
// o = outline, d = deep shadow, s = shadow, b = base, l = light, h = highlight.
export function rampOf(base, {cool = 1, warm = 1} = {}) {
  const c = hex(base), [h, s, v] = toHsv(c);
  const tone = k => {
    if (k < 0) {const a = -k; return fromHsv([toward(h, 250, a * 9 * cool), Math.min(1, s * (1 + .1 * a) + .04 * a), Math.min(v * [1, .8, .63, .45][a], v - [0, .06, .12, .2][a] * v)]);}
    if (k > 0) return fromHsv([toward(h, 50, k * 8 * warm), Math.max(0, s * (1 - .18 * k)), Math.min(1, v + (1 - v) * .3 * k + .07 * k)]);
    return c;
  };
  return {o: tone(-3), d: tone(-2), s: tone(-1), b: c, l: tone(1), h: tone(2)};
}
const fixed = (...c) => ({o: hex(c[0]), d: hex(c[1]), s: hex(c[2]), b: hex(c[3]), l: hex(c[4]), h: hex(c[5])});
const shiftRamp = (r, k) => {const keys = ['o', 'd', 's', 'b', 'l', 'h'], out = {}; keys.forEach((n, i) => out[n] = r[keys[Math.max(0, Math.min(5, i + k))]]); return out;};

// Hand-tuned material ramps.
const SKIN = {
  pale: fixed('#6b3a40', '#b8746a', '#dc9e88', '#f2c8ab', '#fde2cd', '#fff1e4'),
  warm: fixed('#5c2f33', '#a05c4b', '#ca8663', '#e6ae86', '#f6cda6', '#fde3c4'),
  olive: fixed('#4a2a2c', '#835137', '#a8764c', '#c89868', '#ddb886', '#ecd0a2'),
  earth: fixed('#391e20', '#623828', '#844f35', '#a66c47', '#c08a60', '#d5a67a'),
  deep: fixed('#271416', '#45251f', '#60372a', '#7c4c38', '#986750', '#b08068')
};
const BLUSH = {pale: '#ec9a96', warm: '#e48c7c', olive: '#c87a62', earth: '#a85a46', deep: '#8c4a3e'};
const HAIR = {
  brown: fixed('#2a191b', '#4b2d24', '#6c432f', '#8f5e3c', '#b27d51', '#cf9f70'),
  black: fixed('#110e17', '#1d1a28', '#2b283b', '#3d3a53', '#575876', '#7b80a2'),
  silver: fixed('#3c3d50', '#68697e', '#9395a7', '#b9bcc8', '#d9dbe3', '#f4f5f8'),
  auburn: fixed('#311416', '#5a2120', '#853529', '#ae4f39', '#cf734f', '#e89b6b'),
  gold: fixed('#4a2f18', '#835b25', '#b28937', '#d7b153', '#eed079', '#fbebab'),
  rose: fixed('#451a30', '#7a2c54', '#ad4878', '#d46c9a', '#ea92b6', '#f9bfd4'),
  copper: fixed('#3a1608', '#6e2c10', '#a8481a', '#d4692a', '#ee8c42', '#fdb87c'),
  sky: fixed('#13203c', '#24407a', '#3b69b0', '#5c92dc', '#88b8f4', '#bedcff'),
  teal: fixed('#0e3034', '#1a585a', '#2c8884', '#4ab2a6', '#7cd4c2', '#b4f0e0'),
  violet: fixed('#2a1446', '#4a2a7e', '#7248b4', '#9a6edc', '#bc96f2', '#dcc6ff')
};
// order matches EYE_COLORS in appearance.js: brown, green, blue, amber, grey, violet, teal
const EYES = [['#3b2219', '#6e4430'], ['#22402c', '#4a7a4c'], ['#21335a', '#4a6fa8'], ['#46361a', '#8a6a30'], ['#2e3440', '#66707e'], ['#34205a', '#8a62c8'], ['#154a52', '#3ea4aa']].map(e => e.map(hex));
// darker skin tones get brighter irises so the eyes still read against the face
const irises = (skin, i) => ['deep', 'earth'].includes(skin) ? EYES[i].map((c, k) => mix(c, [255, 250, 235], k ? .38 : .22)) : EYES[i];
const M = {
  steel: fixed('#22253a', '#3d4560', '#646e88', '#939db3', '#c3cbd9', '#eff3f9'),
  brass: fixed('#3c2513', '#6c441f', '#9e692b', '#c89a41', '#e7c569', '#fbeaa5'),
  leather: fixed('#23161a', '#3d261f', '#5b3a29', '#7b5135', '#9b6d47', '#ba8d63'),
  boot: fixed('#17121a', '#292028', '#3a2e33', '#4f3e3e', '#69544f', '#85705e'),
  wood: fixed('#2b1913', '#4b2e1d', '#6d4427', '#926139', '#b4824e', '#cfa36b'),
  cloth: fixed('#4e4b5b', '#898695', '#b4b0b3', '#dbd5cb', '#f1ece0', '#ffffff'),
  bone: fixed('#493f37', '#887a65', '#b2a589', '#d5ccb1', '#ede7d3', '#fffcf1'),
  ink: fixed('#100c14', '#1c1622', '#2a2230', '#3a3040', '#4e4454', '#6a5e6c'),
  straw: fixed('#4a3216', '#7e5a24', '#b08a3c', '#d6b45c', '#ecd282', '#f8e8b0'),
  glowTeal: fixed('#1d4a52', '#2f7c84', '#4fb7b4', '#8ae8dc', '#c8fff2', '#ffffff'),
  glowGold: fixed('#5a3210', '#a2621c', '#e09a34', '#ffd068', '#fff0b0', '#ffffff'),
  glowViolet: fixed('#311a4e', '#52308a', '#8457c8', '#b48cf0', '#e0cbff', '#ffffff'),
  ember: fixed('#3e1010', '#7a1f14', '#c2401e', '#ee7a2c', '#ffc05a', '#fff2b0')
};
export const OUTFIT_COLORS = {traveler: '#296a67', burgundy: '#7e374b', royal: '#304b86', gold: '#b68a35', forest: '#405c30'};

// ---------------------------------------------------------------- pixel buffer, masks and painting
class Buf {
  constructor(w, h) {this.w = w; this.h = h; this.c = new Uint8ClampedArray(w * h * 4); this.f = new Uint8Array(w * h);}
  in(x, y) {return x >= 0 && y >= 0 && x < this.w && y < this.h;}
  a(x, y) {return this.in(x, y) ? this.c[(y * this.w + x) * 4 + 3] : 0;}
  col(x, y) {const i = (y * this.w + x) * 4; return [this.c[i], this.c[i + 1], this.c[i + 2]];}
  // flag bit 1: glowing pixel (never outlined); bit 2: outline pixel.
  put(x, y, c, flag = 0) {x |= 0; y |= 0; if (!this.in(x, y) || !c) return; const i = y * this.w + x; this.c[i * 4] = c[0]; this.c[i * 4 + 1] = c[1]; this.c[i * 4 + 2] = c[2]; this.c[i * 4 + 3] = 255; this.f[i] = flag;}
  clear(x, y) {if (this.in(x, y)) {const i = y * this.w + x; this.c[i * 4 + 3] = 0; this.f[i] = 0;}}
}
class Mask {
  // x0..y1 is a conservative bounding box of set pixels so painting only visits the part's area.
  constructor(w, h) {this.w = w; this.h = h; this.m = new Uint8Array(w * h); this.x0 = w; this.y0 = h; this.x1 = -1; this.y1 = -1;}
  on(x, y) {return x >= 0 && y >= 0 && x < this.w && y < this.h && this.m[y * this.w + x] === 1;}
  set(x, y, v = 1) {x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) {this.m[y * this.w + x] = v; if (v) {if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y;}}}
  rect(x, y, w, h, v = 1) {for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v); return this;}
  ell(cx, cy, rx, ry, v = 1) {for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.set(x, y, v);} return this;}
  // Even-odd scanline fill sampled at pixel centres.
  poly(pts, v = 1) {
    let y0 = Infinity, y1 = -Infinity; for (const p of pts) {y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);}
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const sy = y + .5, xs = [];
      for (let i = 0; i < pts.length; i++) {const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));}
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - .5); x + .5 <= xs[k + 1]; x++) this.set(x, y, v);
    }
    return this;
  }
  // Capsule (thick segment) by distance from pixel centres; r=1.5 is a 3px limb.
  cap(x0, y0, x1, y1, r = 1.5, v = 1) {
    const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
    for (let y = Math.floor(Math.min(y0, y1) - r - 1); y <= Math.max(y0, y1) + r + 1; y++) for (let x = Math.floor(Math.min(x0, x1) - r - 1); x <= Math.max(x0, x1) + r + 1; x++) {
      const px = x + .5, py = y + .5, t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L)), qx = x0 + dx * t - px, qy = y0 + dy * t - py;
      if (qx * qx + qy * qy <= r * r) this.set(x, y, v);
    }
    return this;
  }
  // 1px Bresenham line (pixel coordinates).
  line(x0, y0, x1, y1, v = 1) {x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (;;) {this.set(x0, y0, v); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) {e += dy; x0 += sx;} if (e2 <= dx) {e += dx; y0 += sy;}} return this;}
  and(o) {for (let i = 0; i < this.m.length; i++) this.m[i] &= o.m[i]; return this;}
  sub(o) {for (let i = 0; i < this.m.length; i++) if (o.m[i]) this.m[i] = 0; return this;}
  or(o) {for (let i = 0; i < this.m.length; i++) this.m[i] |= o.m[i]; this.x0 = Math.min(this.x0, o.x0); this.y0 = Math.min(this.y0, o.y0); this.x1 = Math.max(this.x1, o.x1); this.y1 = Math.max(this.y1, o.y1); return this;}
  clone() {const m = new Mask(this.w, this.h); m.m.set(this.m); m.x0 = this.x0; m.y0 = this.y0; m.x1 = this.x1; m.y1 = this.y1; return m;}
  clipY(y0, y1) {for (let y = 0; y < this.h; y++) if (y < y0 || y > y1) this.m.fill(0, y * this.w, (y + 1) * this.w); return this;}
  clipX(x0, x1) {for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (x < x0 || x > x1) this.m[y * this.w + x] = 0; return this;}
  empty() {if (this.x1 < 0) return true; for (let y = this.y0; y <= this.y1; y++) for (let x = this.x0; x <= this.x1; x++) if (this.m[y * this.w + x]) return false; return true;}
}
// Paint a mask with a ramp. Shading is directional (light from the top-left):
//  cyl  : per-row cylinder (lit left rim, shadow band on the right, lit top, shaded bottom)
//  ball : spherical falloff from the top-left
//  flat : base with a 1px shaded bottom/right rim
//  none : base only
// contour: draw a dark inner line where the part overlaps something painted earlier (separates limbs from the body).
function paint(B, Mk, R, o = {}) {
  const {shade = 'cyl', flag = 0, contour = false, sw = null, top = true, bottom = true, rim = true} = o, w = B.w, h = B.h;
  if (Mk.x1 < 0) return;
  const X0 = Math.max(0, Mk.x0), X1 = Math.min(w - 1, Mk.x1), Y0 = Math.max(0, Mk.y0), Y1 = Math.min(h - 1, Mk.y1);
  const behind = contour ? new Uint8Array(w * h) : null;
  if (contour) for (let y = Math.max(0, Y0 - 1); y <= Math.min(h - 1, Y1 + 1); y++) for (let x = Math.max(0, X0 - 1); x <= Math.min(w - 1, X1 + 1); x++) behind[y * w + x] = B.c[(y * w + x) * 4 + 3] ? 1 : 0;
  let bx0 = w, bx1 = -1, by0 = h, by1 = -1;
  if (shade === 'ball') for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (Mk.on(x, y)) {bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);}
  for (let y = Y0; y <= Y1; y++) {
    let x = X0;
    while (x <= X1) {
      if (!Mk.on(x, y)) {x++; continue;}
      const x0 = x; while (Mk.on(x, y)) x++; const x1 = x - 1, len = x1 - x0 + 1;
      for (let i = x0; i <= x1; i++) {
        let t = 'b';
        if (shade === 'cyl') {
          const s = sw ?? (len >= 10 ? 3 : len >= 6 ? 2 : len >= 3 ? 1 : 0);
          if (i > x1 - s) t = 's';
          if (len >= 8 && i === x1) t = 'd';
          if (rim && len >= 4 && i === x0 + (len >= 9 ? 1 : 0)) t = 'l';
          if (top && !Mk.on(i, y - 1) && t === 'b') t = 'l';
          if (bottom && !Mk.on(i, y + 1) && (t === 'b' || t === 'l')) t = 's';
        } else if (shade === 'ball') {
          const cx = (bx0 + bx1 + 1) / 2, cy = (by0 + by1 + 1) / 2, rx = Math.max(1, (bx1 - bx0 + 1) / 2), ry = Math.max(1, (by1 - by0 + 1) / 2);
          const nx = (i + .5 - cx) / rx, ny = (y + .5 - cy) / ry, lum = -(nx * .62 + ny * .72) * .62 + (1 - Math.min(1, nx * nx + ny * ny)) * .5;
          t = lum > .62 ? 'h' : lum > .4 ? 'l' : lum > .02 ? 'b' : lum > -.34 ? 's' : 'd';
        } else if (shade === 'hcyl') {
          // horizontal cylinder (animal bodies): lit back, shaded belly
          let up = 0, dn = 0; while (Mk.on(i, y - up - 1)) up++; while (Mk.on(i, y + dn + 1)) dn++;
          const len2 = up + dn + 1, s = len2 >= 9 ? 3 : len2 >= 5 ? 2 : 1;
          t = up === 0 && len2 >= 3 ? 'l' : dn < s ? (dn === 0 && len2 >= 7 ? 'd' : 's') : 'b';
          if (rim && !Mk.on(i - 1, y) && t === 'b') t = 'l';
          if (!Mk.on(i + 1, y) && t === 'b') t = 's';
        } else if (shade === 'flat') {
          if (!Mk.on(i + 1, y) || !Mk.on(i, y + 1)) t = 's';
        }
        B.put(i, y, R[t], flag);
      }
    }
  }
  if (contour) for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    if (!Mk.on(x, y)) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !Mk.on(x + dx, y + dy) && B.in(x + dx, y + dy) && behind[(y + dy) * w + x + dx]);
    if (edge) B.put(x, y, contour === 'd' ? R.d : mix(R.o, R.d, .35), flag);
  }
}
const dot = (B, x, y, c, flag = 0) => B.put(x, y, c, flag);
const hline = (B, x0, x1, y, c, flag = 0) => {for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) B.put(x, y, c, flag);};
const vline = (B, x, y0, y1, c, flag = 0) => {for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) B.put(x, y, c, flag);};
// Darkened, cooled version of a colour for selective outlines.
const darkCache = new Map();
const darkOf = (c, k) => {const key = (Math.round(c[0]) << 16 | Math.round(c[1]) << 8 | Math.round(c[2])) + k * 1e8; let r = darkCache.get(key); if (r) return r; const [h, s, v] = toHsv(c); r = fromHsv([toward(h, 252, 22), Math.min(1, s * 1.08 + .14), Math.max(.035, v * k)]); if (darkCache.size > 20000) darkCache.clear(); darkCache.set(key, r); return r;};
// Selective outline: every transparent pixel touching the figure (4-neighbourhood) takes a darkened tone of its
// neighbour, slightly lighter on the lit (top-left) side. Glow pixels never receive an outline.
function outline(B, {lit = .5, dark = .3} = {}) {
  const w = B.w, h = B.h, src = new Uint8ClampedArray(B.c), sf = new Uint8Array(B.f);
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] && !(sf[y * w + x] & 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[(y * w + x) * 4 + 3]) continue;
    let r = 0, g = 0, b = 0, n = 0, litSide = false;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) if (opaque(x + dx, y + dy)) {const i = ((y + dy) * w + x + dx) * 4; r += src[i]; g += src[i + 1]; b += src[i + 2]; n++; if (dx > 0 || dy > 0) litSide = true;}
    if (!n) continue;
    const below = opaque(x, y - 1) && !opaque(x, y + 1);
    B.put(x, y, darkOf([r / n, g / n, b / n], litSide && !below ? lit : dark), 2);
  }
}
const mirror = B => {const w = B.w, h = B.h, c = new Uint8ClampedArray(B.c), f = new Uint8Array(B.f); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {const a = (y * w + x), b = (y * w + (w - 1 - x)); B.c.set(c.subarray(b * 4, b * 4 + 4), a * 4); B.f[a] = f[b];}};

// ---------------------------------------------------------------- seeds
const seedOf = s => Math.abs([...String(s || 'Wayfarer')].reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0) | 0, 7));

// ---- heads: hand-authored 16px templates (origin = head centre x-8, crown row y0-2) ----
// Skin letters D S B L H, hair letters d s b l h; '.' is empty. Eyes, mouth and blush are stamped per expression.
const T16 = rows => rows.map(r => r.padEnd(16, '.').slice(0, 16));
const SKULL = {
  front: T16(['', '', '......BBBB......', '....BBBBBBBB....', '...BBBBBBBBBB...', '..BBBBBBBBBBBB..', '.BBBBBBBBBBBBBS.', '.BBBBBBBBBBBBBS.', '.LBBBBBBBBBBBBS.', '.LBBBBBBBBBBBBS.', '.LBBBBBBBBBBBSS.', '.BBBBBBBBBBBBSS.', '.BBBBBBBBBBBBSS.', '..BBBBBBBBBBBS..', '...SBBBBBBBBS...', '.....SSBBSS.....']),
  side: T16(['', '', '....BBBBBBB.....', '..BBBBBBBBBBB...', '.BBBBBBBBBBBBB..', '.BBBBBBBBBBBBBB.', 'BBBBBBBBBBBBBBS.', 'BBBBBBBBBBBBBBS.', 'BBBBBBBBBBBBBBS.', 'BBBBBBBBBBBBBSS.', 'BBBBBBBBBBBBBSS.', 'LBBBBBBBBBBBBSS.', 'BBBBBBBBBBBBBS..', 'BBBBBBBBBBBBSS..', '.BBBBBBBBBBBS...', '..SBBBBBBBSS....'])
};
SKULL.back = SKULL.front;
// Hair caps by family; side locks and long hair are added per style.
const CAPS = {
  bangs: {
    front: T16(['', '....ssbbbbs.....', '..sbbllllbbbs...', '.sbllhhhllbbbs..', '.sblhhlllbbbbbs.', 'sblbbbbbbbbbbbsd', 'sbbbbbsbbbbsbbsd', 'sbbbbsbbbbbsbbsd', 'sbbsbbbsbbbbsbsd', 'sbs....sb....sds', 'sb............sd', 'sb............sd', '.s............d.']),
    side: T16(['', '....ssbbbbs.....', '..sbbllllbbbs...', '.sbllhhhllbbbbs.', 'sblhhlllbbbbbbsd', 'sblbbbbbbbbbbbsd', 'sbbbbbsbbbbbbbsd', 'sbbbbsbbbbbsbbsd', 'sbs.sbbbbbsbbbsd', '.s....sbbbbbbsbd', '......sbbbbbsbbd', '.......sbbbbsbd.', '.......sbbbsbd..', '........sssdd...']),
    back: T16(['', '....ssbbbbs.....', '..sbbllllbbbs...', '.sbllhhhllbbbbs.', '.sblhhlllbbbbbd.', 'sblbbbbbbbbbbbsd', 'sbbbbbbbbbbbbbsd', 'sbbbbbbbbbbbbbsd', 'sbbbsbbbbbbsbbsd', 'sbbbsbbbbbbsbbsd', 'sbbsbbbbbbbbsbsd', '.sbsbbbsbbbbsbd.', '.sbsbbbsbbbsbsd.', '..sbsbbsbbbsbd..', '....sdsddsds....'])
  },
  part: {
    front: T16(['', '....ssbbbbs.....', '..sbbllllbbbs...', '.sbllhhhllbbbs..', '.sblhlsbbbbbbbs.', 'sblsbbbbbbbbbbsd', 'sbsbbbbbbbbbbbsd', 'sb.sbbbbbbbbbbsd', 'sb..ssbbbbbbsbsd', 'sb........sbbsds', 'sb............sd', 'sb............sd', '.s............d.']),
    side: T16(['', '....ssbbbbs.....', '..sbbllllbbbs...', '.sbllhhhllbbbbs.', 'sblhhlllbbbbbbsd', 'sbbbbbbbbbbbbbsd', 'ssbbbbbbbbbbbbsd', '.sbbbbbbbbbsbbsd', '..ssbbbbbbsbbbsd', '......sbbbbbbsbd', '......sbbbbbsbbd', '.......sbbbbsbd.', '.......sbbbsbd..', '........sssdd...']),
    back: null
  },
  spiky: {
    front: T16(['...s..l..b..s...', '..sbsllbbbsbs...', '.sblllhhllbbbs..', '.sblhhhllbbbbbs.', 'ssblhllbbbbbbbsd', 'sblbbbbbbbbbbbsd', 'sbbbbbsbbbbsbbsd', 'sbbsbbbsbbsbbbsd', 'sbsbsbsbsbbsbsbd', 'sb..s...s.s...sd', 'sb............sd', 's.............d.']),
    side: T16(['....s.l..bs.s...', '..sbsllbbbsbs...', '.sbllhhhllbbbss.', 'sblhhlllbbbbbbbs', 'sbllllbbbbbbbbsd', 'sbbbbbsbbbbbbbsd', 'sbbbbsbbbbsbbbbd', 'sbsbsbbbbsbbbbsd', 'sb..sbbbbbbbbsbd', '.....sbbbbbbbsbd', '......sbbbbbsbsd', '.......sbbbbsbd.', '.......sbsbsbd..', '........s.sd....']),
    back: T16(['...s..l..b..s...', '..sbsllbbbsbs...', '.sblllhhllbbbs..', '.sblhhhllbbbbbs.', 'ssblhllbbbbbbbsd', 'sblbbbbbbbbbbbsd', 'sbbbbbbbbbbbbbsd', 'sbbbsbbbbbsbbbsd', 'sbbbsbbbbbsbbbsd', 'sbbsbbbbbbbsbbsd', 'sbsbbbsbbbbsbbsd', '.sbsbsbbbsbsbsd.', '.s.sbs.sbs.sbsd.', '...s...s...s.d..'])
  }
};
CAPS.part.back = CAPS.bangs.back;
const FAMILY = {long: 'bangs', bob: 'bangs', bun: 'bangs', short: 'bangs', tied: 'bangs', ponytail: 'part', braid: 'part', swept: 'part', spiky: 'spiky', shaggy: 'spiky', twintails: 'bangs', crown: 'part', waves: 'part', curls: 'bangs', topknot: 'bangs', mane: 'part'};
// styles whose hair falls past the shoulders at the sides
const LONGISH = new Set(['long', 'bob', 'waves', 'mane']);
// how far the side locks fall (template row) in the front view
const LOCKS = {long: 16, ponytail: 12, braid: 12, bun: 12, short: 10, spiky: 10, swept: 11, tied: 11, bob: 14, shaggy: 13, twintails: 12, crown: 9, waves: 15, curls: 11, topknot: 8, mane: 15};
function stamp(B, rows, ox, oy, map, flag = 0, clip = null) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i], c = map[ch]; if (!c) continue;
    if (clip && !clip.on(ox + i, oy + j)) continue;
    B.put(ox + i, oy + j, c, flag);
  }
}
const stampMask = (rows, ox, oy, keys = null) => {const m = new Mask(HW, HH); rows.forEach((r, j) => [...r].forEach((ch, i) => {if (ch !== '.' && (!keys || keys.includes(ch))) m.set(ox + i, oy + j);})); return m;};
const hairMap = H => ({o: H.o, d: H.d, s: H.s, b: H.b, l: H.l, h: H.h});
const skinMap = S => ({D: S.d, S: S.s, B: S.b, L: S.l, H: S.h});
// Eyes: 2x3 with a dark lid line, catchlight and a two-tone iris. x is the left column, y the lid row.
function eye(B, sp, x, y, mode, outer, side = false) {
  const lid = sp.lash, e = sp.eyes, W = [255, 250, 238];
  if (mode === 'closed') {hline(B, x, x + 1, y + 1, lid); dot(B, outer, y + 1, mix(lid, sp.skin.s, .5)); return;}
  if (mode === 'hurt') {const l = outer < x; dot(B, l ? x : x + 1, y, lid); dot(B, l ? x + 1 : x, y + 1, lid); dot(B, l ? x : x + 1, y + 2, lid); return;}
  hline(B, x, x + 1, y, lid);
  if (mode === 'focus') {dot(B, x, y + 1, e[0]); dot(B, x + 1, y + 1, e[0]); dot(B, x, y + 2, sp.skin.s); dot(B, x + 1, y + 2, sp.skin.s); return;}
  dot(B, x, y + 1, side ? e[0] : W); dot(B, x + 1, y + 1, side ? W : e[0]); dot(B, x, y + 2, e[0]); dot(B, x + 1, y + 2, e[1]);
  if (sp.gender === 'female') dot(B, outer, y, lid);
}
// Freckles, a scar or a beauty mark. Front view: l and rr are the cheek columns either side of the nose; side view: l is the cheek column.
function faceMark(B, sp, l, rr, ey, side) {
  const f = sp.face; if (!f) return;
  const k = mix(sp.skin.s, [140, 64, 48], .42), sc = mix(sp.skin.h, [236, 170, 170], .5), mk = mix(sp.skin.d, [36, 18, 20], .55);
  if (f === 'freckles') {
    const pts = side ? [[l + 2, ey + 2], [l, ey + 3], [l + 2, ey + 4]] : [[l, ey + 2], [l + 1, ey + 4], [l - 1, ey + 4], [rr, ey + 2], [rr - 1, ey + 4], [rr + 1, ey + 4]];
    for (const [x, y] of pts) dot(B, x, y, k);
  } else if (f === 'scar') {
    const pts = side ? [[l + 2, ey], [l + 2, ey + 1], [l + 1, ey + 2], [l + 1, ey + 3]] : [[rr + 1, ey], [rr + 1, ey + 1], [rr, ey + 2], [rr, ey + 3]];
    for (const [x, y] of pts) dot(B, x, y, sc);
    if (!side) dot(B, rr + 1, ey + 2, k); else dot(B, l + 2, ey + 2, k);
  } else if (f === 'mark') {
    if (side) dot(B, l - 1, ey + 4, mk); else dot(B, rr - 2, ey + 4, mk);
  }
}
function headFront(B, sp, r, back) {
  const b = r.bob + (r.head || 0), cx = 20 + (r.hx || 0), ox = cx - 8, y0 = 10 + b, oy = y0 - 2, st = sp.hairStyle, H = sp.hair, hm = hairMap(H);
  // neck
  paint(B, new Mask(HW, HH).rect(cx - 2, y0 + 12, 4, 3), shiftRamp(sp.skin, -1), {shade: 'none'});
  stamp(B, SKULL.front, ox, oy, skinMap(sp.skin));
  const covered = sp.hood || sp.helm === 'full';
  if (sp.skeleton) {skullFace(B, sp, r, cx, y0, back, false); if (!sp.hat) return;}
  if (sp.helm === 'full') {fullHelm(B, sp, r, cx, y0, back ? 'up' : 'down'); return;}
  if (!back && !sp.skeleton) {
    const ey = y0 + 7;
    eye(B, sp, cx - 4, ey, r.eyes, cx - 5); eye(B, sp, cx + 2, ey, r.eyes, cx + 4);
    dot(B, cx - 6, ey + 3, sp.blush); dot(B, cx + 5, ey + 3, sp.blush);
    dot(B, cx, ey + 3, sp.skin.s);
    faceMark(B, sp, cx - 5, cx + 4, ey, false);
    const mc = sp.mouth;
    if (r.mouth === 'open' || r.mouth === 'shout') {dot(B, cx - 1, ey + 4, mc); dot(B, cx, ey + 4, mc); dot(B, cx - 1, ey + 5, mix(mc, [70, 24, 34], .5)); dot(B, cx, ey + 5, mix(mc, [70, 24, 34], .5));}
    else if (r.mouth === 'set') hline(B, cx - 1, cx, ey + 4, mc);
    else dot(B, cx - 1, ey + 4, mc);
  }
  if (covered || st === 'none') return;
  const fam = FAMILY[st] || 'bangs', cap = CAPS[fam][back ? 'back' : 'front'];
  const capOy = oy;
  stamp(B, cap, ox, capOy, hm);
  // side locks fall over the cheeks and frame the face
  if (!back) {
    const end = LOCKS[st] || 12;
    for (let j = 10; j <= end; j++) {
      const tip = j === end;
      for (const [i, c] of [[0, 's'], [1, tip ? 's' : 'b'], [14, tip ? 'd' : 's'], [15, 'd']]) B.put(ox + i, capOy + j, hm[c]);
    }
    if (LONGISH.has(st) || st === 'shaggy') {for (let j = 12; j <= end; j++) {B.put(ox + 2, capOy + j, j === end ? H.s : H.b); B.put(ox + 13, capOy + j, H.s);}}
    if (st === 'shaggy') {B.put(ox + 1, capOy + end + 1, H.s); B.put(ox + 14, capOy + end + 1, H.d);}
    if (st === 'crown') crownWeave(B, H, ox, capOy + 4, sp.tie);
    // cast shadow under the fringe
    for (let x = ox + 2; x <= ox + 13; x++) {let y = y0; while (y < y0 + 12 && isHair(B, x, y, H)) y++; if (y > y0 && y < y0 + 12 && !isHair(B, x, y, H) && !isEyePx(B, x, y, sp)) B.put(x, y, sp.skin.s);}
  } else {
    const end = {long: 16, bob: 16, shaggy: 16, waves: 16, mane: 16}[st] || 15;
    for (let j = 15; j <= end; j++) for (let i = 1; i <= 14; i++) B.put(ox + i, capOy + j, hm[j === end ? (i % 3 ? 's' : 'd') : (i % 4 === 1 ? 's' : 'b')]);
    if (st === 'crown') crownWeave(B, H, ox, capOy + 8, sp.tie);
  }
}
// A braid worn as a coronet: two rows of woven strands across the head, with a gold pin at one end.
function crownWeave(B, H, ox, y, pin) {
  for (let i = 2; i <= 13; i++) {
    if (isHair(B, ox + i, y - 1, H)) B.put(ox + i, y - 1, H.d);
    if (isHair(B, ox + i, y, H)) B.put(ox + i, y, i % 2 ? H.h : H.s);
    if (isHair(B, ox + i, y + 1, H)) B.put(ox + i, y + 1, i % 2 ? H.s : H.h);
    if (isHair(B, ox + i, y + 2, H)) B.put(ox + i, y + 2, H.d);
  }
  if (pin) {B.put(ox + 11, y, pin); B.put(ox + 12, y, pin); B.put(ox + 11, y + 1, pin); B.put(ox + 12, y + 1, pin);}
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const isHair = (B, x, y, H) => {if (!B.a(x, y)) return false; const c = B.col(x, y); return ['d', 's', 'b', 'l', 'h', 'o'].some(k => same(c, H[k]));};
const isEyePx = (B, x, y, sp) => {if (!B.a(x, y)) return false; const c = B.col(x, y); return same(c, sp.lash) || same(c, sp.eyes[0]) || same(c, sp.eyes[1]);};
// Hair that hangs behind the head/body (drawn first) or over the back (back view, drawn last).
function hairBehind(B, sp, r, view) {
  if (sp.hood || sp.helm === 'full' || sp.hat === 'wizard' && view === 'up') {}
  if (sp.hood || sp.helm === 'full') return;
  const st = sp.hairStyle, H = sp.hair, b = r.bob + (r.head || 0), y0 = 10 + b, cx = 20 + (r.hx || 0), m = new Mask(HW, HH);
  if (view === 'down') {
    if (st === 'long') m.poly([[cx - 8, y0 + 4], [cx + 8, y0 + 4], [cx + 9, y0 + 18], [cx + 6, y0 + 20], [cx - 6, y0 + 20], [cx - 9, y0 + 18]]);
    if (st === 'ponytail') {m.cap(cx + 6, y0 + 1, cx + 9, y0 + 7, 2.2); m.cap(cx + 9, y0 + 7, cx + 9, y0 + 14, 1.7); m.cap(cx + 9, y0 + 14, cx + 8, y0 + 17, 1.1);}
    if (st === 'bun') m.ell(cx, y0 - 1, 3.6, 3);
    if (st === 'bob') m.poly([[cx - 8, y0 + 4], [cx + 8, y0 + 4], [cx + 9.5, y0 + 10], [cx + 9, y0 + 14], [cx + 6, y0 + 15.5], [cx - 6, y0 + 15.5], [cx - 9, y0 + 14], [cx - 9.5, y0 + 10]]);
    if (st === 'twintails') for (const d of [-1, 1]) {m.cap(cx + d * 7, y0 + 2, cx + d * 9, y0 + 8, 2.2); m.cap(cx + d * 9, y0 + 8, cx + d * 9.5, y0 + 15, 1.9); m.cap(cx + d * 9.5, y0 + 15, cx + d * 8.5, y0 + 19, 1.2);}
    if (st === 'waves') m.poly([[cx - 8, y0 + 4], [cx + 8, y0 + 4], [cx + 10, y0 + 9], [cx + 9, y0 + 13], [cx + 11, y0 + 17], [cx + 8, y0 + 19], [cx + 6, y0 + 17], [cx + 4, y0 + 19], [cx + 2, y0 + 17], [cx, y0 + 19], [cx - 2, y0 + 17], [cx - 4, y0 + 19], [cx - 6, y0 + 17], [cx - 8, y0 + 19], [cx - 11, y0 + 17], [cx - 9, y0 + 13], [cx - 10, y0 + 9]]);
    if (st === 'mane') m.poly([[cx - 8, y0 + 4], [cx + 8, y0 + 4], [cx + 10, y0 + 10], [cx + 10, y0 + 15], [cx + 8, y0 + 18], [cx + 6, y0 + 15], [cx + 4, y0 + 18], [cx + 2, y0 + 15], [cx, y0 + 18], [cx - 2, y0 + 15], [cx - 4, y0 + 18], [cx - 6, y0 + 15], [cx - 8, y0 + 18], [cx - 10, y0 + 15], [cx - 10, y0 + 10]]);
    if (st === 'topknot') {m.ell(cx, y0 - 2.6, 3, 2.6); m.cap(cx + 2, y0 - 3.6, cx + 4.5, y0 - 2, 1);}
    if (st === 'curls') for (const [dx, dy, r] of [[-7.5, 1.5, 2.6], [-5, -1.5, 2.8], [-1.5, -2.6, 2.9], [2.5, -2.4, 2.9], [5.5, -.8, 2.8], [7.8, 2, 2.6], [-8.4, 6, 2.2], [8.4, 6, 2.2]]) m.ell(cx + dx, y0 + dy, r, r);
    if (!m.empty()) paint(B, m, st === 'bun' || st === 'curls' || st === 'topknot' ? H : shiftRamp(H, -1), {shade: st === 'bun' || st === 'curls' || st === 'topknot' ? 'ball' : 'cyl'});
    if (st === 'long' || st === 'waves') for (const x of [cx - 7, cx + 6]) vline(B, x, y0 + 14, y0 + 19, H.d);
    if (st === 'twintails') for (const d of [-1, 1]) {dot(B, cx + d * 7, y0 + 3, sp.tie); dot(B, cx + d * 8, y0 + 3, sp.tie);}
    if (st === 'topknot') {dot(B, cx - 1, y0 - 0, sp.tie); dot(B, cx, y0 - 0, sp.tie);}
  } else if (view === 'left') {
    if (st === 'long') m.poly([[cx + 1, y0 + 3], [cx + 8, y0 + 5], [cx + 9, y0 + 19], [cx + 6, y0 + 21], [cx + 2, y0 + 19], [cx + 1, y0 + 14]]);
    if (st === 'ponytail') {m.cap(cx + 6, y0 + 1, cx + 10, y0 + 6, 2.3); m.cap(cx + 10, y0 + 6, cx + 10, y0 + 13, 1.8); m.cap(cx + 10, y0 + 13, cx + 9, y0 + 17, 1.1);}
    if (st === 'braid') for (let i = 0; i < 4; i++) m.ell(cx + 7.2 - i * .2, y0 + 12.5 + i * 2.1, 1.35, 1.25);
    if (st === 'tied') m.cap(cx + 6.5, y0 + 10, cx + 7.5, y0 + 15, 1.4);
    if (st === 'bun') m.ell(cx + 5, y0, 3.2, 3);
    if (st === 'bob' || st === 'shaggy') m.poly([[cx + 1, y0 + 4], [cx + 8, y0 + 4], [cx + 8, y0 + 13], [cx + 2, y0 + 13]]);
    if (st === 'twintails') {m.cap(cx + 6, y0 + 2, cx + 9, y0 + 8, 2.2); m.cap(cx + 9, y0 + 8, cx + 10, y0 + 15, 1.9); m.cap(cx + 10, y0 + 15, cx + 9, y0 + 19, 1.2);}
    if (st === 'waves') m.poly([[cx + 1, y0 + 3], [cx + 8, y0 + 5], [cx + 9, y0 + 16], [cx + 8, y0 + 18], [cx + 6, y0 + 16], [cx + 4, y0 + 18], [cx + 2, y0 + 16], [cx + 1, y0 + 13]]);
    if (st === 'mane') m.poly([[cx + 1, y0 + 3], [cx + 8, y0 + 5], [cx + 9, y0 + 14], [cx + 8, y0 + 17], [cx + 6, y0 + 15], [cx + 4, y0 + 17], [cx + 2, y0 + 15], [cx + 1, y0 + 12]]);
    if (st === 'topknot') {m.ell(cx + 2, y0 - 2.4, 3, 2.6); m.cap(cx + 4.5, y0 - 3.4, cx + 7, y0 - 1.5, 1);}
    if (st === 'curls') for (const [dx, dy, r] of [[-1, -2.4, 2.9], [2.5, -1.6, 2.8], [5.5, .5, 2.8], [8, 3.5, 2.6], [8.6, 7.5, 2.3], [7.4, 11, 2]]) m.ell(cx + dx, y0 + dy, r, r);
    if (!m.empty()) paint(B, m, H, {shade: st === 'bun' || st === 'curls' || st === 'topknot' ? 'ball' : 'cyl'});
    if (st === 'twintails') {dot(B, cx + 7, y0 + 3, sp.tie); dot(B, cx + 8, y0 + 3, sp.tie);}
    if (st === 'topknot') {dot(B, cx + 2, y0 - 1, sp.tie); dot(B, cx + 3, y0 - 1, sp.tie);}
    if (st === 'braid') {for (let i = 0; i < 4; i++) dot(B, Math.round(cx + 6.8 - i * .2), Math.round(y0 + 12.5 + i * 2.1), H.s); dot(B, Math.round(cx + 6.6), y0 + 21, sp.tie); dot(B, Math.round(cx + 6.6), y0 + 22, H.b);}
    if (st === 'braid' || st === 'ponytail' || st === 'tied') {const ty = st === 'braid' ? y0 + 12 : st === 'tied' ? y0 + 10 : y0 + 5; dot(B, cx + (st === 'ponytail' ? 9 : 7), ty, sp.tie); dot(B, cx + (st === 'ponytail' ? 10 : 6), ty, sp.tie);}
  }
}
function hairOverBack(B, sp, r) {
  if (sp.hood || sp.helm === 'full') return;
  const st = sp.hairStyle, H = sp.hair;
  if (sp.hat && (st === 'curls' || st === 'topknot' || st === 'bun')) return;   // the hat covers the crown
  const hat = !!sp.hat, tailTop = hat ? 8 : 3,  b = r.bob + (r.head || 0), y0 = 10 + b, cx = 20 + (r.hx || 0), m = new Mask(HW, HH);
  if (st === 'long') m.poly([[cx - 7, y0 + 12], [cx + 7, y0 + 12], [cx + 8, y0 + 19], [cx + 5, y0 + 21], [cx, y0 + 20], [cx - 5, y0 + 21], [cx - 8, y0 + 19]]);
  if (st === 'ponytail') {m.cap(cx, y0 + 3, cx, y0 + 9, 2.2); m.cap(cx, y0 + 9, cx + 1, y0 + 17, 1.8); m.cap(cx + 1, y0 + 17, cx + 1, y0 + 19, 1);}
  if (st === 'braid') for (let i = 0; i < 5; i++) m.ell(cx, y0 + 15 + i * 2, 1.9, 1.4);
  if (st === 'tied') m.cap(cx, y0 + 13, cx, y0 + 17, 1.3);
  if (st === 'bun') m.ell(cx, y0, 3.6, 3);
  if (st === 'twintails') for (const d of [-1, 1]) {m.cap(cx + d * 6, y0 + tailTop, cx + d * 8.5, y0 + 9, 1.9); m.cap(cx + d * 8.5, y0 + 9, cx + d * 8.5, y0 + 16, 1.7); m.cap(cx + d * 8.5, y0 + 16, cx + d * 7.5, y0 + 19, 1.1);}
  if (st === 'waves') m.poly([[cx - 7, y0 + 12], [cx + 7, y0 + 12], [cx + 8, y0 + 17], [cx + 6, y0 + 19], [cx + 4, y0 + 17], [cx + 2, y0 + 19], [cx, y0 + 17], [cx - 2, y0 + 19], [cx - 4, y0 + 17], [cx - 6, y0 + 19], [cx - 8, y0 + 17]]);
  if (st === 'mane') m.poly([[cx - 7, y0 + 12], [cx + 7, y0 + 12], [cx + 8, y0 + 16], [cx + 6, y0 + 18], [cx + 4, y0 + 16], [cx + 2, y0 + 18], [cx, y0 + 16], [cx - 2, y0 + 18], [cx - 4, y0 + 16], [cx - 6, y0 + 18], [cx - 8, y0 + 16]]);
  if (st === 'topknot') {m.ell(cx, y0 - 2.6, 3, 2.6); m.cap(cx + 2, y0 - 3.6, cx + 4.5, y0 - 2, 1);}
  if (st === 'curls') for (const [dx, dy, r] of [[-7.5, 1.5, 2.6], [-5, -1.5, 2.8], [-1.5, -2.6, 2.9], [2.5, -2.4, 2.9], [5.5, -.8, 2.8], [7.8, 2, 2.6], [-8.4, 6, 2.2], [8.4, 6, 2.2]]) m.ell(cx + dx, y0 + dy, r, r);
  if (m.empty()) return;
  paint(B, m, H, {shade: st === 'bun' || st === 'curls' || st === 'topknot' ? 'ball' : 'cyl', contour: 'd'});
  if (st === 'twintails' && !hat) for (const d of [-1, 1]) dot(B, cx + d * 6, y0 + 3, sp.tie);
  if (st === 'topknot') {dot(B, cx - 1, y0 - 1, sp.tie); dot(B, cx, y0 - 1, sp.tie);}
  if (st === 'long') {for (const x of [cx - 4, cx - 1, cx + 3]) for (let y = y0 + 14; y < y0 + 20; y += 1) if (m.on(x, y)) B.put(x, y, H.s);}
  if (st === 'braid') for (let i = 0; i < 5; i++) {dot(B, cx - 1, y0 + 15 + i * 2, H.s); dot(B, cx + 1, y0 + 16 + i * 2, H.s);}
  const ty = st === 'braid' ? y0 + 14 : st === 'tied' ? y0 + 13 : st === 'ponytail' ? y0 + 8 : 0;
  if (ty) {dot(B, cx - 1, ty, sp.tie); dot(B, cx, ty, sp.tie);}
}
function headSide(B, sp, r) {
  const b = r.bob, tx = r.lean || 0, cx = 20 + tx, ox = cx - 8, y0 = 10 + b, oy = y0 - 2, st = sp.hairStyle, H = sp.hair, hm = hairMap(H);
  paint(B, new Mask(HW, HH).rect(cx - 1, y0 + 12, 4, 3), shiftRamp(sp.skin, -1), {shade: 'none'});
  stamp(B, SKULL.side, ox, oy, skinMap(sp.skin));
  if (sp.skeleton) {skullFace(B, sp, r, cx, y0, false, true); return;}
  if (sp.helm === 'full') {fullHelm(B, sp, r, cx, y0, 'left'); return;}
  dot(B, ox - 1, oy + 11, sp.skin.b); dot(B, ox - 1, oy + 12, sp.skin.s); // nose
  const ey = y0 + 7;
  eye(B, sp, ox + 2, ey, r.eyes, ox + 1, true);
  dot(B, ox + 4, ey + 3, sp.blush);
  faceMark(B, sp, ox + 3, 0, ey, true);
  const mc = sp.mouth;
  if (r.mouth === 'open' || r.mouth === 'shout') {dot(B, ox, ey + 4, mc); dot(B, ox + 1, ey + 4, mc); dot(B, ox + 1, ey + 5, mix(mc, [70, 24, 34], .5));} else dot(B, ox + 1, ey + 4, mc);
  // ear (visible below short hair)
  dot(B, ox + 8, ey + 1, sp.skin.s); dot(B, ox + 9, ey + 1, sp.skin.b); dot(B, ox + 8, ey + 2, sp.skin.d); dot(B, ox + 9, ey + 2, sp.skin.s);
  if (sp.hood || sp.helm === 'full' || st === 'none') return;
  const fam = FAMILY[st] || 'bangs', cap = CAPS[fam].side, capOy = oy;
  stamp(B, cap, ox, capOy, hm);
  if (LONGISH.has(st) || ['shaggy', 'braid', 'bun', 'ponytail', 'twintails', 'crown', 'topknot', 'curls'].includes(st)) for (let j = 11; j <= (LONGISH.has(st) ? 15 : 13); j++) for (let i = 9; i <= 13; i++) if (!(!LONGISH.has(st) && j > 13)) B.put(ox + i, capOy + j, hm[i === 13 || j === 16 ? 'd' : i === 9 ? 's' : 'b']);
  for (let x = ox; x <= ox + 6; x++) {let y = y0; while (y < y0 + 12 && isHair(B, x, y, H)) y++; if (y > y0 && y < y0 + 12 && !isHair(B, x, y, H) && !isEyePx(B, x, y, sp) && B.a(x, y)) B.put(x, y, sp.skin.s);}
}
// Bare skull: dark sockets with a glowing ember, nose hole and a row of teeth.
function skullFace(B, sp, r, cx, y0, back, side) {
  const ink = M.ink, ey = y0 + 7, G = sp.eyes;
  if (back) {for (let y = y0 + 2; y < y0 + 11; y += 3) dot(B, cx - 4, y, sp.skin.s); return;}
  const sockets = side ? [cx - 7] : [cx - 5, cx + 2];
  for (const x of sockets) {for (let j = 0; j < 3; j++) for (let i = 0; i < (side ? 2 : 3); i++) B.put(x + i, ey + j, j === 0 && i === 0 ? sp.skin.d : ink.b); if (r.eyes !== 'hurt' && r.eyes !== 'closed') {B.put(x + 1, ey + 1, G[0], 1); B.put(x + 1, ey, G[1], 1);}}
  if (side) {dot(B, cx - 9, ey + 3, ink.b); for (let i = 0; i < 4; i++) {B.put(cx - 8 + i, ey + 5, i % 2 ? ink.s : sp.skin.l); B.put(cx - 8 + i, ey + 6, sp.skin.s);} return;}
  dot(B, cx - 1, ey + 3, ink.b); dot(B, cx, ey + 3, ink.s);
  for (let i = -3; i <= 2; i++) {B.put(cx + i, ey + 5, i % 2 ? ink.s : sp.skin.l); B.put(cx + i, ey + 6, sp.skin.s);}
  dot(B, cx - 6, ey + 4, sp.skin.s); dot(B, cx + 5, ey + 4, sp.skin.d);
}
// Closed great-helm with a glowing visor slit (ash sentinels).
function fullHelm(B, sp, r, cx, y0, view) {
  const S = M.steel, side = view === 'left', back = view === 'up', m = new Mask(HW, HH).ell(cx + (side ? 0 : 0), y0 + 6, side ? 8.7 : 8, 7.8);
  m.rect(side ? cx - 9 : cx - 7, y0 + 6, side ? 16 : 14, 8); m.clipY(y0 - 2, y0 + 14);
  paint(B, m, S, {shade: 'cyl', contour: true});
  if (back) {vline(B, cx - 1, y0, y0 + 13, S.l); vline(B, cx, y0, y0 + 13, S.s); return;}
  const ey = y0 + 7;
  if (side) {for (let x = cx - 9; x <= cx - 3; x++) B.put(x, ey, M.ink.b); for (const x of [cx - 8, cx - 7]) B.put(x, ey, sp.eyes[0], 1); vline(B, cx - 8, y0 + 1, y0 + 13, S.l); for (let y = ey + 3; y < ey + 6; y += 2) dot(B, cx - 5, y, M.ink.s); dot(B, cx + 3, y0 - 2, sp.plume || M.ember.b); dot(B, cx + 4, y0 - 1, sp.plume || M.ember.s);}
  else {for (let x = cx - 6; x <= cx + 5; x++) B.put(x, ey, M.ink.b); for (const x of [cx - 4, cx - 3, cx + 2, cx + 3]) B.put(x, ey, sp.eyes[x < cx ? 0 : 1], 1); vline(B, cx - 1, y0, ey - 1, S.h); vline(B, cx - 1, ey + 1, y0 + 13, S.l); vline(B, cx, ey + 1, y0 + 13, S.s); for (const x of [cx - 4, cx - 3, cx + 2, cx + 3]) dot(B, x, ey + 4, M.ink.s);}
}
// ================================================================ humanoids
// Frame 40x48. Feet rest on row 45; the figure is about 36px tall (3 heads) and 16-22px wide.
const HW = 40, HH = 48, FOOT = 45;
const isAttack = it => it === 'wind' || it === 'strike' || it === 'recover';

// Pose rig in FRONT-view coordinates. Arms are [shoulder, elbow?, hand]; arms[0] is screen-left.
// Front view: the character's right hand is screen-left. Back view: it is screen-right.
function frontRig(sp, pose, f, back) {
  const r = {bob: 0, head: 0, hx: 0, eyes: 'open', mouth: 'calm', crouch: 0, legs: [{lift: 0, dx: 0}, {lift: 0, dx: 0}], item: 'rest'};
  const sh = sp.shoulder;
  const A = (side, hx, hy, ex, ey) => ({s: [side ? 20 + sh - .5 : 20 - sh - .5, 24.5], e: ex == null ? null : [ex, ey], h: [hx, hy]});
  r.arms = [A(0, 20 - sh - 1, 32), A(1, 20 + sh, 32)];
  // which screen side holds the weapon hand
  const W = back ? 1 : 0, O = 1 - W, wx = s => back ? 40 - s : s; // mirror helper for the weapon side
  const polearm = sp.gear.staff || sp.gear.spear || sp.gear.fork;
  if (polearm) r.arms[W] = A(W, wx(12), 31, wx(13), 28);
  if (pose === 'idle') r.bob = f;
  else if (pose === 'walk') {
    const contact = f % 2 === 1; r.bob = contact ? 1 : 0;
    if (!contact) {const lifted = f === 0 ? 0 : 1; r.legs[lifted].lift = 2; const fwd = 1 - lifted; if (!(polearm && fwd === W)) {r.arms[fwd].h[1] += 1; r.arms[fwd].h[0] += fwd ? -1 : 1;} if (!(polearm && lifted === W)) r.arms[lifted].h[1] -= 1;}
  } else if (pose === 'attack') {
    r.item = ['wind', 'strike', 'recover'][f];
    if (f === 0) {r.arms[W] = A(W, wx(12), 18, wx(11.5), 23); r.mouth = 'set'; r.legs[O].dx = back ? 1 : 1;}
    if (f === 1) {r.bob = 1; r.arms[W] = A(W, wx(22), 31, wx(16), 28); r.mouth = 'shout'; r.legs[W].dx = back ? 1 : -1;}
    if (f === 2) {r.bob = 1; r.arms[W] = A(W, wx(16), 32, wx(14), 28);}
  } else if (pose === 'cast') {
    r.item = 'cast'; r.arms[0] = A(0, 12, 23, 12, 27); r.arms[1] = A(1, 28, 23, 28, 27); r.eyes = f ? 'focus' : 'open'; r.mouth = 'set';
  } else if (pose === 'hurt') {
    r.item = 'hurt'; r.bob = 0; r.head = -1; r.hx = back ? -1 : 1; r.arms[0] = A(0, 12, 31, 12, 27); r.arms[1] = A(1, 28, 31, 28, 27); r.eyes = 'hurt'; r.mouth = 'open'; r.legs[0].dx = -1; r.legs[1].dx = 1;
  } else if (pose === 'guard') {
    r.item = 'guard'; r.bob = 1; r.crouch = 1; r.arms[W] = A(W, wx(18), 30, wx(13), 29); r.arms[O] = A(O, wx(23), 29, wx(26), 28); r.eyes = 'focus'; r.mouth = 'set';
  }
  if (sp.zombie && (pose === 'idle' || pose === 'walk')) {r.arms[0] = A(0, 15, 27 + (f % 2), 13, 26); r.arms[1] = A(1, 25, 27 + ((f + 1) % 2), 27, 26); r.mouth = 'open'; r.eyes = 'focus';}
  r.bob += sp.sink || 0;
  for (const a of r.arms) {a.s = [a.s[0], a.s[1] + r.bob]; if (a.e) a.e = [a.e[0], a.e[1] + r.bob]; a.h = [a.h[0], a.h[1] + r.bob];}
  return r;
}
function sideRig(sp, pose, f) {
  // Facing LEFT. The near (camera-side) hand carries the drawn weapon, the classic sprite convention.
  const r = {bob: 0, lean: 0, eyes: 'open', mouth: 'calm', legs: {near: 0, far: 0}, lift: {near: 0, far: 0}, item: 'rest'};
  r.near = {s: [20, 24.5], e: null, h: [19.5, 32]}; r.far = {s: [21, 24.5], e: null, h: [21, 31], hidden: true};
  if (pose === 'idle') r.bob = f;
  else if (pose === 'walk') {
    if (f === 0) {r.lift.near = 2; r.legs.near = -1; r.legs.far = 1;}
    if (f === 1) {r.bob = 1; r.legs.near = -4; r.legs.far = 3; r.near.h = [23, 31]; r.far = {s: [21, 24.5], e: null, h: [16.5, 31]};}
    if (f === 2) {r.lift.far = 2; r.legs.near = 1; r.legs.far = -1;}
    if (f === 3) {r.bob = 1; r.legs.near = 3; r.legs.far = -4; r.near.h = [16, 31]; r.far = {s: [21, 24.5], e: null, h: [24, 31]};}
  } else if (pose === 'attack') {
    r.item = ['wind', 'strike', 'recover'][f];
    if (f === 0) {r.lean = 1; r.near = {s: [20, 24.5], e: [23, 22], h: [23, 17]}; r.legs.near = -2; r.legs.far = 2; r.mouth = 'set';}
    if (f === 1) {r.lean = -1; r.bob = 1; r.near = {s: [19, 24.5], e: [15, 26], h: [11, 27]}; r.legs.near = -4; r.legs.far = 3; r.mouth = 'shout';}
    if (f === 2) {r.bob = 1; r.near = {s: [20, 24.5], e: [17, 28], h: [15, 31]}; r.legs.near = -3; r.legs.far = 2;}
  } else if (pose === 'cast') {
    r.item = 'cast'; r.near = {s: [20, 24.5], e: [16, 25], h: [13, 23]}; r.far = {s: [21, 24.5], e: [18, 25], h: [15, 25]}; r.eyes = f ? 'focus' : 'open'; r.mouth = 'set'; r.legs.near = -2; r.legs.far = 1;
  } else if (pose === 'hurt') {
    r.item = 'hurt'; r.lean = 2; r.near = {s: [21, 24.5], e: [23, 27], h: [25, 29]}; r.eyes = 'hurt'; r.mouth = 'open'; r.legs.near = 1; r.legs.far = 3;
  } else if (pose === 'guard') {
    r.item = 'guard'; r.bob = 1; r.lean = -1; r.near = {s: [19, 24.5], e: [16, 28], h: [14, 26]}; r.eyes = 'focus'; r.mouth = 'set'; r.legs.near = -3; r.legs.far = 2;
  } else if (pose === 'down') {
    r.near = {s: [20, 24.5], e: null, h: [20, 33]}; r.eyes = 'closed'; r.down = true;
  }
  if (sp.zombie && (pose === 'idle' || pose === 'walk')) {r.near = {s: [20, 24.5], e: [17, 26], h: [13, 26 + (f % 2)]}; r.far = {s: [21, 24.5], e: [18, 26], h: [14, 27 - (f % 2)]}; r.mouth = 'open'; r.eyes = 'focus';}
  r.bob += sp.sink || 0;
  return r;
}

// ---- limbs ----
function armMask(a, dx = 0, dy = 0, r1 = 1.45, r2 = 1.35) {
  const m = new Mask(HW, HH), s = [a.s[0] + dx, a.s[1] + dy], h = [a.h[0] + dx, a.h[1] + dy];
  if (a.e) {const e = [a.e[0] + dx, a.e[1] + dy]; m.cap(s[0], s[1], e[0], e[1], r1); m.cap(e[0], e[1], h[0], h[1] - 1, r2);}
  else m.cap(s[0], s[1], h[0], h[1] - 1.5, r1);
  return m;
}
function arm(B, sp, a, R, {dx = 0, dy = 0, dark = false, glove = null} = {}) {
  const m = sp.skeleton ? armMask(a, dx, dy, .95, .9) : armMask(a, dx, dy);
  paint(B, m, dark ? shiftRamp(R, -1) : R, {shade: 'cyl', sw: 1, contour: true});
  // cuff ring just above the hand
  const hx = a.h[0] + dx, hy = a.h[1] + dy, ax = a.e ? a.e[0] + dx : a.s[0] + dx, ay = a.e ? a.e[1] + dy : a.s[1] + dy, len = Math.hypot(hx - ax, hy - ay) || 1;
  const cx = Math.round(hx - (hx - ax) / len * 2.2), cy = Math.round(hy - (hy - ay) / len * 2.2);
  if (sp.cuff) for (const [ox, oy] of [[0, 0], [-1, 0], [1, 0]]) if (m.on(cx + ox, cy + oy)) B.put(cx + ox, cy + oy, ox < 0 ? sp.cuff.b : sp.cuff.s);
  // a small 3x2 hand: lit knuckles, shaded underside
  const S = glove || sp.skin, x0 = Math.round(hx - 1.5), y0 = Math.round(hy - 1);
  for (let i = 0; i < 3; i++) {B.put(x0 + i, y0, i === 2 ? S.b : S.l); B.put(x0 + i, y0 + 1, i === 0 ? S.b : S.s);}
  B.put(x0 + 1, y0 + 2, dark ? S.d : S.s);
  if (dark) for (let i = 0; i < 3; i++) B.put(x0 + i, y0 + 1, S.s);
}
function legsFront(B, sp, r, back) {
  for (let i = 0; i < 2; i++) {
    const lg = r.legs[i], x = (i ? 21 : 15) + lg.dx + (r.crouch ? (i ? 1 : -1) : 0), foot = FOOT - lg.lift, top = 33 + r.bob;
    const R = i ? shiftRamp(sp.pants, -1) : sp.pants;
    paint(B, new Mask(HW, HH).rect(sp.skeleton ? x + 1 : x, top, sp.skeleton ? 2 : 4, Math.max(1, foot - top - 3)), R, {shade: 'cyl', sw: 1});
    const bm = new Mask(HW, HH).rect(x, foot - 4, 4, 5);
    if (!back) {bm.set(i ? x + 4 : x - 1, foot); bm.set(i ? x + 4 : x - 1, foot - 1);}
    paint(B, bm, sp.boot, {shade: 'cyl', sw: 1, contour: true});
    hline(B, x, x + 3, foot - 4, i ? sp.boot.b : sp.boot.l); // turned-down cuff
    if (!back) dot(B, i ? x + 1 : x + 2, foot - 1, sp.boot.l); // toe glint
  }
}
function legSide(B, sp, r, dx, lift, far) {
  const top = 33 + r.bob, fx = 19 + dx, fy = FOOT - lift;
  const R = far ? shiftRamp(sp.pants, -1) : sp.pants, Bt = far ? shiftRamp(sp.boot, -1) : sp.boot;
  paint(B, new Mask(HW, HH).cap(19.5, top, fx + .5, fy - 4, sp.skeleton ? 1 : 1.6), R, {shade: 'cyl', sw: 1, contour: !far});
  const bm = new Mask(HW, HH).rect(fx - 1, fy - 4, 4, 4); bm.rect(fx - 2, fy - 1, 5, 2); bm.set(fx - 3, fy); bm.clipY(0, fy);
  paint(B, bm, Bt, {shade: 'cyl', sw: 1, contour: !far});
  hline(B, fx - 1, fx + 2, fy - 4, far ? Bt.b : Bt.l);
}

// ---- torso + garments (front/back) ----
function torsoFront(B, sp, r, back) {
  const b = r.bob, sh = sp.shoulder, wa = sp.waist, hp = sp.hip, coat = sp.coat, g = sp.garment;
  const T = new Mask(HW, HH).poly([[20 - sh + 1, 23 + b], [20 + sh - 1, 23 + b], [20 + sh, 24 + b], [20 + sh, 26 + b], [20 + wa, 31 + b], [20 + hp, 35 + b], [20 - hp, 35 + b], [20 - wa, 31 + b], [20 - sh, 26 + b], [20 - sh, 24 + b]]);
  // skirt / coat tails / robe below the belt
  const sk = new Mask(HW, HH);
  if (g === 'robe' || g === 'gown') sk.poly([[20 - hp, 33 + b], [20 + hp, 33 + b], [20 + hp + 3, 44], [20 - hp - 3, 44]]);
  else if (g === 'longcoat') sk.poly([[20 - hp, 33 + b], [20 + hp, 33 + b], [20 + hp + 2.5, 42], [20 - hp - 2.5, 42]]);
  else if (g === 'coat' || g === 'tunic' || g === 'smock' || g === 'apron') sk.poly([[20 - hp, 33 + b], [20 + hp, 33 + b], [20 + hp + 1, 38 + b], [20 - hp - 1, 38 + b]]);
  if (!sk.empty()) {
    paint(B, sk, coat, {shade: 'cyl'});
    let yb = 0; for (let y = HH - 1; y > 0 && !yb; y--) for (let x = 0; x < HW; x++) if (sk.on(x, y)) {yb = y; break;}
    // hem band + soft folds (ragged for the unburied)
    if (sp.ragged) {for (let x = 0; x < HW; x++) if (sk.on(x, yb) && (x * 5) % 3 === 0) {B.clear(x, yb); if (x % 2) B.clear(x, yb - 1);}}
    else for (let x = 0; x < HW; x++) if (sk.on(x, yb)) B.put(x, yb, x < 20 ? sp.trim.b : sp.trim.s);
    if (g !== 'coat' && g !== 'tunic') for (const fx of [17, 23]) for (let y = yb - 5; y < yb - 1; y++) if (sk.on(fx, y)) B.put(fx + (y > yb - 3 ? (fx < 20 ? -1 : 1) : 0), y, coat.s);
    if (g === 'coat' || g === 'tunic') {dot(B, 17, yb - 1, coat.s); dot(B, 23, yb - 2, coat.s);}
    if (!back && g === 'longcoat') {for (let y = 35 + b; y <= 41; y++) {B.put(19, y, sp.inner.s); B.put(20, y, sp.inner.d);} vline(B, 18, 35 + b, 41, sp.trim.b); vline(B, 21, 35 + b, 41, sp.trim.s);}
    if (!back && g === 'robe') {vline(B, 19, 35 + b, 43, sp.trim.l); vline(B, 20, 35 + b, 43, sp.trim.s);}
    if (back && (g === 'longcoat' || g === 'coat')) vline(B, 20, 36 + b, yb - 1, coat.d);
  }
  paint(B, T, coat, {shade: 'cyl'});
  if (!back) {
    if (g === 'robe') {const v = new Mask(HW, HH).poly([[18, 23 + b], [22, 23 + b], [20.5, 27 + b], [19.5, 27 + b]]); paint(B, v, sp.inner || sp.trim, {shade: 'flat'}); vline(B, 19, 27 + b, 33 + b, sp.trim.l); vline(B, 20, 27 + b, 33 + b, sp.trim.s);}
    else if (g === 'longcoat') {const im = new Mask(HW, HH).poly([[18, 23 + b], [22, 23 + b], [21.5, 33 + b], [18.5, 33 + b]]); paint(B, im, sp.inner, {shade: 'flat'}); vline(B, 17, 24 + b, 32 + b, sp.trim.b); vline(B, 22, 24 + b, 32 + b, sp.trim.s); for (let y = 25 + b; y < 32 + b; y += 3) dot(B, 21, y, M.brass.l);}
    else if (sp.vest) {const v = new Mask(HW, HH).poly([[17, 23 + b], [23, 23 + b], [21.5, 33 + b], [18.5, 33 + b]]); paint(B, v, sp.inner, {shade: 'flat'}); vline(B, 18, 25 + b, 32 + b, sp.coat.l); vline(B, 22, 25 + b, 32 + b, sp.coat.s);}
    else if (g === 'tunic') {const v = new Mask(HW, HH).poly([[18, 23 + b], [22, 23 + b], [20.5, 26 + b], [19.5, 26 + b]]); paint(B, v, sp.skin, {shade: 'flat'}); hline(B, 18, 21, 23 + b, sp.trim.b);}
    else {vline(B, 20, 25 + b, 32 + b, coat.d); vline(B, 19, 25 + b, 32 + b, coat.l); hline(B, 18, 21, 23 + b, sp.trim.b); dot(B, 18, 24 + b, sp.trim.s); dot(B, 21, 24 + b, sp.trim.s);}
  } else vline(B, 20, 25 + b, 32 + b, coat.s);
  // belt with buckle
  for (let x = 20 - hp; x < 20 + hp; x++) {B.put(x, 33 + b, x < 20 + hp - 3 ? sp.belt.b : sp.belt.s); B.put(x, 34 + b, sp.belt.d);}
  if (!back) {dot(B, 19, 33 + b, M.brass.h); dot(B, 20, 33 + b, M.brass.l); dot(B, 19, 34 + b, M.brass.b); dot(B, 20, 34 + b, M.brass.s);}
  return T;
}
// High collar (summoner) and capelet/mantle (ranger) sit over the shoulders.
function collarFront(B, sp, r, back) {
  const b = r.bob;
  if (sp.collar) {
    // tall flared collar: coat outside, pale lining facing the jaw
    const m = new Mask(HW, HH), lin = new Mask(HW, HH);
    if (!back) {m.poly([[11, 15 + b], [16, 19 + b], [17, 25 + b], [13, 25 + b], [11.5, 20 + b]]); m.poly([[29, 15 + b], [24, 19 + b], [23, 25 + b], [27, 25 + b], [28.5, 20 + b]]); lin.poly([[12.5, 16 + b], [16, 19.5 + b], [16, 22 + b], [13.5, 19 + b]]); lin.poly([[27.5, 16 + b], [24, 19.5 + b], [24, 22 + b], [26.5, 19 + b]]);}
    else m.poly([[11, 15 + b], [29, 15 + b], [27, 25 + b], [13, 25 + b]]);
    paint(B, m, sp.coat, {shade: 'cyl', contour: true});
    if (!back) paint(B, lin, sp.inner, {shade: 'flat'});
    else {hline(B, 12, 27, 15 + b, sp.trim.l); for (let y = 16 + b; y < 24 + b; y++) {B.put(14, y, sp.coat.l); B.put(26, y, sp.coat.s);}}
  }
  if (sp.mantle) {
    const m = new Mask(HW, HH).poly([[14, 22 + b], [26, 22 + b], [29, 27 + b], [27, 29 + b], [24, 28 + b], [20, 29 + b], [16, 28 + b], [13, 29 + b], [11, 27 + b]]);
    paint(B, m, sp.cloak, {shade: 'cyl', contour: true});
    for (let x = 12; x <= 28; x++) {let y = 30 + b; while (y > 20 && !m.on(x, y)) y--; if (m.on(x, y)) B.put(x, y, sp.cloak.s);}
    if (!back) {dot(B, 20, 23 + b, M.brass.l); dot(B, 19, 23 + b, M.brass.b);}
  }
}
function capeBehindFront(B, sp, r) {
  if (!sp.cloak) return;
  const b = r.bob, m = new Mask(HW, HH).poly([[13, 24 + b], [27, 24 + b], [29.5, 41], [10.5, 41]]);
  paint(B, m, shiftRamp(sp.cloak, -1), {shade: 'cyl'});
}
function capeOverBack(B, sp, r) {
  if (!sp.cloak) return;
  const b = r.bob, m = new Mask(HW, HH).poly([[13, 23 + b], [27, 23 + b], [29.5, 42], [10.5, 42]]);
  paint(B, m, sp.cloak, {shade: 'cyl'});
  for (const x of [16, 20, 24]) for (let y = 31 + b; y < 41; y++) if (y % 4 !== 0) B.put(x + (y > 37 ? (x < 20 ? -1 : x > 20 ? 1 : 0) : 0), y, sp.cloak.s);
  hline(B, 11, 29, 41, sp.cloak.d);
}

// ---- equipment ----
function blade(B, x, y, ang, len, glint = false) {
  // ang in degrees: 0 = blade pointing up; grip at (x,y).
  const a = ang * Math.PI / 180, ux = Math.sin(a), uy = -Math.cos(a), st = M.steel, side = Math.abs(ux) > .7;
  for (let i = 2; i <= len; i++) {const px = Math.round(x + ux * i), py = Math.round(y + uy * i); B.put(px, py, i > len - 2 ? st.h : st.l); B.put(px + (side ? 0 : 1), py + (side ? 1 : 0), i > len - 2 ? st.b : st.s);}
  const gx = x + ux * 1.5, gy = y + uy * 1.5;
  for (let k = -2; k <= 2; k++) B.put(Math.round(gx - uy * k), Math.round(gy + ux * k), k === 0 ? M.brass.h : Math.abs(k) === 2 ? M.brass.s : M.brass.b);
  B.put(Math.round(x - ux * .5), Math.round(y - uy * .5), M.leather.b); B.put(Math.round(x - ux * 2), Math.round(y - uy * 2), M.brass.l);
  if (glint) B.put(Math.round(x + ux * (len - 3)), Math.round(y + uy * (len - 3)), [255, 255, 255], 1);
}
// Slash trail: a bright leading edge with a softer inner band.
function arc(B, pts, c = [255, 246, 214]) {for (let i = 0; i + 1 < pts.length; i++) {const m = new Mask(HW, HH).line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) if (m.on(x, y)) {B.put(x, y, i < 2 ? mix(c, [140, 170, 220], .45) : c, 1); if (i > 1 && i < pts.length - 2 && !B.a(x, y + 1)) B.put(x, y + 1, mix(c, [150, 180, 230], .55), 1);}}}
function staff(B, sp, x0, y0, x1, y1, glow = 1) {
  const m = new Mask(HW, HH).line(x0, y0 + 2, x1, y1);
  paint(B, m, M.wood, {shade: 'none'});
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i += 4) B.put(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + 2 + (y1 - y0 - 2) * i / n), M.wood.l);
  const ox = Math.round(x0), oy = Math.round(y0), G = sp.orb || M.glowTeal;
  // forked head cradling the orb
  for (const [dx, dy, c] of [[-2, 1, M.wood.s], [2, 1, M.wood.d], [-2, 0, M.wood.b], [2, 0, M.wood.s], [-1, 2, M.wood.b], [1, 2, M.wood.s], [-2, -1, M.wood.l], [2, -1, M.wood.s]]) B.put(ox + dx, oy + dy, c);
  if (glow > 1) for (const [dx, dy] of [[-4, -1], [4, -1], [0, -5], [0, 3], [-3, -4], [3, 2], [3, -4], [-3, 2]]) B.put(ox + dx, oy + dy, G.l, 1);
  const om = new Mask(HW, HH).ell(ox + .5, oy - .5, glow > 1 ? 2.3 : 1.8, glow > 1 ? 2.3 : 1.8);
  paint(B, om, G, {shade: 'ball', flag: 1});
  B.put(ox, oy - 1, [255, 255, 255], 1);
}
function bow(B, x, y, h, drawn = 0, facing = 1) {
  // Recurve bow standing vertically at (x,y); facing +1 = belly bulges right.
  const pts = []; for (let i = -h; i <= h; i++) {const t = i / h, bend = Math.round((1 - t * t) * 2.4) - (Math.abs(t) > .86 ? 1 : 0); pts.push([x + bend * facing, y + i]);}
  pts.forEach(([px, py], i) => B.put(px, py, i < h ? M.wood.l : M.wood.s));
  for (const k of [0, pts.length - 1]) B.put(pts[k][0] - facing, pts[k][1], M.wood.b);
  for (let k = -1; k <= 1; k++) B.put(x + 2 * facing, y + k, k ? M.leather.b : M.leather.l);
  const sx = x - drawn * facing, top = [pts[0][0] - facing, pts[0][1]], bot = [pts[pts.length - 1][0] - facing, pts[pts.length - 1][1]];
  const lm = new Mask(HW, HH).line(top[0], top[1], sx, y); lm.line(sx, y, bot[0], bot[1]);
  for (let yy = 0; yy < HH; yy++) for (let xx = 0; xx < HW; xx++) if (lm.on(xx, yy) && !B.a(xx, yy)) B.put(xx, yy, [222, 214, 190]);
}
function charm(B, sp, x, y, big = false) {
  const G = sp.orb || M.glowViolet;
  if (big) for (const [dx, dy] of [[-4, 0], [4, 0], [0, -5], [0, 5], [-3, -3], [3, 3], [3, -3], [-3, 3]]) B.put(x + dx, y + dy, G.l, 1);
  else for (const [dx, dy] of [[-3, 1], [3, -1]]) B.put(x + dx, y + dy, G.b, 1);
  // faceted crystal in a small brass cage
  const m = new Mask(HW, HH).poly([[x + .5, y - 4], [x + 3.5, y + .5], [x + .5, y + 5], [x - 2.5, y + .5]]);
  paint(B, m, G, {shade: 'ball', flag: 1});
  B.put(x, y - 5, M.brass.l); B.put(x, y - 4, M.brass.b); B.put(x, y + 5, M.brass.s); B.put(x - 2, y, M.brass.b); B.put(x + 2, y, M.brass.s);
  B.put(x - 1, y - 1, [255, 255, 255], 1); B.put(x, y - 2, G.h, 1);
}
function quiverFront(B, sp, b) {const m = new Mask(HW, HH).poly([[23, 21 + b], [26, 18 + b], [28.5, 21 + b], [25.5, 25 + b]]); paint(B, m, M.leather, {shade: 'cyl'}); for (const [x, y, c] of [[25, 17, M.cloth.l], [26, 16, sp.fletch], [24, 17, sp.fletch], [27, 17, M.cloth.b]]) dot(B, x, y + b, c);}
function quiverBack(B, sp, b) {const m = new Mask(HW, HH).poly([[21.5, 22 + b], [24.5, 19.5 + b], [28.5, 30 + b], [25.5, 32 + b]]); paint(B, m, M.leather, {shade: 'cyl', contour: true}); hline(B, 22, 25, 23 + b, M.brass.b); for (const [x, y, c] of [[22, 19, sp.fletch], [23, 18, M.cloth.l], [24, 18, sp.fletch], [25, 19, M.cloth.b]]) dot(B, x, y + b, c);}
function bowOnBack(B, sp, b, x0, y0, x1, y1) {const m = new Mask(HW, HH).line(x0, y0 + b, x1, y1 + b); paint(B, m, M.wood, {shade: 'none'}); dot(B, x0, y0 + b, M.wood.l); dot(B, x1, y1 + b, M.wood.s);}
function lantern(B, x, y) {
  vline(B, x, y - 3, y - 2, M.ink.l); hline(B, x - 1, x + 1, y - 1, M.ink.b); hline(B, x - 1, x + 1, y + 3, M.ink.b);
  paint(B, new Mask(HW, HH).rect(x - 1, y, 3, 3), M.glowGold, {shade: 'ball', flag: 1}); B.put(x, y + 1, [255, 255, 230], 1);
  for (const [dx, dy] of [[-3, 1], [3, 1], [0, 5]]) B.put(x + dx, y + dy, M.glowGold.b, 1);
}

// ---- hats & hoods ----
const HOOD = {
  front: T16(['.....sllbbs.....', '...sbllllbbbs...', '..sbllhhllbbbs..', '.sbllhhlbbbbbbs.', '.sbllbbbbbbbbbd.', 'sbllbssssssbbbbd', 'sblsddddddddsbbd', 'sbsdgffffffgdsbd', 'sbdgffgfgffgfdbd', 'sbd.g..f..g..dbd', 'sbd..........dbd', 'sbd..........dbd', 'sbd..........dbd', 'sbbd........dbbd', 'sbbbd......dbbbd', 'sbbbbd....dbbbbd', '.sbbbbbbbbbbbbd.']),
  side: T16(['.....sllbbs.....', '...sbllllbbbs...', '..sbllhhllbbbbs.', '.sbllhhlbbbbbbbs', '.sbllbbbbbbbbbbd', 'sbllbbbbbbbbbbsd', 'sbdddbbbbbbbbbbd', 'sdgffdbbbbbbbbbd', 'dgf.gdbbbbbbbbsd', '.....dbbbbbbbbd.', '.....dbbbbbbbbd.', '.....dbbbbbbbsd.', '.....dbbbbbbbsd.', '.....sdbbbbbbd..', '.....sbbbbbbbd..', '....sbbbbbbbbd..', '...sbbbbbbbbbbd.']),
  back: T16(['.....sllbbs.....', '...sbllllbbbs...', '..sbllhhllbbbs..', '.sbllhhlbbbbbbs.', '.sbllbbbbbbbbbd.', 'sbllbbbsbbbbbbbd', 'sblbbbbsbbbbbbbd', 'sbbbbbbsbbbbbbbd', 'sbbbbbbsbbbbbbbd', 'sbbbbbbsbbbbbbbd', 'sbbbbbbsbbbbbbbd', 'sbbbbbbbsbbbbbbd', 'sbbbbbbbsbbbbbbd', 'sbbbbbbbsbbbbbsd', '.sbbbbbbsbbbbbd.', 'sbbbbbbbsbbbbbbd', 'sbbbbbbbbbbbbbbd'])
};
function hood(B, sp, view, r) {
  const b = r.bob + (r.head || 0), tx = view === 'left' ? (r.lean || 0) : (r.hx || 0), cx = 20 + tx, y0 = 10 + b, R = sp.cloak, H = sp.hair;
  const map = {...hairMap(R), f: H.b, g: H.s};
  stamp(B, HOOD[view === 'left' ? 'side' : view === 'up' ? 'back' : 'front'], cx - 8, y0 - 3, map);
}
function hat(B, sp, view, r) {
  const b = r.bob + (r.head || 0), tx = view === 'left' ? (r.lean || 0) : (r.hx || 0), cx = 20 + tx, y0 = 10 + b, k = sp.hat, side = view === 'left';
  if (k === 'wizard') {
    const R = sp.hatColor || sp.coat;
    const cone = sp.downPose ? new Mask(HW, HH).poly([[cx - 6, y0 + 4], [cx + 7, y0 + 4], [cx + 5, y0], [cx + 9, y0 - 1], [cx + 1, y0 - 2]]) // knocked askew when collapsed
      : side ? new Mask(HW, HH).poly([[cx - 6, y0 + 4], [cx + 7, y0 + 4], [cx + 4, y0 - 2], [cx + 6, y0 - 6], [cx + 10, y0 - 8], [cx + 2, y0 - 6], [cx - 2, y0 - 1]])
      : new Mask(HW, HH).poly([[cx - 6.5, y0 + 4], [cx + 6.5, y0 + 4], [cx + 3.5, y0 - 2], [cx + 5, y0 - 6], [cx + 8, y0 - 8], [cx + 1, y0 - 6.5], [cx - 3, y0 - 1]]);
    paint(B, cone, R, {shade: 'cyl'});
    hline(B, cx - 6, cx + 5, y0 + 2, sp.trim.l); hline(B, cx - 6, cx + 5, y0 + 3, sp.trim.s);
    if (view !== 'up') {dot(B, side ? cx - 4 : cx - 3, y0 + 2, M.glowGold.h, 1); dot(B, side ? cx - 4 : cx - 3, y0 + 3, M.glowGold.b, 1);}
    const brim = new Mask(HW, HH).ell(cx + (side ? .5 : 0), y0 + 4.5, 10.5, 2.1);
    paint(B, brim, R, {shade: 'cyl', contour: true});
    for (let x = cx - 9; x <= cx + 9; x++) if (brim.on(x, y0 + 5) && !brim.on(x, y0 + 6)) B.put(x, y0 + 5, R.d);
    if (view !== 'up') for (let x = cx - 6; x <= cx + 6; x++) if (B.a(x, y0 + 6)) B.put(x, y0 + 6, side && x > cx - 2 ? sp.hair.d : mix(B.col(x, y0 + 6), [30, 20, 40], ['deep', 'earth'].includes(sp.skinKey) ? .2 : .35)); // brim shadow on the face/hair
    return;
  }
  if (k === 'helmet') {
    const m = new Mask(HW, HH).ell(cx + (side ? .5 : 0), y0 + 4, 8.4, 6.3); m.clipY(0, y0 + 6);
    paint(B, m, M.steel, {shade: 'ball', contour: true}); hline(B, cx - 8, cx + 7, y0 + 6, M.steel.s);
    if (view === 'down') {vline(B, cx, y0 + 6, y0 + 9, M.steel.b); dot(B, cx, y0 + 10, M.steel.s);} else if (side) vline(B, cx - 7, y0 + 6, y0 + 9, M.steel.b);
    dot(B, cx, y0 - 1, M.brass.l); return;
  }
  if (k === 'strawhat') {
    const crown = new Mask(HW, HH).ell(cx, y0 + 1.5, 6, 4); crown.clipY(0, y0 + 3);
    paint(B, crown, M.straw, {shade: 'ball'}); hline(B, cx - 5, cx + 5, y0 + 2, sp.trim.b);
    paint(B, new Mask(HW, HH).ell(cx, y0 + 3.5, 11.5, 2.2), M.straw, {shade: 'cyl', contour: true}); return;
  }
  if (k === 'bonnet' || k === 'cap' || k === 'flatcap' || k === 'chef') {
    const R = k === 'cap' || k === 'flatcap' ? sp.hatColor || sp.trim : M.cloth;
    const m = new Mask(HW, HH).ell(cx + (side ? 1 : 0), y0 + (k === 'chef' ? 0 : 2.5), k === 'chef' ? 6.5 : 8, k === 'chef' ? 5 : 4.6); m.clipY(0, y0 + 4);
    if (k === 'chef') m.rect(cx - 6, y0 + 1, 12, 4);
    paint(B, m, R, {shade: 'ball', contour: true});
    if (k === 'flatcap' || k === 'cap') {const bm = side ? new Mask(HW, HH).rect(cx - 9, y0 + 3, 5, 2) : new Mask(HW, HH).ell(cx, y0 + 4.5, 7, 1.3); paint(B, bm, shiftRamp(R, -1), {shade: 'flat', contour: true});}
    if (k === 'chef') hline(B, cx - 6, cx + 5, y0 + 4, M.cloth.s);
    return;
  }
  if (k === 'redcap') {const R = sp.hatColor, m = side ? new Mask(HW, HH).poly([[cx - 7, y0 + 4], [cx + 7, y0 + 4], [cx + 6, y0 - 1], [cx + 12, y0 + 3], [cx + 13, y0 + 6], [cx + 9, y0 + 2], [cx - 4, y0 - 1]]) : new Mask(HW, HH).poly([[cx - 7.5, y0 + 4], [cx + 7.5, y0 + 4], [cx + 5, y0 - 2], [cx + 10, y0 + 1], [cx + 12, y0 + 5], [cx + 7, y0 - 3], [cx - 1, y0 - 4], [cx - 6, y0]]); paint(B, m, R, {shade: 'cyl', contour: true}); hline(B, cx - 7, cx + 6, y0 + 4, R.d); return;}
  if (k === 'tophat') {paint(B, new Mask(HW, HH).rect(cx - 5, y0 - 5, 10, 8), M.ink, {shade: 'cyl'}); hline(B, cx - 5, cx + 4, y0 + 1, sp.trim.b); paint(B, new Mask(HW, HH).ell(cx, y0 + 3.5, 9, 1.6), M.ink, {shade: 'flat', contour: true}); return;}
  if (k === 'headscarf') {const m = new Mask(HW, HH).ell(cx + (side ? 1 : 0), y0 + 4, 8.4, 6.3); m.clipY(0, y0 + 4); if (side) m.rect(cx + 2, y0 + 4, 6, 7); else {m.rect(cx - 8, y0 + 4, 2, 6); m.rect(cx + 6, y0 + 4, 2, 6);} paint(B, m, sp.scarf || sp.trim, {shade: 'ball', contour: true}); return;}
  if (k === 'feathercap') {const m = new Mask(HW, HH).ell(cx + (side ? 1 : 0), y0 + 2.5, 7.8, 4.6); m.clipY(0, y0 + 4); paint(B, m, sp.hatColor || sp.coat, {shade: 'ball', contour: true}); paint(B, new Mask(HW, HH).cap(cx + 5, y0 + 1, cx + 9, y0 - 5, 1), rampOf('#c2553a'), {shade: 'cyl'}); return;}
  if (k === 'miner') {const m = new Mask(HW, HH).ell(cx + (side ? .5 : 0), y0 + 4, 8.3, 6.3); m.clipY(0, y0 + 5); paint(B, m, rampOf('#9a7a3a'), {shade: 'ball', contour: true}); hline(B, cx - 8, cx + 7, y0 + 5, M.leather.b); if (view !== 'up') {const lx = side ? cx - 6 : cx; paint(B, new Mask(HW, HH).rect(lx - 1, y0, 2, 2), M.glowGold, {shade: 'flat', flag: 1});} return;}
}
function glasses(B, sp, view, r) {
  const ey = 17 + r.bob + (r.head || 0), cx = 20 + (view === 'left' ? r.lean || 0 : r.hx || 0), R = M.brass;
  const lens = x => {hline(B, x, x + 1, ey - 1, R.l); dot(B, x - 1, ey, R.b); dot(B, x + 2, ey, R.s); dot(B, x - 1, ey + 1, R.b); dot(B, x + 2, ey + 1, R.s); hline(B, x, x + 1, ey + 3, R.s);};
  if (view === 'down') {lens(cx - 4); lens(cx + 2); dot(B, cx - 1, ey, R.b); dot(B, cx, ey, R.b);}
  else if (view === 'left') {lens(cx - 6); hline(B, cx - 3, cx + 1, ey, R.s);}
}
// ---- full humanoid composition ----
function humanFront(B, sp, pose, f, back) {
  const r = frontRig(sp, pose, f, back), b = r.bob, g = sp.gear, it = r.item, view = back ? 'up' : 'down';
  const W = back ? 1 : 0; // screen index of the weapon hand
  const hand = r.arms[W].h, off = r.arms[1 - W].h;
  // 1. behind the body
  if (!back) {
    capeBehindFront(B, sp, r);
    wingsBehind(B, sp, r, 'down');
    hairBehind(B, sp, r, 'down');
  }
  if (g.charm && back) charm(B, sp, it === 'strike' ? 13 : it === 'cast' ? 20 : 11, (it === 'cast' ? 8 : it === 'strike' ? 27 : 18) + b - (pose === 'idle' ? f : 0), it === 'cast' || it === 'strike');
  // 2. legs, torso, garments
  legsFront(B, sp, r, back);
  torsoFront(B, sp, r, back);
  if (g.strap && !back) {const m = new Mask(HW, HH).line(15, 24 + b, 24, 33 + b); m.line(16, 24 + b, 25, 33 + b); for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) if (m.on(x, y)) B.put(x, y, x + y & 1 ? M.leather.s : M.leather.b); dot(B, 18, 27 + b, M.brass.l);}
  if (g.strap && back) {const m = new Mask(HW, HH).line(25, 24 + b, 16, 33 + b); m.line(24, 24 + b, 15, 33 + b); for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) if (m.on(x, y)) B.put(x, y, M.leather.s);}
  if (g.rivets && !back) for (let y = 25 + b; y <= 31 + b; y += 3) {dot(B, 16, y, M.steel.h); dot(B, 23, y, M.steel.b);}
  if (sp.apron) {const m = new Mask(HW, HH).poly([[16, 26 + b], [24, 26 + b], [25, 39 + b], [15, 39 + b]]); if (!back) {paint(B, m, sp.apron, {shade: 'cyl', contour: true}); hline(B, 16, 23, 26 + b, sp.apron.l);} else hline(B, 14, 25, 33 + b, sp.apron.s);}
  // sheathed blade on the left hip (screen-right from the front)
  const sheathed = g.sword && (it === 'rest' || it === 'hurt' || it === 'cast');
  if (sheathed) {const sx = back ? 14 : 26, d = back ? -1 : 1; const m = new Mask(HW, HH).cap(sx, 35 + b, sx + d, 41, .9); paint(B, m, M.leather, {shade: 'cyl'}); dot(B, sx + d, 41, M.brass.l); dot(B, sx + d, 42, M.brass.s); hline(B, sx - 1, sx + 1, 33 + b, M.brass.l); dot(B, sx + 1, 33 + b, M.brass.s); vline(B, sx, 31 + b, 32 + b, M.leather.l); dot(B, sx, 30 + b, M.brass.h);}
  // 3. long held items behind the hand
  if (g.staff) {
    const [hx, hy] = hand;
    if (it === 'cast') staff(B, sp, hx - 1, hy - 15, hx + 1, hy + 9, 2);
    else if (it === 'wind') staff(B, sp, hx - 3, hy - 13, hx + 3, hy + 9, 1);
    else if (it === 'strike') staff(B, sp, hx + (back ? -7 : 7), hy - 10, hx + (back ? 6 : -6), hy + 8, 2);
    else if (it === 'guard') staff(B, sp, hx - 7, hy - 4, hx + 9, hy + 2, 1);
    else staff(B, sp, hx, 7 + b, hx, 44, 1);
  }
  if (g.spear || g.fork) polearm(B, g.fork ? 'fork' : 'spear', hand[0], (it === 'strike' ? 6 : 8) + b);
  if (g.tool && !isAttack(it)) toolFront(B, sp, g.tool, hand, back);
  // 4. arms + hands (screen-right arm sits in shadow)
  const sleeve = sp.sleeve || sp.coat;
  for (let i = 0; i < 2; i++) arm(B, sp, r.arms[i], sleeve, {dark: i === 1, glove: sp.glove});
  if (g.pauldron) {const i = back ? 0 : 1, px = Math.round(r.arms[i].s[0] + (i ? .5 : -.5)); pauldron(B, px, 22 + b, i === 0);}
  collarFront(B, sp, r, back);
  torsoMarks(B, sp, r, back ? 'up' : 'down');
  accessories(B, sp, r, back ? 'up' : 'down');
  if (g.book && !back && !isAttack(it)) {const [x, y] = off; paint(B, new Mask(HW, HH).rect(x - 3, y - 4, 4, 5), rampOf('#6a3a3a'), {shade: 'cyl', contour: true}); vline(B, x - 3, y - 4, y, M.cloth.l);}
  if (g.lantern) lantern(B, off[0], off[1] + 2);
  if (g.bow && !isAttack(it) && it !== 'cast') bow(B, off[0] + (back ? -1 : 1), off[1] - 3, 9, 0, back ? -1 : 1);
  if (g.shield && !back) {const [x, y] = off; const m = new Mask(HW, HH).ell(x + .5, y - 1.5, 4, 4.5); paint(B, m, rampOf('#7a5a3a'), {shade: 'ball', contour: true}); for (let k = -3; k <= 3; k++) {B.put(x, y - 2 + k, M.steel.l); B.put(x - 3 + k + 3, y - 2, M.steel.s);} dot(B, x, y - 2, M.brass.h);}
  if (g.shield && back) {const [x, y] = off; paint(B, new Mask(HW, HH).ell(x + .5, y - 1.5, 4, 4.5), rampOf('#5a4030'), {shade: 'ball', contour: true});}
  if (sp.pauldron2) {const i = back ? 1 : 0, px = Math.round(r.arms[i].s[0] + (i ? .5 : -.5)); pauldron(B, px, 22 + b, i === 0);}
  // 5. head, hair, headgear
  headFront(B, sp, r, back);
  if (sp.hood) hood(B, sp, view, r); else if (sp.hat) hat(B, sp, view, r);
  costumeHead(B, sp, r, view);
  if (sp.glasses && !back) glasses(B, sp, 'down', r);
  if (!back && g.quiver) for (const [x, y, c] of [[10, 19, sp.fletch], [11, 18, M.cloth.l], [12, 19, sp.fletch], [10, 20, M.wood.b], [11, 19, M.wood.l], [12, 20, M.wood.s]]) if (!B.a(x, y + b) || y < 20) dot(B, x, y + b, c);
  // 6. over the back (back view)
  if (back) {
    hairOverBack(B, sp, r);
    capeOverBack(B, sp, r);
    if (sp.hood) hood(B, sp, 'up', r);
    if (g.quiver) quiverBack(B, sp, b);
    accessories(B, sp, {...r, bob: b}, 'up-over');
  }
  // 7. drawn weapons and effects in front
  if (g.sword && !sheathed) {
    const [hx, hy] = hand, m = back ? -1 : 1;
    if (it === 'wind') blade(B, hx, hy, -25 * m, 13);
    if (it === 'strike') {blade(B, hx, hy, 125 * m, 12, true); arc(B, [[-11, -10], [-9, -12], [-6, -13], [-3, -13], [0, -12], [3, -10], [5, -7], [6, -4]].map(([x, y]) => [hx + x * m + (back ? -1 : 1), hy + y + 2]));}
    if (it === 'recover') blade(B, hx, hy, 200 * m, 12);
    if (it === 'guard') blade(B, hx, hy, 70 * m, 13);
  }
  if (g.tool && isAttack(it)) toolSwing(B, sp, g.tool, hand, it, back ? -1 : 1);
  if (g.bow && isAttack(it)) {
    const draw = it === 'wind' ? 3 : 0, bx = back ? 21 : 19; bow(B, bx, 27 + b, 9, draw, back ? -1 : 1);
    if (it === 'wind' && !back) {for (let x = 13; x <= 26; x++) B.put(x, 27 + b, x < 15 ? sp.fletch : M.wood.l); B.put(27, 27 + b, M.steel.h);}
    if (it === 'strike' && !back) arc(B, [[30, 26], [32, 26], [34, 25], [36, 25]].map(([x, y]) => [x, y + b]));
  }
  if (g.charm && !back) charm(B, sp, it === 'strike' ? 27 : it === 'cast' ? 20 : 29, (it === 'cast' ? 8 : it === 'strike' ? 28 : 18) + b - (pose === 'idle' ? f : 0), it === 'cast' || it === 'strike');
  if (it === 'cast') sparkles(B, sp, f, [[12, 22 + b], [28, 22 + b]]);
  if (g.charm && it === 'strike') arc(B, [[26, 31], [24, 33], [21, 34], [18, 34], [15, 33]].map(([x, y]) => [back ? 40 - x : x, y + b]), (sp.orb || M.glowViolet).l);
  return r;
}
function sparkles(B, sp, f, pts) {
  const G = sp.orb || M.glowGold;
  for (const [x, y] of pts) {
    const o = f ? [[-2, -2], [2, -1], [0, -4], [-3, 1]] : [[2, -3], [-2, -1], [1, 1], [3, -5]];
    for (const [dx, dy] of o) B.put(x + dx, y + dy, G.l, 1);
    B.put(x + o[0][0], y + o[0][1] - 1, G.h, 1);
  }
}
function humanSide(B, sp, pose, f) {
  const r = sideRig(sp, pose, f), b = r.bob, ln = r.lean, g = sp.gear, it = r.item, coat = sp.coat;
  const h = [r.near.h[0] + ln, r.near.h[1] + b];
  // 1. behind
  if (sp.cloak && !sp.downPose) {const m = new Mask(HW, HH).poly([[19 + ln, 22 + b], [25 + ln, 23 + b], [29, 42], [21, 42]]); paint(B, m, shiftRamp(sp.cloak, -1), {shade: 'cyl'}); for (let y = 32; y < 42; y += 1) if (y % 3) B.put(25 + Math.floor((y - 30) / 4), y, shiftRamp(sp.cloak, -2).b);}
  if (g.quiver) {const m = new Mask(HW, HH).poly([[23 + ln, 21 + b], [26 + ln, 19.5 + b], [29 + ln, 30 + b], [26 + ln, 31 + b]]); paint(B, m, M.leather, {shade: 'cyl'}); for (const [x, y, c] of [[25, 18, sp.fletch], [26, 17, M.cloth.l], [27, 18, sp.fletch]]) dot(B, x + ln, y + b, c);}
  if (g.charm && !(it === 'cast' || it === 'strike')) charm(B, sp, 28 + ln, 18 + b - (pose === 'idle' ? f : 0), false);
  wingsBehind(B, sp, r, 'left');
  hairBehind(B, sp, r, 'left');
  if (!r.far.hidden) arm(B, sp, r.far, sp.sleeve || coat, {dx: ln, dy: b, dark: true, glove: sp.glove});
  // 2. legs
  legSide(B, sp, r, r.legs.far, r.lift.far, true);
  legSide(B, sp, r, r.legs.near, r.lift.near, false);
  // 3. torso & garments
  const gm = sp.garment, tx = ln, bro = sp.shoulder > 6 ? 1 : 0;
  const T = new Mask(HW, HH).poly([[16 + tx, 23 + b], [23 + tx + bro, 23 + b], [24 + tx + bro, 26 + b], [23 + tx, 31 + b], [23 + tx, 35 + b], [16 + tx, 35 + b], [16 + tx, 31 + b], [15 + tx, 26 + b]]);
  if (sp.gender === 'female') T.set(15 + tx, 27 + b);
  const sk = new Mask(HW, HH);
  if (gm === 'robe' || gm === 'gown') sk.poly([[16 + tx, 33 + b], [23 + tx, 33 + b], [26, 44], [13, 44]]);
  else if (gm === 'longcoat') sk.poly([[16 + tx, 33 + b], [23 + tx, 33 + b], [27, 42], [16, 42]]);
  else if (gm === 'coat' || gm === 'tunic' || gm === 'smock' || gm === 'apron') sk.poly([[16 + tx, 33 + b], [23 + tx, 33 + b], [24 + tx, 38 + b], [15 + tx, 38 + b]]);
  if (!sk.empty()) {
    paint(B, sk, coat, {shade: 'cyl', contour: true});
    let yb = 0; for (let y = HH - 1; y > 0 && !yb; y--) for (let x = 0; x < HW; x++) if (sk.on(x, y)) {yb = y; break;}
    for (let x = 0; x < HW; x++) if (sk.on(x, yb)) B.put(x, yb, sp.trim.s);
    if (gm !== 'coat' && gm !== 'tunic') for (let y = yb - 6; y < yb; y++) if (sk.on(21, y)) B.put(21 + (y > yb - 3 ? 1 : 0), y, coat.s);
    if (gm === 'longcoat') vline(B, 16, 35 + b, 41, sp.trim.b);
  }
  paint(B, T, coat, {shade: 'cyl'});
  if (gm === 'robe') {vline(B, 16 + tx, 24 + b, 33 + b, sp.trim.b);} else if (gm === 'longcoat') {vline(B, 16 + tx, 24 + b, 33 + b, sp.trim.b); vline(B, 17 + tx, 24 + b, 32 + b, sp.inner.b);} else vline(B, 16 + tx, 24 + b, 32 + b, coat.l);
  if (g.rivets) for (let y = 25 + b; y <= 31 + b; y += 3) dot(B, 18 + tx, y, M.steel.h);
  if (sp.apron) {const m = new Mask(HW, HH).poly([[15 + tx, 26 + b], [18 + tx, 26 + b], [18 + tx, 39 + b], [14 + tx, 39 + b]]); paint(B, m, sp.apron, {shade: 'cyl', contour: true});}
  if (g.strap) {vline(B, 20 + tx, 23 + b, 32 + b, M.leather.b); vline(B, 21 + tx, 23 + b, 32 + b, M.leather.s);}
  for (let x = 16 + tx; x <= 22 + tx; x++) {B.put(x, 33 + b, sp.belt.b); B.put(x, 34 + b, sp.belt.d);}
  dot(B, 16 + tx, 33 + b, M.brass.l); dot(B, 16 + tx, 34 + b, M.brass.s);
  if (sp.collar) {const m = new Mask(HW, HH).poly([[19 + tx, 18 + b], [24 + tx, 19 + b], [24 + tx, 25 + b], [20 + tx, 24 + b]]); paint(B, m, coat, {shade: 'cyl', contour: true}); vline(B, 19 + tx, 19 + b, 23 + b, sp.trim.l);}
  if (sp.mantle) {const m = new Mask(HW, HH).poly([[16 + tx, 22 + b], [24 + tx, 22 + b], [26 + tx, 28 + b], [21 + tx, 29 + b], [14 + tx, 28 + b]]); paint(B, m, sp.cloak, {shade: 'cyl', contour: true});}
  torsoMarks(B, sp, r, 'left');
  accessories(B, sp, r, 'left');
  const sheathed = g.sword && (it === 'rest' || it === 'hurt' || it === 'cast');
  // 4. head
  headSide(B, sp, r);
  if (sp.hood) hood(B, sp, 'left', r); else if (sp.hat) hat(B, sp, 'left', r);
  costumeHead(B, sp, r, 'left');
  if (sp.glasses) glasses(B, sp, 'left', r);
  if (sheathed) {const m = new Mask(HW, HH).line(18 + tx, 35 + b, 27 + tx, 40 + b); m.line(19 + tx, 35 + b, 28 + tx, 40 + b); paint(B, m, M.leather, {shade: 'flat'}); dot(B, 28 + tx, 40 + b, M.brass.l); vline(B, 17 + tx, 32 + b, 35 + b, M.brass.l); dot(B, 16 + tx, 33 + b, M.leather.l); dot(B, 15 + tx, 32 + b, M.brass.h);}
  // 5. near arm & held items
  if (g.staff) {
    if (it === 'cast') staff(B, sp, h[0] - 2, h[1] - 15, h[0] + 1, h[1] + 9, 2);
    else if (it === 'wind') staff(B, sp, h[0] + 4, h[1] - 12, h[0] - 2, h[1] + 10, 1);
    else if (it === 'strike') staff(B, sp, h[0] - 9, h[1] - 5, h[0] + 8, h[1] + 6, 2);
    else if (it === 'guard') staff(B, sp, h[0] - 5, h[1] - 12, h[0] + 3, h[1] + 9, 1);
    else staff(B, sp, h[0] - 1, 7 + b, h[0] - 1, 44, 1);
  }
  if (g.spear || g.fork) polearm(B, g.fork ? 'fork' : 'spear', h[0] - 1, (it === 'strike' ? 6 : 8) + b);
  if (g.tool && !isAttack(it)) toolSide(B, sp, g.tool, h);
  if (g.bow && !isAttack(it) && it !== 'cast') bow(B, h[0] - 2, h[1] - 3, 9, 0, -1);
  arm(B, sp, r.near, sp.sleeve || coat, {dx: ln, dy: b, glove: sp.glove});
  if (g.pauldron) {const S = M.steel; ['.sbbs.', 'sllhbs', 'sbbbsd', 'dsssdd', '.dssd.'].forEach((row, j) => [...row].forEach((ch, i) => {if (ch !== '.') B.put(18 + ln + i, 23 + b + j, S[ch]);}));}
  if (g.lantern) lantern(B, h[0], h[1] + 2);
  if (g.shield) {const m = new Mask(HW, HH).ell(15.5 + ln, 29.5 + b, 2.2, 4.5); paint(B, m, rampOf('#7a5a3a'), {shade: 'ball', contour: true}); vline(B, 15 + ln, 26 + b, 33 + b, M.steel.l);}
  if (g.book && !isAttack(it)) {paint(B, new Mask(HW, HH).rect(h[0] - 2, h[1] - 5, 3, 5), rampOf('#6a3a3a'), {shade: 'cyl', contour: true});}
  if (g.sword && !sheathed) {
    if (it === 'wind') blade(B, h[0], h[1], 25, 13);
    if (it === 'strike') {blade(B, h[0], h[1], -95, 12, true); arc(B, [[1, -14], [-2, -14], [-5, -12], [-7, -10], [-9, -7], [-10, -4], [-10, -1]].map(([x, y]) => [h[0] + x, h[1] + y]));}
    if (it === 'recover') blade(B, h[0], h[1], -140, 12);
    if (it === 'guard') blade(B, h[0], h[1], -25, 13);
  }
  if (g.tool && isAttack(it)) toolSwing(B, sp, g.tool, h, it, 0);
  if (g.bow && isAttack(it)) {
    const bx = 10 + ln, by = 26 + b; bow(B, bx, by, 9, it === 'wind' ? 4 : 0, -1);
    if (it === 'wind') {for (let x = bx - 2; x <= bx + 8; x++) B.put(x, by, x > bx + 6 ? sp.fletch : M.wood.l); B.put(bx - 3, by, M.steel.h);}
    if (it === 'strike') arc(B, [[1, by - 1], [3, by - 1], [5, by - 1], [7, by - 1]]);
  }
  if (g.charm && (it === 'cast' || it === 'strike')) charm(B, sp, it === 'strike' ? 8 : 12, (it === 'cast' ? 14 : 26) + b, true);
  if (it === 'cast') sparkles(B, sp, f, [[13, 21 + b]]);
  if (g.charm && it === 'strike') arc(B, [[6, 30], [4, 32], [2, 33], [0, 33]].map(([x, y]) => [x, y + b]), (sp.orb || M.glowViolet).l);
  return r;
}
// Collapsed: the side view with arms at rest and eyes shut, laid on its back along the ground line.
function humanDown(B, sp) {
  // long skirts and tall hats rotate badly: the robe is drawn short and a wizard hat lies on the ground behind
  const longSkirt = ['robe', 'gown', 'longcoat'].includes(sp.garment), wiz = sp.hat === 'wizard';
  const T = new Buf(HW, HH); humanSide(T, {...sp, hairStyle: {topknot: 'tied', curls: 'short'}[sp.hairStyle] || sp.hairStyle, downPose: true, garment: longSkirt ? 'coat' : sp.garment, hat: wiz ? null : sp.hat, gear: {...sp.gear, quiver: false, bow: false, charm: false, staff: false, spear: false, lantern: false, tool: null, book: false}}, 'down', 0);
  let minX = HW, maxX = 0, minY = HH, maxY = 0;
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) if (T.a(x, y)) {minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);}
  // rotate clockwise: face up, head to the right
  const len = maxY - minY + 1, thick = maxX - minX + 1, ox = Math.round((HW - len) / 2), oy = FOOT + 1 - thick;
  if (sp.gear.staff) staff(B, sp, 4, 41, 34, 44, 0);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (T.a(x, y)) B.put(ox + (maxY - y), oy + (x - minX), T.col(x, y), T.f[y * HW + x] & 1);
  if (wiz) {const R = sp.hatColor || sp.coat; paint(B, new Mask(HW, HH).poly([[7, 35], [17, 35], [14, 30], [17, 26], [11, 29]]), R, {shade: 'cyl', contour: true}); paint(B, new Mask(HW, HH).ell(12, 35.5, 7.5, 1.6), R, {shade: 'cyl', contour: true}); hline(B, 8, 15, 34, sp.trim.b);}
  if (sp.gear.charm) charm(B, sp, 6, 42, false);
  if (sp.gear.bow) bowOnBack(B, sp, 0, 3, 44, 14, 42);
}
function drawHuman(B, sp, dir, pose, f) {
  if (pose === 'down') humanDown(B, sp);
  else if (dir === 'down' || dir === 'up') humanFront(B, sp, pose, f, dir === 'up');
  else humanSide(B, sp, pose, f);
  outline(B);
  if (dir === 'right') mirror(B);
}
// Layered steel pauldron (8x5) centred on x; flip mirrors it for the screen-left shoulder.
const PAULDRON = ['.ssbbss.', 'sbllhbbs', 'sblbbbsd', 'dssssssd', '.sbbbsd.', '..dssd..'];
function pauldron(B, x, y, flip) {
  const S = M.steel, map = {d: S.d, s: S.s, b: S.b, l: S.l, h: S.l};
  PAULDRON.forEach((row, j) => [...row].forEach((ch, i) => {if (map[ch]) B.put(x - 4 + (flip ? 7 - i : i), y + j, map[flip && ch === 'l' ? 'b' : ch]);}));
  B.put(x + (flip ? 1 : -2), y + 3, M.brass.l);
}
function polearm(B, kind, x, top) {
  paint(B, new Mask(HW, HH).line(x, top, x, 44), M.wood, {shade: 'none'});
  for (let y = top + 3; y < 44; y += 4) B.put(x, y, M.wood.l);
  if (kind === 'fork') {for (const dx of [-2, 0, 2]) vline(B, x + dx, top - 4, top, dx < 0 ? M.steel.l : M.steel.s); hline(B, x - 2, x + 2, top + 1, M.steel.b); return;}
  paint(B, new Mask(HW, HH).poly([[x - 1.5, top], [x + .5, top - 5], [x + 2.5, top]]), M.steel, {shade: 'ball'}); hline(B, x - 1, x + 1, top + 1, M.brass.b);
}
// Chest marks: guard crest, clergy stole, healer leaf, stitched creation.
function torsoMarks(B, sp, r, view) {
  const b = r.bob, tx = view === 'left' ? (r.lean || 0) : 0;
  if (sp.skeleton) {
    const x0 = view === 'left' ? 16 + tx : 20 - sp.shoulder + 1, x1 = view === 'left' ? 22 + tx : 20 + sp.shoulder - 2, spine = view === 'left' ? 22 + tx : 19;
    for (const y of [25, 27, 29]) for (let x = x0; x <= x1; x++) if (x !== spine && x !== spine + 1 && B.a(x, y + b)) B.put(x, y + b, M.ink.s);
    for (const y of [31, 32]) for (let x = x0 - 1; x <= x1 + 1; x++) if (x < spine || x > spine + 1) B.clear(x, y + b);
  }
  if (sp.emblem && view === 'down') {const R = M.brass; dot(B, 19, 27 + b, R.l); dot(B, 20, 27 + b, R.b); dot(B, 18, 28 + b, R.l); dot(B, 21, 28 + b, R.s); dot(B, 19, 29 + b, R.b); dot(B, 20, 29 + b, R.s); dot(B, 19, 30 + b, R.s);}
  if (sp.stole && view === 'down') {for (let y = 23 + b; y <= 40; y++) {B.put(17, y, sp.trim.l); B.put(22, y, sp.trim.s);}}
  if (sp.emblemColor && view === 'down') {const L = rampOf('#5a9a4a'); dot(B, 17, 28 + b, L.l); dot(B, 18, 27 + b, L.b); dot(B, 18, 28 + b, L.s);}
  if (sp.stitched && view !== 'up') {const y0 = 10 + b, cx = 20 + tx; for (let x = cx - 3; x <= cx + 2; x++) B.put(x, y0 + 3, x % 2 ? sp.skin.d : sp.skin.s); if (view === 'down') {dot(B, 13, y0 + 12, M.steel.l); dot(B, 26, y0 + 12, M.steel.s);} else dot(B, cx + 2, y0 + 12, M.steel.l);}
}
// ================================================================ residents: tools, accessories, specs
// Hand tools drawn from the grip (x,y) along an angle (0 = pointing up, 180 = hanging down).
function handTool(B, kind, x, y, ang) {
  if (kind === 'sword' || kind === 'dagger') return blade(B, x, y, ang, kind === 'dagger' ? 6 : 12);
  const a = ang * Math.PI / 180, ux = Math.sin(a), uy = -Math.cos(a), P = t => [Math.round(x + ux * t), Math.round(y + uy * t)], nx = -uy, ny = ux;
  if (kind === 'mug') {paint(B, new Mask(HW, HH).rect(x - 1, y - 2, 3, 3), M.wood, {shade: 'cyl', contour: true}); hline(B, x - 1, x + 1, y - 3, M.cloth.l); dot(B, x + 2, y - 1, M.wood.s); return;}
  if (kind === 'broom') {for (let t = -3; t <= 9; t++) {const [X, Y] = P(t); B.put(X, Y, t % 3 ? M.wood.b : M.wood.l);} const m = new Mask(HW, HH); for (let t = -7; t <= -3; t++) {const [X, Y] = P(t); m.rect(X - 1 - (t < -5 ? 1 : 0), Y, 3 + (t < -5 ? 2 : 0), 1);} paint(B, m, M.straw, {shade: 'cyl', contour: true}); return;}
  const len = {hammer: 7, pick: 8, axe: 8, club: 8, pin: 3, basket: 0}[kind] ?? 7;
  if (kind === 'club') {const m = new Mask(HW, HH); for (let t = -1; t <= len; t++) {const [X, Y] = P(t); m.ell(X + .5, Y + .5, .6 + t * .14, .6 + t * .14);} paint(B, m, M.wood, {shade: 'ball', contour: true}); const [X, Y] = P(len - 2); dot(B, X, Y, M.wood.d); return;}
  if (kind === 'pin') {const m = new Mask(HW, HH).cap(x - 3, y, x + 3, y, 1.1); paint(B, m, rampOf('#c8a06a'), {shade: 'cyl', contour: true}); dot(B, x - 4, y, M.wood.b); dot(B, x + 4, y, M.wood.s); return;}
  for (let t = -1; t <= len; t++) {const [X, Y] = P(t); B.put(X, Y, t % 3 ? M.wood.b : M.wood.l);}
  const [hx, hy] = P(len);
  if (kind === 'hammer') for (let k = -2; k <= 2; k++) for (let d = 0; d < 2; d++) B.put(Math.round(hx + nx * k - ux * d), Math.round(hy + ny * k - uy * d), d ? M.steel.s : k < 0 ? M.steel.h : M.steel.l);
  if (kind === 'pick') {for (let k = -3; k <= 3; k++) B.put(Math.round(hx + nx * k - ux * Math.abs(k) * .4), Math.round(hy + ny * k - uy * Math.abs(k) * .4), Math.abs(k) === 3 ? M.steel.h : M.steel.b);}
  if (kind === 'axe') {const m = new Mask(HW, HH); for (let k = 0; k <= 3; k++) for (let d = -1; d <= 1 + (k > 1 ? 1 : 0); d++) m.set(Math.round(hx + nx * k - ux * d), Math.round(hy + ny * k - uy * d)); paint(B, m, M.steel, {shade: 'ball', contour: true});}
}
function toolFront(B, sp, kind, hand, back) {
  const [x, y] = hand, out = back ? 1 : -1;
  if (kind === 'mug' || kind === 'pin') return handTool(B, kind, x, y + (kind === 'mug' ? 0 : 1), 0);
  handTool(B, kind, x, y + 1, 180 + out * 18);
}
function toolSide(B, sp, kind, h) {if (kind === 'mug' || kind === 'pin') return handTool(B, kind, h[0], h[1] + (kind === 'mug' ? 0 : 1), 0); handTool(B, kind, h[0], h[1] + 1, 205);}
function toolSwing(B, sp, kind, hand, it, m) {
  const [x, y] = hand;
  if (m === 0) {const ang = it === 'wind' ? 30 : it === 'strike' ? -95 : -140; handTool(B, kind, x, y, ang); if (it === 'strike') arc(B, [[1, -12], [-3, -12], [-6, -10], [-8, -7], [-9, -4]].map(([dx, dy]) => [x + dx, y + dy])); return;}
  const ang = (it === 'wind' ? -25 : it === 'strike' ? 125 : 200) * m; handTool(B, kind, x, y, ang);
  if (it === 'strike') arc(B, [[-10, -9], [-7, -11], [-3, -11], [1, -9], [4, -6]].map(([dx, dy]) => [x + dx * m, y + dy + 2]));
}
// Small worn accessories (front/back/side). view: 'down' | 'up' | 'left'
function accessories(B, sp, r, view) {
  const b = r.bob, x0 = view === 'left' ? (r.lean || 0) : 0, acc = sp.acc || [];
  for (const k of acc) {
    if (k === 'scarf' && view !== 'up') {const R = sp.scarf || sp.trim; if (view === 'down') {for (let x = 16; x <= 24; x++) {B.put(x, 23 + b, x < 20 ? R.l : R.b); B.put(x, 24 + b, R.s);} vline(B, 22, 25 + b, 28 + b, R.b); vline(B, 23, 25 + b, 27 + b, R.s);} else {hline(B, 16 + x0, 21 + x0, 23 + b, R.b); hline(B, 16 + x0, 21 + x0, 24 + b, R.s); vline(B, 22 + x0, 24 + b, 27 + b, R.s);}}
    if (k === 'scarf' && view === 'up') {hline(B, 16, 24, 23 + b, (sp.scarf || sp.trim).s);}
    if ((k === 'necklace' || k === 'medallion') && view === 'down') {dot(B, 18, 25 + b, M.brass.b); dot(B, 19, 26 + b, M.brass.b); dot(B, 21, 26 + b, M.brass.b); dot(B, 20, 27 + b, k === 'medallion' ? M.glowGold.l : rampOf('#5aa0c8').l);}
    if (k === 'cravat' && view === 'down') {dot(B, 19, 24 + b, M.cloth.h); dot(B, 20, 24 + b, M.cloth.l); dot(B, 19, 25 + b, M.cloth.l); dot(B, 20, 25 + b, M.cloth.b); dot(B, 20, 26 + b, M.cloth.s);}
    if (k === 'brooch' && view === 'down') {dot(B, 17, 25 + b, M.brass.h); dot(B, 17, 26 + b, rampOf('#a8445a').l);}
    if (k === 'buttons' && view === 'down') for (let y = 25; y <= 31; y += 2) dot(B, 21, y + b, M.brass.l);
    if (k === 'pocketwatch' && view === 'down') {dot(B, 17, 32 + b, M.brass.l); dot(B, 18, 31 + b, M.brass.s); dot(B, 19, 32 + b, M.brass.s);}
    if ((k === 'satchel' || k === 'pouch') && view !== 'up') {const sx = view === 'down' ? 24 : 22 + x0, m = new Mask(HW, HH).rect(sx, 33 + b, k === 'satchel' ? 4 : 3, k === 'satchel' ? 4 : 3); paint(B, m, M.leather, {shade: 'cyl', contour: true}); hline(B, sx, sx + (k === 'satchel' ? 3 : 2), 33 + b, M.leather.l); if (k === 'satchel' && view === 'down') {const sm = new Mask(HW, HH).line(15, 24 + b, sx + 1, 33 + b); for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) if (sm.on(x, y)) B.put(x, y, M.leather.s);}}
    if (k === 'wovenbelt') for (let x = 20 - sp.hip; x < 20 + sp.hip; x++) if (view !== 'left' || (x > 15 + x0 && x < 23 + x0)) B.put(x, 33 + b, (x & 1) ? sp.trim.b : sp.trim.s);
    if (k === 'wings' && view === 'up') {const W = sp.wingColor || rampOf('#c8b8d8'), m = new Mask(HW, HH).poly([[18, 25 + b], [8, 19 + b], [6, 27 + b], [10, 34 + b], [18, 30 + b]]); m.poly([[22, 25 + b], [32, 19 + b], [34, 27 + b], [30, 34 + b], [22, 30 + b]]); paint(B, m, W, {shade: 'cyl', contour: true});}
  }
}
function wingsBehind(B, sp, r, view) {
  if (!(sp.acc || []).includes('wings') || view === 'up') return;
  const b = r.bob, W = sp.wingColor || rampOf('#c8b8d8'), m = new Mask(HW, HH);
  if (view === 'down') {m.poly([[16, 25 + b], [7, 18 + b], [5, 26 + b], [9, 33 + b], [16, 30 + b]]); m.poly([[24, 25 + b], [33, 18 + b], [35, 26 + b], [31, 33 + b], [24, 30 + b]]);}
  else m.poly([[22, 25 + b], [31, 17 + b], [34, 25 + b], [29, 33 + b], [22, 30 + b]]);
  paint(B, m, shiftRamp(W, -1), {shade: 'cyl'});
}
// Extra headwear from the wardrobe and seasonal costumes.
function costumeHead(B, sp, r, view) {
  const k = sp.extraHat; if (!k) return;
  const b = r.bob + (r.head || 0), cx = 20 + (view === 'left' ? r.lean || 0 : r.hx || 0), y0 = 10 + b, side = view === 'left';
  if (k === 'crown') {const R = M.brass; for (let x = cx - 5; x <= cx + 4; x++) {B.put(x, y0, x < cx ? R.l : R.s); B.put(x, y0 - 1, R.b);} for (const x of [cx - 5, cx - 2, cx + 1, cx + 4]) {B.put(x, y0 - 2, R.l); B.put(x, y0 - 3, R.h);} B.put(cx - 1, y0, rampOf('#c04060').l); return;}
  if (k === 'horns' || k === 'antlers') {const R = k === 'horns' ? rampOf('#d8c8a0') : rampOf('#9a7a52'); for (const s of side ? [1] : [-1, 1]) {const hx = side ? cx + 2 : cx + s * 5; const m = new Mask(HW, HH).cap(hx, y0, hx + s * 2, y0 - 4, .8); if (k === 'antlers') {m.cap(hx + s * 2, y0 - 4, hx + s * 4, y0 - 6, .6); m.cap(hx + s, y0 - 2, hx - s, y0 - 5, .6);} paint(B, m, R, {shade: 'cyl', contour: true});} return;}
  if (k === 'catears') {const R = sp.hair; for (const s of side ? [1] : [-1, 1]) {const ex = side ? cx + 2 : cx + s * 4; const m = new Mask(HW, HH).poly([[ex - 2, y0 + 1], [ex + s * 1, y0 - 4], [ex + 2, y0 + 1]]); paint(B, m, R, {shade: 'cyl', contour: true}); dot(B, ex, y0, rampOf('#d88a9a').b);} return;}
  if (k === 'tricorn') {const R = M.ink, m = new Mask(HW, HH).poly([[cx - 10, y0 + 2], [cx, y0 - 3], [cx + 10, y0 + 2], [cx, y0 + 5]]); paint(B, m, R, {shade: 'cyl', contour: true}); hline(B, cx - 8, cx + 8, y0 + 2, sp.trim.b); return;}
  if (k === 'turban') {const R = sp.trim, m = new Mask(HW, HH).ell(cx, y0 + 2, 8, 5); m.clipY(0, y0 + 4); paint(B, m, R, {shade: 'ball', contour: true}); for (let x = cx - 6; x <= cx + 5; x += 3) dot(B, x, y0 + 1, R.s); dot(B, cx, y0 + 3, rampOf('#5a9ad0').l); return;}
  if (k === 'pumpkin') {const R = rampOf('#d07a2a'), m = new Mask(HW, HH).ell(cx, y0 + 1, 7, 5); m.clipY(0, y0 + 4); paint(B, m, R, {shade: 'ball', contour: true}); for (const x of [cx - 3, cx + 2]) vline(B, x, y0 - 3, y0 + 3, R.s); dot(B, cx, y0 - 5, rampOf('#5a7a3a').b); dot(B, cx, y0 - 4, rampOf('#5a7a3a').s); return;}
  if (k === 'mask' && view === 'down') {const R = sp.maskColor || M.ink; hline(B, cx - 6, cx + 5, y0 + 6, R.b); for (const x of [cx - 6, cx - 3, cx + 2, cx + 5]) dot(B, x, y0 + 7, R.s); return;}
  if (k === 'mask' && side) {hline(B, cx - 8, cx - 3, y0 + 6, (sp.maskColor || M.ink).b); return;}
  if (k === 'beak' && view !== 'up') {const R = rampOf('#d8cfb8'); const m = side ? new Mask(HW, HH).poly([[cx - 6, y0 + 8], [cx - 12, y0 + 11], [cx - 6, y0 + 11]]) : new Mask(HW, HH).poly([[cx - 2, y0 + 8], [cx + 2, y0 + 8], [cx, y0 + 14]]); paint(B, m, R, {shade: 'cyl', contour: true}); return;}
  if (k === 'goblin') {const S = sp.skin; for (const s2 of side ? [1] : [-1, 1]) {const ex = side ? cx + 3 : cx + s2 * 6, m = new Mask(HW, HH).poly([[ex, y0 + 6], [ex + s2 * 7, y0 + 3], [ex, y0 + 10]]); paint(B, m, S, {shade: 'cyl', contour: true}); dot(B, ex + s2 * 2, y0 + 6, S.d);} return;}
  if (k === 'facemask' && view !== 'up') {const R = M.ink, ey = y0 + 10; if (side) {for (let y = ey; y < ey + 4; y++) hline(B, cx - 9, cx - 3, y, y === ey ? R.l : R.b);} else for (let y = ey; y < ey + 4; y++) hline(B, cx - 6, cx + 5, y, y === ey ? R.l : x0b(R, y - ey)); return;}
  if (k === 'jester') {const A = sp.coat, Bc = sp.trim; for (const s of side ? [1] : [-1, 1]) {const m = new Mask(HW, HH).poly([[cx, y0 + 2], [cx + s * 9, y0 - 3], [cx + s * 3, y0 + 3]]); paint(B, m, s < 0 ? A : Bc, {shade: 'cyl', contour: true}); dot(B, cx + s * 9, y0 - 4, M.brass.l);} return;}
}

const x0b = (R, k) => k > 2 ? R.s : R.b;
// Female given names in the resident roster (the same set the 3D models braid).
const FEMALE = new Set(['Mara', 'Ada', 'Tamsin', 'Nell', 'Edda', 'Iona', 'Sella', 'Tilda', 'Dara', 'Anwen', 'Beryl', 'Petra', 'Esme', 'Amity', 'Rilla', 'Ines', 'Elowen', 'Mercy', 'Tess', 'Maris', 'Una', 'Carys', 'Miri', 'Brigid', 'Yara', 'Isolde', 'Lenna', 'Lumi', 'Eira', 'Faye', 'Hazel', 'Saffron', 'Hester', 'Sorrel', 'Ysra', 'Dove', 'Juniper', 'Maeve', 'Nessa', 'Elin', 'Wren', 'Kestrel', 'Clove', 'Teal', 'Aster', 'Lark', 'Mica']);
const ROLE_COLOR = {guard: '#54788b', keeper: '#8e4f58', scholar: '#777198', smith: '#8a7159', healer: '#5d9290', baker: '#d4c5a7', farmer: '#8a9560', merchant: '#985a7c', ranger: '#5b7960', innkeeper: '#657e97', clergy: '#6a6a7a', miner: '#7a6a52'};
const HATS = {bonnet: 'bonnet', headscarf: 'headscarf', tophat: 'tophat', feathercap: 'feathercap', flatcap: 'flatcap', strawhat: 'strawhat', witchhat: 'wizard', starhat: 'wizard'};
const EXTRA = {crown: 'crown', candlecrown: 'crown', crystalcrown: 'crown', spidercrown: 'crown', horns: 'horns', antlers: 'antlers', catears: 'catears', goblinears: 'catears', tricorn: 'tricorn', turban: 'turban', pumpkinhat: 'pumpkin', ravenmask: 'mask', wolfmask: 'mask', frogmask: 'mask', mothmask: 'mask', harlequinmask: 'mask', skullmask: 'mask', plaguemask: 'beak', jesterhat: 'jester', eyepatch: 'mask'};
const STYLE_GARMENT = {vest: 'coat', tunic: 'tunic', smock: 'smock', longcoat: 'longcoat', cloak: 'tunic', shawl: 'tunic', gown: 'gown', apron: 'tunic'};
function npcSpec(a) {
  const seed = seedOf(a.name || a.id || 'Wayfarer'), role = a.role || 'traveler', prof = a.profession || role;
  const gender = ['female', 'male', 'nonbinary'].includes(a.gender) ? a.gender : FEMALE.has(a.name) ? 'female' : seed % 9 === 4 ? 'nonbinary' : 'male';
  const skin = SKIN[a.skin] ? a.skin : ['warm', 'earth', 'pale', 'deep', 'olive'][seed % 5];
  const hair = HAIR[a.hair] ? a.hair : ['black', 'brown', 'gold', 'silver', 'auburn'][Math.floor(seed / 7) % 5];
  const styles = HAIR_STYLES[gender], sp = baseHuman(gender, skin, hair, seed);
  // residents keep the four original styles; the newer ones are for the creation screen
  sp.hairStyle = styles[Math.floor(seed / 13) % DEFAULT_STYLES]; sp.role = role; build(sp, 'normal');
  const w = a.wardrobe, base = w?.coat || ROLE_COLOR[prof] || ROLE_COLOR[role] || '#5a6a72';
  sp.coat = rampOf(base); sp.trim = rampOf(w?.trim || '#d6c49a'); sp.pants = rampOf(w?.pants || '#4a4650');
  sp.garment = STYLE_GARMENT[w?.style] || (gender === 'female' ? 'gown' : 'tunic');
  sp.acc = [...(w?.accessories || [])];
  if (w?.style === 'cloak') {sp.cloak = shiftRamp(sp.coat, -1);}
  if (w?.style === 'shawl') {sp.mantle = true; sp.cloak = sp.trim;}
  if (w?.style === 'apron') sp.apron = sp.trim;
  if (w?.style === 'vest') {sp.inner = M.cloth; sp.vest = true; sp.sleeve = rampOf(mixHex(w.trim, '#f0e8d8', .5));}
  for (const k of sp.acc) {if (HATS[k] && !sp.hat) sp.hat = HATS[k]; if (EXTRA[k] && !sp.extraHat) sp.extraHat = EXTRA[k]; if (k === 'hood' || k === 'ghosthood') {sp.hood = true; sp.cloak = k === 'ghosthood' ? M.cloth : sp.coat;} if (k === 'spectacles' || k === 'goggles') sp.glasses = true; if (k === 'gloves' || k === 'bracers') sp.glove = M.leather; if (k === 'broom') sp.gear.tool = 'broom'; if (k === 'vampirecollar') {sp.collar = true; sp.inner = rampOf('#a02a3a'); sp.cloak = M.ink;}}
  if (sp.hat === 'wizard') sp.hatColor = /star/.test(w?.id || '') ? rampOf('#34446a') : rampOf('#3a3044');
  if (sp.acc.includes('rolledcuffs')) sp.cuff = sp.trim;
  if (w?.id === 'paper-ghost') sp.cloak = M.cloth;
  // Role identity always wins over the day's clothes: tools, aprons and work headwear.
  const R = prof;
  if (R === 'smith') {sp.apron = rampOf('#6a4a32'); sp.sleeve = sp.skin; sp.gear.tool = 'hammer'; build(sp, 'broad'); sp.hat = null; sp.glove = M.leather;}
  else if (R === 'baker') {sp.apron = M.cloth; sp.hat = 'chef'; sp.gear.tool = 'pin'; sp.sleeve = rampOf(mixHex(base, '#efe6d6', .6));}
  else if (R === 'guard') {sp.hat = 'helmet'; sp.gear.spear = true; sp.gear.pauldron = true; sp.garment = 'coat'; sp.coat = rampOf(w ? mixHex(base, '#54788b', .55) : '#54788b'); sp.emblem = true; build(sp, 'broad'); sp.glove = M.leather; sp.extraHat = null; sp.hood = false;}
  else if (R === 'farmer') {sp.hat = sp.hat === 'bonnet' || sp.hat === 'headscarf' ? sp.hat : 'strawhat'; sp.gear.spear = false; sp.gear.fork = true;}
  else if (R === 'scholar') {sp.glasses = true; sp.gear.book = true; if (sp.garment === 'tunic') sp.garment = 'robe';}
  else if (R === 'healer') {sp.acc.push('satchel', 'scarf'); sp.scarf = rampOf('#e8e0cc'); sp.emblemColor = true;}
  else if (R === 'merchant') {sp.acc.push('pouch'); if (!sp.hat && !sp.hood) sp.hat = 'feathercap'; sp.hatColor = sp.coat;}
  else if (R === 'innkeeper') {sp.apron = rampOf('#e2d8c2'); sp.gear.tool = 'mug';}
  else if (R === 'ranger') {sp.hood = true; sp.mantle = true; sp.cloak = rampOf(w ? mixHex(w.coat, '#4a5a3a', .5) : '#4f6a48'); sp.gear.bow = true; sp.gear.quiver = true; sp.hat = null;}
  else if (R === 'keeper') {sp.gear.lantern = true; if (sp.garment === 'tunic' || sp.garment === 'coat') sp.garment = 'longcoat';}
  else if (R === 'miner') {sp.hat = 'miner'; sp.gear.tool = 'pick'; sp.hood = false; sp.sleeve = sp.skin;}
  else if (R === 'clergy') {sp.garment = 'robe'; sp.inner = M.cloth; sp.stole = true; sp.hat = null;}
  else if (R === 'count') {Object.assign(sp, {skin: SKIN.pale, skinKey: 'pale', hair: HAIR.black, hairStyle: 'swept', coat: rampOf('#2a2230'), trim: rampOf('#b02a3a'), pants: rampOf('#1e1a24'), garment: 'longcoat', collar: true, inner: rampOf('#b02a3a'), cloak: rampOf('#1c1620'), acc: ['medallion'], eyes: [hex('#7a1020'), hex('#c02030')]}); sp.blush = sp.skin.s;}
  else if (R === 'creation') {Object.assign(sp, {skin: rampOf('#8ea08a'), hair: HAIR.black, hairStyle: 'short', coat: rampOf('#3e4048'), trim: rampOf('#6a6a5a'), garment: 'coat', stitched: true}); build(sp, 'broad'); sp.blush = sp.skin.s; sp.mouth = sp.skin.d;}
  sp.key = ['npc', R, a.name || a.id, gender, skin, hair, w?.key || '', a.skin || '', a.hair || ''].join(':');
  return sp;
}
// ================================================================ creatures
// Every creature draws into its own frame size (sp.size) with the ground on row sp.foot-1; the renderer anchors
// that row to the floor so all sprites share one pixel density.
const BX = (w, h) => new Mask(w, h);
// ---- quadrupeds (wolves, dogs, fox, cat, lynx, boar) ----
// Frame 44x40, paws on row 37. Facing left in the side view.
const QW = 44, QH = 40, QG = 37;
function quadPose(pose, f) {
  // body offset (dx,dy), head offset, per-leg foot offsets [nearFront, farFront, nearBack, farBack] as [dx, lift]
  const p = {dx: 0, dy: 0, hx: 0, hy: 0, legs: [[0, 0], [0, 0], [0, 0], [0, 0]], mouth: 0, eye: 'open', tail: 0, down: false, howl: false};
  if (pose === 'idle') {p.dy = f; p.tail = f ? 1 : 0;}
  else if (pose === 'walk') {
    const cyc = [[[-2, 0], [2, 0], [2, 0], [-2, 0]], [[0, 2], [0, 0], [0, 0], [0, 2]], [[2, 0], [-2, 0], [-2, 0], [2, 0]], [[0, 0], [0, 2], [0, 2], [0, 0]]][f];
    p.legs = cyc; p.dy = f % 2 ? 0 : 1; p.tail = f % 2;
  } else if (pose === 'attack') {
    if (f === 0) {p.dx = 2; p.dy = 1; p.hy = 2; p.hx = 1; p.legs = [[1, 0], [1, 0], [0, 0], [0, 0]]; p.mouth = 1;}
    if (f === 1) {p.dx = -3; p.dy = -1; p.hy = -1; p.hx = -1; p.legs = [[-4, 3], [-3, 2], [2, 0], [3, 0]]; p.mouth = 2;}
    if (f === 2) {p.dx = -1; p.legs = [[-2, 0], [-1, 0], [1, 0], [1, 0]]; p.mouth = 1;}
  } else if (pose === 'cast') {p.howl = true; p.hy = -2; p.mouth = 2; p.dy = f;}
  else if (pose === 'hurt') {p.dx = 2; p.hy = -1; p.eye = 'hurt'; p.mouth = 1;}
  else if (pose === 'guard') {p.dy = 2; p.hy = 2; p.mouth = 1; p.legs = [[-1, 0], [-1, 0], [1, 0], [1, 0]];}
  else if (pose === 'down') {p.down = true; p.eye = 'closed';}
  return p;
}
function quadSide(B, Q, pose, f) {
  const p = quadPose(pose, f), F = Q.fur, Bl = Q.belly;
  const cx = 23 + p.dx, cy = QG - Q.leg - Q.ry + p.dy + (p.down ? Q.leg - 1 : 0) + .5;
  const legC = (i, far) => {
    if (p.down) return;
    const front = i < 2, [ox, lift] = p.legs[i], x0 = (front ? cx - Q.rx * .55 : cx + Q.rx * .5) + (far ? 1.5 : -.3), fx = x0 + ox, fy = QG - lift;
    const R = far ? shiftRamp(Q.socks || F, -1) : (Q.socks || F), m = BX(QW, QH);
    if (front) m.cap(x0, cy + 1, fx, fy - 1, Q.legW);
    else {const kx = x0 + 1.6 + ox * .5, ky = fy - Q.leg * .45; m.cap(x0, cy, kx, ky, Q.legW * 1.15); m.cap(kx, ky, fx, fy - 1, Q.legW * .9);}
    paint(B, m, R, {shade: 'cyl', sw: 1, contour: !far});
    hline(B, Math.round(fx - 1.2), Math.round(fx + .8), fy, R.s); B.put(Math.round(fx - .2), fy, R.b);
  };
  // tail behind everything except the far legs
  const tx = cx + Q.rx - 1.5, ty = cy - Q.ry + 1.5, sw = p.tail;
  const tail = () => {
    if (Q.tail === 'bushy') {const m = BX(QW, QH).cap(tx, ty, tx + 3.5, ty + 2 + sw * .5, 2); m.cap(tx + 3.5, ty + 2 + sw * .5, tx + 4.5 + sw, ty + Q.ry * 1.6, 2.3); m.cap(tx + 4.5 + sw, ty + Q.ry * 1.6, tx + 4 + sw, ty + Q.ry * 2.1, 1.3); paint(B, m, F, {shade: 'hcyl'}); if (Q.tailTip) paint(B, BX(QW, QH).ell(tx + 4.3 + sw, ty + Q.ry * 2, 1.6, 1.7), Q.tailTip, {shade: 'ball'});}
    else if (Q.tail === 'thin') {const m = BX(QW, QH).cap(tx, ty, tx + 3, ty - 3 - sw, .9); m.cap(tx + 3, ty - 3 - sw, tx + 3, ty - 8, .9); m.cap(tx + 3, ty - 8, tx + 1.5, ty - 9.5, .9); paint(B, m, F, {shade: 'cyl'});}
    else if (Q.tail === 'stub') paint(B, BX(QW, QH).ell(tx + 1.5, ty + .5 + sw * .5, 1.8, 1.5), F, {shade: 'ball'});
    else if (Q.tail === 'curl') {const m = BX(QW, QH).cap(tx, ty, tx + 3, ty - 3, 1); m.cap(tx + 3, ty - 3, tx + 2, ty - 6 + sw, 1); paint(B, m, F, {shade: 'cyl'});}
  };
  legC(1, true); legC(3, true);
  tail();
  const body = BX(QW, QH).ell(cx, cy, Q.rx, Q.ry);
  body.ell(cx - Q.rx * .55, cy + .5, Q.ry * 1.02, Q.ry * 1.1); body.ell(cx + Q.rx * .55, cy - .3, Q.ry * .95, Q.ry);
  // head, snout and neck
  const hx = cx - Q.rx - Q.head * .1 + p.hx, hy = cy - Q.ry * .85 + p.hy + (p.howl ? -2 : 0) + (Q.headLow || 0), sl = Q.snout, sdy = p.howl ? -2 : 0;
  const neck = BX(QW, QH).poly([[hx, hy + 1], [hx + Q.head * .9, hy - Q.head * .4], [cx - Q.rx * .2, cy - Q.ry + .5], [cx - Q.rx * .4, cy + 1.5], [hx + 1, hy + Q.head * .7]]);
  paint(B, body.clone().or(neck), F, {shade: 'hcyl'});
  // belly countershade + markings
  for (let x = 0; x < QW; x++) {let y = QH - 1; while (y > 0 && !body.on(x, y)) y--; if (y > 0 && x < cx + Q.rx * .4 && body.on(x, y - 1)) {B.put(x, y - 1, Bl.s); if (Q.belly2 && x < cx - Q.rx * .25) B.put(x, y - 2, Bl.b);}}
  if (Q.spots) for (const [dx, dy] of [[-3, -1], [0, 1], [2, -2], [5, 0], [-6, 0], [3, 2]]) if (body.on(cx + dx, cy + dy)) B.put(cx + dx, Math.round(cy + dy), F.s);
  if (Q.stripes) for (const dx of [-2, 1, 4]) for (let k = 0; k < 3; k++) if (body.on(cx + dx, cy - Q.ry + 1 + k)) B.put(Math.round(cx + dx + (k > 1 ? 1 : 0)), Math.round(cy - Q.ry + 1 + k), F.d);
  if (Q.thorns) for (let i = 0; i < 6; i++) {const x = Math.round(cx - Q.rx * .6 + i * 2.5); let y = 0; while (y < QH && !body.on(x, y)) y++; B.put(x, y - 1, Q.thorns.b); B.put(x, y - 2, Q.thorns.l); if (i % 2 === 0) B.put(x + 1, y - 3, Q.thorns.h); B.put(x - 1, y - 1, Q.thorns.s);}
  if (Q.embers) for (const [dx, dy] of [[-3, -Q.ry + 1], [1, -Q.ry + .5], [5, -Q.ry + 1], [-1, 0]]) B.put(cx + dx, Math.round(cy + dy), M.ember.l, 1);
  if (p.down) {for (const dx of [-Q.rx * .55, Q.rx * .5]) {const m = BX(QW, QH).cap(cx + dx, cy + 2, cx + dx - 4, cy + 3, Q.legW); paint(B, m, Q.socks || F, {shade: 'cyl', contour: true});}}
  legC(0, false); legC(2, false);
  // far ear, head, near ear
  const ear = (dx, far) => {
    const R = far ? shiftRamp(F, -1) : F, ex = hx + dx, m = BX(QW, QH);
    if (Q.ear === 'point' || Q.ear === 'tuft') m.poly([[ex - 1.6, hy - Q.head * .45], [ex + .6, hy - Q.head - 2.2], [ex + 2, hy - Q.head * .35]]);
    if (Q.ear === 'flop') m.poly([[ex - .5, hy - Q.head * .75], [ex + 2.5, hy - Q.head * .8], [ex + 3, hy + 1.5], [ex + 1, hy + 1.5]]);
    if (Q.ear === 'round') m.ell(ex + .5, hy - Q.head * .75, 1.6, 1.5);
    paint(B, m, R, {shade: 'cyl', contour: !far});
    if (!far && Q.ear !== 'flop') B.put(Math.round(ex + .5), Math.round(hy - Q.head * .9), Q.earIn || F.d);
    if (Q.ear === 'tuft') B.put(Math.round(ex + .6), Math.round(hy - Q.head - 2.8), F.o);
  };
  ear(Q.head * .55, true);
  const headM = BX(QW, QH).ell(hx, hy, Q.head, Q.head * .82);
  if (Q.boar) headM.poly([[hx - 1, hy - Q.head * .6], [hx - Q.head - sl, hy + sdy], [hx - Q.head - sl, hy + 3 + sdy], [hx, hy + Q.head * .8]]);
  else headM.poly([[hx - Q.head * .4, hy - Q.head * .45], [hx - Q.head - sl, hy + .3 + sdy], [hx - Q.head - sl, hy + 1.8 + sdy], [hx - Q.head * .2, hy + Q.head * .7]]);
  paint(B, headM, F, {shade: 'hcyl'});
  if (Q.cheek) paint(B, BX(QW, QH).ell(hx + 1.2, hy + 1.5, 2, 1.6), Q.cheek, {shade: 'flat'});
  if (Q.muzzle && !Q.boar) for (let x = Math.round(hx - Q.head - sl); x < hx - Q.head * .4; x++) for (let y = Math.round(hy + 1); y < hy + 3; y++) if (headM.on(x, y) && !headM.on(x, y + 1)) B.put(x, y, Q.muzzle.s);
  if (p.mouth) {const jy = Math.round(hy + 1.8 + sdy), m = BX(QW, QH).poly([[hx - Q.head * .3, jy], [hx - Q.head - sl + 1, jy + p.mouth], [hx - Q.head - sl + 1, jy + p.mouth + 1.2], [hx - Q.head * .1, jy + 1.6]]); paint(B, m, F, {shade: 'flat', contour: true}); for (let x = Math.round(hx - Q.head - sl + 1); x < hx - Q.head * .3; x++) B.put(x, jy, [72, 22, 32]); B.put(Math.round(hx - Q.head - sl + 1), jy - 1, [244, 240, 226]); B.put(Math.round(hx - Q.head - sl + 1), jy + 1, [244, 240, 226]);}
  const nx = Math.round(hx - Q.head - sl), ny = Math.round(hy + sdy + (Q.boar ? 1 : 0));
  B.put(nx, ny, Q.nose || [30, 22, 28]); if (Q.boar) {B.put(nx, ny + 1, Q.nose || [30, 22, 28]); B.put(nx, ny + 2, shiftRamp(F, -1).b);}
  const ex = Math.round(hx - Q.head * .35), ey = Math.round(hy - Q.head * .2);
  if (p.eye === 'closed') {B.put(ex, ey + 1, F.o); B.put(ex + 1, ey + 1, F.o);}
  else if (p.eye === 'hurt') {B.put(ex, ey, F.o); B.put(ex + 1, ey + 1, F.o);}
  else {B.put(ex, ey, Q.eye || [36, 24, 20], Q.glowEye ? 1 : 0); B.put(ex, ey - 1, F.d); B.put(ex + 1, ey, Q.glowEye ? mix(Q.eye, [255, 255, 255], .35) : F.s, Q.glowEye ? 1 : 0); if (!Q.glowEye) B.put(ex, ey, [36, 24, 20]);}
  if (Q.tusks) {B.put(nx + 1, ny + 2, M.bone.h); B.put(nx + 1, ny + 1, M.bone.l); B.put(nx + 2, ny + 1, M.bone.b);}
  ear(Q.head * .25, false);
}
function quadFront(B, Q, pose, f, back) {
  const p = quadPose(pose, f), F = Q.fur, Bl = Q.belly, cx = 22, dy = p.dy + (p.down ? Q.leg - 1 : 0), R = Q.ry;
  const cy = QG - Q.leg - R + 1 + dy, hy = cy - R - Q.head * .2 + (p.hy > 0 ? 2 : 0) + (p.howl ? -1 : 0) + (Q.headLow || 0) * .6;
  const step = i => pose === 'walk' ? (f === (i ? 1 : 3) ? 2 : 0) : 0;
  const legs = (xs, top, far) => {
    if (p.down) return;
    xs.forEach((x, i) => {const lift = far ? step(1 - i) : step(i), fy = QG - lift - (far ? 1 : 0), Rr = far ? shiftRamp(Q.socks || F, -1) : (Q.socks || F);
      paint(B, BX(QW, QH).cap(x, top, x, fy - 1, Q.legW), Rr, {shade: 'cyl', sw: 1, contour: !far}); hline(B, Math.round(x - 1), Math.round(x + 1), fy, Rr.s); B.put(Math.round(x), fy, Rr.b);});
  };
  if (back) {
    paint(B, BX(QW, QH).ell(cx, hy + 1.5, Q.head, Q.head * .8), shiftRamp(F, -1), {shade: 'hcyl'});
    earsFront(B, Q, cx, hy + 1.5, true);
    legs([cx - R * .95, cx + R * .95], cy, true);
    const rump = BX(QW, QH).ell(cx, cy, R * 1.45, R + .6); paint(B, rump, F, {shade: 'hcyl'});
    if (Q.thorns) for (let i = -2; i <= 2; i++) {let y = 0; while (y < QH && !rump.on(cx + i * 2, y)) y++; B.put(cx + i * 2, y - 1, Q.thorns.l); B.put(cx + i * 2, y - 2, Q.thorns.h);}
    if (Q.stripes) for (const dx of [-3, 0, 3]) vline(B, cx + dx, Math.round(cy - R + 1), Math.round(cy - R + 2), F.d);
    if (Q.embers) for (const dx of [-3, 2]) B.put(cx + dx, Math.round(cy - R + 1), M.ember.l, 1);
    legs([cx - R * .55, cx + R * .55], cy + R * .5, false);
    tailBack(B, Q, cx, cy, p);
    return;
  }
  // haunches and back legs behind, then chest, front legs and the big head
  const haunch = BX(QW, QH).ell(cx, cy - .5, R * 1.55, R * .85); paint(B, haunch, shiftRamp(F, -1), {shade: 'hcyl'});
  if (Q.tail === 'bushy') paint(B, BX(QW, QH).cap(cx + R * 1.4, cy - 1, cx + R * 1.4 + 3, cy + 2 + p.tail, 1.8), shiftRamp(F, -1), {shade: 'ball'});
  if (Q.tail === 'thin' || Q.tail === 'curl') paint(B, BX(QW, QH).cap(cx + R * 1.4, cy - 1, cx + R * 1.4 + 2, cy - 6 + p.tail, .9), shiftRamp(F, -1), {shade: 'cyl'});
  legs([cx - R * 1.2, cx + R * 1.2], cy, true);
  const chest = BX(QW, QH).ell(cx, cy, R * 1.0, R * 1.05); paint(B, chest, F, {shade: 'ball'});
  paint(B, BX(QW, QH).ell(cx, cy + 1, R * .5, R * .7), Bl, {shade: 'flat'});
  legs([cx - R * .5, cx + R * .5], cy + R * .4, false);
  if (Q.embers) for (const [dx, ddy] of [[-R - 1, -1], [R + 1, 0]]) B.put(Math.round(cx + dx), Math.round(cy + ddy), M.ember.l, 1);
  earsFront(B, Q, cx, hy, false);
  const canine = Q.snout >= 2.5 && !Q.boar, H = Q.head;
  // canines get a wedge: broad brow, full cheeks, a muzzle tapering to the nose; cats, lynx and boar stay round
  const head = canine ? BX(QW, QH).poly([[cx - H - .5, hy - H * .55], [cx + H + .5, hy - H * .55], [cx + H + 1, hy + .5], [cx + 2.2, hy + H * .55], [cx + 1.2, hy + H + 1.2], [cx - 1.2, hy + H + 1.2], [cx - 2.2, hy + H * .55], [cx - H - 1, hy + .5]]).ell(cx, hy - .5, H + .6, H * .75) : BX(QW, QH).ell(cx, hy, H + .9, H * .92);
  paint(B, head, F, {shade: 'ball'});
  if (Q.cheek) {paint(B, BX(QW, QH).ell(cx - H, hy + 1.5, 1.7, 1.5), Q.cheek, {shade: 'flat'}); paint(B, BX(QW, QH).ell(cx + H, hy + 1.5, 1.7, 1.5), Q.cheek, {shade: 'flat'});}
  const mz = canine ? BX(QW, QH).poly([[cx - 2, hy + .5], [cx + 2, hy + .5], [cx + 1.2, hy + H + 1], [cx - 1.2, hy + H + 1]]) : BX(QW, QH).ell(cx, hy + H * .5, Q.boar ? 2.8 : 2.2, Q.boar ? 2.1 : 1.7);
  paint(B, mz, Q.muzzle || Bl, {shade: canine ? 'cyl' : 'ball'});
  const ny = Math.round(canine ? hy + H + .4 : hy + H * .38);
  if (Q.boar) {hline(B, cx - 2, cx + 1, ny, Q.nose); dot(B, cx - 1, ny + 1, [40, 20, 24]); dot(B, cx, ny + 1, [40, 20, 24]);} else {dot(B, cx - 1, ny, Q.nose || [30, 22, 28]); dot(B, cx, ny, Q.nose || [30, 22, 28]); dot(B, cx - 1, ny - 1, F.l);}
  if (p.mouth) {hline(B, cx - 1, cx, ny + 2, [72, 22, 32]); dot(B, cx - 2, ny + 2, [244, 240, 226]); dot(B, cx + 1, ny + 2, [244, 240, 226]);} else if (!Q.boar) dot(B, cx - 1, ny + 1, F.d);
  if (Q.tusks) {dot(B, cx - 3, ny + 1, M.bone.h); dot(B, cx - 3, ny, M.bone.l); dot(B, cx + 2, ny + 1, M.bone.l); dot(B, cx + 2, ny, M.bone.b);}
  const ey = Math.round(hy - (canine ? .5 : 1));
  for (const s of [-1, 1]) {
    const x = cx + (s < 0 ? (canine ? -3 : -3) : (canine ? 2 : 2));
    if (p.eye === 'closed') dot(B, x, ey + 1, F.o);
    else if (p.eye === 'hurt') {dot(B, x, ey, F.o); dot(B, x + s, ey + 1, F.o);}
    else {dot(B, x, ey, Q.eye || [36, 24, 20], Q.glowEye ? 1 : 0); if (!canine) dot(B, x, ey + 1, Q.glowEye ? mix(Q.eye, [0, 0, 0], .3) : [36, 24, 20], Q.glowEye ? 1 : 0); dot(B, x, ey - 1, F.d); if (canine) dot(B, x + (s < 0 ? -1 : 1), ey - 1, F.d); if (!Q.glowEye) {dot(B, x, ey, [36, 24, 20]); dot(B, x + (s < 0 ? 1 : 0), ey - 1, F.s);}}
  }
}
function earsFront(B, Q, cx, hy, dim) {
  const F = dim ? shiftRamp(Q.fur, -1) : Q.fur;
  for (const s of [-1, 1]) {
    const ex = cx + s * (Q.head * .7), m = BX(QW, QH);
    if (Q.ear === 'point' || Q.ear === 'tuft') m.poly([[ex - 1.8, hy - Q.head * .4], [ex + s * .8, hy - Q.head - 2.6], [ex + 1.8, hy - Q.head * .4]]);
    if (Q.ear === 'flop') m.poly([[ex - 1.5, hy - Q.head * .7], [ex + s * 2.5, hy - Q.head * .5], [ex + s * 3, hy + 2.5], [ex + s * .5, hy + 1.5]]);
    if (Q.ear === 'round') m.ell(ex + s * .4, hy - Q.head * .8, 1.8, 1.7);
    paint(B, m, F, {shade: 'cyl', contour: true});
    if (Q.ear !== 'flop' && !dim) {B.put(Math.round(ex + s * .4), Math.round(hy - Q.head * .95), Q.earIn || F.d); B.put(Math.round(ex + s * .4), Math.round(hy - Q.head * .65), Q.earIn || F.d);}
    if (Q.ear === 'tuft') B.put(Math.round(ex + s * .8), Math.round(hy - Q.head - 3.5), F.o);
  }
}
function tailBack(B, Q, cx, cy, p) {
  const F = Q.fur, R = Q.ry;
  if (Q.tail === 'bushy') {const m = BX(QW, QH).cap(cx, cy - R + 1.5, cx + p.tail, cy + R + 1, 2.1); paint(B, m, F, {shade: 'hcyl', contour: true}); if (Q.tailTip) paint(B, BX(QW, QH).ell(cx + p.tail, cy + R + 1.5, 1.6, 1.5), Q.tailTip, {shade: 'ball'});}
  else if (Q.tail === 'thin' || Q.tail === 'curl') {const m = BX(QW, QH).cap(cx, cy - 1, cx + 1, cy - 7 - p.tail, .9); paint(B, m, F, {shade: 'cyl', contour: true});}
  else if (Q.tail === 'stub') paint(B, BX(QW, QH).ell(cx + .5, cy - R * .4, 1.6, 1.4), F, {shade: 'ball', contour: true});
}
function drawQuad(B, sp, view, pose, f) {
  if (view === 'left' || pose === 'down') quadSide(B, sp.Q, pose, f);
  else quadFront(B, sp.Q, pose, f, view === 'up');
}
const QUADS = {
  wolf: {fur: rampOf('#7d7a70'), belly: rampOf('#b9b1a0'), rx: 8.5, ry: 4.6, leg: 6, legW: 1.3, head: 4.4, snout: 3.6, ear: 'point', tail: 'bushy', eye: hex('#f0b040'), glowEye: true, muzzle: rampOf('#a8a090')},
  'ash-wolf': {fur: rampOf('#6b6f79'), belly: rampOf('#a4a4ac'), rx: 9, ry: 4.8, leg: 6, legW: 1.35, head: 4.5, snout: 3.6, ear: 'point', tail: 'bushy', eye: hex('#ff9a3a'), glowEye: true, embers: true, tailTip: M.ember, muzzle: rampOf('#7a7a80')},
  dog: {fur: rampOf('#a8895a'), belly: rampOf('#e0cfa8'), rx: 7, ry: 4.2, leg: 5, legW: 1.25, head: 4.2, snout: 2.6, ear: 'flop', tail: 'curl', muzzle: rampOf('#e6d6b2'), belly2: true},
  fox: {fur: rampOf('#c8702c'), belly: rampOf('#f0e6d4'), rx: 6.5, ry: 3.6, leg: 5, legW: 1.05, head: 3.9, snout: 3.2, ear: 'point', tail: 'bushy', tailTip: rampOf('#f2ece0'), socks: rampOf('#3a2a28'), muzzle: rampOf('#f4ece0'), earIn: hex('#2a1c1c'), belly2: true},
  cat: {fur: rampOf('#7c7268'), belly: rampOf('#c8beb0'), rx: 5.4, ry: 3.2, leg: 4, legW: .95, head: 3.7, snout: 1, ear: 'point', tail: 'thin', stripes: true, eye: hex('#8ac84a'), muzzle: rampOf('#d0c6b8'), earIn: hex('#d88a8a')},
  'dusk-lynx': {fur: rampOf('#b08a5c'), belly: rampOf('#ecdcc0'), rx: 7.8, ry: 4.4, leg: 6, legW: 1.35, head: 4.4, snout: 1.6, ear: 'tuft', tail: 'stub', spots: true, eye: hex('#d8c040'), glowEye: true, muzzle: rampOf('#f0e4cc'), cheek: rampOf('#efe2c8')},
  'thorn-boar': {fur: rampOf('#6b4a33'), belly: rampOf('#8a6a50'), rx: 9, ry: 5.6, leg: 4, legW: 1.6, head: 4.6, snout: 3.2, ear: 'round', tail: 'stub', boar: true, tusks: true, thorns: rampOf('#7a8a3a'), nose: hex('#c88a7a'), muzzle: rampOf('#a07a62'), headLow: 2, eye: hex('#c8402a')}
};

// ---- gale hawk (flies), gloam wisp (floats), ember imp (hovers) ----
function drawHawk(B, sp, view, pose, f) {
  const W = sp.feather, Bl = sp.breast, flap = pose === 'walk' ? f % 2 : pose === 'idle' ? f : pose === 'attack' ? (f === 1 ? 1 : 0) : 0;
  const by = 14 + (pose === 'attack' && f === 1 ? 6 : 0) + (pose === 'idle' ? f : 0) + (pose === 'down' ? 18 : 0), cx = 20;
  if (pose === 'down') {const m = BX(40, 40).ell(cx, 34, 6, 3); paint(B, m, W, {shade: 'ball'}); const w2 = BX(40, 40).poly([[cx - 2, 33], [cx + 9, 31], [cx + 6, 35]]); paint(B, w2, shiftRamp(W, 1), {shade: 'cyl', contour: true}); paint(B, BX(40, 40).ell(cx - 6, 33, 2.5, 2.2), W, {shade: 'ball'}); dot(B, cx - 9, 33, M.brass.b); dot(B, cx - 7, 32, W.o); return;}
  if (view === 'left') {
    // wings: up-stroke / down-stroke
    const wing = (far) => {const m = BX(40, 40), R = far ? shiftRamp(W, -1) : W; if (flap) m.poly([[cx - 2, by], [cx + 3, by - 10], [cx + 11, by - 13], [cx + 7, by - 4], [cx + 5, by + 1]]); else m.poly([[cx - 2, by], [cx + 5, by + 2], [cx + 13, by + 9], [cx + 4, by + 7], [cx + 1, by + 3]]); paint(B, m, R, {shade: 'cyl', contour: !far}); if (!far) for (let i = 0; i < 3; i++) dot(B, cx + 5 + i * 2, flap ? by - 8 + i : by + 4 + i * 1.3 | 0, W.d);};
    wing(true);
    const body = BX(40, 40).ell(cx + 1, by + 1, 7.5, 3.8); paint(B, body, W, {shade: 'hcyl'});
    for (let x = cx - 5; x <= cx + 4; x++) if (body.on(x, by + 4)) B.put(x, by + 4, Bl.b);
    for (let x = cx - 5; x <= cx + 2; x++) if (body.on(x, by + 3) && x % 2) B.put(x, by + 3, Bl.l);
    const tail = BX(40, 40).poly([[cx + 7, by - 1], [cx + 14, by + 1], [cx + 14, by + 4], [cx + 7, by + 2]]); paint(B, tail, W, {shade: 'cyl', contour: true}); dot(B, cx + 13, by + 2, Bl.l); dot(B, cx + 13, by + 3, W.d);
    const head = BX(40, 40).ell(cx - 6, by - 1, 3.4, 3); paint(B, head, W, {shade: 'ball'});
    dot(B, cx - 7, by - 2, [250, 220, 90], 1); dot(B, cx - 7, by - 3, W.o); dot(B, cx - 6, by - 2, W.o);
    dot(B, cx - 10, by - 1, M.brass.l); dot(B, cx - 11, by, M.brass.b); dot(B, cx - 10, by, M.brass.s); dot(B, cx - 11, by + 1, M.brass.s);
    if (pose === 'attack' && f === 1) {hline(B, cx - 3, cx - 1, by + 5, M.brass.s); dot(B, cx - 3, by + 6, M.ink.b); dot(B, cx - 1, by + 6, M.ink.b); arc(B, [[cx - 12, by - 2], [cx - 12, by + 3], [cx - 10, by + 7]]);}
    wing(false);
    return;
  }
  const back = view === 'up';
  const wing = s => {const m = BX(40, 40); if (flap) m.poly([[cx + s * 2, by], [cx + s * 9, by - 8], [cx + s * 15, by - 9], [cx + s * 12, by - 3], [cx + s * 4, by + 3]]); else m.poly([[cx + s * 2, by], [cx + s * 10, by + 1], [cx + s * 16, by + 5], [cx + s * 10, by + 6], [cx + s * 3, by + 4]]); paint(B, m, s < 0 ? W : shiftRamp(W, -1), {shade: 'cyl', contour: true}); for (let i = 1; i < 4; i++) dot(B, cx + s * (6 + i * 2), flap ? by - 6 + i : by + 2 + i, W.d);};
  wing(-1); wing(1);
  const body = BX(40, 40).ell(cx, by + 2, 3.4, 4.6); paint(B, body, back ? W : Bl, {shade: 'ball'});
  if (!back) for (let y = by + 1; y < by + 6; y += 2) {dot(B, cx - 1, y, Bl.s); dot(B, cx + 1, y + 1, Bl.s);}
  const tail = BX(40, 40).poly([[cx - 2, by + 6], [cx + 2, by + 6], [cx + 3, by + 10], [cx - 3, by + 10]]); paint(B, tail, W, {shade: 'cyl', contour: true});
  const head = BX(40, 40).ell(cx, by - 3, 2.8, 2.6); paint(B, head, W, {shade: 'ball'});
  if (!back) {dot(B, cx - 2, by - 3, [250, 220, 90], 1); dot(B, cx + 1, by - 3, [250, 220, 90], 1); dot(B, cx, by - 2, M.brass.l); dot(B, cx - 1, by - 2, M.brass.b); dot(B, cx, by - 1, M.brass.s);}
  if (!back) {dot(B, cx - 1, by + 7, M.brass.b); dot(B, cx + 1, by + 7, M.brass.b);}
}
function drawWisp(B, sp, view, pose, f) {
  // A will-o'-the-wisp: a bright core wrapped in a cold flame whose tongues lick upward and stream back as it moves.
  const G = sp.glow, cx = 16, down = pose === 'down', bob = down ? 14 : (pose === 'idle' ? f : pose === 'walk' ? f % 2 : 0) + (pose === 'attack' && f === 1 ? -2 : 0), cy = 18 + bob;
  const big = pose === 'attack' && f === 1 || pose === 'cast', side = view === 'left', sway = f % 2 ? 1 : -1, r = (big ? 6.2 : 5.4) * (down ? .7 : 1);
  const flame = BX(32, 36);
  flame.ell(cx + .5, cy + .5, r + .6, r + .3);
  // tongues: up (and trailing behind when seen from the side)
  const tips = side ? [[cx + 3, cy - r - 4 + sway], [cx + 7, cy - r - 1], [cx + r + 5, cy - 1 - sway]] : [[cx - 3, cy - r - 2 - sway], [cx + 1, cy - r - 5 + sway], [cx + 4, cy - r - 2]];
  if (!down) for (const [tx, ty] of tips) flame.poly([[tx - 2.5, cy - r + 2], [tx, ty], [tx + 2.5, cy - r + 2.5]]);
  paint(B, flame, shiftRamp(G, -1), {shade: 'ball', flag: 1});
  paint(B, BX(32, 36).ell(cx + .5, cy + 1, r, r - .4), G, {shade: 'ball', flag: 1});
  paint(B, BX(32, 36).ell(cx - .5, cy, r * .5, r * .45), shiftRamp(G, 2), {shade: 'flat', flag: 1});
  for (const [dx, dy] of (f % 2 ? [[-8, 1], [7, -4], [-4, 8], [9, 4], [1, 10]] : [[-7, -3], [8, 0], [3, 9], [-9, 5], [-2, 11]])) B.put(cx + dx, cy + dy, G.l, 1);
  if (view !== 'up') {const ex = side ? [cx - 3, cx] : [cx - 2, cx + 2]; for (const x of ex) {if (pose === 'hurt') {dot(B, x, cy + 1, G.o); dot(B, x + 1, cy, G.o);} else if (down) dot(B, x, cy + 1, G.o); else {dot(B, x, cy, G.o); dot(B, x, cy + 1, G.o);}} if (big) {dot(B, cx, cy + 3, G.o);}}
  if (big) for (const [dx, dy] of [[-10, 0], [10, 0], [0, -11], [0, 10], [-7, -7], [7, 7], [7, -7], [-7, 7]]) B.put(cx + dx, cy + dy, G.h, 1);
}
function drawImp(B, sp, view, pose, f) {
  const S = sp.skin, cx = 16, flap = (pose === 'walk' || pose === 'idle') ? f % 2 : 0, cy = 18 + (pose === 'idle' ? f : 0) + (pose === 'down' ? 7 : 0) + (pose === 'attack' && f === 1 ? -1 : 0);
  const side = view === 'left', back = view === 'up';
  // bat wings
  const wing = s => {const m = BX(32, 36); if (flap) m.poly([[cx + s * 2, cy - 1], [cx + s * 9, cy - 9], [cx + s * 10, cy - 3], [cx + s * 8, cy], [cx + s * 6, cy - 1], [cx + s * 4, cy + 1]]); else m.poly([[cx + s * 2, cy - 1], [cx + s * 10, cy - 4], [cx + s * 11, cy + 2], [cx + s * 8, cy + 1], [cx + s * 6, cy + 3], [cx + s * 3, cy + 2]]); paint(B, m, sp.wing, {shade: 'cyl', contour: true});};
  if (pose !== 'down') {if (side) wing(1); else {wing(-1); wing(1);}}
  // tail with a flame tip
  const tm = BX(32, 36).cap(cx + (side ? 3 : 1), cy + 4, cx + (side ? 8 : 5), cy + 8, .8); tm.cap(cx + (side ? 8 : 5), cy + 8, cx + (side ? 10 : 7), cy + 5, .8); paint(B, tm, S, {shade: 'cyl'});
  paint(B, BX(32, 36).ell(cx + (side ? 10.5 : 7.5), cy + 3.5, 1.4, 2), M.ember, {shade: 'ball', flag: 1}); dot(B, cx + (side ? 10 : 7), cy + 1 + (f % 2), M.ember.h, 1);
  // body + legs
  const body = BX(32, 36).ell(cx + .5, cy + 4, 3.3, 3.6); paint(B, body, S, {shade: 'ball'});
  for (const s of side ? [0] : [-1, 1]) {const lx = cx + (side ? 0 : s * 1.5); paint(B, BX(32, 36).cap(lx + .5, cy + 6, lx + .5 + (side ? -1 : s), cy + 10, .9), shiftRamp(S, -1), {shade: 'cyl', contour: true});}
  if (!back) {dot(B, cx, cy + 3, sp.belly.l); dot(B, cx + 1, cy + 4, sp.belly.b); dot(B, cx, cy + 5, sp.belly.b);}
  // arms
  const atk = pose === 'attack' && f === 1, cast = pose === 'cast';
  for (const s of side ? [-1] : [-1, 1]) {const ax = cx + s * 3.3, hx = atk || cast ? cx + s * 6 + (side ? -2 : 0) : cx + s * 4, hy = atk || cast ? cy : cy + 5; paint(B, BX(32, 36).cap(ax, cy + 2, hx, hy, .8), S, {shade: 'cyl', contour: true});}
  // head with horns
  const hy = cy - 3, hx = cx + (side ? -1 : 0) + .5, head = BX(32, 36).ell(hx, hy, 4.2, 3.8); paint(B, head, S, {shade: 'ball'});
  for (const s of side ? [1] : [-1, 1]) {const m = BX(32, 36).cap(hx + s * 2.5, hy - 2, hx + s * 4, hy - 6, .8); paint(B, m, sp.horn, {shade: 'cyl', contour: true});}
  if (side) {const m = BX(32, 36).poly([[hx - 4, hy - 1], [hx - 7, hy], [hx - 4, hy + 1]]); paint(B, m, S, {shade: 'flat'});}
  if (!back) {
    const eyes = side ? [hx - 3] : [hx - 2.5, hx + 1.5];
    for (const ex of eyes) {const x = Math.round(ex); if (pose === 'hurt' || pose === 'down') dot(B, x, hy, S.o); else {dot(B, x, hy - 1, [255, 230, 120], 1); dot(B, x, hy, [255, 160, 40], 1);}}
    if (atk || cast) {dot(B, Math.round(hx - (side ? 3 : .5)), hy + 2, [60, 16, 20]); dot(B, Math.round(hx + (side ? -2 : .5)), hy + 2, [60, 16, 20]);} else dot(B, Math.round(hx - (side ? 3 : 0)), hy + 2, S.o);
  }
  if (atk || cast) {const fx = side ? cx - 9 : cx, fy = side ? cy : cy - 9; paint(B, BX(32, 36).ell(fx, fy, 2.2, 2.2), M.ember, {shade: 'ball', flag: 1}); for (const [dx, dy] of [[-3, 1], [3, -1], [0, -3]]) dot(B, fx + dx, fy + dy, M.ember.l, 1);}
}
// ---- hollow shade (ghost) ----
function drawGhost(B, sp, view, pose, f) {
  const G = sp.cloth, cx = 18, bob = (pose === 'idle' || pose === 'walk') ? f % 2 : 0, top = 8 + bob + (pose === 'down' ? 20 : 0), back = view === 'up', side = view === 'left';
  const lean = pose === 'attack' ? [1, -2, -1][f] : pose === 'hurt' ? 2 : 0;
  const m = BX(36, 48);
  const w = side ? 6 : 7.5;
  m.ell(cx + lean, top + 6, w - 1, 6);
  m.poly([[cx - w + lean, top + 6], [cx + w + lean, top + 6], [cx + w + 2, top + 26], [cx - w - 2, top + 26]]);
  // ragged hem
  for (let x = cx - w - 2; x <= cx + w + 2; x++) {const k = (x + f * 2) % 4; for (let y = top + 24; y <= top + 26 + (k === 0 ? 3 : k === 2 ? 1 : 0); y++) m.set(x, y, k === 1 || k === 3 ? (y > top + 25 ? 0 : 1) : 1);}
  if (pose === 'down') {m.m.fill(0); m.ell(cx, 40, 12, 3.5); m.ell(cx - 8, 37, 4, 3.5);}
  paint(B, m, G, {shade: 'ball'});
  // wispy arms
  if (pose !== 'down') for (const s of side ? [-1] : [-1, 1]) {const reach = pose === 'attack' && f === 1 || pose === 'cast', ax = cx + s * (w - 1) + lean, am = BX(36, 48).cap(ax, top + 10, ax + s * (reach ? 6 : 3) + (side ? -2 : 0), top + (reach ? 9 : 17), 1.3); paint(B, am, shiftRamp(G, -1), {shade: 'cyl', contour: true});}
  if (!back && pose !== 'down') {
    const ex = side ? [cx - 4 + lean] : [cx - 3 + lean, cx + 2 + lean], ey = top + 5;
    for (const x of ex) {paint(B, BX(36, 48).rect(x, ey, 2, 3), M.ink, {shade: 'none'}); if (pose !== 'hurt') {dot(B, x, ey + 1, sp.eye, 1); dot(B, x + 1, ey + 1, mix(sp.eye, [255, 255, 255], .4), 1);}}
    paint(B, BX(36, 48).rect(cx - 1 + lean - (side ? 3 : 0), top + 10, 2, pose === 'attack' && f === 1 || pose === 'cast' ? 4 : 2), M.ink, {shade: 'none'});
  }
  for (let y = top + 14; y < top + 24; y += 3) {dot(B, cx - 3 + lean, y, G.s); dot(B, cx + 3, y + 1, G.s);}
  if (pose === 'cast' || pose === 'attack' && f === 1) for (const [dx, dy] of [[-12, 4], [12, 2], [-10, -2], [11, 8]]) dot(B, cx + dx, top + 8 + dy, sp.eye, 1);
}
// ---- brutes: cinder troll, moss golem ----
function drawBrute(B, sp, view, pose, f) {
  const W = sp.size.w, H = sp.size.h, G = sp.foot - 1, S = sp.skin, side = view === 'left', back = view === 'up', cx = Math.round(W / 2);
  const atk = pose === 'attack', bob = pose === 'idle' ? f : pose === 'walk' ? f % 2 : atk && f === 1 ? 2 : 0;
  const lift = pose === 'walk' ? [f === 0 ? 3 : 0, f === 2 ? 3 : 0] : [0, 0];
  if (pose === 'down') {
    // slumped on its side: back toward the camera's right, head down on the left, the weapon dropped beside it
    const body = BX(W, H).ell(cx + 3, G - 6, sp.bodyW * 1.5, sp.bodyH * .38); body.ell(cx + sp.bodyW * 1.1, G - 4, sp.bodyW * .7, 4);
    if (sp.club) {const cm = BX(W, H); for (let t = 0; t <= 11; t++) cm.ell(cx - 14 + t * 1.2, G - 1 - t * .1, .8 + t * .1, .8 + t * .1); paint(B, cm, M.wood, {shade: 'ball', contour: true});}
    paint(B, body, S, {shade: 'hcyl'});
    if (sp.belly) paint(B, BX(W, H).ell(cx + 1, G - 3, sp.bodyW * .9, 2.2), sp.belly, {shade: 'flat'});
    const hx = cx - sp.bodyW * 1.2, hy = G - 5, head = BX(W, H).ell(hx, hy, sp.headR + .5, sp.headR);
    paint(B, head, S, {shade: 'ball', contour: true});
    dot(B, Math.round(hx - 1), Math.round(hy - 1), S.o); dot(B, Math.round(hx), Math.round(hy - 1), S.o);
    if (sp.tusks) {dot(B, Math.round(hx - 2), Math.round(hy + 2), M.bone.h); dot(B, Math.round(hx + 1), Math.round(hy + 2), M.bone.l);}
    const arm = BX(W, H).cap(cx - 2, G - 9, cx - 9, G - 2, sp.armR); paint(B, arm, S, {shade: 'cyl', contour: true});
    if (sp.moss) for (let i = 0; i < 9; i++) {let y = 0; const x = cx - 6 + i * 2; while (y < H && !body.on(x, y)) y++; dot(B, x, y, sp.moss.l); dot(B, x, y + 1, sp.moss.b);}
    if (sp.loin) paint(B, BX(W, H).rect(cx + sp.bodyW * .6, G - 9, 4, 6), sp.loin, {shade: 'cyl', contour: true});
    return;
  }
  const sh = sp.shoulder, bodyTop = G - sp.legLen - sp.bodyH + bob, bodyY = bodyTop + sp.bodyH / 2;
  const legs = [];
  for (const s of side ? [1, -1] : [-1, 1]) {
    const i = s < 0 ? 0 : 1, lx = side ? cx + s * 2 + (pose === 'walk' ? (f === 1 ? s * 3 : f === 3 ? -s * 3 : 0) : 0) : cx + s * (sh * .5), top = G - sp.legLen + bob;
    const m = BX(W, H).cap(lx, top, lx, G - 2 - lift[i], sp.legR); m.rect(Math.round(lx - sp.legR - (side ? 1 : 0)), G - 2 - lift[i], Math.round(sp.legR * 2 + (side ? 2 : 1)), 3);
    legs.push([m, side && s > 0]);
  }
  for (const [m, far] of legs) if (far) paint(B, m, shiftRamp(S, -1), {shade: 'cyl'});
  // arms behind for the back/side view
  const reach = atk ? [0, 1, 0][f] : 0, raise = atk && f === 0;
  const armPts = s => {const ax = cx + s * sh, ay = bodyTop + 3; if (side) return [[cx + 1, ay], [cx - 4 - reach * 5, raise ? ay - 8 : ay + 10 - reach * 6]]; return [[ax, ay], [ax + s * 2, raise ? ay - 8 : ay + 12 + (pose === 'walk' ? (s < 0 ? f % 2 : (f + 1) % 2) : 0)]];};
  if (side) {const [a, h] = armPts(1); paint(B, BX(W, H).cap(a[0] + 4, a[1], h[0] + 6, h[1] - 2, sp.armR), shiftRamp(S, -1), {shade: 'cyl'});}
  // torso: big hunched mass
  const body = BX(W, H).ell(cx + (side ? 1 : 0), bodyY, side ? sp.bodyW * .8 : sp.bodyW, sp.bodyH / 2 + 1);
  body.ell(cx + (side ? 3 : 0), bodyTop + 4, side ? sp.bodyW * .7 : sp.bodyW * .95, 5);
  paint(B, body, S, {shade: 'cyl'});
  if (sp.belly && !back) paint(B, BX(W, H).ell(cx - (side ? 3 : 0), bodyY + 3, side ? 3 : sp.bodyW * .5, sp.bodyH * .3), sp.belly, {shade: 'cyl', top: false});
  if (sp.loin) {const lm = BX(W, H).rect(cx - sp.bodyW * .6, G - sp.legLen + bob - 1, sp.bodyW * 1.2, 5); paint(B, lm, sp.loin, {shade: 'cyl', contour: true}); hline(B, Math.round(cx - sp.bodyW * .6), Math.round(cx + sp.bodyW * .6), G - sp.legLen + bob - 1, M.leather.l);}
  for (const [m, far] of legs) if (!far) paint(B, m, S, {shade: 'cyl', contour: true});
  if (sp.moss) {for (let x = 0; x < W; x++) {let y = 0; while (y < H && !body.on(x, y)) y++; if (y < H && (x * 7) % 5 < 3) {B.put(x, y, sp.moss.l); B.put(x, y + 1, sp.moss.b); if (x % 3 === 0) B.put(x, y - 1, sp.moss.b);}} for (const [dx, dy] of [[-4, 4], [3, 7], [-1, 10], [5, 2]]) dot(B, cx + dx, bodyTop + dy, sp.moss.s);}
  if (sp.cracks) for (const [dx, dy] of [[-5, 5], [-4, 6], [4, 9], [5, 10], [0, 12]]) dot(B, cx + dx, bodyTop + dy, S.d);
  if (sp.embers && !back) for (const [dx, dy] of [[-3, 6], [4, 10], [-6, 11], [2, 3]]) dot(B, cx + dx, bodyTop + dy, M.ember.l, 1);
  // head (small, sunk between the shoulders)
  const hx = cx + (side ? -sp.bodyW * .5 : 0), hy = bodyTop + 1 + (back ? 1 : 0);
  const head = BX(W, H).ell(hx, hy, sp.headR, sp.headR * .9); if (side) head.ell(hx - sp.headR * .6, hy + 1.5, sp.headR * .7, sp.headR * .5);
  paint(B, head, back ? shiftRamp(S, -1) : S, {shade: 'ball', contour: true});
  if (!back) {
    const ex = side ? [hx - 3] : [hx - 2.5, hx + 1.5];
    for (const x of ex) {const X = Math.round(x), Y = Math.round(hy - 1); if (pose === 'hurt') dot(B, X, Y, S.o); else {dot(B, X, Y, sp.eye, 1); dot(B, X + 1, Y, mix(sp.eye, [0, 0, 0], .35), 1); dot(B, X, Y - 1, S.d);}}
    if (sp.nose) {if (side) {dot(B, Math.round(hx - sp.headR - 1), Math.round(hy + 1), S.b); dot(B, Math.round(hx - sp.headR - 2), Math.round(hy + 1), S.s);} else {dot(B, Math.round(hx - .5), Math.round(hy + 1), S.l); dot(B, Math.round(hx - .5), Math.round(hy + 2), S.s);}}
    if (sp.tuft) for (const [dx, dy] of [[-1, -sp.headR], [0, -sp.headR - 1], [1, -sp.headR]]) dot(B, Math.round(hx + dx), Math.round(hy + dy), sp.tuft);
    if (sp.tusks) {const ty = Math.round(hy + 2); if (side) {dot(B, Math.round(hx - 4), ty, M.bone.h); dot(B, Math.round(hx - 4), ty - 1, M.bone.l);} else {dot(B, Math.round(hx - 2), ty, M.bone.h); dot(B, Math.round(hx - 2), ty - 1, M.bone.l); dot(B, Math.round(hx + 2), ty, M.bone.l); dot(B, Math.round(hx + 2), ty - 1, M.bone.b);}}
    if (atk && f === 1) hline(B, Math.round(hx - 1), Math.round(hx + 1), Math.round(hy + 2), [60, 18, 20]);
  }
  // arms in front
  const arms = side ? [-1] : [-1, 1];
  for (const s of arms) {
    const [a, h] = armPts(s), m = BX(W, H).cap(a[0], a[1], h[0], h[1], sp.armR);
    paint(B, m, s > 0 ? shiftRamp(S, -1) : S, {shade: 'cyl', contour: true});
    paint(B, BX(W, H).ell(h[0], h[1] + 1, sp.armR + .6, sp.armR + .3), s > 0 ? shiftRamp(S, -1) : S, {shade: 'ball', contour: true});
    if (sp.club && (s < 0)) {
      const [hx2, hy2] = h, ang = raise ? -20 : atk && f === 1 ? (side ? -100 : 190) : side ? -150 : 160, a2 = ang * Math.PI / 180, ux = Math.sin(a2), uy = -Math.cos(a2);
      const cm = BX(W, H); for (let t = 0; t <= 11; t++) cm.ell(hx2 + ux * t + .5, hy2 + uy * t + .5, .8 + t * .13, .8 + t * .13);
      paint(B, cm, M.wood, {shade: 'ball', contour: true}); for (const t of [6, 9]) dot(B, Math.round(hx2 + ux * t), Math.round(hy2 + uy * t), M.wood.d);
      if (atk && f === 1) arc(B, (side ? [[-12, -14], [-14, -8], [-14, -2], [-12, 4]] : [[-3, -14], [-6, -9], [-7, -3], [-6, 3]]).map(([dx, dy]) => [hx2 + dx, hy2 + dy]));
    }
  }
  if (sp.moss && !back) for (const [dx, dy] of [[-sh, 2], [sh, 3]]) {dot(B, cx + dx, bodyTop + dy, sp.moss.l); dot(B, cx + dx + 1, bodyTop + dy, sp.moss.b);}
}

// ---- humanoid foes and the bone squire reuse the resident puppet ----
function foeHuman(kind, a) {
  const seed = seedOf(a.id || a.name || kind), sp = baseHuman('male', ['warm', 'earth', 'pale', 'deep', 'olive'][seed % 5], ['black', 'brown', 'auburn'][seed % 3], seed);
  build(sp, 'normal'); sp.hairStyle = ['short', 'spiky', 'swept', 'tied'][seed % 4]; sp.garment = 'tunic'; sp.foe = kind;
  if (kind === 'goblin') {Object.assign(sp, {skin: rampOf('#7d9a5a'), blush: hex('#6a8a4a'), sink: 5, coat: rampOf('#6a5238'), pants: rampOf('#4a4034'), hat: 'redcap', hatColor: rampOf('#b0302a'), extraHat: 'goblin', hairStyle: 'short', hair: HAIR.black, eyes: [hex('#e8c030'), hex('#f8e070')], mouth: hex('#3a1a1a')}); sp.gear.tool = 'dagger'; Object.assign(sp, {shoulder: 5, waist: 4, hip: 4});}
  if (kind === 'thief') {Object.assign(sp, {coat: rampOf('#3a3a48'), pants: rampOf('#2a2a34'), hood: true, cloak: rampOf('#2c2c38'), mantle: true, extraHat: 'facemask', glove: M.ink}); sp.gear.tool = 'dagger';}
  if (kind === 'bandit') {Object.assign(sp, {coat: rampOf('#6a4a36'), pants: rampOf('#4a4440'), hat: 'headscarf', scarf: rampOf('#a8302c'), vest: true, inner: rampOf('#c8b89a'), sleeve: rampOf('#c8b89a'), glove: M.leather}); build(sp, 'broad'); sp.gear.tool = 'axe'; sp.acc = ['pouch'];}
  if (kind === 'zombie') {Object.assign(sp, {skin: rampOf('#8c9a7c'), blush: hex('#7a6a6a'), coat: rampOf('#5c5448'), pants: rampOf('#45403a'), hair: HAIR.black, hairStyle: 'shaggy', zombie: true, eyes: [hex('#d8e0c8'), hex('#f0f4e8')], ragged: true, mouth: hex('#3a2020')});}
  if (kind === 'skeleton' || kind === 'bone-squire') {Object.assign(sp, {skin: M.bone, skeleton: true, coat: M.bone, sleeve: M.bone, pants: M.bone, boot: shiftRamp(M.bone, -1), garment: 'none', hairStyle: 'none', eyes: [hex('#e05a30'), hex('#ffb070')], shoulder: 5, waist: 3, hip: 4, belt: rampOf('#5a4030')}); sp.gear.tool = 'sword'; if (kind === 'bone-squire') {sp.sink = 3; sp.gear.shield = true; sp.hat = 'helmet'; sp.eyes = [hex('#40c8d0'), hex('#a0f0f0')];}}
  if (kind === 'sentinel') {Object.assign(sp, {coat: M.steel, sleeve: M.steel, pants: shiftRamp(M.steel, -1), boot: shiftRamp(M.steel, -1), glove: M.steel, helm: 'full', garment: 'coat', cloak: rampOf('#3a3446'), eyes: [hex('#7ad8e8'), hex('#d0ffff')]}); build(sp, 'broad'); sp.gear.pauldron = true; sp.gear.tool = 'sword'; sp.pauldron2 = true; if (a.warden || a.id === 'warden') {sp.cloak = rampOf('#4a5a7a'); sp.gear.lantern = true;}}
  sp.key = ['foe', kind, seed % 97, a.warden ? 'w' : ''].join(':');
  return sp;
}
const COMP_KINDS = new Set(['ember-imp', 'bone-squire', 'gloam-wisp', 'moss-golem', 'ash-wolf', 'thorn-boar', 'dusk-lynx', 'gale-hawk']);
function creatureSpec(a) {
  const k = a.kind;
  if (QUADS[k]) return {type: 'quad', key: 'quad:' + k, Q: QUADS[k], size: {w: QW, h: QH}, foot: QG + 1, draw: drawQuad, flying: false};
  if (k === 'gale-hawk') return {type: 'bird', key: 'hawk', feather: rampOf('#9a7048'), breast: rampOf('#e8d8b8'), size: {w: 40, h: 40}, foot: 40, draw: drawHawk, flying: true};
  if (k === 'gloam-wisp') return {type: 'wisp', key: 'wisp', glow: M.glowTeal, size: {w: 32, h: 36}, foot: 36, draw: drawWisp, flying: true};
  if (k === 'ember-imp') return {type: 'imp', key: 'imp', skin: rampOf('#c8482e'), belly: rampOf('#f0a060'), wing: rampOf('#6a2a2e'), horn: rampOf('#e8d8b0'), size: {w: 32, h: 36}, foot: 36, draw: drawImp, flying: true};
  if (k === 'ghost') return {type: 'ghost', key: 'ghost', cloth: rampOf('#b8c8d0'), eye: hex('#7af0e0'), size: {w: 36, h: 48}, foot: 46, draw: drawGhost, flying: true};
  if (k === 'troll') return {type: 'brute', key: 'troll', nose: true, tuft: hex('#3a3428'), skin: rampOf('#7f8a62'), belly: rampOf('#9a9c78'), loin: rampOf('#5a4030'), eye: hex('#ff7a2a'), tusks: true, club: true, embers: true, shoulder: 9, bodyW: 11, bodyH: 18, legLen: 12, legR: 3, armR: 2.6, headR: 4.2, size: {w: 56, h: 60}, foot: 58, draw: drawBrute};
  if (k === 'moss-golem') return {type: 'brute', key: 'golem', skin: rampOf('#8a8c82'), flatShade: true, moss: rampOf('#5f8a3c'), eye: hex('#9af06a'), cracks: true, shoulder: 8, bodyW: 9.5, bodyH: 15, legLen: 8, legR: 2.6, armR: 2.6, headR: 3.6, size: {w: 48, h: 50}, foot: 48, draw: drawBrute};
  if (['goblin', 'thief', 'bandit', 'zombie', 'skeleton', 'bone-squire', 'sentinel'].includes(k)) return foeHuman(k, a);
  return null;
}
// ================================================================ specs
const GEAR = {
  warrior: {sword: true, rivets: true, pauldron: true, strap: true},
  mage: {staff: true},
  ranger: {bow: true, quiver: true},
  summoner: {charm: true}
};
const LEGACY = {oathbinder: 'warrior', echoartisan: 'mage', marrowgardener: 'ranger'};
const outfitHex = o => !o ? null : OUTFIT_COLORS[o] || (/^#?[0-9a-f]{6}$/i.test(o) ? (o[0] === '#' ? o : '#' + o) : null);
const mixHex = (a, b, t) => '#' + mix(hex(a), hex(b), t).map(v => v.toString(16).padStart(2, '0')).join('');
// Body proportions by build: half widths at shoulder / waist / hip.
function build(sp, kind) {
  const fem = sp.gender === 'female', nb = sp.gender === 'nonbinary';
  if (kind === 'broad') Object.assign(sp, {shoulder: 7, waist: 5, hip: 6});
  else if (fem) Object.assign(sp, {shoulder: 5, waist: 4, hip: 5});
  else if (nb) Object.assign(sp, {shoulder: 6, waist: 4, hip: 5});
  else Object.assign(sp, {shoulder: 6, waist: 5, hip: 5});
  return sp;
}
function baseHuman(gender, skin, hair, seed) {
  return {
    type: 'human', gender, skinKey: skin, hairKey: hair, seed, skin: SKIN[skin], blush: hex(BLUSH[skin]), hair: HAIR[hair],
    eyes: irises(skin, seed % EYE_DEFAULTS), lash: mix(HAIR[hair].o, [30, 18, 26], .6), mouth: mix(SKIN[skin].d, [150, 60, 66], .35),
    tie: hex('#c8a24a'), fletch: hex('#c4553f'), inner: rampOf('#e2d8c4'), boot: M.boot, belt: M.leather, pants: rampOf('#4a4552'), trim: rampOf('#d8b46a'), gear: {}
  };
}
function heroSpec(a, outfit) {
  const classId = GEAR[a.classId] ? a.classId : LEGACY[a.classId] || 'warrior';
  const gender = ['female', 'male', 'nonbinary'].includes(a.gender) ? a.gender : 'female';
  const skin = SKIN[a.skin] ? a.skin : 'warm', hair = HAIR[a.hair] ? a.hair : 'brown';
  const color = outfitHex(outfit) || outfitHex(a.outfit) || OUTFIT_COLORS.traveler, seed = seedOf(a.name || 'Wayfarer');
  const styles = HAIR_STYLES[gender], hairStyle = styles.includes(a.hairStyle) ? a.hairStyle : styles[seed % DEFAULT_STYLES];
  const sp = baseHuman(gender, skin, hair, seed), coat = rampOf(color), eyeIx = EYE_COLORS.includes(a.eyes) ? EYE_COLORS.indexOf(a.eyes) : seed % EYE_DEFAULTS;
  Object.assign(sp, {classId, hairStyle, coat, gear: {...GEAR[classId]}, eyes: irises(skin, eyeIx), face: ['freckles', 'scar', 'mark'].includes(a.face) ? a.face : null});
  build(sp, gender === 'male' && classId === 'warrior' ? 'broad' : 'normal');
  if (classId === 'warrior') {sp.garment = 'coat'; sp.trim = rampOf('#c9a45c'); sp.pants = rampOf('#4b4650'); sp.cuff = M.leather;}
  if (classId === 'mage') {sp.garment = 'robe'; sp.hat = 'wizard'; sp.hatColor = coat; sp.trim = rampOf('#e2c16e'); sp.inner = rampOf('#efe2c4'); sp.orb = M.glowTeal; sp.cuff = rampOf('#e2c16e');}
  if (classId === 'ranger') {sp.garment = 'tunic'; sp.hood = true; sp.mantle = true; sp.cloak = coat; sp.coat = rampOf(mixHex(color, '#7a6444', .55)); sp.trim = rampOf('#b89a62'); sp.pants = rampOf('#5a4a3a'); sp.sleeve = rampOf(mixHex(color, '#7a6444', .55)); sp.glove = rampOf('#9a7a52');}
  if (classId === 'summoner') {sp.garment = 'longcoat'; sp.collar = true; sp.trim = rampOf('#d6b56c'); sp.inner = rampOf('#e6dcc6'); sp.orb = M.glowViolet; sp.cuff = rampOf('#d6b56c');}
  if (a.headwear === 'bare') {sp.hat = null; sp.hood = false;}
  sp.key = ['hero', classId, gender, skin, hair, color, hairStyle, eyeIx, sp.face || '-', sp.hat || sp.hood ? 'w' : 'b'].join(':');
  return sp;
}

// Kinds that keep their 3D models (bosses, horrors, vehicles).
const NO_SPRITE = new Set(['horseman', 'werewolf', 'paleguest', 'drowned-sexton', 'hollow-cantor', 'tallow-widow']);
export function spriteFor(actor, outfit = null) {
  if (!actor || NO_SPRITE.has(actor.kind)) return null;
  const sp = makeSpec(actor, outfit); if (sp) sp.isSpec = true; return sp;
}
function makeSpec(actor, outfit) {
  if (actor.isSpec) return actor; // already a normalized spec
  const hero = actor.kind === 'hero' || actor.type === 'hero' || actor.id === 'player';
  if (hero) return heroSpec(actor, outfit ?? actor.outfit);
  const c = creatureSpec(actor); if (c) return c;
  if (actor.type === 'npc' || actor.type === 'mythic' || actor.role) return npcSpec(actor);
  return null;
}
export const spriteSpec = (actor, outfit = null) => spriteFor(actor, outfit) || {type: 'none', key: 'none', kind: actor?.kind || 'npc'};
export const spriteSize = actor => {const sp = spriteFor(actor); return sp?.size || {w: HW, h: HH};};

// ================================================================ sheets & drawing
const sheets = new Map();
export function renderFrame(sp, dir, pose, f) {
  const w = sp.size?.w || HW, h = sp.size?.h || HH, B = new Buf(w, h);
  if (sp.type === 'human') drawHuman(B, sp, dir, pose, f);
  else if (sp.draw) {sp.draw(B, sp, dir === 'right' ? 'left' : dir, pose, f); outline(B); if (dir === 'right') mirror(B);}
  return B;
}
// The whole sheet (4 direction rows x 14 pose columns) is generated once per appearance and cached by key.
export function spriteSheet(actor, outfit = null) {
  const sp = spriteFor(actor, outfit);
  if (!sp) return null;
  let s = sheets.get(sp.key); if (s) return s;
  const w = sp.size?.w || HW, h = sp.size?.h || HH, cols = SHEET_COLS, rows = DIRS.length, data = new Uint8ClampedArray(w * cols * h * rows * 4);
  // the right-facing row is the left row mirrored, so it is copied rather than drawn again
  const L = DIRS.indexOf('left'), Rt = DIRS.indexOf('right');
  DIRS.forEach((dir, row) => {if (dir === 'right') return; for (const pose of POSES) for (let f = 0; f < POSE_FRAMES[pose]; f++) {
    const B = renderFrame(sp, dir, pose, f), col = frameIndex(pose, f);
    for (let y = 0; y < h; y++) {
      data.set(B.c.subarray(y * w * 4, (y + 1) * w * 4), ((row * h + y) * w * cols + col * w) * 4);
      if (row === L) for (let x = 0; x < w; x++) data.set(B.c.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), ((Rt * h + y) * w * cols + col * w + (w - 1 - x)) * 4);
    }
  }});
  s = {key: sp.key, spec: sp, w, h, cols, rows, data, foot: sp.foot ?? FOOT + 1, ppu: sp.ppu || 1};
  if (sheets.size > 160) sheets.delete(sheets.keys().next().value);
  sheets.set(sp.key, s); return s;
}
export const releaseSheet = key => sheets.delete(key);
// Draw one frame onto a 2D canvas with hard pixels. Options: dir, pose, t, frame, scale (integer), clear, bg, outfit,
// fit (crop to the figure and pick the largest whole-pixel scale that fits), shadow (a pixel ground shadow, with fit).
export function drawSprite(canvas, actor, o = {}) {
  const {dir = 'down', pose = 'idle', t = 0, clear = true, bg = null, outfit = null} = o;
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  if (clear) c.clearRect(0, 0, canvas.width, canvas.height);
  if (bg) {c.fillStyle = bg; c.fillRect(0, 0, canvas.width, canvas.height);}
  const sheet = spriteSheet(actor, outfit); if (!sheet) return false;
  const P = POSES.includes(pose) ? pose : 'idle', f = o.frame ?? poseFrame(P, t), col = frameIndex(P, f), row = Math.max(0, DIRS.indexOf(dir)), w = sheet.w, h = sheet.h;
  const px = (x, y) => ((row * h + y) * w * sheet.cols + col * w + x) * 4;
  let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
  if (o.fit) {x0 = w; y0 = h; x1 = -1; y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sheet.data[px(x, y) + 3]) {x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);} if (x1 < 0) return false;}
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1 + (o.fit && o.shadow ? 2 : 0);
  const sc = Math.max(1, (o.scale | 0) || (o.fit ? Math.floor(Math.min(canvas.width * .86 / bw, canvas.height * .86 / bh)) : 4));
  const ox = Math.round((canvas.width - bw * sc) / 2), oy = Math.round((canvas.height - bh * sc) / 2);
  if (o.fit && o.shadow) {c.fillStyle = 'rgba(10,8,20,0.32)'; const sw = Math.max(4, Math.round(bw * .7)), sx = Math.round((bw - sw) / 2); for (let k = 0; k < 3; k++) {const inset = k === 1 ? 0 : 2; c.fillRect(ox + (sx + inset) * sc, oy + (bh - 3 + k) * sc, (sw - inset * 2) * sc, sc);}}
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = px(x, y), a = sheet.data[k + 3]; if (!a) continue;
    c.fillStyle = `rgb(${sheet.data[k]},${sheet.data[k + 1]},${sheet.data[k + 2]})`;
    c.fillRect(ox + (x - x0) * sc, oy + (y - y0) * sc, sc, sc);
  }
  return true;
}
