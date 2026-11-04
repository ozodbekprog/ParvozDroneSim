import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BufferGeometry,Float32BufferAttribute,InterleavedBuffer,InterleavedBufferAttribute,MeshStandardMaterial,CompressedTexture,RGBA_BPTC_Format,Texture} from 'three';
import {sceneResourceInventory} from '../tools/scene-resource-inventory.js';

test('inventory deduplicates shared attributes and backing buffers while retaining hidden LOD residency',()=>{
 const root=new Group(),a=new BufferGeometry(),b=new BufferGeometry(),material=new MeshStandardMaterial(),position=new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3);
 a.setAttribute('position',position);b.setAttribute('position',position);root.add(new Mesh(a,material),new Mesh(b,material));
 const hidden=new Mesh(new BufferGeometry().setAttribute('position',new Float32BufferAttribute([2,2,2],3)),material);hidden.visible=false;root.add(hidden);
 const result=sceneResourceInventory(root);assert.equal(result.geometryAttributeBytes,48);assert.equal(result.cpuBackingBufferBytes,48);assert.equal(result.visibleAttributeBytes,36);assert.equal(result.geometries,3);assert.equal(result.materials,1);
});

test('interleaved storage counts once and reports the actual transcoded texture format and mip bytes',()=>{
 const root=new Group(),g=new BufferGeometry(),data=new InterleavedBuffer(new Float32Array(18),6);
 g.setAttribute('position',new InterleavedBufferAttribute(data,3,0));g.setAttribute('normal',new InterleavedBufferAttribute(data,3,3));
 const texture=new CompressedTexture([{data:new Uint8Array(16),width:4,height:4},{data:new Uint8Array(16),width:2,height:2}],4,4,RGBA_BPTC_Format);
 root.add(new Mesh(g,new MeshStandardMaterial({map:texture,normalMap:texture})));
 const result=sceneResourceInventory(root);assert.equal(result.geometryAttributeBytes,72);assert.equal(result.cpuBackingBufferBytes,104);assert.equal(result.materialTextures,1);
 assert.deepEqual(result.textureFormats,[{format:'RGBA_BPTC_Format',textures:1,storedMipBytes:32}]);assert.equal(result.materialTextureEstimate.bytes,32);
});

test('generated reflection/render-target textures do not become material payload estimates',()=>{
 const root=new Group(),texture=new Texture({data:new Uint8Array(64),width:4,height:4});texture.isRenderTargetTexture=true;
 root.add(new Mesh(new BufferGeometry(),new MeshStandardMaterial({envMap:texture})));
 const result=sceneResourceInventory(root);assert.equal(result.materialTextures,0);assert.equal(result.materialTextureEstimate.bytes,0);assert.equal(result.cpuBackingBufferBytes,0);
});
