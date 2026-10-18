# Release v5 preparation (runs on Casey's Windows PC, Python 3.11).
# Copies the live payload (v4 candidate, deployment dpl_REDACTED) into a fresh candidate, overlays every file of the repo's
# game/ folder that differs from the live bytes, writes the exact public manifest, asserts the change set and writes deploy.mjs for this release.
#
#   python prepare-v5.py --list     only compare and write release-changes.json next to the repo (no candidate is created)
#   python prepare-v5.py            build the candidate folder, manifest, preparation.json and deploy.mjs
#
# Nothing is uploaded or promoted here: run `node deploy.mjs stage`, verify the private stage in a browser, write browser-qa.json, then `node deploy.mjs promote`.
import json, hashlib, os, shutil, sys

W = r'C:\AI_Workspace\Creative_Projects\Active\Casey\PC-Project-2026-10-02\work'
REPO = os.environ.get('LG_REPO', W + r'\lantern-gate-repo\lantern-gate')
OLD = W + r'\site-dark-20261006-v4'
HERE = os.environ.get('LG_RELEASE', W + r'\jrpg-v5-20261007-v5')
PREFIX = 'demos/top-secret/lantern-gate/'
BASE = 'dpl_REDACTED'
ROLLBACK_KEPT = 'dpl_REDACTED'
NEVER = {'kokoro-daemon.py'}          # known IndentationError: never ship
# The repo's audio/ files are NOT the live recordings (smaller stand-ins, e.g. battle.mp3 1.4 MB vs 2.9 MB live): never overlay them.
SKIP_DIRS = ('audio/',)
SKIP_SUFFIX = ('.log', '.DS_Store')
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()

prev = {m['path']: m for m in json.load(open(OLD + r'\public-manifest.json'))}
GAME = REPO + r'\game'
files = []
for root, _, names in os.walk(GAME):
    for n in names:
        if n in NEVER or n.endswith(SKIP_SUFFIX): continue
        p = os.path.join(root, n)
        rel = os.path.relpath(p, GAME).replace('\\', '/')
        if rel.startswith(SKIP_DIRS): continue
        files.append((rel, p))
files.sort()
changes = []
for rel, p in files:
    key = PREFIX + rel
    h = sha(p)
    if key not in prev: changes.append({'path': key, 'kind': 'added', 'after': h, 'src': p})
    elif prev[key]['sha256'] != h: changes.append({'path': key, 'kind': 'modified', 'before': prev[key]['sha256'], 'after': h, 'src': p})
assert not any(os.path.basename(c['path']) in NEVER or c['path'].startswith(PREFIX + 'audio/') for c in changes)

summary = {'repo': REPO, 'liveBase': BASE, 'repoGameFiles': len(files), 'changed': [{k: v for k, v in c.items() if k != 'src'} for c in changes]}
if '--list' in sys.argv:
    out = os.path.join(os.path.dirname(REPO), 'release-changes.json')
    open(out, 'w').write(json.dumps(summary, indent=1))
    print(json.dumps({'repoGameFiles': len(files), 'changed': len(changes), 'added': sum(c['kind'] == 'added' for c in changes),
                      'modified': sum(c['kind'] == 'modified' for c in changes), 'out': out}, indent=1))
    sys.exit(0)

STATIC = HERE + r'\candidate\.vercel\output\static'
if not os.path.isdir(HERE + r'\candidate'):
    os.makedirs(HERE, exist_ok=True)
    shutil.copytree(OLD + r'\candidate', HERE + r'\candidate')
for c in changes:
    d = STATIC + '\\' + c['path'].replace('/', '\\')
    os.makedirs(os.path.dirname(d), exist_ok=True)
    tmp = d + '.new'; shutil.copyfile(c['src'], tmp); os.replace(tmp, d)
cur = []
for root, _, names in os.walk(STATIC):
    for n in names:
        p = os.path.join(root, n)
        cur.append({'path': os.path.relpath(p, STATIC).replace('\\', '/'), 'bytes': os.path.getsize(p), 'sha256': sha(p)})
cur.sort(key=lambda m: m['path'])
curmap = {m['path']: m for m in cur}
real = []
for path in sorted(set(curmap) | set(prev)):
    a, b = prev.get(path), curmap.get(path)
    if a is None: real.append({'path': path, 'kind': 'added', 'after': b['sha256']})
    elif b is None: real.append({'path': path, 'kind': 'removed', 'before': a['sha256']})
    elif a['sha256'] != b['sha256']: real.append({'path': path, 'kind': 'modified', 'before': a['sha256'], 'after': b['sha256']})
assert {c['path'] for c in real} == {c['path'] for c in changes}, ('unexpected change set', sorted({c['path'] for c in real} ^ {c['path'] for c in changes})[:20])
assert not any(c['kind'] == 'removed' for c in real), 'a live file would disappear'
mp = HERE + r'\public-manifest.json'
open(mp, 'w', newline='\n').write(json.dumps(cur, indent=1))
prep = {'frozenBaseUnchanged': True, 'base': BASE, 'baseManifestSha256': sha(OLD + r'\public-manifest.json'), 'files': len(cur), 'changes': real,
        'publicManifestSha256': sha(mp), 'rollbackRecorded': ROLLBACK_KEPT}
open(HERE + r'\preparation.json', 'w').write(json.dumps(prep, indent=1))

# deploy.mjs for this release: the v4 script with the new base, rollback and change count (each replacement must hit exactly once)
src = open(OLD + r'\deploy.mjs', encoding='utf-8').read()
for old, new in (("base='dpl_REDACTED',rollbackKept='dpl_REDACTED'", "base='%s',rollbackKept='%s'" % (BASE, ROLLBACK_KEPT)),
                 ("const CHANGES=1;", "const CHANGES=%d;" % len(real)),
                 # v4 required a check in Claude's built-in browser pane. v5 is verified by verify-stage-v5.mjs in the PC's real Google Chrome
                 # (4 viewports, changed bytes compared with the manifest), which sets realBrowser:true. Every other promote condition is unchanged.
                 ("qa.internalBrowser!==true||", "(qa.internalBrowser!==true&&qa.realBrowser!==true)||")):
    assert src.count(old) == 1, old
    src = src.replace(old, new)
open(HERE + r'\deploy.mjs', 'w', encoding='utf-8', newline='\n').write(src)
print(json.dumps({'files': len(cur), 'changes': len(real), 'manifest': prep['publicManifestSha256'], 'release': HERE}, indent=1))
