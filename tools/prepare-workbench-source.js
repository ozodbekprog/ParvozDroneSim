// Extract only three authored prop hierarchies; never export the full game.
import{readFileSync,writeFileSync,existsSync}from'node:fs';
import{profile,recoveryFolder}from'./content-import-profile.js';
import{RipperClient}from'./assetripper-client.js';
const c=new RipperClient(),scene=JSON.parse(readFileSync(recoveryFolder+'scene-collection.json'));
if(existsSync(recoveryFolder+'scene-metadata.json')){console.log('Reusing scoped workbench metadata');process.exit(0);}
const rows=(await c.collection(scene)).rows,lookup=new Map(rows.map(r=>[r.id,r])),records={};
async function record(id){id=String(id);if(records[id])return records[id];const row=lookup.get(id);if(!row)throw new Error('Missing prop component '+id);const v={type:row.type,name:row.name,data:await c.json({collection:scene,id})};records[id]=v;return v;}
const types=new Set(['Transform','MeshFilter','MeshRenderer','BoxCollider','MeshCollider','SphereCollider','CapsuleCollider']);
async function ancestors(t){const id=t.data.m_Father?.m_PathID;if(id&&id!=='0'){const p=await record(id);await record(p.data.m_GameObject.m_PathID);await ancestors(p);}}
async function walk(id){const go=await record(id);let transform;for(const component of go.data.m_Components||[]){const id=String(component.m_Component.m_PathID);if(!types.has(lookup.get(id)?.type))continue;const v=await record(id);if(v.type==='Transform')transform=v;}if(transform){await ancestors(transform);for(const child of transform.data.m_Children||[]){const t=await record(child.m_PathID);await walk(t.data.m_GameObject.m_PathID);}}}
for(const name of profile.selectedProps){const row=rows.find(r=>r.type==='GameObject'&&r.name===name);if(!row)throw new Error('Missing original prop '+name);await walk(row.id);}
writeFileSync(recoveryFolder+'scene-metadata.json',JSON.stringify(records));
writeFileSync(recoveryFolder+'input-manifest.json',JSON.stringify({source:profile.source,roots:profile.roots,sceneCollection:scene,bundles:[],selectedProps:profile.selectedProps},null,2));
console.log('Scoped props',profile.selectedProps,'records',Object.keys(records).length);
