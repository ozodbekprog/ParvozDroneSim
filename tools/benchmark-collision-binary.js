import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {prepareCollisionPayload} from '../shared/collision-preparation.js';
import {installCollisionTree,sphereContacts,sweepSphere} from '../shared/collision.js';
import {loadPreparedCollisions} from '../src/collision-preparation.js';

if(!isMainThread){
 try{const {payload,transfer}=prepareCollisionPayload(workerData.bytes);parentPort.postMessage(payload,transfer);}
 catch(error){throw error;}
}else{
 const catalog=JSON.parse(readFileSync('public/content/catalog.json','utf8'));
 const [mode,arg,format]=process.argv.slice(2);
 const maps=catalog.maps.filter(map=>map.collisionFile&&map.preparedCollisionFile);
 if(mode==='--sample'){
  const map=maps.find(map=>map.id===arg);if(!map)throw Error('Unknown map');
  const url=format==='binary'?map.preparedCollisionFile:map.collisionFile,start=performance.now(),raw=readFileSync('public'+url);
  const bytes=raw.byteOffset===0&&raw.byteLength===raw.buffer.byteLength?raw.buffer:raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
  const readMs=performance.now()-start,baseline=process.memoryUsage();let copyMs=0,workerTiming;
  const preparationStart=performance.now();
  const colliders=await loadPreparedCollisions(url,{read:async()=>bytes,run:input=>new Promise((resolve,reject)=>{
   const copyStart=performance.now(),copy=input.slice(0);copyMs=performance.now()-copyStart;
   const worker=new Worker(new URL(import.meta.url),{workerData:{bytes:copy},transferList:[copy]});
   worker.once('error',reject);worker.once('message',async payload=>{workerTiming=payload.timing;await worker.terminate();resolve(payload);});
  })});
  const preparationMs=performance.now()-preparationStart,active=process.memoryUsage();
  console.log(JSON.stringify({map:map.id,format,inputBytes:bytes.byteLength,readMs,copyMs,preparationMs,totalMs:readMs+preparationMs,workerTiming,colliders:colliders.length,baseline,active,maxRSSBytes:process.resourceUsage().maxRSS*1024}));
 }else if(mode==='--parity'){
  const map=maps.find(map=>map.id===arg);if(!map)throw Error('Unknown map');
  const legacy=readFileSync('public'+map.collisionFile),binary=readFileSync('public'+map.preparedCollisionFile);
  const a=prepareCollisionPayload(legacy).payload,b=prepareCollisionPayload(binary).payload;
  assert.equal(a.colliders.length,b.colliders.length);assert.equal(a.trees.length,b.trees.length);
  for(let i=0;i<a.colliders.length;i++){
   const {vertices:av,...am}=a.colliders[i],{vertices:bv,...bm}=b.colliders[i];assert.deepEqual(am,bm);
   if(av)assert.ok(Buffer.from(av.buffer,av.byteOffset,av.byteLength).equals(Buffer.from(bv.buffer,bv.byteOffset,bv.byteLength)));
  }
  let queries=0;
  for(let i=0;i<a.trees.length;i++){
   const at=a.trees[i],bt=b.trees[i];assert.equal(at.index,bt.index);
   for(const key of ['vertices','indices','bounds','nodes']){const av=at.tree[key],bv=bt.tree[key];assert.ok(Buffer.from(av.buffer,av.byteOffset,av.byteLength).equals(Buffer.from(bv.buffer,bv.byteOffset,bv.byteLength)),key);}
   installCollisionTree(a.colliders[at.index],at.tree);installCollisionTree(b.colliders[bt.index],bt.tree);
   if(i%Math.max(1,Math.floor(a.trees.length/256))===0&&at.tree.vertices.length){
    const v=at.tree.vertices,point=[0,1,2].map(axis=>(v[axis]+v[axis+3]+v[axis+6])/3);
    const from=point.map((n,axis)=>n+(axis===1?.5:0)),to=point.map((n,axis)=>n-(axis===1?.5:0));
    assert.deepEqual(sphereContacts(point,.2,a.colliders[at.index]),sphereContacts(point,.2,b.colliders[bt.index]));
    assert.deepEqual(sweepSphere(from,to,.2,a.colliders[at.index]),sweepSphere(from,to,.2,b.colliders[bt.index]));queries+=2;
   }
  }
  console.log(JSON.stringify({map:map.id,allArraysByteIdentical:true,colliderMetadataIdentical:true,contactAndSweepQueries:queries,jsonBytes:legacy.length,binaryBytes:binary.length,jsonGzipBytes:gzipSync(legacy).length,binaryGzipBytes:gzipSync(binary).length}));
 }else{
  const output=mode,repeats=Number(arg||'2');if(!output||!Number.isInteger(repeats)||repeats<1||repeats>10)throw Error('Usage: node tools/benchmark-collision-binary.js result.json [1..10 repeats]');
  const run=args=>{const child=spawnSync(process.execPath,[import.meta.filename,...args],{encoding:'utf8',maxBuffer:2**20,windowsHide:true});if(child.status!==0)throw Error(child.stderr||'Collision benchmark failed');return JSON.parse(child.stdout.trim());};
  const parity=[],samples=[];
  for(const map of maps){
   parity.push(run(['--parity',map.id]));
   for(let repeat=0;repeat<repeats;repeat++)for(const arm of repeat%2?['binary','json']:['json','binary'])samples.push({...run(['--sample',map.id,arm]),repeat});
   console.log('Completed collision comparison: '+map.id);
  }
  const report={checkedAt:new Date().toISOString(),node:process.version,method:'Each timing sample uses a fresh Node process and an actual worker transfer/install. Alternating arm order. Warm OS disk cache; not browser network, frame time, GPU or UHD 620 acceptance. maxRSS is process high-water including worker; arrayBuffers/heap are main-isolate samples, not all worker memory. Gzip bytes are offline comparisons, not measured network time.',repeats,parity,samples};
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 }
}
