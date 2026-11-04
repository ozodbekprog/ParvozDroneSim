import {BufferAttribute,InstancedBufferAttribute} from 'three';

const yieldToBrowser=()=>globalThis.scheduler?.yield?.()||new Promise(resolve=>setTimeout(resolve,0));

/** The shared loader finishes conversion before publishing the asset. Yield
 * between geometries so large maps don't turn every conversion into one task. */
export async function normalizePackedVertexAttributesAsync(scenes,{budgetMs=8,now=()=>performance.now(),yieldTask=yieldToBrowser,signal}={}){
 signal?.throwIfAborted();
 const steps=normalizationSteps(scenes);let sliceStart=now(),step;
 while(!(step=steps.next()).done){
  signal?.throwIfAborted();
  if(now()-sliceStart>=budgetMs){await yieldTask();signal?.throwIfAborted();sliceStart=now();}
 }
 return step.value;
}

export function normalizePackedVertexAttributes(scenes){
 const steps=normalizationSteps(scenes);let step;
 while(!(step=steps.next()).done){}
 return step.value;
}

/** WebGPU vertex records require four-byte strides and padded packed formats.
 * A tightly packed normalized SHORT VEC3 is legal glTF/WebGL (6 bytes), but
 * r180 maps it to snorm16x4 without padding the record. Decode only incompatible
 * attributes once on the parsed asset; keep semantic values and item sizes. */
function* normalizationSteps(scenes){
 const geometries=new Set(),converted=new WeakMap();let count=0;
 const compatible=attribute=>{
  const array=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array;
  const bytes=array.BYTES_PER_ELEMENT,record=attribute.itemSize*bytes;
  if(bytes>=4)return true;
  if(!attribute.normalized&&!attribute.isFloat16BufferAttribute)return true;
  const stride=(attribute.isInterleavedBufferAttribute?attribute.data.stride:attribute.itemSize)*bytes;
  const offset=(attribute.offset||0)*bytes;
  return attribute.itemSize!==1&&record%4===0&&stride%4===0&&offset%Math.min(4,record)===0;
 };
 const normalize=attribute=>{
  if(compatible(attribute))return attribute;
  if(converted.has(attribute))return converted.get(attribute);
  const values=new Float32Array(attribute.count*attribute.itemSize);
  for(let i=0;i<attribute.count;i++)for(let j=0;j<attribute.itemSize;j++)values[i*attribute.itemSize+j]=attribute.getComponent(i,j);
  // values is already Float32Array. Float32BufferAttribute would allocate and
  // copy it again for every converted mesh, increasing map-load GC pressure.
  const next=attribute.isInstancedBufferAttribute?new InstancedBufferAttribute(values,attribute.itemSize,false,attribute.meshPerAttribute):new BufferAttribute(values,attribute.itemSize);
  next.name=attribute.name;next.setUsage(attribute.usage);converted.set(attribute,next);count++;return next;
 };
 for(const scene of scenes)scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);});
 for(const geometry of geometries){
  const before=count;
  for(const [name,attribute] of Object.entries(geometry.attributes))geometry.setAttribute(name,normalize(attribute));
  for(const [name,attributes] of Object.entries(geometry.morphAttributes))geometry.morphAttributes[name]=attributes.map(normalize);
  if(count!==before)yield;
 }
 return count;
}
