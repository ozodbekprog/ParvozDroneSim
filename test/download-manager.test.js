import test from 'node:test';
import assert from 'node:assert/strict';
import {MapDownloadManager} from '../src/download-manager.js';
import {AssetDelivery} from '../src/asset-delivery.js';
import {AssetByteCache,defaultAssetByteCacheLimit} from '../src/asset-byte-cache.js';

const urls=['/content/assets/download/a-1111111111111111.glb','/content/assets/download/b-2222222222222222.glb','/content/assets/download/c-3333333333333333.json'];
const assets=urls.map((url,index)=>({url,bytes:[4,3,2][index]}));
const abortError=()=>new DOMException('Canceled','AbortError');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function disk(){
  const downloaded=new Map(),optional=new Map();
  const saved={downloaded,optional,optionalPuts:0,putHook:null,openError:null};
  const key=value=>typeof value==='string'?value:new URL(value.url).pathname;
  saved.storage={open:async name=>{
    if(saved.openError)throw saved.openError;
    const entries=name==='parvoz-downloaded-assets-v1'?downloaded:optional;
    return {keys:async()=>[...entries.keys()].map(url=>({url:'https://game.test'+url})),match:async url=>entries.get(key(url))?.clone(),
      put:async(url,response)=>{if(entries===downloaded)await saved.putHook?.(url,response);else saved.optionalPuts++;entries.set(key(url),response.clone());},delete:async url=>entries.delete(key(url))};
  }};
  return saved;
}
function setup({saved=disk(),fetcher,retainedLimit=100,storageManager,memory=new AssetByteCache(0),assets:catalog=assets}={}){
  const requests=[];
  const delivery=new AssetDelivery({storage:saved.storage,indexStorage:null,memory,retainedLimit,retentionHeadroom:0,storageManager,
    fetcher:fetcher|| (async url=>{requests.push(url);return new Response(new Uint8Array(catalog.find(asset=>asset.url===url)?.bytes||1).fill(urls.indexOf(url)+1));})});
  return {saved,delivery,requests,manager:new MapDownloadManager({assets:catalog,delivery})};
}
function when(manager,predicate){
  return new Promise(resolve=>{let done=false;const off=manager.subscribe(value=>{if(!done&&predicate(value)){done=true;queueMicrotask(()=>{off();resolve(value);});}});});
}
const row=(snapshot,id)=>snapshot.maps.find(map=>map.id===id);

test('queued background downloads save exact bytes once, report file progress and feed foreground reads after reload',async()=>{
  const {saved,delivery,requests,manager}=setup();
  manager.registerMap('one',[urls[0],urls[1],urls[0]]);manager.registerMap('two',[urls[1],urls[2]]);
  const states=[];const off=manager.subscribe(value=>states.push(value));
  const first=manager.enqueue('one');assert.equal(manager.enqueue('one'),first);
  const second=manager.enqueue('two');assert.equal(manager.mapStatus('two').state,'queued');
  assert.equal((await first).state,'downloaded');assert.equal((await second).state,'downloaded');off();
  assert.deepEqual(requests,urls);assert.equal(saved.downloaded.size,3);assert.equal(saved.optional.size,0);assert.equal(delivery.memory.bytes,0);
  assert.ok(states.some(value=>row(value,'one').filesDone===1&&row(value,'one').files===2));
  assert.deepEqual(Object.fromEntries(['loaded','total','filesDone','files','retainedBytes','retained'].map(key=>[key,manager.mapStatus('one')[key]])),{loaded:7,total:7,filesDone:2,files:2,retainedBytes:7,retained:true});
  const next=setup({saved,fetcher:async()=>{throw new Error('A saved flight must not fetch again.');}});
  next.manager.registerMap('one',[urls[0],urls[1]]);await next.manager.initialize();assert.equal(next.manager.mapStatus('one').state,'downloaded');
  const result=await next.delivery.get(urls[0]);assert.equal(result.networkBytes,0);assert.deepEqual([...new Uint8Array(result.bytes)],[1,1,1,1]);
  manager.dispose();next.manager.dispose();
});

