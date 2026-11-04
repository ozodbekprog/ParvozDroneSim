import test from 'node:test';import assert from 'node:assert/strict';
import {checkpointSpawn,resetAtCheckpoint} from '../shared/flight-session.js';
import {validateCatalog} from '../shared/catalog-schema.js';
import catalog from '../public/content/catalog.json' with {type:'json'};
test('a source checkpoint can recover after its portal without crossing an obstacle farther ahead',()=>{
 const track={spawn:{position:[0,1,0],yaw:0},gates:[{position:[0,2,10],yaw:0,respawn:{position:[.5,2,10.5],yaw:0}}]};
 assert.deepEqual(checkpointSpawn(track,0,1),track.spawn);assert.deepEqual(checkpointSpawn(track,0,2),track.gates[0].respawn);
 const item={gate:0,lap:2,resetId:0};resetAtCheckpoint(item,{mode:'race',track});assert.deepEqual(item.state.position,[.5,2,10.5]);
 item.state.position[0]=99;assert.equal(track.gates[0].respawn.position[0],.5);
 delete track.gates[0].respawn;assert.deepEqual(checkpointSpawn(track,1).position,[0,2,11.3]);
});
test('content validation rejects a malformed authored checkpoint recovery pose',()=>{
 for(const respawn of [{position:[0,1],yaw:0},{position:[0,1,2],yaw:NaN},null]){
  const c=structuredClone(catalog);c.maps[0].tracks[0].gates[0].respawn=respawn;assert.throws(()=>validateCatalog(c),/gate respawn/);
 }
});
