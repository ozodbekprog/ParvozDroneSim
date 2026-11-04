import {Document,NodeIO,PropertyType} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {copyToDocument,createDefaultPropertyResolver,quantize,prune} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {fullDetailFingerprint} from './derive-map-lods.js';
import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
/** Work in an isolated graph so quantization never touches authored LOD0.
 * Mesh-local 16-bit positions get compensating transforms, including instances.
 * UVs, normals, textures and source material bindings remain unchanged. */
export async function quantizeReducedLODs(document){
 const before=fullDetailFingerprint(document),reduced=new Document();
 for(const extension of document.getRoot().listExtensionsUsed())reduced.createExtension(extension.constructor).setRequired(extension.isRequired());
 const roots=document.getRoot().listNodes().filter(n=>/^(?:[A-Za-z][A-Za-z0-9_]*)?Chunk_\d+_LOD[12]$/.test(n.getName()));
 const copies=copyToDocument(reduced,document,roots),scene=reduced.createScene('Reduced levels');for(const node of roots)scene.addChild(copies.get(node));
 await reduced.transform(quantize({pattern:/^POSITION$/,quantizePosition:16,quantizationVolume:'mesh',cleanup:false}));
 for(const extension of reduced.getRoot().listExtensionsUsed())document.createExtension(extension.constructor).setRequired(extension.isRequired());
 const shared=new Map([...copies].filter(([property])=>[PropertyType.MATERIAL,PropertyType.TEXTURE,PropertyType.BUFFER].includes(property.propertyType)).map(([original,copy])=>[copy,original]));
 const fallback=createDefaultPropertyResolver(document,reduced),resolved=copyToDocument(document,reduced,roots.map(n=>copies.get(n)),property=>shared.get(property)||fallback(property));
 for(const original of roots){const replacement=resolved.get(copies.get(original));for(const parent of original.listParents())if(parent.addChild){parent.addChild(replacement);parent.removeChild(original);}original.dispose();}
 await document.transform(prune({keepLeaves:true,keepAttributes:true}));
 const after=fullDetailFingerprint(document);if(before!==after)throw new Error('Original LOD0 changed during isolated packing');
 return {fullDetailBefore:before,fullDetailAfter:after,roots:roots.length,positionBits:16,uvAndNormals:'unchanged',strategy:'Mesh-local 16-bit reduced positions with compensating node/instance transforms; original LOD0 floats preserved.'};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const [input,output]=process.argv.slice(2);if(!input||!output||resolve(input)===resolve(output))throw new Error('Use distinct delivery candidates');
 await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
 const document=await io.read(input),report=await quantizeReducedLODs(document);document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});await io.write(output,document);
 if(fullDetailFingerprint(await io.read(output))!==report.fullDetailBefore)throw new Error('Written LOD0 changed');const bytes=readFileSync(output);Object.assign(report,{status:'verified',input,output,deliveryBytes:bytes.length,deliverySha256:createHash('sha256').update(bytes).digest('hex')});writeFileSync(output+'.packing-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
