# Site-only release: dark "no white gaps" stylesheet. Copies the live payload (v3b) into an independent candidate, replaces styles.css,
# writes the exact public manifest and asserts that styles.css is the only change.
import json,hashlib,os,shutil,sys,re
W=r'C:\AI_Workspace\Creative_Projects\Active\Casey\PC-Project-2026-10-02\work'
HERE=W+r'\site-dark-20261006-v4'
STATIC=HERE+r'\candidate\.vercel\output\static'
OLD=W+r'\jrpg-music-20261005-v3b'
SRC=HERE+r'\src'
PREV=json.load(open(OLD+r'\public-manifest.json'))
prev={m['path']:m for m in PREV}
CHANGED=['styles.css']
sha=lambda p:hashlib.sha256(open(p,'rb').read()).hexdigest()
if not os.path.isdir(HERE+r'\candidate'):
    shutil.copytree(OLD+r'\candidate',HERE+r'\candidate')
for f in CHANGED:
    s=SRC+'\\'+f.replace('/','\\');d=STATIC+'\\'+f.replace('/','\\');tmp=d+'.new';shutil.copyfile(s,tmp);os.replace(tmp,d)
cur=[]
for root,_,files in os.walk(STATIC):
    for f in files:
        p=os.path.join(root,f);rel=os.path.relpath(p,STATIC).replace('\\','/')
        cur.append({'path':rel,'bytes':os.path.getsize(p),'sha256':sha(p)})
cur.sort(key=lambda m:m['path'])
curmap={m['path']:m for m in cur}
changes=[]
for path in sorted(set(curmap)|set(prev)):
    a,b=prev.get(path),curmap.get(path)
    if a is None: changes.append({'path':path,'kind':'added','after':b['sha256']})
    elif b is None: changes.append({'path':path,'kind':'removed','before':a['sha256']})
    elif a['sha256']!=b['sha256']: changes.append({'path':path,'kind':'modified','before':a['sha256'],'after':b['sha256']})
assert {c['path'] for c in changes}==set(CHANGED), ('unexpected change set',[c['path'] for c in changes])
mp=HERE+r'\public-manifest.json'
open(mp,'w',newline='\n').write(json.dumps(cur,indent=1))
prep={'frozenBaseUnchanged':True,'base':'dpl_REDACTED','baseManifestSha256':sha(OLD+r'\public-manifest.json'),'files':len(cur),'changes':changes,'publicManifestSha256':sha(mp),'rollbackRecorded':'dpl_REDACTED'}
open(HERE+r'\preparation.json','w').write(json.dumps(prep,indent=1))
print(json.dumps({'files':len(cur),'changes':[(c['kind'],c['path']) for c in changes],'manifest':prep['publicManifestSha256']},indent=1))
