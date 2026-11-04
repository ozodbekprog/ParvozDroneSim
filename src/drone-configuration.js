import {Matrix4} from 'three';

/** Move retained stock geometry and its socket together before fitting replacements. */
export function applyNativeSlotTransforms(model,build){
  if(!build.customization)return;
  for(const level of model.userData.visualLod?model.children:[model]){
    if(level.userData.nativeSlotsApplied)continue;
    level.updateWorldMatrix(true,true);
    for(const category of ['camera','battery']){
      const matrix=build.customization.slots?.[category]?.[0]?.matrix;
      const mountName=build.mounts?.[category]?.[0],mount=mountName&&level.getObjectByName(mountName);
      if(!matrix||!mount)continue;
      const previous=mount.matrixWorld.clone(),next=level.matrixWorld.clone().multiply(new Matrix4().fromArray(matrix));
      const delta=new Matrix4().multiplyMatrices(next,previous.invert());
      const defaults=[];level.traverse(node=>{if(build.partBindings?.[category]?.includes(node.name))defaults.push(node);});
      // Stock renderers are normally siblings of the mount. Only transform the
      // outermost bound node when a future imported hierarchy nests renderers.
      for(const node of [mount,...defaults].filter(node=>{for(let p=node.parent;p&&p!==level;p=p.parent)if(p===mount||defaults.includes(p))return false;return true;})){
        const local=new Matrix4().copy(node.parent.matrixWorld).invert().multiply(delta).multiply(node.matrixWorld);
        local.decompose(node.position,node.quaternion,node.scale);node.updateMatrix();
      }
      level.updateWorldMatrix(true,true);
    }
    level.userData.nativeSlotsApplied=true;
  }
}

export function clearDroneConfiguration(model){
  model.traverse(node=>{
    if(node.userData.configurationVisibility!==undefined){node.visible=node.userData.configurationVisibility;delete node.userData.configurationVisibility;}
  });
}

/** Apply after replacing hardware; clearing the prior mask must precede replacement. */
export function applyDroneConfiguration(model,build){
  const hidden=new Set(build.customization?.hiddenNodes||[]);
  for(const rule of build.customization?.visibility||[]){
    const matches=Object.entries(rule.when||{}).every(([key,value])=>build[key]===value);
    if(matches)for(const name of rule.hide||[])hidden.add(name);
  }
  model.traverse(node=>{
    if(hidden.has(node.name)){node.userData.configurationVisibility=node.visible;node.visible=false;}
  });
}
