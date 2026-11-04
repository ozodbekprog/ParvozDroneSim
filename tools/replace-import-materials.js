// Update prepared materials without rebuilding unchanged multi-million-triangle geometry.
import{NodeIO}from'@gltf-transform/core';import{ALL_EXTENSIONS}from'@gltf-transform/extensions';
import{copyToDocument,prune}from'@gltf-transform/functions';
import{readFileSync,copyFileSync,existsSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
import{recoveryFolder}from'./content-import-profile.js';
const f=recoveryFolder,io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
for(const name of ['runtime.glb','model.glb.prepared.glb'])if(!existsSync(f+name+'.before-material-final'))copyFileSync(f+name,f+name+'.before-material-final');
const target=await io.read(f+'runtime.glb'),source=await io.read(f+'materials-only.glb');
const digest=()=>{const hash=createHash('sha256');for(const mesh of target.getRoot().listMeshes())for(const p of mesh.listPrimitives())for(const a of [...p.listAttributes(),p.getIndices()].filter(Boolean)){const v=a.getArray();hash.update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));}return hash.digest('hex');};
const before=digest(),available=new Map(source.getRoot().listMaterials().map(m=>[m.getName(),m])),copied=copyToDocument(target,source,[...available.values()]);let count=0;
for(const mesh of target.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){const replacement=available.get(primitive.getMaterial()?.getName());if(replacement){primitive.setMaterial(copied.get(replacement));count++;}}
const after=digest();if(before!==after)throw new Error('Material update changed geometry');
await target.transform(prune({keepLeaves:true}));await io.write(f+'runtime.glb',target);
writeFileSync(f+'material-replacement.json',JSON.stringify({primitivesUpdated:count,geometrySha256:before,geometryUnchanged:true},null,2));console.log('Material bindings updated; geometry unchanged:',count);
