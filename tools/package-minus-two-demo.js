// Connect a verified recovery through the existing folder content format.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,statSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {profile,profilePath,recoveryFolder,mapFolder} from './content-import-profile.js';
const staging=recoveryFolder,folder=mapFolder;
const read=p=>JSON.parse(readFileSync(p,'utf8')),write=(p,v)=>{mkdirSync(p.slice(0,p.lastIndexOf('/')),{recursive:true});writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const assembly=read(staging+'assembly-report.json'),runtime=read(staging+'runtime-export.json');
if(assembly.invalidTransforms.length||runtime.triangles<=0||!assembly.objects)throw new Error('Incomplete geometry recovery.');
const model=readFileSync(staging+'model.glb');if(model.toString('ascii',0,4)!=='glTF')throw new Error('Missing optimized model.');
if(model.readUInt32LE(8)!==model.length)throw new Error('The model is incomplete; wait for optimization to finish.');
const race=read(staging+'race.json'),manifest=read(staging+'input-manifest.json');
if(race.map!==profile.id||race.id!==profile.course.id)throw new Error('The staged course belongs to another profile.');
const objects=read(staging+'runtime-objects.json'),prefix=profile.nodePrefix||'Imported_'+profile.id.replaceAll('-','_');
for(const object of objects){object.lowLod=profile.lod.lowLod;object.modelLods.forEach((level,i)=>{level.distance=profile.lod.distances[i];});}
const gltf=JSON.parse(model.toString('utf8',20,20+model.readUInt32LE(12))),nodes=new Set(gltf.nodes?.map(n=>n.name));
for(const name of [prefix+'Environment',...objects.flatMap(o=>o.modelLods.map(l=>l.modelNode))])if(!nodes.has(name))throw new Error('Missing runtime model node: '+name);
const coverage=profile.lod.preserveGeometry?read(staging+'geometry-coverage.json'):null;
if(coverage&&(coverage.levels.length!==3||coverage.levels.some(level=>level.missingSurfaces||level.movedSurfaces)))throw new Error('Geometry coverage failed; do not connect a damaged map.');
if(coverage?.deliverySha256&&coverage.deliverySha256!==createHash('sha256').update(model).digest('hex'))throw new Error('Geometry audit belongs to a different delivery model');
const preserved=['shared/physics.js','shared/flight-controller.js','content/drones/kestrel/drone.json'];
if(!existsSync(staging+'preserved-hashes.json'))write(staging+'preserved-hashes.json',Object.fromEntries(preserved.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])));
mkdirSync(folder,{recursive:true});copyFileSync(staging+'model.glb',folder+'model.glb');
// Outdoor triangle contacts contain millions of coordinates. Keep canonical JSON
// compact as well as the delivery copy; indentation adds tens of MiB here.
writeFileSync(folder+'collision.json',JSON.stringify(read(staging+'collision.json').items)+'\n');
const map={...profile.map,id:profile.id,bounds:assembly.bounds,
  model:'model.glb',modelNode:prefix+'Environment',collisionFile:'collision.json',colliders:[],materials:[],objects,
  contentStatus:'temporary demo; local acceptance in progress',credits:profile.provenance.author};
write(folder+'map.json',map);
write('content/races/'+race.id+'/race.json',race);
const practice={...race,id:profile.course.practiceId,name:profile.course.practiceName,gates:race.gates.slice(0,profile.course.practiceCount)};
if(practice.objects){
  const relative=value=>Array.isArray(value)?value.map(relative):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,relative(item)])):value==='props.glb'?'../'+race.id+'/props.glb':value;
  practice.objects=relative(practice.objects);practice.laps=1;
}
write('content/races/'+practice.id+'/race.json',practice);
write('content/tutorials/'+profile.tutorial.id+'/tutorial.json',{id:profile.tutorial.id,name:profile.tutorial.name,map:map.id,track:practice.id,
  steps:profile.tutorial.steps||[{text:'Raise throttle gently. Hold above '+profile.tutorial.altitude+' m for '+profile.tutorial.duration+' seconds.',objective:'altitude',target:profile.tutorial.altitude,duration:profile.tutorial.duration},
    ...practice.gates.map((g,i)=>({text:'Follow the arrow through gate '+(i+1)+'. Leave clearance from walls and overhead obstacles.',objective:'gate',target:i,duration:0})),
    {text:'Slow down in an open area, lower throttle and hold a safe landing for two seconds.',objective:'land',target:0,duration:2}]});
