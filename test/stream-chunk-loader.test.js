import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Texture} from 'three';
import {StreamChunkLoader} from '../src/stream-chunk-loader.js';

function fixture(){
 const geometry=new Float32Array([0,0,0,1,0,0,0,1,0]).buffer;
 const json={asset:{version:'2.0'},extensionsUsed:['KHR_texture_basisu'],extensionsRequired:['KHR_texture_basisu'],scene:0,scenes:[{nodes:[0]}],nodes:[{name:'root',mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}],textures:[{extensions:{KHR_texture_basisu:{source:0}}}],images:[{uri:'image.ktx2',mimeType:'image/ktx2'}],buffers:[{uri:'geometry.bin',byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]};
 const files=new Map([['cell.gltf',new TextEncoder().encode(JSON.stringify(json)).buffer],['geometry.bin',geometry],['image.ktx2',new Uint8Array([1,2,3,4]).buffer]]);
 const resources=[...files].map(([url,bytes])=>({url,bytes:bytes.byteLength,sha256:createHash('sha256').update(new Uint8Array(bytes)).digest('hex')}));
 const manifest={version:2,experiment:true,placements:[{modelNode:'root',position:[1,0,0]},{modelNode:'root',position:[10,0,0]}],resources};
 const pkg=i=>({cell:'cell'+i,kind:'near',model:'cell.gltf',selectors:['root'],resources:['geometry.bin','image.ktx2'],objectIndices:[i]});
 return {manifest,files,pkg};
}
const texture=()=>new Texture({width:4,height:4,data:new Uint8Array(64)});
function browserGlobals(){const oldSelf=globalThis.self,oldProgress=globalThis.ProgressEvent;globalThis.self={URL};globalThis.ProgressEvent=class{constructor(type,options){this.type=type;Object.assign(this,options);}};return()=>{if(oldSelf===undefined)delete globalThis.self;else globalThis.self=oldSelf;if(oldProgress===undefined)delete globalThis.ProgressEvent;else globalThis.ProgressEvent=oldProgress;};}

test('real GLTF packages share one decoded GPU texture and retire independent geometry safely',async()=>{
 const {manifest,files,pkg}=fixture(),restore=browserGlobals();let decodes=0,reads=0;
 const loader=new StreamChunkLoader(manifest,'http://localhost/qa/manifest.json',{read:async url=>{if(url.endsWith('.ktx2'))reads++;return files.get(new URL(url).pathname.split('/').at(-1)).slice(0);},ktxLoader:{parse:(_bytes,yes)=>{decodes++;queueMicrotask(()=>yes(texture()));}}});
 try{
  const [a,b]=await Promise.all([loader.load(pkg(0)),loader.load(pkg(1))]);
  const meshA=a.objects.get(0),meshB=b.objects.get(1);assert.equal(meshA.position.x,1);assert.equal(meshB.position.x,10);
  assert.equal(meshA.material.map,meshB.material.map);assert.equal(decodes,1);assert.equal(reads,1);
  let disposed=0;meshA.material.map.addEventListener('dispose',()=>disposed++);
  a.dispose();assert.equal(disposed,0);assert.equal(loader.stats().chunks,1);
  b.dispose();assert.equal(disposed,1);assert.equal(loader.stats().estimatedBytes,0);assert.equal(loader.stats().images,0);
 }finally{loader.dispose();restore();}
});

test('bad hashes cannot become visible and the same loader can retry verified data',async()=>{
 const {manifest,files,pkg}=fixture(),restore=browserGlobals();let corrupt=true;
 const loader=new StreamChunkLoader(manifest,'http://localhost/qa/manifest.json',{read:async url=>{const bytes=files.get(new URL(url).pathname.split('/').at(-1)).slice(0);if(corrupt)new Uint8Array(bytes)[0]^=1;return bytes;},ktxLoader:{parse:(_b,yes)=>yes(texture())}});
 try{
  await assert.rejects(loader.load(pkg(0)),/hash mismatch/);assert.equal(loader.stats().chunks,0);
  corrupt=false;const result=await loader.load(pkg(0));result.dispose();assert.equal(loader.stats().estimatedBytes,0);
 }finally{loader.dispose();restore();}
});

test('library-prefetched model bytes are verified and avoid a duplicate model fetch',async()=>{
 const {manifest,files,pkg}=fixture(),restore=browserGlobals();let modelReads=0;
 const loader=new StreamChunkLoader(manifest,'http://localhost/qa/manifest.json',{read:async url=>{if(url.endsWith('cell.gltf'))modelReads++;return files.get(new URL(url).pathname.split('/').at(-1)).slice(0);},ktxLoader:{parse:(_b,yes)=>yes(texture())}});
 try{
  const bytes=files.get('cell.gltf').slice(0),bad=bytes.slice(0);new Uint8Array(bad)[0]^=1;
  await assert.rejects(loader.load(pkg(0),{modelBytes:bad}),/hash mismatch/);
  const result=await loader.load(pkg(0),{modelBytes:bytes});assert.equal(modelReads,0);result.dispose();
 }finally{loader.dispose();restore();}
});

test('canceling a real package during decode cannot attach or retain its late texture',async()=>{
 const {manifest,files,pkg}=fixture(),restore=browserGlobals(),abort=new AbortController(),originalError=console.error;let finish,started,disposed=0;
 const decoding=new Promise(resolve=>{started=resolve;});
 const loader=new StreamChunkLoader(manifest,'http://localhost/qa/manifest.json',{read:async url=>files.get(new URL(url).pathname.split('/').at(-1)).slice(0),ktxLoader:{parse:(_b,yes)=>{finish=yes;started();}}});
 console.error=(...args)=>{if(!String(args[0]).startsWith('THREE.GLTFLoader: Couldn\'t load texture'))originalError(...args);};
 try{
  const pending=loader.load(pkg(0),{signal:abort.signal});await decoding;abort.abort();
  await assert.rejects(pending,{name:'AbortError'});assert.equal(loader.stats().chunks,0);
  const late=texture();late.addEventListener('dispose',()=>disposed++);finish(late);
  await new Promise(setImmediate);await new Promise(setImmediate);
  assert.equal(disposed,1);assert.equal(loader.stats().estimatedBytes,0);assert.equal(loader.stats().preparing,0);
 }finally{loader.dispose();console.error=originalError;restore();}
});
