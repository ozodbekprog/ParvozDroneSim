import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCollisionPayload} from '../shared/collision-preparation.js';
import {sphereContacts,sweepSphere,prepareCollisionsAsync,collisionCandidates} from '../shared/collision.js';
import {runCollisionWorker,loadPreparedCollisions} from '../src/collision-preparation.js';
import {prepareMapCollisions,releaseMapCollisions} from '../src/map-collisions.js';

const geometry=()=>[{type:'mesh',vertices:[-10,0,-10,10,0,10,10,0,-10,-10,0,-10,-10,0,10,10,0,10]}];
const encode=value=>new TextEncoder().encode(JSON.stringify(value)).buffer;

test('worker payload preserves contacts and sweeps, installing transferable trees',async()=>{
 const original=geometry(),bytes=encode(original),payload=prepareCollisionPayload(bytes);
 const moved=structuredClone(payload.payload,{transfer:payload.transfer});
 const installed=await loadPreparedCollisions('/test.json',{read:async()=>bytes,run:async()=>moved});
 assert.ok(installed[0].vertices instanceof Float64Array);
 assert.deepEqual(sphereContacts([0,.05,0],.2,installed[0]),sphereContacts([0,.05,0],.2,original[0]));
 assert.deepEqual(sweepSphere([0,2,0],[0,-2,0],.2,installed[0]),sweepSphere([0,2,0],[0,-2,0],.2,original[0]));
 assert.deepEqual(collisionCandidates(installed,[0,.05,0],.2),installed);
 assert.throws(()=>prepareCollisionPayload(encode([{type:'mesh',vertices:[NaN]}])));
});

test('cancel terminates the worker, preserves cached bytes and rejects stale completion',async()=>{
 const abort=new AbortController(),bytes=encode(geometry());let worker,terminated=0;
 const promise=runCollisionWorker(bytes,{signal:abort.signal,createWorker:()=>worker={terminate:()=>terminated++,postMessage:(copy,transfer)=>{structuredClone(copy,{transfer});}}});
 assert.ok(bytes.byteLength>0,'cache buffer must not be detached');
 abort.abort();await assert.rejects(promise,{name:'AbortError'});assert.equal(terminated,1);
 worker.onmessage({data:{ok:true}});assert.equal(terminated,1);
});

test('worker errors terminate resources and allow a later retry',async()=>{
 let worker,terminated=0;
 const createWorker=()=>worker={terminate:()=>terminated++,postMessage:()=>{}};
 const bad=runCollisionWorker(encode(geometry()),{createWorker});
 worker.onmessage({data:{ok:false,message:'Invalid collision triangles'}});
 await assert.rejects(bad,/Invalid collision triangles/);assert.equal(terminated,1);
 const good=runCollisionWorker(encode(geometry()),{createWorker});worker.onmessage({data:{ok:true,colliders:[]}});
 assert.deepEqual((await good).colliders,[]);assert.equal(terminated,2);
});

test('asynchronous index build yields and cancellation never installs partial physics',async()=>{
 const obstacles=Array.from({length:1000},(_,i)=>({position:[i*2,0,0],size:[1,1,1]}));
 const abort=new AbortController();let yields=0;
 await assert.rejects(prepareCollisionsAsync(obstacles,{signal:abort.signal,budgetMs:0,yieldTask:async()=>{yields++;abort.abort();}}),{name:'AbortError'});
 assert.equal(yields,1);
 await prepareCollisionsAsync(obstacles,{budgetMs:0,yieldTask:async()=>{yields++;}});
 assert.ok(yields>2);assert.deepEqual(collisionCandidates(obstacles,[0,0,0],.2),[obstacles[0]]);
});

test('retiring a map releases its decoded collision store without losing inline colliders',async()=>{
 const map={id:'test-map',collisionFile:'/test.json',colliders:[{position:[20,0,0],size:[1,1,1]}]},obstacles={};
 await prepareMapCollisions(map,'flight',{obstacles,load:async()=>geometry()});assert.equal(obstacles[map.id].length,2);
 releaseMapCollisions(map,obstacles);assert.equal(obstacles[map.id],map.colliders);
 let reads=0;await prepareMapCollisions(map,'flight',{obstacles,load:async()=>{reads++;return geometry();}});assert.equal(reads,1);
});

test('ending a completed loading session retains reusable physics but an aborted pending job retries',async()=>{
 const map={id:'test-map',collisionFile:'/test.json',colliders:[]},obstacles={},abort=new AbortController();let reads=0;
 const load=async()=>{reads++;return geometry();};
 await prepareMapCollisions(map,'flight',{obstacles,load,signal:abort.signal});abort.abort();
 await prepareMapCollisions(map,'flight',{obstacles,load});assert.equal(reads,1);
 releaseMapCollisions(map,obstacles);
 const cancelled=new AbortController();cancelled.abort();
 await assert.rejects(prepareMapCollisions(map,'flight',{obstacles,load,signal:cancelled.signal}),{name:'AbortError'});
 await prepareMapCollisions(map,'flight',{obstacles,load});assert.equal(obstacles[map.id].length,1);
});
