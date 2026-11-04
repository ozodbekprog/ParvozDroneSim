// Compare delivered PBR bindings with recovered Unity material semantics.
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {neutralMaterialKind} from './parvoz-material-policy.js';
import {profile,recoveryFolder,mapFolder} from './content-import-profile.js';
const resource=process.argv.find(a=>a.startsWith('--resources='))?.slice(12)||'browser-resources.json';
const source=JSON.parse(readFileSync(recoveryFolder+resource,'utf8'));
const file=process.argv.find(a=>a.startsWith('--model='))?.slice(8)||mapFolder+'model.glb';
const bytes=readFileSync(file),gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
const binaryOffset=28+bytes.readUInt32LE(12),hash=value=>createHash('sha256').update(value).digest('hex');
const neutralFabricHash=profile.sceneRepairs?.neutralBranding?hash(readFileSync('content/shared-assets/parvoz-neutral-surfaces/fabric.ktx2')):null;
const failures=[],checked=[],supported=new Set(['_MainTex','_BaseMap','_BumpMap','_MetallicGlossMap','_MetallicRoughnessMap','_EmissionMap','_OcclusionMap']);
for(const material of gltf.materials||[]){
  const original=source.materials.find(m=>m.key===material.extras?.sourceMaterialKey)||source.materials.find(m=>m.name===material.name);if(!original)continue;
  const data=JSON.parse(readFileSync(recoveryFolder+original.file,'utf8')),p=data.m_SavedProperties||{},mode=original.pbrOverrides?.floats?._Mode??p.m_Floats?._Mode??0;
  const pbr=material.pbrMetallicRoughness||{},alpha=original.pbrOverrides?.colors?._Color?.m_A??p.m_Colors?._Color?.m_A??1,errors=[],equivalentBindings=[];
  const neutral=profile.sceneRepairs?.neutralBranding&&material.extras?.parvozBrandingRemoved&&neutralMaterialKind(material.name);
  if(material.extras?.parvozBrandingRemoved&&!neutral)errors.push('unapproved material replacement');
  if(neutral){
    if(material.normalTexture||material.occlusionTexture||material.emissiveTexture||pbr.metallicRoughnessTexture||(material.emissiveFactor||[]).some(v=>v!==0))errors.push('branded auxiliary map retained');
    if(neutral==='cloth'){
      const texture=gltf.textures?.[pbr.baseColorTexture?.index],image=gltf.images?.[texture?.extensions?.KHR_texture_basisu?.source],view=gltf.bufferViews?.[image?.bufferView];
      if(!view||image.mimeType!=='image/ktx2'||hash(bytes.subarray(binaryOffset+(view.byteOffset||0),binaryOffset+(view.byteOffset||0)+view.byteLength))!==neutralFabricHash)errors.push('neutral fabric payload differs from approved project source');
    }else if(pbr.baseColorTexture)errors.push('branded display/plaque image retained');
  }
  if(mode>=2&&(material.alphaMode!=='BLEND'||Math.abs((pbr.baseColorFactor?.[3]??1)-alpha)>.002))errors.push('lost transparent mode/alpha');
  if(mode===1&&material.alphaMode!=='MASK')errors.push('lost alpha cutout');
  for(const [slot,target] of [['_BumpMap',material.normalTexture],['_MetallicRoughnessMap',pbr.metallicRoughnessTexture],['_OcclusionMap',material.occlusionTexture]])if(!neutral&&original.textures?.[slot]&&!target){
    const texture=source.textures.find(t=>t.key===original.textures[slot]);
    const channels=(await sharp(recoveryFolder+texture.file).stats()).channels;
    const uniform=i=>channels[i].min===channels[i].max;
    let equivalent=false;
    if(slot==='_MetallicRoughnessMap')equivalent=uniform(1)&&uniform(2)&&Math.abs((pbr.roughnessFactor??1)-channels[1].min/255)<.002&&Math.abs((pbr.metallicFactor??1)-channels[2].min/255)<.002;
    if(slot==='_BumpMap')equivalent=(p.m_Floats?._BumpScale??1)===0||((p.m_Floats?._BumpScale??1)<=1&&channels.slice(0,2).every(c=>c.min>=126&&c.max<=130)&&channels[2].min>=253);
    if(slot==='_OcclusionMap')equivalent=channels[1].min===255;
    if(equivalent)equivalentBindings.push({slot,reason:slot==='_BumpMap'?'Flat/disabled normal map':'Uniform map folded into equivalent PBR factors',ranges:channels.map(c=>[c.min,c.max])});else errors.push('lost '+slot);
  }
  const unsupported=Object.entries(p.m_TexEnvs||{}).filter(([slot,t])=>!supported.has(slot)&&!original.bakedDetailSlots?.includes(slot)&&!original.adaptedSlots?.includes(slot)&&!original.ignoredShaderSlots?.[slot]&&String(t.m_Texture?.m_PathID||0)!=='0').map(([slot])=>slot);
  const adapter=profile.materialAdapters?.[original.shader];if(!adapter)errors.push('unmapped source shader: '+(original.shader||'unknown'));
  const row={name:material.name,shader:original.shader,adapter,sourceMode:mode,alpha: pbr.baseColorFactor?.[3]??1,normal:!!material.normalTexture,roughness:!!pbr.metallicRoughnessTexture,occlusion:!!material.occlusionTexture,equivalentBindings,neutralReplacement:neutral||undefined,adaptedSlots:original.adaptedSlots,approximations:original.adaptationNotes,ignoredShaderSlots:original.ignoredShaderSlots,unsupported,errors};
  checked.push(row);if(errors.length||unsupported.length)failures.push(row);
}
const used=new Set(checked.map(m=>m.name));
const report={map:profile.id,model:file,checked:checked.length,failures,materials:checked,excludedShaderMaterials:source.materials.filter(m=>!used.has(m.name)&&m.shader!=='Standard').map(m=>({name:m.name,shader:m.shader}))};
const reportFile=process.argv.find(a=>a.startsWith('--report='))?.slice(9)||'material-audit.json';
writeFileSync(recoveryFolder+reportFile,JSON.stringify(report,null,2));
console.log(JSON.stringify({checked:checked.length,failures,normalMaps:checked.filter(m=>m.normal).length,roughnessMaps:checked.filter(m=>m.roughness).length},null,2));
if(failures.length)process.exitCode=1;
