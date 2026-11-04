import { NodeIO,PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt, textureCompress, instance } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, basename, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import {restoreStaticModelRoots} from './static-model-roots.js';
import {cachedKtx,textureFingerprint} from './cached-ktx.js';
import {compressGeometry} from './gltf-geometry-compression.js';
import {instanceSiblings} from './instance-siblings.js';

const [input, output, ...flags] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node tools/optimize-art.js input.glb output.glb [--static] [--png]');
if (resolve(input) === resolve(output)) throw new Error('Keep the authored input separate from the delivery output.');
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const previousPrepared=flags.find(v=>v.startsWith('--reuse-unchanged-ktx='))?.slice('--reuse-unchanged-ktx='.length);
const previousCompressed=flags.find(v=>v.startsWith('--reuse-compressed-ktx='))?.slice('--reuse-compressed-ktx='.length)||output;
const textureCache=previousPrepared?cachedKtx(readFileSync(previousPrepared),readFileSync(previousCompressed)):null;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const temporary = resolve(dirname(output), `${basename(output)}.prepared.glb`);
const resume=flags.includes('--resume-prepared');
const terrainNormalSize=Number(flags.find(v=>v.startsWith('--terrain-normal-size='))?.slice('--terrain-normal-size='.length)||0);
if(terrainNormalSize&&!([128,256,512].includes(terrainNormalSize)))throw new Error('Terrain normal size must be 128, 256 or 512');
if(resume&&!existsSync(temporary))throw new Error('No prepared GLB to resume.');
let document = resume?null:await io.read(resolve(input));
const unityMaterials=flags.find(flag=>flag.startsWith('--unity-materials='))?.slice(18);
if(unityMaterials&&!resume){
  const metadata=JSON.parse(readFileSync(unityMaterials,'utf8')),folder=dirname(unityMaterials);
  for(const material of document.getRoot().listMaterials()){
    const entry=metadata.materials.find(m=>m.key===material.getExtras()?.sourceMaterialKey)||metadata.materials.find(m=>m.name===material.getName());if(!entry)continue;
    const saved=JSON.parse(readFileSync(resolve(folder,entry.file),'utf8')).m_SavedProperties||{},properties={...saved.m_Floats,...entry.pbrOverrides?.floats},color=entry.pbrOverrides?.colors?._Color||saved.m_Colors?._Color;
    if(properties._Mode>=2){material.setAlphaMode('BLEND');const factor=material.getBaseColorFactor();factor[3]=color?.m_A??1;material.setBaseColorFactor(factor);}
    if(color&&entry.textures?._MainTex){const factor=material.getBaseColorFactor();for(const [i,c] of ['R','G','B'].entries())factor[i]=color['m_'+c]??1;material.setBaseColorFactor(factor);}
    material.setExtras({...material.getExtras(),unityShaderMode:properties._Mode??0});
    if(properties._Mode===1){material.setAlphaMode('MASK');material.setAlphaCutoff(properties._Cutoff??.5);}
    if(properties._Mode===2&&/^(FloorArrows|SkidMarks|Smudge|Graffiti|TornPosters|PatchedWall|LevelWalls)/.test(material.getName()))material.setExtras({...material.getExtras(),singlePassThinSurface:true});
  }
}
// Do not flatten or join drone nodes: mounts, part names and rotor pivots are semantic.
if(!resume)await document.transform(dedup({keepUniqueNames:true}), weld(), prune({keepLeaves:true}), textureCompress({encoder:sharp,resize:[1024,1024],targetFormat:'png'}));
if(!resume&&terrainNormalSize)await document.transform(textureCompress({encoder:sharp,resize:[terrainNormalSize,terrainNormalSize],targetFormat:'png',pattern:/^terrain-\d+-\d+-\d+-normal$/}));
if(!resume&&flags.includes('--instance-siblings')){
 await document.transform(dedup({propertyTypes:[PropertyType.ACCESSOR,PropertyType.MESH]}));
 console.log('Spatial sibling instances:',instanceSiblings(document));
}
if(textureCache){
 const replacements=new Map();
 for(const material of document.getRoot().listMaterials())for(const slot of ['BaseColor','Normal','MetallicRoughness','Occlusion','Emissive']){
  const texture=material['get'+slot+'Texture']();if(!texture)continue;
  const cached=textureCache.get(material.getName()+':'+slot+':'+textureFingerprint(texture.getImage()));if(!cached)continue;
  if(replacements.has(texture)&&!Buffer.from(replacements.get(texture)).equals(cached))throw new Error('Conflicting cached texture color spaces');
  replacements.set(texture,cached);
 }
 for(const[texture,bytes]of replacements)texture.setImage(bytes).setMimeType('image/ktx2');
 if(replacements.size)document.createExtension(KHRTextureBasisu).setRequired(true);
 console.log('Reused unchanged compressed textures:',replacements.size);
}
if (flags.includes('--static')&&!resume) {
  const selectors=document.getRoot().listNodes().map(n=>n.getName()).filter(n=>/^(SiteChunk_\d+_LOD\d|SiteGround)$/.test(n));
  await document.transform(instance({min:2}));
  if(selectors.length)restoreStaticModelRoots(document,selectors);
}
mkdirSync(dirname(resolve(output)),{recursive:true});
mkdirSync(dirname(temporary),{recursive:true});
if(!resume)await io.write(flags.includes('--png') ? resolve(output) : temporary,document);
document=null;global.gc?.();
let result;
if (!flags.includes('--png')) {
 if(flags.includes('--reuse-ktx')){
  if(!resume)throw new Error('--reuse-ktx requires --resume-prepared');
  result=await io.read(temporary);
  const compressed=await io.read(resolve(output)),materials=new Map(compressed.getRoot().listMaterials().map(m=>[m.getName(),m]));
  const replacements=new Map();
  for(const material of result.getRoot().listMaterials())for(const slot of ['BaseColor','Normal','MetallicRoughness','Occlusion','Emissive']){
    const texture=material['get'+slot+'Texture']();if(!texture)continue;
    const encoded=materials.get(material.getName())?.['get'+slot+'Texture']();
    if(!encoded||encoded.getMimeType()!=='image/ktx2')throw new Error('Missing cached KTX2 binding: '+material.getName()+' / '+slot);
    if(replacements.has(texture)&&!Buffer.from(replacements.get(texture)).equals(Buffer.from(encoded.getImage())))throw new Error('Conflicting cached KTX2 bindings');
    replacements.set(texture,encoded.getImage());
  }
  for(const [texture,bytes] of replacements)texture.setImage(bytes).setMimeType('image/ktx2');
  result.createExtension(KHRTextureBasisu).setRequired(true);
  await result.transform(prune({keepLeaves:true}));
  console.log('Reused verified KTX2 bindings; restored original prepared coordinates.');
 }else{
  const binary = resolve('tools/bin/ktx/portable/bin');
  if (!existsSync(resolve(binary,'toktx.exe'))) throw new Error('KTX tools missing. Put official KTX-Software binaries in tools/bin/ktx/portable/bin. Use --png only for an explicitly uncompressed review export.');
  // Windows environment keys are case-insensitive; duplicate Path/PATH entries
  // can hide the portable KTX folder from child processes.
  const env={...process.env},previousPath=process.env.PATH || process.env.Path || '';
  for(const key of Object.keys(env))if(key.toLowerCase()==='path')delete env[key];
  env[process.platform==='win32'?'Path':'PATH']=binary+delimiter+previousPath;
  // Large map compression must not fill the system drive with temporary textures.
  const scratch=resolve(dirname(output),'.ktx-temp');mkdirSync(scratch,{recursive:true});
  env.TEMP=scratch;env.TMP=scratch;
  const result=spawnSync(process.execPath,[resolve('node_modules/@gltf-transform/cli/bin/cli.js'),'uastc',temporary,resolve(output),'--level','2','--zstd','18','--jobs','2','--mipmaps','true'],{env,stdio:'inherit',windowsHide:true});
  if(result.status!==0)throw new Error('KTX2 compression failed: '+(result.error?.message || result.status));
 }
}
result ||=await io.read(resolve(output));
// The CLI decodes meshopt on read, so geometry compression must be the final step.
const floatPositions=flags.includes('--position-float')||!!(process.env.CONTENT_IMPORT_PROFILE&&JSON.parse(readFileSync(process.env.CONTENT_IMPORT_PROFILE,'utf8')).lod?.floatPositions);
await compressGeometry(result,floatPositions);
await io.write(resolve(output),result);
const root=result.getRoot();
let triangles=0,draws=0;
for(const node of root.listNodes())if(node.getMesh())for(const primitive of node.getMesh().listPrimitives()){
  const batch=node.getExtension('EXT_mesh_gpu_instancing'),copies=batch?batch.listAttributes()[0].getCount():1;
  triangles+=(primitive.getIndices()?.getCount() || primitive.getAttribute('POSITION')?.getCount() || 0)/3*copies;draws++;
}
const report={input,output,trianglesBeforeInstancing:Math.round(triangles),meshPrimitives:draws,materials:root.listMaterials().length,textures:root.listTextures().map(texture=>({name:texture.getName(),mimeType:texture.getMimeType(),size:texture.getSize()})),extensions:root.listExtensionsUsed().map(extension=>extension.extensionName)};
writeFileSync(output+'.report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
