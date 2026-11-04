// Follow the authored partData pointer; prefab transforms do not contain part specifications.
import {readFileSync,writeFileSync} from 'node:fs';
import {RipperClient} from './assetripper-client.js';
import {recoveryFolder} from './content-import-profile.js';
const config=JSON.parse(readFileSync(recoveryFolder+'gate-prefab-config.json','utf8'));
const client=new RipperClient(),parts={};
for(const record of Object.values(config.records)){
  const structure=record.data.m_Structure;
  if(!structure?.id || !structure.partData || parts[structure.id])continue;
  const pointer=await client.pointer(record.collection,structure.partData);
  if(pointer)parts[structure.id]=await client.json(pointer);
}
if(!Object.keys(parts).length)throw new Error('No authored part specifications were recovered.');
writeFileSync(recoveryFolder+'part-data.json',JSON.stringify(parts,null,2)+'\n');
console.log('Authored physical specifications:',Object.keys(parts).length);