test('a new map revision fetches changed hashed files and reuses unchanged saved assets',async()=>{
  const memory=new AssetByteCache(100),before=setup({memory});
  before.manager.registerMap('same-map',[urls[0],urls[1]]);
  await before.manager.enqueue('same-map');
  await before.delivery.get(urls[0]);
  before.manager.dispose();
  const replacement='/content/assets/download/a-4444444444444444.glb';
  const requests=[],after=setup({saved:before.saved,memory,
    assets:[{url:replacement,bytes:4},assets[1]],
    fetcher:async url=>{requests.push(url);assert.equal(url,replacement);return new Response(Uint8Array.of(9,8,7,6));}});
  after.manager.registerMap('same-map',[replacement,urls[1]]);
  await after.manager.initialize();
  assert.equal(after.manager.mapStatus('same-map').state,'available');
  assert.equal(after.manager.mapStatus('same-map').filesDone,1);
  assert.equal((await after.manager.enqueue('same-map')).state,'downloaded');
  assert.deepEqual(requests,[replacement]);
  assert.deepEqual([...new Uint8Array((await after.delivery.get(replacement)).bytes)],[9,8,7,6]);
  assert.equal(before.saved.downloaded.has(urls[0]),true,'an old saved file cannot satisfy the new URL');
  after.manager.dispose();
});

test('received bytes update live but downloaded is impossible until the atomic persistent write finishes',async()=>{
  const gate=deferred(),began=deferred(),streamReady=deferred();let stream;
  const {saved,manager}=setup({fetcher:async()=>new Response(new ReadableStream({start(controller){stream=controller;streamReady.resolve();}}))});
  saved.putHook=async()=>{began.resolve();await gate.promise;};
  manager.registerMap('one',[urls[0]]);const done=manager.enqueue('one');
  await when(manager,value=>row(value,'one').source==='Checking cache');
  await streamReady.promise;
  stream.enqueue(Uint8Array.from([1,2]));
  await when(manager,value=>row(value,'one').loaded===2);
  assert.equal(manager.mapStatus('one').filesDone,0);assert.equal(manager.mapStatus('one').total,4);
  stream.enqueue(Uint8Array.from([3,4]));stream.close();await began.promise;
  assert.equal(manager.mapStatus('one').loaded,4);assert.equal(manager.mapStatus('one').retained,false);assert.equal(manager.mapStatus('one').state,'downloading');
  gate.resolve();assert.equal((await done).state,'downloaded');manager.dispose();
});

test('canceling a background subscriber leaves the foreground shared fetch alive and retry reuses saved bytes',async()=>{
  const pending=deferred(),entered=deferred();let networkSignal,calls=0;
  const {manager,delivery}=setup({fetcher:(_url,{signal})=>{calls++;networkSignal=signal;entered.resolve();signal.addEventListener('abort',()=>pending.reject(abortError()));return pending.promise;}});
  manager.registerMap('one',[urls[0]]);const background=manager.enqueue('one');await entered.promise;
  const foreground=delivery.get(urls[0]);manager.cancel('one');
  assert.equal((await background).state,'canceled');assert.equal(networkSignal.aborted,false);
  pending.resolve(new Response(Uint8Array.from([4,3,2,1])));assert.equal((await foreground).bytes.byteLength,4);
  assert.equal((await manager.retry('one')).state,'downloaded');assert.equal(calls,1);manager.dispose();
});

test('a canceled foreground subscriber does not leave memory or optional-cache policy on a background transfer',async()=>{
  const pending=deferred(),entered=deferred(),memory=new AssetByteCache(100);let networkSignal;
  const {manager,delivery,saved}=setup({memory,fetcher:(_url,{signal})=>{networkSignal=signal;entered.resolve();return pending.promise;}});
  manager.registerMap('one',[urls[0]]);const background=manager.enqueue('one');await entered.promise;
  const controller=new AbortController(),foreground=delivery.get(urls[0],{signal:controller.signal});
  const rejected=assert.rejects(foreground,{name:'AbortError'});controller.abort();await rejected;
  assert.equal(networkSignal.aborted,false);
  pending.resolve(new Response(Uint8Array.from([1,2,3,4])));assert.equal((await background).state,'downloaded');await delivery.writes;
  assert.equal(memory.bytes,0);assert.equal(saved.optionalPuts,0);assert.equal(saved.optional.size,0);assert.equal(saved.downloaded.has(urls[0]),true);manager.dispose();
});

