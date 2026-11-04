// Decode the actual delivery model for Blender's surface audit; drop textures
// only in this temporary audit copy. The delivered model is never modified.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune,uninstance} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {recoveryFolder} from './content-import-profile.js';
await MeshoptDecoder.ready;
const input=recoveryFolder+'model.glb',output=recoveryFolder+'audit-delivery.glb';
const document=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(input);
document.getRoot().listExtensionsUsed().find(e=>e.extensionName==='EXT_meshopt_compression')?.dispose();
// Expand only the audit copy: Blender compares the actual delivered placements.
await document.transform(uninstance());
for(const material of document.getRoot().listMaterials())for(const slot of ['BaseColor','Normal','MetallicRoughness','Occlusion','Emissive'])material['set'+slot+'Texture'](null);
await document.transform(prune({keepLeaves:true}));
for(const extension of document.getRoot().listExtensionsUsed())if(['KHR_texture_basisu','KHR_texture_transform'].includes(extension.extensionName))extension.dispose();
await new NodeIO().registerExtensions(ALL_EXTENSIONS).write(output,document);
const report={input,output,deliverySha256:createHash('sha256').update(readFileSync(input)).digest('hex')};
writeFileSync(recoveryFolder+'audit-delivery.json',JSON.stringify(report,null,2));
console.log('Actual delivery geometry decoded for audit.');
