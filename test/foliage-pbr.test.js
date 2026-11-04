import test from 'node:test';import assert from 'node:assert/strict';import {unpackFoliageNormal,foliageRoughness} from '../tools/foliage-pbr.js';
test('packed tree normals use alpha/green and reconstruct a finite positive Z',()=>{
 const input=new Uint8Array([12,128,54,128,200,255,0,255]),before=input.slice(),normal=unpackFoliageNormal(input);
 assert.deepEqual([...normal.slice(0,4)],[128,128,255,255]);assert.deepEqual([...normal.slice(4)],[255,255,128,255]);assert.deepEqual(input,before);
});
test('tree alpha gloss and AFS blue smoothness produce correct roughness/metalness channels',()=>{
 const input=new Uint8Array([20,70,255,0,0,0,0,255]);assert.deepEqual([...foliageRoughness(input)],[255,255,0,255,255,0,0,255]);assert.deepEqual([...foliageRoughness(input,{channel:2})],[255,0,0,255,255,255,0,255]);
});
