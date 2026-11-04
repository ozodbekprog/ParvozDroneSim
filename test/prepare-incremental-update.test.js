import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

function fixture(action){
 const root=mkdtempSync(join(tmpdir(),'parvoz-fresh-delta-')),release='20990101-update';
 const save=(file,body)=>{mkdirSync(dirname(join(root,file)),{recursive:true});writeFileSync(join(root,file),body);};
 const hash=body=>createHash('sha256').update(body).digest('hex');
 try{
  save('shared/network-flight.js','export const NETWORK_PROTOCOL=13;');save('package.json','{"type":"module"}');
  save('src/app.js','current client');save('server/index.js','current server');save('deploy/deploy.sh','#!/bin/bash\r\necho current\r\n');save('dist/index.html','current build');
  for(const file of ['package-lock.json','index.html','vite.config.js','Dockerfile','compose.production.yaml','.dockerignore','public/content/recipes.js'])save(file,'fixture '+file);
  const oldUrl='/content/assets/old-1111111111111111.glb',newUrl='/content/assets/new-2222222222222222.glb';
  const inventory=[{file:'public'+oldUrl,bytes:3,sha256:hash('old')},{file:'public/runtime/decoder.wasm',bytes:7,sha256:hash('decoder')},{file:'deploy/oracle-known-hosts',bytes:11,sha256:hash('public host')}];
  save('public'+oldUrl,'old');save('content/maps/example/model.glb','new model');save('public'+newUrl,'new model');
  const live={revision:'old',protocol:13,maps:[{id:'example'}],assets:[{url:oldUrl,bytes:3}]};
  save('public/content/catalog.json',JSON.stringify({...live,revision:'new',drones:[],assets:[{url:newUrl,bytes:9}]}));
  const baseline={release:'20981231-baseline',revision:'old',protocol:13,inventory};
  // Only canonical paths already in the finalized inventory are updated.
  baseline.inventory.push({file:'content/maps/example/model.glb',bytes:3,sha256:hash('old')});
  save('data/baseline.json',JSON.stringify(baseline));save('data/live.json',JSON.stringify(live));
  copyFileSync(new URL('../tools/prepare-incremental-update.js',import.meta.url),join(root,'tools.js'));
  mkdirSync(join(root,'tools'));copyFileSync(join(root,'tools.js'),join(root,'tools/prepare-incremental-update.js'));
  for(const args of [['init','-q'],['add','.'],['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture']]){
   const result=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
  }
  action({root,release,save,baseline,run:(extra=[])=>spawnSync(process.execPath,[join(root,'tools/prepare-incremental-update.js'),release,'data/baseline.json','data/live.json',...extra],{cwd:root,encoding:'utf8',windowsHide:true})});
 }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));rmSync(root,{recursive:true,force:true});}
}

test('fresh incremental update retains superseded assets without rebuilding the old stage',()=>fixture(({root,release,run})=>{
 const result=run();assert.equal(result.status,0,result.stderr);
 const patch=join(root,'data/oracle-patch-'+release),manifest=JSON.parse(readFileSync(join(patch,'PATCH.json')));
 assert.ok(manifest.reuse.some(r=>r.file.includes('old-1111111111111111')));
 assert.ok(manifest.reuse.some(r=>r.file==='public/runtime/decoder.wasm'));assert.deepEqual(manifest.removed,[]);
 const delivery=manifest.files.find(r=>r.file.includes('new-2222222222222222'));assert.equal(delivery.sourceFile,'content/maps/example/model.glb');
 for(const row of manifest.files){const bytes=readFileSync(join(patch,row.sourceFile||row.file));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(bytes.length,row.bytes);}
 assert.equal(readFileSync(join(patch,'deploy/deploy.sh'),'utf8'),'#!/bin/bash\necho current\n');
 assert.equal(existsSync(join(root,'data/oracle-release-20981231-baseline')),false);
 assert.notEqual(run().status,0);
}));

test('fresh incremental update refuses private baseline paths before creating an upload',()=>fixture(({root,release,baseline,save,run})=>{
 baseline.inventory.push({file:'deploy/production.env',bytes:1,sha256:'0'.repeat(64)});save('data/baseline.json',JSON.stringify(baseline));
 const result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Private\/unsafe runtime path/);assert.equal(existsSync(join(root,'data/oracle-patch-'+release)),false);
}));

test('compiler-only deliveries reuse canonical sources only with exact local and remote inventory proof',()=>fixture(({root,release,baseline,save,run})=>{
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const source={release:'20981230-sources',inventory:[{file:'content/maps/example/model.glb',bytes:9,sha256:hash('new model')}]};
 baseline.sourceContentRelease=source.release;baseline.sourceContentDirectory=join(root,source.release,'content');baseline.inventory=baseline.inventory.filter(row=>!row.file.startsWith('content/'));save('data/baseline.json',JSON.stringify(baseline));save('data/source.json',JSON.stringify(source));save('tools/glb-image-dedup.js','new compiler helper');
 const args=['--read-only-content-source','--verified-source-inventory=data/source.json'];
 save('content/maps/example/model.glb','tampered!');assert.notEqual(run(args).status,0);save('content/maps/example/model.glb','new model');
 const result=run(args);assert.equal(result.status,0,result.stderr);
 const patch=join(root,'data/oracle-patch-'+release),record=JSON.parse(readFileSync(join(patch,'RELEASE.json')));assert.deepEqual(record.sourceContentProof,source);assert.ok(record.inventory.some(row=>row.file==='tools/glb-image-dedup.js'));
 for(const row of baseline.inventory)save(baseline.release+'/'+row.file,row.file.includes('old-')?'old':row.file.includes('known-hosts')?'public host':'decoder');
 save(baseline.release+'/RELEASE.json',JSON.stringify(baseline));save(source.release+'/RELEASE.json',JSON.stringify(source));save(source.release+'/content/maps/example/model.glb','tampered!');
 copyFileSync(new URL('../tools/stage-oracle-delta.js',import.meta.url),join(root,'tools/stage-oracle-delta.js'));
 const stage=()=>spawnSync(process.execPath,[join(root,'tools/stage-oracle-delta.js'),join(root,baseline.release),join(root,'candidate'),patch,baseline.release,release,'new','13'],{encoding:'utf8',windowsHide:true});
 assert.notEqual(stage().status,0);assert.equal(existsSync(join(root,'candidate/RELEASE.json')),false);
 save(source.release+'/content/maps/example/model.glb','new model');const staged=stage();assert.equal(staged.status,0,staged.stderr);assert.equal(existsSync(join(root,'candidate/content')),false);
}));

