// Change only primary UVs in prepared geometry. Reuse all compressed textures.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {existsSync,readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {join,dirname,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),out=join(root,'data/map-uv-repair-20261015');
const profiles=['minus-two-demo','hangar-c03-demo','liftoff-arena-demo'].map(id=>JSON.parse(readFileSync(join(root,'tools/import-profiles/'+id+'.json'))));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),report=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function backup(file){const target=join(out,'before',relative(root,file));mkdirSync(dirname(target),{recursive:true});if(!existsSync(target))copyFileSync(file,target);return target;}
async function repair(file){
 const stamp=join(out,relative(root,file)+'.json');if(existsSync(stamp))return;
 const before=backup(file),d=await io.read(file),geometry=()=>{
   const h=createHash('sha256');for(const p of d.getRoot().listMeshes().flatMap(m=>m.listPrimitives()))for(const a of [...p.listSemantics().filter(s=>s!=='TEXCOORD_0').map(s=>p.getAttribute(s)),p.getIndices()].filter(Boolean)){const v=a.getArray();h.update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));}return h.digest('hex');
 };
 const oldGeometry=geometry(),seen=new Set();let count=0;
 for(const p of d.getRoot().listMeshes().flatMap(m=>m.listPrimitives())){
   const uv=p.getAttribute('TEXCOORD_0');if(!uv||seen.has(uv))continue;seen.add(uv);
   if(uv.getComponentType()!==5126)throw Error('Repair the unquantized prepared geometry: '+file);
   const values=uv.getArray();for(let i=1;i<values.length;i+=2)values[i]=1-values[i];count+=uv.getCount();
 }
 if(!count||geometry()!==oldGeometry)throw Error('Non-UV geometry changed or no UVs found');
 await io.write(file,d);mkdirSync(dirname(stamp),{recursive:true});
 writeFileSync(stamp,JSON.stringify({file:relative(root,file),uvVertices:count,geometryUnchanged:true,beforeSha256:hash(readFileSync(before)),afterSha256:hash(readFileSync(file))}));
 console.log('PREPARED_UV_REPAIRED',relative(root,file),count);
}
for(const profile of profiles){
 const staging=join(root,profile.staging),map=join(root,'content/maps',profile.id);
 await repair(join(staging,'runtime.glb'));await repair(join(staging,'model.glb.prepared.glb'));
 const targets=[[join(staging,'model.glb'),join(staging,'runtime.glb'),join(map,'model.glb')]];
 const catalog=JSON.parse(readFileSync(join(root,'public/content/catalog.json')));
 for(const track of catalog.maps.find(m=>m.id===profile.id).tracks.filter(t=>t.id.startsWith(profile.id+'-liftoff-'))){
   const file=join(root,'content/races',track.id,'props.glb'),raw=join(staging,track.id+'-props.glb');
   await repair(raw);await repair(file+'.prepared.glb');targets.push([file,raw,file]);
 }
 for(const [file,raw,canonical] of targets){
   const stamp=join(out,relative(root,file)+'.optimized.json');if(existsSync(stamp))continue;
   const before=backup(file);if(file!==canonical)backup(canonical);
   const args=['tools/optimize-art.js',raw,file,'--resume-prepared','--reuse-ktx'];
   const result=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,CONTENT_IMPORT_PROFILE:join(root,'tools/import-profiles',profile.id+'.json')},stdio:'inherit',windowsHide:true});
   if(result.status!==0)throw Error('UV delivery compression failed: '+file);
   if(file!==canonical)copyFileSync(file,canonical);
   const item={file:relative(root,canonical),beforeSha256:hash(readFileSync(before)),afterSha256:hash(readFileSync(file)),texturesReused:true};
   mkdirSync(dirname(stamp),{recursive:true});writeFileSync(stamp,JSON.stringify(item));report.push(item);
 }
}
writeFileSync(join(out,'deliveries.json'),JSON.stringify(report,null,2));
