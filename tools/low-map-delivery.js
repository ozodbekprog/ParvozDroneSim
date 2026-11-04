import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {read as readKTX,write as writeKTX} from 'ktx-parse';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

/** Select already-authored lower mip payloads, without decoding/recompressing.
 * Only independent 2D UASTC/zstd levels are accepted; other formats fail closed. */
export function lowTexture(bytes,maximum=256){
 if(!Number.isInteger(maximum)||maximum<1)throw Error('Texture maximum must be a positive integer');
 const container=readKTX(bytes);
 if(Math.max(container.pixelWidth,container.pixelHeight)<=maximum)return bytes;
 if(container.faceCount!==1||container.layerCount||container.pixelDepth||container.supercompressionScheme!==2||container.dataFormatDescriptor[0]?.colorModel!==166||container.globalData)throw Error('Low delivery requires independent 2D UASTC/zstd mips');
 let level=0;while(level<container.levels.length&&Math.max(container.pixelWidth>>level,container.pixelHeight>>level)>maximum)level++;
 if(level===container.levels.length)throw Error('Missing authored mip for requested texture size');
 container.pixelWidth=Math.max(1,container.pixelWidth>>level);container.pixelHeight=Math.max(1,container.pixelHeight>>level);
 container.levels=container.levels.slice(level);container.levelCount=container.levels.length;
 return writeKTX(container);
}

export function nodeDeliverySignature(node){
 const hash=createHash('sha256');
 node.traverse(current=>{
  if(current.getSkin())throw Error('Animated/skinned selectors need a separate delivery verifier');
  hash.update(JSON.stringify([current.getName(),current.getTranslation(),current.getRotation(),current.getScale(),current.getExtras()]));
  const instances=current.getExtension('EXT_mesh_gpu_instancing');
  if(instances)for(const semantic of instances.listSemantics().sort()){const a=instances.getAttribute(semantic);hash.update(semantic);hash.update(new Uint8Array(a.getArray().buffer,a.getArray().byteOffset,a.getArray().byteLength));}
  for(const primitive of current.getMesh()?.listPrimitives()||[]){
   if(primitive.listTargets().length)throw Error('Morph targets need a separate delivery verifier');
   hash.update(JSON.stringify([primitive.getMode(),primitive.getMaterial()?.getName(),primitive.getExtras()]));
   for(const semantic of [...primitive.listSemantics().sort(),'INDICES']){
    const accessor=semantic==='INDICES'?primitive.getIndices():primitive.getAttribute(semantic);if(!accessor)continue;
    hash.update(JSON.stringify([semantic,accessor.getType(),accessor.getNormalized()]));const array=accessor.getArray();
    // Meshopt TRIANGLES may rotate a triangle's starting corner. Preserve
    // triangle order, vertex membership and winding while accepting that
    // lossless rotation. Attributes still compare byte-for-byte.
    let values=array;
    if(semantic==='INDICES'&&primitive.getMode()===4){
     values=new array.constructor(array.length);
     for(let i=0;i<array.length;i+=3){
      let first=0;
      for(let corner=1;corner<3;corner++)if(array[i+corner]<array[i+first]||(array[i+corner]===array[i+first]&&array[i+(corner+1)%3]<array[i+(first+1)%3]))first=corner;
      for(let corner=0;corner<3;corner++)values[i+corner]=array[i+(first+corner)%3];
     }
    }
    hash.update(new Uint8Array(values.buffer,values.byteOffset,values.byteLength));
   }
  }
 });return hash.digest('hex');
}

export async function buildLowMapDelivery(definitionPath,output){
 const definition=JSON.parse(readFileSync(definitionPath,'utf8')),folder=dirname(definitionPath),input=resolve(folder,definition.model);
 if(resolve(output)===input)throw Error('Keep the canonical full-quality model');
 const selectors=new Set([definition.modelNode]);
 for(const object of definition.objects||[]){
  if(resolve(folder,object.model)!==input)throw Error('Multiple source models need separate packages');
  if(object.modelLods?.length)for(const lod of object.modelLods.slice(object.lowLod||0)){
   if(resolve(folder,lod.model)!==input)throw Error('Unexpected LOD source');selectors.add(lod.modelNode);
  }else selectors.add(object.modelNode);
 }
 if(selectors.has(undefined))throw Error('Named authored selectors are required');
 await MeshoptDecoder.ready;await MeshoptEncoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
 const document=await io.read(input),byName=new Map(),keep=new Set(),before={};
 if(document.getRoot().listAnimations().length)throw Error('Animated maps need a separate delivery verifier');
 for(const node of document.getRoot().listNodes())if(selectors.has(node.getName())){
  if(byName.has(node.getName()))throw Error('Ambiguous selector: '+node.getName());byName.set(node.getName(),node);
 }
 for(const name of selectors){
  const node=byName.get(name);if(!node)throw Error('Missing selector: '+name);before[name]=nodeDeliverySignature(node);
  node.traverse(child=>keep.add(child));for(let parent=node.getParentNode();parent;parent=parent.getParentNode())keep.add(parent);
 }
 for(const node of document.getRoot().listNodes())if(!keep.has(node))node.dispose();
 await document.transform(prune({keepLeaves:true,keepAttributes:true,keepSolidTextures:true,keepExtras:false}));
 let textureBefore=0,textureAfter=0;
 for(const texture of document.getRoot().listTextures()){
  if(texture.getMimeType()!=='image/ktx2')throw Error('Unexpected non-KTX2 texture');
  const original=texture.getImage(),reduced=lowTexture(original);textureBefore+=original.byteLength;textureAfter+=reduced.byteLength;texture.setImage(reduced);
 }
 document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 const bytes=await io.writeBinary(document),decoded=await io.readBinary(bytes);
 const after=new Map(decoded.getRoot().listNodes().map(node=>[node.getName(),node]));
 for(const [name,expected]of Object.entries(before))if(!after.has(name)||nodeDeliverySignature(after.get(name))!==expected)throw Error('Geometry/transform parity failed: '+name);
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,bytes);
 const result={source:input,sourceSHA256:createHash('sha256').update(readFileSync(input)).digest('hex'),output:resolve(output),outputSHA256:createHash('sha256').update(bytes).digest('hex'),beforeBytes:readFileSync(input).byteLength,afterBytes:bytes.byteLength,textureBefore,textureAfter,selectors:selectors.size,geometryParity:true,textureMaximum:256};
 writeFileSync(output+'.report.json',JSON.stringify(result,null,2)+'\n');return result;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [definition,output]=process.argv.slice(2);if(!definition||!output)throw Error('Usage: node tools/low-map-delivery.js map.json output.glb');
 console.log(JSON.stringify(await buildLowMapDelivery(resolve(definition),resolve(output))));
}
