import test from 'node:test';
import assert from 'node:assert/strict';
import {requestJSON} from '../src/client-request.js';

test('a transient read failure during startup recovers without repeating an account action',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let calls=0;
 globalThis.fetch=async()=>{if(++calls===1)throw new TypeError('connection reset');return Response.json({ready:true});};
 assert.deepEqual(await requestJSON('/api/catalog',{},100,{retryDelayMs:0}),{ready:true});assert.equal(calls,2);
 calls=0;await assert.rejects(requestJSON('/api/guest',{method:'POST'},100,{retryDelayMs:0}),/connection|reach/);assert.equal(calls,1);
});

test('temporary upstream errors can recover, but authentication and malformed responses are not retried',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let calls=0;
 globalThis.fetch=async()=>++calls===1?Response.json({error:'temporary'},{status:503}):Response.json({ready:true});
 assert.deepEqual(await requestJSON('/api/me',{},100,{retryDelayMs:0}),{ready:true});assert.equal(calls,2);
 for(const response of [()=>Response.json({error:'Wrong password'},{status:401}),()=>new Response('<html>not JSON</html>')]){
  calls=0;globalThis.fetch=async()=>{calls++;return response();};await assert.rejects(requestJSON('/api/me',{},100,{retryDelayMs:0}));assert.equal(calls,1);
 }
});

test('read retries are bounded and caller cancellation prevents a later retry',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let calls=0;
 globalThis.fetch=async()=>{calls++;throw new TypeError('offline');};
 await assert.rejects(requestJSON('/api/catalog',{},100,{retryDelayMs:0}),/reach/);assert.equal(calls,3);
 const controller=new AbortController();calls=0;
 globalThis.fetch=async()=>{calls++;controller.abort();throw new TypeError('offline');};
 await assert.rejects(requestJSON('/api/catalog',{signal:controller.signal},100,{retryDelayMs:0}),{name:'AbortError'});assert.equal(calls,1);
});
