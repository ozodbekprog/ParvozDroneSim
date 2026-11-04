import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,readdirSync,unlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=join(root,'content/drones/kestrel'),temporary=join(root,'data/art-build/kestrel-modular');
const blender=process.env.BLENDER_PATH||'D:/Programs/Blender Foundation/Blender 5.1/blender.exe';
function run(exe,args){const r=spawnSync(exe,args,{cwd:root,stdio:'inherit',windowsHide:true});if(r.status!==0)throw new Error(r.error?.message||`Build failed (${r.status})`);}
if(!process.argv.includes('--metadata-only')){
  if(!process.argv.includes('--optimize-only'))run(blender,['--background','--factory-startup','--python-exit-code','1','--python','tools/blender/prepare_kestrel_modular.py']);
  for(const name of ['hangar','low','far'])run(process.execPath,['tools/optimize-art.js',join(temporary,name+'.raw.glb'),join(out,name+'.glb')]);
}
const definition=JSON.parse(readFileSync(join(out,'drone.json'))),prepared=JSON.parse(readFileSync(join(out,'preparation.json')));
const lods=prefix=>[{model:prefix+'hangar.glb',distance:0},{model:prefix+'low.glb',distance:3},{model:prefix+'far.glb',distance:18}];
const source=JSON.parse(readFileSync(join(root,'content/source-assets/3d-husky-drone/SOURCE.json')));
Object.assign(definition,{model:'hangar.glb',modelLods:lods(''),lowLod:1,mounts:prepared.mounts,partBindings:prepared.partBindings,motorBindings:prepared.motorBindings,colorBindings:{body:['Frame_Finish_SCOUT','Frame_Finish_SCOUT_Template','Frame_Finish_HUNTER_Template']},assetLicense:'CC-BY-SA-4.0',assetCredit:'Drone racing — 3D Husky (Kawasalto)',assetSource:source.source,assetLicenseURL:'https://creativecommons.org/licenses/by-sa/4.0/',assetChanges:'Blender import, semantic component separation, normalized camera/motor axes, masked decals and LOD. Source SCOUT/HUNTER finishes; shared component shapes except two/three-blade props.'});
if(!prepared.colorBindings)throw new Error('Reprepare Blender source with neutral finish bindings before building metadata.');
definition.colorBindings=prepared.colorBindings;
definition.assetChanges+=' Neutral body and LED albedo prepared in Blender, preserving authored shading, UVs and alpha; full frame tint bindings.';
definition.attributionFile='SOURCE.json';
writeFileSync(join(out,'drone.json'),JSON.stringify(definition,null,2)+'\n');
writeFileSync(join(out,'SOURCE.json'),JSON.stringify({...source,license:'CC-BY-SA-4.0',derivativeLicense:'CC-BY-SA-4.0',editableSource:'kestrel.blend',changes:definition.assetChanges,componentReview:'data/art-build/kestrel/components',variantsNote:'SCOUT/HUNTER have distinct authored finishes and propeller geometry; other component shapes are shared. Original flight parameters and all existing part statistics retained.'},null,2)+'\n');
const alternate={frame:'light',motors:'race',propellers:'efficient',camera:'race',battery:'endurance'};
const baseline={frame:'carbon',motors:'balanced',propellers:'triblade',camera:'wide',battery:'standard'};
for(const folder of readdirSync(join(root,'content/parts'))){
  const file=join(root,'content/parts',folder,'part.json');if(!existsSync(file))continue;
  const part=JSON.parse(readFileSync(file)),category=part.category;
  if(part.id!==baseline[category]&&part.id!==alternate[category])continue;
  const variant=part.id===baseline[category]?'SCOUT':'HUNTER',prefix='../../drones/kestrel/';
  Object.assign(part,{model:prefix+'hangar.glb',modelLods:lods(prefix),modelNode:`Template_Part_${category}_${variant}`,lowLod:1,compatibleDrones:['kestrel'],position:[0,0,0],rotation:[0,0,0],scale:1,assetLicense:'CC-BY-SA-4.0',visualVariant:variant,visualVariantNote:category==='propellers'?(variant==='HUNTER'?'Authored two-blade propeller':'Authored three-blade propeller'):'Authored finish; SCOUT/HUNTER share this component shape.'});
  writeFileSync(file,JSON.stringify(part,null,2)+'\n');
}
if(!process.argv.includes('--keep-raw'))for(const name of ['hangar','low','far'])for(const file of [join(temporary,name+'.raw.glb'),join(out,name+'.glb.prepared.glb'),join(root,'data/art-build',name+'.glb.prepared.glb')])if(existsSync(file))unlinkSync(file);
run(process.execPath,['tools/sync-content.js']);run(process.execPath,['tools/validate-content.js']);
