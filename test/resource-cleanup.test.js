import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseResources} from '../src/resource-cleanup.js';
test('failed pipeline disposal still releases other GPU resources and asset references',()=>{
  const calls=[],fault=new TypeError('unfinished pipeline');
  const errors=releaseResources([{dispose(){calls.push('broken');throw fault;}},{dispose(){calls.push('texture');}}],[()=>calls.push('asset')]);
  assert.deepEqual(calls,['broken','texture','asset']);assert.deepEqual(errors,[fault]);
});
