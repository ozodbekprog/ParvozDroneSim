import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {crc32} from 'node:zlib';
import {encodeCollisionBinary,decodeCollisionBinary,collisionFileFor} from '../shared/collision-binary.js';
import {prepareCollisionPayload,hydrateCollisionPayload} from '../shared/collision-preparation.js';
import {sphereContacts,sweepSphere} from '../shared/collision.js';
import {loadPreparedCollisions} from '../src/collision-preparation.js';
import {prepareMapCollisions} from '../src/map-collisions.js';
import {flightAssetURLs} from '../src/asset-progress.js';
import {sceneTrack} from '../shared/scene-content.js';

const source=()=>[
 {id:'floor-unchanged',type:'mesh',vertices:[-10,.123456789012345,-10,10,0,10,10,0,-10,-10,0,-10,-10,0,10,10,0,10]},
 {type:'capsule',position:[2,1,3],size:[1,3,1],radius:.5,halfLength:1,axis:1},
 {type:'mesh',vertices:Array.from({length:45},(_,i)=>[i,0,0,i+1,0,0,i,1,0]).flat()},
 {type:'mesh',vertices:[]},
];
const hash=colliders=>createHash('sha256').update(JSON.stringify(colliders)).digest('hex');
const encode=colliders=>encodeCollisionBinary(colliders,{sourceHash:hash(colliders)});

test('binary preserves authored precision, metadata and exact stable tree order',()=>{
 const colliders=source(),bytes=encode(colliders),binary=decodeCollisionBinary(bytes);
 const json=prepareCollisionPayload(new TextEncoder().encode(JSON.stringify(colliders))).payload;
 assert.equal(binary.sourceHash,hash(colliders));assert.equal(binary.colliders[0].id,'floor-unchanged');
 for(let i=0;i<colliders.length;i++)assert.deepEqual(colliders[i].type==='mesh'?{...binary.colliders[i],vertices:[...binary.colliders[i].vertices]}:binary.colliders[i],colliders[i]);
 for(let i=0;i<json.trees.length;i++)for(const key of ['vertices','indices','bounds','nodes'])assert.deepEqual(binary.trees[i].tree[key],json.trees[i].tree[key]);
 assert.equal(new DataView(bytes.buffer).getUint32(24,true),crc32(bytes.subarray(32)));
 assert.deepEqual(decodeCollisionBinary(encode([])).colliders,[]);
});

test('worker binary views transfer exactly one backing store and preserve contacts/sweeps',async()=>{
 const colliders=source(),bytes=encode(colliders),{payload,transfer}=prepareCollisionPayload(bytes);
 assert.equal(transfer.length,1);assert.equal(payload.timing.buildMs,0);assert.equal(payload.timing.format,'pcol-v1');
 const moved=structuredClone(payload,{transfer});assert.equal(bytes.byteLength,0);
 const restored=await loadPreparedCollisions('/test.pcol',{read:async()=>new ArrayBuffer(0),run:async()=>moved});
 const server=hydrateCollisionPayload(encode(colliders));
 for(const item of [restored[0],server[0]]){
  assert.deepEqual(sphereContacts([0,.05,0],.2,item),sphereContacts([0,.05,0],.2,colliders[0]));
  assert.deepEqual(sweepSphere([0,2,0],[0,-2,0],.2,item),sweepSphere([0,2,0],[0,-2,0],.2,colliders[0]));
 }
});

test('bad version, endian, truncation, body damage and cyclic trees fail before physics installation',async()=>{
 const good=encode(source());
 for(const offset of [8,12,good.length-1]){const bad=good.slice();bad[offset]^=1;assert.throws(()=>decodeCollisionBinary(bad));}
 assert.throws(()=>decodeCollisionBinary(good.slice(0,-1)));
 const cyclic=good.slice(),view=new DataView(cyclic.buffer),metadata=JSON.parse(new TextDecoder().decode(cyclic.subarray(32,32+view.getUint32(20,true))));
 const dataStart=Math.ceil((32+view.getUint32(20,true))/8)*8;
 view.setInt32(dataStart+metadata.records[2].arrays.nodes.offset,0,true);
 view.setUint32(24,crc32(cyclic.subarray(32)),true);
 assert.throws(()=>decodeCollisionBinary(cyclic),/Invalid prepared collision/);
 const obstacles={map:[]},before=obstacles.map,map={id:'map',colliders:[],collisionFile:'/old.json',preparedCollisionFile:'/bad.pcol'};
 await assert.rejects(prepareMapCollisions(map,'flight',{obstacles,prepare:url=>loadPreparedCollisions(url,{read:async()=>cyclic,run:async bytes=>prepareCollisionPayload(bytes).payload})}));
 assert.equal(obstacles.map,before);
});

test('only the selected binary is requested; legacy catalogs and Free Flight remain supported',()=>{
 const track={collisionFile:'/content/assets/race.json',preparedCollisionFile:'/content/assets/race.pcol'};
 const map={collisionFile:'/content/assets/map.json',preparedCollisionFile:'/content/assets/map.pcol',tracks:[track]};
 assert.deepEqual(flightAssetURLs(map,[],[],track),['/content/assets/map.pcol','/content/assets/race.pcol']);
 assert.deepEqual(flightAssetURLs(map,[],[],track,{course:false}),['/content/assets/map.pcol']);
 assert.equal(collisionFileFor(sceneTrack(track,false)),undefined);
 assert.equal(collisionFileFor({collisionFile:'/legacy.json'}),'/legacy.json');
});

test('unaligned views decode safely and unavailable source identity is rejected',()=>{
 const bytes=encode(source()),unaligned=new Uint8Array(bytes.length+1);unaligned.set(bytes,1);
 assert.equal(decodeCollisionBinary(unaligned.subarray(1)).sourceHash,hash(source()));
 assert.throws(()=>encodeCollisionBinary(source()),/source hash/);
});
