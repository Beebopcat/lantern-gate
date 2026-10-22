// Battle screen for the turn-based encounters: a miniature lantern-lit diorama. The rules live in battle.js (it reports
// what happened as a list of events with snapshots); this file only draws that story: sprite poses for the party and the
// foes, Ward pips and Fray glyphs under each foe, the Kindle control, the strip of the next eight turns, the command,
// skill, item and target menus, and the result screen. Nothing here is saved, rolled or played as sound.
import * as B from './battle.js';
import {FRAY_ICON_ART} from './fray-icons.js';
import { foeData } from './battle-data.js';
import { spriteFor, spriteSheet, drawSprite, POSE_FRAMES } from './sprites.js';

// ---------------------------------------------------------------- Fray glyphs
// Simple original Fray shapes fit the existing 11px/13px marks; damage/state logic stays in battle.js.
function glyph(type, cls = '') {
  const key = Object.hasOwn(FRAY_ICON_ART, type) ? type : 'unknown';
  return `<svg class="g g-${type} ${cls}" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${FRAY_ICON_ART[key]}</g></svg>`;
}
const typeLabel = t => B.TYPE_INFO[t]?.label || t;

export function createBattleUI({ getState, renderer, E, dist, save, message, hud, stopInput, jingle }) {
  let root = null, b = null, busy = false, token = 0, mode = 'menu', pending = null, spend = 0, fast = false;
  let acts = {}, letters = {}, foeIds = [], ro = null, idleTimer = null, lastStrip = [], seenFrays = {};
  const reduced = () => !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Every pause in the story goes through here. dataset.waited totals the delay asked for (tests read it: with reduced motion each pause is at most 50 ms).
  const wait = ms => new Promise(r => {
    const eff = fast ? 0 : reduced() ? Math.min(ms, 50) : ms;
    if (root) root.dataset.waited = String((Number(root.dataset.waited) || 0) + eff);
    if (!eff) return r(); setTimeout(r, eff);
  });
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = sel => root.querySelector(sel);
  const $$ = sel => [...root.querySelectorAll(sel)];
  const ctx = () => ({ hurt: E.hurt, use: E.use, note: E.note, now: Date.now() });
  const num = n => Math.max(0, Math.round(n));

  function mount() {
    if (root) return root;
    root = document.createElement('section');
    root.id = 'battle'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Battle');
    (document.getElementById('game') || document.body).append(root);
    root.addEventListener('click', onClick);
    root.addEventListener('pointerover', onHover);
    root.addEventListener('focusin', onHover);
    return root;
  }

  // ---------------------------------------------------------------- sprites and poses
  // Foes and companions without a drawn sprite (bosses and night hunters keep their 3D models) are rendered once through the
  // world's portrait path, the background is keyed out and the figure is reduced to hard pixels, so every actor in the arena
  // reads as the same kind of pixel art. Such figures cannot change pose; CSS tilts, flashes and fades them instead.
  const MODEL_FRAME = { default: { x: 0, y: 1.15, d: 4.4, look: .98, turn: -.55 } };
  function modelFigure(actor) {
    const frame = { ...MODEL_FRAME.default, ...(MODEL_FRAME[actor.kind] || {}) };
    try {
      const tmp = document.createElement('canvas'); tmp.width = tmp.height = 256;
      renderer.portrait(tmp, actor, null, frame);
      const src = tmp.getContext('2d').getImageData(0, 0, 256, 256).data, bg = [src[0], src[1], src[2]], S = 64, out = new Uint8ClampedArray(S * S * 4);
      let x0 = S, y0 = S, x1 = -1, y1 = -1;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = ((y * 4 + 2) * 256 + x * 4 + 2) * 4, d = Math.abs(src[i] - bg[0]) + Math.abs(src[i + 1] - bg[1]) + Math.abs(src[i + 2] - bg[2]);
        if (d < 36) continue;
        const o = (y * S + x) * 4; out[o] = src[i] & 0xf8; out[o + 1] = src[i + 1] & 0xf8; out[o + 2] = src[i + 2] & 0xf8; out[o + 3] = 255;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      if (x1 < 0) throw new Error('empty');
      const w = x1 - x0 + 3, h = y1 - y0 + 3, c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'), img = g.createImageData(w, h);
      const at = (x, y) => (y * w + x) * 4;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const o = (y * S + x) * 4; if (out[o + 3]) img.data.set(out.subarray(o, o + 4), at(x - x0 + 1, y - y0 + 1)); }
      // a dark tinted outline around the silhouette, like the drawn sprites have
      const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && img.data[at(x, y) + 3] > 0;
      const ring = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) ring.push(at(x, y));
      for (const i of ring) img.data.set([14, 12, 30, 255], i);
      g.putImageData(img, 0, 0);
      return { canvas: c, w, h, foot: h - 1 };
    } catch { return shade(); }
  }
  // Last resort when a figure cannot be drawn at all: a small hooded shade with lantern-coloured eyes.
  function shade() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 40; const g = c.getContext('2d');
    g.fillStyle = '#0e0c1e'; g.fillRect(8, 6, 16, 4); g.fillRect(6, 10, 20, 24); g.fillRect(4, 18, 24, 18); g.fillRect(10, 2, 12, 4);
    g.fillStyle = '#24204a'; g.fillRect(9, 11, 14, 22); g.fillStyle = '#f0cf7a'; g.fillRect(12, 16, 3, 3); g.fillRect(18, 16, 3, 3);
    return { canvas: c, w: 32, h: 40, foot: 39 };
  }

  function makeActor(id, side, actor) {
    const en = { id, side, actor, dir: side === 'foe' ? 'left' : 'right', pose: 'idle', frame: 0, status: null, timer: 0 };
    let sheet = null; try { sheet = spriteFor(actor) ? spriteSheet(actor) : null; } catch { sheet = null; }
    if (sheet) { en.w = sheet.w; en.h = sheet.h; en.foot = sheet.foot; }
    else { const m = modelFigure(actor); en.model = m.canvas; en.w = m.w; en.h = m.h; en.foot = m.foot; }
    acts[id] = en; return en;
  }
  function paint(en) {
    const c = en.canvas; if (!c) return;
    if (en.model) { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(en.model, 0, 0); return; }
    try { drawSprite(c, en.actor, { dir: en.dir, pose: en.pose, frame: en.frame, scale: 1 }); } catch { /* the plate still tells the story */ }
  }
  // Where a figure rests when nothing is happening to it.
  const restPose = en => en.status === 'down' ? 'down' : en.status === 'staggered' ? 'hurt' : en.status === 'guard' ? 'guard' : 'idle';
  function setPose(en, pose, frame = 0) {
    en.pose = pose; en.frame = frame; paint(en);
    en.el?.setAttribute('data-pose', pose);
  }
  // A short pose (hurt, attack...) that returns to the resting pose by itself.
  function flash(en, pose, ms, frames = 1) {
    if (!en) return; clearTimeout(en.timer);
    const steps = reduced() ? 1 : Math.min(frames, POSE_FRAMES[pose] || 1), each = Math.max(60, ms / steps);
    setPose(en, pose, 0);
    for (let i = 1; i < steps; i++) setTimeout(() => { if (en.pose === pose) setPose(en, pose, i); }, each * i);
    en.timer = setTimeout(() => setPose(en, restPose(en), 0), ms);
  }
  function setStatus(en, status) {
    if (!en || en.status === status) return;
    en.status = status; en.el?.setAttribute('data-status', status || '');
    clearTimeout(en.timer); setPose(en, restPose(en), 0);
  }
  function idleTick() {
    if (!root || root.hidden || reduced()) return;
    for (const en of Object.values(acts)) if (en.pose === 'idle' && !en.model) { en.frame = en.frame ? 0 : 1; paint(en); }
  }

  // Head-and-shoulders crop of an actor, used by the turn strip.
  function thumb(id) {
    const en = acts[id]; if (!en) return null;
    if (en.thumb) return en.thumb;
    const T = 20, t = document.createElement('canvas'); t.width = t.height = T;
    try {
      const src = document.createElement('canvas'); src.width = en.w; src.height = en.h;
      if (en.model) src.getContext('2d').drawImage(en.model, 0, 0); else drawSprite(src, en.actor, { dir: en.dir, pose: 'idle', frame: 0, scale: 1 });
      const d = src.getContext('2d').getImageData(0, 0, en.w, en.h).data; let x0 = en.w, x1 = 0, y0 = en.h, y1 = 0;
      for (let y = 0; y < en.h; y++) for (let x = 0; x < en.w; x++) if (d[(y * en.w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      // tall figures: the head and chest; low, wide ones: the head end (the side they face), else centred
      let sx = Math.round((x0 + x1) / 2 - T / 2), sy = bh > T + 6 ? y0 - 1 : Math.round((y0 + y1) / 2 - T / 2);
      if (bw > T + 6) sx = en.dir === 'left' ? x0 : x1 - T + 1;
      sx = Math.max(0, Math.min(en.w - T, sx)); sy = Math.max(0, Math.min(en.h - T, sy));
      const g = t.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, sx, sy, T, T, 0, 0, T, T);
    } catch { /* an empty thumbnail is fine */ }
    return (en.thumb = t);
  }

  // ---------------------------------------------------------------- building the screen
  function foeHTML(e, i) {
    const en = acts[e.id], L = letters[e.id];
    return `<button type="button" class="b-foe" data-target="${esc(e.id)}" data-letter="${L}" data-pose="idle" style="--w:${en.w};--h:${en.h};--gap:${en.h - en.foot};--dy:${(i % 2) * -12}px">
      <span class="b-actor"><i class="b-shadow"></i><canvas class="b-sprite jr-sprite" width="${en.w}" height="${en.h}" aria-hidden="true"></canvas><i class="b-dizzy" aria-hidden="true"></i><i class="b-cursor" aria-hidden="true"></i></span>
      <span class="b-plate">
        <span class="b-name"><b class="b-letter">${L}</b><span class="b-nm">${esc(e.name)}</span></span>
        <span class="b-hprow"><span class="b-bar b-hp" aria-hidden="true"><i></i></span><span class="b-hpn jr-num"></span></span>
        <span class="b-ward" aria-hidden="true"></span>
        <span class="b-frays" aria-hidden="true"></span>
        <span class="b-tags"></span>
        <span class="b-preview" hidden></span>
      </span></button>`;
  }
  function allyHTML(id, name, en) {
    return `<div class="b-hero" data-id="${id}" data-pose="idle" data-side="${en.side}" style="--w:${en.w};--h:${en.h};--gap:${en.h - en.foot}">
      <span class="b-actor"><i class="b-shadow"></i><canvas class="b-sprite jr-sprite" width="${en.w}" height="${en.h}" aria-hidden="true"></canvas><i class="b-cursor" aria-hidden="true"></i></span>
      <span class="b-tag">${esc(name)}</span></div>`;
  }
  function cardHTML(id, name, cls, withMana) {
    return `<div class="b-card ${cls}" data-id="${id}">
      <span class="b-cname"><span class="b-cn">${esc(name)}</span><small class="b-lv jr-num"></small></span>
      <span class="b-crow"><span class="b-clabel">Health</span><span class="b-bar b-hp" aria-hidden="true"><i></i></span><span class="b-hpn jr-num"></span></span>
      ${withMana ? '<span class="b-crow b-mprow"><span class="b-clabel">Mana</span><span class="b-bar b-mp" aria-hidden="true"><i></i></span><span class="b-mpn jr-num"></span></span>' : ''}
      <span class="b-ctags"></span></div>`;
  }

  function build(events) {
    const s = getState(), foes = B.foe(b, s), g = s.guardian, snap = events[0]?.hp || B.snapshot(b, s);
    acts = {}; letters = {}; seenFrays = {}; lastStrip = [];
    foeIds = foes.map(e => e.id); foes.forEach((e, i) => { letters[e.id] = 'ABC'[i] || String(i + 1); });
    const hero = { ...s.player, id: 'player', type: 'hero' };
    makeActor('player', 'hero', hero); if (g) makeActor('guardian', 'ally', g);
    for (const e of foes) makeActor(e.id, 'foe', e);
    const name = s.player.name || 'You';
    root.dataset.phase = b.phase; root.dataset.round = b.round; root.dataset.mode = 'busy'; root.dataset.foes = foes.length; root.dataset.stack = 'false';
    root.innerHTML = `
      <div class="b-backdrop" aria-hidden="true"><i class="b-gate"></i><i class="b-lamp b-lamp-l"></i><i class="b-lamp b-lamp-r"></i></div>
      <header class="b-top">
        <h2 class="b-banner">${foes.length > 1 ? 'Encounter — ' + foes.length + ' foes' : 'Encounter — ' + esc(foes[0].name)}</h2>
        <ol class="b-timeline" aria-label="Turn order: the next ${B.TIMELINE_LENGTH} turns"></ol>
        <button type="button" class="b-skip" data-cmd="skip" hidden>Skip</button>
      </header>
      <div class="b-arena">
        <div class="b-floor" aria-hidden="true"></div>
        <div class="b-zone b-party">${allyHTML('player', name, acts.player)}${g ? allyHTML('guardian', g.name, acts.guardian) : ''}</div>
        <div class="b-zone b-foes">${foes.map(foeHTML).join('')}</div>
        <div class="b-caption" aria-hidden="true"></div>
      </div>
      <div class="b-log" role="log" aria-live="polite" aria-label="Battle log"></div>
      <div class="b-sub" hidden></div>
      <section class="b-status" aria-label="Your party">${cardHTML('player', name, 'b-player', true)}${g ? cardHTML('guardian', g.name, 'b-guardian', false) : ''}</section>
      <div class="b-kindle" role="radiogroup" aria-label="Kindle to spend on your next command">
        <span class="b-klabel">Kindle</span>
        <span class="b-kpips" aria-hidden="true">${'<i class="b-kpip"></i>'.repeat(B.KINDLE_MAX)}</span>
        <span class="b-kspend">${[0, 1, 2, 3].map(n => `<button type="button" role="radio" class="b-kbtn" data-kindle="${n}" aria-checked="${n === 0}" aria-label="${n ? 'Spend ' + n + ' Kindle' : 'Spend no Kindle'}">${n ? '+' + n : '0'}</button>`).join('')}</span>
        <small class="b-khint">Spend Kindle first: Attack, Skills and Flee grow stronger.</small>
      </div>
      <div class="b-menu" role="menu" aria-label="Commands"></div>
      <div class="b-over" hidden></div>`;
    // draw every figure, wire canvases to their entries
    for (const en of Object.values(acts)) {
      en.el = root.querySelector(en.side === 'foe' ? `.b-foe[data-target="${CSS.escape(en.id)}"]` : `.b-hero[data-id="${en.id}"]`);
      en.canvas = en.el.querySelector('canvas'); paint(en);
      // where the figure's head is inside its frame (the frame has empty headroom): cursor and dizzy stars sit there
      let top = 0; try { const d = en.canvas.getContext('2d').getImageData(0, 0, en.w, en.h).data; top = en.h; for (let y = 0; y < en.h && top === en.h; y++) for (let x = 0; x < en.w; x++) if (d[(y * en.w + x) * 4 + 3]) { top = y; break; } } catch { top = 0; }
      en.el.style.setProperty('--top', top);
    }
    applySnap(snap, true);
    renderStrip(events.find(e => e.type === 'turn')?.tl || B.timeline(b, s));
    ro?.disconnect(); ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fitArena()) : null; ro?.observe($('.b-arena'));
    fitArena(); renderAll();
    clearInterval(idleTimer); idleTimer = setInterval(idleTick, 620);
  }

  // Pixel scale for every figure: as large as the arena allows from 4, 3, 2, 1.5 (a regular 1-2-1-2 pixel rhythm) or 1.
  // Two arrangements are tried: party left and foes right, or (tall arenas) foes above and the party below; the tall one is
  // used only when the arena is tall and the figures end up no smaller.
  function fitArena() {
    const arena = root && $('.b-arena'); if (!arena) return;
    const aw = arena.clientWidth, ah = arena.clientHeight; if (!aw || !ah) return;
    const foes = foeIds.map(id => acts[id]), party = ['player', 'guardian'].map(id => acts[id]).filter(Boolean);
    const plate = Math.max(70, ...$$('.b-plate').map(p => p.offsetHeight)), tallest = Math.max(...Object.values(acts).map(e => e.h));
    const need = list => list.reduce((a, e) => a + e.w, 0) + 8 * list.length, cap = ah >= 420 && aw >= 600 ? 4 : 3;
    const fit = (zoneH, foeW, partyW) => [4, 3, 2, 1.5, 1].find(p => p <= cap && p * tallest + plate + 14 <= zoneH && p * need(foes) <= foeW * .97 && p * need(party) <= partyW * .97) || 1;
    const wide = fit(ah, aw * .62, aw * .38), tall = fit(ah / 2, aw, aw), stack = ah > aw * .72 && tall >= wide;
    root.style.setProperty('--b-px', stack ? tall : wide); root.dataset.stack = stack;
  }

  // ---------------------------------------------------------------- applying a snapshot to the screen
  const pct = (h, m) => Math.max(0, Math.min(100, Math.round(h / Math.max(1, m) * 100)));
  function applySnap(snap, quiet = false) {
    if (!snap) return;
    const p = snap.player;
    // party cards
    const pc = $('.b-player'); if (pc) {
      pc.querySelector('.b-hp i').style.width = pct(p.hp, p.maxHp) + '%'; pc.querySelector('.b-hpn').textContent = num(p.hp) + '/' + p.maxHp;
      pc.querySelector('.b-mp i').style.width = pct(p.mp, p.maxMp) + '%'; pc.querySelector('.b-mpn').textContent = num(p.mp) + '/' + p.maxMp;
      pc.querySelector('.b-lv').textContent = 'Lv ' + getState().player.level;
      pc.classList.toggle('down', p.hp <= 0);
      pc.querySelector('.b-ctags').innerHTML = [p.guard && 'Guarding', p.wall && 'Shield Wall', p.shield > 0 && `Ward-shield ${p.shield}`, p.cover && 'Covered'].filter(Boolean).map(t => `<span class="b-tag-chip">${esc(t)}</span>`).join('');
      pc.setAttribute('aria-label', `${getState().player.name || 'You'}: health ${num(p.hp)} of ${p.maxHp}, mana ${num(p.mp)} of ${p.maxMp}`);
      setStatus(acts.player, p.hp <= 0 ? 'down' : p.guard || p.wall ? 'guard' : null);
    }
    const g = snap.guardian, gc = $('.b-guardian'); if (g && gc) {
      gc.querySelector('.b-hp i').style.width = pct(g.hp, g.maxHp) + '%'; gc.querySelector('.b-hpn').textContent = num(g.hp) + '/' + g.maxHp;
      gc.classList.toggle('down', !!g.fallen);
      gc.querySelector('.b-lv').textContent = g.fallen ? 'fallen' : '';
      gc.querySelector('.b-ctags').innerHTML = g.empowered ? '<span class="b-tag-chip">Empowered</span>' : '';
      gc.setAttribute('aria-label', `${getState().guardian?.name || 'Companion'}: health ${num(g.hp)} of ${g.maxHp}${g.fallen ? ', fallen' : ''}`);
      setStatus(acts.guardian, g.fallen ? 'down' : null);
    }
    // foes
    for (const [id, f] of Object.entries(snap.foes)) {
      const btn = $(`.b-foe[data-target="${CSS.escape(id)}"]`), en = acts[id]; if (!btn || !en) continue;
      btn.querySelector('.b-hp i').style.width = pct(f.hp, f.maxHp) + '%'; btn.querySelector('.b-hpn').textContent = num(f.hp);
      btn.classList.toggle('is-dead', !!f.dead); btn.classList.toggle('is-staggered', !!f.staggered && !f.dead); btn.classList.toggle('is-charging', !!f.charging && !f.dead);
      btn.dataset.alive = String(!f.dead);
      // Ward pips: filled = still standing; the ones just lost pop out
      const wardEl = btn.querySelector('.b-ward'), had = wardEl.querySelectorAll('.b-pip').length;
      if (had !== f.maxWard) wardEl.innerHTML = '<span class="b-wlabel">Ward</span>' + '<i class="b-pip"></i>'.repeat(f.maxWard);
      wardEl.querySelectorAll('.b-pip').forEach((el, i) => { const on = i < f.ward, was = el.dataset.on === 'true'; el.dataset.on = String(on); if (was && !on && !quiet) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } });
      wardEl.dataset.ward = f.ward; wardEl.dataset.max = f.maxWard;
      // Frays: revealed ones show their glyph, the rest are unknown marks; tested-and-not-weak types are shown dim
      const row = btn.querySelector('.b-frays'), seen = seenFrays[id] ||= new Set();
      const unknown = Math.max(0, f.frays - f.revealed.length);
      row.innerHTML = f.revealed.map(t => `<span class="b-fray${!seen.has(t) && !quiet ? ' new' : ''}" data-type="${t}" data-known="true" title="${typeLabel(t)} is a Fray">${glyph(t)}</span>`).join('')
        + Array.from({ length: unknown }, () => `<span class="b-fray" data-type="unknown" data-known="false" title="An unknown Fray">${glyph('unknown')}</span>`).join('')
        + f.tested.filter(t => !f.revealed.includes(t)).map(t => `<span class="b-fray b-tested" data-type="${t}" data-known="no" title="${typeLabel(t)} is not a Fray">${glyph(t)}</span>`).join('');
      f.revealed.forEach(t => seen.add(t));
      // status tags
      const sp = f.charging ? B.foeData(getState().enemies.find(x => x.id === id)).special.name : '';
      btn.querySelector('.b-tags').innerHTML = [f.staggered && !f.dead && ['Staggered', 'stag'], f.charging && !f.dead && ['Readying ' + sp, 'warn'], f.steady && !f.staggered && !f.dead && ['Steadied', 'steady'], f.marked && !f.dead && ['Marked', 'mark'], f.slowed && !f.dead && ['Slowed', 'slow']].filter(Boolean).map(([t, c]) => `<span class="b-tag-chip ${c}">${esc(t)}</span>`).join('');
      const bits = [`${en.actor.name}.`, `Health ${num(f.hp)} of ${f.maxHp}.`, f.dead ? 'Defeated.' : `Ward ${f.ward} of ${f.maxWard}.`, f.revealed.length ? `Frays known: ${f.revealed.map(typeLabel).join(', ')}.` : '', unknown ? `${unknown} Fray${unknown > 1 ? 's' : ''} unknown.` : '', f.staggered && !f.dead ? 'Staggered.' : '', f.charging && !f.dead ? `Readying ${sp}.` : ''];
      btn.setAttribute('aria-label', bits.filter(Boolean).join(' '));
      setStatus(en, f.dead ? 'down' : f.staggered ? 'staggered' : null);
    }
    // Kindle
    $$('.b-kpip').forEach((el, i) => el.dataset.on = String(i < p.kindle));
    $('.b-kindle').dataset.level = p.kindle;
    clampSpend(p.kindle);
    root.dataset.round = b.round;
  }
  const maxSpend = () => Math.min(B.KINDLE_SPEND, b?.kindle || 0);
  function clampSpend(avail = b?.kindle || 0) {
    spend = Math.max(0, Math.min(spend, B.KINDLE_SPEND, avail));
    $$('.b-kbtn').forEach(btn => { const n = Number(btn.dataset.kindle); btn.setAttribute('aria-checked', String(n === spend)); btn.disabled = busy || n > Math.min(B.KINDLE_SPEND, avail); });
    const h = $('.b-khint'); if (h) h.textContent = spend ? `Spending ${spend}: Attack gains ${spend} hit${spend > 1 ? 's' : ''}; skills and Flee grow too.` : avail ? 'Spend Kindle first: Attack, Skills and Flee grow stronger.' : 'No Kindle to spend. It grows by 1 each round.';
  }

  // ---------------------------------------------------------------- turn strip
  function renderStrip(tl) {
    const ol = $('.b-timeline'); if (!ol) return; lastStrip = tl;
    const s = getState(); ol.innerHTML = ''; let round = null;
    for (const t of tl) {
      if (round !== null && t.round !== round) { const d = document.createElement('li'); d.className = 'b-rnd'; d.setAttribute('aria-hidden', 'true'); ol.append(d); }
      round = t.round;
      const li = document.createElement('li'); li.className = 'b-turn'; li.dataset.id = t.id; li.dataset.side = t.side; li.dataset.round = t.round;
      if (t.current) li.dataset.current = 'true'; if (t.skip) li.dataset.skip = 'true'; if (t.special) li.dataset.special = t.special;
      li.setAttribute('aria-label', `${t.name}${t.current ? ', acting now' : ''}, round ${t.round}${t.skip ? ', loses this turn' : ''}${t.special ? ', ' + t.special + ' lands' : ''}`);
      const c = document.createElement('canvas'); c.className = 'b-thumb jr-sprite'; c.width = c.height = 20; c.setAttribute('aria-hidden', 'true');
      const th = thumb(t.id); if (th) c.getContext('2d').drawImage(th, 0, 0);
      li.append(c);
      if (t.side === 'foe') { const l = document.createElement('b'); l.className = 'b-tl'; l.textContent = letters[t.id] || ''; li.append(l); }
      if (t.special) { const w = document.createElement('i'); w.className = 'b-tw'; w.textContent = '!'; li.append(w); }
      ol.append(li);
    }
    void s;
  }

  // ---------------------------------------------------------------- log, caption, pops
  function log(lines) {
    const el = $('.b-log'); if (!el) return;
    for (const t of lines) { if (!t) continue; const p = document.createElement('p'); p.textContent = t; el.append(p); }
    while (el.children.length > 40) el.firstChild.remove();
    el.scrollTop = el.scrollHeight;
  }
  let capTimer = 0;
  function caption(text, kind = '') {
    const c = $('.b-caption'); if (!c) return;
    clearTimeout(capTimer); c.className = 'b-caption'; void c.offsetWidth; c.textContent = text; c.className = 'b-caption show ' + kind;
    capTimer = setTimeout(() => { c.classList.remove('show'); }, reduced() ? 400 : 1100);
  }
  function pop(id, text, cls = '') {
    const el = acts[id]?.el?.querySelector('.b-actor'); if (!el) return;
    const n = document.createElement('span'); n.className = 'b-pop ' + cls; n.textContent = text; el.append(n); setTimeout(() => n.remove(), reduced() ? 600 : 1000);
  }
  function glyphPop(id, type) {
    const el = acts[id]?.el?.querySelector('.b-actor'); if (!el) return;
    const n = document.createElement('span'); n.className = 'b-pop b-gpop'; n.innerHTML = glyph(type); n.dataset.type = type; el.append(n); setTimeout(() => n.remove(), reduced() ? 600 : 1000);
  }
  const mark = (id, on) => { const el = acts[id]?.el; if (el) el.classList.toggle('is-acting', on); };

  // ---------------------------------------------------------------- playing the events
  const SPELLY = new Set(['arcane', 'frost', 'spirit', 'flame']);
  async function show(e) {
    applySnap(e.hp);
    const text = e.text; if (text && e.type !== 'turn') log([text]);
    switch (e.type) {
      case 'round': if (e.round > 1) { caption('Round ' + e.round, 'round'); } await wait(e.round > 1 ? 380 : 260); break;
      case 'turn': {
        renderStrip(e.tl || lastStrip); $$('.is-acting').forEach(x => x.classList.remove('is-acting')); mark(e.who, true);
        await wait(170); break;
      }
      case 'act': {
        const en = acts[e.src];
        // skills and foe specials are announced by name; plain blows are not
        if (e.src === 'player' && e.skill) caption(e.label);
        else if (e.special) caption(e.label + '!', 'special');
        const caster = e.src === 'player' && !!e.skill && (e.spell || SPELLY.has(e.dtype) || !e.dtype);
        if (en) { flash(en, caster ? 'cast' : 'attack', 420, 3); if (!caster && e.dtype !== undefined) lunge(en); }
        await wait(e.skill || e.special ? 440 : 320); break;
      }
      case 'hit': {
        const en = acts[e.dst];
        if (e.dst !== 'player' && e.dst !== 'guardian' && !en) break;
        if (e.blocked) { pop(e.dst, 'Blocked', 'blocked'); await wait(300); break; }
        if (en && e.dst) { if (e.amount > 0 || e.bleed) flash(en, 'hurt', 360); en.el?.classList.remove('hit'); void en.el?.offsetWidth; en.el?.classList.add('hit'); }
        if (e.dst === 'player' || e.dst === 'guardian') pop(e.dst, String(e.amount), 'dmg' + (e.guarded ? ' guarded' : ''));
        else {
          pop(e.dst, String(e.amount), 'dmg' + (e.crit ? ' crit' : '') + (e.fray ? ' fray' : '') + (e.staggered ? ' stag' : ''));
          if (e.fray) glyphPop(e.dst, e.dtype);
          if (e.revealed) caption(`${typeLabel(e.dtype)} is a Fray!`, 'fray');
        }
        await wait(e.revealed ? 620 : 380); break;
      }
      case 'stagger': caption('Staggered!', 'stagger'); await wait(780); break;
      case 'recover': caption('Recovered', 'recover'); await wait(430); break;
      case 'skip': pop(e.src, 'Staggered', 'blocked'); await wait(420); break;
      case 'telegraph': caption(e.move + ' is coming', 'warn'); await wait(650); break;
      case 'reveal': for (const t of e.types || []) glyphPop(e.dst, t); caption('Frays revealed', 'fray'); await wait(700); break;
      case 'heal': {
        const en = acts[e.dst || 'player'];
        if (e.amount > 0) pop('player', '+' + e.amount, 'heal'); else if (e.mana > 0) pop('player', '+' + e.mana + ' mana', 'mana');
        if (en) flash(en, 'cast', 380, 2);
        await wait(460); break;
      }
      case 'guard': pop('player', 'Guard', 'blocked'); await wait(380); break;
      case 'note': await wait(e.text ? 380 : 120); break;
      case 'end': await wait(420); break;
      default: await wait(100);
    }
  }
  // The attacker steps toward its target (a short nudge, never required to understand the turn).
  function lunge(en) {
    if (reduced() || !en?.el) return;
    const el = en.el; el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge'); setTimeout(() => el.classList.remove('lunge'), 460);
  }
  async function play(events, my) {
    for (const e of events) { if (my !== token) return; await show(e); }
  }

  // ---------------------------------------------------------------- menus
  const living = () => B.livingFoes(b, getState());
  const skillNeedsTarget = idx => { const k = B.skillsFor(getState())[idx]; return !!k && (k.target === 'one' || k.target === 'spread'); };
  const needsTarget = c => (c.id === 'attack' || (c.id === 'skill' && skillNeedsTarget(c.skill ?? B.skillFor(getState()).index))) && living().length > 1;

  function renderAll() {
    const over = b.phase === 'over'; root.dataset.phase = b.phase; root.dataset.mode = over ? 'over' : busy ? 'busy' : mode;
    renderMenu(); renderSub(); clampSpend();
    $('.b-skip').hidden = !(busy && !over);
    root.querySelectorAll('.b-foe').forEach(x => { const pick = mode === 'target' && !busy && x.dataset.alive !== 'false'; x.classList.toggle('pick', pick); x.disabled = x.dataset.alive === 'false'; });
  }
  function renderMenu() {
    const s = getState(), el = $('.b-menu'), cmds = B.commands(b, s), t = B.attackType(s), done = b.phase === 'over';   // kept (disabled) at the end so the layout does not jump
    el.innerHTML = cmds.map((c, i) => {
      const on = c.enabled && !busy && !done, kind = c.id === 'attack' ? glyph(t, 'b-cg') : '', uses = ['attack', 'skill', 'flee'].includes(c.id);
      // the chance to get away grows with the Kindle put into it, so the button shows it as it will be
      const chance = c.id === 'flee' ? Math.round(B.fleeChance(b, s, Math.min(spend, B.KINDLE_SPEND)) * 100) : 0, hint = c.id === 'flee' ? `Try to break away (${chance}%). Each Kindle adds 15%.` : c.hint;
      return `<button type="button" role="menuitem" data-cmd="${c.id}" class="b-cmd" ${on ? '' : 'disabled'} ${c.id === 'skill' || c.id === 'item' ? `aria-haspopup="true" aria-expanded="${mode === (c.id === 'skill' ? 'skills' : 'items')}"` : ''} aria-keyshortcuts="${i + 1}" title="${esc(hint || '')}"><kbd aria-hidden="true">${i + 1}</kbd><span class="b-lbl">${esc(c.label)}</span>${kind}${chance ? `<span class="b-chance jr-num" aria-hidden="true">${chance}%</span>` : ''}${uses && spend ? `<span class="b-kbadge" aria-hidden="true">+${spend}</span>` : ''}</button>`;
    }).join('');
    const sel = { attack: pending?.id === 'attack', skill: mode === 'skills' || pending?.id === 'skill', item: mode === 'items' }; el.querySelectorAll('[data-cmd]').forEach(x => x.classList.toggle('is-selected', !!sel[x.dataset.cmd] && !busy));
  }
  function renderSub() {
    const s = getState(), el = $('.b-sub');
    if (busy || b.phase === 'over' || mode === 'menu') { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false; el.dataset.mode = mode;
    if (mode === 'skills') {
      const list = B.skillList(b, s);
      el.innerHTML = `<div class="b-subhead"><h3 class="b-subtitle">Skills</h3><button type="button" class="b-back" data-cmd="back">Back</button></div><ul class="b-list" role="menu" aria-label="Skills">${list.map((k, i) => `<li><button type="button" role="menuitem" class="b-row" data-skill="${i}" ${k.enabled ? '' : 'disabled'} aria-keyshortcuts="${i + 1}"><span class="b-rg">${k.type ? glyph(k.type) : '<i class="b-rg-none"></i>'}</span><span class="b-rname">${esc(k.name)}</span><span class="b-cost jr-num">${k.mp} mana</span><span class="b-rdesc">${esc(k.enabled ? k.hint : k.why)}</span><span class="b-rk">${esc(k.kindleHint)}</span></button></li>`).join('')}</ul>`;
    } else if (mode === 'items') {
      const items = B.ITEM_LIST.filter(i => s.inv[i] > 0);
      el.innerHTML = `<div class="b-subhead"><h3 class="b-subtitle">Items</h3><button type="button" class="b-back" data-cmd="back">Back</button></div><ul class="b-list" role="menu" aria-label="Items">${items.map((i, n) => { const info = B.itemInfo(i); return `<li><button type="button" role="menuitem" class="b-row" data-item="${i}" aria-keyshortcuts="${n + 1}"><span class="b-rg"><i class="b-rg-item"></i></span><span class="b-rname">${esc(info.name)}</span><span class="b-cost jr-num">×${s.inv[i]}</span><span class="b-rdesc">${esc(info.detail)}</span></button></li>`; }).join('') || '<li class="b-empty">Your pack holds nothing to use.</li>'}</ul>`;
    } else if (mode === 'target') {
      el.innerHTML = `<div class="b-subhead"><h3 class="b-subtitle">Choose a target</h3></div><p class="b-prompt" id="b-prompt">${pending ? esc(pendingLabel()) : ''}</p><button type="button" class="b-back" data-cmd="back">Back</button>`;
    }
  }
  function pendingCmd() { return pending ? { ...pending, kindle: spend } : null; }
  function pendingLabel() {
    const s = getState(); if (!pending) return '';
    if (pending.id === 'attack') return `Attack (${typeLabel(B.attackType(s))}).`;
    const k = B.skillsFor(s)[pending.skill ?? B.skillFor(s).index]; return `${k.name}${k.type ? ' (' + typeLabel(k.type) + ')' : ''}.`;
  }
  // While choosing a target each foe says what the command would do to it: Fray, no Fray, or not yet known.
  function showPreviews() {
    const s = getState();
    for (const e of living()) {
      const box = $(`.b-foe[data-target="${CSS.escape(e.id)}"] .b-preview`); if (!box) continue;
      if (mode !== 'target' || !pending) { box.hidden = true; box.textContent = ''; continue; }
      const p = B.preview(b, s, pendingCmd(), e.id); if (!p || !p.type) { box.hidden = true; continue; }
      const t = typeLabel(p.type);
      box.hidden = false; box.dataset.fray = String(p.fray);
      box.textContent = p.fray === true ? (p.wardHits ? `${t}: Fray, −${p.wardHits} Ward` : p.staggered ? `${t}: Staggered, +50%` : `${t}: Fray`) : p.fray === false ? `${t}: not a Fray` : `${t}: unknown`;
    }
  }

  // ---------------------------------------------------------------- doing things
  function setMode(m, p = null) { mode = m; pending = p; renderAll(); showPreviews(); focusFor(); }
  function focusFor() {
    if (busy || !b) return;
    const first = mode === 'target' ? $('.b-foe.pick') : mode === 'skills' || mode === 'items' ? $('.b-sub .b-row:not([disabled])') || $('.b-sub .b-back') : mode === 'over' ? $('.b-over [data-cmd=done]') : $('.b-menu .b-cmd:not([disabled])');
    first?.focus({ preventScroll: true });
  }

  async function perform(cmd) {
    if (busy || b.phase === 'over') return;
    const my = token; cmd = { ...cmd, kindle: ['attack', 'skill', 'flee'].includes(cmd.id) ? spend : 0 };
    busy = true; fast = false; mode = 'menu'; pending = null; spend = 0; root.dataset.turns = String(Number(root.dataset.turns || 0) + 1); renderAll(); showPreviews();
    const out = B.act(b, getState(), cmd, ctx());     // the whole turn is decided here; the events are replayed below
    await play(out.events, my);
    if (my !== token) return;
    afterPlay(my);
  }
  function afterPlay(my) {
    if (my !== token || !b) return;
    const s = getState(); applySnap(B.snapshot(b, s), true); renderStrip(B.timeline(b, s)); $$('.is-acting').forEach(x => x.classList.remove('is-acting'));
    for (const en of Object.values(acts)) setPose(en, restPose(en), 0);
    busy = false; fast = false; mode = 'menu'; pending = null;
    if (b.phase === 'over') { showResult(); return; }
    renderAll(); focusFor();
  }

  function command(id, target) {
    if (busy || !b || b.phase === 'over') return;
    if (id === 'skill') { setMode('skills'); return; }
    if (id === 'item') { setMode('items'); return; }
    const c = { id }; if (needsTarget(c) && !target) { setMode('target', c); return; }
    void perform({ ...c, target });
  }
  function pickSkill(i) {
    const s = getState(), k = B.skillList(b, s)[i]; if (!k?.enabled || busy) return;
    const c = { id: 'skill', skill: i };
    if (needsTarget(c)) { setMode('target', c); return; }
    void perform({ ...c, target: living()[0]?.id });
  }

  function onClick(e) {
    const t = e.target.closest('button'); if (!t || t.disabled || !b) return;
    if (t.dataset.cmd === 'skip') { fast = true; return; }
    if (t.dataset.kindle !== undefined) { if (!busy) { spend = Number(t.dataset.kindle); clampSpend(); renderMenu(); showPreviews(); } return; }
    if (busy) return;
    if (t.dataset.target) {
      if (mode === 'target' && pending) { const c = pending; void perform({ ...c, target: t.dataset.target }); }
      else inspect(t.dataset.target);
      return;
    }
    if (t.dataset.skill !== undefined) { pickSkill(Number(t.dataset.skill)); return; }
    if (t.dataset.item) { void perform({ id: 'item', item: t.dataset.item }); return; }
    const c = t.dataset.cmd; if (!c) return;
    if (c === 'back') { setMode('menu'); $('.b-menu .b-cmd:not([disabled])')?.focus(); return; }
    if (c === 'done') { finish(); return; }
    command(c);
  }
  function inspect(id) {
    const f = B.snapshot(b, getState()).foes[id], en = acts[id]; if (!f || !en) return;
    const known = f.revealed.length ? f.revealed.map(typeLabel).join(', ') : 'none yet', unknown = Math.max(0, f.frays - f.revealed.length);
    log([`${en.actor.name}: Ward ${f.ward}/${f.maxWard}. Frays known: ${known}${unknown ? `; ${unknown} unknown` : ''}.`]);
  }
  function onHover(e) {
    if (mode !== 'target' || busy) return;
    const f = e.target.closest?.('.b-foe'); root.querySelectorAll('.b-foe.is-aimed').forEach(x => x !== f && x.classList.remove('is-aimed'));
    if (f && f.classList.contains('pick')) f.classList.add('is-aimed');
  }

  function onKey(e) {
    if (!b || !root || root.hidden) return;
    if (e.key === 'Tab') { trap(e); return; }
    // while the story plays, Escape (or Enter/Space away from a button) hurries it along
    if (busy) { if (e.key === 'Escape' || ((e.key === 'Enter' || e.key === ' ') && !document.activeElement?.closest?.('button'))) { fast = true; e.preventDefault(); e.stopPropagation(); } return; }
    if (b.phase === 'over') { if (e.key === 'Enter' && !document.activeElement?.closest?.('button')) { e.preventDefault(); finish(); } return; }
    const key = e.key;
    if (key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (mode !== 'menu') { setMode('menu'); $('.b-menu .b-cmd:not([disabled])')?.focus(); } return; }
    if ((key === 'k' || key === 'K') && !e.ctrlKey && !e.metaKey && !e.altKey) { spend = spend >= maxSpend() ? 0 : spend + 1; clampSpend(); renderMenu(); showPreviews(); e.preventDefault(); return; }
    if (/^[1-5]$/.test(key)) {
      const n = Number(key) - 1;
      if (mode === 'menu') { const c = B.commands(b, getState())[n]; if (c?.enabled) command(c.id); }
      else if (mode === 'skills') pickSkill(n);
      else if (mode === 'items') { const it = B.ITEM_LIST.filter(i => getState().inv[i] > 0)[n]; if (it) void perform({ id: 'item', item: it }); }
      else if (mode === 'target') { const f = living()[n]; if (f && pending) void perform({ ...pending, target: f.id }); }
      e.preventDefault(); return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      const group = mode === 'target' ? $$('.b-foe.pick') : mode === 'skills' || mode === 'items' ? $$('.b-sub .b-row:not([disabled]), .b-sub .b-back') : document.activeElement?.closest?.('.b-kbtn') ? $$('.b-kbtn:not([disabled])') : $$('.b-menu .b-cmd:not([disabled])');
      if (!group.length) return;
      const i = group.indexOf(document.activeElement), step = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1;
      group[(i < 0 ? (step > 0 ? 0 : group.length - 1) : (i + step + group.length) % group.length)].focus(); e.preventDefault();
    }
  }
  function trap(e) {
    const f = $$('button:not([disabled]):not([hidden])').filter(x => x.offsetParent !== null && !x.closest('[hidden]'));
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1], at = document.activeElement;
    if (!root.contains(at)) { first.focus(); e.preventDefault(); }
    else if (e.shiftKey && at === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && at === last) { first.focus(); e.preventDefault(); }
  }

  // ---------------------------------------------------------------- result screen
  function showResult() {
    const r = b.result, sm = b.summary || {}, over = $('.b-over'), s = getState();
    const title = r === 'won' ? 'Victory' : r === 'fled' ? 'Escaped' : 'Defeated';
    const text = r === 'won' ? `Victory! +${sm.gold || 0} coins, +${sm.xp || 0} experience${sm.leveled ? ` — level ${sm.level}!` : ''}.` : r === 'fled' ? 'You escaped. The foes will hesitate for a moment.' : 'You have fallen. The wayfarer shrine will call you back in ten seconds.';
    $('.b-banner').textContent = title; root.dataset.result = r; root.dataset.mode = 'over';
    if (r === 'won') jingle?.('victory');
    for (const en of Object.values(acts)) if (r === 'won' && en.side === 'foe') setStatus(en, 'down');
    const items = Object.entries(sm.items || {}).map(([id, n]) => `<li><span>${esc(B.itemInfo(id).name)}</span><b class="jr-num">×${n}</b></li>`).join('');
    const stat = (k, v) => `<li><span>${k}</span><b class="jr-num">${v}</b></li>`;
    const rewards = r === 'won' ? `<ul class="b-rewards"><li class="b-rw-coin"><span>Coins</span><b class="jr-num">+${sm.gold || 0}</b></li><li class="b-rw-xp"><span>Experience</span><b class="jr-num">+${sm.xp || 0}</b></li>${sm.leveled ? `<li class="b-rw-lv"><span>Level</span><b class="jr-num">${sm.level}</b></li>` : ''}</ul>${items ? `<h4 class="b-h4">Spoils</h4><ul class="b-loot">${items}</ul>` : '<p class="b-noloot">No spoils this time.</p>'}` : '';
    const stats = `<h4 class="b-h4">The battle</h4><ul class="b-stats">${stat('Rounds', sm.rounds || b.round)}${stat('Frays found', sm.revealed || 0)}${stat('Frays struck', sm.frays || 0)}${stat('Staggers', sm.staggers || 0)}${stat('Kindle spent', sm.kindle || 0)}${stat('Best blow', sm.best || 0)}</ul>`;
    over.innerHTML = `<div class="b-ov-panel" role="group" aria-labelledby="b-ov-title"><h3 class="b-ov-title" id="b-ov-title">${title}</h3><p class="b-result" data-result="${r}">${esc(text)}</p>${rewards}${stats}<button type="button" class="b-primary" data-cmd="done">Continue</button></div>`;
    over.hidden = false; renderAll();
    $('.b-over [data-cmd=done]')?.focus({ preventScroll: true });
    void s;
  }

  function finish() {
    token++;
    clearInterval(idleTimer); idleTimer = null; ro?.disconnect(); ro = null; document.removeEventListener('keydown', onKey, true);
    for (const en of Object.values(acts)) clearTimeout(en.timer);
    const s = getState(), r = b?.result;
    root.hidden = true; root.innerHTML = ''; b = null; busy = false; mode = 'menu'; pending = null; spend = 0; acts = {};
    root.removeAttribute('data-result'); document.getElementById('game')?.removeAttribute('data-battle');
    if (r === 'lost') message('You have fallen. The wayfarer shrine will call you back in ten seconds.');
    else if (r === 'won') message('The road is clear.');
    s.revision++; save(); hud();
  }

  return {
    get active() { return !!b; },
    // true while a boss is among the foes (the score changes to the boss theme)
    get boss() { return !!b && B.foe(b, getState()).some(e => foeData(e)?.boss); },
    get state() { return b; },
    start(foes) {
      if (b) return;
      mount(); stopInput?.();
      const s = getState();
      token++; busy = true; mode = 'menu'; pending = null; spend = 0; fast = false;
      const first = B.begin(s, foes, ctx());
      b = first.b;
      document.getElementById('game')?.setAttribute('data-battle', 'true');
      root.hidden = false; build(first.events);
      document.addEventListener('keydown', onKey, true);
      const my = token;
      play(first.events, my).then(() => afterPlay(my));
    },
    cancel() { if (!b) return; finish(); }
  };
}
