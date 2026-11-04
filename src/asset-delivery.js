import {assetByteCache} from './asset-byte-cache.js';
import {transferAsset} from './asset-transfer.js';
import {installedAssets} from '../shared/catalog.js';

let catalogAssets,catalogSizes,catalogEquivalents;
function ensureCatalogLookup(){
  if(catalogAssets===installedAssets)return;
  catalogAssets=installedAssets;catalogSizes=new Map();catalogEquivalents=new Map();
  for(const asset of installedAssets){
    catalogSizes.set(asset.url,asset.bytes);
    const name=asset.url.split('/').pop();
    if(name&&asset.bytes>0){
      const key=`${name}:${asset.bytes}`;
      if(!catalogEquivalents.has(key))catalogEquivalents.set(key,[]);
      catalogEquivalents.get(key).push(asset.url);
    }
  }
}
export function expectedAssetBytes(url){
  ensureCatalogLookup();
  return catalogSizes.get(url)||0;
}
function equivalentAssetURLs(url,expectedBytes){
  if(!expectedBytes)return [];
  ensureCatalogLookup();
  if(catalogSizes.get(url)!==expectedBytes)return [];
  const list=catalogEquivalents.get(`${url.split('/').pop()}:${expectedBytes}`);
  return list&&list.length>1?list.filter(other=>other!==url):[];
}

const immutable = url => /^\/content\/assets\/.*-[a-f0-9]{16}\.(glb|json|pcol|png|jpe?g)$/i.test(url);
const cacheName = 'parvoz-encoded-assets-v1';
const indexKey = 'parvoz-encoded-assets-index-v1';
const retainedCacheName = 'parvoz-downloaded-assets-v1';
const browserStorage=key=>{try{return globalThis[key];}catch{return undefined;}};
const storageError=(message,code='STORAGE_UNAVAILABLE')=>Object.assign(new Error(message),{code});
const aborted=()=>new DOMException('Canceled','AbortError');
const storedResponse=bytes=>new Response(bytes,{headers:{'Content-Type':'application/octet-stream','X-Parvoz-Bytes':String(bytes.byteLength),'X-Parvoz-Used':String(Date.now())}});
const updateCachePolicy=entry=>{
  entry.cacheMemory=false;entry.persist=false;
  for(const listener of entry.listeners){entry.cacheMemory ||= listener.cacheMemory;entry.persist ||= listener.persist;}
};

