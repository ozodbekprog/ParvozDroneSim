import {EXTMeshGPUInstancing} from '@gltf-transform/extensions';

// Instance only leaves sharing a direct parent. Moving batches to the scene
// root would defeat independently selected spatial/LOD roots in imported maps.
export function instanceSiblings(document,{min=2}={}){
  const extension=document.createExtension(EXTMeshGPUInstancing).setRequired(true);let batches=0,instances=0;
  for(const parent of [...document.getRoot().listNodes()]){
    const byMesh=new Map();
    for(const node of parent.listChildren()){
      const mesh=node.getMesh();if(!mesh||node.listChildren().length||node.getSkin()||node.listExtensions().length)continue;
      const group=byMesh.get(mesh)||[];group.push(node);byMesh.set(mesh,group);
    }
    for(const [mesh,nodes] of byMesh){
      if(nodes.length<min)continue;
      const buffer=mesh.listPrimitives()[0].getAttribute('POSITION').getBuffer(),batch=extension.createInstancedMesh();
      for(const [name,type,size,method] of [['TRANSLATION','VEC3',3,'getTranslation'],['ROTATION','VEC4',4,'getRotation'],['SCALE','VEC3',3,'getScale']]){
        const accessor=document.createAccessor().setBuffer(buffer).setType(type).setArray(new Float32Array(nodes.length*size));
        nodes.forEach((node,index)=>accessor.setElement(index,node[method]()));batch.setAttribute(name,accessor);
      }
      const node=document.createNode('Repeated '+mesh.getName()).setMesh(mesh).setExtension('EXT_mesh_gpu_instancing',batch);parent.addChild(node);
      nodes.forEach(node=>node.dispose());batches++;instances+=nodes.length;
    }
  }
  if(!batches)extension.dispose();
  return {batches,instances};
}