write('content/challenges/'+profile.challenge.id+'/challenge.json',{...profile.challenge,map:map.id,track:race.id});
copyFileSync(profilePath,folder+'import-profile.json');
if(coverage)write(folder+'geometry-coverage.json',coverage);
if(existsSync(staging+'material-audit.json'))write(folder+'material-audit.json',read(staging+'material-audit.json'));
const terrainReport=existsSync(staging+'terrain-report.json')?read(staging+'terrain-report.json'):null;
const recovered=read(staging+'resources.json');
if(terrainReport)write(folder+'terrain-report.json',terrainReport);
write(folder+'SOURCE.json',{...profile.provenance,
  materialAdapters:profile.materialAdapters||{},materialAudit:existsSync(staging+'material-audit.json')?{file:'material-audit.json',checked:read(staging+'material-audit.json').checked,failures:read(staging+'material-audit.json').failures.length}:null,
  installedSource:manifest.source,scene:manifest.roots[0],recoveredOn:new Date().toISOString().slice(0,10),tools:['AssetRipper Free 2.0.0','Blender 5.1.0','Microsoft DirectXTex 2026.5','KTX-Software 4.4.2'],
  sceneBundleSha256:createHash('sha256').update(readFileSync(manifest.bundles[0].source)).digest('hex'),
  changes:['Original scene layout and authored meshes retained; X handedness and UV orientation converted; browser PBR and KTX2 prepared.',
    recovered.lightmaps?.length?'Recovered lightmaps sampled into vertex lighting with ambient adaptation.':'No source lightmaps were recovered; adapted browser lighting is used.',
    terrainReport?'Native terrain heights, painted layer weights and vegetation recovered; see terrain-report.json for static rendering adaptations.':'',
    'Spatial material LODs use '+profile.lod.cellSize+' metre cells.',profile.lod.preserveGeometry?'Opaque surface geometry retained at all levels; no COLLAPSE decimation.':'',
    profile.lod.instanceVegetation?'Authored terrain vegetation geometry and colors are shared without flattening placements; GPU batches remain inside each spatial LOD root.':'',
    profile.lod.terrainNormalSize?'Terrain patch normal maps are limited to '+profile.lod.terrainNormalSize+' pixels for the browser texture budget; source color maps and editable source textures retain their prepared resolution.':'',
    'Seasonal event hierarchies excluded. Floor UVs retained at distance; small transparent overlays and terrain detail grass fade at the far LOD. Original courses use their authored frames and have separate SOURCE records. Practice and missions have separate IDs.'].filter(Boolean).join(' '),
  terrain:terrainReport?{report:'terrain-report.json',heightSamples:terrainReport.terrains.reduce((n,t)=>n+t.samples,0),authoredInstances:terrainReport.authoredInstances,grassInstances:terrainReport.grassInstances||0}:null,
  limitations:['Appearance is adapted rather than lossless.','Source sphere/capsule colliders currently use conservative oriented boxes.','Target FPS on UHD 620 has not been measured.',...(terrainReport?.limitations||[]),...Object.entries(profile.materialAdapters||{}).filter(([name,adapter])=>adapter.includes('approximated')).map(([name,adapter])=>name+': '+adapter)],
  recovery:{objects:assembly.objects,sourceTriangles:assembly.triangles,totalTrianglesAcrossLods:runtime.triangles,colliders:assembly.collisionProxies,bundles:manifest.bundles.length,modelBytes:statSync(folder+'model.glb').size}});
console.log({map:map.id,race:race.id,tutorial:profile.tutorial.id,challenge:profile.challenge.id,bytes:model.length});
