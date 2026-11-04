import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraSettings,saveCameraSettings,cameraKeyPatch} from '../src/camera-settings.js';

test('flight arrow adjustments share settings persistence and stay within slider bounds',()=>{
  const prior=globalThis.localStorage,storage=new Map();
  globalThis.localStorage={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
  try {
    const build={drone:'kestrel'};
    saveCameraSettings(build,{tilt:25,fov:100});
    for(const [code,expected] of [['ArrowUp',{tilt:26,fov:100}],['ArrowRight',{tilt:26,fov:101}],['ArrowDown',{tilt:25,fov:101}],['ArrowLeft',{tilt:25,fov:100}]]){
      saveCameraSettings(build,cameraKeyPatch(code,cameraSettings(build)));
      assert.deepEqual(cameraSettings(build),expected);
    }
    assert.deepEqual(cameraKeyPatch('ArrowUp',{tilt:60}),{tilt:60});
    assert.deepEqual(cameraKeyPatch('ArrowDown',{tilt:0}),{tilt:0});
    assert.deepEqual(cameraKeyPatch('ArrowRight',{fov:125}),{fov:125});
    assert.deepEqual(cameraKeyPatch('ArrowLeft',{fov:75}),{fov:75});
    assert.equal(cameraKeyPatch('KeyW',{}),null);
  } finally {if(prior===undefined)delete globalThis.localStorage;else globalThis.localStorage=prior;}
});
