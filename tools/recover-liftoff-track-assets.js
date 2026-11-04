import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {profile,recoveryFolder} from './content-import-profile.js';
import {RipperClient,assetKey} from './assetripper-client.js';
const folder=recoveryFolder,config=JSON.parse(readFileSync(folder+'gate-prefab-config.json','utf8')),client=new RipperClient();
const materials=new Map(),meshes=new Map(),textures=new Map();
const shaderNames=new Map();
// The scene recovery already resolved common shader IDs. Reuse its canonical
// names: compiled shader JSON can contain hundreds of megabytes of bytecode.
const knownShaderNames=new Map();
if(existsSync(folder+'resources.json'))for(const m of JSON.parse(readFileSync(folder+'resources.json')).materials){
  if(!m.shader||/^[a-f0-9]{32}$/.test(m.shader))continue;
  const id=String(JSON.parse(readFileSync(folder+m.file)).m_Shader?.m_PathID||0);
  if(id!=='0')knownShaderNames.set(id,m.shader);
}
const fileName=(key,kind,ext)=>'track-assets/'+kind+'-'+createHash('sha256').update(key).digest('hex').slice(0,16)+'.'+ext;
mkdirSync(folder+'track-assets',{recursive:true});
for(const r of Object.values(config.records)){
  if(r.type==='MonoBehaviour'&&r.data.m_Structure?.ribbonMaterial){const p=await client.pointer(r.collection,r.data.m_Structure.ribbonMaterial);if(p)materials.set(p.key,p);}
  if(r.type==='MeshFilter'||r.type==='MeshCollider'||r.type==='SkinnedMeshRenderer'){const p=await client.pointer(r.collection,r.data.m_Mesh);if(p)meshes.set(p.key,p);}
  if(r.type==='MeshRenderer'||r.type==='SkinnedMeshRenderer')for(const ref of r.data.m_Materials||[]){const p=await client.pointer(r.collection,ref);if(p)materials.set(p.key,p);}
}
const result={materials:[],meshes:[],textures:[],collectionDependencies:{}};
for(const p of materials.values()){
  const data=await client.json(p),file=fileName(p.key,'material','json');writeFileSync(folder+file,JSON.stringify(data));
  const slots={};
  for(const [slot,env] of Object.entries(data.m_SavedProperties?.m_TexEnvs||{})){
    if(!['_MainTex','_BaseMap','_BumpMap','_MetallicGlossMap','_SpecGlossMap','_EmissionMap','_OcclusionMap','_DetailAlbedoMap','_DetailNormalMap','_DetailMask'].includes(slot))continue;
    const ref=await client.pointer(p.collection,env.m_Texture);if(ref){textures.set(ref.key,ref);slots[slot]=ref.key;}
  }
  const shaderPointer=await client.pointer(p.collection,data.m_Shader);
  if(shaderPointer&&!shaderNames.has(shaderPointer.key)){
    if(knownShaderNames.has(shaderPointer.id))shaderNames.set(shaderPointer.key,knownShaderNames.get(shaderPointer.id));
    else {const shaderData=await client.json(shaderPointer);shaderNames.set(shaderPointer.key,shaderData?.m_ParsedForm?.m_Name||shaderData?.m_Name||'unknown');}
  }
  const shader=shaderPointer?shaderNames.get(shaderPointer.key):'unknown';
  result.materials.push({...p,file,name:data.m_Name,shader,textures:slots});
}
for(const p of meshes.values()){
  const file=fileName(p.key,'mesh','glb');if(!existsSync(folder+file)){const bytes=Buffer.from(await(await client.get(client.url(p,'Model.glb'))).arrayBuffer());if(bytes.toString('ascii',0,4)!=='glTF')throw new Error('Invalid source mesh '+p.key);writeFileSync(folder+file,bytes);}
  result.meshes.push({...p,file});
}
for(const p of textures.values()){
  const file=fileName(p.key,'texture','png');if(!existsSync(folder+file))writeFileSync(folder+file,Buffer.from(await(await client.get(client.url(p,'Image')+'&Extension=png')).arrayBuffer()));
  const data=await client.json(p);result.textures.push({...p,file,name:data.m_Name,width:data.m_Width,height:data.m_Height});
}
for(const [key,value] of client.collections)result.collectionDependencies[key]=value.dependencies;
writeFileSync(folder+'track-resources.json',JSON.stringify(result,null,2));
console.log({meshes:meshes.size,materials:materials.size,textures:textures.size});
