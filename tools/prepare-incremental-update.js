// Prepare a fresh hash-verified delta from the finalized runtime inventory.
// Existing immutable URLs are retained; no old stage or player data is needed.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,lstatSync} from 'node:fs';
import {resolve,join,dirname,relative,sep} from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {NETWORK_PROTOCOL} from '../shared/network-flight.js';
const [release,baselineFile,liveFile]=process.argv.slice(2),root=resolve(import.meta.dirname,'..'),readOnlyContent=process.argv.includes('--read-only-content-source');
const fullContent=process.argv.includes('--full-content-sources');assert.ok(!(fullContent&&readOnlyContent),'Choose one canonical source mode');
const proofFile=process.argv.find(arg=>arg.startsWith('--verified-source-inventory='))?.slice('--verified-source-inventory='.length);
assert.ok(!proofFile||readOnlyContent,'Source verification requires explicit read-only source mode');
assert.match(release||'',/^\d{8}-[a-z0-9-]+$/);assert.ok(liveFile,'Usage: prepare-incremental-update.js RELEASE BASELINE_JSON LIVE_CATALOG_JSON');
const baseline=JSON.parse(readFileSync(baselineFile)),live=JSON.parse(readFileSync(liveFile)),catalog=JSON.parse(readFileSync(join(root,'public/content/catalog.json')));
assert.equal(live.revision,baseline.revision);assert.equal(live.protocol,baseline.protocol);assert.equal(live.protocol,NETWORK_PROTOCOL);assert.deepEqual(catalog.maps.map(m=>m.id).sort(),live.maps.map(m=>m.id).sort());
assert.ok(!baseline.sourceContentRelease||readOnlyContent||fullContent,'A source-sharing baseline needs explicit read-only or full-content source mode');
let sourceProof;
if(proofFile){
 const source=JSON.parse(readFileSync(proofFile));assert.equal(source.release,baseline.sourceContentRelease||baseline.release,'Wrong canonical source release');
 const rows=source.inventory.filter(row=>row.file.startsWith('content/'));assert.ok(rows.length,'Missing canonical source inventory');
 assert.equal(new Set(rows.map(row=>row.file)).size,rows.length,'Duplicate canonical source path');
 for(const row of rows){assert.ok(!row.file.includes('..')&&!row.file.includes('\\')&&!/\.env$|\.sqlite|\.key$|\.pem$/.test(row.file),'Unsafe canonical source path');const path=join(root,row.file);assert.ok(lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink());const bytes=readFileSync(path);assert.equal(bytes.length,row.bytes,row.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,'Canonical source changed: '+row.file);}
 sourceProof={release:source.release,inventory:rows};
}
if(readOnlyContent&&!sourceProof){assert.equal(catalog.revision,live.revision,'Read-only source mode is for unchanged content');assert.deepEqual(catalog.assets,live.assets,'Read-only source mode cannot change deliveries');}
const patch=join(root,'data','oracle-patch-'+release);assert.ok(!existsSync(patch),'Use a fresh release directory');
const omitted=readOnlyContent?baseline.inventory.filter(i=>i.file.startsWith('content/')):[];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),inventory=new Map(baseline.inventory.filter(i=>!omitted.includes(i)).map(i=>[i.file,i])),changed=new Map(),byHash=new Map();
function safe(file){assert.ok(!file.startsWith('/')&&!file.includes('..')&&!file.includes('\\')&&!/\.env$|\.sqlite|\.key$|\.pem$|\.blend\d*$|previous-release\.txt/.test(file),'Private/unsafe runtime path: '+file);return file;}
for(const row of baseline.inventory){safe(row.file);assert.ok(Number.isSafeInteger(row.bytes)&&row.bytes>=0);assert.match(row.sha256,/^[a-f0-9]{64}$/);}
assert.equal(new Set(baseline.inventory.map(i=>i.file)).size,baseline.inventory.length,'Duplicate baseline path');
function readBytes(file){let bytes=readFileSync(join(root,file));if(file.endsWith('.sh')||file==='deploy/Caddyfile')bytes=Buffer.from(bytes.toString().replaceAll('\r\n','\n'));return bytes;}
function add(file){safe(file);const path=join(root,file);assert.ok(lstatSync(path).isFile(),'Runtime source must be a regular file');const bytes=readBytes(file);
 const row={file,bytes:bytes.length,sha256:sha(bytes)};if(inventory.get(file)?.sha256!==row.sha256)changed.set(file,row);inventory.set(file,row);
}
function walk(folder){for(const item of readdirSync(join(root,folder),{withFileTypes:true})){const file=folder+'/'+item.name;if(item.isDirectory())walk(file);else if(item.isFile()&&!/\.env$|oracle-known-hosts|previous-release\.txt/.test(file))add(file);}}
for(const folder of ['src','shared','server','deploy','dist'])walk(folder);
for(const file of ['package.json','package-lock.json','index.html','vite.config.js','Dockerfile','compose.production.yaml','.dockerignore','public/content/recipes.js','public/content/catalog.json'])add(file);
// Update every retained canonical runtime source, while keeping old dist/assets
// for cached clients. New editable sources and import caches are excluded.
for(const row of baseline.inventory)if((!readOnlyContent&&row.file.startsWith('content/')||row.file.startsWith('tools/'))&&existsSync(join(root,row.file)))add(row.file);
// New compiler dependencies are absent from a previous runtime inventory.
for(const file of ['tools/glb-image-dedup.js'])if(existsSync(join(root,file)))add(file);
if(fullContent){
 // Collect exactly the enabled definitions, their resources and syncContent's
 // implicit models/thumbnails. Never copy editable art, archives or the project.
 const sourceRoot=join(root,'content'),included=new Set();
 const include=file=>{const path=resolve(file);assert.ok(path.startsWith(sourceRoot+sep),'Canonical asset escapes content/');if(existsSync(path)&&lstatSync(path).isFile()){included.add(path);return true;}return false;};
 const references=(value,folder)=>{
  if(Array.isArray(value))for(const item of value)references(item,folder);
  else if(value&&typeof value==='object')for(const item of Object.values(value))references(item,folder);
  else if(typeof value==='string'&&/\.(glb|png|jpe?g|json)$/i.test(value)&&!value.startsWith('/content/assets/'))include(resolve(folder,value));
 };
 const categories={maps:'map',races:'race',drones:'drone',parts:'part',challenges:'challenge',tutorials:'tutorial'};
 for(const [kind,singular] of Object.entries(categories)){
  const directory=join(sourceRoot,kind);if(!existsSync(directory))continue;
  for(const entry of readdirSync(directory,{withFileTypes:true})){
   if(entry.name.startsWith('.'))continue;
   const path=join(directory,entry.name),folder=entry.isFile()?directory:path,definition=entry.isFile()?path:join(folder,singular+'.json');
   if(existsSync(join(folder,'.disabled'))||!existsSync(definition)||!definition.endsWith('.json'))continue;
   const item=JSON.parse(readFileSync(definition)),id=item.id||entry.name;
   const active=kind==='races'?catalog.maps.some(m=>m.tracks.some(t=>t.id===id)):catalog[kind].some(i=>i.id===id&&(kind!=='parts'||i.category===(item.category||'frame')));
   if(!active)continue;
   include(definition);references(item,folder);
   for(const name of ['scene.glb','model.glb'])if(include(join(folder,name)))break;
   if(['maps','drones'].includes(kind))for(const name of ['thumbnail.jpg','thumbnail.png'])if(include(join(folder,name)))break;
   if(kind==='maps'){
    include(join(folder,'collision.json'));
    if(!item.model&&!existsSync(join(folder,'model.glb'))&&!existsSync(join(folder,'scene.glb'))&&!item.groundTexture){const name=item.theme==='forest'?'forest-floor.png':item.theme==='canyon'?'canyon-floor.png':'concrete-floor.png';include(join(sourceRoot,'shared-assets',name));}
   }
  }
 }
 for(const file of [...included].sort())add(relative(root,file).split(sep).join('/'));
 for(const name of ['forest-floor.png','canyon-floor.png','concrete-floor.png']){const file='content/shared-assets/'+name;if(existsSync(join(root,file)))add(file);}
}
for(const asset of catalog.assets){assert.match(asset.url,/^\/content\/assets\/[a-zA-Z0-9_./-]+$/);add('public'+asset.url);}
for(const asset of live.assets){const row=inventory.get('public'+asset.url);assert.ok(row&&row.bytes===asset.bytes,'An old immutable delivery disappeared');if(existsSync(join(root,row.file)))assert.equal(sha(readFileSync(join(root,row.file))),row.sha256,'Old immutable bytes changed');}
assert.equal(catalog.maps.some(m=>m.id==='ironworks-v2'),false);
const canonicalReuse=new Map();
if(fullContent){
 const published=new Map(baseline.inventory.filter(r=>/^public\/content\/assets\/.+-[a-f0-9]{16}\.(glb|png|jpe?g|json|pcol)$/.test(r.file)).map(r=>[r.sha256,r]));
 for(const row of changed.values())if(row.file.startsWith('content/')){const previous=published.get(row.sha256);if(previous&&previous.bytes===row.bytes){canonicalReuse.set(row.file,{...row,sourceFile:previous.file});changed.delete(row.file);}}
}
mkdirSync(patch,{recursive:true});const files=[];
for(const row of changed.values()){
 const duplicate=byHash.get(row.sha256);if(duplicate){files.push({...row,sourceFile:duplicate});continue;}
 const destination=join(patch,row.file);mkdirSync(dirname(destination),{recursive:true});const bytes=readBytes(row.file);assert.equal(sha(bytes),row.sha256,'Source changed during staging');writeFileSync(destination,bytes);files.push(row);byHash.set(row.sha256,row.file);
}
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),now=new Date().toISOString();
const record={release,date:release.slice(0,4)+'-'+release.slice(4,6)+'-'+release.slice(6,8),preparedAt:now,status:'staged-not-deployed',sourceCommit,previousRelease:baseline.release,previousRevision:baseline.revision,revision:catalog.revision,protocol:live.protocol,inventory:[...inventory.values()],maps:catalog.maps.map(m=>m.id),drones:catalog.drones.map(d=>d.id),scope:baseline.scope,excluded:['retired Ironworks','player databases','env files','Blender sources','import caches'],buildVerified:true,contentVerified:true,browserVerified:false,targetHardwareVerified:false};
if(readOnlyContent)record.sourceContentRelease=baseline.sourceContentRelease||baseline.release;
if(sourceProof)record.sourceContentProof=sourceProof;
const manifest={release,previousRelease:baseline.release,previousRevision:baseline.revision,revision:catalog.revision,protocol:live.protocol,files,reuse:[...inventory.values()].filter(i=>!changed.has(i.file)).map(i=>canonicalReuse.get(i.file)||i),removed:omitted};
writeFileSync(join(patch,'PATCH.json'),JSON.stringify(manifest,null,2)+'\n');writeFileSync(join(patch,'RELEASE.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({patch,release,sourceCommit,revision:catalog.revision,changed:files.length,reused:manifest.reuse.length,uploadBytes:[...byHash.keys()].reduce((n,hash)=>n+files.find(f=>f.sha256===hash).bytes,0),retainedUnusedAssets:live.assets.filter(a=>!catalog.assets.some(c=>c.url===a.url)).length}));
