import test from 'node:test';import assert from 'node:assert/strict';
import {validateIncrementalAssetBudget,validateSharedAssetMount,validateReleaseAssetHash,validateRetainedAsset,validateIncrementalLock} from '../deploy/incremental-budget.js';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const MiB=1024*1024;

test('explicit production reuse allows dev-only additions but rejects any runtime change',()=>{
 const previous={lockfileVersion:3,packages:{'':{dependencies:{three:'0.180.0'},devDependencies:{}},'node_modules/three':{version:'0.180.0',integrity:'runtime'}}};
 const next=structuredClone(previous);next.packages[''].devDependencies.qa='1';next.packages['node_modules/qa']={version:'1',dev:true,integrity:'qa'};
 assert.throws(()=>validateIncrementalLock(previous,next),/Resolved packages changed/);
 validateIncrementalLock(previous,next,{productionOnly:true});
 for(const mutate of [x=>x.packages['node_modules/three'].integrity='changed',x=>x.packages['node_modules/qa'].dev=false,x=>x.packages[''].dependencies.three='new',x=>delete x.packages['node_modules/three']]){const changed=structuredClone(next);mutate(changed);assert.throws(()=>validateIncrementalLock(previous,changed,{productionOnly:true}),/Resolved packages changed/);}
 assert.throws(()=>validateIncrementalLock(previous,next,{productionOnly:'1'}),/explicit/);
});

test('prepared collision deliveries retain content-addressed byte verification',()=>{
 const sha256=createHash('sha256').update('collision fixture').digest('hex'),url='/content/assets/maps/example/collision-'+sha256.slice(0,16)+'.pcol',bytes=17,inventory=[{file:'public'+url,bytes,sha256}];
 validateReleaseAssetHash({url,bytes,sha256,inventory});validateRetainedAsset({asset:{url,bytes},currentAssets:[],inventory,sha256});
 const changed='a'.repeat(64);assert.throws(()=>validateReleaseAssetHash({url,bytes,sha256:changed,inventory:[{file:'public'+url,bytes,sha256:changed}]}),/differs from its URL/);
});

test('image reuse permits a root dev declaration only when all resolved package bytes stay locked',()=>{
 const previous={name:'example',lockfileVersion:3,packages:{'':{name:'example',dependencies:{three:'0.180.0'},devDependencies:{tool:'1.0.0'}},'node_modules/three':{version:'0.180.0',integrity:'runtime'},'node_modules/ktx-parse':{version:'1.1.0',dev:true,integrity:'tool'}}};
 const next=structuredClone(previous);next.packages[''].devDependencies['ktx-parse']='1.1.0';
 validateIncrementalLock(previous,next);
 assert.deepEqual(previous.packages[''].devDependencies,{tool:'1.0.0'},'Validation does not mutate the previous release');
 for(const mutate of [x=>x.packages[''].dependencies.three='0.186.1',x=>x.packages['node_modules/three'].version='0.186.1',x=>x.packages['node_modules/ktx-parse'].integrity='changed',x=>x.packages['node_modules/new-tool']={version:'1'},x=>x.name='other']){
  const changed=structuredClone(next);mutate(changed);assert.throws(()=>validateIncrementalLock(previous,changed),/Resolved packages changed/);
 }
 assert.throws(()=>validateIncrementalLock(previous,{...next,lockfileVersion:2}),/version 3/);
});
test('a superseded immutable URL stays available for old clients and rollback',()=>{
 const asset={url:'/content/assets/maps/pine/model-0123456789abcdef.glb',bytes:100},sha256='a'.repeat(64),inventory=[{file:'public'+asset.url,bytes:100,sha256}];
 validateRetainedAsset({asset,currentAssets:[asset],inventory:[],sha256});
 validateRetainedAsset({asset,currentAssets:[],inventory,sha256});
 for(const rows of [[],[{...inventory[0],bytes:99}],[{...inventory[0],sha256:'b'.repeat(64)}]])assert.throws(()=>validateRetainedAsset({asset,currentAssets:[],inventory:rows,sha256}),/must remain byte-identical/);
});
test('ordinary incremental updates keep the original small default',()=>{
 assert.deepEqual(validateIncrementalAssetBudget({bytes:128*MiB,available:1280*MiB}),{maximumMiB:128});
 assert.throws(()=>validateIncrementalAssetBudget({bytes:129*MiB,available:4096*MiB}),/selected incremental build budget/);
});
test('the measured two-map payload needs explicit allowance and full temporary disk reserve',()=>{
 const bytes=859091848,required=bytes*5+512*MiB;
 assert.throws(()=>validateIncrementalAssetBudget({bytes,available:required,maximumMiB:512}),/selected incremental build budget/);
 assert.deepEqual(validateIncrementalAssetBudget({bytes,available:required,maximumMiB:'1024'}),{maximumMiB:1024});
 assert.throws(()=>validateIncrementalAssetBudget({bytes,available:required-1,maximumMiB:1024}),/Insufficient disk/);
 // The real containerd build exhausted disk despite passing the old 3x guard.
 assert.throws(()=>validateIncrementalAssetBudget({bytes,available:3497996288,maximumMiB:1024}),/Insufficient disk/);
});
test('unbounded, malformed and fractional deployment overrides are rejected',()=>{
 for(const maximumMiB of [0,127,1025,128.5,Infinity,'unlimited'])assert.throws(()=>validateIncrementalAssetBudget({bytes:0,available:4096*MiB,maximumMiB}),/128 to 1024/);
});

