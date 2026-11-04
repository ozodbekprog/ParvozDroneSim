import test from 'node:test';import assert from 'node:assert/strict';
import {Group,Mesh,BufferGeometry,BufferAttribute,InterleavedBuffer,InterleavedBufferAttribute} from 'three';
import {normalizePackedVertexAttributes} from '../src/packed-vertex-attributes.js';
test('packed normalized vectors retain values, bounds and sharing on four-byte GPU records',()=>{
 const root=new Group(),geometry=new BufferGeometry(),position=new BufferAttribute(new Int16Array([-32768,0,32767,16384,-16384,0]),3,true);
 geometry.setAttribute('position',position);geometry.computeBoundingBox();const bounds=geometry.boundingBox.clone();
 root.add(new Mesh(geometry),new Mesh(geometry));const original=position.array.slice();
 assert.equal(normalizePackedVertexAttributes([root]),1);const next=geometry.getAttribute('position');
 assert.equal(next.itemSize,3);assert.equal(next.count,2);assert.equal(next.normalized,false);assert.equal(next.array.BYTES_PER_ELEMENT*next.itemSize%4,0);
 for(let i=0;i<2;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(next.getComponent(i,j)-position.getComponent(i,j))<1e-7);
 geometry.computeBoundingBox();assert.ok(geometry.boundingBox.min.distanceTo(bounds.min)<1e-7);assert.ok(geometry.boundingBox.max.distanceTo(bounds.max)<1e-7);
 assert.deepEqual(position.array,original);assert.equal(root.children[0].geometry,root.children[1].geometry);assert.equal(normalizePackedVertexAttributes([root]),0);
});
test('interleaved byte UVs and morph attributes decode without damaging adjacent attributes or indices',()=>{
 const root=new Group(),geometry=new BufferGeometry(),data=new InterleavedBuffer(new Uint8Array([0,255,55,0,128,64,77,0]),4);
 const uv=new InterleavedBufferAttribute(data,2,0,true),color=new BufferAttribute(new Uint8Array([10,20,30,255,40,50,60,255]),4,true);
 geometry.setAttribute('uv',uv);geometry.setAttribute('color',color);geometry.setIndex([0,1,0]);const index=geometry.index;
 geometry.morphAttributes.normal=[new BufferAttribute(new Int8Array([-128,0,127,0,127,0]),3,true)];root.add(new Mesh(geometry));
 assert.equal(normalizePackedVertexAttributes([root]),2);assert.equal(geometry.attributes.uv.getY(0),1);assert.ok(Math.abs(geometry.attributes.uv.getX(1)-128/255)<1e-7);
 assert.equal(geometry.attributes.color,color);assert.equal(geometry.index,index);assert.equal(geometry.morphAttributes.normal[0].getX(0),-1);assert.equal(geometry.morphAttributes.normal[0].getZ(0),1);
});
