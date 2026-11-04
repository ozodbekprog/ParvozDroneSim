import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';import {readFileSync,writeFileSync} from 'node:fs';import {resolve,dirname,join} from 'node:path';import {createHash} from 'node:crypto';
import {fullDetailFingerprint} from './derive-map-lods.js';
const [input,output,metadata]=process.argv.slice(2);if(!input||!output||!metadata||resolve(input)===resolve(output))throw new Error('Use separate candidate input/output and prepared material metadata.');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const d=await io.read(input),before=fullDetailFingerprint(d),data=JSON.parse(readFileSync(metadata,'utf8')),root=d.getRoot(),textures=new Map(),bindings=[];
const texture=file=>{if(!textures.has(file))textures.set(file,d.createTexture(file).setMimeType('image/png').setImage(readFileSync(join(dirname(metadata),file))));return textures.get(file);};
for(const row of data.materials){
 const materials=root.listMaterials().filter(m=>m.getExtras()?.sourceMaterialKey===row.key);if(!materials.length)throw new Error('Missing source material binding '+row.key);
 for(const material of materials){
  if(row.normal){if(material.getNormalTexture())throw new Error('Unexpected existing normal '+material.getName());material.setNormalTexture(texture(row.normal));}
  if(row.roughness){if(material.getMetallicRoughnessTexture())throw new Error('Unexpected existing roughness '+material.getName());material.setMetallicRoughnessTexture(texture(row.roughness)).setRoughnessFactor(1).setMetallicFactor(0);}
  material.setExtras({...material.getExtras(),foliagePBR:'Native packed AG normal / source gloss to roughness, 20261018'});bindings.push(material.getName());
 }
}
d.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});await io.write(output,d);
const checked=await io.read(output),after=fullDetailFingerprint(checked);if(before!==after)throw new Error('Geometry/UV fingerprint changed during material patch');
const bytes=readFileSync(output),report={input,output,status:'verified',fullDetailBefore:before,fullDetailAfter:after,materials:bindings,newTextures:textures.size,deliverySha256:createHash('sha256').update(bytes).digest('hex'),deliveryBytes:bytes.length};
writeFileSync(output+'.pbr-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
