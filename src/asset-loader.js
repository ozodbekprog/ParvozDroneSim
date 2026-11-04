import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import {modelDecoder, modelWorkerLimits} from './model-decoder.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { TextureLoader } from 'three';
import { preparedBytes } from './flight-loading.js';
import { releaseResources } from './resource-cleanup.js';
import { assetDelivery } from './asset-delivery.js';
import { isImportedSceneryMarker, suppressImportedSceneryMarkers } from './imported-scenery.js';
import { materialTextures } from './material-resources.js';
import { modelMemoryBytes, idleModelBudget } from './model-memory.js';
import {indexModelNodes,namedModelNode} from './model-node-index.js';
import {normalizePackedVertexAttributesAsync} from './packed-vertex-attributes.js';
import {cooperativeImageViews} from './cooperative-image-views.js';
const draco=new DRACOLoader().setDecoderPath('/runtime/draco/');
const loader=new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(modelDecoder);
const cache=new Map(); export const sharedResources=new WeakSet();
const loadMetrics=new Map();
export const modelLoadMetrics=()=>[...loadMetrics.values()].map(row=>({...row}));
function metric(url){
  if(!loadMetrics.has(url)){if(loadMetrics.size>=128)loadMetrics.delete(loadMetrics.keys().next().value);loadMetrics.set(url,{url,parses:0,cacheHits:0,readMs:0,parseMs:0,lookupMs:0,cloneMs:0,clones:0});}
  return loadMetrics.get(url);
}
const idle=new Map();let idleBytes=0,maxIdleBytes=idleModelBudget(globalThis.navigator?.deviceMemory),maxIdleEntries=20;
export function setModelCacheBudget({bytes=maxIdleBytes,entries=maxIdleEntries}={}) {
  maxIdleBytes=Math.max(0,bytes);maxIdleEntries=Math.max(0,entries);trimIdleModels();
}
export const modelCacheStats=()=>({idleBytes,maxIdleBytes,idleEntries:idle.size,entries:cache.size});
function unparkModel(url,entry){if(idle.get(url)!==entry)return;idle.delete(url);idleBytes-=entry.bytes;}
function trimIdleModels(){while(idle.size&&(idleBytes>maxIdleBytes||idle.size>maxIdleEntries)){const[url,entry]=idle.entries().next().value;disposeEntry(url,entry);}}
function parkModel(url,entry){
  if(cache.get(url)!==entry||!entry.loaded)return disposeEntry(url,entry);
  unparkModel(url,entry);idle.set(url,entry);idleBytes+=entry.bytes;trimIdleModels();
}
export const hasLoadedModel = url => cache.get(url)?.loaded === true;
export function loadTexture(url) {
  const bytes = preparedBytes(url);
  const address = bytes ? URL.createObjectURL(new Blob([bytes])) : url;
  let resolve, reject;
  const ready = new Promise((yes, no) => { resolve = yes; reject = no; });
  const texture = new TextureLoader().load(address, () => { if(bytes)URL.revokeObjectURL(address); resolve(); }, undefined, error => { if(bytes)URL.revokeObjectURL(address); reject(new Error(`Could not load texture ${url}`)); });
  texture.assetsReady = ready; ready.catch(() => {});
  return texture;
}
export async function loadAssetJSON(url) {
  const bytes = preparedBytes(url);
  if(bytes) return JSON.parse(new TextDecoder().decode(bytes));
  const {bytes:downloaded}=await assetDelivery.get(url);return JSON.parse(new TextDecoder().decode(downloaded));
}
export function configureAssetRenderer(renderer) {
  if(!loader.ktx2Loader) loader.setKTX2Loader(new KTX2Loader().setTranscoderPath('/runtime/basis/').setWorkerLimit(modelWorkerLimits().textures).detectSupport(renderer));
}
export async function loadModel(url, nodeName, {signal}={}) {
  const aborted=()=>Object.assign(new Error('Asset request canceled'),{name:'AbortError'});
  if(signal?.aborted)throw aborted();
  let entry=cache.get(url);
  const timings=metric(url);
  if(!entry) {
    const bytes = preparedBytes(url);
    const controller=new AbortController(),base=new URL('.',new URL(url,location.href)).href;
    entry={references:0,controller,promise:(async()=>{
      const readStart=performance.now(),data=bytes||(await assetDelivery.get(url,{signal:controller.signal})).bytes;
      timings.readMs+=performance.now()-readStart;const parseStart=performance.now();timings.parses++;
      const parser=new GLTFLoader(loader.manager).setDRACOLoader(draco).setMeshoptDecoder(modelDecoder.withSignal(controller.signal));
      if(loader.ktx2Loader)parser.setKTX2Loader(loader.ktx2Loader);
      parser.register(gltfParser=>cooperativeImageViews(gltfParser));
      try{
        const gltf=await parser.parseAsync(data,base);
        await normalizePackedVertexAttributesAsync(gltf.scenes,{signal:controller.signal});
        const seenMaterials=new WeakSet();
        for(const scene of gltf.scenes||[]){
          suppressImportedSceneryMarkers(scene);
          scene.traverse(object=>{
            if(object.geometry){
              sharedResources.add(object.geometry);
              if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
            }
            for(const mat of Array.isArray(object.material)?object.material:[object.material]){
              if(!mat||seenMaterials.has(mat))continue;
              seenMaterials.add(mat);
              for(const tex of materialTextures(mat))sharedResources.add(tex);
            }
            if(/^COLLIDER[_-]/i.test(object.name)||object.userData.collider)object.visible=false;
          });
        }
        return gltf;
      }finally{timings.parseMs+=performance.now()-parseStart;}
    })()};
    entry.promise.then(gltf => { entry.loaded = true; entry.gltf = gltf;entry.bytes=modelMemoryBytes(gltf);if(entry.references===0)disposeEntry(url,entry); }, () => {});
    cache.set(url,entry);
    entry.promise.catch(()=>{if(cache.get(url)===entry)cache.delete(url);});
  }else timings.cacheHits++;
  unparkModel(url,entry);entry.references++;
  let released=false;
  const release=()=>{if(released)return;released=true;signal?.removeEventListener('abort',release);if(--entry.references===0){if(entry.loaded)parkModel(url,entry);else{entry.controller?.abort();disposeEntry(url,entry);}}};
  signal?.addEventListener('abort',release,{once:true});
  try {
    const gltf=entry.loaded?entry.gltf:await entry.promise;
    if(released||signal?.aborted)throw aborted();
    const lookupStart=performance.now();
    if(nodeName)entry.nodes ||= indexModelNodes(gltf.scenes);
    const source=nodeName?namedModelNode(entry.nodes,nodeName):gltf.scene;
    timings.lookupMs+=performance.now()-lookupStart;const cloneStart=performance.now();
    if(source.userData.hasSkinnedMesh===undefined){
      let skinned=false;source.traverse(object=>{if(object.isSkinnedMesh)skinned=true;});
      source.userData.hasSkinnedMesh=skinned;
    }
    const copiedMaterials=new Map();
    const copyMaterial=m=>{
      let copy=copiedMaterials.get(m);
      if(!copy){
        copy=m.clone();
        copy.userData.parvozSourceMaterial=m.userData.parvozSourceMaterial||m.uuid;
        copiedMaterials.set(m,copy);
      }
      return copy;
    };
    const model=source.userData.hasSkinnedMesh?clone(source):source.clone(true);
    model.userData.parvozSourceNode=source;
    model.traverse(object=>{
      if(object.geometry)sharedResources.add(object.geometry);
      if(object.material)object.material=Array.isArray(object.material)?object.material.map(copyMaterial):copyMaterial(object.material);
      if(/^COLLIDER[_-]/i.test(object.name)||object.userData.collider)object.visible=false;
      if(isImportedSceneryMarker(object.name)){object.visible=false;object.userData.excludedSceneryMarker=true;}
    });
    timings.cloneMs+=performance.now()-cloneStart;timings.clones++;
    model.releaseAsset=()=>{
      if(!model.releaseAsset)return;delete model.releaseAsset;
      release();
    };
    return model;
  } catch(error) {release();if(error.name==='AbortError')throw error;throw new Error(`Could not load ${url}: ${error.message}`);}
}
function disposeEntry(url,entry) {
  unparkModel(url,entry);
  if(cache.get(url)===entry)cache.delete(url);
  const resources=new Set();
  for(const scene of entry.gltf?.scenes || [])scene.traverse(object=>{
    if(object.isInstancedMesh)resources.add(object);
    if(object.geometry)resources.add(object.geometry);
    for(const mat of Array.isArray(object.material)?object.material:[object.material])if(mat){resources.add(mat);for(const value of Object.values(mat))if(value?.isTexture)resources.add(value);}
  });
  const errors=releaseResources(resources);if(errors.length)console.warn('Asset cleanup:',...errors.map(error=>error.message));
}
