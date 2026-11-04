import { readdirSync,readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync,statSync,rmSync } from 'node:fs';
import { resolve,join,extname,basename,dirname,sep,relative } from 'node:path';
import { createHash } from 'node:crypto';
import { validateCatalog,validateColliders } from '../shared/catalog-schema.js';
import { inspectGlb } from './glb-content.js';
import {deduplicateGlbImages, GLB_IMAGE_DEDUP_VERSION} from './glb-image-dedup.js';
import {encodeCollisionBinary,COLLISION_BINARY_VERSION} from '../shared/collision-binary.js';

const categories={maps:'map',races:'race',drones:'drone',parts:'part',challenges:'challenge',tutorials:'tutorial'};
const slug=name=>name.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const write=(file,data)=>{mkdirSync(dirname(file),{recursive:true});const text=JSON.stringify(data,null,2);if(!existsSync(file)||readFileSync(file,'utf8')!==text)writeFileSync(file,text);};
const fingerprint=bytes=>createHash('sha256').update(bytes).digest('hex').slice(0,16);

export function initializeSources(root) {
  if(!existsSync(join(root,'content','maps'))) writeSources(root,read(join(root,'public/content/catalog.json')));
  const shared=join(root,'content/shared-assets');mkdirSync(shared,{recursive:true});
  for(const name of ['forest-floor.png','canyon-floor.png','concrete-floor.png']) {const original=join(root,'public/content/assets',name),target=join(shared,name);if(existsSync(original)&&!existsSync(target))copyFileSync(original,target);}
}
export function writeSources(root,catalog) {
  for(const [kind,singular] of Object.entries(categories)) mkdirSync(join(root,'content',kind),{recursive:true});
  const indexFile=join(root,'public/content/import-cache/files.json'),files=existsSync(indexFile)?read(indexFile):{};
  const canonical=(value,folder)=>{
    if(Array.isArray(value))return value.map(item=>canonical(item,folder));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,canonical(item,folder)]));
    if(typeof value==='string'&&value.startsWith('/content/assets/')){
      const imported=/^\/content\/assets\/imported\/([a-z0-9-]+)-[a-f0-9]{16}(\.[a-z]+)$/.exec(value),match=/\/([^/]+)-([a-f0-9]{16})(\.[a-z]+)$/.exec(value);
      const file=imported?join(root,'content/shared-assets/imported',imported[1]+imported[2]):match?Object.keys(files).find(file=>(files[file].hash===match[2]||files[file].imageDedup?.hash===match[2])&&slug(basename(file,extname(file)))===match[1]&&extname(file)===match[3]):null;
      if(file&&existsSync(file))return relative(folder,file).split(sep).join('/');
    }
    return value;
  };
  const enabled={...Object.fromEntries(['maps','drones','parts','challenges','tutorials'].map(kind=>[kind,new Set(catalog[kind].map(item=>kind==='parts'?`${item.category}-${item.id}`:item.id))])),races:new Set(catalog.maps.flatMap(map=>map.tracks.map(track=>track.id)))};
  for(const kind of Object.keys(categories))for(const entry of readdirSync(join(root,'content',kind),{withFileTypes:true}))if(entry.isDirectory()||entry.isSymbolicLink()&&statSync(join(root,'content',kind,entry.name)).isDirectory()){
    const file=join(root,'content',kind,entry.name,'.disabled');if(enabled[kind].has(entry.name)){if(existsSync(file))rmSync(file);}else if(existsSync(join(root,'content',kind,entry.name,`${categories[kind]}.json`)))writeFileSync(file,'Disabled by editor publication. Remove this file to restore the package.');
  }
  // Sources are the editable files. Generated catalog/hashed delivery files are disposable.
  for(const kind of ['maps','drones','parts','challenges','tutorials']) for(const original of catalog[kind]) {
    const folder=join(root,'content',kind,kind==='parts'?`${original.category}-${original.id}`:original.id),item=canonical(structuredClone(original),folder);
    if(kind==='maps') {
      if(original.collisionFile?.startsWith('/content/assets/')&&existsSync(join(root,'public',original.collisionFile.slice(1)))){write(join(folder,'collision.json'),read(join(root,'public',original.collisionFile.slice(1))));item.collisionFile='collision.json';item.colliders=[];}
      for(const track of item.tracks){
        const published=original.tracks.find(value=>value.id===track.id);
        if(published.collisionFile?.startsWith('/content/assets/')){track.colliders=validateColliders(read(join(root,'public',published.collisionFile.slice(1))));delete track.collisionFile;}
        delete track.preparedCollisionFile;
        write(join(root,'content/races',track.id,'race.json'),{...track,map:item.id});
      }
      delete item.tracks;delete item.preparedCollisionFile;
    }
    delete item.preparedCollisionFile;
    write(join(folder,`${categories[kind]}.json`),item);
  }
}

