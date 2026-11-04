import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareStartup} from '../src/startup-loading.js';

function fixture(t){
  const old=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>queueMicrotask(fn);
  t.after(()=>{if(old)globalThis.requestAnimationFrame=old;else delete globalThis.requestAnimationFrame;});
  const controller=new AbortController(),events=[];
  return {events,controller,loading:{check:()=>controller.signal.throwIfAborted(),download:async()=>events.push('bytes'),stage:value=>events.push(value)}};
}
test('server and renderer gates complete in order before optional workshop preparation',async t=>{
  const f=fixture(t);let graphicsDone,enteredGraphics;
  const graphics=new Promise(resolve=>{graphicsDone=resolve;}),entered=new Promise(resolve=>{enteredGraphics=resolve;});
  let ready=false;
  const pending=prepareStartup({...f,connect:async()=>f.events.push('server'),prepareRenderer:async()=>{enteredGraphics();await graphics;f.events.push('renderer');}}).then(()=>{ready=true;});
  await entered;assert.equal(ready,false);assert.equal(f.events.includes('bytes'),false);assert.equal(f.events.includes('server'),true);
  graphicsDone();await pending;assert.equal(ready,true);assert.equal(f.events.at(-1),'renderer');
});
test('a canceled startup does not initialize graphics or unlock the menu',async t=>{
  const f=fixture(t);
  await assert.rejects(prepareStartup({...f,connect:async()=>f.controller.abort(),prepareRenderer:()=>assert.fail('renderer started after cancellation')}),{name:'AbortError'});
});
test('a server failure remains recoverable instead of unlocking an unauthenticated menu',async t=>{
  const f=fixture(t);
  await assert.rejects(prepareStartup({...f,connect:async()=>{throw Error('server failed');},prepareRenderer:()=>assert.fail('failed connection reached graphics')}),/server failed/);
});
test('startup readiness waits for the workshop callback and never retries it inside renderer setup',async t=>{
  const f=fixture(t);let finish,entered;const waiting=new Promise(resolve=>{entered=resolve;});let ready=false;
  const pending=prepareStartup({...f,connect:async()=>f.events.push('server'),prepareRenderer:async()=>f.events.push('renderer'),prepareHangar:async()=>{f.events.push('workshop');entered();await new Promise(resolve=>{finish=resolve;});}}).then(()=>{ready=true;});
  await waiting;assert.equal(ready,false);assert.deepEqual(f.events.slice(-3),['renderer','Preparing Hangar','workshop']);
  finish();await pending;assert.equal(ready,true);assert.equal(f.events.filter(v=>v==='workshop').length,1);
});
test('failed workshop preparation cannot be advertised as a ready startup',async t=>{
  const f=fixture(t);await assert.rejects(prepareStartup({...f,connect:async()=>{},prepareRenderer:async()=>{},prepareHangar:async()=>{throw Error('workshop failed');}}),/workshop failed/);
});
