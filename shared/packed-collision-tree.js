import {Box3,Triangle} from 'three';

/** Same median split and stable triangle order as the original collision tree.
 * Float64 preserves authored coordinates and contact results. Buffers can move
 * from a worker without cloning hundreds of thousands of Vector3 objects. */
export function buildPackedCollisionTree(input){
 const vertices=input instanceof Float64Array?input:Float64Array.from(input);
 const indices=Uint32Array.from({length:vertices.length/9},(_,i)=>i);
 const bounds=[],nodes=[];
 const build=(start,end)=>{
  const node=nodes.length/4;nodes.push(-1,-1,start,end-start);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=start;i<end;i++)for(let vertex=0;vertex<3;vertex++)for(let axis=0;axis<3;axis++){
   const value=vertices[indices[i]*9+vertex*3+axis];min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);
  }
  bounds.push(...min,...max);
  if(end-start>16){
   const size=max.map((value,axis)=>value-min[axis]);
   const axis=size[0]>size[1]&&size[0]>size[2]?0:size[1]>size[2]?1:2;
   indices.subarray(start,end).sort((a,b)=>{
    a=a*9+axis;b=b*9+axis;
    return (vertices[a]+vertices[a+3]+vertices[a+6])-(vertices[b]+vertices[b+3]+vertices[b+6]);
   });
   const middle=start+((end-start)>>1);
   nodes[node*4]=build(start,middle);nodes[node*4+1]=build(middle,end);nodes[node*4+3]=0;
  }
  return node;
 };
 build(0,indices.length);
 return {vertices,indices,bounds:Float64Array.from(bounds),nodes:Int32Array.from(nodes)};
}

const boundsScratch=new Box3(),triangleScratch=new Triangle();
/** Callbacks must consume the scratch values synchronously, without retaining them. */
export function visitPackedCollisionTree(tree,intersects,visit){
 const {vertices,indices,bounds,nodes}=tree;
 const walk=node=>{
  boundsScratch.min.fromArray(bounds,node*6);boundsScratch.max.fromArray(bounds,node*6+3);
  if(!intersects(boundsScratch))return;
  const offset=node*4,left=nodes[offset];
  if(left>=0){walk(left);walk(nodes[offset+1]);return;}
  const end=nodes[offset+2]+nodes[offset+3];
  for(let i=nodes[offset+2];i<end;i++){
   const base=indices[i]*9;
   triangleScratch.a.fromArray(vertices,base);triangleScratch.b.fromArray(vertices,base+3);triangleScratch.c.fromArray(vertices,base+6);
   visit(triangleScratch);
  }
 };
 walk(0);
}

let intersectStack=new Int32Array(64);
export function packedTreeIntersectsSphere(tree,cx,cy,cz,radius){
 const {bounds,nodes}=tree;
 if(!nodes.length)return false;
 const r=radius+1e-4,r2=r*r;
 let sp=1;intersectStack[0]=0;
 while(sp>0){
  const node=intersectStack[--sp],b=node*6;
  const dx=Math.max(bounds[b]-cx,0,cx-bounds[b+3]);
  const dy=Math.max(bounds[b+1]-cy,0,cy-bounds[b+4]);
  const dz=Math.max(bounds[b+2]-cz,0,cz-bounds[b+5]);
  if(dx*dx+dy*dy+dz*dz>r2)continue;
  const offset=node*4,left=nodes[offset];
  if(left>=0){
   if(sp+2>intersectStack.length){const grown=new Int32Array(intersectStack.length*2);grown.set(intersectStack);intersectStack=grown;}
   intersectStack[sp++]=nodes[offset+1];intersectStack[sp++]=left;
  }else if(nodes[offset+3]>0)return true;
 }
 return false;
}
