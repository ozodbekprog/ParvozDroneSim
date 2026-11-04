import test from 'node:test';
import assert from 'node:assert/strict';
import {Document} from '@gltf-transform/core';
import {EXTMeshGPUInstancing} from '@gltf-transform/extensions';
import {placedNodeBounds} from '../tools/map-delivery-bounds.js';

test('streaming bounds include hierarchy, placement rotation/scale and GPU instances',()=>{
 const d=new Document(),buffer=d.createBuffer();
 const position=d.createAccessor().setBuffer(buffer).setType('VEC3').setNormalized(true).setArray(new Uint16Array([0,0,0,65535,65535,0]));
 const mesh=d.createMesh().addPrimitive(d.createPrimitive().setAttribute('POSITION',position));
 const instances=d.createExtension(EXTMeshGPUInstancing).createInstancedMesh().setAttribute('TRANSLATION',d.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array([0,0,0,10,0,0])));
 const child=d.createNode().setMesh(mesh).setTranslation([1,0,0]).setExtension('EXT_mesh_gpu_instancing',instances);
 const root=d.createNode().setTranslation([99,99,99]).addChild(child);
 const bounds=placedNodeBounds(root,{position:[5,0,0],rotation:[0,0,Math.PI/2],scale:2});
 for(const [key,expected]of Object.entries({min:[3,2,0],max:[5,24,0]}))for(let i=0;i<3;i++)assert.ok(Math.abs(bounds[key][i]-expected[i])<1e-10);
 assert.equal(placedNodeBounds(d.createNode()),null);
});
