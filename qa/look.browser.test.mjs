// Creation screen look options in a real browser: the new rows, the hairstyle list following the body, the live preview, the saved fields
// and the layout at four viewports.   BASE=http://127.0.0.1:8099/demos/top-secret/lantern-gate/ node qa/look.browser.test.mjs [shots/look]
import {launch, newPage, open, snapshot, audioCounts, ok, summary, BASE} from './lib.mjs';
const shotPrefix = process.argv[2] || null;
const b = await launch();
const VIEWS = [[1280, 720], [768, 1024], [390, 844], [844, 390], [820, 1180]];   // 820x1180 is the narrow-tablet case (form column about 430px)
const preview = page => page.evaluate(() => {const cv = document.getElementById('creation-portrait'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 4 * 7) h = (Math.imul(h, 31) + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3]) | 0; return h;});
const options = (page, id) => page.evaluate(id => [...document.querySelectorAll('#' + id + ' option')].map(o => o.value), id);
const geometry = page => page.evaluate(() => {
  const el = document.documentElement, rows = [...document.querySelectorAll('#creation-form .jr-option:not([hidden])')];
  const small = [...document.querySelectorAll('#creation-form .jr-step, #creation-form select')].filter(e => e.offsetParent && (e.getBoundingClientRect().width < 43.5 || e.getBoundingClientRect().height < 43.5)).map(e => e.id || e.className);
  const narrow = [...document.querySelectorAll('#creation-form .jr-option:not([hidden]) select')].filter(e => e.getBoundingClientRect().width < 90).map(e => e.id + ':' + Math.round(e.getBoundingClientRect().width));
  return {hscroll: el.scrollWidth > el.clientWidth, rows: rows.length, small, narrow, clipped: rows.filter(r => r.scrollWidth > r.clientWidth + 1).length};
});

for (const [w, h] of VIEWS) {
  const tag = `${w}x${h}`, page = await newPage(b, {w, h});
  await open(page); await page.waitForTimeout(1500);
  await page.click('#starter-menu [data-starter=new]'); await page.waitForSelector('#creation-form'); await page.waitForTimeout(1200);
  // the rows
  for (const id of ['character-gender', 'character-hairstyle', 'character-hair', 'character-skin', 'character-eyes', 'character-face', 'character-outfit']) ok(await page.locator('#' + id).count() === 1, `${tag}: row #${id} exists`);
  ok((await options(page, 'character-gender')).join() === 'female,male', `${tag}: only Female and Male are offered`);
  const female = await options(page, 'character-hairstyle');
  ok(female.length >= 8 && female.includes('crown') && !female.includes('topknot'), `${tag}: female hairstyles (${female.join()})`);
  ok((await options(page, 'character-hair')).length >= 10, `${tag}: ten hair colours`);
  ok((await options(page, 'character-eyes')).length >= 7, `${tag}: seven eye colours`);
  ok((await options(page, 'character-face')).join() === 'none,freckles,scar,mark', `${tag}: face marks`);
  ok(await page.locator('#headwear-row').isHidden(), `${tag}: no headwear row for a warrior`);
  const g = await geometry(page);
  ok(!g.hscroll && g.small.length === 0 && g.clipped === 0 && g.narrow.length === 0, `${tag}: no sideways scroll, touch targets 44px, rows not clipped, values readable (select at least 90px) ${JSON.stringify(g)}`);
  // the preview follows every hairstyle
  const seen = new Set();
  for (let i = 0; i < female.length; i++) {await page.selectOption('#character-hairstyle', female[i]); await page.waitForTimeout(250); seen.add(await preview(page));}
  ok(seen.size === female.length, `${tag}: the preview changes for each of ${female.length} female hairstyles (${seen.size} different)`);
  // body change swaps the list and keeps the position
  await page.selectOption('#character-hairstyle', female[5]);
  await page.selectOption('#character-gender', 'male'); await page.waitForTimeout(250);
  const male = await options(page, 'character-hairstyle');
  ok(male.includes('topknot') && male.includes('mane') && !male.includes('crown') && male.length >= 8, `${tag}: male hairstyles (${male.join()})`);
  ok(await page.inputValue('#character-hairstyle') === male[5], `${tag}: same position kept when the body changes`);
  // stepping buttons reach every style
  await page.selectOption('#character-hairstyle', male[0]);
  const stepped = []; for (let i = 0; i < male.length; i++) {stepped.push(await page.inputValue('#character-hairstyle')); await page.click('[data-for=character-hairstyle][data-step="1"]');}
  ok(stepped.join() === male.join(), `${tag}: the arrows walk through every hairstyle`);
  await page.selectOption('#character-gender', 'female'); await page.waitForTimeout(150);
  // eyes, face and hair colour change the picture
  const base = await preview(page); const diffs = [];
  for (const [id, v] of [['character-eyes', 'violet'], ['character-face', 'scar'], ['character-hair', 'teal']]) {await page.selectOption('#' + id, v); await page.waitForTimeout(200); diffs.push(await preview(page));}
  ok(new Set([base, ...diffs]).size === 4, `${tag}: eyes, face and hair colour each change the preview`);
  // headwear appears for Mage and Ranger and not for the others
  await page.click('.calling-card[data-id=mage]'); await page.waitForTimeout(250);
  ok(await page.locator('#headwear-row').isVisible(), `${tag}: Headwear row shows for a mage`);
  const worn = await preview(page); await page.selectOption('#character-headwear', 'bare'); await page.waitForTimeout(250);
  ok(await preview(page) !== worn, `${tag}: a bare head changes the mage preview`);
  const g2 = await geometry(page); ok(!g2.hscroll && g2.small.length === 0 && g2.clipped === 0 && g2.narrow.length === 0, `${tag}: layout holds with the Headwear row ${JSON.stringify(g2)}`);
  await page.click('.calling-card[data-id=summoner]'); await page.waitForTimeout(200);
  ok(await page.locator('#headwear-row').isHidden(), `${tag}: Headwear row hides for a summoner`);
  if (shotPrefix) {await page.click('.calling-card[data-id=mage]'); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300); await page.screenshot({path: `${shotPrefix}-${tag}.png`});}
  ok(page.errors.length === 0, `${tag}: no console errors ${page.errors.slice(0, 2)}`);
  const audio = await audioCounts(page); ok(audio.play === 0 && audio.speech === 0, `${tag}: still silent`);
  await page.ctx.close();
}

