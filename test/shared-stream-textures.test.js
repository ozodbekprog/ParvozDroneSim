import test from 'node:test';
import assert from 'node:assert/strict';
import {CompressedTexture,SRGBColorSpace} from 'three';
import {SharedStreamTextures} from '../src/shared-stream-textures.js';
const image=()=>new CompressedTexture([{width:4,height:4,data:new Uint8Array(16)}],4,4);

test('two chunks share decoded and configured textures until the final release',async()=>{
 let reads=0;const pool=new SharedStreamTextures(async()=>{reads++;return image();});
 const a=pool.acquire('same.ktx2'),b=pool.acquire('same.ktx2');
 const [x,y]=await Promise.all([a.ready,b.ready]);assert.equal(x,y);assert.equal(reads,1);
 const first=a.intern(x.clone()),second=b.intern(y.clone());assert.equal(first,second);
 let disposed=0;first.addEventListener('dispose',()=>disposed++);
 a.release();assert.equal(disposed,0);assert.equal(pool.stats().textures,1);
 b.release();assert.equal(disposed,1);assert.equal(pool.stats().estimatedBytes,0);assert.equal(pool.stats().images,0);
});

test('color space and UV/sampler differences cannot alias the same GPU texture',async()=>{
 const pool=new SharedStreamTextures(async()=>image()),a=pool.acquire('same'),b=pool.acquire('same');
 const base=await a.ready;await b.ready;
 const linear=a.intern(base.clone()),srgb=base.clone();srgb.colorSpace=SRGBColorSpace;
 assert.notEqual(b.intern(srgb),linear);
 const uv=base.clone();uv.channel=1;assert.notEqual(b.intern(uv),linear);
 const wrapped=base.clone();wrapped.wrapS=123;assert.notEqual(b.intern(wrapped),linear);
 a.release();b.release();assert.equal(pool.stats().estimatedBytes,0);
});

test('canceling one consumer keeps shared work alive, and late abandoned decode is disposed',async()=>{
 let finish,internal,disposed=0;
 const pool=new SharedStreamTextures((_url,signal)=>{internal=signal;return new Promise(resolve=>{finish=resolve;});});
 const abort=new AbortController(),a=pool.acquire('shared',{signal:abort.signal}),b=pool.acquire('shared');
 await Promise.resolve();abort.abort();await assert.rejects(a.ready,{name:'AbortError'});assert.equal(internal.aborted,false);
 b.release();await assert.rejects(b.ready,{name:'AbortError'});assert.equal(internal.aborted,true);
 const late=image();late.addEventListener('dispose',()=>disposed++);finish(late);await new Promise(setImmediate);
 assert.equal(disposed,1);assert.equal(pool.stats().estimatedBytes,0);assert.equal(pool.stats().images,0);
});

test('decode failure and budget rejection release resources and allow a fresh retry',async()=>{
 let reads=0,disposed=0;
 const pool=new SharedStreamTextures(async()=>{if(++reads===1)throw Error('Invalid KTX');const t=image();t.addEventListener('dispose',()=>disposed++);return t;},{maxBytes:24});
 await assert.rejects(pool.acquire('retry').ready,/Invalid KTX/);
 const lease=pool.acquire('retry'),base=await lease.ready;
 assert.throws(()=>lease.intern(base.clone()),{code:'TEXTURE_BUDGET'});lease.release();
 assert.equal(disposed,1);assert.equal(pool.stats().estimatedBytes,0);
 pool.dispose();assert.throws(()=>pool.acquire('closed'),{name:'AbortError'});
});
