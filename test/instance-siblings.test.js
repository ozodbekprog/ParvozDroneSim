import test from 'node:test';import assert from 'node:assert/strict';
import {Document} from '@gltf-transform/core';import {uninstance} from '@gltf-transform/functions';
import {instanceSiblings} from '../tools/instance-siblings.js';
test('spatial instances retain each LOD parent and original placements',async()=>{
 const d=new Document(),b=d.createBuffer(),p=d.createPrimitive().setAttribute('POSITION',d.createAccessor().setBuffer(b).setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0]))),m=d.createMesh('tree').addPrimitive(p),scene=d.createScene();
 const parents=[d.createNode('LOD0').setTranslation([100,0,0]),d.createNode('LOD1').setTranslation([-100,0,0])];parents.forEach(p=>scene.addChild(p));
 for(const parent of parents)for(const x of [2,4])parent.addChild(d.createNode().setMesh(m).setTranslation([x,3,5]).setScale([1,2,1]));
 assert.deepEqual(instanceSiblings(d),{batches:2,instances:4});
 assert.equal(d.getRoot().listExtensionsRequired()[0].extensionName,'EXT_mesh_gpu_instancing');
 for(const parent of parents){assert.equal(parent.listChildren().length,1);const node=parent.listChildren()[0],batch=node.getExtension('EXT_mesh_gpu_instancing');assert.equal(node.getParentNode(),parent);assert.deepEqual(batch.getAttribute('TRANSLATION').getElement(1,[]),[4,3,5]);}
 await d.transform(uninstance());
 for(const parent of parents){const meshes=[];parent.traverse(n=>{if(n.getMesh())meshes.push(n)});const xs=meshes.map(n=>n.getWorldTranslation()[0]).sort((a,b)=>a-b);assert.deepEqual(xs,parent.getName()==='LOD0'?[102,104]:[-98,-96]);assert.ok(meshes.every(n=>n.getScale()[1]===2));}
});
