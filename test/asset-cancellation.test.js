import test from'node:test';import assert from'node:assert/strict';
import{Document,NodeIO,Accessor}from'@gltf-transform/core';import{loadModel}from'../src/asset-loader.js';
test('revisiting a hashed route reuses encoded bytes after releasing GPU resources',async()=>{
 const d=new Document(),buffer=d.createBuffer(),mesh=d.createMesh().addPrimitive(d.createPrimitive().setAttribute('POSITION',d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC3).setArray(new Float32Array([0,0,0,1,0,0,0,1,0]))));
 d.createScene().addChild(d.createNode().setMesh(mesh));const bytes=await new NodeIO().writeBinary(d),originalFetch=globalThis.fetch,originalLocation=globalThis.location;let requests=0;
 globalThis.location={href:'http://localhost/'};globalThis.fetch=async()=>{requests++;return new Response(bytes);};
 try{
  const url='/content/assets/races/revisit/props-1234567890abcdef.glb';const first=await loadModel(url);first.releaseAsset();
  const second=await loadModel(url);second.releaseAsset();assert.equal(requests,1);
 }finally{globalThis.fetch=originalFetch;if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;}
});
test('canceling a stale scene retains a shared download, but the final cancellation aborts it and permits retry',async()=>{
 const originalFetch=globalThis.fetch,originalLocation=globalThis.location,d=new Document(),buffer=d.createBuffer();
 const p=d.createPrimitive().setAttribute('POSITION',d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC3).setArray(new Float32Array([0,0,0,1,0,0,0,1,0]))),mesh=d.createMesh().addPrimitive(p);d.createScene().addChild(d.createNode().setMesh(mesh));const bytes=await new NodeIO().writeBinary(d),requests=[];
 globalThis.location={href:'http://localhost/'};
 globalThis.fetch=(url,{signal})=>new Promise((yes,no)=>{requests.push({url,signal,yes});signal.addEventListener('abort',()=>no(Object.assign(new Error('Canceled'),{name:'AbortError'})));});
 try{
  const a=new AbortController(),b=new AbortController(),first=loadModel('/shared-cancel.glb',undefined,{signal:a.signal}),second=loadModel('/shared-cancel.glb',undefined,{signal:b.signal});const failed=assert.rejects(first,{name:'AbortError'});
  await new Promise(resolve=>setImmediate(resolve));a.abort();assert.equal(requests.length,1);assert.equal(requests[0].signal.aborted,false);requests[0].yes(new Response(bytes));const model=await second;await failed;model.releaseAsset();
  const c=new AbortController(),third=loadModel('/retry-cancel.glb',undefined,{signal:c.signal}),canceled=assert.rejects(third,{name:'AbortError'});await new Promise(resolve=>setImmediate(resolve));c.abort();assert.equal(requests[1].signal.aborted,true);await canceled;
  const retry=loadModel('/retry-cancel.glb');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,3);requests[2].yes(new Response(bytes));(await retry).releaseAsset();
 }finally{globalThis.fetch=originalFetch;if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;}
});
