import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,existsSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

function fixture(action){
 const root=mkdtempSync(join(tmpdir(),'parvoz-delta-')),release='20990101-delta-test';
 const save=(file,data)=>{const path=join(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,data);};
 try{
  mkdirSync(join(root,'tools'));copyFileSync(new URL('../tools/package-oracle-delta.js',import.meta.url),join(root,'tools/package-oracle-delta.js'));
  const stage='data/oracle-release-'+release,files={'public/runtime/decoder.js':'retained decoder','content/maps/example/model.glb':'glTF fixture payload','public/content/assets/example.glb':'glTF fixture payload','public/content/catalog.json':JSON.stringify({revision:'new'})};
  const inventory=Object.entries(files).map(([file,body])=>{save(stage+'/'+file,body);return {file,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')};});
  save('data/baseline.json',JSON.stringify({release:'20981231-baseline',revision:'old',inventory:[inventory[0]]}));
  save(stage+'/RELEASE.json',JSON.stringify({release,previousRevision:'old',revision:'new',protocol:13,inventory}));
  action({root,stage,release,save,inventory,run:()=>spawnSync(process.execPath,[join(root,'tools/package-oracle-delta.js'),release,'data/baseline.json'],{encoding:'utf8',windowsHide:true})});
 }finally{
  assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));rmSync(root,{recursive:true,force:true});
 }
}
test('release delta reuses old files and reconstructs duplicated new assets from one uploaded payload',()=>fixture(({root,stage,release,inventory,run})=>{
 const result=run();assert.equal(result.status,0,result.stderr);
 const patch=join(root,'data/oracle-patch-'+release),manifest=JSON.parse(readFileSync(join(patch,'PATCH.json'))),summary=JSON.parse(result.stdout);
 assert.equal(manifest.reuse.length,1);assert.equal(summary.deduplicatedFiles,1);
 const duplicate=manifest.files.find(item=>item.sourceFile);assert.ok(duplicate);assert.equal(existsSync(join(patch,duplicate.file)),false);
 for(const item of manifest.files){
  const bytes=readFileSync(join(patch,item.sourceFile||item.file));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
  assert.deepEqual(bytes,readFileSync(join(root,stage,item.file)));
 }
 assert.equal(manifest.files.length+manifest.reuse.length,inventory.length);
}));
test('release packaging rejects private files before they can enter an upload',()=>fixture(({root,stage,save,run})=>{
 const file=join(root,stage,'RELEASE.json'),record=JSON.parse(readFileSync(file));record.inventory.unshift({file:'deploy/production.env'});save(stage+'/RELEASE.json',JSON.stringify(record));save(stage+'/deploy/production.env','fixture only');
 const result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Unsafe\/private release path/);
}));

test('VM staging verifies every file, links duplicate binaries and keeps mutable files independent',()=>fixture(({root,stage,release,save,run,inventory})=>{
 const packaged=run();assert.equal(packaged.status,0,packaged.stderr);
 const baseline=join(root,'baseline'),candidate=join(root,'candidate'),patch=join(root,'data/oracle-patch-'+release);
 save('baseline/'+inventory[0].file,'retained decoder');
 copyFileSync(new URL('../tools/stage-oracle-delta.js',import.meta.url),join(root,'tools/stage-oracle-delta.js'));
 const args=[join(root,'tools/stage-oracle-delta.js'),baseline,candidate,patch,'20981231-baseline',release,'new','13'];
 const staged=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true});assert.equal(staged.status,0,staged.stderr);
 for(const item of inventory)assert.deepEqual(readFileSync(join(candidate,item.file)),readFileSync(join(root,stage,item.file)));
 assert.equal(statSync(join(candidate,'content/maps/example/model.glb')).ino,statSync(join(candidate,'public/content/assets/example.glb')).ino);
 assert.notEqual(statSync(join(candidate,inventory[0].file)).ino,statSync(join(baseline,inventory[0].file)).ino);
 writeFileSync(join(candidate,inventory[0].file),'changed candidate');assert.equal(readFileSync(join(baseline,inventory[0].file),'utf8'),'retained decoder');
 const repeated=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true});assert.notEqual(repeated.status,0);assert.match(repeated.stderr,/must be empty/);
}));

test('VM staging rejects a damaged uploaded payload before activation',()=>fixture(({root,release,save,run,inventory})=>{
 const packaged=run();assert.equal(packaged.status,0,packaged.stderr);
 save('baseline/'+inventory[0].file,'retained decoder');
 const patch=join(root,'data/oracle-patch-'+release),manifest=JSON.parse(readFileSync(join(patch,'PATCH.json')));
 const item=manifest.files.find(item=>!item.sourceFile);writeFileSync(join(patch,item.file),'damaged upload');
 copyFileSync(new URL('../tools/stage-oracle-delta.js',import.meta.url),join(root,'tools/stage-oracle-delta.js'));
 const staged=spawnSync(process.execPath,[join(root,'tools/stage-oracle-delta.js'),join(root,'baseline'),join(root,'candidate'),patch,'20981231-baseline',release,'new','13'],{encoding:'utf8',windowsHide:true});
 assert.notEqual(staged.status,0);assert.match(staged.stderr,/Changed source (size|hash)/);
 assert.equal(existsSync(join(root,'candidate/RELEASE.json')),false);
}));

test('explicit frozen-patch mode links prepared collision assets and keeps code independent',()=>fixture(({root,stage,release,save,run,inventory})=>{
 const body='prepared collision fixture',sha256=createHash('sha256').update(body).digest('hex'),file='public/content/assets/collision-'+sha256.slice(0,16)+'.pcol';
 save(stage+'/'+file,body);const record=JSON.parse(readFileSync(join(root,stage,'RELEASE.json')));record.inventory.push({file,bytes:Buffer.byteLength(body),sha256});save(stage+'/RELEASE.json',JSON.stringify(record));
 assert.equal(run().status,0);save('baseline/'+inventory[0].file,'retained decoder');
 copyFileSync(new URL('../tools/stage-oracle-delta.js',import.meta.url),join(root,'tools/stage-oracle-delta.js'));
 const patch=join(root,'data/oracle-patch-'+release),candidate=join(root,'candidate');
 const staged=spawnSync(process.execPath,[join(root,'tools/stage-oracle-delta.js'),join(root,'baseline'),candidate,patch,'20981231-baseline',release,'new','13'],{encoding:'utf8',windowsHide:true,env:{...process.env,DEPLOY_LINK_PATCH_ASSETS:'1'}});assert.equal(staged.status,0,staged.stderr);
 assert.equal(statSync(join(candidate,file)).ino,statSync(join(patch,file)).ino);
 assert.notEqual(statSync(join(candidate,'public/content/catalog.json')).ino,statSync(join(patch,'public/content/catalog.json')).ino);
}));
