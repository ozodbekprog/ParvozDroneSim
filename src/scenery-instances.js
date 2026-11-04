import {InstancedMesh,Color,Matrix4,Frustum,Sphere,Vector3,DynamicDrawUsage} from 'three';

const descriptions=new WeakMap();
const attributeIds=new WeakMap();let nextAttributeId=0;
const attributeId=attribute=>{if(!attribute)return 0;if(!attributeIds.has(attribute))attributeIds.set(attribute,++nextAttributeId);return attributeIds.get(attribute);};
/** Attribute identity, not BufferGeometry wrapper identity. Interleaved
 * attributes have no .id; object identities must remain distinct as well. */
export function sceneryGeometryIdentity(geometry,{ignoreColor=false}={}){
 return JSON.stringify([attributeId(geometry.index),Object.entries(geometry.attributes).filter(([name])=>!ignoreColor||name!=='color').sort().map(([name,a])=>[name,attributeId(a)])]);
}
/** glTF accessors are shared between otherwise identical terrain tree meshes.
 * A uniform opaque color is exactly representable as an instance tint. Keep
 * spatial vertex paint and alpha intact; never approximate either for merging. */
export function instanceDescription(geometry){
 if(descriptions.has(geometry))return descriptions.get(geometry);
 const attribute=geometry.getAttribute('color');let tint=null;
 if(attribute&&(attribute.itemSize===3||attribute.itemSize===4)){
  const values=[attribute.getX(0),attribute.getY(0),attribute.getZ(0)];let uniform=attribute.itemSize===3||attribute.getW(0)===1;
  for(let i=1;uniform&&i<attribute.count;i++)uniform=attribute.getX(i)===values[0]&&attribute.getY(i)===values[1]&&attribute.getZ(i)===values[2]&&(attribute.itemSize===3||attribute.getW(i)===1);
  if(uniform)tint=new Color(...values);
 }
 const key=sceneryGeometryIdentity(geometry,{ignoreColor:!!tint});
 const result={key,tint};descriptions.set(geometry,result);return result;
}

/** A real instanced draw. Compact only instance transforms/colors,
 * keeping the same per-object frustum culling and LOD flags as BatchedMesh. */
