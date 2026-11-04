// Terrain detail patches store one byte per authored density sample and layer.
// Recreate static crossed billboards using the source grass atlas. Unity's
// runtime wind, camera-facing rotation and random scatter are adapted explicitly.
export function terrainDetailCells(data) {
 const d=data.m_DetailDatabase,count=d.m_PatchCount,samples=d.m_PatchSamples;
 if(!d.m_DetailPrototypes?.length)return [];
 if(d.m_DetailScatterMode!==1)throw new Error('Terrain detail coverage mode needs an explicit density adapter');
 if(!Number.isInteger(count)||!Number.isInteger(samples)||d.m_Patches.length!==count*count)throw new Error('Invalid terrain detail patch grid');
 const cells=[];
 for(const [patchIndex,p] of d.m_Patches.entries()){
  const coverage=Buffer.from(p.m_Coverage,'base64'),layers=Buffer.from(p.m_LayerIndices,'base64');
  if(coverage.length!==layers.length*samples*samples)throw new Error('Invalid terrain detail coverage length');
  for(const [l,prototype] of layers.entries()){
   if(!d.m_DetailPrototypes[prototype])throw new Error('Unknown terrain detail prototype');
   for(let z=0;z<samples;z++)for(let x=0;x<samples;x++){
    const density=coverage[l*samples*samples+z*samples+x];
    if(density)cells.push({prototype,density,x:(patchIndex%count)*samples+x,z:Math.floor(patchIndex/count)*samples+z,resolution:count*samples});
   }
  }
 }
 return cells;
}
export function terrainHeight(data,x,z) {
 const m=data.m_Heightmap,n=m.m_Resolution,gx=Math.max(0,Math.min(n-1,x/m.m_Scale.m_X)),gz=Math.max(0,Math.min(n-1,z/m.m_Scale.m_Z)),ix=Math.min(n-2,Math.floor(gx)),iz=Math.min(n-2,Math.floor(gz)),fx=gx-ix,fz=gz-iz;
 const at=(dx,dz)=>m.m_Heights[(iz+dz)*n+ix+dx]/32767*m.m_Scale.m_Y;
 return (at(0,0)*(1-fx)+at(1,0)*fx)*(1-fz)+(at(0,1)*(1-fx)+at(1,1)*fx)*fz;
}
export function terrainDetailMeshes(data,cellSize=64) {
 const groups=new Map(),m=data.m_Heightmap,width=(m.m_Resolution-1)*m.m_Scale.m_X,depth=(m.m_Resolution-1)*m.m_Scale.m_Z;
 let randomState=8137;const random=()=>((randomState=(Math.imul(randomState,1664525)+1013904223)>>>0)/4294967296);
 for(const cell of terrainDetailCells(data)){
  const p=data.m_DetailDatabase.m_DetailPrototypes[cell.prototype];
  if(p.m_UsePrototypeMesh||p.m_RenderMode!==2)throw new Error('Unsupported native terrain detail render mode');
  for(let i=0;i<cell.density;i++){
   const x=(cell.x+random())/cell.resolution*width,z=(cell.z+random())/cell.resolution*depth,y=terrainHeight(data,x,z),w=p.m_MinWidth+(p.m_MaxWidth-p.m_MinWidth)*random(),h=p.m_MinHeight+(p.m_MaxHeight-p.m_MinHeight)*random(),angle=random()*Math.PI;
   const key=cell.prototype+':'+Math.floor(x/cellSize)+':'+Math.floor(z/cellSize);
   if(!groups.has(key))groups.set(key,{key,prototype:cell.prototype,instances:0,positions:[],normals:[],uvs:[],indices:[]});
   const g=groups.get(key);g.instances++;
   for(let plane=0;plane<2;plane++){
    const a=angle+plane*Math.PI/2,dx=Math.cos(a)*w/2,dz=Math.sin(a)*w/2,base=g.positions.length/3;
    g.positions.push(-x-dx,y,z-dz,-x+dx,y,z+dz,-x+dx,y+h,z+dz,-x-dx,y+h,z-dz);
    g.normals.push(0,1,0,0,1,0,0,1,0,0,1,0);g.uvs.push(0,1,1,1,1,0,0,0);g.indices.push(base,base+1,base+2,base,base+2,base+3);
   }
  }
 }
 return [...groups.values()];
}
