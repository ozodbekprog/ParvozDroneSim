#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
previous_image="${1:-}"
shared_assets="${DEPLOY_SHARED_ASSETS:-0}"
builder="${DEPLOY_INCREMENTAL_BUILDER:-buildkit}"
production_lock="${DEPLOY_INCREMENTAL_PRODUCTION_LOCK:-0}"
[[ "$production_lock" == 0 || "$production_lock" == 1 ]] || { echo 'DEPLOY_INCREMENTAL_PRODUCTION_LOCK must be 0 or 1.' >&2; exit 1; }
export DEPLOY_INCREMENTAL_PRODUCTION_LOCK="$production_lock"
[[ "$builder" == buildkit || "$builder" == commit ]] || { echo 'DEPLOY_INCREMENTAL_BUILDER must be buildkit or commit.' >&2; exit 1; }
[[ "$shared_assets" == 0 || "$shared_assets" == 1 ]] || { echo 'DEPLOY_SHARED_ASSETS must be 0 or 1.' >&2; exit 1; }
export DEPLOY_SHARED_ASSETS="$shared_assets"
[[ "$previous_image" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'A verified previous image ID is required.' >&2; exit 1; }
[[ -f dist/index.html && -f RELEASE.json ]] || { echo 'Prepare and build an isolated release first.' >&2; exit 1; }
context="$(mktemp -d "$project_dir/.image-patch.XXXXXX")"
cleanup() { [[ "$context" == "$project_dir/.image-patch."* ]] && rm -rf -- "$context"; }
trap cleanup EXIT
docker run --rm --network none --entrypoint cat "$previous_image" /app/package-lock.json > "$context/previous-package-lock.json"
node --input-type=module - "$context/previous-package-lock.json" <<'JS'
import {readFileSync} from 'node:fs';
import {validateIncrementalLock} from './deploy/incremental-budget.js';
validateIncrementalLock(JSON.parse(readFileSync(process.argv[2])),JSON.parse(readFileSync('package-lock.json')),{productionOnly:process.env.DEPLOY_INCREMENTAL_PRODUCTION_LOCK==='1'});
JS
docker run --rm --network none --entrypoint cat "$previous_image" /app/public/content/catalog.json > "$context/previous-catalog.json"
docker run --rm --network none --entrypoint cat "$previous_image" /app/package.json > "$context/previous-package.json"
previous_asset_args=()
if [[ $(docker image inspect --format '{{index .Config.Labels "org.parvoz.shared-assets"}}' "$previous_image") == 1 ]]; then
  mapfile -t retained < deploy/previous-release.txt
  [[ "${retained[1]:-}" == "$previous_image" ]] || { echo 'Shared previous image requires its retained release record.' >&2; exit 1; }
  previous_assets="$(node --input-type=module - "${retained[0]}" "$project_dir" "$previous_image" <<'JS'
import assert from 'node:assert/strict';import {readFileSync,lstatSync,realpathSync} from 'node:fs';import {resolve,dirname,basename,join} from 'node:path';
const [directory,root,image]=process.argv.slice(2),previous=realpathSync(directory);
assert.equal(previous,resolve(directory));assert.notEqual(previous,realpathSync(root));assert.equal(dirname(previous),dirname(realpathSync(root)));
const record=JSON.parse(readFileSync(join(previous,'RELEASE.json')));assert.equal(record.release,basename(previous));assert.ok(record.runningImage===image||record.candidateImage===image);
const assets=join(previous,'public/content/assets'),stat=lstatSync(assets);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());assert.equal(realpathSync(assets),assets);console.log(assets);
JS
)"
  previous_asset_args=(--mount "type=bind,source=$previous_assets,target=/app/public/content/assets,readonly")
