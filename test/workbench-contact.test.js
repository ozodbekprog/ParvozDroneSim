import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';
test('delivered workshop spare parts and tools rest on the authored tabletop',async()=>{
 await MeshoptDecoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}),doc=await io.read('content/shared-assets/liftoff-workbench/delivery.glb');
 const info=JSON.parse(readFileSync('content/shared-assets/liftoff-workbench/workbench.json'));
 for(const contact of info.contacts){
  const nodes=doc.getRoot().listNodes().filter(n=>n.getMesh()&&n.getName().startsWith(contact.part.startsWith('Drone')||contact.part.startsWith('Solder')?contact.part:'Spare '+contact.part+' '));
  assert.ok(nodes.length,'delivered '+contact.part);let bottom=Infinity;
  for(const node of nodes){const matrix=node.getWorldMatrix(),point=[];
   for(const primitive of node.getMesh().listPrimitives()){const position=primitive.getAttribute('POSITION');for(let i=0;i<position.getCount();i++){position.getElement(i,point);bottom=Math.min(bottom,matrix[1]*point[0]+matrix[5]*point[1]+matrix[9]*point[2]+matrix[13]);}}
  }
  assert.ok(Math.abs(bottom-contact.surface)<.002,`${contact.part} gap ${bottom-contact.surface}`);
 }
 assert.equal(info.contacts.length,5);
});
