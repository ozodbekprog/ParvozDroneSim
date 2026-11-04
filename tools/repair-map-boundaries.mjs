// Retire only identified invisible source walls; preserve every other collider.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {sourceHierarchy,sourceBoxCollider,sameBox} from './import-source-hierarchy.js';
const apply=process.argv.includes('--apply'),selected=process.argv.find(v=>v.startsWith('--map='))?.slice(6);
const ids=selected?[selected]:['hangar-c03-demo','liftoff-arena-demo','minus-two-demo','liftoff-pine-valley-demo','liftoff-the-green-demo'];
for(const id of ids){
  const profileFile='tools/import-profiles/'+id+'.json',profile=JSON.parse(readFileSync(profileFile));
  const resources=JSON.parse(readFileSync(profile.staging+'/resources.json'));
  const records=JSON.parse(readFileSync(profile.staging+'/'+resources.records)),hierarchy=sourceHierarchy(records);
  const file='content/maps/'+id+'/collision.json',colliders=JSON.parse(readFileSync(file));
  const removed=[],indices=new Set();
  for(const [identity,record] of Object.entries(records)){
    const d=record.data,go=d.m_GameObject?.m_PathID;
    if(record.type!=='BoxCollider'||!d.m_Enabled||d.m_IsTrigger||!hierarchy.active(go)||!hierarchy.excluded(go,['LevelWalls']))continue;
    const shape=sourceBoxCollider(d,hierarchy.world(go));
    const matches=colliders.map((c,i)=>sameBox(c,shape)?i:-1).filter(i=>i>=0);
    if(matches.length>1)throw Error('Ambiguous boundary shape: '+id+'/'+identity);
    if(matches.length)indices.add(matches[0]);
    removed.push({source:identity,path:hierarchy.path(go),index:matches[0]??null,shape});
  }
  if(!removed.length)throw Error('No source boundary walls: '+id);
  const report={map:id,policy:'Only source LevelWalls collision is retired. Physical scenery remains solid.',before:colliders.length,after:colliders.length-indices.size,removed};
  if(apply){
    profile.excludeCollisionObjectPrefixes=[...new Set([...(profile.excludeCollisionObjectPrefixes||[]),'LevelWalls'])];
    writeFileSync(profileFile,JSON.stringify(profile,null,2)+'\n');
    if(indices.size){
      writeFileSync(file,JSON.stringify(colliders.filter((_,i)=>!indices.has(i)))+'\n');
      writeFileSync('content/maps/'+id+'/boundary-repair.json',JSON.stringify(report,null,2)+'\n');
    }
    mkdirSync('data/map-repair-20261031',{recursive:true});
    writeFileSync('data/map-repair-20261031/'+id+'-boundaries.json',JSON.stringify(report,null,2));
  }
  console.log(JSON.stringify({map:id,boundaries:removed.length,matched:indices.size,before:report.before,after:report.after,apply}));
}
