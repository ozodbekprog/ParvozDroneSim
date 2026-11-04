import test from 'node:test';
import assert from 'node:assert/strict';
import {courseEnabled,sceneTrack} from '../shared/scene-content.js';
import {AssetByteCache} from '../src/asset-byte-cache.js';
import {isImportedSceneryMarker,suppressImportedSceneryMarkers} from '../src/imported-scenery.js';
import {Group,Object3D} from 'three';
test('Free Flight strips course geometry and physics while activities retain them',()=>{
 const track={spawn:{position:[1,2,3]},objects:[{model:'route.glb'}],gates:[{}],colliders:[{}],collisionFile:'route.json'};
 const free=sceneTrack(track,courseEnabled({mode:'training'}));
 assert.deepEqual(free.spawn,track.spawn);assert.deepEqual(free.objects,[]);assert.deepEqual(free.gates,[]);assert.deepEqual(free.colliders,[]);assert.equal(free.collisionFile,undefined);
 for(const activity of [{mode:'race'},{mode:'training',tutorial:{}},{mode:'training',challenge:{}},{mode:'training',sceneCourse:true}])assert.equal(sceneTrack(track,courseEnabled(activity)),track);
 assert.equal(track.gates.length,1);
});
test('route byte cache evicts least recently used data and ignores unversioned or oversized assets',()=>{
 const cache=new AssetByteCache(10),url=n=>`/content/assets/route-${n.repeat(16)}.glb`;
 cache.set(url('a'),new ArrayBuffer(4));cache.set(url('b'),new ArrayBuffer(4));cache.get(url('a'));cache.set(url('c'),new ArrayBuffer(4));
 assert.equal(cache.has(url('b')),false);assert.equal(cache.has(url('a')),true);assert.equal(cache.bytes,8);
 cache.set('/route.glb',new ArrayBuffer(1));cache.set(url('d'),new ArrayBuffer(11));assert.equal(cache.bytes,8);assert.equal(cache.entries.size,2);
});
test('source marker suppression targets placeholders across LOD names without hiding real scenery',()=>{
 const group=new Group();
 for(const name of ['Runtime PlayerDummy01','Low Runtime DroneDummy01','Far Repeated PowerBox01','Runtime Warehouse']){const obj=new Object3D();obj.name=name;group.add(obj);}
 suppressImportedSceneryMarkers(group);
 for(const obj of group.children)assert.equal(obj.visible,!isImportedSceneryMarker(obj.name));
 assert.equal(group.children.at(-1).visible,true);
});
