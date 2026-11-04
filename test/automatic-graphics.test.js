import test from 'node:test';import assert from 'node:assert/strict';
import {automaticGraphicsPreset} from '../src/automatic-graphics.js';
import {readGraphics,initializeAutomaticGraphics,selectGraphicsPreset} from '../src/graphics-settings.js';

test('automatic quality distinguishes discrete GPUs, UHD 620, RAM pressure and hidden GPU identity',()=>{
 assert.equal(automaticGraphicsPreset({gpu:'ANGLE (NVIDIA GeForce RTX 4070)',memoryGB:8}),'high');
 assert.equal(automaticGraphicsPreset({gpu:'AMD Radeon RX 6700 XT',memoryGB:8}),'high');
 assert.equal(automaticGraphicsPreset({gpu:'Intel UHD Graphics 620',memoryGB:8}),'low');
 assert.equal(automaticGraphicsPreset({gpu:'Intel gen-9',memoryGB:4}),'low');
 assert.equal(automaticGraphicsPreset({gpu:'NVIDIA GeForce RTX 3060',memoryGB:4}),'medium');
 assert.equal(automaticGraphicsPreset({gpu:'SwiftShader',memoryGB:8}),'low');
 assert.equal(automaticGraphicsPreset({memoryGB:8}),'medium');
});

test('Auto ignores stale Low fields while explicit presets keep the user choice',async t=>{
 const previous=globalThis.localStorage;let saved=JSON.stringify({quality:'auto',resolution:.65,textureSize:256,lodMinimum:1});
 globalThis.localStorage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;},removeItem:()=>{saved=null;}};
 t.after(()=>{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;});
 const settings=await initializeAutomaticGraphics({backend:{gl:{getExtension:()=>({UNMASKED_RENDERER_WEBGL:1}),getParameter:()=> 'NVIDIA GeForce RTX 4070'}}});
 assert.equal(settings.quality,'auto');assert.equal(settings.automaticPreset,'high');assert.equal(settings.resolution,1);assert.equal(settings.lodMinimum,0);assert.equal(settings.textureSize,1024);
 selectGraphicsPreset('low');assert.equal(readGraphics().quality,'low');assert.equal(readGraphics().resolution,.65);
 selectGraphicsPreset('auto');assert.equal(readGraphics().automaticPreset,'high');assert.equal(readGraphics().resolution,1);
});
