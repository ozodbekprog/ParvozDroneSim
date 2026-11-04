// Unity LegacyResources TextAssets contain length-prefixed UTF-8 track/race XML.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {profile,recoveryFolder} from './content-import-profile.js';
const catalog=JSON.parse(readFileSync(join(profile.source,profile.catalogPath),'utf8'));
const buckets=Buffer.from(catalog.m_BucketDataString,'base64'),keys=Buffer.from(catalog.m_KeyDataString,'base64');
const sceneName=profile.roots[0].split('/').at(-1).replace('.unity',''),selected=[];
for(let n=0,cursor=4;n<buckets.readInt32LE(0);n++){
  const offset=buckets.readInt32LE(cursor),count=buckets.readInt32LE(cursor+4);
  if(keys[offset]===0){const key=keys.toString('utf8',offset+5,offset+5+keys.readInt32LE(offset+1));
    if(key.startsWith('Shared/Tracks/'+sceneName+'Track')||key.startsWith('Shared/Races/'+sceneName+'Race'))selected.push(key);
  }cursor+=8+count*4;
}
if(!selected.length)throw new Error('No catalog tracks for '+sceneName);
const source=join(profile.source,'Liftoff_Data/resources.assets'),bytes=readFileSync(source),folder=recoveryFolder+'source-tracks/';mkdirSync(folder,{recursive:true});
const recovered=[];
for(const key of selected){
  const name=key.split('/').at(-1);let offset=-1,xml;
  while((offset=bytes.indexOf(name,offset+1))>=0){
    if(offset<4||bytes.readUInt32LE(offset-4)!==Buffer.byteLength(name))continue;
    const sizeOffset=Math.ceil((offset+Buffer.byteLength(name))/4)*4,length=bytes.readUInt32LE(sizeOffset),start=sizeOffset+4;
    if(length<=0||start+length>bytes.length)continue;
    const candidate=bytes.subarray(start,start+length).toString('utf8');
    const root=key.startsWith('Shared/Tracks/')?'Track':'Race';
    if(!candidate.startsWith('<?xml')||!candidate.includes('<'+root+' ')||!candidate.trimEnd().endsWith('</'+root+'>'))continue;
    xml=candidate;break;
  }
  if(!xml)throw new Error('Missing verified TextAsset XML: '+key);
  writeFileSync(folder+name+'.xml',xml);
  recovered.push({key,name,file:name+'.xml',bytes:Buffer.byteLength(xml),sha256:createHash('sha256').update(xml).digest('hex')});
}
writeFileSync(folder+'manifest.json',JSON.stringify({scene:sceneName,source,sourceSha256:createHash('sha256').update(bytes).digest('hex'),recovered},null,2));
console.log({scene:sceneName,tracks:recovered.filter(r=>r.key.includes('/Tracks/')).length,races:recovered.filter(r=>r.key.includes('/Races/')).length,folder});
