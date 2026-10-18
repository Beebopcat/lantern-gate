// Recover the exact uploaded payload of the live deployment (v5, dpl_REDACTED) from Vercel itself.
// The deployment's source is a tgz split into parts (src/.vercel/source.tgz.partN). Download every part, join them in order, extract.
// Read-only against Vercel (GET only). Writes only under the folder given as argv[2].
//   node recover-v5-base.mjs <out folder>
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const OUT = process.argv[2]; if (!OUT) throw Error('usage: node recover-v5-base.mjs <out folder>');
const node = 'C:/Program Files/nodejs/node.exe', cli = 'C:/Users/owner/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js';
const DEP = 'dpl_REDACTED', TEAM = 'team_REDACTED', SCOPE = 'metapod-harden';
if (createHash('sha256').update(fs.readFileSync(cli)).digest('hex') !== '409ad516872ea466b3a3b10c3543902a8c6d7aa6b3140b7c55a0d2a332a992b7') throw Error('CLI drift');
const api = ep => { const r = spawnSync(node, [cli, 'api', ep, '--raw', '--non-interactive', '--scope', SCOPE, '--api', 'https://api.vercel.com'], {maxBuffer: 1 << 30}); if (r.status !== 0) throw Error('api failed ' + ep + ': ' + String(r.stderr).slice(-400)); return r.stdout; };
fs.mkdirSync(OUT, {recursive: true});
const tree = JSON.parse(api(`/v6/deployments/${DEP}/files?teamId=${TEAM}`).toString('utf8'));
const find = (n, p = '') => n.flatMap(x => x.type === 'directory' ? find(x.children || [], p + x.name + '/') : [{path: p + x.name, uid: x.uid}]);
const parts = find(tree).filter(f => /source\.tgz\.part\d+$/.test(f.path)).sort((a, b) => Number(a.path.match(/part(\d+)$/)[1]) - Number(b.path.match(/part(\d+)$/)[1]));
console.log('parts', parts.length, parts.map(p => p.path.split('/').pop()).join(' '));
const tgz = path.join(OUT, 'source.tgz'); fs.writeFileSync(tgz, Buffer.alloc(0));
let total = 0;
for (const p of parts) {
  const body = JSON.parse(api(`/v7/deployments/${DEP}/files/${p.uid}?teamId=${TEAM}`).toString('utf8'));
  const buf = Buffer.from(body.data, 'base64');
  const sha1 = createHash('sha1').update(buf).digest('hex');
  console.log(p.path.split('/').pop(), buf.length, 'bytes, sha1', sha1, sha1 === p.uid ? 'matches uid' : 'DIFFERS from uid (uid may be the stored hash)');
  fs.appendFileSync(tgz, buf); total += buf.length;
}
console.log('joined', total, 'bytes ->', tgz);
const x = spawnSync('tar', ['-xzf', tgz, '-C', OUT], {maxBuffer: 1 << 26});
console.log('tar exit', x.status, String(x.stderr).slice(-300));
process.exit(x.status === 0 ? 0 : 1);
