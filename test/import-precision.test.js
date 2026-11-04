import test from'node:test';import assert from'node:assert/strict';
import{Document,NodeIO,Accessor}from'@gltf-transform/core';import{ALL_EXTENSIONS}from'@gltf-transform/extensions';import{MeshoptDecoder,MeshoptEncoder}from'meshoptimizer';
import{compressGeometry}from'../tools/gltf-geometry-compression.js';
test('large terrain positions survive compression without quantization seam shifts',async()=>{
 await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
 const d=new Document(),buffer=d.createBuffer(),positions=new Float32Array([-1151.00012,-2.96,-975,1151.00012,-2.96,-975,-1151.00012,-2.96,975]);
 const accessor=d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC3).setArray(positions),indices=d.createAccessor().setBuffer(buffer).setType(Accessor.Type.SCALAR).setArray(new Uint16Array([0,1,2])),p=d.createPrimitive().setAttribute('POSITION',accessor).setIndices(indices),mesh=d.createMesh().addPrimitive(p),node=d.createNode().setMesh(mesh).setTranslation([32,0,32]);d.createScene().addChild(node);
 await compressGeometry(d,true);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder}),result=await io.readBinary(await io.writeBinary(d));
 const values=result.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
 assert.deepEqual([...values].sort((a,b)=>a-b),[...positions].sort((a,b)=>a-b));
 assert.deepEqual(result.getRoot().listNodes()[0].getTranslation(),[32,0,32]);
});
