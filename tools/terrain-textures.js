import sharp from 'sharp';
import {join} from 'node:path';
const cache=new Map();
async function pixels(folder,entry){
 if(!entry)return null;const key=join(folder,entry.file);if(!cache.has(key))cache.set(key,await sharp(key).ensureAlpha().raw().toBuffer({resolveWithObject:true}));return cache.get(key);
}
const wrap=x=>(x%1+1)%1;
function sample(image,u,v,channel,tiled=true){
 if(!image)return channel===2?255:128;
 const {data,info}=image,x=(tiled?wrap(u):Math.max(0,Math.min(1,u)))*(info.width-1),y=(1-(tiled?wrap(v):Math.max(0,Math.min(1,v))))*(info.height-1),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const at=(dx,dy)=>data[(Math.min(info.height-1,iy+dy)*info.width+Math.min(info.width-1,ix+dx))*4+channel];
 return (at(0,0)*(1-fx)+at(1,0)*fx)*(1-fy)+(at(0,1)*(1-fx)+at(1,1)*fx)*fy;
}
const linear=Array.from({length:256},(_,i)=>i/255<=.04045?i/255/12.92:((i/255+.055)/1.055)**2.4);
const srgb=v=>Math.round(Math.max(0,Math.min(1,v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055))*255);
export async function bakeTerrainPatch({folder,layers,alpha,data,patch,size,prefix}){
 const maps=await Promise.all(alpha.map(a=>pixels(folder,a))),source=await Promise.all(layers.map(async layer=>({...layer,color:await pixels(folder,layer.diffuse),normalPixels:await pixels(folder,layer.normal),maskPixels:await pixels(folder,layer.mask)})));
 if(source.some(x=>!x.color))throw new Error('A terrain layer has no recovered diffuse texture');
 const n=data.m_Heightmap.m_Resolution,scale=data.m_Heightmap.m_Scale,color=Buffer.alloc(size*size*4),normal=Buffer.alloc(size*size*4),mr=Buffer.alloc(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const gx=patch.x0+(x+.5)/size*(patch.x1-patch.x0),gz=patch.z0+(1-(y+.5)/size)*(patch.z1-patch.z0),u=gx/(n-1),v=gz/(n-1);
  let weight=0,r=0,g=0,b=0,nx=0,ny=0,nz=0,metal=0,rough=0;
  for(let l=0;l<source.length;l++){
   const w=sample(maps[Math.floor(l/4)],u,v,l%4,false)/255;if(w<.0001)continue;
   const s=source[l],tile=s.data.m_TileSize,offset=s.data.m_TileOffset,tu=(gx*scale.m_X+(offset?.m_X||0))/tile.m_X,tv=(gz*scale.m_Z+(offset?.m_Y||0))/tile.m_Y;
   r+=linear[Math.round(sample(s.color,tu,tv,0))]*w;g+=linear[Math.round(sample(s.color,tu,tv,1))]*w;b+=linear[Math.round(sample(s.color,tu,tv,2))]*w;
   if(s.normalPixels){const gain=s.data.m_NormalScale??1,px=(sample(s.normalPixels,tu,tv,0)/127.5-1)*gain,py=(sample(s.normalPixels,tu,tv,1)/127.5-1)*gain,pz=sample(s.normalPixels,tu,tv,2)/127.5-1;nx+=px*w;ny+=py*w;nz+=pz*w;}else nz+=w;
   metal+=(s.maskPixels?sample(s.maskPixels,tu,tv,0)/255:s.data.m_Metallic||0)*w;
   rough+=(1-(s.maskPixels?sample(s.maskPixels,tu,tv,3)/255:(s.data.m_Smoothness||0)*sample(s.color,tu,tv,3)/255))*w;weight+=w;
  }
  if(weight<.001)throw new Error('Unpainted terrain splat sample at '+gx+','+gz);
  const i=(y*size+x)*4,length=Math.hypot(nx,ny,nz)||1;color.set([srgb(r/weight),srgb(g/weight),srgb(b/weight),255],i);
  normal.set([Math.round((nx/length*.5+.5)*255),Math.round((ny/length*.5+.5)*255),Math.round((nz/length*.5+.5)*255),255],i);
  mr.set([255,Math.round(rough/weight*255),Math.round(metal/weight*255),255],i);
 }
 const result={_MainTex:'terrain/'+prefix+'-color.png',_BumpMap:'terrain/'+prefix+'-normal.png',_MetallicRoughnessMap:'terrain/'+prefix+'-mr.png'};
 for(const [slot,bytes] of [['_MainTex',color],['_BumpMap',normal],['_MetallicRoughnessMap',mr]])await sharp(bytes,{raw:{width:size,height:size,channels:4}}).png().toFile(join(folder,result[slot]));
 return result;
}
