// Stage a reviewable release without databases, secrets, backups or unlicensed imports.
import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {syncContent} from './content-packages.js';
const root=resolve(import.meta.dirname,'..'), target=join(root,'data/menu-qa/release-20261010');
if(existsSync(target))throw new Error('Release stage already exists; do not overwrite reviewed content.');
const copy=(from,to=from,filter)=>{const out=resolve(target,to);if(!out.startsWith(target+sep))throw new Error('Invalid staged target');mkdirSync(resolve(out,'..'),{recursive:true});cpSync(join(root,from),out,{recursive:true,filter});};
for(const file of ['package.json','package-lock.json','index.html','vite.config.js','Dockerfile','compose.production.yaml','.dockerignore','README.md'])copy(file);
for(const folder of ['src','shared','server'])copy(folder);
copy('deploy','deploy',path=>!path.endsWith('.env')&&!path.endsWith('previous-release.txt'));
for(const file of ['sync-content.js','content-packages.js','glb-content.js','content-worker.js','validate-content.js','backup-db.js','import-db.js','verify-backup.js','backup-remote.js','check-public.js'])copy('tools/'+file);
copy('public/content/recipes.js');copy('public/content/catalog.json');
for(const kind of ['maps','races','challenges','tutorials','drones','parts','shared-assets'])mkdirSync(join(target,'content',kind),{recursive:true});
const assetsOnly=path=>!path.endsWith('.blend')&&!path.endsWith('.blend1')&&!path.includes(sep+'.archive-content');
copy('content/maps/ironworks-v2','content/maps/ironworks-v2',assetsOnly);
for(const kind of ['races','challenges'])for(const entry of readdirSync(join(root,'content',kind))){
  const singular=kind==='races'?'race':'challenge',file=join(root,'content',kind,entry,singular+'.json');
  if(existsSync(file)&&JSON.parse(readFileSync(file)).map==='ironworks-v2')copy('content/'+kind+'/'+entry,undefined,assetsOnly);
}
for(const kind of ['drones','parts'])copy('content/'+kind,undefined,assetsOnly);
const {catalog}=syncContent(target);
if(catalog.maps.length!==1||catalog.maps[0].id!=='ironworks-v2')throw new Error('Only licensed Ironworks may ship in this stage');
let bytes=0;const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())walk(path);else{if(/\.sqlite(?:-wal|-shm)?$|\.db$|\.env$/.test(path))throw new Error('Private data in release stage');bytes+=statSync(path).size;}}};walk(target);
writeFileSync(join(target,'RELEASE.json'),JSON.stringify({date:'2026-10-10',brand:'Vector FPV',status:'staged-not-deployed',maps:catalog.maps.map(m=>m.id),revision:catalog.revision,bytes,excluded:['Minus Two assets','archived maps','databases','env files','Blender sources'],browserVerified:false,targetHardwareVerified:false},null,2)+'\n');
console.log(JSON.stringify({stage:target,maps:catalog.maps.map(m=>m.id),revision:catalog.revision,MiB:(bytes/1048576).toFixed(1)}));