test('canceling the last transfer aborts it, queued cancellation never fetches, and an immediate retry completes',async()=>{
  const requests=[],entered=deferred(),retried=deferred();
  const {manager}=setup({fetcher:(url,{signal})=>{
    const request=deferred();requests.push({url,signal,...request});entered.resolve();if(requests.length===2)retried.resolve();signal.addEventListener('abort',()=>request.reject(abortError()));return request.promise;
  }});
  manager.registerMap('one',[urls[0]]);manager.registerMap('two',[urls[1]]);
  const first=manager.enqueue('one'),queued=manager.enqueue('two');await entered.promise;
  manager.cancel('two');assert.equal((await queued).state,'canceled');
  manager.cancel('one');assert.equal((await first).state,'canceled');assert.equal(requests[0].signal.aborted,true);
  const retry=manager.retry('one');await retried.promise;
  requests[1].resolve(new Response(Uint8Array.from([1,2,3,4])));
  assert.equal((await retry).state,'downloaded');assert.deepEqual(requests.map(item=>item.url),[urls[0],urls[0]]);manager.dispose();
});

test('network failures retain completed files and retry resumes only the missing files',async()=>{
  let failed=true;const calls=[];
  const {manager}=setup({fetcher:async url=>{calls.push(url);if(url===urls[1]&&failed)return new Response(null,{status:503});return new Response(new Uint8Array(assets.find(asset=>asset.url===url).bytes));}});
  manager.registerMap('one',[urls[0],urls[1]]);const broken=await manager.enqueue('one');
  assert.equal(broken.state,'error');assert.equal(broken.filesDone,1);assert.equal(broken.retainedBytes,4);assert.match(broken.error,/503/);
  failed=false;assert.equal((await manager.retry('one')).state,'downloaded');assert.deepEqual(calls,[urls[0],urls[1],urls[1],urls[1],urls[1]]);manager.dispose();
});

test('bounded explicit storage rejects a new map before fetching and never evicts a completed map',async()=>{
  const {manager,saved,requests}=setup({retainedLimit:6});manager.registerMap('one',[urls[0]]);manager.registerMap('two',[urls[1]]);
  await manager.enqueue('one');const rejected=await manager.enqueue('two');
  assert.equal(rejected.state,'error');assert.equal(rejected.errorCode,'STORAGE_FULL');assert.equal(manager.mapStatus('one').state,'downloaded');
  assert.deepEqual(requests,[urls[0]]);assert.equal(saved.downloaded.has(urls[0]),true);manager.dispose();
});

test('unavailable storage and browser quota failure cannot claim a download, and later retry recovers',async()=>{
  const {manager,saved,requests}=setup();manager.registerMap('one',[urls[0]]);saved.openError=new Error('Privacy');
  let result=await manager.enqueue('one');assert.equal(result.state,'error');assert.equal(result.unsupported,true);assert.equal(requests.length,0);
  saved.openError=null;saved.putHook=()=>{throw Object.assign(new Error('Quota'),{name:'QuotaExceededError'});};
  result=await manager.retry('one');assert.equal(result.state,'error');assert.equal(result.errorCode,'STORAGE_FULL');assert.equal(result.retained,false);assert.equal(result.filesDone,0);
  saved.putHook=null;result=await manager.retry('one');assert.equal(result.state,'downloaded');assert.equal(result.unsupported,false);manager.dispose();
});

test('refresh and a new page reconcile actual eviction instead of trusting previous completion state',async()=>{
  const {manager,saved,requests}=setup();manager.registerMap('one',[urls[0],urls[1]]);await manager.enqueue('one');
  saved.downloaded.delete(urls[0]);await manager.refresh();
  assert.equal(manager.mapStatus('one').state,'available');assert.equal(manager.mapStatus('one').retainedBytes,3);assert.equal(manager.mapStatus('one').filesDone,1);
  const next=setup({saved});next.manager.registerMap('one',[urls[0],urls[1]]);await next.manager.initialize();
  assert.equal(next.manager.mapStatus('one').state,'available');assert.equal(next.manager.mapStatus('one').filesDone,1);
  await manager.retry('one');assert.deepEqual(requests,[urls[0],urls[1],urls[0]]);manager.dispose();next.manager.dispose();
});

