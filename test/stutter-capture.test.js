import test from 'node:test';
import assert from 'node:assert/strict';
import {StutterRun,StutterCapture} from '../src/stutter-capture.js';

const sample={flying:true,hidden:false,focused:true,width:1920,height:1080,graphicsKey:'ultra',backend:'WebGPU',cpuMs:3,triangles:1234,drawCalls:12};
test('current-settings recording retains first-frame stalls and does not enforce a benchmark preset',()=>{
  const run=new StutterRun({quality:'ultra'},{durationMs:1000});
  run.update(100,sample);run.update(116,sample);run.update(516,{...sample,cpuMs:302});run.update(1116,sample);
  const report=run.result();assert.equal(report.complete,true);assert.equal(report.quality,'ultra');
  assert.deepEqual(report.frames.map(f=>f.ms),[16,400,600]);assert.equal(report.gameplaySummary.framesOver250Ms,2);
  assert.equal(report.targetHardwareVerified,false);assert.equal(report.gpuTimingMeasured,false);
});
test('pause, focus, resolution and settings changes remain in raw data but are identified',()=>{
  const run=new StutterRun({});run.update(0,sample);run.update(16,sample);
  run.update(200,{...sample,focused:false});run.update(300,sample);run.update(316,sample);
  run.update(332,{...sample,width:1280,graphicsKey:'low'});
  assert.equal(run.frames.length,5);assert.equal(run.frames.filter(f=>f.comparableGameplay).length,2);
  assert.equal(run.events.length,3);assert.equal(run.frames[1].focused,false);
});
test('sample and event caps bound capture memory and exported markers use one timeline',()=>{
  const run=new StutterRun({},{maxFrames:2,maxEvents:1});run.update(100,sample);run.event('user-stutter',110);
  run.event('ignored',112);run.longTask(105,350);run.update(120,sample);run.update(140,sample);run.update(160,sample);
  const report=run.result();assert.equal(report.truncated,true);assert.equal(report.frames.length,2);
  assert.deepEqual(report.events,[{type:'user-stutter',timeMs:10}]);assert.deepEqual(report.longTasks,[{timeMs:5,durationMs:350}]);
});
test('current capture never changes graphics or resizes the renderer',t=>{
  const before={document:globalThis.document,window:globalThis.window};
  globalThis.document={hidden:false,hasFocus:()=>true};globalThis.window={devicePixelRatio:1};
  t.after(()=>{for(const key of Object.keys(before))if(before[key]===undefined)delete globalThis[key];else globalThis[key]=before[key];});
  const graphics={quality:'ultra',resolution:1,adaptiveResolution:true};
  const world={graphics,renderer:{domElement:{width:1920,height:1080},backend:{isWebGPUBackend:true},info:{render:{triangles:123,calls:4}}},setGraphics:()=>assert.fail('preset changed'),resize:()=>assert.fail('resized')};
  let now=10;const capture=new StutterCapture(world,()=>{},{clock:()=>now});capture.start({map:'test'});
  now=20;capture.beginFrame(now);now=25;capture.phase('input');capture.update(now,{flying:true,cpuMs:5});capture.finish();
  assert.equal(capture.report.graphics.quality,'ultra');assert.deepEqual(world.graphics,graphics);
  assert.deepEqual(capture.report.frames[0].phases,{input:5});assert.deepEqual(capture.report.framebuffer,[1920,1080]);
});
