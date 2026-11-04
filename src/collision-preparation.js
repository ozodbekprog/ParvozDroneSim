import {installCollisionTree,prepareCollisionsAsync} from '../shared/collision.js';
import {preparedBytes} from './flight-loading.js';
import {assetDelivery} from './asset-delivery.js';

const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const abortError=()=>new DOMException('Collision preparation canceled','AbortError');
const metrics=new Map();
export const collisionPreparationMetrics=()=>[...metrics.values()].map(item=>({...item}));

export function runCollisionWorker(bytes,{signal,createWorker=()=>new Worker(new URL('./collision-worker.js',import.meta.url),{type:'module'})}={}){
 if(signal?.aborted)return Promise.reject(abortError());
 return new Promise((resolve,reject)=>{
  let worker,finished=false;
  const finish=(error,value)=>{
   if(finished)return;finished=true;signal?.removeEventListener('abort',abort);worker?.terminate();
   if(error)reject(error);else resolve(value);
  };
  const abort=()=>finish(abortError());
  try{
   worker=createWorker();signal?.addEventListener('abort',abort,{once:true});
   worker.onmessage=({data})=>data.ok?finish(null,data):finish(new Error(data.message||'Collision preparation failed'));
   worker.onerror=event=>{event.preventDefault?.();finish(new Error(event.message||'Collision worker failed'));};
   worker.onmessageerror=()=>finish(new Error('Could not read prepared collisions'));
   // Download/cache buffers are shared with flight loading. Transfer a copy so
   // cancel/retry and other consumers never see a detached cached buffer.
   const copy=bytes.slice(0);worker.postMessage(copy,[copy]);
  }catch(error){finish(error);}
 });
}

export async function loadPreparedCollisions(url,{signal,read=async()=>preparedBytes(url)||(await assetDelivery.get(url,{signal,cacheMemory:false})).bytes,run=runCollisionWorker}={}){
 const start=performance.now(),bytes=await read();signal?.throwIfAborted();
 const result=await run(bytes,{signal});signal?.throwIfAborted();
 let slice=performance.now();
 for(const {index,tree} of result.trees){
  installCollisionTree(result.colliders[index],tree);
  if(performance.now()-slice>8){await yieldTask();signal?.throwIfAborted();slice=performance.now();}
 }
 await prepareCollisionsAsync(result.colliders,{signal});signal?.throwIfAborted();
 if(metrics.size>=32)metrics.delete(metrics.keys().next().value);
 metrics.set(url,{url,...result.timing,totalMs:performance.now()-start,colliders:result.colliders.length,worker:true});
 return result.colliders;
}
