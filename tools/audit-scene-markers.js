import {readFileSync,writeFileSync} from 'node:fs';
const report=[];
for(const id of ['minus-two-demo','hangar-c03-demo','liftoff-arena-demo']){
 const p=JSON.parse(readFileSync('tools/import-profiles/'+id+'.json')),folder=p.staging+'/',resources=JSON.parse(readFileSync(folder+'resources.json')),records=JSON.parse(readFileSync(folder+resources.records));
 const parent=new Map(Object.values(records).filter(r=>r.type==='Transform').map(r=>[r.data.m_GameObject.m_PathID,r.data.m_Father.m_PathID==='0'?null:records[r.data.m_Father.m_PathID]?.data.m_GameObject.m_PathID]));
 const marker=go=>{const name=records[go]?.name||'';return /^(RCSignal|StartPoint|PlayerDummy|DroneDummy|PowerBox|power_box-9|CombinedCharacter)/i.test(name)||parent.get(go)&&marker(parent.get(go));};
 const excluded=new Set(JSON.parse(readFileSync(folder+'source-exclusions.json')).objects);
 const colliders=Object.values(records).filter(r=>['BoxCollider','MeshCollider','CapsuleCollider','SphereCollider'].includes(r.type)&&r.data.m_Enabled&&!r.data.m_IsTrigger&&!excluded.has(r.data.m_GameObject.m_PathID)&&marker(r.data.m_GameObject.m_PathID)).map(r=>({type:r.type,id:r.id,name:records[r.data.m_GameObject.m_PathID]?.name}));
 const bytes=readFileSync('content/maps/'+id+'/model.glb'),json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 const visibleMarkers=(json.nodes||[]).filter(n=>/PlayerDummy|DroneDummy|PowerBox|CombinedCharacter/i.test(n.name||'')).map(n=>n.name);
 report.push({map:id,visibleMarkers,nonTriggerMarkerColliders:colliders});
}
writeFileSync('data/scene-marker-audit-20261013.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
