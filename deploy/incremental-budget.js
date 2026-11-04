import assert from 'node:assert/strict';
import {resolve,isAbsolute} from 'node:path';

/** By default reuse requires every resolved package to stay identical.
 * A root dev declaration may promote an already locked transitive tool without
 * changing the image's installed production dependencies. Explicit production
 * mode excludes only dev:true records; runtime packages remain exact. The new
 * release must still run a fresh npm ci and build before image reuse. */
export function validateIncrementalLock(previous,current,{productionOnly=false}={}){
 assert.equal(typeof productionOnly,'boolean','Production-only validation must be explicit.');
 const normalized=lock=>{
  assert.equal(lock?.lockfileVersion,3,'Incremental reuse requires lockfile version 3.');
  assert.ok(lock.packages?.['']&&typeof lock.packages['']==='object','Missing root lockfile package.');
  const copy=structuredClone(lock);delete copy.packages[''].devDependencies;
  if(productionOnly)for(const [path,item] of Object.entries(copy.packages))if(path&&item.dev===true)delete copy.packages[path];
  return copy;
 };
 assert.deepEqual(normalized(current),normalized(previous),'Resolved packages changed; use a full build.');
}

export function validateIncrementalAssetBudget({bytes,available,maximumMiB=128,sharedAssets=false}){
  assert.ok(Number.isSafeInteger(bytes)&&bytes>=0,'Invalid new asset size.');
  assert.ok(Number.isSafeInteger(available)&&available>=0,'Invalid available disk size.');
  const maximum=Number(maximumMiB);
  assert.ok(Number.isInteger(maximum)&&maximum>=128&&maximum<=1024,'Incremental asset budget must be 128 to 1024 MiB.');
  assert.ok(bytes<=maximum*1024*1024,'New assets exceed the selected incremental build budget.');
  assert.equal(typeof sharedAssets,'boolean','Shared asset mode must be explicit.');
  const copiedBytes=sharedAssets?0:bytes;
  assert.ok(available>=copiedBytes*5+512*1024*1024,'Insufficient disk for incremental context, BuildKit cache, packed/unpacked image layers and a 512 MiB reserve.');
  return {maximumMiB:maximum};
}

export function validateSharedAssetMount(config,root){
  const matches=config?.services?.game?.volumes?.filter(volume=>volume.target==='/app/public/content/assets')||[];
  assert.equal(matches.length,1,'Shared asset mode requires one exact release asset directory mount.');
  const mount=matches[0];
  assert.ok(mount?.type==='bind'&&mount.read_only===true&&typeof mount.source==='string'&&isAbsolute(mount.source)&&resolve(mount.source)===resolve(root,'public/content/assets'),'Shared asset mode requires the exact release asset directory mounted read-only.');
  return mount.source;
}

export function validateReleaseAssetHash({url,bytes,sha256,inventory}){
  const suffix=url.match(/-([a-f0-9]{16})\.(glb|png|jpe?g|json|pcol)$/);
  assert.ok(suffix,'New asset must be content-addressed.');
  const item=inventory?.find(entry=>entry.file==='public'+url);
  assert.ok(item&&item.bytes===bytes&&item.sha256===sha256,'New asset bytes differ from the verified release inventory.');
  // Collision URLs hash compact JSON; delivery files retain readable formatting.
  // The release inventory records the complete SHA-256 of the actual delivery.
  if(suffix[2]!=='json')assert.ok(sha256.startsWith(suffix[1]),'New binary asset hash differs from its URL.');
}

/** Old clients and rollback still need immutable URLs after a map chooses a
 * new delivery. An unused URL may leave the catalog only when its exact file
 * remains in the candidate inventory and is subsequently hashed on disk. */
export function validateRetainedAsset({asset,currentAssets,inventory,sha256}){
 if(currentAssets.some(item=>item.url===asset.url&&item.bytes===asset.bytes))return;
 assert.match(asset.url,/^\/content\/assets\/[a-zA-Z0-9_./-]+-[a-f0-9]{16}\.(glb|png|jpe?g|json|pcol)$/);
 assert.ok(!asset.url.includes('..'),'Invalid retained asset path');
 const row=inventory.find(item=>item.file==='public'+asset.url);
 assert.ok(row&&row.bytes===asset.bytes&&row.sha256===sha256,'An unused immutable asset must remain byte-identical in the candidate inventory');
}
