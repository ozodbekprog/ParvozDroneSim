import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPackedCollisionTree,visitPackedCollisionTree} from '../shared/packed-collision-tree.js';

test('packed collision tree keeps exact coordinates and stable leaf order across transfer',()=>{
 const vertices=Array.from({length:65},(_,i)=>[i%3,0,0,i%3+1,0,0,i%3,1,0]).flat();
 vertices[0]=.123456789012345;
 const packed=buildPackedCollisionTree(vertices);
 assert.ok(packed.vertices instanceof Float64Array);
 assert.deepEqual([...packed.vertices],vertices);
 const expected=[];visitPackedCollisionTree(packed,()=>true,t=>expected.push(t.a.toArray()));
 assert.equal(expected.length,65);
 const buffers=[packed.vertices.buffer,packed.indices.buffer,packed.bounds.buffer,packed.nodes.buffer];
 const transferred=structuredClone(packed,{transfer:buffers}),actual=[];
 assert.equal(packed.vertices.byteLength,0);
 visitPackedCollisionTree(transferred,()=>true,t=>actual.push(t.a.toArray()));
 assert.deepEqual(actual,expected);
});

test('packed traversal excludes distant branches and handles empty geometry',()=>{
 const packed=buildPackedCollisionTree(Array.from({length:100},(_,i)=>[i*10,0,0,i*10+1,0,0,i*10,1,0]).flat());
 const visited=[];visitPackedCollisionTree(packed,bounds=>bounds.min.x<2,t=>visited.push(t.a.x));
 assert.ok(visited.length>0&&visited.length<=16);
 let count=0;visitPackedCollisionTree(buildPackedCollisionTree([]),()=>true,()=>count++);
 assert.equal(count,0);
});
