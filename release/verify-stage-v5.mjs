// Verify the PRIVATE stage of release v5 in a real browser (the PC's installed Google Chrome, driven by playwright-core) and write browser-qa.json
// for `node deploy.mjs promote`. Nothing here changes the site.
//   node verify-stage-v5.mjs <release folder> <share url>
// <share url> is the stage origin with its ?_vercel_share=... parameter (it sets the cookie that lets a browser past Vercel's protection).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';

const [HERE, SHARE] = process.argv.slice(2);
if (!HERE || !SHARE) throw Error('usage: node verify-stage-v5.mjs <release folder> <share url>');
const json = f => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const prep = json('preparation.json'), stage = json('stage-result.json'), manifest = json('public-manifest.json');
const origin = stage.origin, GAME = '/demos/top-secret/lantern-gate/';
const sha = b => createHash('sha256').update(b).digest('hex');
const shotDir = path.join(HERE, 'qa-shots'); fs.mkdirSync(shotDir, {recursive: true});

const browser = await chromium.launch({channel: 'chrome', headless: true});
// let the share link set its cookie once, then reuse the state for every viewport
const first = await browser.newContext(); const p0 = await first.newPage();
const r0 = await p0.goto(SHARE, {waitUntil: 'domcontentloaded', timeout: 120000});
const entry = await p0.goto(origin + GAME + 'index.html', {waitUntil: 'domcontentloaded', timeout: 120000});
if (!entry || entry.status() !== 200) throw Error('stage is not reachable past protection: ' + entry?.status());
const state = await first.storageState(); await first.close();

const INIT = () => {
  window.__audio = {ctx: 0, play: 0, speech: 0};
  for (const n of ['AudioContext', 'webkitAudioContext']) { const AC = window[n]; if (!AC) continue; window[n] = class extends AC { constructor(...a) { super(...a); window.__audio.ctx++; } }; }
  const play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__audio.play++; return play.call(this); };
  if (window.speechSynthesis) { const sp = window.speechSynthesis.speak.bind(window.speechSynthesis); window.speechSynthesis.speak = u => { window.__audio.speech++; return sp(u); }; }
};
const viewports = [], problems = [];
for (const [w, h] of [[1280, 720], [768, 1024], [390, 844], [844, 390]]) {
  const ctx = await browser.newContext({viewport: {width: w, height: h}, storageState: state, serviceWorkers: 'block'});
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message));
  const bad404 = []; page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(origin + GAME)) bad404.push(r.status() + ' ' + r.url().slice(origin.length)); });
  const v = {w, h, checks: {}};
  await page.goto(origin + GAME + 'index.html', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => document.getElementById('world')?.dataset.ready === 'true' && !document.getElementById('starter-menu').hidden, null, {timeout: 180000});
  await page.waitForTimeout(2000);
  const starter = await page.evaluate(() => ({labels: [...document.querySelectorAll('#starter-menu button')].map(b => b.textContent.trim()), clip: [...document.querySelectorAll('#starter-menu button')].some(b => b.scrollWidth > b.clientWidth)}));
  v.checks.starterLabels = JSON.stringify(starter.labels) === '["New Game","Load Game","Settings"]' && !starter.clip;
  await page.screenshot({path: path.join(shotDir, `title-${w}x${h}.png`)});
  await page.click('#starter-menu [data-starter=new]'); await page.waitForSelector('#creation-form'); await page.waitForTimeout(1500);
  const create = await page.evaluate(() => ({genders: [...document.querySelectorAll('#character-gender option')].map(o => o.textContent), callings: document.querySelectorAll('.calling-card').length, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, preview: !!document.querySelector('#creation-form canvas, .creation-stage canvas')}));
  v.checks.creation = JSON.stringify(create.genders) === '["Female","Male"]' && create.callings === 4 && !create.hscroll && create.preview;
  await page.screenshot({path: path.join(shotDir, `create-${w}x${h}.png`)});
  const audio = await page.evaluate(() => window.__audio);
  v.checks.silent = audio.play === 0 && audio.speech === 0;
  v.checks.noErrors = errors.length === 0; v.checks.noMissingFiles = bad404.length === 0;
  v.errors = errors.slice(0, 5); v.missing = bad404.slice(0, 5);
  v.ok = Object.values(v.checks).every(Boolean); if (!v.ok) problems.push(`${w}x${h}: ` + JSON.stringify(v.checks));
  viewports.push(v); await ctx.close();
}

// every changed file is served with exactly the prepared bytes, and a sample of untouched live files (audio included) is unchanged
const ctx2 = await browser.newContext({storageState: state}); const page2 = await ctx2.newPage();
await page2.goto(origin + GAME + 'index.html', {waitUntil: 'domcontentloaded'});
const served = [], wrong = [];
const fetchHash = async p => page2.evaluate(async p => { const r = await fetch(p, {cache: 'no-store'}); if (!r.ok) return 'HTTP ' + r.status; const b = await r.arrayBuffer(); const d = await crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); }, '/' + p);
for (const c of prep.changes) { const h = await fetchHash(c.path); if (h === c.after) served.push(c.path); else wrong.push(c.path + ' ' + h); }
const unchanged = manifest.filter(m => m.path.startsWith(GAME.slice(1) + 'audio/') || /^(index\.html|styles\.css)$/.test(m.path)).slice(0, 6);
const sampleBad = []; for (const m of unchanged) { const h = await fetchHash(m.path); if (h !== m.sha256) sampleBad.push(m.path + ' ' + h); }
await browser.close();

const passed = problems.length === 0 && wrong.length === 0 && sampleBad.length === 0 && served.length === prep.changes.length;
const qa = {passed, utc: new Date().toISOString(), deploymentId: stage.deploymentId, origin, publicManifestSha256: prep.publicManifestSha256,
  browser: 'Google Chrome (installed on the PC), headless, driven by playwright-core', realBrowser: true, internalBrowser: false, silent: viewports.every(v => v.checks.silent),
  viewports, changedServedFiles: served, wrongBytes: wrong, untouchedSampleChecked: unchanged.map(m => m.path), untouchedSampleBad: sampleBad, problems};
fs.writeFileSync(path.join(HERE, 'browser-qa.json'), JSON.stringify(qa, null, 2), {encoding: 'utf8', flag: 'wx'});
console.log(JSON.stringify({passed, viewports: viewports.map(v => [v.w + 'x' + v.h, v.ok]), served: served.length + '/' + prep.changes.length, wrong, sampleBad, problems}, null, 1));
process.exit(passed ? 0 : 1);
