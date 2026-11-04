import { Box3, Sphere } from 'three';

/** Inspection needs the close model, not three simultaneous flight LOD deliveries. */
export function inspectionBuild(build){
  const close=definition=>definition.modelLods?.length?{...definition,...definition.modelLods[0],modelLods:undefined}:definition;
  return {...close(build),visualParts:build.visualParts?.map(close),visualDetails:build.visualDetails&&close(build.visualDetails),accessories:build.accessories&&Object.fromEntries(Object.entries(build.accessories).map(([key,value])=>[key,close(value)]))};
}
export const previewFrameKey=build=>JSON.stringify([build.drone,build.model,build.modelNode,build.modelTransform,build.mounts,build.partBindings,build.motorBindings,build.customization]);

/** Hidden default parts and inactive LODs must not change the inspection camera. */
export function visibleModelBounds(root) {
  root.updateWorldMatrix(true, true);
  const bounds=new Box3();
  root.traverseVisible(object=>{
    if(!object.geometry)return;
    object.geometry.computeBoundingBox();
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return bounds;
}

export function previewSphere(root) {
  const bounds=visibleModelBounds(root);
  return bounds.isEmpty() ? null : bounds.getBoundingSphere(new Sphere());
}

export function previewGeometryPoints(root) {
  root.updateWorldMatrix(true,true);
  const points=[];
  root.traverseVisible(object=>{
    const positions=object.geometry?.attributes.position;if(!positions)return;
    const e=object.matrixWorld.elements;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      points.push(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]);
    }
  });
  return new Float32Array(points);
}

/** Keep the last completed preview while a replacement is downloading. */
export class PreviewRequest {
  sequence=0;
  async run(load, commit, discard) {
    this.controller?.abort();
    const controller=this.controller=new AbortController();
    const sequence=++this.sequence;
    let value;
    try { value=await load(controller.signal); } catch(error) { if(sequence!==this.sequence)return false; throw error; }
    finally {if(this.controller===controller)this.controller=null;}
    if(sequence!==this.sequence) { discard(value); return false; }
    commit(value); return true;
  }
  cancel() { this.sequence++;this.controller?.abort();this.controller=null; }
}
