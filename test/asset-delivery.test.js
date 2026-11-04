import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetDelivery} from '../src/asset-delivery.js';
import {AssetByteCache} from '../src/asset-byte-cache.js';

const urls=['/content/assets/test/a-1111111111111111.glb','/content/assets/test/b-2222222222222222.glb','/content/assets/test/c-3333333333333333.glb'];
function disk(){
  const files=new Map(),downloaded=new Map(),values=new Map();
  const name=key=>typeof key==='string'?key:new URL(key.url).pathname;
  return {files,downloaded,storage:{open:async cacheName=>{const entries=cacheName==='parvoz-downloaded-assets-v1'?downloaded:files;return {keys:async()=>[...entries.keys()].map(key=>({url:'http://localhost'+key})),match:async key=>entries.get(name(key))?.clone(),put:async(key,response)=>entries.set(name(key),response.clone()),delete:async key=>entries.delete(name(key))};}},indexStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}};
}
test('a large encoded delivery survives memory eviction and a new page instance without another fetch',async()=>{
  const saved=disk();let calls=0;
  const options={...saved,limit:16,memory:new AssetByteCache(1),fetcher:async()=>{calls++;return new Response(new Uint8Array([1,2,3,4]));}};
  const first=new AssetDelivery(options);assert.equal((await first.get(urls[0])).bytes.byteLength,4);await first.writes;
  const nextPage=new AssetDelivery({...options,memory:new AssetByteCache(1)}),result=await nextPage.get(urls[0]);
  assert.equal(result.source,'Disk cache');assert.equal(result.networkBytes,0);assert.equal(calls,1);assert.deepEqual([...new Uint8Array(result.bytes)],[1,2,3,4]);
});
test('bounded disk storage evicts encoded files and storage failure still permits flight',async()=>{
  const saved=disk(),delivery=new AssetDelivery({...saved,limit:6,memory:new AssetByteCache(1),fetcher:async()=>new Response(new Uint8Array([1,2,3,4]))});
  await delivery.get(urls[0]);await delivery.writes;await delivery.get(urls[1]);await delivery.writes;
  assert.equal(saved.files.size,1);assert.ok(saved.files.has(urls[1]));
  const unavailable=new AssetDelivery({memory:new AssetByteCache(1),storage:{open:async()=>{throw new Error('Quota or privacy');}},fetcher:async()=>new Response(new Uint8Array([7,8]))});
  assert.equal((await unavailable.get(urls[2])).bytes.byteLength,2);await unavailable.writes;
});
test('two callers share a fetch; canceling one preserves the other, final cancellation permits immediate retry',async()=>{
  const requests=[];
  const delivery=new AssetDelivery({memory:new AssetByteCache(0),storage:null,fetcher:(url,{signal})=>new Promise((resolve,reject)=>{requests.push({url,signal,resolve});signal.addEventListener('abort',()=>reject(new DOMException('Canceled','AbortError')));})});
  const a=new AbortController(),b=new AbortController(),one=delivery.get(urls[0],{signal:a.signal}),two=delivery.get(urls[0],{signal:b.signal});
  const canceled=assert.rejects(one,{name:'AbortError'});await new Promise(resolve=>setImmediate(resolve));a.abort();
  assert.equal(requests.length,1);assert.equal(requests[0].signal.aborted,false);requests[0].resolve(new Response(new Uint8Array([9])));await two;await canceled;
  const c=new AbortController(),three=delivery.get(urls[1],{signal:c.signal}),last=assert.rejects(three,{name:'AbortError'});
  await new Promise(resolve=>setImmediate(resolve));c.abort();const retry=delivery.get(urls[1]);await last;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,3);assert.equal(requests[1].signal.aborted,true);requests[2].resolve(new Response(new Uint8Array([8])));await retry;
});
test('unhashed mutable URLs are never persisted and incorrect size hints cannot truncate bytes',async()=>{
  const saved=disk(),delivery=new AssetDelivery({...saved,memory:new AssetByteCache(1),fetcher:async()=>new Response(new Uint8Array([1,2,3,4,5]))});
  const result=await delivery.get('/mutable.json',{expectedBytes:2});await delivery.writes;
  assert.deepEqual([...new Uint8Array(result.bytes)],[1,2,3,4,5]);assert.equal(saved.files.size,0);
});
test('disk files remain bounded after the persisted index is lost',async()=>{
  const saved=disk(),options={...saved,memory:new AssetByteCache(1),limit:6,fetcher:async()=>new Response(new Uint8Array([1,2,3,4]))};
  const first=new AssetDelivery(options);await first.get(urls[0]);await first.writes;
  const next=new AssetDelivery({...options,indexStorage:null});await next.get(urls[1]);await next.writes;
  assert.equal(saved.files.size,1);assert.ok(saved.files.has(urls[1]));
});

test('truncated saved or memory deliveries are replaced from network instead of breaking every Retry',async()=>{
  for(const source of ['memory','files','downloaded']){
    const saved=disk(),memory=new AssetByteCache(16);let calls=0;
    const delivery=new AssetDelivery({...saved,memory,fetcher:async()=>{calls++;return new Response(Uint8Array.of(1,2,3,4));}});
    if(source==='memory')memory.set(urls[0],Uint8Array.of(1,2).buffer);
    else saved[source].set(urls[0],new Response(Uint8Array.of(1,2),{headers:{'X-Parvoz-Bytes':'4'}}));
    const result=await delivery.get(urls[0],{expectedBytes:4});await delivery.writes;
    assert.equal(result.bytes.byteLength,4,source);assert.equal(calls,1,source);
    assert.equal((await delivery.get(urls[0],{expectedBytes:4})).bytes.byteLength,4);
    assert.equal(calls,1,'the repaired bytes are reused');
  }
});

test('self-consistent saved bytes still have to match the current immutable catalog length',async()=>{
  const saved=disk();saved.downloaded.set(urls[0],new Response(Uint8Array.of(1,2),{headers:{'X-Parvoz-Bytes':'2'}}));
  const delivery=new AssetDelivery({...saved,memory:new AssetByteCache(0),fetcher:async()=>new Response(Uint8Array.of(1,2,3,4))});
  const result=await delivery.get(urls[0],{expectedBytes:4});
  assert.equal(result.bytes.byteLength,4);assert.equal(saved.downloaded.has(urls[0]),false);
});

test('content-identical catalog garage deliveries reuse cached bytes across maps without extra network transfer',async()=>{
  const a='/content/assets/maps/minus-two-demo/delivery-87910eb6e6a5e197.glb';
  const b='/content/assets/maps/liftoff-the-green-demo/delivery-87910eb6e6a5e197.glb';
  const payload=new Uint8Array(3409196).fill(7);
  const saved=disk();let calls=0;
  const delivery=new AssetDelivery({...saved,limit:8*1024*1024,memory:new AssetByteCache(8*1024*1024),fetcher:async()=>{calls++;return new Response(payload);}});
  await delivery.get(a);await delivery.writes;
  assert.equal(calls,1);
  const fromMemory=await delivery.get(b);
  assert.equal(fromMemory.source,'Memory cache');assert.equal(calls,1);
  delivery.memory.delete(a);delivery.memory.delete(b);
  const fromDisk=await delivery.get(b);
  assert.equal(fromDisk.source,'Disk cache');assert.equal(calls,1);
});
