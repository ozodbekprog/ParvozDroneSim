// Reconstruct a candidate without duplicating retained immutable assets.
// Run on the VM before copying its private env files into the new directory.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,linkSync,existsSync,readdirSync,createReadStream,lstatSync,realpathSync} from 'node:fs';
import {resolve,join,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const [previousArg,releaseArg,patchArg,previousName,releaseName,revision,protocol]=process.argv.slice(2);
assert.ok([previousArg,releaseArg,patchArg,previousName,releaseName,revision,protocol].every(Boolean),'Usage: stage-oracle-delta.js PREVIOUS TARGET PATCH PREVIOUS_NAME RELEASE_NAME REVISION PROTOCOL');
const previous=resolve(previousArg),release=resolve(releaseArg),patch=resolve(patchArg);
assert.ok(new Set([previous,release,patch]).size===3,'Candidate, baseline and patch must be separate directories.');
assert.ok(![previous,patch].some(path=>release.startsWith(path+sep)||path.startsWith(release+sep)),'Candidate must be outside its source directories.');
assert.ok(!existsSync(release)||readdirSync(release).length===0,'Candidate directory must be empty.');
const read=file=>JSON.parse(readFileSync(file));
const manifest=read(join(patch,'PATCH.json')),record=read(join(patch,'RELEASE.json'));
assert.equal(manifest.previousRelease,previousName);assert.equal(record.previousRelease,previousName);
assert.equal(manifest.release,releaseName);assert.equal(record.release,releaseName);
assert.equal(manifest.revision,revision);assert.equal(record.revision,revision);
assert.equal(manifest.protocol,Number(protocol));assert.equal(record.protocol,Number(protocol));
let sourceContentDirectory;
if(record.sourceContentRelease){
 const baseline=read(join(previous,'RELEASE.json'));
 if(!record.sourceContentProof)assert.equal(record.revision,baseline.revision,'Source sharing cannot change content');
 assert.equal(record.sourceContentRelease,baseline.sourceContentRelease||previousName);
 assert.match(record.sourceContentRelease,/^\d{8}-[a-z0-9-]+$/);
 sourceContentDirectory=baseline.sourceContentDirectory||join(previous,'content');
 assert.equal(sourceContentDirectory,join(dirname(previous),record.sourceContentRelease,'content'),'Canonical sources must belong to a retained sibling release');
 assert.equal(realpathSync(sourceContentDirectory),sourceContentDirectory);
 assert.ok(lstatSync(sourceContentDirectory).isDirectory()&&!lstatSync(sourceContentDirectory).isSymbolicLink());
 assert.ok(manifest.removed.every(row=>row.file.startsWith('content/')&&baseline.inventory.some(old=>old.file===row.file&&old.sha256===row.sha256&&old.bytes===row.bytes)),'Only recorded canonical sources may be omitted');
 assert.ok(!record.inventory.some(row=>row.file.startsWith('content/')),'A read-only source release cannot mix mutable source copies');
}else assert.equal(manifest.removed.length,0,'This incremental staging path retains all baseline files.');
const safe=(root,file)=>{
  assert.ok(typeof file==='string'&&file.length&&!file.includes('\\')&&!file.startsWith('/')&&!file.split('/').includes('..')&&!/\.env$|\.sqlite(?:-|$)|\.pem$|\.key$|\.blend\d*$/.test(file),'Unsafe/private release path');
  const path=resolve(root,file);assert.ok(path.startsWith(root+sep),'Unsafe release target');return path;
};
async function verify(root,item){
  const path=safe(root,item.sourceFile||item.file),stat=lstatSync(path);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Release source must be a regular file.');
  assert.equal(stat.size,item.bytes,'Changed source size: '+item.file);
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);
  assert.equal(hash.digest('hex'),item.sha256,'Changed source hash: '+item.file);return path;
}
if(record.sourceContentProof){
 assert.ok(sourceContentDirectory,'Source proof requires a retained source directory');
 const proof=record.sourceContentProof,sourceRecord=read(join(dirname(sourceContentDirectory),'RELEASE.json'));
 assert.equal(proof.release,record.sourceContentRelease);assert.equal(sourceRecord.release,proof.release);
 assert.deepEqual(proof.inventory,sourceRecord.inventory.filter(row=>row.file.startsWith('content/')),'Source proof differs from retained release');
 assert.ok(proof.inventory.length);for(const row of proof.inventory){assert.ok(row.file.startsWith('content/')&&!row.sourceFile);await verify(dirname(sourceContentDirectory),row);}
}
const immutable=file=>/^public\/content\/assets\/.+-[a-f0-9]{16}\.(glb|png|jpe?g|json|pcol)$/.test(file);
const binary=file=>/^(content\/|public\/content\/assets\/).+\.(glb|png|jpe?g|pcol)$/.test(file);
const linkPatch=process.env.DEPLOY_LINK_PATCH_ASSETS||'0';assert.ok(['0','1'].includes(linkPatch),'Patch linking must be explicit');
const written=new Set(),ownBinary=new Map();let linkedFiles=0,linkedBytes=0;
mkdirSync(release,{recursive:true});
for(const [root,items] of [[previous,manifest.reuse],[patch,manifest.files]])for(const item of items){
  assert.ok(!written.has(item.file),'Duplicate candidate file: '+item.file);written.add(item.file);
  const source=await verify(root,item),destination=safe(release,item.file);
  mkdirSync(dirname(destination),{recursive:true});
  // Cross-release links are limited to content-addressed published assets.
  // Explicit patch linking requires freezing incoming assets: never overwrite
  // a linked asset during later preparation or build.
  // New binary duplicates may share the copy already created inside this candidate.
  const candidateSource=binary(item.file)?ownBinary.get(item.sha256):null;
  const linkSource=candidateSource||((root===previous||linkPatch==='1')&&immutable(item.file)&&immutable(item.sourceFile||item.file)?source:null);
  let linked=false;
  if(linkSource)try{linkSync(linkSource,destination);linked=true;linkedFiles++;linkedBytes+=item.bytes;}catch(error){if(error.code!=='EXDEV')throw error;}
  if(!linked)copyFileSync(source,destination);
  if(binary(item.file))ownBinary.set(item.sha256,destination);
}
assert.equal(written.size,record.inventory.length,'Candidate inventory differs from patch scope.');
for(const item of record.inventory){assert.ok(written.has(item.file),'Missing inventory file');await verify(release,{...item,sourceFile:undefined});}
if(sourceContentDirectory)record.sourceContentDirectory=sourceContentDirectory;
writeFileSync(join(release,'RELEASE.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({verifiedFiles:written.size,revision,protocol:Number(protocol),linkedFiles,linkedBytes,status:'staged-not-activated'}));
