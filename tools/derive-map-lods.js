import {NodeIO,Accessor} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const triangleCount=mesh=>mesh.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION')?.getCount()||0)/3,0);
/** Thin independent foliage cards, never individual triangles. Original vertices,
 * winding and UVs of every surviving card are kept, with nested distance sets. */
export function thinFoliageCards(indices,positions,keep){
 const parent=Uint32Array.from({length:positions.length/3},(_,i)=>i);
 const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
 for(let i=0;i<indices.length;i+=3){const root=find(indices[i]);parent[find(indices[i+1])]=root;parent[find(indices[i+2])]=root;}
 const cards=new Map();for(let i=0;i<indices.length;i+=3){const root=find(indices[i]);if(!cards.has(root))cards.set(root,[]);cards.get(root).push(i);}
 if(cards.size<12)return indices;
 const chosen=new Set();let smallest=null,scoreMin=Infinity;
 for(const [root,triangles] of cards){
  let hash=2166136261;for(const offset of triangles)for(let k=0;k<3;k++){const v=indices[offset+k];for(let a=0;a<3;a++)hash=Math.imul(hash^Math.round(positions[v*3+a]*1000),16777619);}
  const score=(hash>>>0)/4294967296;if(score<scoreMin){scoreMin=score;smallest=root;}if(score<keep)chosen.add(root);
 }
 chosen.add(smallest);const output=[];for(let i=0;i<indices.length;i+=3)if(chosen.has(find(indices[i])))output.push(indices[i],indices[i+1],indices[i+2]);
 return new Uint32Array(output);
}
export function fullDetailFingerprint(document){
 const hash=createHash('sha256'),meshes=new Set();
 const visit=node=>{hash.update(JSON.stringify([node.getName(),node.getMatrix()]));if(node.getMesh())meshes.add(node.getMesh());for(const child of node.listChildren())visit(child);};
 for(const node of document.getRoot().listNodes().filter(n=>/_LOD0$/.test(n.getName())))visit(node);
 for(const mesh of meshes)for(const primitive of mesh.listPrimitives()){
  if(primitive.getIndices()){
   // Meshopt's triangle codec may cyclically rotate a triangle. That keeps
   // winding, geometry and UVs identical; compare its canonical orientation.
   const indices=new Uint32Array(primitive.getIndices().getArray());
   if(primitive.getMode()===4)for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2];if(b<a&&b<=c)indices.set([b,c,a],i);else if(c<a&&c<b)indices.set([c,a,b],i);}
   hash.update(new Uint8Array(indices.buffer));
  }
  for(const semantic of primitive.listSemantics().sort()){const a=primitive.getAttribute(semantic),array=a.getArray();hash.update(JSON.stringify([semantic,a.getType(),a.getNormalized()]));hash.update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));}
 }
 return hash.digest('hex');
}

/** Derive runtime LODs only. Authored LOD0, transforms, UV values, materials and
 * texture bytes remain intact; colliders and native courses are separate inputs.
 */
