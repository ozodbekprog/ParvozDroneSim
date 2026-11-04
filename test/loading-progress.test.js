import test from 'node:test';
import assert from 'node:assert/strict';
import {loadingPercent,loadingStage,loadingDetail} from '../src/loading-progress.js';

test('complete bytes cannot report completion while models and shaders are still preparing',()=>{
  const bytes={loaded:200,total:200,done:true};
  assert.equal(loadingPercent('Downloading assets',bytes),80);
  assert.equal(loadingPercent('Processing models',bytes),85);
  assert.equal(loadingPercent('Preparing your aircraft',bytes),90);
  assert.equal(loadingPercent('Preparing graphics',bytes),95);
  assert.equal(loadingPercent('Ready to play',bytes),100);
});
test('loading uses byte progress, handles unknown sizes and keeps connection at zero',()=>{
  assert.equal(loadingPercent('Connecting to the flight server',{done:true}),0);
  assert.equal(loadingPercent('Downloading assets',{loaded:50,total:100}),40);
  assert.equal(loadingPercent('Downloading assets',{loaded:50,total:0}),0);
  assert.equal(loadingPercent('Using cached assets',{done:true}),80);
  assert.equal(loadingPercent('Downloading assets',{loaded:200,total:100}),80);
  assert.equal(loadingStage('Preparing graphics'),'Preparing');
});
test('loading exposes actual downloaded bytes, files and elapsed time without a fake ETA',()=>{
  assert.equal(loadingDetail('Downloading essential resources',{loaded:1048576,total:4194304,filesDone:1,files:3},65000),'1.0 / 4.0 MiB · 1 / 3 · 1:05');
  assert.equal(loadingDetail('Preparing graphics',{loaded:4194304,total:4194304,filesDone:3,files:3},90000),'1:30');
  assert.equal(loadingDetail('Connecting to the flight server',{},5000),'0:05');
  assert.equal(loadingDetail('Ready to play',{},95000),'');
});
