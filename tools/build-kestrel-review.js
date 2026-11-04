import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

const root=resolve('.'), out=resolve('content/review/kestrel');
const blender=process.env.BLENDER_PATH || 'D:/Programs/Blender Foundation/Blender 5.1/blender.exe';
function run(command,args){const r=spawnSync(command,args,{stdio:'inherit',windowsHide:true});if(r.status!==0)throw new Error(`Art build failed: ${r.error?.message || r.status}`);}
if(!existsSync(resolve('content/source-assets/3d-husky-drone/original.glb')))throw new Error('Download the licensed Drone racing source through Sketchfab; see docs/graphics-overhaul.md.');
run(blender,['--background','--factory-startup','--python-exit-code','1','--python',resolve('tools/blender/prepare_kestrel_review.py')]);
for(const level of ['hangar','low','far'])run(process.execPath,[resolve('tools/optimize-art.js'),resolve(`data/art-build/kestrel/${level}.raw.glb`),resolve(out,`${level}.glb`)]);
const source=JSON.parse(readFileSync(resolve('content/source-assets/3d-husky-drone/SOURCE.json'),'utf8'));
source.sha256=createHash('sha256').update(readFileSync(resolve('content/source-assets/3d-husky-drone/original.glb'))).digest('hex');
writeFileSync(resolve(out,'SOURCE.json'),JSON.stringify(source,null,2)+'\n');
run(process.execPath,[resolve('tools/check-kestrel-review.js')]);
if(!process.argv.includes('--keep-raw')){
  const temporary=resolve('data/art-build/kestrel');
  for(const file of readdirSync(temporary))if(file.endsWith('.raw.glb')){
    const path=resolve(temporary,file);
    if(!path.startsWith(root+sep)||!path.startsWith(temporary+sep))throw new Error('Unexpected cleanup path');
    rmSync(path);
  }
}
