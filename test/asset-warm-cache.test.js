import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,CompressedTexture} from 'three';
import {Document,NodeIO,Accessor} from '@gltf-transform/core';
import {loadModel,hasLoadedModel,setModelCacheBudget,modelCacheStats} from '../src/asset-loader.js';
import {idleModelBudget,modelMemoryBytes} from '../src/model-memory.js';

test('a recently closed drone retains its parsed geometry for a bounded warm revisit',async()=>{
 const d=new Document(),buffer=d.createBuffer();
 const mesh=d.createMesh().addPrimitive(d.createPrimitive().setAttribute('POSITION',d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC3).setArray(new Float32Array([0,0,0,1,0,0,0,1,0]))));
 d.createScene().addChild(d.createNode().setMesh(mesh));
 const bytes=await new NodeIO().writeBinary(d),oldFetch=globalThis.fetch,oldLocation=globalThis.location;
 globalThis.location={href:'http://localhost/'};globalThis.fetch=async()=>new Response(bytes);
 try{
  const url='/content/assets/drones/warm/model-0123456789abcdef.glb',first=await loadModel(url);
  const geometry=first.children[0].geometry;let disposals=0;geometry.addEventListener('dispose',()=>disposals++);
  first.releaseAsset();
  assert.equal(disposals,0,'closing the preview must not immediately destroy a recently parsed small model');
  assert.equal(hasLoadedModel(url),true);
  const second=await loadModel(url);assert.equal(second.children[0].geometry,geometry,'revisit must skip GLTF parsing, not just HTTP');second.releaseAsset();
 }finally{globalThis.fetch=oldFetch;if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;}
});

test('idle eviction obeys the budget without disposing a live model',async()=>{
 const d=new Document(),buffer=d.createBuffer();d.createScene().addChild(d.createNode().setMesh(d.createMesh().addPrimitive(d.createPrimitive().setAttribute('POSITION',d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC3).setArray(new Float32Array([0,0,0,1,0,0,0,1,0]))))));
 const bytes=await new NodeIO().writeBinary(d),oldFetch=globalThis.fetch,oldLocation=globalThis.location;
 globalThis.location={href:'http://localhost/'};globalThis.fetch=async()=>new Response(bytes);
 try{
  setModelCacheBudget({bytes:0});const model=await loadModel('/active-cache-budget.glb');let disposals=0;
  model.children[0].geometry.addEventListener('dispose',()=>disposals++);
  setModelCacheBudget({bytes:0});assert.equal(disposals,0);
  model.releaseAsset();assert.equal(disposals,1);assert.equal(modelCacheStats().idleBytes,0);
  assert.equal(idleModelBudget(4),48*1024*1024);assert.equal(idleModelBudget(8),96*1024*1024);assert.equal(idleModelBudget(16),160*1024*1024);
 }finally{setModelCacheBudget({bytes:idleModelBudget(globalThis.navigator?.deviceMemory),entries:20});globalThis.fetch=oldFetch;if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;}
});

test('compressed KTX2 mipmaps use actual compressed byte size instead of 8x uncompressed RGBA estimate',()=>{
 const scene=new Group(),mip=new Uint8Array(1024*1024);
 const tex=new CompressedTexture([{data:mip,width:1024,height:1024}],1024,1024);
 scene.add(new Mesh(new BoxGeometry(1,1,1),new MeshStandardMaterial({map:tex})));
 const bytes=modelMemoryBytes({scene,scenes:[scene]});
 assert.ok(bytes<3*1024*1024,`expected compressed estimate <3 MiB, got ${bytes}`);
});
