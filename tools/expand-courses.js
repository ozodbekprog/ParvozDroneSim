import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';

// Run once against an immutable backup. Re-running against that backup is idempotent.
const root=resolve(import.meta.dirname,'..');
const args=process.argv.slice(2), sourceArg=args.indexOf('--source');
const supportsOnly=args.includes('--supports-only');
if(!supportsOnly && sourceArg<0) throw new Error('Supply --source <original content backup>');
const source=supportsOnly?join(root,'content'):resolve(args[sourceArg+1]);
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const write=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const point=p=>p.map((v,i)=>Number((v*(i===1?1.35:2)).toFixed(5)));
const boxes=items=>(items||[]).map(c=>c.type==='mesh'?{...c,vertices:c.vertices.map((v,i)=>v*(i%3===1?1.35:2))}:{...c,position:point(c.position),size:point(c.size)});
const objects=items=>(items||[]).map(o=>({...o,position:o.position?point(o.position):undefined}));
const opening=(gate,track,index)=>{
  const beginner=track.map==='hangar' && track.id!=='hangar-circuit';
  const gateClass=beginner || index%6===0 || index%6===2 || index%6===5 ? 'open' : index%6===3?'precision-5':'sport-7';
  const [width,height]=gateClass==='precision-5'?[1.8,1.6]:gateClass==='sport-7'?[3,2.4]:[Math.max(6,Math.min(9,gate.width)),Math.max(4.2,Math.min(6,gate.height))];
  // Keep the opening above the floor; moving down instead of raising it can put it in scenery.
  return {...gate,position:point(gate.position),width,height,gateClass,frameThickness:gateClass==='precision-5'?.1:gateClass==='sport-7'?.13:.16,support:{type:'ground',baseY:0}};
};
let courses=0;
for(const folder of readdirSync(join(source,'races'))) {
  const file=join(source,'races',folder,'race.json');if(!existsSync(file))continue;
  const old=read(file),track=supportsOnly?old:{...old,spawn:{...old.spawn,position:point(old.spawn.position)},gates:old.gates.map((gate,i)=>opening(gate,old,i))};
  const mapFolder=join(root,'content/maps',track.map),map=read(join(mapFolder,'map.json'));
  const colliders=existsSync(join(mapFolder,'collision.json'))?read(join(mapFolder,'collision.json')):map.colliders||[];
  for(const gate of track.gates) {
    const bottom=gate.position[1]-gate.height/2;
    let baseY=0;
    const legs=[-1,1].map(sign=>[gate.position[0]+sign*(gate.width/2+.08)*Math.cos(gate.yaw),gate.position[2]-sign*(gate.width/2+.08)*Math.sin(gate.yaw)]);
    for(const c of colliders) {
      if(!c.size || Math.abs(c.rotation?.[0]||0)>.01 || Math.abs(c.rotation?.[2]||0)>.01)continue;
      const top=c.position[1]+c.size[1]/2;
      if(top<baseY+.02 || top>bottom-.05)continue;
      const yaw=c.rotation?.[1]||0,co=Math.cos(yaw),si=Math.sin(yaw);
      if(legs.every(([x,z])=>Math.abs((x-c.position[0])*co-(z-c.position[2])*si)<c.size[0]/2-.06 && Math.abs((x-c.position[0])*si+(z-c.position[2])*co)<c.size[2]/2-.06))baseY=top;
    }
    gate.support={type:baseY>.1?'roof':'ground',baseY:Number(baseY.toFixed(4))};
  }
  write(join(root,'content/races',folder,'race.json'),track);courses++;
}
if(!supportsOnly) {
  for(const category of ['challenges','tutorials'])for(const folder of readdirSync(join(source,category))) {
    const singular=category==='challenges'?'challenge':'tutorial',file=join(source,category,folder,singular+'.json');if(!existsSync(file))continue;
    const entry=read(file);
    if(entry.objects)entry.objects=objects(entry.objects);
    if(entry.colliders)entry.colliders=boxes(entry.colliders);
    if(category==='challenges')entry.target=Math.min(3600,Math.round(entry.target*1.75));
    else for(const step of entry.steps)if(step.objective==='reach'){step.position=point(step.position);step.radius=Number((step.radius*1.35).toFixed(3));}
    write(join(root,'content',category,folder,singular+'.json'),entry);
  }
}
console.log(`${courses} courses updated; ${supportsOnly?'supports refreshed from map collision':'original IDs, gate order and objectives preserved'}.`);
