import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFrames, PerformanceRun, estimateTextureMemory } from '../src/performance-report.js';
import { Group, Mesh, MeshStandardMaterial, Texture, CompressedTexture } from 'three';
import { renderPixelRatio } from '../src/render-resolution.js';

test('1% low uses the mean of the slowest one percent, retaining stalls',()=>{
  const samples=Array.from({length:100},()=>({ms:16.5,triangles:200000,drawCalls:120}));samples[99]={ms:500,triangles:300001,drawCalls:251};
  const report=summarizeFrames(samples);assert.equal(report.onePercentLow,2);assert.equal(report.medianMs,16.5);assert.equal(report.framesOver50Ms,1);assert.equal(report.peakDrawCalls,251);
});
test('benchmark excludes warmup but invalidates hidden, adaptive or undersized runs',()=>{
  const good={width:1280,height:720,triangles:200000,drawCalls:150};
  const run=new PerformanceRun({warmupMs:100,durationMs:100});
  for(let t=0;t<=200;t+=10)run.update(t,good);
  assert.equal(run.result().valid,true);assert.equal(run.result().summary.frames,10);assert.equal(run.result().targetHardwareVerified,false);
  for(const bad of [{hidden:true},{width:832},{adaptiveResolution:true}]){
    const r=new PerformanceRun({warmupMs:0,durationMs:20});r.update(0,good);r.update(20,{...good,...bad});assert.equal(r.result().valid,false);assert.equal(r.result().meetsFrameBudget,false);
  }
});
test('fixed 720p ignores retina scaling and preset resolution',()=>{
  assert.equal(renderPixelRatio(1280,720,{resolution:.65,fixedResolution:[1280,720]},2,.6),1);
  assert.equal(renderPixelRatio(1920,1080,{resolution:.65,fixedResolution:[1280,720]},2),2/3);
});

test('resident texture estimate deduplicates shared textures and includes mip levels',()=>{
  const image=new Texture({width:4,height:4});image.generateMipmaps=true;
  const compressed=new CompressedTexture([{data:new Uint8Array(16),width:4,height:4},{data:new Uint8Array(8),width:2,height:2}]);
  const root=new Group();root.add(new Mesh(undefined,new MeshStandardMaterial({map:image,normalMap:compressed})),new Mesh(undefined,new MeshStandardMaterial({map:image})));
  const report=estimateTextureMemory(root);
  assert.equal(report.bytes,(16+4+1)*4+24);assert.equal(report.textures,2);assert.equal(report.unknown,0);
  const run=new PerformanceRun({warmupMs:0,durationMs:20});
  for(const t of [0,20])run.update(t,{width:1280,height:720,textureMiB:257});
  assert.equal(run.result().meetsTextureBudget,false);
});

test('material texture payload estimates exclude generated render targets as documented',()=>{
  const target=new Texture({width:256,height:256});target.isRenderTargetTexture=true;
  const root=new Group();root.add(new Mesh(undefined,new MeshStandardMaterial({map:target})));
  const report=estimateTextureMemory(root);assert.equal(report.bytes,0);assert.equal(report.textures,0);
});
