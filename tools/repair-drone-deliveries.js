import{spawnSync}from'node:child_process';import{resolve}from'node:path';
const root=resolve(import.meta.dirname,'..'),blender='D:/Programs/Blender Foundation/Blender 5.1/blender.exe',before='data/art-repair-20261013/before/';
function run(exe,args){const r=spawnSync(exe,args,{cwd:root,stdio:'inherit',windowsHide:true});if(r.status!==0)throw Error('Repair stage failed: '+args.join(' '));}
run(blender,['--background','--python-exit-code','1','--python','tools/blender/export_liftoff_drone_lods.py']);
for(const id of ['luma-5','armattan-chameleon'])for(const label of ['hangar','low','far']){
 const folder='content/drones/'+id+'/';
 run(process.execPath,['tools/optimize-art.js',folder+label+'.glb',folder+label+'-delivery.glb','--unity-materials=data/liftoff-drone-recovery/browser-track-resources.json','--reuse-unchanged-ktx='+before+folder+label+'.glb']);
 console.log('REPAIRED_DELIVERY',id,label);
}
for(const label of ['hangar','low','far']){
 run(process.execPath,['tools/optimize-art.js','data/art-repair-20261013/kestrel/'+label+'.raw.glb','content/drones/kestrel/'+label+'.glb']);console.log('REPAIRED_DELIVERY kestrel',label);
}
run(blender,['--background','--python-exit-code','1','--python','tools/blender/prepare_liftoff_workbench.py']);
run(process.execPath,['tools/optimize-art.js','content/shared-assets/liftoff-workbench/model.glb','content/shared-assets/liftoff-workbench/delivery.glb','--unity-materials=data/liftoff-workbench-recovery/browser-resources.json','--reuse-unchanged-ktx='+before+'content/shared-assets/liftoff-workbench/delivery.glb.prepared.glb']);
run(process.execPath,['tools/sync-content.js']);console.log('ALL_DELIVERIES_REPAIRED');
