import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
await MeshoptDecoder.ready;
const folder=resolve('content/maps/ironworks-v2'),map=JSON.parse(readFileSync(folder+'/map.json'));
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(folder+'/model.glb'),root=doc.getRoot();
const names=[map.modelNode,...map.objects.flatMap(o=>o.modelLods.map(l=>l.modelNode))];
for(const name of names){const matches=root.listNodes().filter(n=>n.getName()===name);assert.equal(matches.length,1,name);assert.ok(matches[0].listChildren().length,name+' must contain geometry');}
let batches=0;
for(const node of root.listNodes())if(node.getExtension('EXT_mesh_gpu_instancing')){
  const owner=/^(SiteChunk_\d+_LOD\d|SiteGround)\b/.exec(node.getMesh()?.getName()||'')?.[1];
  if(owner){assert.equal(node.getParentNode()?.getName(),owner,'instance must remain inside its LOD chunk');batches++;}
}
const textures=root.listTextures();assert.ok(textures.every(t=>t.getMimeType()==='image/ktx2'&&t.getSize().every(v=>v<=1024)));
const ground=root.listNodes().find(n=>n.getName()===map.modelNode),ys=[];
ground.traverse(node=>{for(const primitive of node.getMesh()?.listPrimitives()||[]){const attr=primitive.getAttribute('POSITION'),m=node.getWorldMatrix(),p=[];for(let i=0;i<attr.getCount();i++){attr.getElement(i,p);ys.push(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13]);}}});
assert.ok(Math.max(...ys)-Math.min(...ys)<.001,'terrain and roads must share one plane without overlapping layers');
const report={siteSizeMetres:map.siteSizeMetres,chunks:map.objects.length,modelSelectors:names.length,instanceBatches:batches,textures:textures.length,groundHeightRange:[Math.min(...ys),Math.max(...ys)],artisticAcceptance:false,targetHardwareVerified:false};
writeFileSync(folder+'/site-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
