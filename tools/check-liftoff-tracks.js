import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {profile,recoveryFolder,mapFolder} from './content-import-profile.js';
import {prepareCollisions,collisionCandidates,sphereContacts} from '../shared/collision.js';
import {resolveBuild} from '../shared/physics.js';
import {importedGatePassage} from './import-gate-passages.js';
const report=JSON.parse(readFileSync(recoveryFolder+'imported-tracks.json','utf8')),colliders=existsSync(mapFolder+'collision.json')?JSON.parse(readFileSync(mapFolder+'collision.json','utf8')):JSON.parse(readFileSync(recoveryFolder+'collision.json','utf8')).items;
prepareCollisions(colliders);
let activeColliders=colliders;
const clear=p=>collisionCandidates(activeColliders,p,.18).every(o=>sphereContacts(p,.18,o).length===0);
const manifest=JSON.parse(readFileSync(recoveryFolder+'source-tracks/manifest.json','utf8'));
const spec=resolveBuild();
assert.equal(report.length,manifest.recovered.filter(r=>r.key.includes('/Races/')).length);
assert.ok(report.length>0);
for(const item of report){
  const race=JSON.parse(readFileSync('content/races/'+item.id+'/race.json','utf8'));
  activeColliders=[...colliders,...race.colliders||[]];prepareCollisions(activeColliders);
  assert.equal(race.map,profile.id);assert.equal(race.gates.length,item.sourcePassages-1);
  assert.ok(clear(race.spawn.position),'Source spawn blocked: '+item.id);
  for(const [index,g] of race.gates.entries()){
    assert.ok(importedGatePassage(g,activeColliders,spec),'No clear original aircraft passage: '+item.id+' / '+index);
  }
}
console.log({importedRaces:report.length,sourceOrder:true,sourceSpawns:true,allCheckpointPassagesClear:true});
