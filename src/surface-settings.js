import {Source,LinearFilter,LinearMipmapLinearFilter,LinearMipmapNearestFilter} from 'three';
import {materialResources,materialTextures} from './material-resources.js';
const sources=new WeakMap(),normals=new WeakMap(),nativeFiltering=new WeakMap();
export function rendererTextureAnisotropy(renderer){return renderer?.getMaxAnisotropy?.()??renderer?.capabilities?.getMaxAnisotropy?.()??1;}
export function resizeMaterialTexture(texture,maximum){
  if(texture.isRenderTargetTexture||texture.isCubeTexture)return;
  let original=sources.get(texture);
  if(!original){if(!texture.image?.width||!texture.image?.height)return;original={source:texture.source,mipmaps:texture.mipmaps,width:texture.image.width,height:texture.image.height,maximum:0};sources.set(texture,original);}
  const cap=maximum>0?Math.min(maximum,Math.max(original.width,original.height)):0;
  if(original.maximum===cap)return;
  let source=original.source,mips=original.mipmaps;
  if(cap&&Math.max(original.width,original.height)>cap){
    if((texture.isCompressedTexture||texture.isDataTexture)&&mips?.length){
      const index=mips.findIndex(m=>Math.max(m.width,m.height)<=cap);
      if(index<0)return;
      mips=mips.slice(index);source=new Source({...original.source.data,width:mips[0].width,height:mips[0].height,data:mips[0].data});
    }else if(!texture.isDataTexture){
      const canvas=document.createElement('canvas'),ratio=cap/Math.max(original.width,original.height);
      canvas.width=Math.max(1,Math.round(original.width*ratio));canvas.height=Math.max(1,Math.round(original.height*ratio));
      canvas.getContext('2d').drawImage(original.source.data,0,0,canvas.width,canvas.height);source=new Source(canvas);
    }else return;
  }
  // Release the old GPU allocation while retaining full CPU data for quality increases.
  texture.dispose();texture.source=source;texture.mipmaps=mips;texture.needsUpdate=true;original.maximum=cap;
}
export function applySurfaceSettings(root,settings,maximumAnisotropy=16){
  const textures=new Set(),unscaled=new Set(),materials=new Set();
  root.traverse(object=>{
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(!material)continue;
      if(materials.has(material))continue;materials.add(material);
      const resources=materialResources(material);resources?.applySettings?.(settings);
      for(const texture of resources?.unscaled||[])unscaled.add(texture);
      if(!normals.has(material))normals.set(material,material.normalMap||null);
      const next=settings.normalMaps===false?null:normals.get(material);
      if(material.normalMap!==next){material.normalMap=next;material.needsUpdate=true;}
      for(const value of materialTextures(material))textures.add(value);
    }
  });
  for(const texture of textures){
    resizeMaterialTexture(texture,unscaled.has(texture)?0:settings.textureSize||0);
    if(texture.isRenderTargetTexture||texture.isCubeTexture||texture.magFilter!==LinearFilter||(texture.minFilter!==LinearMipmapLinearFilter&&texture.minFilter!==LinearMipmapNearestFilter))continue;
    if(!nativeFiltering.has(texture))nativeFiltering.set(texture,texture.anisotropy);
    const next=Math.min(Math.max(1,Math.min(16,Number(maximumAnisotropy)||1)),Math.max(nativeFiltering.get(texture),Number(settings.anisotropy)||1));
    if(texture.anisotropy!==next){texture.anisotropy=next;texture.needsUpdate=true;}
  }
}
