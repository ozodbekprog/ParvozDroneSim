import {readFileSync,writeFileSync} from 'node:fs';
import {profile,recoveryFolder} from './content-import-profile.js';
import {clearImportedSpawn} from './import-spawn-clearance.js';
import {importedGatePassage} from './import-gate-passages.js';
const read=file=>JSON.parse(readFileSync(file)),save=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n');
if(!profile.trackOptions?.adaptSpawnClearance)throw Error('Spawn adaptation requires an explicit import profile option');
const scene=read(recoveryFolder+'collision.json').items,spheres=read('content/drones/kestrel/drone.json').collision.spheres,report=[];
for(const track of read(recoveryFolder+'imported-tracks.json')){
  const folder='content/races/'+track.id+'/',race=read(folder+'race.json'),source=read(folder+'SOURCE.json');
  const prior=source.spawnClearance;
  const original=prior&&JSON.stringify(race.spawn)===JSON.stringify(prior.deliveredSpawn)?prior.sourceSpawn:race.spawn;
  const result=clearImportedSpawn(original,[...scene,...race.colliders||[]],{spheres});
  if(result.lift>0){
    race.spawn=result.spawn;
    source.spawnClearance={sourceSpawn:original,deliveredSpawn:result.spawn,liftMetres:result.lift,rule:'Height-only clearance for the Kestrel compound collision and a 0.18 metre centre probe; source X/Z and yaw retained. Search step 0.01 m, maximum 0.5 m.'};
    source.conversion=source.conversion.replace('and spawn preserved.','and horizontal spawn/heading preserved; vertical Kestrel clearance is recorded separately.');
    save(folder+'race.json',race);save(folder+'SOURCE.json',source);
  }
  if(profile.trackOptions.adaptCheckpointRespawn){
    const obstacles=[...scene,...race.colliders||[]],changes=[];
    for(const [index,gate] of race.gates.entries()){
      const normal=gate.axes?.normal||[Math.sin(gate.yaw),0,Math.cos(gate.yaw)],derived={position:gate.position.map((v,a)=>v+normal[a]*1.3),yaw:gate.yaw};
      try{clearImportedSpawn(gate.respawn||derived,obstacles,{spheres,radius:0,maxLift:0});continue;}catch(error){if(!error.message.includes('cannot be cleared'))throw error;}
      const point=importedGatePassage(gate,obstacles,{collision:{spheres}});if(!point)throw Error('No checkpoint recovery passage: '+race.id+' / '+index);
      const respawn={position:point.map((v,a)=>v+normal[a]*.5),yaw:gate.yaw};
      clearImportedSpawn(respawn,obstacles,{spheres,radius:0,maxLift:0});gate.respawn=respawn;changes.push({gate:index,derivedSpawn:derived,deliveredSpawn:respawn});
    }
    if(changes.length){source.checkpointRespawns={rule:'Blocked derived reset positions are moved to a verified legal aperture point 0.5 metres beyond the source portal. Gate geometry/order remain unchanged.',changes};save(folder+'race.json',race);save(folder+'SOURCE.json',source);}
  }
  report.push({id:race.id,liftMetres:result.lift,position:result.spawn.position});
}
save(recoveryFolder+'spawn-clearance.json',report);console.log(report);
