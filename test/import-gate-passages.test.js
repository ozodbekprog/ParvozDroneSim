import test from 'node:test';import assert from 'node:assert/strict';
import {prepareCollisions} from '../shared/collision.js';
import {gateCrossed} from '../shared/physics.js';
import {importedGatePassage} from '../tools/import-gate-passages.js';
const gate={position:[0,2,0],yaw:0,width:4,height:3};
test('source gate check finds a legal route beside a centre obstruction without moving the portal',()=>{
 const obstacles=[{position:[0,2,0],size:[.5,3,.5]}];prepareCollisions(obstacles);
 const original=structuredClone(gate),point=importedGatePassage(gate,obstacles,{collision:{spheres:[{position:[.22,0,0],radius:.07}]}});
 assert.ok(point);assert.ok(Math.abs(point[0])>.4);assert.equal(gateCrossed([point[0],point[1],-.3],[point[0],point[1],.3],gate),true);assert.deepEqual(gate,original);
});
test('source gate check refuses an aperture completely blocked by track scenery',()=>{
 const obstacles=[{position:[0,2,0],size:[5,4,1]}];prepareCollisions(obstacles);
 assert.equal(importedGatePassage(gate,obstacles,{}),null);
});
test('source gate check preserves tilted elliptical portal axes',()=>{
 const horizontal={...gate,aperture:'ellipse',axes:{right:[1,0,0],up:[0,0,1],normal:[0,1,0]}};
 const point=importedGatePassage(horizontal,[],{});assert.deepEqual(point,[0,2,0]);
 assert.equal(gateCrossed([0,1.7,0],[0,2.3,0],horizontal),true);
});