export async function deriveMapLODs(document,{onProgress=()=>{}}={}){
 await MeshoptSimplifier.ready;
 const root=document.getRoot(),buffer=root.listBuffers()[0],cache=[null,new Map(),new Map()],report={levels:{1:{before:0,after:0,meshes:0},2:{before:0,after:0,meshes:0}},maxReportedError:0,fullDetailBefore:fullDetailFingerprint(document)};
 const textures=root.listTextures().map(t=>[t,digest(t.getImage())]);let processed=0;
 const reducePrimitive=(source,level,foliage)=>{
  const primitive=source.clone(),position=source.getAttribute('POSITION'),original=source.getIndices();
  if(!position||source.getMode()!==4||source.listTargets().length)return primitive;
  const count=original?.getCount()||position.getCount();if(count<(foliage?24:288))return primitive;
  let indices=original?new Uint32Array(original.getArray()):Uint32Array.from({length:position.getCount()},(_,i)=>i);const positions=new Float32Array(position.getArray());
  const cards=/leaves|leaf|fronds|terrain-detail/i.test(source.getMaterial()?.getName()||'');
  if(cards)indices=thinFoliageCards(indices,positions,level===1?.3:.07);
  const semantics=['NORMAL','TEXCOORD_0','COLOR_0'].filter(k=>source.getAttribute(k)),attributes=semantics.map(k=>source.getAttribute(k)),stride=attributes.reduce((n,a)=>n+a.getElementSize(),0);
  const data=new Float32Array(position.getCount()*stride),weights=semantics.flatMap((k,i)=>Array(attributes[i].getElementSize()).fill(foliage?(k==='TEXCOORD_0'?.1:.005):(k==='TEXCOORD_0'?2:.1)));
  for(let i=0;i<position.getCount();i++){let offset=i*stride;for(const attr of attributes){const value=attr.getElement(i,[]);data.set(value,offset);offset+=value.length;}}
  const ratio=level===2?.025:foliage?.14:.35,error=foliage?(level===2?.025:.01):(level===2?.006:.0015);
  const target=Math.min(indices.length,Math.max(foliage?(level===2?6:12):(level===2?48:144),Math.floor(indices.length*ratio/3)*3));
  const flags=['Sparse','Prune','Permissive',...(!foliage&&level===1?['LockBorder']:[])];
  const [reduced,actualError]=stride?MeshoptSimplifier.simplifyWithAttributes(indices,positions,3,data,stride,weights,null,target,error,flags):MeshoptSimplifier.simplify(indices,positions,3,target,error,flags);
  report.maxReportedError=Math.max(report.maxReportedError,actualError);
  if(reduced.length>=count||reduced.length<3)return primitive;
  const [remap,unique]=MeshoptSimplifier.compactMesh(reduced);
  for(const semantic of source.listSemantics()){
   const old=source.getAttribute(semantic),oldArray=old.getArray(),size=old.getElementSize(),array=new oldArray.constructor(unique*size);
   for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)for(let j=0;j<size;j++)array[remap[i]*size+j]=oldArray[i*size+j];
   primitive.setAttribute(semantic,document.createAccessor(old.getName()+' derived LOD'+level).setType(old.getType()).setNormalized(old.getNormalized()).setArray(array).setBuffer(buffer));
  }
  const array=unique<=65535?new Uint16Array(reduced):reduced;
  primitive.setIndices(document.createAccessor('Derived LOD'+level+' indices').setType(Accessor.Type.SCALAR).setArray(array).setBuffer(buffer));
  return primitive;
 };
 const reducedMesh=(mesh,level)=>{
  if(cache[level].has(mesh))return cache[level].get(mesh);
  const foliage=/tree|leaf|leaves|bark|fern|bush|shrub|grass|vegetation/i.test(mesh.getName()+' '+mesh.listPrimitives().map(p=>p.getMaterial()?.getName()).join(' '));
  const replacement=document.createMesh(mesh.getName()+' derived LOD'+level).setExtras({...mesh.getExtras(),derivedLOD:level});
  for(const primitive of mesh.listPrimitives())replacement.addPrimitive(reducePrimitive(primitive,level,foliage));
  cache[level].set(mesh,replacement);report.levels[level].meshes++;
  if(++processed%200===0)onProgress({processed,level});
  return replacement;
 };
 const originalRoots=root.listNodes().filter(n=>/^(?:[A-Za-z][A-Za-z0-9_]*)?Chunk_\d+_LOD0$/.test(n.getName()));
 const targets=new Map(root.listNodes().map(n=>[n.getName(),n]));
 for(const level of [1,2])for(const sourceRoot of originalRoots){
  const target=targets.get(sourceRoot.getName().replace(/0$/,String(level)));if(!target)throw new Error('Missing spatial LOD '+sourceRoot.getName());
  for(const child of [...target.listChildren()])target.removeChild(child);
  const copy=(source,destination)=>{
   destination.setMatrix(source.getMatrix());destination.setExtras({...source.getExtras(),derivedLOD:level});
   const instancing=source.getExtension('EXT_mesh_gpu_instancing');if(instancing)destination.setExtension('EXT_mesh_gpu_instancing',instancing.clone());
   const mesh=source.getMesh();if(mesh){const next=reducedMesh(mesh,level),instances=instancing?.listAttributes()[0]?.getCount()||1;report.levels[level].before+=triangleCount(mesh)*instances;report.levels[level].after+=triangleCount(next)*instances;destination.setMesh(next);}else destination.setMesh(null);
   for(const child of source.listChildren()){const next=document.createNode(child.getName()+' derived LOD'+level);destination.addChild(next);copy(child,next);}
  };
  copy(sourceRoot,target);
 }
 report.strategy='Derived from original UV/material topology at both reduced levels; no triangle-by-triangle baked atlas at distance.';
 report.fullDetailAfter=fullDetailFingerprint(document);
 if(report.fullDetailBefore!==report.fullDetailAfter)throw new Error('Authored full-detail geometry changed');
 for(const [texture,hash] of textures)if(digest(texture.getImage())!==hash)throw new Error('Texture bytes changed');
 report.textureBytesUnchanged=true;return report;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const [input,output]=process.argv.slice(2);if(!input||!output||resolve(input)===resolve(output))throw new Error('Use distinct input and output delivery files');
 await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
 const document=await io.read(input),started=performance.now(),report=await deriveMapLODs(document,{onProgress:value=>console.log(JSON.stringify(value))});
 await document.transform(prune({keepLeaves:true,keepAttributes:true}));
 document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 mkdirSync(dirname(resolve(output)),{recursive:true});await io.write(output,document);
 writeFileSync(output+'.lod-report.json',JSON.stringify({...report,status:'written-pending-verification'},null,2));
 const verified=await io.read(output);if(fullDetailFingerprint(verified)!==report.fullDetailBefore)throw new Error('Written delivery changed full-detail geometry');
 Object.assign(report,{status:'verified',input,output,ms:performance.now()-started,sourceSha256:digest(readFileSync(input)),deliverySha256:digest(readFileSync(output)),deliveryBytes:readFileSync(output).byteLength});
 writeFileSync(output+'.lod-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
