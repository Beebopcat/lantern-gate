// CPU cost of the sprite path in a live town: time spent in SpriteActors.update and sheet creation per frame.
import {launch, newPage, open, seed, enterViaLoad, BASE} from './lib.mjs';
const b = await launch();
const page = await newPage(b, {w: 1280, h: 720});
await seed(page, {classId: 'summoner', companionId: 'moss-golem', mutate: `s.player.x=95.5;s.player.y=285.5;s.clock=640;const near=[[98,284],[92,286],[97,288],[93,283],[99,287],[91,289],[96,282],[100,285]];s.actors.filter(n=>n.town==='hearth').slice(0,8).forEach((n,i)=>{n.x=near[i][0]+.5;n.y=near[i][1]+.5;});`});
await open(page);
// patch before entering the world so sheet creation at arrival is measured too
await page.evaluate(async base => {
  const SA = await import(base + 'sprite-actors.js'), R = await import(base + 'render.js');
  const P = SA.SpriteActors.prototype, D = R.Renderer.prototype, st = window.__sp = {update: 0, updates: 0, create: 0, creates: 0, draw: 0, draws: 0, worst: 0};
  const u = P.update; P.update = function (...a) {const t = performance.now(); const r = u.apply(this, a); st.update += performance.now() - t; st.updates++; return r;};
  const c = P.create; P.create = function (...a) {const t = performance.now(); const r = c.apply(this, a); const d = performance.now() - t; st.create += d; st.creates++; st.worst = Math.max(st.worst, d); return r;};
  const dr = D.draw; D.draw = function (...a) {const t = performance.now(); const r = dr.apply(this, a); st.draw += performance.now() - t; st.draws++; return r;};
}, new URL(BASE, 'http://x').pathname);
await enterViaLoad(page); await page.waitForTimeout(8000);
const r = await page.evaluate(() => ({...window.__sp, sprites: document.getElementById('world').dataset.sprites}));
console.log(JSON.stringify({sprites: r.sprites, updatesPerDraw: (r.updates / r.draws).toFixed(1), msPerUpdate: (r.update / r.updates).toFixed(3), spriteMsPerFrame: (r.update / r.draws).toFixed(2), sheetsCreated: r.creates, msPerCreate: (r.create / Math.max(1, r.creates)).toFixed(1), worstCreate: r.worst.toFixed(1), drawMsPerFrame: (r.draw / r.draws).toFixed(1), errors: page.errors}));
await b.close();
