// Recover Unity Terrain data and its authored vegetation before Blender assembly.
// All output is in the selected ignored recovery folder; the installation is read-only.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {Document,NodeIO} from '@gltf-transform/core';
import {profile,recoveryFolder} from './content-import-profile.js';
import {terrainShape,terrainPatch,terrainInstancePose} from './terrain-heightmap.js';
import {bakeTerrainPatch} from './terrain-textures.js';
import {terrainDetailMeshes} from './terrain-details.js';

const folder=recoveryFolder,read=p=>JSON.parse(readFileSync(join(folder,p),'utf8')),write=(p,v)=>writeFileSync(join(folder,p),JSON.stringify(v));
const original=existsSync(join(folder,'resources.before-terrain.json'))?read('resources.before-terrain.json'):read('resources.json');
const resources=structuredClone(original),records=read(original.records),base=profile.assetRipperUrl;
const key=(c,id)=>JSON.stringify(c)+':'+id;
const address=(c,id)=>'{"C":'+JSON.stringify(c)+',"D":'+id+'}';
const parsed=t=>JSON.parse(t.replace(/("m_PathID"\s*:\s*)(-?\d+)/g,'$1"$2"'));
const collectionCache=new Map(),assetCache=new Map();
async function text(url){const r=await fetch(base+url);if(!r.ok)throw new Error('Terrain source HTTP '+r.status+' '+url);return r.text();}
async function collection(c){
 const k=JSON.stringify(c);if(collectionCache.has(k))return collectionCache.get(k);
 const h=await text('/Collections/View?Path='+encodeURIComponent(k)),dependencies={0:c};
 for(const m of h.slice(h.indexOf('<h2>Dependencies')).matchAll(/<tr><td>(\d+)<\/td><td><a href="([^"]+)"/g))dependencies[m[1]]=JSON.parse(decodeURIComponent(m[2].split('Path=')[1]));
 const rows=[...h.matchAll(/<tr data-class="([^"]+)"><td>([^<]+)<\/td><td>[^<]+<\/td><td><a href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map(m=>({type:m[1],id:m[2],name:m[4],collection:c}));
 const value={dependencies,rows};collectionCache.set(k,value);resources.collectionDependencies[k]=dependencies;return value;
}
async function pointer(c,p){if(!p||String(p.m_PathID)==='0')return null;const dep=(await collection(c)).dependencies[p.m_FileID];if(!dep)throw new Error('Missing terrain dependency');return {collection:dep,id:String(p.m_PathID),key:key(dep,p.m_PathID)};}
async function asset(c,id){
 const k=key(c,id);if(assetCache.has(k))return assetCache.get(k);
 const row=(await collection(c)).rows.find(r=>r.id===String(id));if(!row)throw new Error('Missing terrain asset '+k);
 const entry={...row,key:k,data:parsed(await text('/Assets/Json?Path='+encodeURIComponent(address(c,id))))};assetCache.set(k,entry);return entry;
}
async function bytes(c,id,kind,file){
 if(existsSync(join(folder,file)))return;
 const r=await fetch(base+'/Assets/'+kind+'?Path='+encodeURIComponent(address(c,id))+(kind==='Image'?'&Extension=png':''));
 if(!r.ok)throw new Error('Terrain resource '+kind+' HTTP '+r.status);
 const b=Buffer.from(await r.arrayBuffer());if(!b.length||kind==='Model.glb'&&b.toString('ascii',0,4)!=='glTF')throw new Error('Invalid terrain resource '+file);
 writeFileSync(join(folder,file),b);
}
async function texture(p){
 if(!p)return null;let entry=resources.textures.find(t=>t.key===p.key);if(entry)return entry;
 const a=await asset(p.collection,p.id),file='textures/terrain-source-'+resources.textures.length+'.png';
 await bytes(p.collection,p.id,'Image',file);
 entry={...p,name:a.name,file,width:a.data.m_Width,height:a.data.m_Height,format:a.data.m_TextureFormat??a.data.m_Format,colorSpace:a.data.m_ColorSpace,hdr:false};resources.textures.push(entry);return entry;
}
async function mesh(p){
 if(!p||resources.meshes.some(m=>m.key===p.key))return;
 const file='meshes/terrain-source-'+resources.meshes.length+'.glb';await bytes(p.collection,p.id,'Model.glb',file);resources.meshes.push({...p,file});
}
async function material(p){
 if(!p||resources.materials.some(m=>m.key===p.key))return;
 const a=await asset(p.collection,p.id),shaderPointer=await pointer(p.collection,a.data.m_Shader),shader=shaderPointer?await asset(shaderPointer.collection,shaderPointer.id):null;
 const file='materials/terrain-source-'+resources.materials.length+'.json',entry={...p,file,name:a.data.m_Name,shader:shader?.data.m_ParsedForm?.m_Name||shader?.data.m_Name||shader?.name,textures:{}};
 write(file,a.data);
 for(const [slot,env] of Object.entries(a.data.m_SavedProperties?.m_TexEnvs||{})){
  if(!['_MainTex','_BaseMap','_BumpMap','_MetallicGlossMap','_EmissionMap','_OcclusionMap','_DetailAlbedoMap','_DetailNormalMap','_DetailMask'].includes(slot))continue;
  const t=await texture(await pointer(p.collection,env.m_Texture));if(t)entry.textures[slot]=t.key;
 }
 resources.materials.push(entry);
}
const scene=resources.scene,sceneDeps=structuredClone(resources.collectionDependencies[JSON.stringify(scene)]);
function scenePointer(p){
 if(!p)return {m_FileID:0,m_PathID:'0'};
 let id=Object.keys(sceneDeps).find(i=>JSON.stringify(sceneDeps[i])===JSON.stringify(p.collection));
 if(id===undefined){id=String(10000+Object.keys(sceneDeps).length);sceneDeps[id]=p.collection;}
 return {m_FileID:Number(id),m_PathID:p.id};
}
const types=new Set(['GameObject','Transform','MeshFilter','MeshRenderer','BoxCollider','MeshCollider','SphereCollider','CapsuleCollider','LODGroup']);
async function prefab(root){
 const out=new Map();
 async function go(p){
  const a=await asset(p.collection,p.id);out.set(a.key,a);
  for(const ref of a.data.m_Components||a.data.m_Component||[]){
   const cp=await pointer(p.collection,ref.component||ref.m_Component||ref);if(!cp)continue;
   const c=await asset(cp.collection,cp.id);
   if(c.type==='SkinnedMeshRenderer')throw new Error('Terrain skinned vegetation needs an explicit adapter');
   if(!types.has(c.type))continue;out.set(c.key,c);
   if(c.type==='Transform')for(const child of c.data.m_Children||[]){const t=await pointer(c.collection,child),tr=await asset(t.collection,t.id);await go(await pointer(tr.collection,tr.data.m_GameObject));}
   if(c.type==='MeshFilter'||c.type==='MeshCollider')await mesh(await pointer(c.collection,c.data.m_Mesh));
   if(c.type==='MeshRenderer')for(const m of c.data.m_Materials||[])await material(await pointer(c.collection,m));
  }
 }
 await go(root);return out;
}
async function clonedData(value,c,mapping){
 if(Array.isArray(value))return Promise.all(value.map(v=>clonedData(v,c,mapping)));
 if(value&&typeof value==='object'){
  if('m_FileID' in value && 'm_PathID' in value){
   const p=await pointer(c,value);if(!p)return {m_FileID:0,m_PathID:'0'};
   return mapping.has(p.key)?{m_FileID:0,m_PathID:mapping.get(p.key)}:scenePointer(p);
  }
  return Object.fromEntries(await Promise.all(Object.entries(value).map(async([k,v])=>[k,await clonedData(v,c,mapping)])));
 }
 return value;
}
const terrainRows=(await collection(scene)).rows.filter(r=>r.type==='Terrain'),report=[];
if(!terrainRows.length){console.log('No native terrain in this scene');process.exit(0);}
mkdirSync(join(folder,'terrain'),{recursive:true});
let generated=0,trees=0,grassInstances=0;
const io=new NodeIO();
for(const [terrainIndex,row] of terrainRows.entries()){
 const component=(await asset(scene,row.id)).data;if(!component.m_Enabled)continue;
 const go=component.m_GameObject.m_PathID;
 const terrainTransform=Object.entries(records).find(([,r])=>r.type==='Transform'&&r.data.m_GameObject.m_PathID===go);
 if(!terrainTransform||!records[go]?.data.m_IsActive)continue;
 const p=await pointer(scene,component.m_TerrainData),data=(await asset(p.collection,p.id)).data,{n,scale}=terrainShape(data);
 write('terrain/source-'+terrainIndex+'.json',{component,data,collection:p.collection,sourceId:p.id});
 const alpha=[];for(const ref of data.m_SplatDatabase.m_AlphaTextures)alpha.push(await texture(await pointer(p.collection,ref)));
 const layers=[];
 for(const ref of data.m_SplatDatabase.m_TerrainLayers){
  const lp=await pointer(p.collection,ref),layer=(await asset(lp.collection,lp.id)).data;
  layers.push({data:layer,diffuse:await texture(await pointer(lp.collection,layer.m_DiffuseTexture)),normal:await texture(await pointer(lp.collection,layer.m_NormalMapTexture)),mask:await texture(await pointer(lp.collection,layer.m_MaskMapTexture))});
 }
 if(process.argv.includes('--inspect')){console.log({terrain:terrainIndex,n,scale,treeInstances:data.m_DetailDatabase.m_TreeInstances.length,layers:layers.map(x=>({name:x.data.m_Name,keys:Object.keys(x.data),tile:x.data.m_TileSize,offset:x.data.m_TileOffset,normal:!!x.normal,mask:!!x.mask}))});continue;}
 const prototypes=[];
 for(const proto of data.m_DetailDatabase.m_TreePrototypes){
  const root=await pointer(p.collection,proto.m_Prefab),items=await prefab(root);
  const transform=[...items.values()].find(r=>r.type==='Transform'&&key(r.collection,r.data.m_GameObject.m_PathID)===root.key);
  if(!transform)throw new Error('Terrain prototype root transform missing');
  prototypes.push({root,records:items,transformKey:transform.key});
 }
 const append=(id,type,name,d)=>records[id]={type,name,data:d};
 const localTransform=(id,parent,position={m_X:0,m_Y:0,m_Z:0})=>({m_GameObject:{m_FileID:0,m_PathID:id},m_Father:{m_FileID:0,m_PathID:parent},m_Children:[],m_LocalPosition:position,m_LocalRotation:{m_X:0,m_Y:0,m_Z:0,m_W:1},m_LocalScale:{m_X:1,m_Y:1,m_Z:1}});
 // Keep patches near the spatial LOD cell size regardless of height resolution.
 const span=profile.terrainPatchSamples||Math.max(1,2**Math.floor(Math.log2(profile.lod.cellSize/Math.max(scale.m_X,scale.m_Z))));
 if(!Number.isInteger(span)||span<1||span>128)throw new Error('Invalid terrain patch size');
 for(let z=0;z<n-1;z+=span)for(let x=0;x<n-1;x+=span){
  const patch=terrainPatch(data,x,z,span),label='TerrainSurface_'+terrainIndex+'_'+x+'_'+z,id='terrain-'+terrainIndex+'-'+x+'-'+z;
  const document=new Document(),buffer=document.createBuffer(),primitive=document.createPrimitive().setAttribute('POSITION',document.createAccessor().setType('VEC3').setArray(patch.positions).setBuffer(buffer)).setAttribute('NORMAL',document.createAccessor().setType('VEC3').setArray(patch.normals).setBuffer(buffer)).setAttribute('TEXCOORD_0',document.createAccessor().setType('VEC2').setArray(patch.uvs).setBuffer(buffer)).setIndices(document.createAccessor().setType('SCALAR').setArray(patch.indices).setBuffer(buffer));
  document.createScene().addChild(document.createNode('SubMesh_0').setMesh(document.createMesh().addPrimitive(primitive)));
  const file='terrain/'+id+'.glb';await io.write(join(folder,file),document);
  const meshKey=key(scene,id+'-mesh');resources.meshes.push({collection:scene,id:id+'-mesh',key:meshKey,file});
  const baked=await bakeTerrainPatch({folder,layers,alpha,data,patch,size:profile.textureSize,prefix:id});
  const materialKey=key(scene,id+'-material'),materialFile='terrain/'+id+'-material.json',textures={};
  for(const [slot,file] of Object.entries(baked)){
   const tkey=materialKey+':'+slot;resources.textures.push({key:tkey,file,name:label+' '+slot,hdr:false,width:profile.textureSize,height:profile.textureSize});textures[slot]=tkey;
  }
  const env=Object.fromEntries(Object.keys(textures).map(slot=>[slot,{m_Texture:{m_FileID:0,m_PathID:id+'-'+slot},m_Scale:{m_X:1,m_Y:1},m_Offset:{m_X:0,m_Y:0}}]));
  write(materialFile,{m_Name:label,m_SavedProperties:{m_TexEnvs:env,m_Floats:{_Mode:0,_Metallic:1,_Glossiness:1,_BumpScale:1},m_Colors:{_Color:{m_R:1,m_G:1,m_B:1,m_A:1}}}});
  resources.materials.push({collection:scene,id:id+'-material',key:materialKey,file:materialFile,name:label,shader:'Unity Terrain (baked source splat layers)',textures,adaptationNotes:['Authored height samples retained; diffuse, normal and PBR layers baked using original splat weights and tiling.']});
  append(id,'GameObject',label,{m_IsActive:true,m_Components:[]});append(id+'-transform','Transform','Transform',localTransform(id,terrainTransform[0]));
  append(id+'-filter','MeshFilter','MeshFilter',{m_GameObject:{m_FileID:0,m_PathID:id},m_Mesh:{m_FileID:0,m_PathID:id+'-mesh'}});
  append(id+'-renderer','MeshRenderer','MeshRenderer',{m_GameObject:{m_FileID:0,m_PathID:id},m_Enabled:true,m_StaticBatchInfo:{m_FirstSubMesh:0,m_SubMeshCount:0},m_Materials:[{m_FileID:0,m_PathID:id+'-material'}],m_LightmapIndex:65535});
  append(id+'-collider','MeshCollider','MeshCollider',{m_GameObject:{m_FileID:0,m_PathID:id},m_Enabled:true,m_IsTrigger:false,m_Mesh:{m_FileID:0,m_PathID:id+'-mesh'}});
  terrainTransform[1].data.m_Children.push({m_FileID:0,m_PathID:id+'-transform'});generated++;
  if(x+span>=n-1)console.log('Terrain baked row',Math.floor(z/span)+1,'/',Math.ceil((n-1)/span));
 }
 const grassMaterials=[];
 for(const [i,proto] of (data.m_DetailDatabase.m_DetailPrototypes||[]).entries()){
  const tex=await texture(await pointer(p.collection,proto.m_PrototypeTexture));if(!tex)throw new Error('Missing native terrain detail atlas');
  const id='terrain-detail-'+terrainIndex+'-'+i+'-material',file='terrain/'+id+'.json';
  const color=proto.m_HealthyColor;
  write(file,{m_Name:id,m_SavedProperties:{m_TexEnvs:{_MainTex:{m_Texture:{m_FileID:0,m_PathID:'detail-atlas'},m_Scale:{m_X:1,m_Y:1},m_Offset:{m_X:0,m_Y:0}}},m_Floats:{_Mode:1,_Cutoff:.5,_Cull:0,_Metallic:0,_Glossiness:0},m_Colors:{_Color:{...color,m_A:1}}}});
  resources.materials.push({collection:scene,id,key:key(scene,id),file,name:id,shader:'Unity Terrain Detail (static source billboard)',textures:{_MainTex:tex.key}});grassMaterials.push(id);
 }
 for(const [i,g] of terrainDetailMeshes(data,profile.lod.cellSize).entries()){
  const id='terrain-detail-'+terrainIndex+'-'+i,label='Native detail '+g.key,document=new Document(),buffer=document.createBuffer();
  const primitive=document.createPrimitive().setAttribute('POSITION',document.createAccessor().setType('VEC3').setArray(new Float32Array(g.positions)).setBuffer(buffer)).setAttribute('NORMAL',document.createAccessor().setType('VEC3').setArray(new Float32Array(g.normals)).setBuffer(buffer)).setAttribute('TEXCOORD_0',document.createAccessor().setType('VEC2').setArray(new Float32Array(g.uvs)).setBuffer(buffer)).setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.indices)).setBuffer(buffer));
  document.createScene().addChild(document.createNode('SubMesh_0').setMesh(document.createMesh().addPrimitive(primitive)));
  const file='terrain/'+id+'.glb';await io.write(join(folder,file),document);resources.meshes.push({collection:scene,id:id+'-mesh',key:key(scene,id+'-mesh'),file});
  append(id,'GameObject',label,{m_IsActive:true,m_Components:[]});append(id+'-transform','Transform','Transform',localTransform(id,terrainTransform[0]));
  append(id+'-filter','MeshFilter','MeshFilter',{m_GameObject:{m_FileID:0,m_PathID:id},m_Mesh:{m_FileID:0,m_PathID:id+'-mesh'}});
  const tint=data.m_DetailDatabase.m_DetailPrototypes[g.prototype].m_HealthyColor;
  const rgba=(Math.round(tint.m_R*255)|(Math.round(tint.m_G*255)<<8)|(Math.round(tint.m_B*255)<<16)|(255<<24))>>>0;
  append(id+'-renderer','MeshRenderer','MeshRenderer',{m_GameObject:{m_FileID:0,m_PathID:id},m_Enabled:true,m_StaticBatchInfo:{m_FirstSubMesh:0,m_SubMeshCount:0},m_Materials:[{m_FileID:0,m_PathID:grassMaterials[g.prototype]}],m_LightmapIndex:65535,terrainDetail:true,terrainInstanceColor:rgba});
  terrainTransform[1].data.m_Children.push({m_FileID:0,m_PathID:id+'-transform'});grassInstances+=g.instances;
 }
 for(const [i,instance] of data.m_DetailDatabase.m_TreeInstances.entries()){
  const proto=prototypes[instance.m_Index];if(!proto)throw new Error('Unknown terrain vegetation prototype');
  const mapping=new Map([...proto.records.keys()].map((k,j)=>[k,'terrain-tree-'+terrainIndex+'-'+i+'-'+j]));
  for(const a of proto.records.values())append(mapping.get(a.key),a.type,a.name,await clonedData(a.data,a.collection,mapping));
  const rootId=mapping.get(proto.transformKey),rootTransform=[rootId,records[rootId]];
  const pose=terrainInstancePose(instance,data),t=rootTransform[1].data;
  t.m_LocalPosition=pose.position;t.m_LocalRotation=pose.rotation;
  t.m_LocalScale={m_X:t.m_LocalScale.m_X*pose.scale.m_X,m_Y:t.m_LocalScale.m_Y*pose.scale.m_Y,m_Z:t.m_LocalScale.m_Z*pose.scale.m_Z};
  t.m_Father={m_FileID:0,m_PathID:terrainTransform[0]};terrainTransform[1].data.m_Children.push({m_FileID:0,m_PathID:rootTransform[0]});
  for(const id of mapping.values())if(records[id].type==='MeshRenderer')records[id].data.terrainInstanceColor=instance.m_Color.m_Rgba;
  trees++;
 }
 report.push({sourceName:data.m_Name,resolution:n,samples:n*n,scale,treeInstances:data.m_DetailDatabase.m_TreeInstances.length,prototypes:prototypes.length,layers:layers.length});
}
if(process.argv.includes('--inspect'))process.exit(0);
resources.collectionDependencies[JSON.stringify(scene)]=sceneDeps;
resources.records='scene-with-terrain.json';write(resources.records,records);
if(!existsSync(join(folder,'resources.before-terrain.json')))write('resources.before-terrain.json',original);
write('resources.json',resources);write('terrain-report.json',{map:profile.id,terrains:report,generatedPatches:generated,authoredInstances:trees,grassInstances,sourceAssets:[...assetCache.values()].map(x=>({type:x.type,key:x.key,name:x.name})),limitations:['Terrain layers are baked to static browser PBR; Unity wind animation is not reproduced.','Native detail density and atlases are retained as static crossed billboards with deterministic scatter, adapted tint and far-LOD fading; Unity random scatter and camera-facing animation differ.','Existing sphere/capsule collider approximation remains in effect.']});
console.log({terrains:report.length,generatedPatches:generated,authoredInstances:trees,grassInstances});
