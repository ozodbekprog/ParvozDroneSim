import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {copyToDocument} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {nodeDeliverySignature} from './low-map-delivery.js';
import {placedNodeBounds,combineDeliveryBounds} from './map-delivery-bounds.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** An offline delivery experiment. It does not change the canonical map or
 * install streaming. Selectors keep their authored transforms and geometry;
 * identical encoded textures are shared by content hash across packages. */
export async function buildChunkedMapDelivery(definitionPath,lowModel,output,{cellSize=128,streaming=false}={}){
 if(!Number.isFinite(cellSize)||cellSize<=0)throw Error('Cell size must be positive');
 if(existsSync(output))throw Error('Use a new experiment directory');
 const definition=JSON.parse(readFileSync(definitionPath,'utf8'));
 if(resolve(dirname(definitionPath),definition.model)===resolve(lowModel))throw Error('Use a separately verified Low model');
 await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
 const source=await io.read(lowModel),nodes=new Map(),ambiguous=new Set();
 for(const node of source.getRoot().listNodes()){
  const name=node.getName();if(!name)continue;
  if(nodes.has(name))ambiguous.add(name);else nodes.set(name,node);
 }
 const base=streaming?'coarse':'environment',groups=new Map([[base,new Set([definition.modelNode])]]),placements=new Map([[base,[]]]);
 for(const [index,object]of (definition.objects||[]).entries()){
  if(streaming){groups.get(base).add(object.modelLods?.at(-1)?.modelNode||object.modelNode);placements.get(base).push(index);if(!object.modelLods?.length)continue;}
  const [x,,z]=object.position||[0,0,0],key=`cell-${Math.floor(x/cellSize)}-${Math.floor(z/cellSize)}`;
  if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Invalid chunk position');
  if(!groups.has(key))groups.set(key,new Set());
  if(!placements.has(key))placements.set(key,[]);placements.get(key).push(index);
  const selected=object.modelLods?.length?object.modelLods.slice(object.lowLod??0,streaming?(object.lowLod??0)+1:undefined):[object];
  for(const level of selected)groups.get(key).add(level.modelNode);
 }
 const resources=new Map(),packages=[],allSelectors=new Set();
 mkdirSync(output,{recursive:true});
 const save=(filename,bytes)=>{
  const sha256=hash(bytes),existing=resources.get(filename);
  if(existing&&existing.sha256!==sha256)throw Error('Resource hash collision: '+filename);
  if(!existing){writeFileSync(resolve(output,filename),bytes);resources.set(filename,{url:filename,bytes:bytes.byteLength,sha256});}
  return filename;
 };
 for(const [cell,names]of groups){
  const roots=[...names].map(name=>{if(!nodes.has(name))throw Error('Missing Low selector: '+name);if(ambiguous.has(name))throw Error('Ambiguous named selector: '+name);allSelectors.add(name);return nodes.get(name);});
  const target=new Document();
  for(const extension of source.getRoot().listExtensionsUsed())target.createExtension(extension.constructor).setRequired(extension.isRequired());
  const copied=copyToDocument(target,source,roots),scene=target.createScene(cell);
  for(const root of roots){if(root.getParentNode())throw Error('Experiment requires top-level authored selectors');scene.addChild(copied.get(root));}
  target.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const encoded=await io.writeJSON(target),renames=new Map(),dependencies=[];
  for(const [uri,bytes]of Object.entries(encoded.resources)){
   const filename=`${hash(bytes).slice(0,32)}${extname(uri)}`;renames.set(uri,filename);save(filename,bytes);dependencies.push(filename);
  }
  for(const item of [...(encoded.json.buffers||[]),...(encoded.json.images||[])])if(item.uri){
   if(!renames.has(item.uri))throw Error('Untracked resource: '+item.uri);item.uri=renames.get(item.uri);
  }
  const jsonBytes=new TextEncoder().encode(JSON.stringify(encoded.json)),model=save(`${cell}-${hash(jsonBytes).slice(0,16)}.gltf`,jsonBytes);
  const decoded=await io.read(resolve(output,model)),decodedNodes=new Map(decoded.getRoot().listNodes().map(node=>[node.getName(),node]));
  for(const root of roots)if(!decodedNodes.has(root.getName())||nodeDeliverySignature(root)!==nodeDeliverySignature(decodedNodes.get(root.getName())))throw Error('Chunk geometry/transform parity failed: '+root.getName());
  const objectIndices=placements.get(cell)||[],boxes=[];
  for(const index of objectIndices){const object=definition.objects[index];for(const level of object.modelLods||[object])if(names.has(level.modelNode))boxes.push(placedNodeBounds(nodes.get(level.modelNode),object,!!object.modelLods?.length));}
  if(cell===base)boxes.push(placedNodeBounds(nodes.get(definition.modelNode),definition.modelTransform||{}));
  packages.push({cell,kind:streaming?(cell===base?'coarse':'near'):(cell===base?'environment':'low'),model,selectors:[...names],objectIndices,bounds:combineDeliveryBounds(boxes),resources:[...new Set(dependencies)],geometryParity:true});
 }
 for(const entry of packages)entry.totalBytes=resources.get(entry.model).bytes+entry.resources.reduce((sum,url)=>sum+resources.get(url).bytes,0);
 const report={version:streaming?2:1,experiment:true,definition:resolve(definitionPath),input:resolve(lowModel),inputSHA256:hash(readFileSync(lowModel)),cellSize,selectors:allSelectors.size,packages,resources:[...resources.values()],totalBytes:[...resources.values()].reduce((sum,row)=>sum+row.bytes,0),largestPackageBytes:Math.max(...packages.map(p=>p.totalBytes)),geometryParity:true};
 if(streaming){report.environment={modelNode:definition.modelNode,transform:definition.modelTransform||{},materials:definition.materials||[]};report.placements=(definition.objects||[]).map(object=>({position:object.position||[0,0,0],rotation:object.rotation||[0,0,0],scale:object.scale||1,modelNode:object.modelNode,lods:object.modelLods?.map(({modelNode,distance})=>({modelNode,distance})),materials:object.materials||[]}));}
 writeFileSync(resolve(output,'delivery-manifest.json'),JSON.stringify(report,null,2)+'\n');return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [definition,input,output,cellSize='128',mode]=process.argv.slice(2);if(!definition||!input||!output)throw Error('Usage: node tools/chunk-map-delivery.js map.json verified-low.glb new-output-folder [cell-size] [streaming]');
 const report=await buildChunkedMapDelivery(resolve(definition),resolve(input),resolve(output),{cellSize:Number(cellSize),streaming:mode==='streaming'});
 console.log(JSON.stringify({packages:report.packages.length,resources:report.resources.length,totalBytes:report.totalBytes,largestPackageBytes:report.largestPackageBytes,selectors:report.selectors,geometryParity:report.geometryParity}));
}
