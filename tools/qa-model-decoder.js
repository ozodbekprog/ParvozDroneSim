import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createModelDecoder} from '../src/model-decoder.js';

const map = document.querySelector('#map'), run = document.querySelector('#run'), status = document.querySelector('#status'), output = document.querySelector('#result');
const {customContent: catalog} = await fetch('/api/catalog', {cache: 'no-store'}).then(r => r.json());
for (const item of catalog.maps) if (item.model) map.add(new Option(item.name, item.id));
map.value = 'liftoff-pine-valley-demo'; status.textContent = 'Choose a map';
const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
function jobsIn(bytes) {
  const view = new DataView(bytes), jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength))), base = 28 + jsonLength;
  return (json.bufferViews || []).flatMap(view => {
    const ext = view.extensions?.EXT_meshopt_compression || view.extensions?.KHR_meshopt_compression;
    if (!ext) return [];
    if (ext.buffer !== 0) throw Error('Expected embedded compressed data');
    return [{count: ext.count, size: ext.byteStride, source: new Uint8Array(bytes, base + (ext.byteOffset || 0), ext.byteLength), mode: ext.mode, filter: ext.filter || 'NONE'}];
  });
}
async function measure(jobs, workers) {
  MeshoptDecoder.useWorkers(0);
  const decoder = workers ? createModelDecoder(MeshoptDecoder, {workers}) : MeshoptDecoder;
  await decoder.ready;
  const issues = new Set();
  const check = () => { if (document.hidden || !document.hasFocus()) issues.add('Document hidden or unfocused'); };
  const changed = () => check();
  document.addEventListener('visibilitychange', changed); window.addEventListener('blur', changed); check();
  let heartbeats = 0, maxGap = 0, previous = performance.now();
  const timer = setInterval(() => { const now = performance.now(); maxGap = Math.max(maxGap, now - previous); previous = now; heartbeats++; }, 16);
  const start = performance.now();
  let decoded;
  try { decoded = await Promise.all(jobs.map(job => decoder.decodeGltfBufferAsync(job.count, job.size, job.source, job.mode, job.filter))); }
  finally { maxGap = Math.max(maxGap, performance.now() - previous); clearInterval(timer); check(); document.removeEventListener('visibilitychange', changed); window.removeEventListener('blur', changed); }
  const decodeMs = performance.now() - start;
  // Hash after timing. Compare every decoded view, not just byte counts.
  try {
    const hashes = []; for (const bytes of decoded) hashes.push(await sha(bytes));
    return {workers, decodeMs, heartbeats, maxHeartbeatGapMs: maxGap, valid: !issues.size, invalidReasons: [...issues], stats: decoder.stats?.(), hashes};
  } finally { decoder.dispose?.(); }
}
run.onclick = async () => {
  run.disabled = true;
  try {
    const item = catalog.maps.find(item => item.id === map.value); status.textContent = 'Reading delivery';
    const bytes = await fetch(item.model).then(r => r.arrayBuffer()), jobs = jobsIn(bytes);
    status.textContent = 'Main-thread baseline'; await new Promise(requestAnimationFrame);
    const baseline = await measure(jobs, 0);
    status.textContent = 'Bounded geometry worker'; await new Promise(requestAnimationFrame);
    const worker = await measure(jobs, 1);
    const equal = baseline.hashes.length === worker.hashes.length && baseline.hashes.every((hash, i) => hash === worker.hashes[i]);
    const result = {map: item.id, source: item.model, encodedBytes: bytes.byteLength, jobs: jobs.length,
      decodedBytes: jobs.reduce((n, job) => n + job.count * job.size, 0), identicalDecodedViews: equal,
      hardwareConcurrency: navigator.hardwareConcurrency, userAgent: navigator.userAgent,
      arms: await Promise.all([baseline, worker].map(async ({hashes, ...row}) => ({...row, decodedViewsHash: await sha(new TextEncoder().encode(hashes.join(',')))})))};
    output.textContent = JSON.stringify(result, null, 2); status.textContent = equal ? 'Decoded geometry matches' : 'FAILED: decoded geometry differs';
    if (!equal) throw Error('Geometry mismatch');
  } catch (error) { status.textContent = error.message; console.error(error); }
  finally { MeshoptDecoder.useWorkers(0); run.disabled = false; }
};
