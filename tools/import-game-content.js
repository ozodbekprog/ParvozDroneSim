// Resume an import stage without re-reading/exporting the whole installation.
import {spawnSync} from 'node:child_process';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const args=process.argv.slice(2),profileFile=args.find(v=>!v.startsWith('--'))||'tools/import-profiles/minus-two-demo.json';
process.env.CONTENT_IMPORT_PROFILE=resolve(profileFile);
const {profile,recoveryFolder,mapFolder}=await import('./content-import-profile.js');
const step=args.find(v=>v.startsWith('--step='))?.slice(7)||'plan';
const run=(command,argv)=>{
  const result=spawnSync(command,argv,{cwd:resolve('.'),env:process.env,windowsHide:true,stdio:'inherit'});
  if(result.error||result.status!==0)throw new Error(result.error?.message||'Import stage failed: '+command+' (exit '+result.status+')');
};
const node=(script,...extra)=>run(process.execPath,['tools/'+script,...extra]);
const requireFile=path=>{if(!existsSync(path))throw new Error('Missing prerequisite: '+path);};
const blender=(script,...extra)=>{requireFile(profile.blender);run(profile.blender,['--background','--factory-startup','--python-exit-code','1','--python','tools/blender/'+script,'--',...extra]);};
const stages={
  exclusions:()=>node('prepare-import-exclusions.js'),
  recoverTracks:()=>node('recover-liftoff-tracks.js'),
  gateConfig:()=>node('recover-liftoff-gate-config.js',...(args.includes('--loaded')?['--loaded']:[])),
  tracks:()=>blender('import_liftoff_tracks.py'),
  trackAssets:()=>node('recover-liftoff-track-assets.js'),
  trackTextures:()=>node('prepare-minus-two-textures.js','--resources=track-resources.json'),
  trackModels:()=>blender('import_liftoff_track_models.py'),
  trackCollisions:()=>{blender('import_liftoff_track_models.py','--collision-only');if(profile.trackOptions?.adaptSpawnClearance)node('adapt-import-spawns.js');},
  trackOptimize:()=>{
    const tracks=JSON.parse(readFileSync(recoveryFolder+'track-model-report.json','utf8'));
    for(const track of tracks)node('optimize-art.js',recoveryFolder+track.id+'-props.glb','content/races/'+track.id+'/props.glb','--unity-materials='+recoveryFolder+'browser-track-resources.json');
  },
  details:()=>node('recover-import-details.js'),
  materialsCheck:()=>{requireFile(recoveryFolder+'model.glb');node('check-import-materials.js','--model='+recoveryFolder+'model.glb');},
  trackMaterialsCheck:()=>{
    for(const track of JSON.parse(readFileSync(recoveryFolder+'track-model-report.json','utf8')))node('check-import-materials.js','--model=content/races/'+track.id+'/props.glb','--resources=browser-track-resources.json','--report='+track.id+'-material-audit.json');
  },
  geometryCheck:()=>{requireFile(recoveryFolder+'model.glb');node('prepare-import-geometry-audit.js');blender('audit_import_geometry.py');},
  inputs:()=>node('prepare-minus-two-input.js',...(args.includes('--load')?['--load']:[])),
  recover:()=>{requireFile(recoveryFolder+'input-manifest.json');node('recover-minus-two.js');},
  terrain:()=>{requireFile(recoveryFolder+'resources.json');node('recover-import-terrain.js');},
  textures:()=>{requireFile(recoveryFolder+'resources.json');node('prepare-minus-two-textures.js');},
  refreshMaterials:()=>{requireFile(mapFolder+'map.blend');blender('refresh_import_materials.py');},
  deliveryMaterials:()=>{blender('export_import_materials.py');node('replace-import-materials.js');node('optimize-art.js',recoveryFolder+'runtime.glb',recoveryFolder+'model.glb','--unity-materials='+recoveryFolder+'browser-resources.json','--reuse-unchanged-ktx='+recoveryFolder+'model.glb.prepared.glb.before-material-final');},
  lightmaps:()=>{
    requireFile(recoveryFolder+'resources.json');node('recover-minus-two-lightmaps.js');
    const dir=recoveryFolder+'hdr-lightmaps',dds=readdirSync(dir).filter(p=>p.endsWith('.dds')).map(p=>resolve(dir,p));
    if(dds.length){requireFile('tools/bin/texconv.exe');run(resolve('tools/bin/texconv.exe'),['-nologo','-f','R32G32B32_FLOAT','-ft','hdr','-m','1','-vflip','-y','-o',resolve(dir),...dds]);}
  },
  collisions:()=>{requireFile(recoveryFolder+'resources.json');node('prepare-minus-two-collisions.js');},
  probe:()=>{requireFile(recoveryFolder+'browser-resources.json');blender('import_minus_two.py','--probe',...(args.includes('--no-render')?['--no-render']:[]));blender('export_minus_two.py','--probe');},
  assemble:()=>{requireFile(recoveryFolder+'collision.json');blender('import_minus_two.py',...(args.includes('--no-render')?['--no-render']:[]));},
  export:()=>{requireFile(mapFolder+'map.blend');blender('export_minus_two.py');},
  optimize:()=>{requireFile(recoveryFolder+'runtime.glb');node('optimize-art.js',recoveryFolder+'runtime.glb',recoveryFolder+'model.glb','--unity-materials='+recoveryFolder+'browser-resources.json',...(profile.lod.preserveGeometry?[]:['--static']),...(profile.lod.floatPositions?['--position-float']:[]),...(profile.lod.instanceVegetation?['--instance-siblings']:[]),...(profile.lod.terrainNormalSize?['--terrain-normal-size='+profile.lod.terrainNormalSize]:[]));},
  course:()=>{requireFile(recoveryFolder+'collision.json');node(profile.course.id.startsWith(profile.id+'-liftoff-')?'prepare-import-course-from-source.js':'prepare-minus-two-course.js');},
  package:()=>{node('check-import-materials.js','--model='+recoveryFolder+'model.glb');node('package-minus-two-demo.js');},
  markers:()=>node('blender-package.js','--map',profile.id,'--markers','--blender',profile.blender),
  sync:()=>node('sync-content.js'),
  check:()=>{node('validate-content.js');node('check-minus-two-demo.js');},
  build:()=>{node('sync-content.js');run(process.execPath,['node_modules/vite/bin/vite.js','build']);}
};
if(step==='plan')console.log(JSON.stringify({profile:profileFile,map:profile.id,staging:recoveryFolder,stages:Object.keys(stages),usage:'node tools/import-game-content.js '+profileFile+' --step=STAGE',note:'Run each stage separately. Review probe before assemble. Oracle deployment is separate.'},null,2));
else if(stages[step])stages[step]();
else throw new Error('Unknown stage: '+step+'. Use --step=plan.');
