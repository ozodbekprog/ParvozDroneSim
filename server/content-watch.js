import { watch,existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
export function watchContent(root,onContent) {
  if(!existsSync(join(root,'content'))) return;
  let timer,busy=false,dirty=false;
  const refresh=()=>{
    if(busy){dirty=true;return;}busy=true;dirty=false;
    const worker=new Worker(new URL('../tools/content-worker.js',import.meta.url),{workerData:root});
    worker.once('message',result=>{if(result.error)console.warn('Content import: '+result.error);else onContent(result);});
    worker.once('error',error=>console.warn('Content import: '+error.message));
    worker.once('exit',()=>{busy=false;if(dirty)refresh();});
  };
  const watcher=watch(join(root,'content'),{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(refresh,700);});watcher.unref();
  return watcher;
}
