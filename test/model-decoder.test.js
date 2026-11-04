import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {MeshoptEncoder} from 'meshoptimizer';
import {createModelDecoder, modelWorkerLimits} from '../src/model-decoder.js';

function workerFixture() {
  const packets = [];
  const worker = {terminate() { this.stopped = true; }, postMessage(packet, transfers) { packets.push(structuredClone(packet, {transfer: transfers})); }};
  queueMicrotask(() => worker.onmessage({data: {ready: true}}));
  const finish = () => { const packet = packets.shift(); worker.onmessage({data: {id: packet.id, results: packet.jobs.map(job => ({id: job.id, value: job.source.slice()}))}}); };
  return {worker, packets, finish};
}

test('worker allowances leave room for render/collision on small machines', () => {
  assert.deepEqual(modelWorkerLimits(2), {geometry: 0, textures: 1});
  assert.deepEqual(modelWorkerLimits(4), {geometry: 1, textures: 1});
  assert.deepEqual(modelWorkerLimits(8), {geometry: 1, textures: 2});
  assert.deepEqual(modelWorkerLimits(12), {geometry: 1, textures: 3});
  assert.deepEqual(modelWorkerLimits(16), {geometry: 1, textures: 4});
});

test('concurrent GLTF callers share bounded batches without detaching cached sources', async () => {
  let fixture, creations = 0;
  const decoder = createModelDecoder({supported: true, ready: Promise.resolve()}, {workers: 1, canUseWorkers: true,
    maxBatchViews: 2, maxBatchBytes: 12, createWorker: () => { creations++; fixture = workerFixture(); return fixture.worker; }});
  const source = new Uint8Array([1, 2, 3]);
  const jobs = Array.from({length: 4}, () => decoder.decodeGltfBufferAsync(1, 3, source, 'ATTRIBUTES'));
  await new Promise(setImmediate);
  assert.equal(creations, 1); assert.equal(fixture.packets.length, 1); assert.equal(fixture.packets[0].jobs.length, 2);
  assert.equal(decoder.stats().active, 2); assert.equal(decoder.stats().pending, 4);
  source[0] = 9; fixture.finish(); await new Promise(setImmediate);
  assert.equal(fixture.packets.length, 1); fixture.finish();
  const outputs = await Promise.all(jobs);
  assert.deepEqual(outputs[0], new Uint8Array([1, 2, 3])); assert.deepEqual(outputs[3], new Uint8Array([9, 2, 3]));
  assert.equal(source.byteLength, 3); assert.equal(decoder.stats().peakBatchBytes, 12); assert.equal(decoder.stats().pending, 0); decoder.dispose();
});

test('startup failure falls back; a bad view cannot strand later views', async () => {
  let calls = 0, yields = 0, clock = 0;
  const decoder = createModelDecoder({supported: true, ready: Promise.resolve(), async decodeGltfBufferAsync() {
    clock += 10; if (++calls === 1) throw Error('Bad input'); return new Uint8Array([42]);
  }}, {workers: 1, canUseWorkers: true, createWorker: () => { throw Error('Blocked'); }, now: () => clock, yieldTask: async () => { yields++; }});
  const first = decoder.decodeGltfBufferAsync(1, 1, new Uint8Array([1]), 'ATTRIBUTES');
  const second = decoder.decodeGltfBufferAsync(1, 1, new Uint8Array([2]), 'ATTRIBUTES');
  await assert.rejects(first, /Bad input/); assert.deepEqual(await second, new Uint8Array([42]));
  assert.equal(yields, 2); assert.equal(decoder.stats().fallback, true); assert.equal(decoder.stats().pending, 0);
});

test('a worker crash retries retained source views through the fallback', async () => {
  let fixture;
  const decoder = createModelDecoder({supported: true, ready: Promise.resolve(), async decodeGltfBufferAsync(_count, _size, source) { return source.slice(); }}, {
    workers: 1, canUseWorkers: true, createWorker: () => { fixture = workerFixture(); return fixture.worker; }, yieldTask: async () => {},
  });
  const source = new Uint8Array([4, 5]), pending = decoder.decodeGltfBufferAsync(1, 2, source, 'ATTRIBUTES');
  await new Promise(setImmediate); fixture.worker.onerror({preventDefault() {}});
  assert.deepEqual(await pending, source); assert.equal(decoder.stats().fallback, true); assert.equal(fixture.worker.stopped, true);
});

test('an indivisible oversized view runs alone and disposal rejects pending jobs', async () => {
  let fixture;
  const decoder = createModelDecoder({supported: true, ready: Promise.resolve()}, {workers: 1, canUseWorkers: true, maxBatchBytes: 1,
    createWorker: () => { fixture = workerFixture(); return fixture.worker; }});
  const first = decoder.decodeGltfBufferAsync(1, 3, new Uint8Array(3), 'ATTRIBUTES'), second = decoder.decodeGltfBufferAsync(1, 3, new Uint8Array(3), 'ATTRIBUTES');
  const failures = [assert.rejects(first, {name: 'AbortError'}), assert.rejects(second, {name: 'AbortError'})];
  await new Promise(setImmediate); assert.equal(fixture.packets[0].jobs.length, 1); assert.equal(decoder.stats().oversizedViews, 1);
  decoder.dispose(); await Promise.all(failures); fixture.finish(); assert.equal(decoder.stats().pending, 0);
});

test('the shipped decoder reproduces actual Meshopt data through the yielding fallback', async () => {
  await MeshoptEncoder.ready;
  const input = new Uint8Array(new Float32Array([0, 0, 0, 1, 2, 3, 4, 5, 6]).buffer);
  const encoded = MeshoptEncoder.encodeGltfBuffer(input, 3, 12, 'ATTRIBUTES'); let yields = 0;
  const decoder = createModelDecoder(MeshoptDecoder, {workers: 0, yieldTask: async () => { yields++; }});
  const output = await Promise.all([0, 1, 2].map(() => decoder.decodeGltfBufferAsync(3, 12, encoded, 'ATTRIBUTES', 'NONE')));
  for (const bytes of output) assert.deepEqual(bytes, input);
  assert.equal(yields, 1); assert.equal(decoder.stats().completed, 3);
});

test('canceling one parsing owner discards its queued views without canceling another owner',async()=>{
  let fixture;
  const decoder=createModelDecoder({supported:true,ready:Promise.resolve()},{workers:1,canUseWorkers:true,maxBatchViews:2,
    createWorker:()=>{fixture=workerFixture();return fixture.worker;}});
  const a=new AbortController(),b=new AbortController(),first=decoder.withSignal(a.signal),second=decoder.withSignal(b.signal),bytes=new Uint8Array([7,8]);
  const abandoned=[first.decodeGltfBufferAsync(1,2,bytes,'ATTRIBUTES')],live=[second.decodeGltfBufferAsync(1,2,bytes,'ATTRIBUTES')];
  abandoned.push(first.decodeGltfBufferAsync(1,2,bytes,'ATTRIBUTES'));live.push(second.decodeGltfBufferAsync(1,2,bytes,'ATTRIBUTES'));
  const failures=abandoned.map(promise=>assert.rejects(promise,{name:'AbortError'}));
  await new Promise(setImmediate);a.abort();await Promise.all(failures);assert.equal(decoder.stats().canceled,2);
  fixture.finish();await new Promise(setImmediate);assert.equal(fixture.packets[0].jobs.length,1,'canceled queued view was never copied or submitted');
  fixture.finish();for(const value of await Promise.all(live))assert.deepEqual(value,bytes);
  assert.equal(decoder.stats().pending,0);assert.equal(bytes.byteLength,2);decoder.dispose();
});
