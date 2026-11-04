import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const definition=JSON.parse(readFileSync('content/drones/kestrel/drone.json'));
const limits=[[25000,40000],[8000,12000],[1000,3000]],levels=[];
const count=node=>{let n=0;const visit=o=>{for(const p of o.getMesh()?.listPrimitives()||[])n+=(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3;for(const c of o.listChildren())visit(c);};visit(node);return n;};
for(const [index,level] of definition.modelLods.entries()){
  const root=(await io.read(resolve('content/drones/kestrel',level.model))).getRoot(),scene=root.getDefaultScene();
  const triangles=scene.listChildren().reduce((n,c)=>n+count(c),0);
  assert.ok(triangles>=limits[index][0]&&triangles<=limits[index][1],`LOD ${index}: ${triangles} triangles`);
  const named=name=>{const entries=root.listNodes().filter(n=>n.getName()===name);assert.equal(entries.length,1,name);return entries[0];};
  for(const names of Object.values(definition.mounts))for(const name of names)named(name);
  for(const names of Object.values(definition.partBindings))for(const name of names)named(name);
  const rotors=definition.motorBindings.map((name,i)=>{const node=named(name),p=node.getWorldTranslation(),mount=named('Mount_propellers_'+i);assert.ok(Math.hypot(p[0],p[2])>.10&&Math.hypot(p[0],p[2])<.13);assert.ok(Math.abs(p[1])<.025);assert.deepEqual(mount.getWorldTranslation(),p);assert.ok(!mount.getParentNode()?.getName().startsWith('Rotor_'));assert.ok(node.listChildren().some(c=>count(c)>0));return {name,position:p};});
  for(const category of Object.keys(definition.mounts))for(const variant of ['SCOUT','HUNTER'])assert.ok(count(named(`Template_Part_${category}_${variant}`))>0);
  for(const names of Object.values(definition.colorBindings))for(const name of names)named(name);
  const textures=root.listTextures().map(t=>({name:t.getName(),size:t.getSize(),mimeType:t.getMimeType()}));
  assert.ok(textures.every(t=>t.mimeType==='image/ktx2'&&t.size.every(v=>v<=1024)));
  assert.ok(root.listMaterials().every(m=>m.getAlphaMode()!=='BLEND'),'No accidental blended carbon plates');
  levels.push({model:level.model,assembledTriangles:triangles,rotors,textures});
}
writeFileSync('content/drones/kestrel/validation.json',JSON.stringify({levels,artisticAcceptance:false,targetHardwareVerified:false,notes:'Template scene excluded from assembled triangle counts; finish variants share shapes except propellers.'},null,2)+'\n');
console.log(JSON.stringify(levels.map(({model,assembledTriangles})=>({model,assembledTriangles}))));
