import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';

const root=resolve(import.meta.dirname,'..'), content=join(root,'content');
const ids=['canyon','forest','hangar','harborworks','industrial','neon','nightgrid','orbital','pinecrest','ridgeway','ruins','sunscar'];
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const write=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const safe=path=>{const full=resolve(path);if(!full.startsWith(content+sep))throw new Error('Archive path outside content/');return full;};
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');

for(const id of ids) {
  const source=safe(join(content,'maps',id)),target=safe(join(content,'archived-maps',id));
  if(!existsSync(source))continue;
  if(existsSync(target))throw new Error('Archive already exists: '+id);
  const definition=read(join(source,'map.json')),original=structuredClone(definition),bundles={};
  for(const [kind,name] of [['races','race'],['challenges','challenge'],['tutorials','tutorial']]) {
    bundles[kind]=readdirSync(join(content,kind)).filter(folder=>{
      const file=join(content,kind,folder,name+'.json');return existsSync(file) && read(file).map===id;
    });
    const items=bundles[kind].map(folder=>read(join(content,kind,folder,name+'.json')));
    if(kind==='races') definition.tracks=items.map(({map,...track})=>track);
    else definition[kind==='challenges'?'bundledChallenges':'bundledTutorials']=items;
  }
  const inventory=[];
  const walk=folder=>{for(const entry of readdirSync(folder,{withFileTypes:true})){const file=join(folder,entry.name);if(entry.isDirectory())walk(file);else inventory.push({file:file.slice(source.length+1).split(sep).join('/'),sha256:sha(file)});}};
  walk(source);
  mkdirSync(join(content,'archived-maps'),{recursive:true});renameSync(source,target);
  write(join(target,'original-map.json'),original);write(join(target,'map.json'),definition);
  for(const [kind,folders] of Object.entries(bundles))for(const folder of folders) {
    const destination=safe(join(target,'.archive-content',kind,folder));mkdirSync(resolve(destination,'..'),{recursive:true});
    renameSync(safe(join(content,kind,folder)),destination);
  }
  for(const file of inventory)if(file.file!=='map.json' && sha(join(target,file.file))!==file.sha256)throw new Error('Archive verification failed: '+file.file);
  write(join(target,'archive-manifest.json'),{id,created:'2026-10-10',inventory,bundles,restore:'Copy this entire folder to content/maps/'+id+', then run npm run content:sync. Bundled courses, missions and lessons install automatically.'});
  console.log('Archived and verified: '+id);
}
