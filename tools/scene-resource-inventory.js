import * as THREE from 'three';
import {materialTextures} from '../src/material-resources.js';
import {estimateTextureMemory} from '../src/performance-report.js';

const formats=new Map(Object.entries(THREE).filter(([name,value])=>name.endsWith('Format')&&typeof value==='number').map(([name,value])=>[value,name]));
/** Diagnostic snapshot, never sampled in the flight loop. Counts reachable
 * payloads, not driver allocations. Hidden source/LOD data is intentionally
 * included; source cache entries outside this subtree are not. */
export function sceneResourceInventory(root){
 const geometries=new Set(),materials=new Set(),textures=new Set(),attributes=new Set(),buffers=new Set(),visibleAttributes=new Set(),formatCounts=new Map();
 let objects=0,meshes=0,geometryAttributeBytes=0,cpuBackingBufferBytes=0,visibleAttributeBytes=0,instances=0,multiDrawBatches=0;
 const array=value=>{const buffer=value?.buffer;if(buffer&&!buffers.has(buffer)){buffers.add(buffer);cpuBackingBufferBytes+=buffer.byteLength;}};
 const attribute=(value,visible=false)=>{if(!value)return;const storage=value.isInterleavedBufferAttribute?value.data:value;
  if(!attributes.has(storage)){attributes.add(storage);geometryAttributeBytes+=storage.array?.byteLength||0;array(storage.array);}
  if(visible&&!visibleAttributes.has(storage)){visibleAttributes.add(storage);visibleAttributeBytes+=storage.array?.byteLength||0;}
 };
 const geometry=(object,visible)=>{
  if(object.geometry){geometries.add(object.geometry);for(const a of Object.values(object.geometry.attributes))attribute(a,visible);attribute(object.geometry.index,visible);for(const rows of Object.values(object.geometry.morphAttributes||{}))for(const a of rows)attribute(a,visible);}
  attribute(object.instanceMatrix,visible);attribute(object.instanceColor,visible);
 };
 const texture=value=>{if(!value?.isTexture||value.isRenderTargetTexture||textures.has(value))return;textures.add(value);
  const key=formats.get(value.format)||String(value.format),row=formatCounts.get(key)||{format:key,textures:0,storedMipBytes:0};row.textures++;
  for(const mip of value.mipmaps||[]){row.storedMipBytes+=mip.data?.byteLength||0;array(mip.data);}
  const image=value.source?.data||value.image;array(image?.data);formatCounts.set(key,row);
 };
 root?.traverse(object=>{
  objects++;if(object.isMesh)meshes++;if(object.isInstancedMesh)instances++;if(object.isBatchedMesh)multiDrawBatches++;geometry(object,false);
  // Known batching-owned CPU arrays and data textures, excluded from material
  // texture estimates. These still contribute to reachable backing buffers.
  for(const name of ['sourceMatrices','sourceColors','sourceSpheres','enabled'])array(object[name]);
  for(const name of ['_matricesTexture','_colorsTexture','_indirectTexture'])array(object[name]?.image?.data);
  for(const material of Array.isArray(object.material)?object.material:[object.material])if(material&&!materials.has(material)){materials.add(material);for(const t of materialTextures(material))texture(t);}
 });
 root?.traverseVisible(object=>geometry(object,true));
 return {objects,meshes,geometries:geometries.size,materials:materials.size,instancedMeshes:instances,multiDrawBatches,
  geometryAttributeBytes,cpuBackingBufferBytes,visibleAttributeBytes,materialTextures:textures.size,textureFormats:[...formatCounts.values()].sort((a,b)=>a.format.localeCompare(b.format)),
  materialTextureEstimate:root?estimateTextureMemory(root):null,
  scope:'Reachable subtree payloads including hidden LOD/source data; visible attributes are view-eligible, not measured GPU residency. Excludes driver/renderer/JS overhead, render targets and caches outside the subtree.'};
}