test('earlier-file eviction during the last save remains retryable without disabling working storage',async()=>{
  const {manager,saved,requests}=setup();let evict=true;
  manager.registerMap('one',[urls[0],urls[1]]);manager.registerMap('other',[urls[2]]);
  saved.putHook=url=>{if(evict&&url===urls[1]){evict=false;saved.downloaded.delete(urls[0]);}};
  const incomplete=await manager.enqueue('one');
  assert.equal(incomplete.state,'error');assert.equal(incomplete.errorCode,'STORAGE_INCOMPLETE');assert.equal(incomplete.filesDone,1);
  assert.equal(incomplete.retainedBytes,3);assert.equal(incomplete.retained,false);assert.equal(incomplete.unsupported,false);
  assert.equal(manager.snapshot().storage.available,true);assert.equal(manager.mapStatus('other').unsupported,false);
  assert.equal((await manager.retry('one')).state,'downloaded');assert.deepEqual(requests,[urls[0],urls[1],urls[0]]);manager.dispose();
});

test('quota/free-space preflight and exact catalog lengths prevent false completion',async()=>{
  const limited=setup({storageManager:{estimate:async()=>({quota:100,usage:98})}});limited.manager.registerMap('one',[urls[0]]);
  const full=await limited.manager.enqueue('one');assert.equal(full.errorCode,'STORAGE_FULL');assert.equal(limited.requests.length,0);limited.manager.dispose();
  const wrong=setup({fetcher:async()=>new Response(new Uint8Array(5))});wrong.manager.registerMap('one',[urls[0]]);
  const invalid=await wrong.manager.enqueue('one');assert.equal(invalid.errorCode,'SIZE_MISMATCH');assert.equal(invalid.retained,false);assert.equal(wrong.saved.downloaded.size,0);wrong.manager.dispose();
});

test('multi-file map downloads pipeline transfers concurrently, throttle chunk progress snapshots, and scale desktop byte cache',async()=>{
  assert.equal(defaultAssetByteCacheLimit({deviceMemory:2,cores:2}),64*1024*1024);
  assert.equal(defaultAssetByteCacheLimit({deviceMemory:8,cores:16}),320*1024*1024);
  let inFlight=0,peakInFlight=0,streamController;
  const allStarted=deferred(),bigUrl='/content/assets/download/big-5555555555555555.glb';
  const catalog=[...assets,{url:bigUrl,bytes:200}];
  const gates=new Map(urls.map(u=>[u,deferred()]));
  const {manager}=setup({retainedLimit:1000,assets:catalog,fetcher:async url=>{
    if(url===bigUrl)return new Response(new ReadableStream({start(c){streamController=c;}}));
    inFlight++;peakInFlight=Math.max(peakInFlight,inFlight);
    if(peakInFlight===3)allStarted.resolve();
    await gates.get(url).promise;
    inFlight--;
    return new Response(new Uint8Array(catalog.find(a=>a.url===url).bytes));
  }});
  manager.registerMap('parallel',urls);
  const parallelDone=manager.enqueue('parallel');
  await allStarted.promise;
  assert.equal(peakInFlight,3,'all 3 missing files start concurrently instead of sequentially');
  for(const g of gates.values())g.resolve();
  assert.equal((await parallelDone).state,'downloaded');

  manager.registerMap('stream',[bigUrl]);
  let emits=0;
  const off=manager.subscribe(()=>{emits++;});
  const streamDone=manager.enqueue('stream');
  await when(manager,v=>row(v,'stream').state==='downloading');
  while(!streamController)await new Promise(r=>setTimeout(r,1));
  const beforeChunks=emits;
  for(let i=0;i<100;i++)streamController.enqueue(new Uint8Array(2));
  streamController.close();
  assert.equal((await streamDone).state,'downloaded');
  off();
  assert.ok(emits-beforeChunks<15,`expected throttled emits (<15) across 100 chunks, got ${emits-beforeChunks}`);
  manager.dispose();
});

