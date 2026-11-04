import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,unlinkSync,copyFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=join(root,'content/maps/ironworks-v2');
const staging=process.env.IRONWORKS_OUTPUT_DIR?resolve(process.env.IRONWORKS_OUTPUT_DIR):out;
mkdirSync(staging,{recursive:true});
const blender=process.env.BLENDER_PATH||'D:/Programs/Blender Foundation/Blender 5.1/blender.exe';
function run(exe,args){const r=spawnSync(exe,args,{cwd:root,stdio:'inherit',windowsHide:true});if(r.status!==0)throw new Error(r.error?.message||`Build failed (${r.status})`);}
if(!process.argv.includes('--optimize-only')&&!process.argv.includes('--prepared-only'))run(blender,['--background','--factory-startup','--python-exit-code','1','--python','tools/blender/assemble_ironworks_v2.py']);
for(const name of ['model','gate']){
  if(!process.argv.includes('--prepared-only')&&existsSync(join(staging,name+'.raw.glb')))run(process.execPath,['tools/optimize-art.js',join(staging,name+'.raw.glb'),join(staging,name+'.glb'),...(name==='model'?['--static']:[])]);
  else if(!existsSync(join(staging,name+'.glb')))throw new Error('Missing prepared asset: '+name);
}
if(staging!==out)for(const file of ['map.blend','collision.json','preparation.json','model.glb','gate.glb','model.glb.report.json','gate.glb.report.json','site-chunks.json'])if(existsSync(join(staging,file)))copyFileSync(join(staging,file),join(out,file));
if(existsSync(join(staging,'map-definition.json')))writeFileSync(join(out,'map.json'),readFileSync(join(staging,'map-definition.json')));
const ids=['modular_factory_facade','modular_industrial_pipes_01','concrete_road_barrier','metal_tool_chest','concrete_floor_worn_001','painted_plaster_wall','industrial_pastic_container','industrial_storage_cart','hanging_industrial_lamp'];
ids.push('overhead_crane','portable_generator','barrel_03','modular_electricity_poles','modular_chainlink_fence','worn_asphalt','gravel_road');
writeFileSync(join(out,'SOURCE.json'),JSON.stringify({artDirection:'02-worn',chosenOn:'2026-10-08',choiceEvidence:'User replied 2 after comparison-low.png',license:'CC0-1.0',sources:ids.map(id=>JSON.parse(readFileSync(join(root,'content/source-assets',id,'SOURCE.json')))),changes:'Layout, loading-hall interior, new rear portal, flight delivery simplification, baked courtyard AO, exact-aperture pipe arches and collision sidecar; editable source retained in map.blend.'},null,2));
if(!process.argv.includes('--keep-raw'))for(const name of ['model','gate'])for(const file of [join(staging,name+'.raw.glb'),join(staging,name+'.glb.prepared.glb'),join(out,name+'.raw.glb'),join(root,'data/art-build',name+'.glb.prepared.glb')])if(existsSync(file))unlinkSync(file);
run(process.execPath,['tools/sync-content.js']);
run(process.execPath,['tools/validate-content.js']);
run(process.execPath,['tools/check-ironworks-site.js']);
