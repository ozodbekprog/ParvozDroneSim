import test from 'node:test';
import assert from 'node:assert/strict';
import {SpatialMapStream} from '../src/spatial-map-stream.js';
const pkg=(cell,x)=>({cell,kind:'near',bounds:{min:[x,0,0],max:[x+5,5,5]}});
const tick=()=>new Promise(setImmediate);

test('detail scheduling limits concurrency, cancels stale work and cannot attach a late result',async()=>{
 const requests=[],attached=[],disposed=[];
 const stream=new SpatialMapStream([pkg('a',0),pkg('b',10),pkg('c',200)],{radius:20,retainRadius:25,maxConcurrent:1,load:(p,{signal})=>new Promise(resolve=>requests.push({p,signal,resolve})),activate:(_v,p)=>attached.push(p.cell),dispose:v=>disposed.push(v.id)});
 stream.update([0,0,0]);await tick();assert.equal(requests.length,1);
 stream.update([200,0,0]);assert.equal(requests[0].signal.aborted,true);
 requests[0].resolve({id:'a',bytes:4});await tick();assert.deepEqual(disposed,['a']);assert.deepEqual(attached,[]);assert.equal(requests.length,2);
 requests[1].resolve({id:'c',bytes:4});await stream.idle();assert.deepEqual(attached,['c']);
 stream.dispose();assert.deepEqual(disposed,['a','c']);assert.equal(stream.stats().estimatedGeometryBytes,0);
});

test('bounded resident detail leaves failures available for explicit retry and releases all resources',async()=>{
 let failing=true;const released=[],active=new Set();
 const stream=new SpatialMapStream([pkg('a',0),pkg('b',10),pkg('c',20)],{radius:30,retainRadius:40,maxEntries:2,maxBytes:10,load:async p=>{if(p.cell==='a'&&failing)throw Error('Offline');return {id:p.cell,bytes:6};},activate:v=>active.add(v.id),deactivate:v=>active.delete(v.id),dispose:v=>released.push(v.id)});
 stream.update([0,0,0]);await stream.idle();assert.equal(active.size,1);assert.equal(stream.stats().errors[0].message,'Offline');
 failing=false;stream.retry();await stream.idle();assert.ok(active.has('a'));assert.equal(active.size,1);assert.ok(stream.stats().estimatedGeometryBytes<=10);assert.ok(stream.stats().ready<=2);
 stream.dispose();assert.equal(active.size,0);assert.equal(stream.stats().estimatedGeometryBytes,0);
});

test('look-ahead requests upcoming detail and uses actual geometry bounds instead of placement cells',async()=>{
 const reads=[];const spanning=pkg('spanning',500);spanning.bounds.min[0]=-10;
 const stream=new SpatialMapStream([spanning,pkg('ahead',60),pkg('behind',-80)],{radius:5,retainRadius:10,maxEntries:2,lookAheadSeconds:2,load:async p=>{reads.push(p.cell);return {bytes:1,dispose(){}};}});
 stream.update([0,0,0],[30,0,0]);await stream.idle();assert.deepEqual(reads,['spanning','ahead']);stream.dispose();
 assert.throws(()=>new SpatialMapStream([pkg('same',0),pkg('same',4)],{load:async()=>{}}),/identity/);
});
