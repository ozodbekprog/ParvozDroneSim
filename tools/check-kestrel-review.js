import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const definition=JSON.parse(readFileSync('content/review/kestrel/review.json','utf8'));
const limits=[[25000,40000],[8000,12000],[1000,3000]], levels=[];
for(const [i,lod] of definition.modelLods.entries()){
  const document=await io.read(resolve('.'+lod.model));
  const root=document.getRoot(), meshes=root.listMeshes();
  const triangles=meshes.reduce((sum,m)=>sum+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount() || 0)/3,0),0);
  if(triangles<limits[i][0]||triangles>limits[i][1])throw new Error(`LOD ${i} exceeds its geometry budget: ${triangles}`);
  const rotors=definition.motorBindings.map(name=>{
    const matches=root.listNodes().filter(node=>node.getName()===name);
    if(matches.length!==1)throw new Error(`Missing or duplicate rotor ${name}`);
    if(!matches[0].listChildren().some(node=>node.getName().startsWith('Prop_')))throw new Error(`Rotor ${name} has no authored propeller`);
    const p=matches[0].getWorldTranslation();
    if(Math.abs(p[1])>.025||Math.hypot(p[0],p[2])<.1||Math.hypot(p[0],p[2])>.13)throw new Error(`Unexpected rotor pivot ${name}: ${p}`);
    return {name,position:p};
  });
  const textures=root.listTextures().map(t=>({name:t.getName(),size:t.getSize(),mimeType:t.getMimeType()}));
  if(textures.some(t=>t.mimeType!=='image/ktx2'||t.size.some(size=>size>1024)))throw new Error('Delivery textures must be KTX2 at most 1024px');
  levels.push({model:lod.model,triangles,primitives:meshes.reduce((sum,m)=>sum+m.listPrimitives().length,0),rotors,textures});
}
writeFileSync('content/review/kestrel/validation.json',JSON.stringify({levels,artisticAcceptance:false,targetHardwareVerified:false},null,2)+'\n');
console.log(JSON.stringify(levels.map(({model,triangles,primitives})=>({model,triangles,primitives}))));
