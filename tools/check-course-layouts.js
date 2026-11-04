// Read-only geometric audit. Straight-line segment warnings are not flight verdicts.
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {Matrix4,Quaternion,Euler,Vector3,Box3} from 'three';
import {prepareCollisions,collisionCandidates,sphereContacts} from '../shared/collision.js';
import {gateCollisionBoxes,gateFrameBoxes} from '../shared/gates.js';
import {gateCrossed} from '../shared/physics.js';

const root=resolve(import.meta.dirname,'..'),read=p=>JSON.parse(readFileSync(p,'utf8'));
const radius=.35,backup=join(root,'data/content-spacious-20260930-230248/content');
function modelBounds(file) {
  const bytes=readFileSync(file),g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString().trim());
  const total=new Box3();
  function visit(i,parent) {
    const n=g.nodes[i],local=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation||[0,0,0])),new Quaternion(...(n.rotation||[0,0,0,1])),new Vector3(...(n.scale||[1,1,1])));
    const world=parent.clone().multiply(local);
    if(n.mesh!==undefined)for(const p of g.meshes[n.mesh].primitives){const a=g.accessors[p.attributes.POSITION];if(a.min&&a.max)total.union(new Box3(new Vector3(...a.min),new Vector3(...a.max)).applyMatrix4(world));}
    for(const child of n.children||[])visit(child,world);
  }
  for(const n of g.scenes[g.scene||0].nodes)visit(n,new Matrix4());
  return {min:total.min.toArray(),max:total.max.toArray()};
}
const races=readdirSync(join(root,'content/races')).flatMap(id=>{const p=join(root,'content/races',id,'race.json');return existsSync(p)?[read(p)]:[];});
const report={radius,checkedMaps:[],pendingMaps:[],courses:[],note:'Indices are zero-based. Gate centres/spawns are hard findings; direct segment contacts are conservative route-design warnings. Course bounds use X/Z only: elevated gates may exceed scenery height.'};
for(const id of readdirSync(join(root,'content/maps'))) {
  const folder=join(root,'content/maps',id),mapFile=join(folder,'map.json');
  if(!existsSync(mapFile))continue;
  if(!existsSync(join(folder,'map.blend'))||!existsSync(join(folder,'model.glb'))||!existsSync(join(folder,'collision.json'))){report.pendingMaps.push(id);continue;}
  const map=read(mapFile),colliders=read(join(folder,'collision.json')),bounds=modelBounds(join(folder,'model.glb'));
  const authoring=existsSync(join(folder,'authoring.json'))?read(join(folder,'authoring.json')):{};
  if(authoring.horizontalScale!==2&&authoring.originalScale?.[0]!==2){report.pendingMaps.push(id);continue;}
  const oldFolder=join(backup,'maps',id),oldMap=existsSync(join(oldFolder,'map.json'))?read(join(oldFolder,'map.json')):{};
  const oldColliders=existsSync(join(oldFolder,'collision.json'))?read(join(oldFolder,'collision.json')):oldMap.colliders||[];
  const index=new Map(colliders.map((c,i)=>[c,i]));prepareCollisions(colliders);
  const classify=i=>i<(authoring.originalColliderCount??oldColliders.length)?'original collider':i<(authoring.originalColliderCount||0)+(authoring.originalStructureBoxes||0)?'original visual structure newly collidable':'new/other collider';
  const mapHits=p=>collisionCandidates(colliders,p,radius).filter(c=>sphereContacts(p,radius,c).length).map(c=>({index:index.get(c),origin:classify(index.get(c)),obstaclePosition:c.position,obstacleSize:c.size}));
  report.checkedMaps.push({id,colliders:colliders.length,bounds});
  for(const race of races.filter(r=>r.map===id)) {
    const gateBoxes=race.gates.flatMap((g,i)=>gateCollisionBoxes(g).map((b,j)=>({...b,gateIndex:i,part:gateFrameBoxes(g)[j].kind})));
    prepareCollisions(gateBoxes);
    const gateHits=p=>collisionCandidates(gateBoxes,p,radius).filter(c=>sphereContacts(p,radius,c).length).map(c=>({gateIndex:c.gateIndex,part:c.part}));
    const course={id:race.id,map:id,spawn:[],gates:[],directions:[],supports:[],bounds:[],segments:[]};
    const sh=mapHits(race.spawn.position),sg=gateHits(race.spawn.position);
    if(sh.length||sg.length)course.spawn.push({position:race.spawn.position,obstacles:sh,gateParts:sg});
    for(const [i,g] of race.gates.entries()) {
      const hits=mapHits(g.position),frames=gateHits(g.position);if(hits.length||frames.length)course.gates.push({gateIndex:i,position:g.position,obstacles:hits,gateParts:frames});
      const n=[Math.sin(g.yaw),0,Math.cos(g.yaw)];
      if(!gateCrossed(g.position.map((v,j)=>v-n[j]),g.position.map((v,j)=>v+n[j]),g))course.directions.push({gateIndex:i,kind:'normal crossing rejected'});
      const previous=i?race.gates[i-1].position:race.spawn.position;
      if(previous.reduce((s,v,j)=>s+(g.position[j]-v)*n[j],0)<=0)course.directions.push({gateIndex:i,kind:'previous checkpoint approaches reverse face',previous,position:g.position,yaw:g.yaw});
      if(i===0&&race.laps>1&&race.gates.at(-1).position.reduce((s,v,j)=>s+(g.position[j]-v)*n[j],0)<=0)course.directions.push({gateIndex:i,kind:'lap closure approaches reverse face',previous:race.gates.at(-1).position,position:g.position,yaw:g.yaw});
      if([0,2].some(a=>g.position[a]<bounds.min[a]||g.position[a]>bounds.max[a]))course.bounds.push({gateIndex:i,position:g.position});
      if(g.support&&['ground','roof'].includes(g.support.type)&&g.support.baseY>g.position[1]-g.height/2+1e-6)course.supports.push({gateIndex:i,support:g.support,openingBottom:g.position[1]-g.height/2});
    }
    const points=[race.spawn.position,...race.gates.map(g=>g.position),race.gates[0].position];
    for(let i=0;i<points.length-1;i++) {
      const a=points[i],b=points[i+1],steps=Math.ceil(Math.hypot(...b.map((v,j)=>v-a[j]))/.5),hits=new Map();
      for(let k=0;k<=steps;k++) {
        const p=a.map((v,j)=>v+(b[j]-v)*k/steps);
        for(const hit of mapHits(p))if(!hits.has('m'+hit.index))hits.set('m'+hit.index,{position:p,...hit});
        for(const hit of gateHits(p)){const key=`g${hit.gateIndex}-${hit.part}`;if(!hits.has(key))hits.set(key,{position:p,...hit});}
      }
      if(hits.size)course.segments.push({from:i===0?'spawn':i-1,to:i===points.length-2?0:i,count:hits.size,contacts:[...hits.values()].slice(0,6)});
    }
    report.courses.push(course);
  }
}
report.summary={maps:report.checkedMaps.length,courses:report.courses.length,spawnConflicts:report.courses.reduce((n,c)=>n+c.spawn.length,0),gateCentreConflicts:report.courses.reduce((n,c)=>n+c.gates.length,0),directionIssues:report.courses.reduce((n,c)=>n+c.directions.length,0),supportIssues:report.courses.reduce((n,c)=>n+c.supports.length,0),boundsIssues:report.courses.reduce((n,c)=>n+c.bounds.length,0),segmentWarnings:report.courses.reduce((n,c)=>n+c.segments.length,0)};
console.log(JSON.stringify(report,null,2));