// create a character with every choice, save, reload
{
  const page = await newPage(b, {w: 1280, h: 720});
  await open(page); await page.click('#starter-menu [data-starter=new]'); await page.waitForSelector('#creation-form');
  await page.fill('#character-name', 'Isolde');
  await page.selectOption('#character-gender', 'female'); await page.selectOption('#character-hairstyle', 'twintails'); await page.selectOption('#character-hair', 'rose');
  await page.selectOption('#character-eyes', 'teal'); await page.selectOption('#character-face', 'freckles');
  await page.click('.calling-card[data-id=mage]'); await page.selectOption('#character-headwear', 'bare');
  await page.click('[data-action=create-character]');
  await page.waitForFunction(() => document.getElementById('game').dataset.arriving === 'false', null, {timeout: 30000});
  const snap = await snapshot(page);
  const p = snap?.player || {};
  ok(p.hairStyle === 'twintails' && p.hair === 'rose' && p.eyes === 'teal' && p.face === 'freckles' && p.headwear === 'bare' && p.gender === 'female' && p.classId === 'mage', `the chosen look is in the save ${JSON.stringify({s: p.hairStyle, h: p.hair, e: p.eyes, f: p.face, w: p.headwear})}`);
  const plate = await page.evaluate(() => {const c = document.getElementById('hud-portrait'); return c ? c.dataset.portrait : null;});
  ok(plate === 'bust', 'the HUD plate shows the hero bust');
  ok(page.errors.length === 0, 'creating with every option raises no console errors ' + page.errors.slice(0, 2));
  // continue from the save in a fresh page
  const page2 = await newPage(b, {w: 1280, h: 720});
  const store = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await page2.goto(BASE + 'narrator-b-expected.js'); await page2.evaluate(s => {for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);}, store);
  await open(page2); await page2.click('#starter-menu [data-starter=load]');
  await page2.waitForFunction(() => document.getElementById('game').dataset.arriving === 'false', null, {timeout: 30000});
  const again = await snapshot(page2);
  ok(again?.player?.hairStyle === 'twintails' && again?.player?.eyes === 'teal', 'the look survives Load Game');
  ok(page2.errors.length === 0, 'loading raises no console errors ' + page2.errors.slice(0, 2));
  await page2.ctx.close(); await page.ctx.close();
}
await b.close();
process.exit(summary() ? 1 : 0);
