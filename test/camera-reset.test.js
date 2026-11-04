import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Quaternion,Vector3} from 'three';

const priorDocument=globalThis.document,gradient={addColorStop(){}};
const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(value,key)=>value[key]||(()=>{})});
globalThis.document={createElement:()=>({getContext:()=>context})};
const {World}=await import('../src/world.js');
if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;

test('an AI checkpoint reset clears its visual correction without moving the player camera',()=>{
  const world=Object.create(World.prototype),camera=new PerspectiveCamera();
  camera.position.set(4,3,-9);
  const bot={visualPosition:new Vector3(),visualRotation:new Quaternion(),correction:new Vector3(1,2,3),rotationCorrection:new Quaternion(.1,0,0,.9)};
  Object.assign(world,{camera,activeDroneId:'human',drones:new Map([['race-ai-1',bot]])});
  const state={position:[70,4,25],rotation:[0,Math.sin(.4),0,Math.cos(.4)]};
  world.resetDroneVisual('race-ai-1',state);
  assert.deepEqual(camera.position.toArray(),[4,3,-9]);
  assert.deepEqual(bot.visualPosition.toArray(),state.position);
  assert.deepEqual(bot.visualRotation.toArray(),state.rotation);
  assert.deepEqual(bot.correction.toArray(),[0,0,0]);
  assert.deepEqual(bot.rotationCorrection.toArray(),[0,0,0,1]);
});

test('resetting the watched aircraft moves the camera immediately to its new pose',()=>{
  const world=Object.create(World.prototype),camera=new PerspectiveCamera();
  const watched={visualPosition:new Vector3(),visualRotation:new Quaternion()};
  Object.assign(world,{camera,activeDroneId:'race-ai-2',drones:new Map([['race-ai-2',watched]])});
  world.resetDroneVisual('race-ai-2',{position:[8,2,-11],rotation:[0,0,0,1]});
  assert.deepEqual(camera.position.toArray(),[8,2,-11]);
  world.resetDroneVisual('missing',{position:[99,99,99],rotation:[0,0,0,1]});
  assert.deepEqual(camera.position.toArray(),[8,2,-11]);
});
