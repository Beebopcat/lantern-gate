// Camera-facing pixel sprite billboards for world actors (pixel diorama look, settings.look "hd2d").
// render.js asks `want()` whether an actor gets a sprite; if so it uses `create/update/release` instead of a 3D model.
// One CanvasTexture per appearance (sheet) is shared by every actor wearing it; each actor clones the texture object
// (same GPU source) only to hold its own frame offset. Textures are disposed when their last user goes away.
import * as THREE from './vendor/three.js';
import {spriteFor, spriteSheet, releaseSheet, DIRS, frameIndex, POSE_FRAMES} from './sprites.js';

// World units per sprite pixel. Humans (36px figures) stand 2.4 tiles tall, which is exactly 1.5 low-res pixels per
// sprite pixel at the default 720p view (a regular 1-2-1-2 pattern instead of an irregular one).
export const PX = 2.4 / 36;
const TAU = Math.PI * 2;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
function spriteGeometry() {const g = new THREE.PlaneGeometry(1, 1); g.translate(0, .5, 0); return g;}
// Sprites are lit on the CPU with one colour per actor (no hot spots from a lantern held inside the plane):
// the same hemisphere, sun, ambient and point lights as the scene, evaluated for a normal that leans up toward the sky
// the way the floor faces it, then divided by pi like a Lambert surface.
const N = new THREE.Vector3(), D = new THREE.Vector3(), C = new THREE.Color(), H = new THREE.Color();
export function lightAt(out, x, y, z, yaw, L) {
  N.set(Math.sin(yaw) * .62, .78, Math.cos(yaw) * .62);
  out.setRGB(0, 0, 0);
  if (L.hemi) {const k = .5 * N.y + .5; H.copy(L.hemi.groundColor).lerp(L.hemi.color, k).multiplyScalar(L.hemi.intensity); out.add(H);}
  if (L.fill) out.add(C.copy(L.fill.color).multiplyScalar(L.fill.intensity));
  if (L.sun) {D.subVectors(L.sun.position, L.sun.target.position).normalize(); out.add(C.copy(L.sun.color).multiplyScalar(L.sun.intensity * Math.max(0, N.dot(D)) * .8));}
  for (const p of L.points || []) {
    if (!p.intensity) continue;
    D.set(p.position.x - x, p.position.y - y, p.position.z - z); const d = Math.max(1.15, D.length());
    if (p.distance && d > p.distance) continue;
    const fall = 1 / (d * d) * (p.distance ? Math.pow(Math.max(0, 1 - Math.pow(d / p.distance, 4)), 2) : 1);
    out.add(C.copy(p.color).multiplyScalar(p.intensity * fall * (.55 + .45 * Math.max(0, N.dot(D.normalize())))));
  }
  return out.multiplyScalar(1 / Math.PI);
}
function shadowTexture() {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(64, 64) : Object.assign(document.createElement('canvas'), {width: 64, height: 64});
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.78)'); gr.addColorStop(.6, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export class SpriteActors {
  constructor() {
    this.geo = spriteGeometry();
    this.shadowGeo = new THREE.CircleGeometry(.5, 24); this.shadowGeo.rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({map: shadowTexture(), transparent: true, depthWrite: false, color: '#1b1626', opacity: .85, polygonOffset: true, polygonOffsetFactor: -2});
    this.sheets = new Map(); // key -> {texture, users}
    this.tmp = new THREE.Vector3(); this.right = new THREE.Vector3(); this.fwd = new THREE.Vector3();
  }
  // Sprite spec for an actor in the pixel diorama look, or null (keep the 3D model).
  want(a, outfit, wardrobe) {return spriteFor(wardrobe ? {...a, wardrobe} : a, outfit);}
  sheetTexture(spec) {
    let e = this.sheets.get(spec.key);
    if (!e) {
      const sh = spriteSheet(spec), W = sh.w * sh.cols, H = sh.h * sh.rows;
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), {width: W, height: H});
      c.getContext('2d').putImageData(new ImageData(sh.data, W, H), 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = true;
      e = {texture: t, sheet: sh, users: 0}; this.sheets.set(spec.key, e);
    }
    e.users++; return e;
  }
  create(spec) {
    const e = this.sheetTexture(spec), sh = e.sheet, map = e.texture.clone();
    map.repeat.set(1 / sh.cols, 1 / sh.rows); map.needsUpdate = false;
    const mat = new THREE.MeshBasicMaterial({map, alphaTest: .5, color: '#ffffff'});
    const quad = new THREE.Mesh(this.geo, mat); quad.castShadow = false; quad.receiveShadow = false; quad.name = 'sprite';
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat); shadow.renderOrder = -1;
    const root = new THREE.Group(); root.add(shadow, quad);
    // figure bounds inside the frame (for shadow width, hit box and label height)
    let top = sh.h, minX = sh.w, maxX = 0; const row = DIRS.indexOf('down'), col = frameIndex('idle', 0);
    for (let y = 0; y < sh.h; y++) for (let x = 0; x < sh.w; x++) if (sh.data[((row * sh.h + y) * sh.w * sh.cols + col * sh.w + x) * 4 + 3]) {top = Math.min(top, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x);}
    const side = DIRS.indexOf('left'); let sMin = sh.w, sMax = 0;
    for (let y = 0; y < sh.h; y++) for (let x = 0; x < sh.w; x++) if (sh.data[((side * sh.h + y) * sh.w * sh.cols + col * sh.w + x) * 4 + 3]) {sMin = Math.min(sMin, x); sMax = Math.max(sMax, x);}
    const entry = {mesh: root, quad, shadow, map, key: spec.key, spec, sheet: sh, dir: 'down', figure: {top, width: maxX - minX + 1, sideWidth: sMax - sMin + 1, height: sh.foot - top}, sprite: true};
    root.userData.sprite = entry;
    return entry;
  }
  release(entry) {
    entry.quad.material.dispose(); entry.map.dispose();
    const e = this.sheets.get(entry.key);
    if (e && --e.users <= 0) {e.texture.dispose(); this.sheets.delete(entry.key); releaseSheet(entry.key);}
  }
  // ctx: {camera, fwd, right, elapsed, unit, stretch, ground, lowres:{w,h}|null, guard, working, hideShadow, lights}
  update(entry, a, m, ctx) {
    const sh = entry.sheet, cam = ctx.camera, unit = ctx.unit, stretch = ctx.stretch;
    // direction relative to the camera, with hysteresis so diagonals do not flicker
    const camAngle = Math.atan2(cam.position.x - m.x, cam.position.z - m.y), rel = wrap(m.facing - camAngle);
    const centre = {down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2}, prev = entry.dir;
    if (Math.abs(wrap(rel - centre[prev])) > Math.PI / 4 + .14) entry.dir = Math.abs(rel) <= Math.PI / 4 ? 'down' : Math.abs(rel) >= 3 * Math.PI / 4 ? 'up' : rel > 0 ? 'right' : 'left';
    // pose
    const dead = !!a.deadUntil || a.fallen, sleep = (a.activity?.animation === 'sleep' || a.task === 'sleeping') && m.blend < .1;
    let pose = 'idle', f = Math.floor(m.clock * 1.6 + (sh.spec.seed || 0) % 7 * .37) % 2;
    if (dead || sleep) {pose = 'down'; f = 0;}
    else if ((a.flash || 0) > ctx.elapsed) {pose = 'hurt'; f = 0;}
    else if (m.attack > 0) {const p = 1 - m.attack; pose = m.casting ? 'cast' : 'attack'; f = m.casting ? Math.floor(m.clock * 8) % 2 : p < .28 ? 0 : p < .7 ? 1 : 2;}
    else if (m.blend > .22) {pose = 'walk'; f = Math.floor(((m.phase % TAU) + TAU) % TAU / TAU * 4) % 4;}
    else if (ctx.guard) {pose = 'guard'; f = 0;}
    else if (ctx.working && sh.spec.gear?.tool) {pose = 'attack'; f = [0, 1, 2, 2][Math.floor(m.clock * 2.6) % 4];} // hammering, digging, rolling dough
    const col = frameIndex(pose, Math.min(f, POSE_FRAMES[pose] - 1)), row = DIRS.indexOf(entry.dir);
    entry.map.offset.set(col / sh.cols, 1 - (row + 1) / sh.rows);
    entry.pose = pose;
    // size: one world size per sprite pixel; the frame's foot row sits on the ground
    const w = sh.w * unit, h = sh.h * unit * stretch, footUp = (sh.h - sh.foot) * unit * stretch;
    entry.quad.scale.set(w, h, 1);
    entry.quad.rotation.y = Math.atan2(-ctx.fwd.x, -ctx.fwd.z);
    entry.quad.position.set(0, -footUp, 0);
    entry.mesh.position.set(m.x, ctx.ground, m.y);
    // snap the billboard to the low-resolution pixel grid so it does not shimmer while the camera glides
    if (ctx.lowres) {
      const p = this.tmp.set(m.x, ctx.ground, m.y).project(cam);
      if (p.z < 1 && p.z > -1) {
        const lw = ctx.lowres.w, lh = ctx.lowres.h, sx = (p.x + 1) / 2 * lw, sy = (p.y + 1) / 2 * lh;
        const dx = (Math.round(sx) - sx) / lw * 2, dy = (Math.round(sy) - sy) / lh * 2;
        const dist = cam.position.distanceTo(this.tmp.set(m.x, ctx.ground, m.y));
        const half = cam.isPerspectiveCamera ? Math.tan(cam.fov * Math.PI / 360) * dist : (cam.top - cam.bottom) / 2 / cam.zoom;
        entry.quad.position.x = dx * half * cam.aspect * ctx.right.x; entry.quad.position.z = dx * half * cam.aspect * ctx.right.z;
        entry.quad.position.y += dy * half;
      }
    }
    // soft ground shadow sized to the silhouette; flying creatures cast a smaller, fainter one
    const sw = Math.max(entry.figure.width, entry.figure.sideWidth * .8) * unit * (pose === 'down' ? 1.5 : 1) * (sh.spec.flying ? .65 : 1);
    entry.shadow.scale.set(sw * 1.05, 1, sw * .55);
    entry.shadow.position.set(0, .03, 0); entry.shadow.rotation.y = entry.quad.rotation.y; // long axis along the screen
    entry.shadow.visible = !ctx.hideShadow;
    // scene light at the sprite (plus a hot red-white flash while hurt)
    const tint = entry.quad.material.color;
    if (ctx.lights) lightAt(tint, m.x, ctx.ground + 1.1, m.y, entry.quad.rotation.y, ctx.lights); else tint.setRGB(1, 1, 1);
    if ((a.flash || 0) > ctx.elapsed) tint.setRGB(tint.r * 1.6 + .5, tint.g * .9 + .12, tint.b * .9 + .1);
    return entry;
  }
  dispose() {for (const e of this.sheets.values()) e.texture.dispose(); this.sheets.clear(); this.shadowMat.map.dispose(); this.shadowMat.dispose(); this.geo.dispose(); this.shadowGeo.dispose();}
}
