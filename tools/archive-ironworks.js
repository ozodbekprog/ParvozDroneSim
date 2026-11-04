import {cpSync,readFileSync,writeFileSync,existsSync,readdirSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),id='ironworks-v2',source=join(root,'content/maps',id),target=join(root,'content/archived-maps',id);
if(!existsSync(source)||existsSync(target))throw Error('Expected active Ironworks and a fresh archive target');
const read=p=>JSON.parse(readFileSync(p)),write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
mkdirSync(target,{recursive:true});cpSync(source,target,{recursive:true});
const original=read(join(source,'map.json')),map=structuredClone(original),moves=[];
function addMove(path,name){
 const physical=realpathSync(path),allowed=[join(root,'content'),resolve('D:/DroneLiftoffUz-import-temp/preserved-cache/content-races')];
 if(!allowed.some(base=>physical.startsWith(base+sep)))throw Error('Unexpected source path '+physical);
 const destination=join(root,'data/removed-maps',name);if(existsSync(destination))throw Error('Removal backup already exists');
 moves.push({source:physical,destination});
}
addMove(source,id+'-original');
for(const[kind,file,key]of[['races','race','tracks'],['challenges','challenge','bundledChallenges'],['tutorials','tutorial','bundledTutorials']]){
 const entries=[];
 for(const folder of readdirSync(join(root,'content',kind))){const path=join(root,'content',kind,folder),json=join(path,file+'.json');if(!existsSync(json))continue;const value=read(json);if(value.map!==id)continue;
   const destination=join(target,'.archive-content',kind,folder);mkdirSync(resolve(destination,'..'),{recursive:true});cpSync(path,destination,{recursive:true});
   entries.push(kind==='races'?(({map,...rest})=>rest)(value):value);addMove(path,kind+'-'+folder);
 }
 if(entries.length)map[key]=entries;
}
// Bundle the local garage dependency so restoring one map folder is sufficient.
if(map.garage?.model?.startsWith('..')){
 const model=resolve(source,map.garage.model),folder=join(target,'archive-assets');mkdirSync(folder,{recursive:true});
 cpSync(model,join(folder,'liftoff-workbench.glb'));cpSync(join(resolve(model,'..'),'SOURCE.json'),join(folder,'workbench-SOURCE.json'));
 map.garage.model='archive-assets/liftoff-workbench.glb';
}
write(join(target,'original-map.json'),original);write(join(target,'map.json'),map);
writeFileSync(join(target,'RESTORE.txt'),'Extract ironworks-v2 into content/maps/, then run npm run build. Courses and missions are bundled. Player data is not included. The bundled Liftoff garage is local-only.\n');
const inventory=[];
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())walk(path);else inventory.push({file:path.slice(target.length+1).split(sep).join('/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});}}
walk(target);write(join(target,'archive-manifest.json'),{id,date:'2026-10-13',inventory,restore:'Extract this whole folder into content/maps/ and build.',localGarageOnly:true});
write(join(root,'data/liftoff-workbench-recovery/ironworks-removal.json'),{target,moves});
console.log('Prepared self-contained archive:',inventory.length,'files; originals remain active until ZIP verification.');
