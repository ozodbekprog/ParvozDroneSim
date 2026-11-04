// Adapt recovered textures for browser PBR. Original files remain in ignored data/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import {profile,recoveryFolder} from './content-import-profile.js';
import {adaptMaterials} from './import-material-adapters.js';
const folder=recoveryFolder;
const resourceName=process.argv.find(v=>v.startsWith('--resources='))?.slice(12)||'resources.json';
const resources=JSON.parse(readFileSync(folder+resourceName,'utf8'));
if (!resources.textures?.length) throw new Error('Recover source textures first.');
const subfolder=resourceName==='resources.json'?'browser-textures/':'browser-track-textures/';
const output=folder+subfolder;mkdirSync(output,{recursive:true});
const maximum=Number(process.argv.find(v=>v.startsWith('--size='))?.slice(7)||profile.textureSize);
const prepared=new Map(),report=[];
const propsFor=m=>JSON.parse(readFileSync(folder+m.file,'utf8')).m_SavedProperties;
for(const source of resources.textures){
  if(source.hdr)continue;
  const file=subfolder+source.file.split('/').at(-1);
  const metadata=await sharp(folder+source.file).metadata();
  await sharp(folder+source.file).resize({width:maximum,height:maximum,fit:'inside',withoutEnlargement:true}).png().toFile(folder+file);
  const result=await sharp(folder+file).metadata();
  prepared.set(source.key,{...source,file});
  report.push({name:source.name,width:result.width,height:result.height,sourceWidth:metadata.width,sourceHeight:metadata.height,
    bytesWithMipmaps:Math.ceil(result.width*result.height*4*4/3)});
}
// Unity Standard stores metalness in R and smoothness in A. glTF uses B and G.
for(const material of resources.materials){
  const key=material.textures?._MetallicGlossMap;
  if(!key)continue;
  const source=prepared.get(key),props=JSON.parse(readFileSync(folder+material.file,'utf8')).m_SavedProperties;
  const gain=props.m_Floats?._GlossMapScale??1;
  const {data,info}=await sharp(folder+source.file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let n=0;n<data.length;n+=4){const metallic=data[n],smoothness=data[n+3]/255;data[n]=255;data[n+1]=Math.round(255*(1-Math.min(1,smoothness*gain)));data[n+2]=metallic;data[n+3]=255;}
  const file=subfolder+'metallic-'+resources.materials.indexOf(material)+'.png';
  await sharp(data,{raw:info}).png().toFile(folder+file);
  const identity=key+':metallic:'+gain;
  prepared.set(identity,{...source,key:identity,file});material.textures._MetallicRoughnessMap=identity;
  delete material.textures._MetallicGlossMap;
  report.push({name:material.name+' metallic/roughness',width:info.width,height:info.height,bytesWithMipmaps:Math.ceil(info.width*info.height*4*4/3)});
}
await adaptMaterials({resources,prepared,folder,subfolder,propsFor,report});
// Bake Unity detail layers into ordinary glTF textures, keeping UV0 tiling.
const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
const srgb=c=>c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;
for(const [index,material] of resources.materials.entries()){
  const props=propsFor(material);
  props.m_TexEnvs={...props.m_TexEnvs,...material.textureEnvironments};
  const detail=material.textures?._DetailAlbedoMap,detailNormal=material.textures?._DetailNormalMap;
  if(!detail&&!detailNormal)continue;
  if((props.m_Floats?._UVSec??0)!==0)throw new Error('Detail UV1 requires mesh-specific baking: '+material.name);
  const detailEnv=props.m_TexEnvs._DetailAlbedoMap||props.m_TexEnvs._DetailNormalMap,baseEnv=props.m_TexEnvs._MainTex||{};
  const bake=async(slot,detailKey,normal)=>{
    if(!detailKey)return;
    let base=prepared.get(material.textures[slot]);const layer=prepared.get(detailKey);if(!layer)throw new Error('Missing detail texture');
    if(!base){
      // Unity Standard samples white albedo / a flat normal when the base
      // texture slot is empty. Detail-only materials must retain that detail.
      const size=await sharp(folder+layer.file).metadata(),file=subfolder+'detail-neutral-'+index+'-'+slot+'.png';
      await sharp({create:{width:size.width,height:size.height,channels:4,background:{r:normal?128:255,g:normal?128:255,b:255,alpha:1}}}).png().toFile(folder+file);
      base={key:material.key+':neutral:'+slot,file};
    }
    const a=await sharp(folder+base.file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(folder+layer.file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const mask=material.textures._DetailMask?await sharp(folder+prepared.get(material.textures._DetailMask).file).ensureAlpha().raw().toBuffer({resolveWithObject:true}):null;
    const maskEnv=props.m_TexEnvs._DetailMask||{},msx=(maskEnv.m_Scale?.m_X||1)/(baseEnv.m_Scale?.m_X||1),msy=(maskEnv.m_Scale?.m_Y||1)/(baseEnv.m_Scale?.m_Y||1),mdx=(maskEnv.m_Offset?.m_X||0)-(baseEnv.m_Offset?.m_X||0)*msx,mdy=(maskEnv.m_Offset?.m_Y||0)-(baseEnv.m_Offset?.m_Y||0)*msy;
    const sx=(detailEnv.m_Scale.m_X||1)/(baseEnv.m_Scale?.m_X||1),sy=(detailEnv.m_Scale.m_Y||1)/(baseEnv.m_Scale?.m_Y||1);
    const dx=(detailEnv.m_Offset.m_X||0)-(baseEnv.m_Offset?.m_X||0)*sx,dy=(detailEnv.m_Offset.m_Y||0)-(baseEnv.m_Offset?.m_Y||0)*sy;
    for(let y=0;y<a.info.height;y++)for(let x=0;x<a.info.width;x++){
      const i=(y*a.info.width+x)*4,u=(x+.5)/a.info.width*sx+dx,v=1-(y+.5)/a.info.height;
      const tx=((u%1+1)%1*b.info.width)|0,ty=(((1-((v*sy+dy)%1+1)%1)%1)*b.info.height)|0,j=(ty*b.info.width+tx)*4;
      const mx=((((x+.5)/a.info.width*msx+mdx)%1+1)%1*(mask?.info.width||1))|0,my=(((1-((v*msy+mdy)%1+1)%1)%1)*(mask?.info.height||1))|0,maskWeight=mask?mask.data[(my*mask.info.width+mx)*4+3]/255:1;
      if(normal){
        const gain=(props.m_Floats?._DetailNormalMapScale??1)*maskWeight;
        let nx=(a.data[i]/127.5-1)+(b.data[j]/127.5-1)*gain,ny=(a.data[i+1]/127.5-1)+(b.data[j+1]/127.5-1)*gain,nz=(a.data[i+2]/127.5-1)*(b.data[j+2]/127.5-1),length=Math.hypot(nx,ny,nz)||1;
        for(const [channel,n] of [nx,ny,nz].entries())a.data[i+channel]=Math.round((n/length*.5+.5)*255);
      }else for(let c=0;c<3;c++){
        const base=linear(a.data[i+c]/255),layer=linear(b.data[j+c]/255),weight=maskWeight*(material.detailBakeMode==='lerp-alpha'?b.data[j+3]/255:1);
        a.data[i+c]=Math.round(Math.min(1,srgb(base*(1-weight)+(material.detailBakeMode==='lerp-alpha'?layer:base*layer*2)*weight))*255);
      }
    }
    const file=subfolder+'detail-baked-'+index+'-'+slot+'.png',key=material.key+':baked:'+slot;
    await sharp(a.data,{raw:a.info}).png().toFile(folder+file);prepared.set(key,{...base,key,file});material.textures[slot]=key;
  };
  await bake('_MainTex',detail,false);await bake('_BumpMap',detailNormal,true);
  material.bakedDetailSlots=['_DetailAlbedoMap','_DetailNormalMap'].filter(s=>material.textures[s]);
  if(material.textures._DetailMask)material.bakedDetailSlots.push('_DetailMask');
  delete material.textures._DetailAlbedoMap;delete material.textures._DetailNormalMap;
}
for(const material of resources.materials)if(material.textures._DetailMask&&!material.bakedDetailSlots?.includes('_DetailMask')){material.ignoredShaderSlots||={};material.ignoredShaderSlots._DetailMask='No active detail layer uses this mask';}
// HDR lightmaps are read only during Blender assembly, not delivered to browsers.
resources.textures=[...prepared.values(),...resources.textures.filter(t=>t.hdr)];
writeFileSync(folder+(resourceName==='resources.json'?'browser-resources.json':'browser-track-resources.json'),JSON.stringify(resources,null,2));
const bytes=report.reduce((sum,t)=>sum+t.bytesWithMipmaps,0);
writeFileSync(folder+(resourceName==='resources.json'?'texture-report.json':'track-texture-report.json'),JSON.stringify({maximum,rgbaBytesWithMipmaps:bytes,textures:report},null,2));
// This is the size of preparation PNGs if uploaded without GPU compression.
// Final KTX2 residency is measured separately, including the selected LODs.
if(bytes>(profile.sourceTextureBudgetMiB||256)*1024*1024)throw new Error('Source texture preparation budget exceeded: '+bytes);
console.log({textures:report.length,rgbaMiBWithMipmaps:bytes/1024/1024});
