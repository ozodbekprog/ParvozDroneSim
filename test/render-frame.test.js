import test from 'node:test';
import assert from 'node:assert/strict';
import {renderFrame} from '../src/render-frame.js';
import {careerUnlockSatisfied} from '../shared/career-unlocks.js';
test('failed post effects reset the target and can still deliver a valid scene frame',()=>{
  const calls=[],failure=new Error('bad texture');
  const result=renderFrame({post:()=>{calls.push('post');throw failure;},reset:()=>calls.push('reset'),direct:()=>calls.push('scene')});
  assert.deepEqual(calls,['post','reset','scene']);assert.equal(result.ok,true);assert.equal(result.postError,failure);
});
test('a second rendering failure is returned for backend recovery and never escapes the animation loop',()=>{
  const failure=new Error('pipeline unavailable');
  const result=renderFrame({post:()=>{throw new Error('effect');},reset:()=>{},direct:()=>{throw failure;}});
  assert.equal(result.ok,false);assert.equal(result.error,failure);
  assert.equal(renderFrame({direct:()=>{throw failure;}}).error,failure);
});
test('archiving career maps preserves existing unlocks and leaves new unlocks reachable',()=>{
  assert.equal(careerUnlockSatisfied('career-6',2,3),false);
  assert.equal(careerUnlockSatisfied('career-6',3,3),true);
  assert.equal(careerUnlockSatisfied('career-6',6,2),true);
  assert.equal(careerUnlockSatisfied('career-6',0,0),false);
});
