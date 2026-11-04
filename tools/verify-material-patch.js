import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {writeFileSync,readFileSync} from 'node:fs';
const [original,patched,reportFile]=process.argv.slice(2);if(!reportFile)throw Error('Usage: verify-material-patch.js ORIGINAL PATCHED REPORT');
await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const before=await io.read(original),after=await io.read(patched),digest=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function geometry(document){
 const root=document.getRoot();return {
  nodes:root.listNodes().map(n=>({name:n.getName(),matrix:n.getMatrix(),mesh:n.getMesh()?.getName(),children:n.listChildren().map(c=>c.getName()),instances:n.getExtension('EXT_mesh_gpu_instancing')?.listAttributes().map(a=>digest(a.getArray()))})),
  meshes:root.listMeshes().map(m=>({name:m.getName(),primitives:m.listPrimitives().map(p=>{
   const indices=p.getIndices()?new Uint32Array(p.getIndices().getArray()):null;
   if(indices&&p.getMode()===4)for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3);if(b<a&&b<=c)indices.set([b,c,a],i);else if(c<a&&c<b)indices.set([c,a,b],i);}
   return {mode:p.getMode(),material:p.getMaterial()?.getName(),indices:indices&&digest(indices),attributes:p.listSemantics().sort().map(k=>{const a=p.getAttribute(k);return [k,a.getType(),a.getNormalized(),digest(a.getArray())];})};
  })})),
 };
}
assert.deepEqual(geometry(after),geometry(before),'Geometry, every LOD, UVs, transforms or source material bindings changed');
const originals=before.getRoot().listTextures().map(t=>digest(t.getImage())),patchedImages=new Set(after.getRoot().listTextures().map(t=>digest(t.getImage())));
assert.ok(originals.every(hash=>patchedImages.has(hash)),'An original texture was replaced');
const bytes=readFileSync(patched),report={verified:true,scope:'All nodes, meshes, LODs, indices, vertex attributes, instance arrays and original texture bytes',nodes:before.getRoot().listNodes().length,meshes:before.getRoot().listMeshes().length,originalTextures:originals.length,additionalTextures:after.getRoot().listTextures().length-originals.length,bytes:bytes.length,sha256:digest(bytes)};
writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
