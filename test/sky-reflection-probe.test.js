import test from 'node:test';import assert from 'node:assert/strict';
import {Scene,Mesh,SphereGeometry,MeshBasicMaterial,Float32BufferAttribute} from 'three';
import {skyReflectionProbe} from '../src/sky-reflection-probe.js';
test('outdoor probe stays bounded and never owns or modifies map geometry/materials',()=>{
 const source=new Scene(),geometry=new SphereGeometry(100,8,4),colors=new Float32Array(geometry.attributes.position.count*3).fill(.8);
 geometry.setAttribute('color',new Float32BufferAttribute(colors,3));const material=new MeshBasicMaterial(),sky=new Mesh(geometry,material);sky.position.set(600,20,-300);source.add(sky);
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);material.addEventListener('dispose',()=>disposed++);
 const probe=skyReflectionProbe(sky,'#403020');assert.equal(probe.scene.children.length,1);assert.equal(sky.parent,source);assert.deepEqual(sky.position.toArray(),[600,20,-300]);
 assert.notEqual(probe.scene.children[0].geometry,geometry);assert.notEqual(probe.scene.children[0].material,material);assert.ok(probe.far>100);assert.deepEqual(probe.position.toArray(),[0,0,0]);
 assert.deepEqual(geometry.attributes.color.array,colors);probe.dispose();assert.equal(disposed,0);assert.equal(source.children[0],sky);
 assert.equal(skyReflectionProbe(null,'#403020'),null,'indoor maps keep their authored reflection capture');
});