export function syncContent(root) {
  initializeSources(root);
  const source=join(root,'content'),target=join(root,'public/content/assets'),previous=read(join(root,'public/content/catalog.json'));
  const catalog={version:2,maps:[],drones:[],parts:[],challenges:[],tutorials:[]},races=[],warnings=[];
  const indexFile=join(root,'public/content/import-cache/files.json'),fileIndex=existsSync(indexFile)?read(indexFile):{},deliveries=new Map();
  const checkedFile=file=>{const absolute=resolve(file);if(!absolute.startsWith(source+sep))throw new Error('Asset path must stay inside content/: '+file);return absolute;};
  const fileHash=file=>{checkedFile(file);const stat=statSync(file),stamp=`${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;if(fileIndex[file]?.stamp!==stamp)fileIndex[file]={stamp,hash:fingerprint(readFileSync(file))};return fileIndex[file].hash;};
  const deliver=(file,kind,id)=>{
    if(resolve(file).startsWith(join(source,'shared-assets','drone-details')+sep)){kind='shared';id='drone-details';}
    if(resolve(file).startsWith(join(source,'shared-assets','liftoff-drone-parts')+sep)){kind='shared';id='liftoff-drone-parts';}
    // Parts can select nodes from their drone's GLB. Use its source package URL
    // so the browser shares the same decode, textures and network transfer.
    const owner=resolve(file).slice(source.length+1).split(sep);
    if(Object.hasOwn(categories,owner[0]) && owner.length>2){kind=owner[0];id=owner[1];}
    if(resolve(file).startsWith(join(source,'shared-assets','imported')+sep)){kind='imported';id='';}
    const sourceHash=fileHash(file),extension=extname(file).toLowerCase(),stem=slug(basename(file,extname(file)));
    let delivery=deliveries.get(file);
    if(!delivery){
      const cached=fileIndex[file].imageDedup;
      if(kind==='maps'&&extension==='.glb'){
        if(cached?.version===GLB_IMAGE_DEDUP_VERSION&&cached.sourceHash===sourceHash&&existsSync(join(target,kind,id,`${stem}-${cached.hash}${extension}`)))delivery={hash:cached.hash};
        else{
          const original=readFileSync(file),result=deduplicateGlbImages(original),bytes=result.bytes.length<original.length?result.bytes:original;
          delivery={hash:fingerprint(bytes),bytes};
          fileIndex[file].imageDedup={...result.report,version:GLB_IMAGE_DEDUP_VERSION,sourceHash,hash:delivery.hash,deliveryBytes:bytes.length};
        }
      }else delivery={hash:sourceHash};
      deliveries.set(file,delivery);
    }
    const name=`${stem}-${delivery.hash}${extension}`;
    const output=join(target,kind,id,name);mkdirSync(dirname(output),{recursive:true});if(!existsSync(output)){if(delivery.bytes)writeFileSync(output,delivery.bytes);else copyFileSync(file,output);}
    // The memo needs only identity after the generated file exists, not a
    // retained copy of every complete map buffer throughout content sync.
    delete delivery.bytes;
    return '/content/assets/'+[kind,id,name].filter(Boolean).join('/');
  };
  const rewrite=(item,folder,kind,id)=>{
    if(Array.isArray(item)) return item.map(value=>rewrite(value,folder,kind,id));
    if(item && typeof item==='object') return Object.fromEntries(Object.entries(item).map(([key,value])=>[key,rewrite(value,folder,kind,id)]));
    if(typeof item==='string' && /\.(glb|png|jpe?g|json)$/i.test(item) && !item.startsWith('/content/assets/')) {
      const file=resolve(folder,item);
      if(file!==source && !file.startsWith(source+sep)) throw new Error('Asset path must stay inside content/: '+item);
      if(existsSync(file)&&statSync(file).isFile()) return deliver(file,kind,id);
    }
    return item;
  };
  const publishCollision=(colliders,kind,id)=>{
    validateColliders(colliders);
    const json=Buffer.from(JSON.stringify(colliders)),sourceHash=createHash('sha256').update(json).digest('hex');
    const folder=join(target,kind,id),legacy=join(folder,`collision-${sourceHash.slice(0,16)}.json`);
    write(legacy,colliders);
    const key=`collision-binary:${kind}:${id}:${sourceHash}`,cached=fileIndex[key];
    let hash=cached?.version===COLLISION_BINARY_VERSION?cached.hash:null;
    if(!hash||!existsSync(join(folder,`collision-${hash}.pcol`))){
      const bytes=encodeCollisionBinary(colliders,{sourceHash});hash=fingerprint(bytes);
      const output=join(folder,`collision-${hash}.pcol`);mkdirSync(folder,{recursive:true});
      // Delivery paths are immutable and may be shared with a frozen patch.
      // Rebuilding a host-specific cache must not rewrite an existing inode.
      if(!existsSync(output))writeFileSync(output,bytes);
      else if(!readFileSync(output).equals(bytes))throw new Error('Prepared collision delivery differs from its content hash: '+output);
      fileIndex[key]={version:COLLISION_BINARY_VERSION,hash};
    }
    return {collisionFile:`/content/assets/${kind}/${id}/${basename(legacy)}`,preparedCollisionFile:`/content/assets/${kind}/${id}/collision-${hash}.pcol`};
  };
  for(const [kind,singular] of Object.entries(categories)) for(const entry of readdirSync(join(source,kind),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    if(entry.name.startsWith('.')) continue;
    const directory=entry.isDirectory()||entry.isSymbolicLink()&&statSync(join(source,kind,entry.name)).isDirectory();
    const folder=directory?join(source,kind,entry.name):join(source,kind);
    if(directory&&existsSync(join(folder,'.disabled')))continue;
    const definition=directory?join(folder,`${singular}.json`):join(folder,entry.name);
    const standalone=entry.isFile()&&entry.name.endsWith('.glb')?definition:null;
    if(!standalone && (!existsSync(definition)||!definition.endsWith('.json'))) {
      if(!directory || !existsSync(join(folder,'model.glb')) && !existsSync(join(folder,'scene.glb'))) continue;
    }
    let item=!standalone&&existsSync(definition)&&definition.endsWith('.json')?read(definition):{};
    const id=item.id||slug(basename(entry.name,extname(entry.name))); item.id=id; item.name ||=id.split('-').map(s=>s[0]?.toUpperCase()+s.slice(1)).join(' ');
    if(kind==='maps') {
      for(const challenge of item.bundledChallenges || []) catalog.challenges.push(rewrite(challenge,folder,kind,id));
      for(const tutorial of item.bundledTutorials || []) catalog.tutorials.push(rewrite(tutorial,folder,kind,id));
      delete item.bundledChallenges; delete item.bundledTutorials;
    }
    const model=standalone||['scene.glb','model.glb'].map(name=>join(folder,name)).find(existsSync);
    const thumbnail=['thumbnail.jpg','thumbnail.png'].find(name=>existsSync(join(folder,name)));if(thumbnail&&['maps','drones'].includes(kind))item.thumbnail=thumbnail;
    if(kind==='maps') {
      item={theme:'custom',region:'Custom map',description:'',sky:'#91b4cf',fog:'#9ab4bb',ground:'#777c78',sun:'#fff1cb',sunPosition:[68,95,45],wind:[0,0,0],gravity:1,colliders:[],tracks:[],...item};
      if(!item.model&&!model&&!item.groundTexture){const file=item.theme==='forest'?'forest-floor.png':item.theme==='canyon'?'canyon-floor.png':['hangar','industrial','neon','orbital','ruins'].includes(item.theme)?'concrete-floor.png':null;if(file&&existsSync(join(source,'shared-assets',file)))item.groundTexture=`../../shared-assets/${file}`;}
      const modelFile=item.model && !item.model.startsWith('/')?resolve(folder,item.model):model;
      if(modelFile) {
        const skipCollision=!!(item.collisionFile || item.colliders.length || existsSync(join(folder,'collision.json')));
        checkedFile(modelFile);const key=fingerprint(Buffer.from('v3:'+fileHash(modelFile)+JSON.stringify(item.modelTransform||{})+skipCollision)),cacheFile=join(root,'public/content/import-cache',`${key}.json`);
        const result=existsSync(cacheFile)?read(cacheFile):inspectGlb(readFileSync(modelFile),item.modelTransform,{skipCollision});if(!existsSync(cacheFile))write(cacheFile,result);
        if(!item.model || item.model.startsWith('/'))item.model=basename(modelFile);
        if(existsSync(join(folder,'collision.json'))) {
          const colliders=validateColliders(read(join(folder,'collision.json')));
          item.colliders=colliders;
          if(item.collisionFile) item.collisionFile='collision.json';
        }
        else if(!item.colliders.length && !item.collisionFile) item.colliders=result.colliders;
        if(result.gates.length) item.markerGates=result.gates; if(result.spawn) item.markerSpawn=result.spawn;
        const explicitCollision=item.collisionFile || existsSync(join(folder,'collision.json'));
        warnings.push(...result.warnings.filter(message=>!explicitCollision || !message.includes('Collision exceeds')).map(message=>`${id}: ${message}`));
      }
      // Compile explicit sidecars once, with the same stable serialization as mesh collision.
      if(item.colliders.some(c=>c.type==='mesh') || item.collisionFile==='collision.json') {
        Object.assign(item,publishCollision(item.colliders,'maps',id));item.colliders=[];
      }
    } else if(kind==='drones') {
      // A drone may borrow physics defaults, never another model's LODs/mounts.
      const base=previous.drones.find(d=>d.id==='kestrel') || {};
      const defaults=Object.fromEntries(['class','mass','arm','thrustToWeight','motorTau','drag','angularDrag','batterySeconds','color','inertia','rotorDrag','maxRpm','yawTorqueRatio'].filter(key=>base[key]!==undefined).map(key=>[key,base[key]]));
      item={...defaults,unlock:'starter',...item};
    }
    else if(kind==='parts') item={category:'frame',mass:0,thrust:1,response:1,drag:1,duration:1,durability:1,cost:0,...item};
    if(model && kind!=='maps') item.model=basename(model);
    item=rewrite(item,folder,kind,id);
    if(kind==='races') races.push(item);else catalog[kind].push(item);
  }
  for(const map of catalog.maps) {
    for(const {map:mapId,...race} of races.filter(r=>r.map===map.id)){const index=map.tracks.findIndex(t=>t.id===race.id);if(index<0)map.tracks.push(race);else map.tracks[index]=race;}
    if(!map.tracks.length) map.tracks=[{id:`${map.id}-course`,name:'Free flight course',laps:1,spawn:{position:[0,1.4,-12],yaw:0},gates:[{position:[0,3,10],yaw:0,width:8,height:6}]}];
    if(map.markerGates) {
      for(const track of map.tracks) { const markers=map.markerGates.filter(g=>!g.track?track===map.tracks[0]:g.track===track.id);if(markers.length)track.gates=markers.map(({track,...g})=>g); }
      delete map.markerGates;
    }
    if(map.markerSpawn) { map.tracks[0].spawn=map.markerSpawn;delete map.markerSpawn; }
    for(const track of map.tracks)if(track.colliders?.length){
      // Track prop collision belongs to preflight, not the startup JS/catalog payload.
      Object.assign(track,publishCollision(track.colliders,'races',track.id));track.colliders=[];
    }
  }
  const assets = new Map();
  const collect = value => {
    if (typeof value === 'string' && value.startsWith('/content/assets/')) {
      const file = join(root, 'public', value.slice(1));
      if (!existsSync(file)) throw new Error('Missing published asset: ' + value);
      assets.set(value, {url:value, bytes:statSync(file).size});
    } else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(catalog); catalog.assets = [...assets.values()].sort((a,b)=>a.url.localeCompare(b.url));
  validateCatalog(catalog);
  catalog.revision=fingerprint(Buffer.from(JSON.stringify(catalog)));
  write(join(root,'public/content/catalog.json'),catalog);
  write(indexFile,fileIndex);
  return {catalog,warnings};
}
