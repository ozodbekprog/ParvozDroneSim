import test from 'node:test';import assert from 'node:assert/strict';import {Document,Accessor} from '@gltf-transform/core';import {EXTMeshGPUInstancing} from '@gltf-transform/extensions';
import {quantizeReducedLODs} from '../tools/quantize-reduced-lods.js';import {fullDetailFingerprint} from '../tools/derive-map-lods.js';
test('reduced coordinate packing preserves full detail, UVs and compensated world positions',async()=>{
 const d=new Document(),buffer=d.createBuffer(),scene=d.createScene(),nodes=[];
 const positions=[120.25,4,-20,135.75,6,-18,125.25,8,-10],uv=new Float32Array([0,0,1,0,.5,1]);
 for(let level=0;level<3;level++){
  const mesh=d.createMesh('Level '+level).addPrimitive(d.createPrimitive().setAttribute('POSITION',d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC3).setArray(new Float32Array(positions))).setAttribute('TEXCOORD_0',d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC2).setArray(uv.slice())));
  const node=d.createNode('Chunk_0_LOD'+level).setMesh(mesh).setTranslation([50,2,20]);scene.addChild(node);nodes.push(node);
 }
 const before=fullDetailFingerprint(d);await quantizeReducedLODs(d);assert.equal(fullDetailFingerprint(d),before);
 for(const node of scene.listChildren().filter(n=>/_LOD[12]$/.test(n.getName()))){const primitive=node.getMesh().listPrimitives()[0],p=primitive.getAttribute('POSITION'),matrix=node.getWorldMatrix();assert.equal(p.getArray().BYTES_PER_ELEMENT,2);assert.deepEqual(primitive.getAttribute('TEXCOORD_0').getArray(),uv);
  for(let i=0;i<3;i++){const v=p.getElement(i,[]);for(let a=0;a<3;a++){const world=matrix[a]*v[0]+matrix[4+a]*v[1]+matrix[8+a]*v[2]+matrix[12+a];assert.ok(Math.abs(world-(positions[i*3+a]+[50,2,20][a]))<.001);}}
 }
});
test('packing keeps authored per-instance placement in reduced LODs',async()=>{
 const d=new Document(),buffer=d.createBuffer(),scene=d.createScene(),extension=d.createExtension(EXTMeshGPUInstancing),p=d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC3).setArray(new Float32Array([2,0,0,4,0,0,2,2,0]));
 const mesh=d.createMesh().addPrimitive(d.createPrimitive().setAttribute('POSITION',p));
 for(let level=0;level<3;level++){const batch=extension.createInstancedMesh().setAttribute('TRANSLATION',d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC3).setArray(new Float32Array([10,0,20])));scene.addChild(d.createNode('Chunk_0_LOD'+level).setMesh(mesh).setExtension('EXT_mesh_gpu_instancing',batch));}
 const before=fullDetailFingerprint(d);await quantizeReducedLODs(d);assert.equal(fullDetailFingerprint(d),before);
 const node=scene.listChildren().find(n=>n.getName()==='Chunk_0_LOD1'),batch=node.getExtension('EXT_mesh_gpu_instancing'),v=node.getMesh().listPrimitives()[0].getAttribute('POSITION').getElement(0,[]),t=batch.getAttribute('TRANSLATION').getElement(0,[]),s=batch.getAttribute('SCALE').getElement(0,[]);
 assert.ok(Math.abs(v[0]*s[0]+t[0]-12)<.001);assert.ok(Math.abs(v[2]*s[2]+t[2]-20)<.001);
});
