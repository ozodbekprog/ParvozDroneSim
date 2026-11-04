import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root=resolve(import.meta.dirname,'..'), out=join(root,'content/review/ironworks');
const blender=process.env.BLENDER_PATH || 'D:/Programs/Blender Foundation/Blender 5.1/blender.exe';
function run(executable,args){const r=spawnSync(executable,args,{cwd:root,stdio:'inherit',windowsHide:true});if(r.status!==0)throw new Error(r.error?.message || `Build failed (${r.status}): ${executable}`);}
if(!existsSync(blender))throw new Error('Set BLENDER_PATH to the installed Blender executable.');
run(blender,['--background','--factory-startup','--python-exit-code','1','--python',join(root,'tools/blender/assemble_ironworks_review.py')]);
for(const look of ['clean','worn'])run(process.execPath,[join(root,'tools/optimize-art.js'),join(out,look+'.raw.glb'),join(out,look+'.glb')]);
// Evening uses identical worn geometry/materials; illumination is configured by the game.
copyFileSync(join(out,'worn.glb'),join(out,'evening.glb'));
const ids=['modular_factory_facade','modular_industrial_pipes_01','concrete_road_barrier','metal_tool_chest','smooth_concrete_floor','concrete_floor_worn_001','painted_plaster_wall'];
writeFileSync(join(out,'sources.json'),JSON.stringify(ids.map(id=>JSON.parse(readFileSync(join(root,'content/source-assets',id,'SOURCE.json')))),null,2));
if(!process.argv.includes('--keep-raw')) {
  for(const name of ['clean.raw.glb','worn.raw.glb','evening.raw.glb'])unlinkSync(join(out,name));
  for(const name of ['clean.glb.prepared.glb','worn.glb.prepared.glb']){const file=join(root,'data/art-build',name);if(existsSync(file))unlinkSync(file);}
}
console.log('Art-review candidates built. No production catalog entries were replaced.');
