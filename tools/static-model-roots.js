// glTF Transform's generic instance() places batches at the scene root.
// Restore the named selectors used by independently culled map LOD chunks.
export function restoreStaticModelRoots(document,names) {
  const root=document.getRoot(),scene=root.getDefaultScene()||root.listScenes()[0],owners=new Map();
  for(const name of names){
    const prior=root.listNodes().find(n=>n.getName()===name),wrapper=document.createNode(name);
    if(prior){prior.setName(name+'_contents');for(const s of root.listScenes())s.removeChild(prior);wrapper.addChild(prior);}
    scene.addChild(wrapper);owners.set(name,wrapper);
  }
  for(const node of root.listNodes()){
    if(!node.getExtension('EXT_mesh_gpu_instancing'))continue;
    const match=/^(SiteChunk_\d+_LOD\d|SiteGround)\b/.exec(node.getMesh()?.getName()||'');
    if(!match||!owners.has(match[1]))continue;
    // Instance TRS already contains the original world matrix. The wrapper is
    // identity; preserved non-instanced subtrees retain their own transforms.
    for(const s of root.listScenes())s.removeChild(node);
    owners.get(match[1]).addChild(node);
  }
  for(const [name,node] of owners)if(!node.listChildren().length)throw new Error('Empty static model selector: '+name);
}
