// Unity serializes terrain samples as signed shorts, normalized by 32767.
// Reference: AssetRipper.Export.Modules.Models/GlbTerrainBuilder.GetHeights.
export function terrainShape(data) {
  const map=data.m_Heightmap,n=map.m_Resolution||map.m_Width;
  if(!Number.isInteger(n)||n<2||map.m_Heights.length!==n*n)throw new Error('Invalid terrain height grid');
  if(map.m_Holes?.length)throw new Error('Terrain holes need an explicit decoder before import');
  if(!['m_X','m_Y','m_Z'].every(k=>Number.isFinite(map.m_Scale[k])&&map.m_Scale[k]>0))throw new Error('Invalid terrain sample scale');
  return {n,heights:map.m_Heights,scale:map.m_Scale};
}
export function terrainPatch(data,x0,z0,span=32) {
  const {n,heights,scale}=terrainShape(data),x1=Math.min(n-1,x0+span),z1=Math.min(n-1,z0+span),w=x1-x0+1,h=z1-z0+1;
  const positions=new Float32Array(w*h*3),normals=new Float32Array(w*h*3),uvs=new Float32Array(w*h*2),indices=new Uint32Array((w-1)*(h-1)*6);
  const height=(x,z)=>heights[Math.min(n-1,Math.max(0,z))*n+Math.min(n-1,Math.max(0,x))]/32767*scale.m_Y;
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
    const i=(z-z0)*w+x-x0,dx=(height(x+1,z)-height(x-1,z))/((Math.min(n-1,x+1)-Math.max(0,x-1))*scale.m_X),dz=(height(x,z+1)-height(x,z-1))/((Math.min(n-1,z+1)-Math.max(0,z-1))*scale.m_Z),l=Math.hypot(dx,1,dz);
    positions.set([-x*scale.m_X,height(x,z),z*scale.m_Z],i*3);normals.set([dx/l,1/l,-dz/l],i*3);
    uvs.set([(x-x0)/(w-1),1-(z-z0)/(h-1)],i*2);
  }
  let k=0;for(let z=0;z<h-1;z++)for(let x=0;x<w-1;x++){
    const a=z*w+x;indices.set([a,a+1,a+w,a+w,a+1,a+w+1],k);k+=6;
  }
  return {positions,normals,uvs,indices,x0,z0,x1,z1};
}
export function terrainInstancePose(instance,data) {
  const {n,scale}=terrainShape(data),p=instance.m_Position,w=instance.m_WidthScale,h=instance.m_HeightScale,r=instance.m_Rotation;
  if(![p.m_X,p.m_Y,p.m_Z,w,h,r].every(Number.isFinite)||w<=0||h<=0)throw new Error('Invalid authored terrain instance');
  return {position:{m_X:p.m_X*(n-1)*scale.m_X,m_Y:p.m_Y*scale.m_Y,m_Z:p.m_Z*(n-1)*scale.m_Z},rotation:{m_X:0,m_Y:Math.sin(r/2),m_Z:0,m_W:Math.cos(r/2)},scale:{m_X:w,m_Y:h,m_Z:w}};
}
