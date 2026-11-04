import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

export function modelWorkerLimits(cores = globalThis.navigator?.hardwareConcurrency) {
  const count = Number(cores) || 0;
  return {geometry: count >= 4 ? 1 : 0, textures: count >= 16 ? 4 : count >= 12 ? 3 : count >= 8 ? 2 : 1};
}
const aborted = () => new DOMException('Geometry decoder disposed', 'AbortError');

/** One shared geometry worker. Batch small views to avoid thousands of worker
 * round trips; copy inputs only when admitted. The byte limit covers active
 * encoded copies + decoded payload, not retained GLTF/scene or GPU memory.
 * An indivisible view larger than the limit runs alone and is reported. */
export function createModelDecoder(decoder, {
  workers = modelWorkerLimits().geometry, canUseWorkers = typeof globalThis.Worker === 'function',
  createWorker = () => new Worker(new URL('./model-decoder-worker.js', import.meta.url), {type: 'module'}),
  maxBatchViews = 128, maxBatchBytes = 8 * 1024 * 1024, budgetMs = 8,
  yieldTask = () => globalThis.scheduler?.yield?.() || new Promise(resolve => setTimeout(resolve, 0)),
  now = () => performance.now(),
} = {}) {
  if (!Number.isInteger(maxBatchViews) || maxBatchViews < 1 || !Number.isFinite(maxBatchBytes) || maxBatchBytes < 1) throw Error('Invalid decoder batch limits');
  let worker, configuration, finishStartup, startupTimer, batch = null, closed = false, nextId = 0, batchId = 0, scheduled = false;
  let workerCount = 0, fallback = false, completed = 0, canceled = 0, pending = 0, peakPending = 0, peakBytes = 0, batches = 0, oversizedViews = 0, sliceStart;
  const queue = [];
  const settle = (job, error, value) => {
    if(job.settled)return;job.settled=true;pending--;completed++;job.source=null;
    if(job.scope){job.scope.jobs.delete(job);if(!job.scope.jobs.size){job.scope.signal.removeEventListener('abort',job.scope.abort);job.scope.listening=false;}}
    if(error)job.reject(error);else job.resolve(value);
  };
  const schedule = () => { if (!scheduled && !closed) { scheduled = true; queueMicrotask(() => { scheduled = false; pump(); }); } };
  const failedWorker = () => {
    clearTimeout(startupTimer); worker?.terminate(); worker = null; workerCount = 0; fallback = true;
    if (batch) { queue.unshift(...batch.jobs.filter(job=>!job.settled)); batch = null; }
    finishStartup?.(); finishStartup = null; schedule();
  };
  const initialize = () => configuration ||= Promise.resolve(decoder.ready).then(async () => {
    if (closed || !workers || !canUseWorkers) return;
    try {
      worker = createWorker(); workerCount = 1;
      await new Promise(resolve => {
        finishStartup = resolve;
        startupTimer = setTimeout(failedWorker, 10000);
        worker.onerror = event => { event.preventDefault?.(); failedWorker(); };
        worker.onmessage = ({data}) => {
          if (closed) return;
          if (data.ready) { clearTimeout(startupTimer); finishStartup?.(); finishStartup = null; return; }
          if (!batch || data.id !== batch.id) return;
          const current = batch;
          if (!Array.isArray(data.results) || data.results.length !== current.jobs.length || data.results.some((row, i) => row.id !== current.jobs[i].id)) return failedWorker();
          batch = null;
          data.results.forEach((row, i) => {
            const job = current.jobs[i];
            if (row.error) settle(job,Object.assign(new Error(row.error.message), {name: row.error.name}));
            else if (!(row.value instanceof Uint8Array) || row.value.byteLength !== job.count * job.size) settle(job,Error('Invalid geometry worker output'));
            else settle(job,null,row.value);
          });
          schedule();
        };
      });
    } catch { failedWorker(); }
  });
  async function pump() {
    if (closed || batch || !queue.length) return;
    if(!pending){queue.length=0;return;}
    try { await initialize(); } catch (error) { for (const job of queue.splice(0)) settle(job,error); return; }
    if (closed || batch || !queue.length) return;
    const jobs = []; let bytes = 0;
    while (queue.length && jobs.length < maxBatchViews) {
      const job = queue[0];if(job.settled){queue.shift();continue;}
      const cost = job.source.byteLength + job.count * job.size;
      if (jobs.length && bytes + cost > maxBatchBytes) break;
      queue.shift(); jobs.push(job); bytes += cost;
      if (bytes >= maxBatchBytes) break;
    }
    if(!jobs.length)return;
    if (bytes > maxBatchBytes) oversizedViews++;
    peakBytes = Math.max(peakBytes, bytes); batches++; batch = {id: ++batchId, jobs};
    if (worker) {
      try {
        const packet = jobs.map(({id, count, size, source, mode, filter}) => ({id, count, size, source: new Uint8Array(source), mode, filter}));
        worker.postMessage({id: batch.id, jobs: packet}, packet.map(job => job.source.buffer));
      } catch { failedWorker(); }
    } else {
      for (const job of jobs) {
        if (closed) return;
        if(job.settled)continue;
        try {
          if (sliceStart === undefined || now() - sliceStart >= budgetMs) { await yieldTask(); sliceStart = now(); }
          if (closed) return;
          if(job.settled)continue;
          settle(job,null,await decoder.decodeGltfBufferAsync(job.count, job.size, job.source, job.mode, job.filter));
        } catch (error) { settle(job,error); }
      }
      batch = null; schedule();
    }
  }
  const enqueue=(count,size,source,mode,filter,scope)=>{
    if(closed||scope?.signal.aborted)return Promise.reject(aborted());
    if(!Number.isSafeInteger(count)||!Number.isSafeInteger(size)||!Number.isSafeInteger(count*size)||count<0||size<1||!(source instanceof Uint8Array))return Promise.reject(Error('Invalid geometry decode request'));
    const result=new Promise((resolve,reject)=>{
      const job={id:++nextId,count,size,source,mode,filter,resolve,reject,scope};queue.push(job);
      if(scope){scope.jobs.add(job);if(!scope.listening){scope.signal.addEventListener('abort',scope.abort,{once:true});scope.listening=true;}}
    });
    pending++;peakPending=Math.max(peakPending,pending);schedule();return result;
  };
  return {
    supported: decoder.supported,
    get ready() { return initialize(); },
    decodeGltfBufferAsync(count, size, source, mode, filter) {
      return enqueue(count,size,source,mode,filter);
    },
    withSignal(signal){
      const scope={signal,jobs:new Set(),listening:false};
      scope.abort=()=>{for(const job of [...scope.jobs]){canceled++;settle(job,aborted());}schedule();};
      return {supported:decoder.supported,get ready(){return initialize();},decodeGltfBufferAsync:(count,size,source,mode,filter)=>enqueue(count,size,source,mode,filter,scope)};
    },
    stats: () => ({workers: workerCount, fallback, active: batch?.jobs.filter(job=>!job.settled).length || 0, pending,
      peakPending, peakBatchBytes: peakBytes, maxBatchBytes, maxBatchViews, batches, oversizedViews, completed,canceled}),
    dispose() {
      if (closed) return; closed = true; clearTimeout(startupTimer); worker?.terminate(); worker = null; workerCount = 0;
      for (const job of [...(batch?.jobs || []), ...queue]) settle(job,aborted());
      queue.length = 0; batch = null; finishStartup?.(); finishStartup = null;
    },
  };
}

export const modelDecoder = createModelDecoder(MeshoptDecoder);