test('flight-downloaded core map assets persist as downloaded across reload, delta-update on map revision, and prune obsolete files',async()=>{
  const saved=disk(),kv=new Map();
  const indexStorage={getItem:k=>kv.get(k)||null,setItem:(k,v)=>kv.set(k,String(v))};
  const coreModel='/content/assets/maps/green/model-1111111111111111.glb';
  const coreCol='/content/assets/maps/green/collision-2222222222222222.pcol';
  const track1Props='/content/assets/races/green-01/props-3333333333333333.glb';
  const track2Props='/content/assets/races/green-02/props-4444444444444444.glb';
  const catalog=[
    {url:coreModel,bytes:10},{url:coreCol,bytes:6},
    {url:track1Props,bytes:4},{url:track2Props,bytes:5},
  ];
  const fetched=[];
  const makeSession=items=>{
    const delivery=new AssetDelivery({
      storage:saved.storage,indexStorage,memory:new AssetByteCache(0),
      fetcher:async url=>{
        fetched.push(url);
        const entry=items.find(a=>a.url===url);
        return new Response(new Uint8Array(entry?.bytes||1).fill(7));
      },
    });
    const manager=new MapDownloadManager({assets:items,delivery,manifestStorage:indexStorage});
    return {delivery,manager};
  };

  // 1. Player flies Track 1 via foreground FlightLoading (delivery.get -> optional cache).
  const s1=makeSession(catalog);
  s1.manager.registerMap('green',[coreModel,coreCol,track1Props,track2Props],{coreUrls:[coreModel,coreCol]});
  await s1.delivery.get(coreModel,{expectedBytes:10});
  await s1.delivery.get(coreCol,{expectedBytes:6});
  await s1.delivery.get(track1Props,{expectedBytes:4});
  await s1.delivery.writes;
  await s1.manager.refresh();
  assert.equal(s1.manager.mapStatus('green').state,'downloaded','flying a map marks it downloaded once core assets are persisted');
  assert.equal(s1.manager.mapStatus('green').retained,true);
  s1.manager.dispose();

  // 2. Player reloads the page: map stays downloaded without any network requests.
  fetched.length=0;
  const s2=makeSession(catalog);
  s2.manager.registerMap('green',[coreModel,coreCol,track1Props,track2Props],{coreUrls:[coreModel,coreCol]});
  await s2.manager.initialize();
  assert.equal(s2.manager.mapStatus('green').state,'downloaded','map remains downloaded after page reload');
  assert.equal(fetched.length,0);
  s2.manager.dispose();

  // 3. Developer updates Track 1 props (adds/removes objects -> new content hash).
  const updatedTrack1Props='/content/assets/races/green-01/props-9999999999999999.glb';
  const updatedCatalog=[
    {url:coreModel,bytes:10},{url:coreCol,bytes:6},
    {url:updatedTrack1Props,bytes:4},{url:track2Props,bytes:5},
  ];
  const s3=makeSession(updatedCatalog);
  s3.manager.registerMap('green',[coreModel,coreCol,updatedTrack1Props,track2Props],{coreUrls:[coreModel,coreCol]});
  await s3.manager.initialize();
  const statusAfterUpdate=s3.manager.mapStatus('green');
  assert.equal(statusAfterUpdate.state,'available','updated map requires delta sync');
  assert.equal(statusAfterUpdate.updateAvailable,true);
  assert.equal(statusAfterUpdate.retainedBytes,16,'unchanged coreModel (10B) + coreCol (6B) remain cached');

  // 4. Updating the map downloads ONLY the delta (updatedTrack1Props + track2Props) and reuses coreModel + coreCol.
  fetched.length=0;
  const completed=await s3.manager.enqueue('green');
  assert.equal(completed.state,'downloaded');
  assert.equal(completed.updateAvailable,false);
  assert.deepEqual(fetched.sort(),[track2Props,updatedTrack1Props].sort(),'unchanged 16B core assets are not re-downloaded');

  // 5. Obsolete old track1Props is pruned from CacheStorage.
  assert.equal(saved.optional.has(track1Props),true);
  const pruned=await s3.manager.pruneObsoleteAssets(updatedCatalog.map(a=>a.url));
  assert.equal(pruned.removed,1);
  assert.equal(pruned.freedBytes,4);
  assert.equal(saved.optional.has(track1Props),false,'obsolete asset is removed from disk cache');
  s3.manager.dispose();
});
