import {Group,LoadingManager} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {modelDecoder} from './model-decoder.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {SharedStreamTextures} from './shared-stream-textures.js';
import {assetDelivery} from './asset-delivery.js';
import {normalizePackedVertexAttributes} from './packed-vertex-attributes.js';
import {suppressImportedSceneryMarkers} from './imported-scenery.js';
import {indexModelNodes,namedModelNode} from './model-node-index.js';
import {applyMaterials} from './model-materials.js';
import {releaseResources} from './resource-cleanup.js';

const aborted=()=>new DOMException('Chunk load canceled','AbortError');
function abortable(promise,signal){
 if(signal.aborted)return Promise.reject(aborted());
 return new Promise((yes,no)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);no(aborted());};signal.addEventListener('abort',abort,{once:true});
  promise.then(value=>{signal.removeEventListener('abort',abort);yes(value);},error=>{signal.removeEventListener('abort',abort);no(error);});
 });
}
function resourcesIn(roots,pooled=new Set()){
 const resources=new Set();for(const root of roots)root.traverse(object=>{
  if(object.geometry)resources.add(object.geometry);if(object.isInstancedMesh)resources.add(object);
  for(const material of Array.isArray(object.material)?object.material:[object.material])if(material){resources.add(material);for(const value of Object.values(material))if(value?.isTexture&&!pooled.has(value))resources.add(value);}
 });return resources;
}
function geometryBytes(roots){
 const buffers=new Set();let bytes=0;
 const count=attribute=>{const buffer=(attribute?.array||attribute?.data?.array)?.buffer;if(buffer&&!buffers.has(buffer)){buffers.add(buffer);bytes+=buffer.byteLength*2;}};
 for(const root of roots)root.traverse(object=>{for(const attribute of Object.values(object.geometry?.attributes||{}))count(attribute);count(object.geometry?.index);count(object.instanceMatrix);count(object.instanceColor);});
 return bytes;
}
function place(root,definition){root.position.fromArray(definition.position||[0,0,0]);root.rotation.set(...(definition.rotation||[0,0,0]));root.scale.setScalar(definition.scale||1);}

/** Experimental loader for verified external KTX2 + meshopt packages. It is
 * not imported by the shipped game. Shared textures have explicit leases;
 * chunk geometry/materials and all transient blob URLs have one owner. */
