import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultContainer,read,write} from 'ktx-parse';
import {lowTexture,nodeDeliverySignature} from '../tools/low-map-delivery.js';
import {buildLowMapDelivery} from '../tools/low-map-delivery.js';
import {buildChunkedMapDelivery} from '../tools/chunk-map-delivery.js';
import {Document,NodeIO} from '@gltf-transform/core';
import {KHRTextureBasisu,ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('Low package selects exact existing compressed mips without re-encoding',()=>{
 const c=createDefaultContainer();c.pixelWidth=1024;c.pixelHeight=512;c.supercompressionScheme=2;c.dataFormatDescriptor[0].colorModel=166;
 c.levels=Array.from({length:11},(_,i)=>({levelData:new Uint8Array(16).fill(i),uncompressedByteLength:32}));c.levelCount=11;
 const input=write(c),result=read(lowTexture(input));
 assert.equal(result.pixelWidth,256);assert.equal(result.pixelHeight,128);assert.equal(result.levels.length,9);
 for(let i=0;i<9;i++)assert.deepEqual(result.levels[i].levelData,c.levels[i+2].levelData);
 assert.equal(read(input).pixelWidth,1024,'full-quality bytes remain intact');
});

test('Low package rejects unsupported layouts instead of corrupting textures',()=>{
 const c=createDefaultContainer();c.pixelWidth=1024;c.pixelHeight=512;c.levels=[{levelData:new Uint8Array(16),uncompressedByteLength:16}];
 assert.throws(()=>lowTexture(write(c)),/independent/);
 c.supercompressionScheme=2;c.dataFormatDescriptor[0].colorModel=166;
 assert.throws(()=>lowTexture(write(c)),/Missing authored mip/);
 assert.throws(()=>lowTexture(write(c),0),/positive integer/);
});

test('Low chunks retain named geometry and share encoded textures across independent packages',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'parvoz-delivery-'));
 try{
  const document=new Document(),buffer=document.createBuffer(),scene=document.createScene();
  const c=createDefaultContainer();c.pixelWidth=1024;c.pixelHeight=512;c.supercompressionScheme=2;c.dataFormatDescriptor[0].colorModel=166;
  c.levels=Array.from({length:11},(_,i)=>({levelData:new Uint8Array(16).fill(i),uncompressedByteLength:32}));c.levelCount=11;
  document.createExtension(KHRTextureBasisu).setRequired(true);
  const texture=document.createTexture('Shared').setMimeType('image/ktx2').setImage(write(c));
  const material=document.createMaterial('Paint').setBaseColorTexture(texture);
  const position=document.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0]));
  const mesh=document.createMesh().addPrimitive(document.createPrimitive().setAttribute('POSITION',position).setMaterial(material));
  scene.addChild(document.createNode('Environment'));
  const objects=[-10,200].map((x,i)=>{
   const modelLods=[0,1,2].map(level=>{const modelNode=`Chunk${i}_LOD${level}`;scene.addChild(document.createNode(modelNode).setMesh(mesh).setTranslation([i,level,0]));return {model:'model.glb',modelNode,distance:level*20};});
   return {model:'model.glb',modelNode:modelLods[0].modelNode,position:[x,0,0],modelLods,lowLod:1};
  });
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
  await io.write(join(folder,'model.glb'),document);
  writeFileSync(join(folder,'map.json'),JSON.stringify({model:'model.glb',modelNode:'Environment',objects}));
  const before=readFileSync(join(folder,'model.glb'));
  const low=await buildLowMapDelivery(join(folder,'map.json'),join(folder,'low.glb'));
  assert.equal(low.geometryParity,true);assert.equal(low.selectors,5);
  const reduced=await io.read(join(folder,'low.glb'));
  assert.ok(reduced.getRoot().listNodes().every(node=>!node.getName().endsWith('LOD0')));
  assert.equal(read(reduced.getRoot().listTextures()[0].getImage()).pixelWidth,256);
  const report=await buildChunkedMapDelivery(join(folder,'map.json'),join(folder,'low.glb'),join(folder,'chunks'));
  assert.equal(report.packages.length,3);assert.equal(report.selectors,5);assert.equal(report.geometryParity,true);
  const textures=report.resources.filter(resource=>resource.url.endsWith('.ktx2'));
  assert.equal(textures.length,1,'a shared material texture must be stored once');
  const chunks=report.packages.filter(p=>p.cell!=='environment');
  assert.deepEqual(chunks.map(p=>p.objectIndices),[[0],[1]],'map placement indices must survive packaging');
  assert.ok(chunks.every(p=>p.resources.includes(textures[0].url)));
  for(const chunk of chunks){
   const decoded=await io.read(join(folder,'chunks',chunk.model));
   assert.equal(decoded.getRoot().listNodes().length,2);assert.equal(decoded.getRoot().listTextures().length,1);
  }
  assert.deepEqual(readFileSync(join(folder,'model.glb')),before,'canonical delivery remains byte-identical');
  const stream=await buildChunkedMapDelivery(join(folder,'map.json'),join(folder,'low.glb'),join(folder,'streaming'),{cellSize:24,streaming:true});
  assert.equal(stream.version,2);assert.equal(stream.packages.filter(p=>p.kind==='coarse').length,1);
  assert.equal(stream.packages.filter(p=>p.kind==='near').length,2);
  assert.deepEqual(stream.packages.find(p=>p.kind==='coarse').selectors,['Environment','Chunk0_LOD2','Chunk1_LOD2']);
  assert.ok(stream.packages.filter(p=>p.kind==='near').every(p=>p.selectors.length===1&&p.selectors[0].endsWith('LOD1')));
  assert.deepEqual(stream.packages.find(p=>p.objectIndices[0]===0&&p.kind==='near').bounds,{min:[-10,1,0],max:[-9,2,0]});
  assert.equal(stream.placements[1].position[0],200);
  await assert.rejects(buildChunkedMapDelivery(join(folder,'map.json'),join(folder,'low.glb'),join(folder,'chunks')),/new experiment directory/);
  await assert.rejects(buildLowMapDelivery(join(folder,'map.json'),join(folder,'model.glb')),/canonical full-quality/);
 }finally{rmSync(folder,{recursive:true,force:true});}
});

test('geometry parity accepts cyclic triangle rotation but rejects reversed winding and moved vertices',()=>{
 const document=new Document(),buffer=document.createBuffer(),position=document.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0]));
 const indices=document.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint16Array([0,1,2]));
 const node=document.createNode('Surface').setMesh(document.createMesh().addPrimitive(document.createPrimitive().setAttribute('POSITION',position).setIndices(indices)));
 const before=nodeDeliverySignature(node);
 indices.setArray(new Uint16Array([1,2,0]));assert.equal(nodeDeliverySignature(node),before);
 indices.setArray(new Uint16Array([0,2,1]));assert.notEqual(nodeDeliverySignature(node),before);
 indices.setArray(new Uint16Array([0,1,2]));position.getArray()[0]=.01;assert.notEqual(nodeDeliverySignature(node),before);
});
