// Music class behaviour with a stand-in Audio element (Node, no browser): the victory fanfare, music off / volume 0 / dispose, and the Next track button.
//   ROOT=$PWD/game/ node qa/stinger.test.mjs
const ROOT = (process.env.ROOT || new URL('../game/', import.meta.url).pathname).replace(/\/?$/, '/');
let pass = 0, fail = 0; const ok = (c, m) => {if (c) pass++; else {fail++; console.log('  FAIL', m);}};
const made = [];
class FakeAudio {
  constructor(src) {this.src = src; this.volume = 1; this.paused = true; this.ls = {}; this.dataset = {}; this.loop = false; made.push(this);}
  addEventListener(ev, fn, o) {(this.ls[ev] ||= []).push([fn, o?.once]);}
  emit(ev) {for (const [fn, once] of this.ls[ev] || []) fn(); this.ls[ev] = (this.ls[ev] || []).filter(([, once]) => !once);}
  async play() {this.paused = false;}
  pause() {if (!this.paused) {this.paused = true; this.emit('pause');}}
  remove() {}
}
globalThis.Audio = FakeAudio;
globalThis.document = {body: {append() {}}, hidden: false};
const {Music} = await import(ROOT + 'audio.js'), SG = await import(ROOT + 'soundtrack.js'), E = await import(ROOT + 'engine.js'), J = await import(ROOT + 'journey.js'), L = await import(ROOT + 'life.js');
const fanfares = () => made.filter(a => /lantern-raised/.test(a.src));
const music = async (volume = .3) => {const m = new Music(); m.volume = volume; await m.enable(true); return m;};
const quiet = m => {clearInterval(m.timer); m.timer = null;};

{ // plays over the score and ducks it
  const m = await music(); made.length = 0;
  ok(await m.stinger('victory') === true, 'fanfare starts while music is on');
  const [f] = fanfares(); ok(f && !f.paused && Math.abs(f.volume - .27) < 1e-9, 'fanfare volume follows the Music volume setting (' + f?.volume + ')');
  ok(m.ducked === true, 'the score is ducked under the fanfare');
  f.emit('ended'); ok(m.ducked === false && m.fanfare === null, 'the score returns when the fanfare ends');
  quiet(m);
}
{ // music off stops it at once
  const m = await music(); made.length = 0; await m.stinger('victory'); const [f] = fanfares();
  await m.enable(false);
  ok(f.paused === true && m.ducked === false && m.fanfare === null, 'turning music off silences the fanfare and releases the duck');
}
{ // page hide / dispose
  const m = await music(); made.length = 0; await m.stinger('victory'); const [f] = fanfares();
  m.dispose(); ok(f.paused === true && m.ducked === false, 'dispose silences the fanfare');
}
{ // the browser pausing the element releases the duck
  const m = await music(); made.length = 0; await m.stinger('victory'); const [f] = fanfares();
  f.pause(); ok(m.ducked === false, 'a paused fanfare no longer holds the score down'); quiet(m);
}
{ // volume 0 is a mute
  const m = await music(0); made.length = 0;
  ok(await m.stinger('victory') === false && fanfares().length === 0, 'no fanfare at all when the Music volume is 0'); quiet(m);
}
{ // slider dragged to 0 during a fanfare
  const m = await music(); made.length = 0; await m.stinger('victory'); const [f] = fanfares();
  const s = E.fresh(1); L.upgrade(s); J.upgrade(s); s.settings.volume = 0; m.update(s);
  ok(f.paused === true && m.ducked === false, 'dragging the volume to 0 cuts the fanfare'); quiet(m);
}
{ // music never started: silent
  const m = new Music(); made.length = 0; ok(await m.stinger('victory') === false && made.length === 0, 'no fanfare unless music is on');
}
{ // a second fanfare replaces the first and keeps the duck until it ends
  const m = await music(); made.length = 0; await m.stinger('victory'); await m.stinger('victory'); const [a, b] = fanfares();
  ok(a.paused === true && b.paused === false && m.ducked === true, 'a new fanfare replaces the old one and keeps the score ducked');
  b.emit('ended'); ok(m.ducked === false, 'the score returns after the last fanfare'); quiet(m);
}
{ // Next track in modes that have one track
  for (const [mode, id] of [['shop', 'open-for-trade'], ['inn', 'a-bed-for-the-night'], ['boss', 'the-hollow-warden']]) {
    const m = await music(); quiet(m); m.timer = 1; m.mode = mode; m.track = SG.trackById(id); m.lastSwitch = 0;
    const before = m.track.id; const moved = await m.skip();
    ok(moved === true && m.track.id !== before, `Next track changes the music in ${mode} (${before} -> ${m.track.id})`);
    m.timer = null;
  }
  const m = await music(); quiet(m); m.timer = 1; m.mode = 'town'; m.track = SG.trackById(SG.TRACKS.find(t => t.mode === 'town').id); const moved = await m.skip();
  ok(moved === true, 'Next track still works in a mode with several tracks'); m.timer = null;
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
