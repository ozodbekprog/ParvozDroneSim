import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMapCollisions} from '../src/map-collisions.js';
import {sphereContacts} from '../shared/collision.js';

const box=()=>({position:[0,0,0],size:[2,2,2]});
const fixture=()=>({map:{id:'test-map',collisionFile:'/collision-a.json',colliders:[{position:[5,0,0],size:[1,1,1]}]},obstacles:{'test-map':[]}});

test('menu and Hangar previews never read or build map physics',async()=>{
 const {map,obstacles}=fixture(),before=obstacles[map.id];let reads=0;
 const options={obstacles,load:async()=>{reads++;return [box()];}};
 await prepareMapCollisions(map,'menu',options);await prepareMapCollisions(map,'preview',options);
 assert.equal(reads,0);assert.equal(obstacles[map.id],before);
 await prepareMapCollisions(map,'flight',options);
 assert.equal(reads,1);assert.equal(obstacles[map.id].length,2);
 assert.equal(obstacles[map.id][0],map.colliders[0]);
 assert.ok(sphereContacts([0,0,0],.1,obstacles[map.id][1]).length);
});

test('concurrent and repeated flights reuse prepared physics without duplicate colliders',async()=>{
 const {map,obstacles}=fixture();let finish,reads=0;
 const options={obstacles,load:()=>{reads++;return new Promise(resolve=>{finish=resolve;});}};
 const first=prepareMapCollisions(map,'flight',options),second=prepareMapCollisions(map,'flight',options);
 assert.equal(first,second);await Promise.resolve();assert.equal(reads,1);
 finish([box()]);await first;const prepared=obstacles[map.id];
 await prepareMapCollisions(map,'flight',options);assert.equal(reads,1);assert.equal(obstacles[map.id],prepared);
});

test('failed or invalid collision data cannot unlock flight and can be retried',async()=>{
 const {map,obstacles}=fixture(),before=obstacles[map.id];let reads=0;
 const options={obstacles,load:async()=>{if(++reads===1)throw Error('Disconnected');if(reads===2)return [{type:'mesh',vertices:[0,0]}];return [box()];}};
 await assert.rejects(prepareMapCollisions(map,'flight',options),/Disconnected/);
 assert.equal(obstacles[map.id],before);
 await assert.rejects(prepareMapCollisions(map,'flight',options));assert.equal(obstacles[map.id],before);
 await prepareMapCollisions(map,'flight',options);assert.equal(reads,3);assert.equal(obstacles[map.id].length,2);
});

test('catalog replacement invalidates prepared physics and an old completion cannot overwrite a newer file',async()=>{
 const {map,obstacles}=fixture();let finishOld;
 const old=prepareMapCollisions(map,'flight',{obstacles,load:()=>new Promise(resolve=>{finishOld=resolve;})});
 await Promise.resolve();map.collisionFile='/collision-b.json';
 const fresh={position:[8,0,0],size:[1,1,1]};
 await prepareMapCollisions(map,'flight',{obstacles,load:async()=>[fresh]});const installed=obstacles[map.id];
 finishOld([box()]);await assert.rejects(old,{name:'AbortError'});assert.equal(obstacles[map.id],installed);
 obstacles[map.id]=[];let reads=0;
 await prepareMapCollisions(map,'flight',{obstacles,load:async()=>{reads++;return [box()];}});
 assert.equal(reads,1);assert.notEqual(obstacles[map.id],installed);
});
