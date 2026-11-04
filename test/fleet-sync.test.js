import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeLegacyFleet,FleetSync} from '../src/fleet-sync.js';
import {cleanFleet,createDroneCopy,updateDroneCopy,deleteDroneCopy} from '../shared/drone-fleet.js';

function cloudAPI(initial){
  let cloud={fleet:initial,revision:initial?1:0,updatedAt:100};
  return async(path,method,body)=>{
    if(method){if(body.revision!==cloud.revision)throw Object.assign(new Error('stale'),{status:409});cloud={fleet:body.fleet,revision:cloud.revision+1,updatedAt:200};}
    return structuredClone(cloud);
  };
}

test('retry after first cloud read fails still treats the second device as fresh',async()=>{
  const copy=createDroneCopy(cleanFleet({}),'original:kestrel');
  const remote=updateDroneCopy(copy.fleet,copy.entry.id,{controller:{rates:{roll:{rcRate:1.4}}}});
  const api=cloudAPI(remote);let fail=true;
  const sync=new FleetSync((...args)=>{if(fail){fail=false;throw new Error('offline');}return api(...args);},'fresh-retry');
  await assert.rejects(sync.load(copy.fleet,{hasLocalFleet:false}),/offline/);
  assert.deepEqual(await sync.load(copy.fleet),remote);
});

test('a failed legacy merge cannot grant local fallback permission to overwrite the cloud fleet',async()=>{
  const remote=createDroneCopy(cleanFleet({}),'original:kestrel').fleet;
  const local=updateDroneCopy(remote,remote.selectedId,{build:{color:'#123456'}});
  const sync=new FleetSync(async(path,method)=>{
    if(method)throw Object.assign(new Error('fleet full'),{status:400});
    return {fleet:remote,revision:4,updatedAt:100};
  },'merge-failed');
  await assert.rejects(sync.load(local),/fleet full/);
  assert.equal(sync.revision,0);
  await assert.rejects(sync.save(cleanFleet({})),/has not synced/);
});

test('fresh second device trusts cloud tuning instead of creating a synthetic duplicate',async()=>{
  const copy=createDroneCopy(cleanFleet({}),'original:kestrel');
  const remote=updateDroneCopy(copy.fleet,copy.entry.id,{controller:{rates:{roll:{rcRate:1.4}}}});
  const sync=new FleetSync(cloudAPI(remote),'fresh-device');
  const result=await sync.load(copy.fleet,{hasLocalFleet:false});
  assert.deepEqual(result,remote);assert.equal(sync.revision,1);
});

test('explicit backup import merges after migration without resurrecting copies on ordinary load',async()=>{
  const copy=createDroneCopy(cleanFleet({}),'original:kestrel');
  const sync=new FleetSync(cloudAPI(cleanFleet({})),'backup-device');
  await sync.load(cleanFleet({}),{hasLocalFleet:false});
  const imported=await sync.importLocal(copy.fleet);
  assert.equal(imported.modified.length,1);
  await sync.save(deleteDroneCopy(imported,copy.entry.id));
  assert.equal((await sync.load(copy.fleet)).modified.length,0);
});

test('simultaneous stale editor saves cannot silently replace the first saved copy',async()=>{
  const copy=createDroneCopy(cleanFleet({}),'original:kestrel');
  const sync=new FleetSync(cloudAPI(copy.fleet),'concurrent-device');
  await sync.load(copy.fleet);
  const first=updateDroneCopy(copy.fleet,copy.entry.id,{build:{color:'#112233'}});
  const second=updateDroneCopy(copy.fleet,copy.entry.id,{build:{color:'#445566'}});
  const results=await Promise.allSettled([sync.save(first),sync.save(second)]);
  assert.equal(results[0].status,'fulfilled');assert.equal(results[1].reason.status,409);
  assert.equal((await sync.load(copy.fleet)).modified[0].build.color,'#112233');
});

test('old copies from a second PC merge without replacing a different same-number cloud copy',()=>{
  const first=createDroneCopy(cleanFleet({}),'original:kestrel');
  const local=updateDroneCopy(first.fleet,first.entry.id,{build:{color:'#123456'}});
  const merged=mergeLegacyFleet(first.fleet,local);
  assert.equal(merged.modified.length,2);
  assert.equal(merged.selectedId,first.entry.id);
  assert.equal(merged.modified[1].build.color,'#123456');
  assert.deepEqual(mergeLegacyFleet(merged,local),merged);
});

test('a previously migrated device does not resurrect a copy deleted on another device',async()=>{
  const storage=new Map(),prior=globalThis.localStorage;
  globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  try{
    const local=createDroneCopy(cleanFleet({}),'original:kestrel');
    let cloud={fleet:null,revision:0,updatedAt:null};
    const api=async(path,method,body)=>{
      if(method){assert.equal(body.revision,cloud.revision);cloud={fleet:body.fleet,revision:cloud.revision+1,updatedAt:100};}
      return structuredClone(cloud);
    };
    const sync=new FleetSync(api,'pilot');await sync.load(local.fleet);
    cloud.fleet=deleteDroneCopy(cloud.fleet,local.entry.id);cloud.revision++;
    assert.equal((await new FleetSync(api,'pilot').load(local.fleet)).modified.length,0);
    assert.equal(cloud.revision,2);
  }finally{globalThis.localStorage=prior;}
});
