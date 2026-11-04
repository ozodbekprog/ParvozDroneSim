import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {streamFile} from '../server/static-files.js';
import {encodeCollisionBinary,decodeCollisionBinary} from '../shared/collision-binary.js';
import {AssetByteCache} from '../src/asset-byte-cache.js';

test('prepared collision delivery supports gzip, identity ranges, immutable caching and decoding',async()=>{
 const root=mkdtempSync(join(tmpdir(),'parvoz-collision-http-')),file=join(root,'collision-0123456789abcdef.pcol');
 const bytes=encodeCollisionBinary([{type:'mesh',vertices:Array.from({length:40},(_,i)=>[i,0,0,i+1,0,0,i,1,0]).flat()}],{sourceHash:'a'.repeat(64)});
 writeFileSync(file,bytes);const server=createServer((request,response)=>streamFile(request,response,file));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/collision.pcol`;
 try{
  const compressed=await fetch(url,{headers:{'Accept-Encoding':'gzip'}});
  assert.equal(compressed.headers.get('content-encoding'),'gzip');assert.equal(compressed.headers.get('content-type'),'application/octet-stream');
  assert.match(compressed.headers.get('cache-control'),/immutable/);
  const restored=await compressed.arrayBuffer();assert.deepEqual(new Uint8Array(restored),bytes);assert.equal(decodeCollisionBinary(restored).colliders.length,1);
  const partial=await fetch(url,{headers:{Range:'bytes=0-31','Accept-Encoding':'gzip'}});
  assert.equal(partial.status,206);assert.equal(partial.headers.get('content-encoding'),null);assert.equal(partial.headers.get('content-range'),`bytes 0-31/${bytes.length}`);
  assert.deepEqual(new Uint8Array(await partial.arrayBuffer()),bytes.subarray(0,32));
  const cache=new AssetByteCache(bytes.length),asset='/content/assets/maps/test/collision-0123456789abcdef.pcol';
  cache.set(asset,restored);assert.equal(cache.get(asset),restored);
 }finally{await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
});
