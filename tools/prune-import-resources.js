// Drop resources belonging only to excluded/inactive scene hierarchies.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {recoveryFolder} from './content-import-profile.js';
const folder=recoveryFolder,read=name=>JSON.parse(readFileSync(folder+name,'utf8'));
const resource=read('resources.json'),records=read(resource.records),excluded=new Set(read('source-exclusions.json').objects);
const transforms=new Map(Object.values(records).filter(r=>r.type==='Transform').map(r=>[r.data.m_GameObject.m_PathID,r.data])),cache=new Map();
function active(id){
  if(cache.has(id))return cache.get(id);
  const parent=transforms.get(id)?.m_Father.m_PathID;
  const value=!excluded.has(id)&&records[id]?.data.m_IsActive&&(parent==='0'||Boolean(parent&&active(records[parent].data.m_GameObject.m_PathID)));
  cache.set(id,value);return value;
}
const dependencies=resource.collectionDependencies[JSON.stringify(resource.scene)],used=new Set();
for(const r of Object.values(records))if(r.type==='MeshRenderer'&&r.data.m_Enabled&&active(r.data.m_GameObject.m_PathID))for(const p of r.data.m_Materials)used.add(JSON.stringify(dependencies[p.m_FileID])+':'+p.m_PathID);
const before={materials:resource.materials.length,textures:resource.textures.length};
resource.materials=resource.materials.filter(m=>used.has(m.key));
const textureKeys=new Set(resource.materials.flatMap(m=>Object.values(m.textures)));
resource.textures=resource.textures.filter(t=>textureKeys.has(t.key)||t.hdr);
if(!existsSync(folder+'resources-unfiltered.json'))writeFileSync(folder+'resources-unfiltered.json',readFileSync(folder+'resources.json'));
writeFileSync(folder+'resources.json',JSON.stringify(resource));
console.log({before,after:{materials:resource.materials.length,textures:resource.textures.length}});