export class StreamChunkLoader{
 constructor(manifest,manifestURL,{ktxLoader,read=async(url,options)=>(await assetDelivery.get(url,{...options,cacheMemory:false,persist:false})).bytes,textureLimit}={}){
  if(manifest.version!==2||!manifest.experiment||!Array.isArray(manifest.placements)||!ktxLoader)throw Error('Expected a streaming experiment manifest');
  this.manifest=manifest;this.base=new URL('.',manifestURL).href;this.read=read;this.ktxLoader=ktxLoader;this.controllers=new Set();this.results=new Set();this.closed=false;
  this.resources=new Map();for(const entry of manifest.resources){if(!/^[a-zA-Z0-9_.-]+$/.test(entry.url)||entry.url.includes('..')||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Invalid experiment resource');this.resources.set(new URL(entry.url,this.base).href,entry);}
  this.textures=new SharedStreamTextures(async(url,signal)=>{
   const bytes=await this.readVerified(url,signal);signal.throwIfAborted();
   return new Promise((yes,no)=>this.ktxLoader.parse(bytes,yes,no));
  },{maxBytes:textureLimit});
 }
 async readVerified(url,signal){
  const expected=this.resources.get(url);if(!expected)throw Error('Resource is outside the verified manifest');
  return this.verifyBytes(url,await this.read(url,{signal,expectedBytes:expected.bytes}),signal);
 }
 async verifyBytes(url,bytes,signal){
  const expected=this.resources.get(url);if(!expected)throw Error('Resource is outside the verified manifest');signal.throwIfAborted();
  if(bytes.byteLength!==expected.bytes)throw Error('Experiment resource size mismatch');
  const digest=await crypto.subtle.digest('SHA-256',bytes),sha=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  signal.throwIfAborted();if(sha!==expected.sha256)throw Error('Experiment resource hash mismatch');return bytes;
 }
 async load(pkg,{signal,modelBytes}={}){
  if(this.closed||signal?.aborted)throw aborted();
  const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});this.controllers.add(controller);
  const taskSignal=controller.signal,leases=new Map(),blobURLs=[],rawTextures=new Set(),pooled=new Set();let parsed,group,pending,parseSettled=false,decodeError;
  const release=()=>{for(const lease of leases.values())lease.release();leases.clear();};
  const cleanup=roots=>releaseResources(resourcesIn(roots,pooled));
  try{
   const modelURL=new URL(pkg.model,this.base).href;
   const bytes=modelBytes===undefined?await this.readVerified(modelURL,taskSignal):await this.verifyBytes(modelURL,modelBytes,taskSignal),json=JSON.parse(new TextDecoder().decode(bytes));
   const allowed=new Set(pkg.resources.map(uri=>new URL(uri,this.base).href));
   for(const image of json.images||[])if(!image.uri||image.bufferView!==undefined||!image.uri.endsWith('.ktx2')||!allowed.has(new URL(image.uri,this.base).href))throw Error('Expected manifest-owned external KTX2 images');
   const binaries=new Map();
   await Promise.all((json.buffers||[]).filter(buffer=>buffer.uri).map(async buffer=>{
    const url=new URL(buffer.uri,this.base).href;if(!allowed.has(url))throw Error('Unknown geometry resource');
    const data=await this.readVerified(url,taskSignal),blob=URL.createObjectURL(new Blob([data]));blobURLs.push(blob);binaries.set(url,blob);
   }));taskSignal.throwIfAborted();
   const manager=new LoadingManager();manager.setURLModifier(url=>{const blob=binaries.get(url);if(!blob)throw Error('Unexpected package dependency: '+url);return blob;});
   const ktx={load:(url,yes,_progress,no)=>{
    try{
     if(!allowed.has(url))throw Error('Unknown texture resource');
     let lease=leases.get(url);if(!lease){lease=this.textures.acquire(url,{signal:taskSignal});leases.set(url,lease);}
     lease.ready.then(texture=>{if(taskSignal.aborted)throw aborted();const copy=texture.clone();copy.userData.parvozStreamURL=url;rawTextures.add(copy);yes(copy);}).catch(error=>{decodeError ||= error;no(error);});
    }catch(error){decodeError ||= error;no(error);}
   }};
   const loader=new GLTFLoader(manager).setMeshoptDecoder(modelDecoder.withSignal(taskSignal)).setKTX2Loader(ktx);
   pending=loader.parseAsync(json,this.base);pending.then(()=>{parseSettled=true;},()=>{parseSettled=true;});
   parsed=await abortable(pending,taskSignal);taskSignal.throwIfAborted();if(decodeError)throw decodeError;
   normalizePackedVertexAttributes(parsed.scenes);
   for(const scene of parsed.scenes)scene.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)for(const [key,texture]of Object.entries(material))if(texture?.isTexture){
    rawTextures.add(texture);const lease=leases.get(texture.userData.parvozStreamURL);if(!lease)throw Error('Unowned material texture');const shared=lease.intern(texture);pooled.add(shared);material[key]=shared;
   }});
   for(const texture of rawTextures)if(!pooled.has(texture))texture.dispose();rawTextures.clear();
   const index=indexModelNodes(parsed.scenes),objects=new Map();group=new Group();group.name='Stream '+pkg.cell;
   const add=async(name,definition,lod)=>{
    const source=namedModelNode(index,name),model=clone(source),root=lod?new Group():model;
    if(lod)root.add(model);place(root,definition);suppressImportedSceneryMarkers(root);
    if((definition.materials||[]).some(item=>Object.keys(item).some(key=>key.endsWith('Texture'))))throw Error('External material overrides need a streaming policy');
    group.add(root);await applyMaterials(root,definition.materials||[]);return root;
   };
   if(pkg.kind==='coarse')await add(this.manifest.environment.modelNode,{...this.manifest.environment.transform,materials:this.manifest.environment.materials},false);
   for(const i of pkg.objectIndices){const definition=this.manifest.placements[i];if(!definition)throw Error('Unknown map placement');
    const level=definition.lods?.find(lod=>pkg.selectors.includes(lod.modelNode)),name=level?.modelNode||definition.modelNode;
    if(!pkg.selectors.includes(name))throw Error('Package misses its placement selector');objects.set(i,await add(name,definition,!!level));
   }
   taskSignal.throwIfAborted();group.updateMatrixWorld(true);
   let disposed=false;const result={group,objects,bytes:geometryBytes([...parsed.scenes,group]),dispose:()=>{
    if(disposed)return;disposed=true;group.removeFromParent();cleanup([...parsed.scenes,group]);group.clear();release();this.results.delete(result);
   }};
   this.results.add(result);return result;
  }catch(error){
   controller.abort();
   if(parsed)cleanup([...parsed.scenes,...(group?[group]:[])]);
   else if(pending)pending.then(late=>cleanup(late.scenes),()=>{});
   for(const texture of rawTextures)if(!pooled.has(texture))texture.dispose();release();throw error;
  }finally{
   const revoke=()=>{for(const url of blobURLs)URL.revokeObjectURL(url);};
   if(pending&&!parseSettled)pending.then(revoke,revoke);else revoke();
   signal?.removeEventListener('abort',cancel);this.controllers.delete(controller);
  }
 }
 stats(){return {...this.textures.stats(),chunks:this.results.size,preparing:this.controllers.size};}
 dispose(){if(this.closed)return;this.closed=true;for(const controller of this.controllers)controller.abort();for(const result of this.results)result.dispose();this.textures.dispose();this.ktxLoader.dispose?.();}
}