export class SceneryInstances extends InstancedMesh{
 constructor(geometry,material,capacity){
  super(geometry,material,capacity);
  this.sourceMatrices=this.instanceMatrix.array.slice();this.sourceColors=new Float32Array(capacity*3).fill(1);
  this.enabled=new Uint8Array(capacity).fill(1);this.capacity=capacity;this.packed=[];
  this.sourceSpheres=new Float64Array(capacity*4);this.boundsDirty=true;
  this.instanceMatrix.setUsage(DynamicDrawUsage);
  for(let i=0;i<capacity;i++)super.setColorAt(i,new Color(1,1,1));
  this.instanceColor.setUsage(DynamicDrawUsage);
  this.frustum=new Frustum();this.sphere=new Sphere();this.instanceTransform=new Matrix4();this.projection=new Matrix4();this.lastProjection=new Matrix4();this.localCameraPos=new Vector3();this.inverseWorld=new Matrix4();this.visibilityDirty=true;this.prepared=false;
 }
 setMatrixAt(id,matrix){super.setMatrixAt(id,matrix);if(this.sourceMatrices){matrix.toArray(this.sourceMatrices,id*16);this.boundsDirty=true;this.visibilityDirty=true;this.packed.length=0;this.boundingBox=null;this.boundingSphere=null;}}
 getMatrixAt(id,matrix){return matrix.fromArray(this.sourceMatrices||this.instanceMatrix.array,id*16);}
 setColorAt(id,color){super.setColorAt(id,color);if(this.sourceColors){color.toArray(this.sourceColors,id*3);this.visibilityDirty=true;this.packed.length=0;}}
 getColorAt(id,color){return color.fromArray(this.sourceColors||this.instanceColor.array,id*3);}
 computeBoundingBox(){const count=this.count;this.count=this.capacity??count;super.computeBoundingBox();this.count=count;}
 computeBoundingSphere(){const count=this.count;this.count=this.capacity??count;super.computeBoundingSphere();this.count=count;}
 getVisibleAt(id){return this.enabled[id]===1;}
 setVisibleAt(id,visible){const next=visible?1:0;if(this.enabled[id]!==next){this.enabled[id]=next;this.visibilityDirty=true;}}
 onBeforeRender(renderer,scene,camera){
  const frustum=this.frustum,sphere=this.sphere,matrix=this.instanceTransform;
  this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(this.matrixWorld);
  if(this.prepared&&!this.visibilityDirty&&this.lastProjection.equals(this.projection))return;
  this.lastProjection.copy(this.projection);this.visibilityDirty=false;this.prepared=true;
  frustum.setFromProjectionMatrix(this.projection,camera.coordinateSystem,camera.reversedDepth);
  if(!this.geometry.boundingSphere)this.geometry.computeBoundingSphere();
  // Static placements need one sphere transform, not one on every camera tick.
  if(this.boundsDirty){for(let id=0;id<this.capacity;id++){
   this.getMatrixAt(id,matrix);sphere.copy(this.geometry.boundingSphere).applyMatrix4(matrix);
   sphere.center.toArray(this.sourceSpheres,id*4);this.sourceSpheres[id*4+3]=sphere.radius;
  }this.boundsDirty=false;}
  const me=this.matrixWorld.elements,worldScale=Math.hypot(me[0],me[1],me[2])||1,invScale=1/worldScale;
  const perspective=camera.isPerspectiveCamera===true,orthoShadow=camera.isOrthographicCamera===true;
  const angularFactor=300*Math.max(camera.zoom||1,.5),minCullDist=45*invScale,landmarkRadius=15*invScale,minShadowRadius=.85*invScale;
  let camX=0,camY=0,camZ=0;
  if(perspective){
   this.localCameraPos.setFromMatrixPosition(camera.matrixWorld);
   if(me[0]!==1||me[5]!==1||me[10]!==1||me[12]!==0||me[13]!==0||me[14]!==0)this.localCameraPos.applyMatrix4(this.inverseWorld.copy(this.matrixWorld).invert());
   camX=this.localCameraPos.x;camY=this.localCameraPos.y;camZ=this.localCameraPos.z;
  }
  const spheres=this.sourceSpheres;
  let count=0,changed=false;
  for(let id=0;id<this.capacity;id++)if(this.enabled[id]){
   const base=id*4,radius=spheres[base+3];
   if(orthoShadow&&radius<minShadowRadius)continue;
   const cx=spheres[base],cy=spheres[base+1],cz=spheres[base+2];
   if(perspective&&radius<landmarkRadius){
    const maxDist=Math.max(minCullDist,radius*angularFactor);
    const dx=cx-camX,dy=cy-camY,dz=cz-camZ;
    if(dx*dx+dy*dy+dz*dz>maxDist*maxDist)continue;
   }
   sphere.center.set(cx,cy,cz);sphere.radius=radius;
   if(!frustum.intersectsSphere(sphere))continue;
   if(this.packed[count]!==id){
    changed=true;this.packed[count]=id;
    this.instanceMatrix.array.set(this.sourceMatrices.subarray(id*16,id*16+16),count*16);
    this.instanceColor.array.set(this.sourceColors.subarray(id*3,id*3+3),count*3);
   }
   count++;
  }
  this.count=count;this.packed.length=count;
  if(changed){
   this.instanceMatrix.clearUpdateRanges();
   this.instanceColor.clearUpdateRanges();
   if(count>0){
    this.instanceMatrix.addUpdateRange(0,count*16);
    this.instanceColor.addUpdateRange(0,count*3);
   }
   this.instanceMatrix.needsUpdate=true;this.instanceColor.needsUpdate=true;
  }
 }
 onBeforeShadow(renderer,object,camera,shadowCamera){this.onBeforeRender(renderer,null,shadowCamera);}
}
