// Local acceptance runner. No model calls, credential writes, UI login automation, or deployment.
import {spawn, execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {createWriteStream, existsSync} from 'node:fs';
import {mkdir, readFile, writeFile, rename, readdir, cp, symlink, rm, stat} from 'node:fs/promises';
import {resolve, join, dirname, relative, sep, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {quotaDecision, observeAccount, validateBrowserProof, acceptanceStatus, browserChecks} from './core.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const runs = join(root, 'data', 'acceptance');
const directories = ['src', 'shared', 'server', 'test'];
const files = ['package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'tools/validate-content.js', 'tools/smoke-lan.js',
  'tools/acceptance/core.mjs', 'tools/acceptance/run.mjs'];
const focusedTests = ['test/diagnostics-ui.test.js', 'test/stutter-capture.test.js', 'test/performance-report.test.js',
  'test/menu-layouts.test.js', 'test/ui-flow.test.js', 'test/flight-controller.test.js', 'test/acceptance.test.js'];
const argv = process.argv.slice(2), action = argv.shift() || 'help';
const options = {};
while (argv.length) {
  const key = argv.shift();
  if (!key.startsWith('--')) throw new Error('Expected an option, received: ' + key);
  options[key.slice(2)] = argv[0]?.startsWith('--') || !argv.length ? true : argv.shift();
}
const now = () => new Date().toISOString();
const inside = (base, target) => {const r = relative(base, target); return r === '' || (!r.startsWith('..' + sep) && r !== '..' && !isAbsolute(r));};
async function json(path) {return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));}
async function atomic(path, value) {await mkdir(dirname(path), {recursive:true}); const temp=path+'.'+randomUUID()+'.tmp'; await writeFile(temp, JSON.stringify(value,null,2)); await rename(temp,path);}
function git(args) {return execFileSync('git', args, {cwd:root, windowsHide:true, encoding:'utf8'}).trim();}
async function listFiles(base, name = '') {
  const result = [];
  for (const entry of await readdir(join(base,name), {withFileTypes:true})) {
    const child = join(name, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(base, child));
    else if (entry.isFile()) result.push(child);
    else throw new Error('Unexpected link in copied source: '+child);
  }
  return result.sort();
}
async function sourceManifest(base) {
  const names = [...files, 'public/content/catalog.json'];
  for (const dir of directories) for (const f of await listFiles(join(base,dir))) names.push(join(dir,f));
  const entries = [];
  for (const name of names.sort()) {
    const data = await readFile(join(base,name));
    entries.push({path:name.split(sep).join('/'), bytes:data.length, sha256:createHash('sha256').update(data).digest('hex')});
  }
  return {digest:createHash('sha256').update(JSON.stringify(entries)).digest('hex'), files:entries};
}
async function makeSnapshot(dir) {
  const workspace=join(dir,'workspace'); await mkdir(workspace,{recursive:true});
  for(const name of directories) await cp(join(root,name),join(workspace,name),{recursive:true, errorOnExist:true});
  for(const name of files) {await mkdir(dirname(join(workspace,name)),{recursive:true});await cp(join(root,name),join(workspace,name));}
  // Borrow installed dependencies; do not install or modify them. Copy catalog metadata,
  // share existing generated assets through directory junctions (read-only use by this runner).
  await symlink(join(root,'node_modules'), join(workspace,'node_modules'),'junction');
  for(const entry of await readdir(join(root,'public'),{withFileTypes:true})) {
    const source=join(root,'public',entry.name),target=join(workspace,'public',entry.name);
    await mkdir(dirname(target),{recursive:true});
    if(entry.name==='content') {
      await mkdir(target,{recursive:true});
      for(const child of await readdir(source,{withFileTypes:true})) {
        if(child.isDirectory()) await symlink(join(source,child.name),join(target,child.name),'junction');
        else if(child.isFile()) await cp(join(source,child.name),join(target,child.name));
      }
    } else if(entry.isDirectory()) await symlink(source,target,'junction');
    else if(entry.isFile()) await cp(source,target);
  }
  return workspace;
}
async function runProcess(args, {cwd, log, env={}, timeout=120_000}={}) {
  const output=createWriteStream(log,{flags:'w'}), start=Date.now();
  const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});
  const timer=setTimeout(()=>child.kill(),timeout);
  return await new Promise((resolveResult,reject)=>{
    child.on('error',error=>{clearTimeout(timer);output.end();reject(error);});
    child.on('close',(code,signal)=>{clearTimeout(timer);output.end(()=>resolveResult({status:code===0?'passed':'failed',exitCode:code,signal,seconds:(Date.now()-start)/1000,log}));});
  });
}
async function quota(state) {
  let snapshot;
  try {
    if(options['quota-file']) snapshot=await json(resolve(options['quota-file']));
    else {
      const probe=join(state.recoveryDir,'quota_probe.py');
      const output=execFileSync(state.python,[probe],{timeout:25_000,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']});
      snapshot=JSON.parse(output);
    }
  } catch {snapshot=null;}
  const decision=quotaDecision(snapshot,state.threshold);
  state.quota=decision;
  if(snapshot && decision.status!=='quota_unknown') observeAccount(state,snapshot.accountKey);
  return decision;
}
async function save(state,dir) {
  state.updatedAt=now();
  await atomic(join(dir,'checkpoint.json'),state);
  const lines=[`# Acceptance: ${state.status}`, '', `Run: ${state.runId}`, `Source snapshot: ${state.sourceDigest}`,
    `Project branch at capture: ${state.branch}`, `Original HEAD: ${state.head}`, '',
    '| Check | Status | Evidence |','| --- | --- | --- |',
    ...Object.entries(state.checks).map(([name,row])=>`| ${name} | ${row.status} | ${row.log||row.reason||''} |`),
    ...browserChecks.map(name=>{const r=state.browser?.checks.find(c=>c.name===name);return `| ${name} | ${r?.status||'not_run'} | ${r?.evidence||'Awaiting supported Chrome verification'} |`;}),
    '', 'Local isolated acceptance only. Oracle and production data are unchanged.',
    'This report does not certify UHD 620 performance or the full game.', '',
    `Next: ${state.nextAction||'none'}`, '',
    `Resume: node tools/acceptance/run.mjs resume --run ${state.runId} --serve`,
    `Browser proof: node tools/acceptance/run.mjs accept --run ${state.runId} --evidence <proof.json>`];
  await writeFile(join(dir,'REPORT.md'),lines.join('\n'));
  await writeFile(join(dir,'CONTINUE.md'),[
    '# Continue this acceptance task', '', `Task: ${state.task}`, `Run: ${state.runId}`, `Status: ${state.status}`,
    `Desktop chat: ${state.threadId||'not specified'}`, `Next action: ${state.nextAction||'none'}`, '',
    'Read checkpoint.json and REPORT.md. Resume the existing run; do not create a duplicate or rerun completed phases.',
    'After account change, read fresh quota and revalidate Chrome through the supported browser tool.',
    'After native-host recovery, the browser ID can change. Rediscover the same Chrome extension/profile, then bind the known tab again.',
    'Do not enter credentials or send continue to another chat automatically. Do not restart the desktop application from an active task.', '',
    `cd ${root}`, `node tools/acceptance/run.mjs resume --run ${state.runId} --serve`,
  ].join('\n'));
}
async function lock(dir) {
  await mkdir(dir,{recursive:true});
  const path=join(dir,'runner.lock');
  try {await mkdir(path);} catch(error) {
    if(error.code!=='EEXIST')throw error;
    const owner=await json(join(path,'owner.json')).catch(()=>null);
    if(!owner)throw new Error('Run lock has no verified owner. Inspect it before continuing.');
    try {process.kill(owner.pid,0);throw new Error('This run is already active.');}
    catch(e) {if(e.code!=='ESRCH')throw e;}
    await rm(path,{recursive:true});await mkdir(path);
  }
  await atomic(join(path,'owner.json'),{pid:process.pid,at:now()});
  return async()=>{await rm(path,{recursive:true});};
}
async function server(state,dir) {
  const port=Number(options.port||state.port||2589);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port.');
  state.port=port;state.baseUrl=`http://127.0.0.1:${port}`;
  // Refuse to probe/reuse another server; only this child's dedicated database is used.
  const {createServer}=await import('node:net');
  await new Promise((ok,fail)=>{const s=createServer();s.once('error',fail);s.listen(port,'127.0.0.1',()=>s.close(ok));});
  const log=createWriteStream(join(dir,'server.log'),{flags:'a'});
  const child=spawn(process.execPath,['server/index.js'],{cwd:state.workspace,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,
    PORT:String(port),HOST:'127.0.0.1',DATA_DIR:join(dir,'database'),NODE_ENV:'production',MAX_MULTIPLAYER_PLAYERS:'20'}});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  let startupError;child.once('error',e=>startupError=e);
  const stop=async()=>{child.kill();await Promise.race([new Promise(r=>child.exitCode!==null||child.signalCode?r():child.once('exit',r)),delay(5000)]);log.end();};
  try {
    let ready=false;
    for(let i=0;i<80;i++) {
      if(startupError)throw startupError;
      if(child.exitCode!==null)throw new Error('Isolated server exited; inspect server.log.');
      try {const r=await fetch(state.baseUrl+'/api/health',{signal:AbortSignal.timeout(600)});if(r.ok){ready=true;break;}}catch{}
      await delay(200);
    }
    if(!ready)throw new Error('Isolated server startup timed out.');
    return {child,stop};
  } catch(error){await stop();throw error;}
}
async function execute(state,dir) {
  const release=await lock(dir);let live;
  const interrupt=()=>{state.stopRequested=true;live?.child.kill();};
  process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
  try {
    const actual=await sourceManifest(state.workspace);
    if(actual.digest!==state.sourceDigest)throw new Error('Saved snapshot changed. Start a new run.');
    for(const name of Object.keys(state.checks))if(state.checks[name].status==='running')state.checks[name]={status:'interrupted'};
    for(const [name,args] of [
      ['focused-tests',['--test','--test-isolation=none',...focusedTests]],
      ['content',['tools/validate-content.js']],
      ['build',[join(state.workspace,'node_modules/vite/bin/vite.js'),'build']],
    ]) {
      if(state.checks[name]?.status==='passed')continue;
      if(state.stopRequested)break;
      const q=await quota(state);
      if(q.status!=='available'){state.status=q.status;state.nextAction=q.reason;await save(state,dir);return;}
      state.status='running';state.nextAction=name;state.checks[name]={status:'running'};await save(state,dir);
      state.checks[name]=await runProcess(args,{cwd:state.workspace,log:join(dir,name+'.log')});
      state.events.push({at:now(),type:'check_finished',name,status:state.checks[name].status});await save(state,dir);
      if(state.checks[name].status==='failed'){state.status='failed';state.nextAction='Inspect '+name+'.log; repair source, then start a new snapshot.';await save(state,dir);return;}
      console.log(name+': passed');
    }
    if(state.stopRequested){state.status='interrupted';state.nextAction='Resume this run.';await save(state,dir);return;}
    const q=await quota(state);
    if(q.status!=='available'){state.status=q.status;state.nextAction=q.reason;await save(state,dir);return;}
    live=await server(state,dir);
    if(state.checks['server-smoke']?.status!=='passed') {
      state.checks['server-smoke']={status:'running'};await save(state,dir);
      state.checks['server-smoke']=await runProcess(['tools/smoke-lan.js',state.baseUrl],{cwd:state.workspace,log:join(dir,'server-smoke.log'),timeout:60_000});
      if(state.checks['server-smoke'].status!=='passed'){state.status='failed';state.nextAction='Inspect isolated server-smoke.log.';await save(state,dir);return;}
    }
    state.status=acceptanceStatus(state);state.nextAction='Verify Chrome scenario; submit a browser proof. Read BROWSER-SCENARIO.md.';
    await save(state,dir);console.log(JSON.stringify({runId:state.runId,status:state.status,url:state.baseUrl,checkpoint:join(dir,'checkpoint.json')}));
    if(options.serve && state.status==='awaiting_browser') {
      const until=Date.now()+15*60_000;
      let lastQuotaCheck=Date.now();
      while(Date.now()<until&&!state.stopRequested) {
        if(existsSync(join(dir,'stop.request')))break;
        if(live.child.exitCode!==null){state.status='interrupted';state.nextAction='Isolated server exited; resume this run.';await save(state,dir);break;}
        const diskState=await json(join(dir,'checkpoint.json'));
        if(diskState.status==='passed'||diskState.status==='failed')break;
        if(Date.now()-lastQuotaCheck>=30_000) {
          const oldKey=state.accountKey,decision=await quota(state);lastQuotaCheck=Date.now();
          if((await json(join(dir,'checkpoint.json'))).status==='passed')break;
          if(decision.status!=='available') {state.status=decision.status;state.nextAction=decision.reason;await save(state,dir);break;}
          if(oldKey!==state.accountKey) {state.status='awaiting_browser';state.nextAction='Account changed. Rediscover Chrome and repeat browser checks.';await save(state,dir);}
        }
        await delay(1000);
      }
      if(state.stopRequested){state.status='interrupted';state.nextAction='Resume this run.';await save(state,dir);}
    }
  } finally {await live?.stop();process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);await release();}
}
async function main() {
  if(action==='help') {console.log('start [--recovery-dir PATH] [--thread ID] [--serve]\nresume --run ID [--serve]\naccept --run ID --evidence PATH\nstatus --run ID\nreconnect --run ID');return;}
  await mkdir(runs,{recursive:true});
  let state,dir;
  if(action==='start') {
    const id=now().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,6);dir=join(runs,id);await mkdir(dir);
    const before=await sourceManifest(root);const workspace=await makeSnapshot(dir);
    const copied=await sourceManifest(workspace),after=await sourceManifest(root);
    if(before.digest!==copied.digest||before.digest!==after.digest)throw new Error('Source changed during snapshot. Retry after the other edit finishes.');
    await atomic(join(dir,'source-manifest.json'),copied);
    const preferences=process.env.LOCALAPPDATA?await json(join(process.env.LOCALAPPDATA,'ChatGPT-Recovery','settings.json')).catch(()=>({})):{};
    const preferenceThreshold=Number.isFinite(preferences.threshold)&&preferences.threshold>=1&&preferences.threshold<=5?preferences.threshold:5;
    state={version:1,runId:id,task:'Parvoz diagnostics and setup guide acceptance',createdAt:now(),status:'prepared',workspace,
      sourceDigest:copied.digest,sourceCurrent:true,branch:git(['branch','--show-current']),head:git(['rev-parse','HEAD']),
      initialDirtyFiles:git(['status','--short']),threadId:options.thread||null,
      recoveryDir:resolve(options['recovery-dir']||process.env.CHATGPT_RECOVERY_DIR||join(root,'..','ChatGPT-Recovery')),
      python:options.python||'python',threshold:Number(options.threshold||preferenceThreshold),checks:{},events:[],browser:null,
      deploymentStatus:'not_changed',targetHardwareStatus:'not_tested'};
    await save(state,dir);await atomic(join(runs,'latest.json'),{runId:id});
  } else {
    if(typeof options.run!=='string'||!/^[a-zA-Z0-9T_.-]+$/.test(options.run))throw new Error('Specify a valid --run ID.');
    dir=resolve(runs,options.run);if(!inside(runs,dir))throw new Error('Invalid run directory.');
    state=await json(join(dir,'checkpoint.json'));
  }
  if(action==='status') {console.log(JSON.stringify({runId:state.runId,status:state.status,nextAction:state.nextAction,checks:state.checks,quota:state.quota},null,2));return;}
  if(action==='reconnect') {
    const recovery=join(state.recoveryDir,'Recovery.ps1');
    if(process.platform!=='win32'||!existsSync(recovery))throw new Error('Configured Windows recovery script is unavailable.');
    state.browser=null;state.status=acceptanceStatus(state);
    state.nextAction='Rediscover Chrome by extension/profile, rebind the tab, and verify browser access. Native-host restart alone is not browser verification.';
    await save(state,dir);
    try {
      const output=execFileSync('powershell.exe',['-NoProfile','-File',recovery,'-Action','Reconnect'],{timeout:30_000,windowsHide:true,encoding:'utf8'});
      await writeFile(join(dir,'chrome-recovery.log'),output);console.log(state.nextAction);
    } catch {throw new Error('Soft reconnect failed. Check whether Chrome is open; preserve the checkpoint before a manual full restart.');}
    return;
  }
  if(action==='accept') {
    const release=await lock(join(dir,'proof-control')); // separate writer lock; runner may be serving
    try {
      state=await json(join(dir,'checkpoint.json'));
      const decision=await quota(state);
      state.status=decision.status==='available'?acceptanceStatus(state):decision.status;
      await save(state,dir); // Persist account-change invalidation even when the submitted proof is rejected.
      if(decision.status!=='available')throw new Error(decision.reason);
      const proof=validateBrowserProof(await json(resolve(options.evidence)),state);
      for(const row of proof.checks) {
        const evidence=resolve(dir,row.evidence);
        if(!inside(dir,evidence)||!(await stat(evidence)).isFile())throw new Error('Evidence must be a file inside this run: '+row.name);
        row.sha256=createHash('sha256').update(await readFile(evidence)).digest('hex');
      }
      state.browser=proof;state.sourceCurrent=(await sourceManifest(root)).digest===state.sourceDigest;
      state.status=acceptanceStatus(state);state.nextAction=state.status==='passed'?'Pilot accepted; see REPORT.md.':'Inspect failed, missing, or stale evidence.';
      await save(state,dir);await writeFile(join(dir,'stop.request'),'browser proof submitted\n');
      console.log(JSON.stringify({runId:state.runId,status:state.status,report:join(dir,'REPORT.md')}));
    } finally {await release();}
    return;
  }
  if(!['start','resume'].includes(action))throw new Error('Unknown action: '+action);
  if(action==='resume') {
    const decision=await quota(state);
    state.sourceCurrent=(await sourceManifest(root)).digest===state.sourceDigest;
    state.status=decision.status==='available'?acceptanceStatus(state):decision.status;
    await save(state,dir);
    if(state.sourceCurrent===false){state.nextAction='Source changed. Start a new snapshot; this saved snapshot is retained.';await save(state,dir);throw new Error(state.nextAction);}
    if(decision.status!=='available'){console.log(JSON.stringify({status:state.status,nextAction:decision.reason}));process.exitCode=4;return;}
    if(state.status==='passed'){console.log('Already passed. No work repeated.');return;}
  }
  await rm(join(dir,'stop.request'),{force:true});state.stopRequested=false;
  await execute(state,dir);
  const final=await json(join(dir,'checkpoint.json'));
  process.exitCode=final.status==='passed'?0:final.status==='failed'?2:['quota_unknown','waiting_for_quota'].includes(final.status)?4:3;
}

await main().catch(error=>{console.error(error.message);process.exitCode=1;});
