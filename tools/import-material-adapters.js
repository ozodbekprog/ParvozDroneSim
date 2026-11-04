import sharp from 'sharp';
/** Explicit static PBR adaptations; original material files remain untouched. */
export async function adaptMaterials({resources,prepared,folder,subfolder,propsFor,report}){
  const mark=(m,slot,reason)=>{m.ignoredShaderSlots||={};m.ignoredShaderSlots[slot]=reason;};
  const alias=(m,from,to,p)=>{if(m.textures[from]){m.textures[to]=m.textures[from];m.adaptedSlots||=[];m.adaptedSlots.push(from);m.textureEnvironments||={};m.textureEnvironments[to]=p.m_TexEnvs[from];}};
  const save=async(m,slot,data,info,label)=>{
    const key=m.key+':'+label,file=subfolder+'adapter-'+resources.materials.indexOf(m)+'-'+label+'.png';
    await sharp(data,{raw:info}).png().toFile(folder+file);prepared.set(key,{key,file,name:m.name+' '+label});m.textures[slot]=key;
    report.push({name:m.name+' '+label,width:info.width,height:info.height,bytesWithMipmaps:Math.ceil(info.width*info.height*4*4/3)});
  };
  const pixels=async key=>{const t=prepared.get(key);if(!t)throw new Error('Missing adapter texture '+key);return sharp(folder+t.file).ensureAlpha().raw().toBuffer({resolveWithObject:true});};
  for(const m of resources.materials){
    const p=propsFor(m),f=p.m_Floats||{};m.textures||={};
    if(m.shader==='Horizon[ON]/Horizon[ON] Displacement'||m.shader==='Horizon[ON]/Horizon[ON] TransitionTerrain'){
      alias(m,'_BaseColormap','_MainTex',p);
      if(f._Normalmaps)alias(m,'_BaseNormalmap','_BumpMap',p);else mark(m,'_BaseNormalmap','Source normal-map toggle is disabled');
      if((f._LayerCount||0)!==0||f._Detail||f._Water)throw new Error('Active Horizon blend layers require a mesh-specific bake: '+m.name);
      for(const slot of ['_BlendColorMap1','_BlendColormap2','_BlendColormap3','_BlendNormalmap1','_BlendNormalmap2','_BlendNormalmap3','_DetailColormap','_DetailNormalmap','_MaskRBlend1GBlend2BBlend3AWater','_WaterNormalmap'])mark(m,slot,'Source layer/detail/water toggle is disabled');
      mark(m,'_ParallaxMap','Shader vertex displacement is not reproduced; recovered mesh geometry is retained');
      m.adaptationNotes=['Base terrain color uses authored UVs; source world-space projection and shader displacement are approximated.'];
    }
    if(m.shader==='Grass Surface Shader (no zwrite)'){
      m.pbrOverrides={floats:{_Mode:1,_Cutoff:f._Cutoff??.5}};
      for(const slot of ['_BladesBackTex','_BladesTex','_GlobalColorTex','_NoiseTex','_NoiseTexHash'])mark(m,slot,'Static source mesh and main grass atlas retained; procedural blades, world tint and wind are not reproduced');
      m.adaptationNotes=['Grass uses recovered static geometry and main atlas with alpha cutout; procedural blade generation and wind are not reproduced.'];
    }
    if(m.shader==='GrassRenderDepth'){
      m.pbrOverrides={floats:{_Mode:3},colors:{_Color:{m_R:0,m_G:0,m_B:0,m_A:0}}};
      m.adaptationNotes=['Redundant source depth-only pass becomes transparent; the static alpha-tested grass writes its own depth.'];
    }
    if(m.shader==='Shader Forge/TreeCreatorReplacement'||m.shader==='Shader Forge/TreeCreatorLeavesReplacement'){
      mark(m,'_BumpSpecMap','Packed TreeCreator normal/specular shading is not reproduced; recovered diffuse and mesh normals are retained');
      if(m.shader.includes('Leaves'))m.pbrOverrides={floats:{_Mode:1,_Cutoff:f._Cutoff??.3}};
      m.adaptationNotes=['Static source tree geometry and diffuse retained; packed normal/specular shader and animated wind are not reproduced.'];
    }
    if(m.shader?.startsWith('Hidden/Nature/Tree Creator ')){
      if(m.shader.includes('Leaves'))m.pbrOverrides={floats:{_Mode:1,_Cutoff:f._Cutoff??.5}};
      for(const slot of ['_BumpSpecMap','_TranslucencyMap','_ShadowTex'])mark(m,slot,'Source diffuse atlas and leaf cutout retained; packed normal/specular, translucency and source tree shadow lighting are approximated by static browser PBR');
      m.adaptationNotes=['Static source Tree Creator meshes and atlas retained, including the authored leaf alpha cutoff; packed lighting and animated wind are approximated.'];
    }
    if(m.shader==='AFS/Foliage Shader v4'){
      m.pbrOverrides={floats:{_Mode:1,_Cutoff:f._Cutoff??f._AlphaTestRef??.5}};
      mark(m,'_BumpTransSpecMap','Packed AFS normal/translucency/specular lighting is approximated; source foliage atlas and mesh normals are retained');
      m.adaptationNotes=['Static source fern mesh and alpha-tested atlas retained; packed lighting and animated bending are approximated.'];
    }
    if(m.shader==='Shader Forge/LiftoffFoliageTranslucent'){
      mark(m,'_Noise','Source vertex motion uses noise amplitude/speed; static browser geometry retains diffuse, normal and source alpha mode without animated bending');
      m.adaptationNotes=['Source diffuse, normal and alpha semantics retained; noise-driven motion and custom light transmission are approximated by static browser PBR.'];
    }
    if(m.shader==='4ik0/FakeWindow/FakeWindow'){
      m.adaptationNotes=['Source diffuse and normal retained on the authored mesh; view-dependent fake interior depth/parallax is approximated by static browser PBR.'];
    }
    if(m.shader==='Shader Forge/StandardTriplanarWorldSpaceAO'){
      mark(m,'_Occlusion','Custom source occlusion projection is approximated by browser ambient lighting; source diffuse, normal and metalness/roughness are retained');
      m.adaptationNotes=['Source textures use authored UVs; custom world-space projection and occlusion sampling are approximated by browser PBR and ambient lighting.'];
    }
    if(m.shader==='Shader Forge/VideoWall'){
      alias(m,'_ScreenOverlay','_MainTex',p);
      m.adaptationNotes=['Static source screen overlay retained; runtime video playback is not reproduced.'];
    }
    if(m.shader==='Bakery/Light')m.pbrOverrides={colors:{_EmissionColor:p.m_Colors?._Color||{m_R:1,m_G:1,m_B:1,m_A:1}}};
    if(m.shader==='Nature/SpeedTree'){
      if(m.textures._DetailTex){alias(m,'_DetailTex','_DetailAlbedoMap',p);m.detailBakeMode='lerp-alpha';m.adaptationNotes=['Bark detail baked using UV0; original secondary UV detail and animated wind are approximated.'];}
      if(m.textures._MainTex){const a=await pixels(m.textures._MainTex);if(a.data.some((v,i)=>i%4===3&&v<250))m.pbrOverrides={floats:{_Mode:1}};}
    }
    if(m.shader==='Standard (Specular setup)'&&m.textures._SpecGlossMap){
      const a=await pixels(m.textures._SpecGlossMap),gain=f._GlossMapScale??1;
      for(let i=0;i<a.data.length;i+=4){a.data[i]=255;a.data[i+1]=Math.round(255*(1-Math.min(1,a.data[i+3]/255*gain)));a.data[i+2]=0;a.data[i+3]=255;}
      await save(m,'_MetallicRoughnessMap',a.data,a.info,'specular-roughness');m.adaptedSlots||=[];m.adaptedSlots.push('_SpecGlossMap');
      m.adaptationNotes=['Source gloss alpha retained as roughness; colored specular reflectance approximated by dielectric PBR.'];
    }
    if(m.shader?.startsWith('Shader Forge/WaterShader')){
      if(p.m_Colors?._WaterTint)m.pbrOverrides={colors:{_Color:p.m_Colors._WaterTint}};
      if(m.textures._NormalMap2&&m.textures._BumpMap){
        const a=await pixels(m.textures._BumpMap),b=await sharp(folder+prepared.get(m.textures._NormalMap2).file).resize(a.info.width,a.info.height).ensureAlpha().raw().toBuffer();
        for(let i=0;i<a.data.length;i+=4){const xyz=[0,1,2].map(c=>(a.data[i+c]+b[i+c])/255-1),length=Math.hypot(...xyz)||1;for(let c=0;c<3;c++)a.data[i+c]=Math.round((xyz[c]/length*.5+.5)*255);}
        await save(m,'_BumpMap',a.data,a.info,'water-normal');m.adaptedSlots||=[];m.adaptedSlots.push('_NormalMap2');
      }
      m.adaptationNotes=['Static source water tint and combined normals; scrolling, depth fade and custom reflections are not reproduced.'];
    }
    if(m.shader?.startsWith('Standard')&&m.textures._ParallaxMap){
      const h=await pixels(m.textures._ParallaxMap),base=m.textures._BumpMap?await sharp(folder+prepared.get(m.textures._BumpMap).file).resize(h.info.width,h.info.height).ensureAlpha().raw().toBuffer():null;
      const result=Buffer.alloc(h.data.length),w=h.info.width,height=h.info.height,gain=(f._Parallax??.02)*Math.max(w,height);
      const at=(x,y)=>h.data[((((y+height)%height)*w+(x+w)%w)*4)+1]/255;
      for(let y=0;y<height;y++)for(let x=0;x<w;x++){
        const i=(y*w+x)*4,xyz=[(base?base[i]/127.5-1:0)-(at(x+1,y)-at(x-1,y))*gain,(base?base[i+1]/127.5-1:0)+(at(x,y+1)-at(x,y-1))*gain,base?base[i+2]/127.5-1:1],length=Math.hypot(...xyz)||1;
        for(let c=0;c<3;c++)result[i+c]=Math.round((xyz[c]/length*.5+.5)*255);result[i+3]=255;
      }
      await save(m,'_BumpMap',result,h.info,'height-normal');m.adaptedSlots||=[];m.adaptedSlots.push('_ParallaxMap');
      m.adaptationNotes||=[];m.adaptationNotes.push('Parallax height approximated by a baked micro-normal; view-dependent UV displacement is not reproduced.');
    }
  }
}
