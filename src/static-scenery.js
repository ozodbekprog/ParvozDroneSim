import { Box3, Vector3 } from 'three';

const worldBox = new Box3(), size = new Vector3();

/** Authored map/workshop geometry never moves. Preserve its matrices after loading. */
export function freezeScenery(root){
  root.updateWorldMatrix(true,true);
  const lods=[];
  root.traverse(object=>{
    object.matrixAutoUpdate=false;object.matrixWorldAutoUpdate=false;
    const lod=object.userData.visualLod;
    if(lod){
      const e=object.matrixWorld.elements;
      const staticWorld={x:e[12],y:e[13],z:e[14],bounds:null};
      if(lod.bounds){
        worldBox.min.fromArray(lod.bounds.min);worldBox.max.fromArray(lod.bounds.max);worldBox.applyMatrix4(object.matrixWorld);
        worldBox.getSize(size);
        staticWorld.bounds={minX:worldBox.min.x,minY:worldBox.min.y,minZ:worldBox.min.z,maxX:worldBox.max.x,maxY:worldBox.max.y,maxZ:worldBox.max.z,footprintScale:Math.max(1,Math.max(size.x,size.y,size.z)/32)};
      }
      lod.staticWorld=staticWorld;
      lods.push(object);
    }
  });
  root.userData.staticVisualLods=lods;
  root.userData.staticLodState=null;
  return root;
}
