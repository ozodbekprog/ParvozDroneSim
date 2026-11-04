import {Box3,Matrix4,Vector3,Quaternion,Euler} from 'three';

/** Bounds in the same placement space as recipes.addVisualModel. Includes
 * quantized positions, hierarchy transforms and every GPU instance. */
export function placedNodeBounds(root,placement={},lod=false){
 const result=new Box3(),bounds=new WeakMap();
 const position=new Vector3().fromArray(placement.position||[0,0,0]);
 const rotation=new Quaternion().setFromEuler(new Euler(...(placement.rotation||[0,0,0])));
 const parent=new Matrix4().compose(position,rotation,new Vector3().setScalar(placement.scale||1));
 const walk=(node,matrix,isRoot=false)=>{
  const world=matrix.clone();if(!isRoot||lod)world.multiply(new Matrix4().fromArray(node.getMatrix()));
  const instances=node.getExtension('EXT_mesh_gpu_instancing');
  for(const primitive of node.getMesh()?.listPrimitives()||[]){
   const attribute=primitive.getAttribute('POSITION');if(!attribute)continue;
   if(!bounds.has(attribute))bounds.set(attribute,new Box3(new Vector3().fromArray(attribute.getMinNormalized([])),new Vector3().fromArray(attribute.getMaxNormalized([]))));
   const box=bounds.get(attribute);
   if(instances){
    const count=instances.getAttribute(instances.listSemantics()[0]).getCount();
    for(let i=0;i<count;i++){
     const t=instances.getAttribute('TRANSLATION')?.getElement(i,[])||[0,0,0];
     const r=instances.getAttribute('ROTATION')?.getElement(i,[])||[0,0,0,1];
     const s=instances.getAttribute('SCALE')?.getElement(i,[])||[1,1,1];
     const transform=new Matrix4().compose(new Vector3().fromArray(t),new Quaternion().fromArray(r),new Vector3().fromArray(s));
     result.union(box.clone().applyMatrix4(world.clone().multiply(transform)));
    }
   }else result.union(box.clone().applyMatrix4(world));
  }
  for(const child of node.listChildren())walk(child,world);
 };
 walk(root,parent,true);
 return result.isEmpty()?null:{min:result.min.toArray(),max:result.max.toArray()};
}

export function combineDeliveryBounds(items){
 const combined=new Box3();
 for(const item of items)if(item)combined.union(new Box3(new Vector3().fromArray(item.min),new Vector3().fromArray(item.max)));
 return combined.isEmpty()?null:{min:combined.min.toArray(),max:combined.max.toArray()};
}
