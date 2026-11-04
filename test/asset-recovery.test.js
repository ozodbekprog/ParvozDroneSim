import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetDelivery} from '../src/asset-delivery.js';
import {AssetByteCache} from '../src/asset-byte-cache.js';
const url='/content/assets/maps/recovery/scene-1234567890abcdef.glb';
const broken=()=>{let reads=0;return new Response(new ReadableStream({pull(c){if(!reads++)c.enqueue(new Uint8Array([1,2]));else c.error(new TypeError('connection reset'));}}),{headers:{'Content-Length':'5','Accept-Ranges':'bytes',ETag:'"same"'}});};
const create=fetcher=>new AssetDelivery({fetcher,storage:null,memory:new AssetByteCache(),transfer:{retryDelayMs:0,stallMs:30}});

test('exhausted network recovery gives a readable Retry message and retains no failed bytes',async()=>{
 let calls=0;const transport=new TypeError('Failed to fetch');
 const delivery=create(async()=>{calls++;throw transport;});
 await assert.rejects(delivery.get(url),error=>{
  assert.equal(error.code,'NETWORK_UNAVAILABLE');
  assert.equal(error.message,'Download interrupted. Check your connection and retry.');
  assert.equal(error.cause,transport);return true;
 });
 assert.equal(calls,3);assert.equal(delivery.memory.has(url),false);assert.equal(delivery.pending.size,0);
});

test('an interrupted immutable delivery resumes its verified range for all current callers',async()=>{
 const requests=[];
 const delivery=create(async(_url,options)=>{requests.push(options);return requests.length===1?broken():new Response(new Uint8Array([3,4,5]),{status:206,headers:{'Content-Range':'bytes 2-4/5','Content-Length':'3',ETag:'"same"'}});});
 const one=delivery.get(url,{expectedBytes:5}),two=delivery.get(url,{expectedBytes:5});
 const [a,b]=await Promise.all([one,two]);assert.deepEqual([...new Uint8Array(a.bytes)],[1,2,3,4,5]);assert.equal(a.bytes,b.bytes);
 assert.equal(requests.length,2);assert.equal(requests[1].headers.Range,'bytes=2-');
});

test('a server ignoring Range restarts safely; wrong ranges and short files never enter cache',async()=>{
 let calls=0;const delivery=create(async()=>++calls===1?broken():new Response(new Uint8Array([1,2,3,4,5])));
 assert.deepEqual([...new Uint8Array((await delivery.get(url,{expectedBytes:5})).bytes)],[1,2,3,4,5]);
 calls=0;const invalid=create(async()=>++calls===1?broken():new Response(new Uint8Array([3,4,5]),{status:206,headers:{'Content-Range':'bytes 1-3/5'}}));
 await assert.rejects(invalid.get(url,{expectedBytes:5}),/range/i);assert.equal(invalid.memory.has(url),false);
 const short=create(async()=>new Response(new Uint8Array([1,2])));
 await assert.rejects(short.get(url,{expectedBytes:5}),/size|incomplete/i);assert.equal(short.memory.has(url),false);
});

test('a silent stream times out, retries are bounded, and last-subscriber cancellation stops recovery',async()=>{
 let calls=0;const delivery=create(async(_url,{signal})=>{calls++;return new Response(new ReadableStream({start(c){signal.addEventListener('abort',()=>c.error(signal.reason));}}));});
 await assert.rejects(delivery.get(url),/stopped|connection|download|respond/i);assert.equal(calls,3);
 const controller=new AbortController();calls=0;
 const canceled=create(async(_url,{signal})=>{calls++;return new Response(new ReadableStream({start(c){signal.addEventListener('abort',()=>c.error(signal.reason));}}));});
 const pending=canceled.get(url,{signal:controller.signal}),check=assert.rejects(pending,{name:'AbortError'});
 await new Promise(resolve=>setImmediate(resolve));controller.abort();await check;
 await new Promise(resolve=>setTimeout(resolve,45));assert.equal(calls,1);assert.equal(canceled.pending.size,0);
});
