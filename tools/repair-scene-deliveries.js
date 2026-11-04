// Reuse recovered sources and texture caches; no recovery from the installation.
import {spawnSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve('.'),backup='D:/DroneLiftoffUz-import-temp/scene-repair-20261013/before';
const blender='D:/Programs/Blender Foundation/Blender 5.1/blender.exe';
function save(path){const dest=join(backup,path);mkdirSync(resolve(dest,'..'),{recursive:true});if(!existsSync(dest))copyFileSync(path,dest);return dest;}
function run(exe,args,env=process.env){const r=spawnSync(exe,args,{cwd:root,env,windowsHide:true,stdio:'inherit'});if(r.status!==0)throw Error('Failed '+args.join(' '));}
const maps=['minus-two-demo','hangar-c03-demo','liftoff-arena-demo'];
for(const id of maps){const p=JSON.parse(readFileSync('tools/import-profiles/'+id+'.json'));for(const path of ['content/maps/'+id+'/map.blend','content/maps/'+id+'/model.glb','content/maps/'+id+'/map.json',p.staging+'/model.glb',p.staging+'/model.glb.prepared.glb'])save(path);}
for(const path of ['content/drones/luma-5/luma-5.blend','content/drones/luma-5/model.glb','content/shared-assets/liftoff-workbench/workbench.blend','content/shared-assets/liftoff-workbench/model.glb','content/shared-assets/liftoff-workbench/delivery.glb','content/shared-assets/liftoff-workbench/delivery.glb.prepared.glb',...['hangar','low','far'].flatMap(l=>['content/drones/luma-5/'+l+'-delivery.glb','content/drones/luma-5/'+l+'-delivery.glb.prepared.glb'])])save(path);
if(!process.argv.includes('--resume-workbench')){
 run(blender,['--background','--python-exit-code','1','--python','tools/blender/repair_native_scene_details.py']);
 run(blender,['--background','--python-exit-code','1','--python','tools/blender/export_liftoff_drone_lods.py','--','luma-5']);
 for(const label of ['hangar','low','far']){const f='content/drones/luma-5/';run(process.execPath,['tools/optimize-art.js',f+label+'.glb',f+label+'-delivery.glb','--unity-materials=data/liftoff-drone-recovery/browser-track-resources.json','--reuse-unchanged-ktx='+join(backup,f+label+'-delivery.glb.prepared.glb')]);}
}
run(blender,['--background','--python-exit-code','1','--python','tools/blender/prepare_liftoff_workbench.py']);
run(process.execPath,['tools/optimize-art.js','content/shared-assets/liftoff-workbench/model.glb','content/shared-assets/liftoff-workbench/delivery.glb','--unity-materials=data/liftoff-workbench-recovery/browser-resources.json','--reuse-unchanged-ktx='+join(backup,'content/shared-assets/liftoff-workbench/delivery.glb.prepared.glb')]);
for(const id of maps){
 const profile=JSON.parse(readFileSync('tools/import-profiles/'+id+'.json')),env={...process.env,CONTENT_IMPORT_PROFILE:resolve('tools/import-profiles/'+id+'.json')},cache=profile.staging+'/';
 run(blender,['--background','--python-exit-code','1','--python','tools/blender/export_minus_two.py'],env);
 run(process.execPath,['tools/optimize-art.js',cache+'runtime.glb',cache+'model.glb','--unity-materials='+cache+'browser-resources.json','--reuse-unchanged-ktx='+join(backup,cache+'model.glb.prepared.glb'),...(profile.lod.floatPositions?['--position-float']:[])],env);
 copyFileSync(cache+'model.glb','content/maps/'+id+'/model.glb');
 const path='content/maps/'+id+'/map.json',map=JSON.parse(readFileSync(path));map.objects=JSON.parse(readFileSync(cache+'runtime-objects.json'));writeFileSync(path,JSON.stringify(map,null,2)+'\n');
 console.log('CLEANED_ALL_LODS',id);
}
run(process.execPath,['tools/sync-content.js']);
