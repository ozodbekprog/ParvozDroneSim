import test from 'node:test';
import assert from 'node:assert/strict';
import {CompressedTexture,RGBA_S3TC_DXT5_Format,Group,Mesh,MeshStandardMaterial,BoxGeometry,Texture,NearestFilter} from 'three';
import {applySurfaceSettings,resizeMaterialTexture} from '../src/surface-settings.js';
import {estimateTextureMemory} from '../src/performance-report.js';
import {normalizeSurfaceSettings,GRAPHICS_PRESETS} from '../src/graphics-settings.js';

test('texture setting drops uploaded KTX mip levels and restores full resolution without new downloads',()=>{
  const mipmaps=[512,256,128].map(width=>({width,height:width,data:new Uint8Array(width*width)}));
  const texture=new CompressedTexture(mipmaps,512,512,RGBA_S3TC_DXT5_Format),root=new Group();
  root.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial({map:texture})));
  const full=estimateTextureMemory(root).bytes;let disposals=0;texture.addEventListener('dispose',()=>disposals++);
  resizeMaterialTexture(texture,256);assert.equal(texture.image.width,256);assert.equal(texture.mipmaps[0],mipmaps[1]);assert.ok(estimateTextureMemory(root).bytes<full/2);
  resizeMaterialTexture(texture,256);assert.equal(disposals,1);
  resizeMaterialTexture(texture,0);assert.equal(texture.image.width,512);assert.equal(texture.mipmaps,mipmaps);assert.equal(estimateTextureMemory(root).bytes,full);assert.equal(disposals,2);
});
test('oblique filtering follows quality and hardware without invalidating unchanged warm textures',()=>{
 const texture=new Texture(),root=new Mesh(new BoxGeometry(),new MeshStandardMaterial({map:texture}));
 applySurfaceSettings(root,{anisotropy:8},16);assert.equal(texture.anisotropy,8);const version=texture.version;
 applySurfaceSettings(root,{anisotropy:8},16);assert.equal(texture.version,version);
 applySurfaceSettings(root,{anisotropy:8},2);assert.equal(texture.anisotropy,2);
 applySurfaceSettings(root,{anisotropy:1},16);assert.equal(texture.anisotropy,1);
});
test('Low retains native filtering while nearest and render-target samplers stay untouched',()=>{
 const native=new Texture(),nearest=new Texture(),target=new Texture();native.anisotropy=4;nearest.magFilter=NearestFilter;target.isRenderTargetTexture=true;
 const root=new Mesh(new BoxGeometry(),new MeshStandardMaterial({map:native,normalMap:nearest,emissiveMap:target}));
 applySurfaceSettings(root,{anisotropy:8},16);assert.equal(native.anisotropy,8);assert.equal(nearest.anisotropy,1);assert.equal(target.anisotropy,1);
 applySurfaceSettings(root,{anisotropy:1},16);assert.equal(native.anisotropy,4);
 assert.equal(GRAPHICS_PRESETS.low.anisotropy,1);assert.equal(GRAPHICS_PRESETS.medium.anisotropy,4);assert.equal(GRAPHICS_PRESETS.ultra.anisotropy,8);
 assert.equal(normalizeSurfaceSettings({anisotropy:99}).anisotropy,1);
});
test('normal detail can be disabled and restored on existing materials',()=>{
  const texture=new Texture(),material=new MeshStandardMaterial({normalMap:texture}),root=new Mesh(new BoxGeometry(),material);
  applySurfaceSettings(root,{normalMaps:false});assert.equal(material.normalMap,null);
  applySurfaceSettings(root,{normalMaps:true});assert.equal(material.normalMap,texture);
});
test('surface settings reject invalid sizes and constrain LOD distance',()=>{
  assert.equal(normalizeSurfaceSettings({textureSize:999,lodDistanceScale:99}).textureSize,512);
  assert.equal(normalizeSurfaceSettings({lodDistanceScale:99}).lodDistanceScale,4);
  assert.equal(normalizeSurfaceSettings({lodDistanceScale:-3}).lodDistanceScale,.25);
  assert.equal(normalizeSurfaceSettings({quality:'custom',lodMinimum:1}).lodMinimum,1);
});
