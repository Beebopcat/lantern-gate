
// Fresh bounded deploy script for the dark no-white-gaps site stylesheet release. One stage attempt, one promote attempt, no retries.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const HERE=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1'));
const node='C:/Program Files/nodejs/node.exe',cli='C:/Users/owner/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js';
const candidate=path.join(HERE,'candidate'),project='prj_REDACTED',team='team_REDACTED',scope='metapod-harden';
const base='dpl_REDACTED',rollbackKept='dpl_REDACTED',domains=['caseyshingledecker.com','www.caseyshingledecker.com'];
const CHANGES=80;
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=async f=>JSON.parse(await fs.readFile(path.join(HERE,f),'utf8'));
const record=async(f,v)=>fs.writeFile(path.join(HERE,f),JSON.stringify(v,null,2),{flag:'wx'});
const phase=process.argv[2];if(!['stage','promote'].includes(phase))throw Error('Exact phase required');
const processes=[];
async function run(args,label,timeout=240000){
 if(hash(await fs.readFile(cli))!=='409ad516872ea466b3a3b10c3543902a8c6d7aa6b3140b7c55a0d2a332a992b7')throw Error('CLI drift');
 const argv=[cli,...args,'--api','https://api.vercel.com'];
 const child=spawn(node,argv,{cwd:candidate,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const row={pid:child.pid,label,argv,startedUtc:new Date().toISOString(),directChildReaped:false};processes.push(row);
 let out=[],err=[],bytes=0;const timer=setTimeout(()=>child.kill(),timeout);
 child.stdout.on('data',b=>{bytes+=b.length;if(bytes>16*1024*1024)child.kill();else out.push(b);});
 child.stderr.on('data',b=>{bytes+=b.length;if(bytes>16*1024*1024)child.kill();else err.push(b);});
 const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});clearTimeout(timer);
 Object.assign(row,status,{directChildReaped:true,closedUtc:new Date().toISOString()});
 const stdout=Buffer.concat(out),stderr=Buffer.concat(err);Object.assign(row,{stdoutSha256:hash(stdout),stderrSha256:hash(stderr)});
 if(status.code!==0)throw Error(label+' failed; no automatic retry: '+stderr.toString('utf8').slice(-1500));
 return {stdout,stderr};
}
async function api(endpoint){const r=await run(['api',endpoint,'--raw','--non-interactive','--scope',scope],'GET '+endpoint);return JSON.parse(r.stdout.toString('utf8'));}
async function boundary(expected){
 const p=await api('/v9/projects/'+project+'?teamId='+team);
 if(p.id!==project||p.accountId!==team||p.ssoProtection?.deploymentType!=='all_except_custom_domains')throw Error('Project/protection boundary drift');
 const a=await api('/v4/aliases?projectId='+project+'&limit=100&teamId='+team);
 const selected=domains.map(domain=>a.aliases.find(x=>x.alias===domain));
 if(selected.some(x=>!x||x.projectId!==project||(x.deployment?.id||x.deploymentId)!==expected))throw Error('Custom domain boundary drift');
 const d=await api('/v13/deployments/'+expected+'?teamId='+team);
 if(d.readyState!=='READY'||d.projectId!==project||d.ownerId!==team)throw Error('Ready deployment boundary drift');
 return {projectId:project,ownerId:team,protection:p.ssoProtection.deploymentType,aliases:selected.map(x=>({alias:x.alias,deploymentId:x.deployment?.id||x.deploymentId})),deploymentId:expected,readyState:d.readyState,origin:'https://'+d.url};
}
const attemptFile=phase+'-attempt.json';await record(attemptFile,{oneAttempt:true,phase,utc:new Date().toISOString()});
try{
 const prep=await json('preparation.json');
 if(!prep.frozenBaseUnchanged||prep.base!==base||prep.changes.length!==CHANGES)throw Error('Candidate contract differs');
 if(hash(await fs.readFile(path.join(HERE,'public-manifest.json')))!==prep.publicManifestSha256)throw Error('Manifest drift');
 const manifest=await json('public-manifest.json');
 if(manifest.length!==prep.files)throw Error('Manifest size drift');
 for(const f of manifest){const b=await fs.readFile(path.join(candidate,'.vercel/output/static',f.path));if(b.length!==f.bytes||hash(b)!==f.sha256)throw Error('Public bytes changed: '+f.path);}
 const before=await boundary(base);
 if(phase==='stage'){
  const r=await run(['deploy','--prebuilt','--prod','--skip-domain','--archive=tgz','--yes','--scope',scope],'One staged upload',1800000);
  await fs.writeFile(path.join(HERE,'stage-stdout.log'),r.stdout,{flag:'wx'});await fs.writeFile(path.join(HERE,'stage-stderr.log'),r.stderr,{flag:'wx'});
  const origins=[...new Set((r.stdout.toString('utf8')+'\n'+r.stderr.toString('utf8')).match(/https:\/\/casey-site-[a-z0-9]+-metapod-harden\.vercel\.app/g)||[])];
  if(origins.length!==1)throw Error('Ambiguous stage origin');
  const d=await api('/v13/deployments/'+new URL(origins[0]).hostname+'?teamId='+team);
  if(d.readyState!=='READY'||d.projectId!==project||d.ownerId!==team||d.id===base)throw Error('Stage identity not ready');
  const after=await boundary(base);
  await record('stage-result.json',{passed:true,utc:new Date().toISOString(),deploymentId:d.id,origin:origins[0],publicManifestSha256:prep.publicManifestSha256,files:prep.files,before,after,processes,promoted:false});
  console.log(JSON.stringify({passed:true,deploymentId:d.id,origin:origins[0]}));
 }else{
  const stage=await json('stage-result.json'),qa=await json('browser-qa.json');
  if(!stage.passed||!qa.passed||qa.deploymentId!==stage.deploymentId||qa.publicManifestSha256!==prep.publicManifestSha256||qa.viewports.length<3||qa.changedServedFiles.length!==CHANGES||(qa.internalBrowser!==true&&qa.realBrowser!==true)||qa.silent!==true)throw Error('Actual exact internal-browser verification required');
  const d=await api('/v13/deployments/'+stage.deploymentId+'?teamId='+team);
  if(d.readyState!=='READY'||d.projectId!==project||d.ownerId!==team)throw Error('New candidate not ready');
  await run(['promote',stage.origin,'--yes','--scope',scope],'One exact promotion');
  const after=await boundary(stage.deploymentId);
  await record('promotion-result.json',{passed:true,utc:new Date().toISOString(),deploymentId:stage.deploymentId,origin:stage.origin,publicManifestSha256:prep.publicManifestSha256,before,after,rollback:base,rollbackKept,processes});
  console.log(JSON.stringify({passed:true,deploymentId:stage.deploymentId,origin:stage.origin}));
 }
}catch(e){await record(phase+'-failure.json',{utc:new Date().toISOString(),error:e.message,processes,noAutomaticRetry:true});throw e;}
