// After `node deploy.mjs promote`: hash-check the LIVE site (https://caseyshingledecker.com) against the v6 manifest and write live-verification.json.
// Read-only: it only downloads public files.   node verify-live-v6.mjs <release folder>
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const HERE = process.argv[2]; if (!HERE) throw Error('usage: node verify-live-v6.mjs <release folder>');
const json = f => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const prep = json('preparation.json'), manifest = json('public-manifest.json'), promo = json('promotion-result.json');
const sha = b => createHash('sha256').update(b).digest('hex');
const get = async p => { const r = await fetch('https://caseyshingledecker.com/' + p, {headers: {'cache-control': 'no-cache'}}); if (!r.ok) return 'HTTP ' + r.status; return sha(Buffer.from(await r.arrayBuffer())); };
const changed = [], wrong = [];
for (const c of prep.changes) { const h = await get(c.path); (h === c.after ? changed : wrong).push(c.path + (h === c.after ? '' : ' ' + h)); }
// a spread of untouched files (audio, atlases, site root) must still be the previous bytes
const pick = manifest.filter(m => !prep.changes.some(c => c.path === m.path) && (m.path.includes('/audio/') || m.path.includes('/assets/') || /^(index\.html|app\.js|styles\.css)$/.test(m.path)));
const sample = pick.filter((_, i) => i % Math.max(1, Math.floor(pick.length / 40)) === 0).slice(0, 40), sampleBad = [];
for (const m of sample) { const h = await get(m.path); if (h !== m.sha256) sampleBad.push(m.path + ' ' + h); }
const out = {passed: wrong.length === 0 && sampleBad.length === 0 && changed.length === prep.changes.length, utc: new Date().toISOString(), deploymentId: promo.deploymentId,
  changedFilesMatchingManifest: changed.length, changedFilesExpected: prep.changes.length, wrong, untouchedSampleChecked: sample.length, untouchedSampleBad: sampleBad};
fs.writeFileSync(path.join(HERE, 'live-verification.json'), JSON.stringify(out, null, 2), {encoding: 'utf8', flag: 'wx'});
console.log(JSON.stringify(out, null, 1));
process.exit(out.passed ? 0 : 1);
