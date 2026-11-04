import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
const ids=['metal_office_desk','metal_tool_chest','screwdrivers_02','bench_vice_01'];
for(const id of ids){
  const files=JSON.parse(readFileSync(`data/workbench-source/${id}-files.json`)),info=await(await fetch(`https://api.polyhaven.com/info/${id}`)).json();
  const blend=files.blend['1k'].blend,folder=`content/source-assets/polyhaven-${id}`;
  const entries=[[id+'.blend',blend],...Object.entries(blend.include)];
  for(const [name,file] of entries){
    const path=join(folder,name);mkdirSync(dirname(path),{recursive:true});
    let bytes=existsSync(path)?readFileSync(path):null;
    if(!bytes || createHash('md5').update(bytes).digest('hex')!==file.md5)bytes=Buffer.from(await(await fetch(file.url)).arrayBuffer());
    if(createHash('md5').update(bytes).digest('hex')!==file.md5)throw new Error('Source checksum failed: '+path);
    writeFileSync(path,bytes);
  }
  writeFileSync(join(folder,'SOURCE.json'),JSON.stringify({name:info.name,authors:info.authors,source:`https://polyhaven.com/a/${id}`,license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',download:blend.url,md5:blend.md5},null,2)+'\n');
  console.log('Verified authored source',id);
}