test('unchanged-content client release reads retained canonical sources without duplicating them',()=>fixture(({root,release,baseline,save,run})=>{
 assert.notEqual(run(['--read-only-content-source']).status,0);
 const catalog=JSON.parse(readFileSync(join(root,'public/content/catalog.json')));baseline.revision=catalog.revision;
 const source=baseline.inventory.find(r=>r.file.startsWith('content/'));source.bytes=9;source.sha256=createHash('sha256').update('new model').digest('hex');
 baseline.inventory.push({...source,file:'public'+catalog.assets[0].url});save('data/baseline.json',JSON.stringify(baseline));save('data/live.json',JSON.stringify(catalog));
 const result=run(['--read-only-content-source']);assert.equal(result.status,0,result.stderr);
 const patch=join(root,'data/oracle-patch-'+release),manifest=JSON.parse(readFileSync(join(patch,'PATCH.json')));assert.deepEqual(manifest.removed,[source]);
 save(baseline.release+'/RELEASE.json',JSON.stringify(baseline));for(const row of baseline.inventory)save(baseline.release+'/'+row.file,row.file.startsWith('content/')||row.file.includes('new-')?'new model':row.file.includes('old-')?'old':row.file.includes('known-hosts')?'public host':'decoder');
 copyFileSync(new URL('../tools/stage-oracle-delta.js',import.meta.url),join(root,'tools/stage-oracle-delta.js'));
 const staged=spawnSync(process.execPath,[join(root,'tools/stage-oracle-delta.js'),join(root,baseline.release),join(root,'candidate'),patch,baseline.release,release,catalog.revision,'13'],{encoding:'utf8',windowsHide:true});assert.equal(staged.status,0,staged.stderr);
 const record=JSON.parse(readFileSync(join(root,'candidate/RELEASE.json')));assert.equal(record.sourceContentDirectory,join(root,baseline.release,'content'));assert.equal(existsSync(join(root,'candidate/content')),false);assert.equal(readFileSync(join(record.sourceContentDirectory,'maps/example/model.glb'),'utf8'),'new model');
}));

test('content update restores independent canonical sources from a source-sharing baseline without reuploading published binaries',()=>fixture(({root,release,baseline,save,run})=>{
 baseline.sourceContentRelease='20981230-sources';baseline.inventory=baseline.inventory.filter(r=>!r.file.startsWith('content/'));save('data/baseline.json',JSON.stringify(baseline));
 save('content/maps/example/map.json',JSON.stringify({id:'example',model:'model.glb',texture:'../../shared-assets/retained.png'}));save('content/shared-assets/retained.png','old');
 save('content/maps/example/model.blend','editable source stays local');save('content/maps/retired/.disabled','disabled');save('content/maps/retired/map.json','{"id":"retired"}');
 assert.notEqual(run().status,0);
 const result=run(['--full-content-sources']);assert.equal(result.status,0,result.stderr);
 const patch=join(root,'data/oracle-patch-'+release),manifest=JSON.parse(readFileSync(join(patch,'PATCH.json'))),record=JSON.parse(readFileSync(join(patch,'RELEASE.json')));
 assert.equal(record.sourceContentRelease,undefined);assert.ok(manifest.files.some(r=>r.file==='content/maps/example/map.json'));
 assert.ok(manifest.files.some(r=>r.file==='content/maps/example/model.glb'));assert.ok(manifest.reuse.some(r=>r.file==='content/shared-assets/retained.png'&&r.sourceFile.startsWith('public/content/assets/')));
 assert.ok(record.inventory.every(r=>!r.file.includes('.blend')&&!r.file.includes('/retired/')));assert.deepEqual(manifest.removed,[]);
 for(const row of baseline.inventory)save(baseline.release+'/'+row.file,row.file.startsWith('public/content/assets/')?'old':row.file.includes('known-hosts')?'public host':'decoder');
 save(baseline.release+'/RELEASE.json',JSON.stringify(baseline));copyFileSync(new URL('../tools/stage-oracle-delta.js',import.meta.url),join(root,'tools/stage-oracle-delta.js'));
 const staged=spawnSync(process.execPath,[join(root,'tools/stage-oracle-delta.js'),join(root,baseline.release),join(root,'candidate'),patch,baseline.release,release,'new','13'],{encoding:'utf8',windowsHide:true});assert.equal(staged.status,0,staged.stderr);
 assert.equal(readFileSync(join(root,'candidate/content/shared-assets/retained.png'),'utf8'),'old');assert.equal(readFileSync(join(root,'candidate/content/maps/example/model.glb'),'utf8'),'new model');
 assert.equal(JSON.parse(readFileSync(join(root,'candidate/RELEASE.json'))).sourceContentDirectory,undefined);
}));
