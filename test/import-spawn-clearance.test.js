import test from 'node:test';import assert from 'node:assert/strict';
import {clearImportedSpawn} from '../tools/import-spawn-clearance.js';
test('imported start height clears a raised pad without moving its source position or heading',()=>{
 const spawn={position:[3,.3,4],yaw:.7},pad={position:[3,0,4],size:[2,.4,2],visible:false};
 const result=clearImportedSpawn(spawn,[pad],{spheres:[{position:[.25,0,0],radius:.13}]});
 assert.ok(result.lift>=.08&&result.lift<=.09);assert.equal(result.spawn.position[0],3);assert.equal(result.spawn.position[2],4);assert.equal(result.spawn.yaw,.7);
 assert.deepEqual(spawn.position,[3,.3,4]);assert.equal(clearImportedSpawn(result.spawn,[pad]).lift,0);
});
test('imported start clearance includes offset propeller contacts',()=>{
 const result=clearImportedSpawn({position:[0,.4,0],yaw:Math.PI/2},[{position:[0,.3,-.25],size:[.1,.2,.1]}],{spheres:[{position:[.25,0,0],radius:.07}]});
 assert.ok(result.lift>.07);assert.equal(result.spawn.position[0],0);
});
test('blocked imported starts fail instead of moving across the map',()=>{
 assert.throws(()=>clearImportedSpawn({position:[0,.3,0],yaw:0},[{position:[0,1,0],size:[3,3,3]}]),/cannot be cleared/);
});