/** Disk retains encoded deliveries only. Failed/quota-limited storage is optional. */
export class AssetDelivery {
  constructor({memory=assetByteCache,fetcher=(...args)=>fetch(...args),storage=browserStorage('caches'),indexStorage=browserStorage('localStorage'),limit=2.5*1024*1024*1024,retainedLimit=4*1024*1024*1024,storageManager=browserStorage('navigator')?.storage,retentionHeadroom=16*1024*1024,transfer={}}={}) {
    Object.assign(this,{memory,fetcher,storage,indexStorage,limit,retainedLimit,storageManager,retentionHeadroom,transfer});
    this.pending=new Map();this.writes=Promise.resolve();this.retainedWrites=Promise.resolve();this.retainedEntries={};this.explicitRetained={};
    try {const parsed=JSON.parse(indexStorage?.getItem(indexKey)||'{}');this.index=Object.fromEntries(Object.entries(parsed||{}).filter(([url,item])=>immutable(url)&&Number.isFinite(item?.bytes)&&item.bytes>=0&&Number.isFinite(item.used)));}catch{this.index={};}
  }
  async openCache(){
    this.cacheReady ||= this.storage.open(cacheName).then(async cache=>{
      // Reconcile actual files: browser eviction or an unavailable index must not defeat the budget.
      const entries={},requests=await cache.keys();
      const matched=await Promise.all(requests.map(async request=>{
        const url=new URL(request.url,'http://localhost/').pathname;
        if(!immutable(url))return null;
        return {request,url,response:await cache.match(request)};
      }));
      const deletions=[];
      for(const item of matched){
        if(!item)continue;
        const bytes=Number(item.response?.headers.get('X-Parvoz-Bytes'));
        if(!Number.isFinite(bytes)||bytes<=0){deletions.push(cache.delete(item.request));continue;}
        entries[item.url]={bytes,used:this.index[item.url]?.used||Number(item.response.headers.get('X-Parvoz-Used'))||Date.now()};
      }
      if(deletions.length)await Promise.all(deletions);
      this.index=entries;this.saveIndex();return cache;
    });
    return this.cacheReady;
  }
  async openRetainedCache(){
    if(!this.storage)throw storageError('Saved map storage is unavailable in this browser.');
    // Do not keep a rejected promise: a later Retry may follow a browser storage change.
    if(!this.retainedReady)this.retainedReady=Promise.resolve().then(()=>this.storage.open(retainedCacheName)).catch(error=>{this.retainedReady=null;throw error;});
    return this.retainedReady;
  }
  async retentionCapacity(){
    let estimate={},persistent=false;
    try{estimate=await this.storageManager?.estimate?.()||{};persistent=await this.storageManager?.persisted?.()||false;}catch{}
    const quota=Number(estimate.quota)||0,usage=Number(estimate.usage)||0;
    return {limit:Math.max(0,Math.min(this.retainedLimit,quota?Math.floor(quota*.75):this.retainedLimit)),free:quota?Math.max(0,quota-usage-this.retentionHeadroom):null,persistent};
  }
  /** Enumerate actual cache responses, never a localStorage completion flag. Cache.put is atomic. */
  async retainedInventory(){
    await Promise.all([this.retainedWrites,this.writes]);
    try{
      const cache=await this.openRetainedCache(),entries={},explicit={},requests=await cache.keys();
      const [matched,capacity]=await Promise.all([
        Promise.all(requests.map(async request=>({url:new URL(request.url,'http://localhost/').pathname,response:await cache.match(request)}))),
        this.retentionCapacity(),
      ]);
      for(const {url,response} of matched){
        const bytes=Number(response?.headers.get('X-Parvoz-Bytes'));
        if(immutable(url)&&response?.ok&&Number.isSafeInteger(bytes)&&bytes>0){
          entries[url]={bytes};explicit[url]={bytes};
        }
      }
      const retainedUsed=Object.values(explicit).reduce((sum,item)=>sum+item.bytes,0);
      if(this.indexStorage){
        try{
          await this.openCache();
          for(const [url,item] of Object.entries(this.index)){
            if(!entries[url]&&immutable(url)&&Number.isSafeInteger(item?.bytes)&&item.bytes>0)entries[url]={bytes:item.bytes};
          }
        }catch{}
      }
      for(const [url,item] of Object.entries({...entries})){
        for(const other of equivalentAssetURLs(url,item.bytes)){
          if(!entries[other])entries[other]={bytes:item.bytes};
        }
      }
      this.explicitRetained=explicit;
      this.retainedEntries=entries;
      return {...capacity,available:true,entries,used:retainedUsed,retainedUsed,error:null};
    }catch(error){
      this.explicitRetained={};
      this.retainedEntries={};
      return {available:false,entries:{},used:0,retainedUsed:0,limit:this.retainedLimit,free:null,persistent:false,error:'Saved map storage is unavailable. Check browser storage settings and retry.'};
    }
  }
  /** Remove cached immutable assets that are no longer referenced by the active catalog. */
  async pruneObsoleteAssets(activeUrls=[]){
    if(!this.storage)return {removed:0,freedBytes:0};
    await Promise.all([this.retainedWrites,this.writes]);
    const valid=new Set((activeUrls.length?activeUrls:installedAssets.map(asset=>asset.url)).filter(immutable));
    if(!valid.size)return {removed:0,freedBytes:0};
    let removed=0,freedBytes=0;
    try{
      const cache=await this.openRetainedCache(),requests=await cache.keys();
      for(const request of requests){
        const url=new URL(request.url,'http://localhost/').pathname;
        if(!immutable(url)||valid.has(url))continue;
        const response=await cache.match(request);
        freedBytes+=Math.max(0,Number(response?.headers.get('X-Parvoz-Bytes'))||0);
        await cache.delete(request);
        delete this.explicitRetained[url];delete this.retainedEntries[url];
        removed++;
      }
    }catch{}
    try{
      const cache=await this.openCache(),requests=await cache.keys();
      let indexChanged=false;
      for(const request of requests){
        const url=new URL(request.url,'http://localhost/').pathname;
        if(!immutable(url)||valid.has(url))continue;
        freedBytes+=Math.max(0,Number(this.index[url]?.bytes)||0);
        await cache.delete(request);
        delete this.index[url];delete this.retainedEntries[url];
        indexChanged=true;removed++;
      }
      if(indexChanged)this.saveIndex();
    }catch{}
    return {removed,freedBytes};
  }
  /** Save one encoded delivery explicitly. Unlike the optional LRU, this cache never evicts another map. */
  async retain(url,{signal,onProgress,expectedBytes=0}={}){
    if(signal?.aborted)throw aborted();
    if(!immutable(url))throw storageError('Only immutable game assets can be saved.','INVALID_ASSET');
    await this.openRetainedCache().catch(()=>{throw storageError('Saved map storage is unavailable. Check browser storage settings and retry.');});
    const result=await this.get(url,{signal,onProgress,expectedBytes,cacheMemory:false,persist:false});
    signal?.throwIfAborted();
    if(expectedBytes&&result.bytes.byteLength!==expectedBytes)throw storageError(`Downloaded size does not match the asset catalog: ${url}`,'SIZE_MISMATCH');
    const write=this.retainedWrites.then(async()=>{
      signal?.throwIfAborted();
      const cache=await this.openRetainedCache(),existing=await cache.match(url);
      if(Number(existing?.headers.get('X-Parvoz-Bytes'))===result.bytes.byteLength){
        this.explicitRetained[url]={bytes:result.bytes.byteLength};
        this.retainedEntries[url]={bytes:result.bytes.byteLength};
        return;
      }
      const [{limit,free},requests]=await Promise.all([this.retentionCapacity(),cache.keys()]);
      // Recount here because browser eviction and other manager instances may have changed the cache.
      const responses=await Promise.all(requests.map(request=>new URL(request.url,'http://localhost/').pathname===url?null:cache.match(request)));
      let used=0;
      for(const response of responses)used+=Math.max(0,Number(response?.headers.get('X-Parvoz-Bytes'))||0);
      if(used+result.bytes.byteLength>limit||(free!==null&&result.bytes.byteLength>free))throw storageError('There is not enough browser storage to save this map. Existing downloaded maps have been kept.','STORAGE_FULL');
      signal?.throwIfAborted();
      try{await cache.put(url,storedResponse(result.bytes));}catch(error){throw storageError('The browser could not save this file. Existing downloaded maps have been kept.',error?.name==='QuotaExceededError'?'STORAGE_FULL':'STORAGE_UNAVAILABLE');}
      const saved=await cache.match(url);
      if(Number(saved?.headers.get('X-Parvoz-Bytes'))!==result.bytes.byteLength)throw storageError('The browser did not retain this file. Retry after checking storage.','STORAGE_INCOMPLETE');
      this.explicitRetained[url]={bytes:result.bytes.byteLength};
      this.retainedEntries[url]={bytes:result.bytes.byteLength};
      for(const other of equivalentAssetURLs(url,result.bytes.byteLength)){
        if(!this.retainedEntries[other])this.retainedEntries[other]={bytes:result.bytes.byteLength};
      }
      // A foreground subscriber may also have queued an optional copy; remove it after its write.
      this.writes=this.writes.then(async()=>{
        try{if(this.index[url]){const optional=await this.openCache();await optional.delete(url);delete this.index[url];this.saveIndex();}}catch{}
      });
    });
    this.retainedWrites=write.catch(()=>{});
    await write;signal?.throwIfAborted();
    return {bytes:result.bytes.byteLength,source:result.source,networkBytes:result.networkBytes};
  }
  async readSingleFromDisk(url,expectedBytes=0,{evictCorrupt=true}={}){
    try{
      const cache=await this.openRetainedCache(),response=await cache.match(url);
      if(response){
        const bytes=await response.arrayBuffer();
        if(response.ok&&bytes.byteLength>0&&bytes.byteLength===Number(response.headers.get('X-Parvoz-Bytes'))&&(!expectedBytes||bytes.byteLength===expectedBytes)){this.explicitRetained[url]={bytes:bytes.byteLength};this.retainedEntries[url]={bytes:bytes.byteLength};return bytes;}
        if(evictCorrupt){delete this.explicitRetained[url];delete this.retainedEntries[url];await cache.delete(url);}
      }
    }catch{}
    try {
      const cache=await this.openCache(),response=await cache.match(url);
      if(!response)return;
      const bytes=await response.arrayBuffer();
      if(!response.ok||!bytes.byteLength||bytes.byteLength!==Number(response.headers.get('X-Parvoz-Bytes'))||(expectedBytes&&bytes.byteLength!==expectedBytes)){
        if(evictCorrupt){await cache.delete(url);delete this.index[url];delete this.retainedEntries[url];this.saveIndex();}return;
      }
      this.index[url]={bytes:bytes.byteLength,used:Date.now()};this.retainedEntries[url]={bytes:bytes.byteLength};this.saveIndex();
      return bytes;
    }catch { /* Browser privacy/quota settings may disable CacheStorage. */ }
  }
  async diskRead(url,expectedBytes=0) {
    if(!this.storage || !immutable(url))return;
    const direct=await this.readSingleFromDisk(url,expectedBytes);
    if(direct)return direct;
    for(const other of equivalentAssetURLs(url,expectedBytes)){
      const shared=await this.readSingleFromDisk(other,expectedBytes,{evictCorrupt:false});
      if(shared)return shared;
    }
  }
  saveIndex(){try{this.indexStorage?.setItem(indexKey,JSON.stringify(this.index));}catch{}}
  persist(url,bytes){
    if(!this.storage || !immutable(url) || bytes.byteLength>this.limit || this.explicitRetained[url])return;
    this.writes=this.writes.then(async()=>{
      try {
        const quota=(await globalThis.navigator?.storage?.estimate?.())?.quota;
        const budget=Math.min(this.limit,quota?Math.floor(quota*.6):this.limit);
        if(bytes.byteLength>budget)return;
        const cache=await this.openCache();
        let total=Object.values(this.index).reduce((sum,item)=>sum+item.bytes,0)-(this.index[url]?.bytes||0);
        for(const [old,item] of Object.entries(this.index).sort((a,b)=>a[1].used-b[1].used)){
          if(total+bytes.byteLength<=budget)break;
          if(old===url)continue;
          await cache.delete(old);delete this.index[old];delete this.retainedEntries[old];total-=item.bytes;
        }
        if(this.explicitRetained[url])return;
        await cache.put(url,storedResponse(bytes));
        this.index[url]={bytes:bytes.byteLength,used:Date.now()};
        this.retainedEntries[url]={bytes:bytes.byteLength};
        for(const other of equivalentAssetURLs(url,bytes.byteLength)){
          if(!this.retainedEntries[other])this.retainedEntries[other]={bytes:bytes.byteLength};
        }
        this.saveIndex();
      }catch { /* Eviction/full disk must never prevent a flight. */ }
    });
  }
  get(url,{signal,onProgress,expectedBytes=0,cacheMemory=true,persist=true}={}) {
    if(signal?.aborted)return Promise.reject(new DOMException('Canceled','AbortError'));
    expectedBytes=immutable(url)?expectedBytes||expectedAssetBytes(url):0;
    let memory=this.memory.get(url,expectedBytes);
    if(!memory){for(const other of equivalentAssetURLs(url,expectedBytes)){memory=this.memory.get(other,expectedBytes);if(memory)break;}}
    if(memory){onProgress?.(memory.byteLength,'Memory cache');return Promise.resolve({bytes:memory,source:'Memory cache',networkBytes:0});}
    let entry=this.pending.get(url);
    if(entry?.controller.signal.aborted){this.pending.delete(url);entry=null;}
    if(!entry){
      entry={controller:new AbortController(),listeners:new Set(),loaded:0,source:'Checking cache',cacheMemory:false,persist:false};
      this.pending.set(url,entry);
      entry.promise=this.read(url,entry,expectedBytes).finally(()=>{if(this.pending.get(url)===entry)this.pending.delete(url);});
    }
    return new Promise((resolve,reject)=>{
      const listener={onProgress,cacheMemory,persist};
      entry.listeners.add(listener);updateCachePolicy(entry);
      let settled=false;
      const release=()=>{entry.listeners.delete(listener);updateCachePolicy(entry);signal?.removeEventListener('abort',abort);};
      const abort=()=>{if(settled)return;settled=true;release();reject(new DOMException('Canceled','AbortError'));if(!entry.listeners.size)entry.controller.abort();};
      signal?.addEventListener('abort',abort,{once:true});
      listener.onProgress?.(entry.loaded,entry.source);
      entry.promise.then(value=>{if(!settled){settled=true;release();resolve(value);}},error=>{if(!settled){settled=true;release();reject(error);}});
    });
  }
  async read(url,entry,expectedBytes){
    const signal=entry.controller.signal;
    const progress=(count,source)=>{entry.loaded=count;entry.source=source;for(const listener of entry.listeners)listener.onProgress?.(count,source);};
    const saved=await this.diskRead(url,expectedBytes);signal.throwIfAborted();
    if(saved){if(entry.cacheMemory)this.memory.set(url,saved);progress(saved.byteLength,'Disk cache');return {bytes:saved,source:'Disk cache',networkBytes:0};}
    const {bytes,source,networkBytes}=await transferAsset(url,{...this.transfer,fetcher:this.fetcher,signal,expectedBytes:immutable(url)?expectedBytes:0,resumable:immutable(url),onProgress:progress});
    if(entry.cacheMemory)this.memory.set(url,bytes);if(entry.persist)this.persist(url,bytes);progress(bytes.byteLength,source);
    return {bytes,source,networkBytes};
  }
}
export const assetDelivery=new AssetDelivery();