fi
docker run --rm -i --network none "${previous_asset_args[@]}" --entrypoint node "$previous_image" --input-type=module - > "$context/previous-asset-hashes.json" <<'JS'
import {readFileSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
const catalog=JSON.parse(readFileSync('/app/public/content/catalog.json')),hashes={};
for(const asset of catalog.assets){
  if(!/^\/content\/assets\/[a-zA-Z0-9_./-]+$/.test(asset.url)||asset.url.includes('..'))throw Error('Invalid retained asset path');
  const hash=createHash('sha256');
  for await(const chunk of createReadStream('/app/public'+asset.url))hash.update(chunk);
  hashes[asset.url]=hash.digest('hex');
}
console.log(JSON.stringify(hashes));
JS
node --input-type=module - "$project_dir" "$context" <<'JS'
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,cpSync,createReadStream,statfsSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {validateIncrementalAssetBudget,validateSharedAssetMount,validateReleaseAssetHash,validateRetainedAsset} from './deploy/incremental-budget.js';
const [root,context]=process.argv.slice(2),read=path=>JSON.parse(readFileSync(path));
const current=read(join(root,'public/content/catalog.json')),previous=read(join(context,'previous-catalog.json'));
const manifest=read(join(root,'RELEASE.json'));
assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);
assert.equal(manifest.revision,current.revision);
const runtime=object=>Object.fromEntries(['dependencies','optionalDependencies','peerDependencies','type','engines'].map(key=>[key,object[key]||null]));
assert.deepEqual(runtime(read(join(root,'package.json'))),runtime(read(join(context,'previous-package.json'))),'Runtime dependencies changed; use a full build.');
const old=new Map(previous.assets.map(asset=>[asset.url,asset.bytes]));
const previousHashes=read(join(context,'previous-asset-hashes.json'));
for(const asset of previous.assets){
  validateRetainedAsset({asset,currentAssets:current.assets,inventory:manifest.inventory,sha256:previousHashes[asset.url]});
  assert.match(asset.url,/^\/content\/assets\/[a-zA-Z0-9_./-]+$/);assert.ok(!asset.url.includes('..'));
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(join(root,'public'+asset.url)))hash.update(chunk);
  assert.equal(hash.digest('hex'),previousHashes[asset.url],'Retained asset bytes changed; use a full build: '+asset.url);
}
const added=current.assets.filter(asset=>!old.has(asset.url));
const bytes=added.reduce((sum,asset)=>sum+asset.bytes,0);
const sharedAssets=process.env.DEPLOY_SHARED_ASSETS==='1';
if(sharedAssets){
  let config;
  try{config=JSON.parse(execFileSync('docker',['compose','--env-file','deploy/production.env','-f','compose.production.yaml','config','--format','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}catch{throw Error('Cannot verify the shared asset mount in Compose.');}
  const source=validateSharedAssetMount(config,root),stat=lstatSync(source);
  assert.ok(stat.isDirectory()&&!stat.isSymbolicLink()&&realpathSync(source)===resolve(root,'public/content/assets'),'Shared asset directory must be a real release directory.');
}
for(const asset of added){
  assert.match(asset.url,/^\/content\/assets\/[a-zA-Z0-9_./-]+$/);assert.ok(!asset.url.includes('..'));
  const file=resolve(root,'public'+asset.url),stat=lstatSync(file),suffix=asset.url.match(/-([a-f0-9]{16})\.(glb|png|jpe?g|json|pcol)$/);
  assert.ok(file.startsWith(resolve(root,'public/content/assets')+sep)&&realpathSync(file)===file&&stat.isFile()&&!stat.isSymbolicLink(),'Invalid new asset file');assert.equal(stat.size,asset.bytes);assert.ok(suffix,'New asset must be content-addressed');
  const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);validateReleaseAssetHash({url:asset.url,bytes:stat.size,sha256:hash.digest('hex'),inventory:manifest.inventory});
}
const disk=statfsSync(root),available=disk.bavail*disk.bsize;
const {maximumMiB}=validateIncrementalAssetBudget({bytes,available,maximumMiB:process.env.DEPLOY_INCREMENTAL_ASSET_MIB||128,sharedAssets});
const copy=file=>{const source=resolve(root,file),target=resolve(context,file);assert.ok(source.startsWith(root+sep)&&target.startsWith(context+sep));mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);};
for(const folder of ['server','shared','dist'])cpSync(join(root,folder),join(context,folder),{recursive:true});
for(const file of ['package.json','package-lock.json','public/content/catalog.json','public/content/recipes.js','tools/backup-db.js','tools/import-db.js'])copy(file);
if(!sharedAssets)for(const asset of added)copy('public'+asset.url);
writeFileSync(join(context,'source-commit'),manifest.sourceCommit);
console.log(JSON.stringify({incrementalImage:true,unchangedAssets:old.size,newAssets:added.length,newAssetBytes:bytes,copiedAssetBytes:sharedAssets?0:bytes,sharedAssets,maximumMiB,availableDiskBytes:available,sourceCommit:manifest.sourceCommit}));
JS
base_tag="liftoff-game:rollback-${previous_image#sha256:}"
docker image tag "$previous_image" "$base_tag"
if [[ "$builder" == commit ]]; then
  node deploy/commit-incremental.js "$context" "$previous_image" "$shared_assets"
else
  docker build --network none --build-arg "BASE_IMAGE=$base_tag" --build-arg "SOURCE_COMMIT=$(cat "$context/source-commit")" --build-arg "SHARED_ASSETS=$shared_assets" -f deploy/Dockerfile.incremental -t liftoff-game "$context"
fi
docker image inspect "$previous_image" >/dev/null
