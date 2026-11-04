// Remove complete source hierarchies, including their collision descendants.
import {readFileSync,writeFileSync} from 'node:fs';
import {profile,recoveryFolder} from './content-import-profile.js';
const records=JSON.parse(readFileSync(recoveryFolder+'scene-metadata.json','utf8'));
const patterns=(profile.excludeObjectPrefixes||[]).map(s=>s.toLowerCase());
const parent=new Map(Object.values(records).filter(r=>r.type==='Transform').map(r=>[r.data.m_GameObject.m_PathID,r.data.m_Father.m_PathID==='0'?null:records[r.data.m_Father.m_PathID].data.m_GameObject.m_PathID]));
const excluded=new Set(),direct=[];
for(const [id,r] of Object.entries(records))if(r.type==='GameObject'&&patterns.some(p=>r.name.toLowerCase().startsWith(p))){excluded.add(id);direct.push({id,name:r.name});}
const inherited=id=>{if(excluded.has(id))return true;const p=parent.get(id);if(p&&inherited(p)){excluded.add(id);return true;}return false;};
for(const id of parent.keys())inherited(id);
writeFileSync(recoveryFolder+'source-exclusions.json',JSON.stringify({prefixes:profile.excludeObjectPrefixes||[],objects:[...excluded],direct},null,2));
console.log({excludedGameObjects:excluded.size,directMatches:direct.length});
