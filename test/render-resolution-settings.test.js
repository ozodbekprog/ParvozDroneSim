import test from 'node:test';import assert from 'node:assert/strict';
import {readGraphics,selectGraphicsPreset,selectRenderResolution,normalizeSurfaceSettings} from '../src/graphics-settings.js';
import {renderPixelRatio} from '../src/render-resolution.js';

test('manual 30/50 percent survives reopening, fixes resolution and preserves other quality choices',t=>{
 const previous=globalThis.localStorage,values=new Map();
 globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 t.after(()=>{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;});
 selectGraphicsPreset('high');
 for(const resolution of [.3,.5]){
  const settings=selectRenderResolution(resolution),reopened=readGraphics();
  assert.equal(reopened.resolution,resolution);assert.equal(reopened.quality,'custom');assert.equal(reopened.adaptiveResolution,false);
  assert.equal(reopened.shadows,true);assert.equal(reopened.textureSize,1024);
  assert.equal(Math.floor(1920*renderPixelRatio(1920,1080,settings,1)),resolution===.3?576:960);
  assert.equal(Math.floor(1080*renderPixelRatio(1920,1080,settings,1)),resolution===.3?324:540);
 }
 selectGraphicsPreset('low');assert.equal(readGraphics().resolution,.65);
});

test('saved render scale rejects invalid values and stays within supported limits',()=>{
 for(const [resolution,expected] of [[.1,.3],[2,1.25],[NaN,1],[Infinity,1],['invalid',1],['0.3',.3]])assert.equal(normalizeSurfaceSettings({resolution}).resolution,expected);
});
