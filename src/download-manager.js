import {assetDelivery} from './asset-delivery.js';

const fail=(message,code)=>Object.assign(new Error(message),{code});
const manifestKey='parvoz-downloaded-maps-v1';

/** Background downloads retain encoded files only; model parsing belongs to flight/preview loading. */
export class MapDownloadManager {
  constructor({assets=[],delivery=assetDelivery,concurrency=4,progressIntervalMs=80,manifestStorage=delivery.indexStorage}={}){
    this.delivery=delivery;
    this.manifestStorage=manifestStorage;
    this.concurrency=Math.max(1,Number(concurrency)||4);
    this.progressIntervalMs=Math.max(0,Number(progressIntervalMs)??80);
    this.sizes=new Map(assets.map(asset=>[asset.url,Math.max(0,Number(asset.bytes)||0)]));
    this.maps=new Map();this.listeners=new Set();this.queue=[];this.transfers=new Map();this.retained={};
    this.storage={available:null,limit:delivery.retainedLimit||0,used:0,free:null,persistent:false,error:null};
    this.refreshes=Promise.resolve();this.pendingRefresh=null;this.active=null;this.disposed=false;
    try{
      const parsed=JSON.parse(manifestStorage?.getItem(manifestKey)||'{}');
      this.manifests=parsed&&typeof parsed==='object'?parsed:{};
    }catch{this.manifests={};}
  }
  saveManifests(){
    try{this.manifestStorage?.setItem(manifestKey,JSON.stringify(this.manifests));}catch{}
  }
  registerMap(id,urls,{coreUrls}={}){
    if(this.disposed)throw new Error('Download manager has been disposed.');
    const unique=[...new Set(urls)];
    const core=coreUrls?[...new Set(coreUrls)].filter(url=>unique.includes(url)):unique;
    const prior=this.maps.get(id);
    if(prior&&JSON.stringify(prior.urls)===JSON.stringify(unique)&&JSON.stringify(prior.coreUrls)===JSON.stringify(core))return this.mapStatus(id);
    if(prior)this.cancel(id);
    this.maps.set(id,{id,urls:unique,coreUrls:core.length?core:unique,state:'available',updateAvailable:false,error:null,errorCode:null,source:null,hint:null,task:null});
    this.reconcile();this.emit();return this.mapStatus(id);
  }
  initialize(){
    this.ready ||= this.refresh();
    return this.ready;
  }
  /** Explicitly recheck CacheStorage after a reload, tab return or browser eviction. */
  refresh(){
    if(this.pendingRefresh)return this.pendingRefresh;
    const refresh=this.refreshes.then(async()=>{
      if(this.disposed)return this.snapshot();
      const inventory=await this.delivery.retainedInventory();
      if(this.disposed)return this.snapshot();
      this.retained=inventory.entries||{};
      const {entries,...storage}=inventory;this.storage=storage;
      this.reconcile();this.emit();return this.snapshot();
    }).finally(()=>{if(this.pendingRefresh===refresh)this.pendingRefresh=null;});
    this.pendingRefresh=refresh;
    this.refreshes=refresh.catch(()=>{});return refresh;
  }
  async pruneObsoleteAssets(extraUrls=[]){
    if(this.disposed||!this.delivery.pruneObsoleteAssets)return {removed:0,freedBytes:0};
    await this.initialize();
    const active=new Set([...this.sizes.keys(),...extraUrls]);
    for(const map of this.maps.values())for(const url of map.urls)active.add(url);
    return this.delivery.pruneObsoleteAssets([...active]);
  }
  retainedSize(url){
    const bytes=this.retained[url]?.bytes||0,expected=this.sizes.get(url)||0;
    return bytes&&(!expected||expected===bytes)?bytes:0;
  }
  reconcile(){
    let manifestsChanged=false;
    for(const map of this.maps.values()){
      if(['queued','downloading'].includes(map.state))continue;
      const full=map.urls.length>0&&map.urls.every(url=>this.retainedSize(url)>0);
      const coreReady=map.coreUrls.length>0&&map.coreUrls.every(url=>this.retainedSize(url)>0);
      const priorUrls=Array.isArray(this.manifests[map.id]?.urls)?this.manifests[map.id].urls:null;
      const manifestUpdated=Boolean(priorUrls?.length&&priorUrls.some(url=>!map.urls.includes(url)));
      const manifestIntact=Boolean(priorUrls?.length&&!manifestUpdated&&priorUrls.every(url=>this.retainedSize(url)>0));
      const flightDownloaded=coreReady&&map.coreUrls.length<map.urls.length&&!manifestUpdated&&(manifestIntact||!priorUrls);
      if(full||flightDownloaded){
        map.state='downloaded';map.updateAvailable=false;map.error=null;map.errorCode=null;map.hint=null;
        const retainedUrls=map.urls.filter(url=>this.retainedSize(url)>0);
        if(JSON.stringify(priorUrls)!==JSON.stringify(retainedUrls)){
          this.manifests[map.id]={urls:retainedUrls};manifestsChanged=true;
        }
      }else if(manifestUpdated){
        map.state='available';map.updateAvailable=true;
        map.hint='Map updated. Download again to restore missing files.';
      }else if(map.state==='downloaded'||(priorUrls?.length&&!manifestIntact)){
        map.state='available';map.updateAvailable=false;
        map.hint='Some saved files were removed by the browser. Download again to restore them.';
      }
    }
    if(manifestsChanged)this.saveManifests();
  }
  mapStatus(id){
    const map=this.maps.get(id);if(!map)return;
    let loaded=0,total=0,retainedBytes=0,filesDone=0;
    for(const url of map.urls){
      const saved=this.retainedSize(url),transfer=this.transfers.get(url),expected=this.sizes.get(url)||0;
      const received=Math.max(saved,transfer?.loaded||0);
      loaded+=received;total+=Math.max(expected,received);
      retainedBytes+=saved;if(saved)filesDone++;
    }
    const retained=map.urls.length>0&&(filesDone===map.urls.length||map.state==='downloaded');
    return {id:map.id,urls:[...map.urls],state:map.state,updateAvailable:Boolean(map.updateAvailable),loaded,total,filesDone,files:map.urls.length,retainedBytes,retained,
      unsupported:this.storage.available===false,error:map.error,errorCode:map.errorCode,source:map.source,
      hint:this.storage.available===false?this.storage.error:map.hint,
      totalKnown:map.urls.every(url=>(this.sizes.get(url)||this.retainedSize(url))>0)};
  }
  snapshot(){
    return {maps:[...this.maps.keys()].map(id=>this.mapStatus(id)),storage:{...this.storage},activeId:this.active?.map.id||null,queued:this.queue.filter(task=>!task.canceled).map(task=>task.map.id)};
  }
  subscribe(listener){
    this.listeners.add(listener);listener(this.snapshot());return()=>this.listeners.delete(listener);
  }
  emit(){
    if(this.disposed)return;
    const value=this.snapshot();
    // One UI subscriber must not terminate a shared network transfer or persistence write.
    for(const listener of this.listeners){try{listener(value);}catch(error){console.error('Download listener:',error);}}
  }
  enqueue(id){
    const map=this.maps.get(id);if(!map)throw new Error(`Unknown map: ${id}`);
    if(this.disposed)return Promise.resolve(this.mapStatus(id));
    if(['queued','downloading'].includes(map.state))return map.task.promise;
    const task={map,controller:new AbortController(),canceled:false,settled:false};
    task.promise=new Promise(resolve=>{task.resolve=value=>{if(!task.settled){task.settled=true;resolve(value);}};});
    map.task=task;map.state='queued';map.error=null;map.errorCode=null;map.hint=null;map.source=null;
    this.queue.push(task);this.emit();this.pump();return task.promise;
  }
  retry(id){return this.enqueue(id);}
  cancel(id){
    const map=this.maps.get(id),task=map?.task;
    if(!task||!['queued','downloading'].includes(map.state))return this.mapStatus(id);
    task.canceled=true;task.controller.abort();this.queue=this.queue.filter(item=>item!==task);
    for(const [url,transfer] of this.transfers)if(transfer.task===task)this.transfers.delete(url);
    map.state='canceled';map.source=null;map.error=null;map.errorCode=null;
    const result=this.mapStatus(id);task.resolve(result);this.emit();return result;
  }
  pump(){
    if(this.disposed||this.active)return;
    const task=this.queue.shift();if(!task)return;
    if(task.canceled){this.pump();return;}
    this.active=task;task.map.state='downloading';this.emit();
    this.run(task).catch(error=>{
      if(task.map.task!==task||task.canceled)return;
      task.map.state=error.name==='AbortError'?'canceled':'error';
      task.map.error=error.name==='AbortError'?null:error.message;
      task.map.errorCode=error.code||null;
      if(error.code==='STORAGE_UNAVAILABLE')this.storage={...this.storage,available:false,error:error.message};
    }).finally(()=>{
      for(const [url,transfer] of this.transfers)if(transfer.task===task)this.transfers.delete(url);
      if(this.active===task)this.active=null;
      task.resolve(this.mapStatus(task.map.id));this.emit();this.pump();
    });
  }
  async run(task){
    const {map,controller:{signal}}=task;
    const hadReady=!!this.ready;
    await this.initialize();signal.throwIfAborted();
    if(hadReady){await this.refresh();signal.throwIfAborted();}
    if(!this.storage.available)throw fail(this.storage.error||'Saved map storage is unavailable.','STORAGE_UNAVAILABLE');
    if(!map.urls.length)throw fail('This map has no downloadable assets.','NO_ASSETS');
    const missing=map.urls.filter(url=>!this.retainedSize(url));
    const required=missing.reduce((sum,url)=>sum+(this.sizes.get(url)||0),0);
    if(this.storage.used+required>this.storage.limit||(this.storage.free!==null&&required>this.storage.free)){
      throw fail('There is not enough browser storage to save this map. Existing downloaded maps have been kept.','STORAGE_FULL');
    }
    let cursor=0,firstError=null,lastEmit=0;
    const downloadNext=async()=>{
      while(cursor<missing.length&&!firstError){
        signal.throwIfAborted();
        const url=missing[cursor++],expected=this.sizes.get(url)||0;
        try{
          const result=await this.delivery.retain(url,{signal,expectedBytes:expected,onProgress:(loaded,source)=>{
            if(task.canceled||signal.aborted)return;
            const prior=this.transfers.get(url);
            this.transfers.set(url,{task,loaded,source});map.source=source;
            const now=performance.now();
            if(!prior||prior.source!==source||(prior.loaded===0&&loaded>0)||(expected>0&&loaded>=expected)||now-lastEmit>=this.progressIntervalMs){
              lastEmit=now;this.emit();
            }
          }});
          signal.throwIfAborted();
          this.retained[url]={bytes:result.bytes};this.sizes.set(url,result.bytes);
          this.storage.used=Object.values(this.retained).reduce((sum,item)=>sum+item.bytes,0);
          this.transfers.delete(url);lastEmit=performance.now();this.emit();
        }catch(error){
          this.transfers.delete(url);
          firstError ||= error;
        }
      }
    };
    await Promise.all(Array.from({length:Math.min(this.concurrency,missing.length)},()=>downloadNext()));
    if(firstError)throw firstError;
    signal.throwIfAborted();
    // Browser quota/eviction may change during a long download. Recheck every file before claiming completion.
    await this.refresh();signal.throwIfAborted();
    if(!this.storage.available)throw fail(this.storage.error||'Saved map storage is unavailable.','STORAGE_UNAVAILABLE');
    if(!map.urls.every(url=>this.retainedSize(url)))throw fail('The browser did not keep every map file. Retry after checking available storage.','STORAGE_INCOMPLETE');
    if(map.task===task){
      map.state='downloaded';map.updateAvailable=false;map.source=null;map.error=null;map.errorCode=null;map.hint=null;
      this.manifests[map.id]={urls:[...map.urls]};this.saveManifests();
    }
  }
  dispose(){
    if(this.disposed)return;
    for(const id of this.maps.keys())this.cancel(id);
    this.disposed=true;this.listeners.clear();this.queue=[];
  }
}