test('shared delivery retains the payload cap and space reserve while omitting asset copies',()=>{
 assert.deepEqual(validateIncrementalAssetBudget({bytes:859091848,available:512*MiB,maximumMiB:1024,sharedAssets:true}),{maximumMiB:1024});
 assert.throws(()=>validateIncrementalAssetBudget({bytes:859091848,available:512*MiB-1,maximumMiB:1024,sharedAssets:true}),/Insufficient disk/);
 assert.throws(()=>validateIncrementalAssetBudget({bytes:1025*MiB,available:4096*MiB,maximumMiB:1024,sharedAssets:true}),/selected incremental build budget/);
 assert.throws(()=>validateIncrementalAssetBudget({bytes:0,available:4096*MiB,sharedAssets:'1'}),/explicit/);
});

test('shared delivery permits only the precise public asset folder as a read-only bind',()=>{
 const root=resolve('data/release-fixture'),source=resolve(root,'public/content/assets');
 const mount={type:'bind',source,target:'/app/public/content/assets',read_only:true},config=volume=>({services:{game:{volumes:[volume]}}});
 assert.equal(validateSharedAssetMount(config(mount),root),source);
 for(const bad of [{...mount,read_only:false},{...mount,type:'volume'},{...mount,source:resolve(root,'public')},{...mount,source:resolve(root,'deploy')},{...mount,target:'/app/public'},{...mount,source:'./public/content/assets'}])assert.throws(()=>validateSharedAssetMount(config(bad),root),/exact release asset directory/);
 assert.throws(()=>validateSharedAssetMount({},root),/exact release asset directory/);
 assert.throws(()=>validateSharedAssetMount({services:{game:{volumes:[mount,mount]}}},root),/one exact release asset directory/);
});

test('readable collision JSON verifies actual bytes against the release rather than its compact-content URL',()=>{
 const value=[{position:[1,2,3],size:[2,1,4]}],hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const delivery=Buffer.from(JSON.stringify(value,null,2)),sha256=hash(delivery),url='/content/assets/maps/example/collision-'+hash(JSON.stringify(value)).slice(0,16)+'.json';
 assert.ok(!sha256.startsWith(url.match(/-([a-f0-9]{16})\./)[1]));
 const inventory=[{file:'public'+url,bytes:delivery.length,sha256}];
 validateReleaseAssetHash({url,bytes:delivery.length,sha256,inventory});
 assert.throws(()=>validateReleaseAssetHash({url,bytes:delivery.length,sha256:hash('tampered'),inventory}),/verified release inventory/);
 assert.throws(()=>validateReleaseAssetHash({url,bytes:delivery.length-1,sha256,inventory}),/verified release inventory/);
 const binaryUrl='/content/assets/maps/example/model-'+sha256.slice(0,16)+'.glb';
 validateReleaseAssetHash({url:binaryUrl,bytes:delivery.length,sha256,inventory:[{file:'public'+binaryUrl,bytes:delivery.length,sha256}]});
 assert.throws(()=>validateReleaseAssetHash({url:binaryUrl,bytes:delivery.length,sha256:hash('other'),inventory:[{file:'public'+binaryUrl,bytes:delivery.length,sha256:hash('other')}]}),/differs from its URL/);
});
