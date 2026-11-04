// Compare real delivered atlas coordinates against cached authored source meshes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Vector3,Matrix4,Quaternion} from 'three';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const key=p=>p.map(v=>Math.round(v*1000)).join(','),results=[];
for(const id of ['minus-two-demo','hangar-c03-demo','liftoff-arena-demo']){
 const profile=JSON.parse(readFileSync('tools/import-profiles/'+id+'.json')),folder=profile.staging+'/',resources=JSON.parse(readFileSync(folder+'browser-resources.json'));
 const records=JSON.parse(readFileSync(folder+resources.records)),filters=new Map(Object.values(records).filter(r=>r.type==='MeshFilter').map(r=>[String(r.data.m_GameObject.m_PathID),r]));
 const pointer=p=>JSON.stringify(resources.collectionDependencies[JSON.stringify(resources.scene)][p.m_FileID])+':'+p.m_PathID;
 const transforms=new Map(Object.entries(records).filter(([,r])=>r.type==='Transform')),byObject=new Map([...transforms.values()].map(r=>[String(r.data.m_GameObject.m_PathID),r.data])),worldCache=new Map(),reflection=new Matrix4().makeScale(-1,1,1);
 const xyz=v=>new Vector3(...['X','Y','Z'].map(a=>v['m_'+a]||0));
 const world=go=>{
   if(worldCache.has(go))return worldCache.get(go);
   const t=byObject.get(go),q=t.m_LocalRotation;
   const m=new Matrix4().compose(xyz(t.m_LocalPosition),new Quaternion(q.m_X,q.m_Y,q.m_Z,q.m_W),xyz(t.m_LocalScale));
   const parent=transforms.get(String(t.m_Father.m_PathID));if(parent)m.premultiply(world(String(parent.data.m_GameObject.m_PathID)));
   worldCache.set(go,m);return m;
 };
 const selected=[],names=new Set();
 for(const record of Object.values(records)){
   if(record.type!=='MeshRenderer'||!record.data.m_Enabled)continue;
   for(const [index,ref] of record.data.m_Materials.entries()){
     const material=resources.materials.find(m=>m.key===pointer(ref));
     if(!material||!/Posters|SignsParking|TrafficSignStop|BannerArena|InfoSigns/.test(material.name)||names.has(material.name))continue;
     const saved=JSON.parse(readFileSync(folder+material.file)).m_SavedProperties?.m_TexEnvs?._MainTex;
     if(saved&&((saved.m_Scale?.m_X??1)!==1||(saved.m_Scale?.m_Y??1)!==1||(saved.m_Offset?.m_X??0)!==0||(saved.m_Offset?.m_Y??0)!==0))continue;
     const filter=filters.get(String(record.data.m_GameObject.m_PathID));if(!filter)continue;
     const mesh=resources.meshes.find(m=>m.key===pointer(filter.data.m_Mesh));if(!mesh)continue;
     const isStatic=record.data.m_StaticBatchInfo?.m_SubMeshCount>0;
     const matrix=isStatic?new Matrix4():reflection.clone().multiply(world(String(record.data.m_GameObject.m_PathID))).multiply(reflection);
     selected.push({material:material.name,file:mesh.file,index:(isStatic?record.data.m_StaticBatchInfo.m_FirstSubMesh:0)+index,matrix});names.add(material.name);
   }
   if(selected.length>=3)break;
 }
 assert.ok(selected.length,`No authored atlas probes for ${id}`);
 const expected=new Map();
 for(const sample of selected){
   const d=await io.read(folder+sample.file),node=d.getRoot().listNodes().find(n=>n.getName()==='SubMesh_'+sample.index);
   assert.ok(node?.getMesh(),sample.file+':'+sample.index);
   for(const p of node.getMesh().listPrimitives()){
     const xyz=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0');assert.ok(uv);
     for(let i=0;i<xyz.getCount();i++){
       const position=[],texcoord=[];xyz.getElement(i,position);uv.getElement(i,texcoord);
       const k=sample.material+':'+key(new Vector3().fromArray(position).applyMatrix4(sample.matrix).toArray());if(!expected.has(k))expected.set(k,[]);expected.get(k).push(texcoord);
     }
   }
 }
 const d=await io.read('content/maps/'+id+'/model.glb'),objects=JSON.parse(readFileSync(folder+'runtime-objects.json'));let checked=0,matched=0;
 for(const object of objects){
   const root=d.getRoot().listNodes().find(n=>n.getName()===object.modelNode);assert.ok(root);
   root.traverse(node=>{
     const matrix=new Matrix4().fromArray(node.getWorldMatrix());
     for(const p of node.getMesh()?.listPrimitives()||[]){
       const material=p.getMaterial(),name=material?.getName();if(!names.has(name))continue;
       const xyz=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0');if(!uv)continue;
       const transform=material.getBaseColorTextureInfo()?.getExtension('KHR_texture_transform'),scale=transform?.getScale()||[1,1],offset=transform?.getOffset()||[0,0],rotation=transform?.getRotation()||0;
       for(let i=0;i<xyz.getCount();i++){
         const position=[],texcoord=[];xyz.getElement(i,position);uv.getElement(i,texcoord);
         const world=new Vector3().fromArray(position).applyMatrix4(matrix).add(new Vector3().fromArray(object.position));
         const candidates=expected.get(name+':'+key(world.toArray()));if(!candidates)continue;
         const x=texcoord[0]*scale[0],y=texcoord[1]*scale[1],actual=[offset[0]+Math.cos(rotation)*x-Math.sin(rotation)*y,offset[1]+Math.sin(rotation)*x+Math.cos(rotation)*y];
         checked++;if(candidates.some(v=>Math.abs(v[0]-actual[0])<.0005&&Math.abs(v[1]-actual[1])<.0005))matched++;
       }
     }
   });
 }
 const result={map:id,materials:[...names],checked,matched};results.push(result);console.log(JSON.stringify(result));
 assert.ok(checked>=4,`No delivered correspondence for ${id}`);assert.equal(matched,checked,`${id}: primary atlas coordinates changed`);
}
writeFileSync('data/map-uv-repair-20261015/atlas-audit.json',JSON.stringify(results,null,2));
