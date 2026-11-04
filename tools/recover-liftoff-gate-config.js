// Recover checkpoint trigger geometry, not the unrelated player/game scripts.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,basename} from 'node:path';
import {request} from 'node:http';
import {profile,recoveryFolder} from './content-import-profile.js';
const base=profile.assetRipperUrl;
const parse=text=>JSON.parse(text.replace(/("m_PathID"\s*:\s*)(-?\d+)/g,'$1"$2"'));
const names=new Set(),xmlFolder=recoveryFolder+'source-tracks/';
const namesFile=process.argv.find(v=>v.startsWith('--prefab-names='))?.slice(15);
if(namesFile)for(const name of JSON.parse(readFileSync(namesFile,'utf8')))names.add(name);
for(const file of namesFile?[]:readdirSync(xmlFolder).filter(f=>f.includes('Track')&&f.endsWith('.xml'))){
  const track=readFileSync(xmlFolder+file,'utf8');
  for(const m of track.matchAll(/<itemID>([^<]+)</g))names.add(m[1]);
}
const catalog=JSON.parse(readFileSync(join(profile.source,profile.catalogPath),'utf8')),buckets=Buffer.from(catalog.m_BucketDataString,'base64'),keys=Buffer.from(catalog.m_KeyDataString,'base64'),entries=Buffer.from(catalog.m_EntryDataString,'base64');
const assetIds=new Map();
const bucketList=[],selected=new Set(),keyList=[];
const visited=new Set();
function visit(entry){
  if(visited.has(entry))return;visited.add(entry);
  const offset=4+entry*28,internal=catalog.m_InternalIds[entries.readInt32LE(offset)];
  if(internal.endsWith('.bundle'))selected.add(basename(internal.replaceAll('\\','/')));
  const dependency=entries.readInt32LE(offset+8);
  if(dependency>=0)for(const child of bucketList[dependency]||[])visit(child);
}
for(let n=0,cursor=4;n<buckets.readInt32LE(0);n++){
  const o=buckets.readInt32LE(cursor),count=buckets.readInt32LE(cursor+4);
  bucketList.push(Array.from({length:count},(_,i)=>buckets.readInt32LE(cursor+8+i*4)));
  keyList.push(keys[o]===0?keys.toString('utf8',o+5,o+5+keys.readInt32LE(o+1)):null);cursor+=8+count*4;
}
for(const name of names){let index=keyList.indexOf(name);if(index<0){const matches=keyList.map((key,i)=>key?.endsWith('/'+name)?i:-1).filter(i=>i>=0);if(matches.length===1)index=matches[0];}if(index<0)throw new Error('Missing/ambiguous prefab asset '+name);
  for(const entry of bucketList[index]){assetIds.set(catalog.m_InternalIds[entries.readInt32LE(4+entry*28)],name);visit(entry);}
}
const loadBody=new URLSearchParams();for(const file of selected)loadBody.append('Path',join(profile.source,profile.bundlesPath,file));
if(!process.argv.includes('--loaded'))await new Promise((resolve,reject)=>{
  // Large UnityFS dependencies can exceed fetch's five-minute header timeout.
  const req=request(base+'/LoadFile',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'}},res=>{
    res.on('error',reject);res.resume();res.on('end',()=>[200,302].includes(res.statusCode)?resolve():reject(new Error('Prefab bundles failed to load: HTTP '+res.statusCode)));
  });req.on('error',reject);req.end(loadBody.toString());
});
const rootHtml=await(await fetch(base+'/Bundles/View?Path=%7B%22P%22%3A%5B%5D%7D')).text();
const bundleLinks=[...rootHtml.matchAll(/href="([^\"]+)"[^>]*>([^<]+)<\/a>/g)].filter(m=>m[1].startsWith('/Bundles/')&&selected.has(m[2]));
const collections=[];
for(const link of bundleLinks){const html=await(await fetch(base+link[1])).text();for(const m of html.matchAll(/href="([^\"]+)"[^>]*>([^<]+)<\/a>/g))if(m[1].startsWith('/Collections/'))collections.push({path:JSON.parse(decodeURIComponent(m[1].split('Path=')[1])),url:m[1]});}
const rows=[];
for(const c of collections){const html=await(await fetch(base+c.url)).text();for(const m of html.matchAll(/<tr data-class="([^"]+)"><td>([^<]+)<\/td><td>[^<]+<\/td><td><a href="([^"]+)"[^>]*>([^<]*)<\/a>/g))rows.push({type:m[1],id:m[2],url:m[3],name:m[4],collection:c.path});}
writeFileSync(recoveryFolder+'gate-prefab-rows.json',JSON.stringify(rows));
const records={};
const dependencyCache=new Map();
async function resolvePointer(collection,pointer){
  if(!pointer||pointer.m_PathID==='0')return null;
  if(pointer.m_FileID===0)return {collection,id:pointer.m_PathID};
  const key=JSON.stringify(collection);
  if(!dependencyCache.has(key)){
    const html=await(await fetch(base+'/Collections/View?Path='+encodeURIComponent(key))).text(),deps={};
    for(const m of html.slice(html.indexOf('<h2>Dependencies')).matchAll(/<tr><td>(\d+)<\/td><td><a href="([^\"]+)"/g))deps[m[1]]=JSON.parse(decodeURIComponent(m[2].split('Path=')[1]));
    dependencyCache.set(key,deps);
  }
  const target=dependencyCache.get(key)[pointer.m_FileID];if(!target)throw new Error('Missing mesh metadata dependency');
  return {collection:target,id:pointer.m_PathID};
}
async function asset(id,collection){
  const key=JSON.stringify(collection)+':'+id;
  if(records[key])return records[key].data;
  let row=rows.find(r=>r.id===id&&JSON.stringify(r.collection)===JSON.stringify(collection));
  if(!row){const html=await(await fetch(base+'/Collections/View?Path='+encodeURIComponent(JSON.stringify(collection)))).text();for(const m of html.matchAll(/<tr data-class="([^"]+)"><td>([^<]+)<\/td><td>[^<]+<\/td><td><a href="([^"]+)"[^>]*>([^<]*)<\/a>/g))rows.push({type:m[1],id:m[2],url:m[3],name:m[4],collection});row=rows.find(r=>r.id===id&&JSON.stringify(r.collection)===JSON.stringify(collection));}
  if(!row)throw new Error('Missing source prefab dependency: '+id);
  const address='{"C":'+JSON.stringify(collection)+',"D":'+id+'}';
  const response=await fetch(base+'/Assets/Json?Path='+encodeURIComponent(address));if(!response.ok)throw new Error('Prefab JSON failed: '+id);
  const data=parse(await response.text());records[key]={...row,data};return data;
}
async function gameObject(id,collection){
  const go=await asset(id,collection);
  for(const component of go.m_Components||go.m_Component||[]){const pointer=component.component||component.m_Component||component;if(pointer.m_FileID!==0)continue;const data=await asset(pointer.m_PathID,collection);
    if(data.m_Children)for(const child of data.m_Children){const transform=await asset(child.m_PathID,collection);await gameObject(transform.m_GameObject.m_PathID,collection);}
  }
}
const roots=[];
for(const row of rows.filter(r=>r.type==='AssetBundle')){
  const data=await asset(row.id,row.collection);
  for(const [guid,value] of Object.entries(data.m_Container||{}))if(assetIds.has(guid)){
    const p=await resolvePointer(row.collection,value.m_Asset);if(!p)throw new Error('Missing prefab container pointer');
    await asset(p.id,p.collection);const root=records[JSON.stringify(p.collection)+':'+p.id];
    roots.push({...root,name:assetIds.get(guid)});
  }
}
if(new Set(roots.map(r=>r.name)).size!==names.size||roots.length!==names.size){
  const missing=[...names].filter(name=>!roots.some(r=>r.name===name)),duplicates=[...names].filter(name=>roots.filter(r=>r.name===name).length>1);
  throw new Error('Ambiguous/missing addressable prefab roots: '+JSON.stringify({missing,duplicates,expected:names.size,recovered:roots.length,loadedSelectedBundles:bundleLinks.length,requiredBundles:selected.size}));
}
if(!roots.length)throw new Error('Prefab roots were not recovered. Selected bundles '+selected.size+', collections '+collections.length+', records '+rows.length);
for(const root of roots)await gameObject(root.id,root.collection);
for(const r of Object.values(records))if(r.type==='MonoBehaviour'&&r.data.m_Structure?.attachedRenderer){
  const renderer=records[JSON.stringify(r.collection)+':'+r.data.m_Structure.attachedRenderer.m_PathID];if(!renderer)continue;
  const go=renderer.data.m_GameObject.m_PathID;
  const filter=Object.values(records).find(v=>v.type==='MeshFilter'&&v.data.m_GameObject.m_PathID===go&&JSON.stringify(v.collection)===JSON.stringify(r.collection));
  if(filter){const p=await resolvePointer(filter.collection,filter.data.m_Mesh);if(p)await asset(p.id,p.collection);}
}
writeFileSync(recoveryFolder+'gate-prefab-config.json',JSON.stringify({bundles:[...selected],roots,records},null,2));
console.log({prefabs:roots.map(r=>r.name),records:Object.keys(records).length});
