// Public-source research only: resolve refs and hash source without executing it.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const run=promisify(execFile),old=JSON.parse(await readFile(new URL('./upstream-metadata.json',import.meta.url),'utf8'));
async function bounded(items,fn){let at=0;const out=[];await Promise.all(Array.from({length:3},async()=>{while(at<items.length){const i=at++;out[i]=await fn(items[i]);}}));return out;}
const packages=await bounded(['@anentrypoint/stream-glb','@hello-terrain/three','@loaders.gl/tiles','@loaders.gl/tiles-3d','@loaders.gl/gltf','@sparkjsdev/spark','@galacean/engine','phy-engine','comlink'],async name=>{
 const url=`https://registry.npmjs.org/${encodeURIComponent(name)}`;
 try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)return{name,url,error:`HTTP ${r.status}`};const d=await r.json(),v=d['dist-tags']?.latest,p=d.versions?.[v];return{name,url,version:v,publishedAt:d.time?.[v],distTags:d['dist-tags'],gitHead:p?.gitHead,license:p?.license,peerDependencies:p?.peerDependencies};}catch(e){return{name,url,error:e.message};}
});
const repos=await bounded(['AnEntrypoint/stream-glb','kenjinp/hello-terrain','visgl/loaders.gl','sparkjsdev/spark','cnr-isti-vclab/nexus'],async repo=>{
 try{const {stdout}=await run('git',['ls-remote',`https://github.com/${repo}.git`,'HEAD'],{timeout:25000,maxBuffer:100000,windowsHide:true});const sha=stdout.trim().split(/\s+/)[0];if(!/^[0-9a-f]{40}$/.test(sha))throw Error('No HEAD SHA');return{repo,sha,ref:'HEAD'};}catch(e){return{repo,error:e.message.split('\n')[0]};}
});
const stable=old.registry.find(p=>p.name==='@needle-tools/gltf-progressive').stableAlternative;
const three=old.registry.find(p=>p.name==='three');
const files=[
 ['AnEntrypoint/stream-glb','runtime/model-pool.js'],['AnEntrypoint/stream-glb','runtime/lod-worker.js'],['AnEntrypoint/stream-glb','tools/bake-progressive.mjs'],['AnEntrypoint/stream-glb','package.json'],
 ['kenjinp/hello-terrain','README.md'],['kenjinp/hello-terrain','packages/three/package.json'],
 ['visgl/loaders.gl','modules/tiles/src/index.ts'],
 ['visgl/loaders.gl','modules/tiles-3d/src/tileset-3d/common/tileset-3d.ts'],
 ['visgl/loaders.gl','modules/tiles-3d/src/tileset-3d/common/indexed-archive-tileset-source.ts'],
 ['visgl/loaders.gl','modules/gltf/src/gltf-loader.ts'],
 ['sparkjsdev/spark','README.md'],['cnr-isti-vclab/nexus','README.md'],
 ['needle-tools/gltf-progressive','src/lods.manager.ts',stable.gitHead],
 ['mrdoob/three.js','examples/jsm/libs/meshopt_decoder.module.js','r180'],
 ['mrdoob/three.js','examples/jsm/loaders/GLTFLoader.js','r180'],
 ['mrdoob/three.js','examples/webgpu_struct_drawindirect.html',three.gitHead||'r186'],
 ['mrdoob/three.js','examples/webgpu_occlusion.html',three.gitHead||'r186'],
];
const patterns=['useWorkers','decodeGltfBufferAsync','onBeforeCompile','_fetchRange','Content-Range','AbortController','terminate(','byteBudget','_trackBytes','memoryAdjustedScreenSpaceError','maximumMemoryUsage','WebGPURenderer','disposeLoaders','_renderLists','indirect','occlusionTest'];
const sources=await bounded(files,async([repo,path,ref])=>{
 ref ||= repos.find(r=>r.repo===repo)?.sha;
 if(!ref)return{repo,path,error:'No resolved ref'};
 const url=`https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
 try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)return{repo,path,url,ref,error:`HTTP ${r.status}`};const body=await r.text(),lines=body.split('\n');return{repo,path,url,ref,sha256:createHash('sha256').update(body).digest('hex'),lines:lines.length,anchors:Object.fromEntries(patterns.map(p=>[p,lines.flatMap((x,i)=>x.includes(p)?[i+1]:[])]))};}catch(e){return{repo,path,url,ref,error:e.message};}
});
const locals=await bounded(['src/asset-loader.js','src/asset-transfer.js','src/compile-scene-programs.js','node_modules/three/examples/jsm/libs/meshopt_decoder.module.js','node_modules/three/examples/jsm/loaders/GLTFLoader.js'],async path=>{
 const body=await readFile(new URL('../../../'+path,import.meta.url),'utf8'),lines=body.split('\n');return{path,sha256:createHash('sha256').update(body).digest('hex'),anchors:Object.fromEntries(patterns.map(p=>[p,lines.flatMap((x,i)=>x.includes(p)?[i+1]:[])]))};
});
const report={retrievedAt:new Date().toISOString(),scope:'Documentation/source inspection, not package execution or compatibility/performance testing. Literal anchors do not establish absence of a feature. Git HEAD references are snapshots; npm versions and repository HEAD may differ.',packages,repositories:repos,sources,localSourceChecks:locals};
await writeFile(new URL('./deep-source-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({packages:packages.map(({name,version,error})=>({name,version,error})),sourceCount:sources.length,errors:[...packages,...repos,...sources].filter(x=>x.error)},null,2));
