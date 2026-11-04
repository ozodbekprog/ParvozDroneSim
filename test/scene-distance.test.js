import test from'node:test';import assert from'node:assert/strict';import{sceneDrawDistance}from'../src/scene-distance.js';
test('Low culls distant rendering without changing the map or flight bounds',()=>{
 const map={bounds:{min:[-1200,-3,-1200],max:[1200,30,1200]}},before=structuredClone(map);
 assert.equal(sceneDrawDistance(map,{quality:'low'}),180);
 assert.equal(sceneDrawDistance(map,{quality:'custom',lodMinimum:1}),180);
 assert.ok(sceneDrawDistance(map,{quality:'high'})>3000);assert.deepEqual(map,before);
});
