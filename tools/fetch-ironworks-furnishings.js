// Free, editable authored furnishings. Never download an asset without its
// source/author/license record and a verified checksum.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
const root=resolve(import.meta.dirname,'../content/source-assets');
const headers={'User-Agent':'DroneLiftoffUz-Art/1.0'};
async function json(url){const r=await fetch(url,{headers});if(!r.ok)throw new Error(`${r.status}: ${url}`);return r.json();}
async function download(folder,name,file){
  const destination=resolve(folder,name);
  if(!destination.startsWith(folder+sep))throw new Error('Unsafe asset path');
  try{const b=await readFile(destination);if(createHash('md5').update(b).digest('hex')===file.md5)return;}catch{}
  const r=await fetch(file.url,{headers});if(!r.ok)throw new Error(`${r.status}: ${file.url}`);
  const b=Buffer.from(await r.arrayBuffer());
  if(createHash('md5').update(b).digest('hex')!==file.md5)throw new Error(`Checksum mismatch: ${name}`);
  await mkdir(dirname(destination),{recursive:true});await writeFile(destination,b);
}
const catalog=await json('https://api.polyhaven.com/assets?type=models');
for(const id of process.argv.length>2?process.argv.slice(2):['industrial_pastic_container','industrial_storage_cart','hanging_industrial_lamp']){
  const folder=resolve(root,id),files=await json(`https://api.polyhaven.com/files/${id}`),format=files.blend['1k'].blend;
  await download(folder,`${id}.blend`,format);
  for(const [name,file] of Object.entries(format.include||{}))await download(folder,name,file);
  await writeFile(resolve(folder,'SOURCE.json'),JSON.stringify({id,title:catalog[id].name,authors:catalog[id].authors,source:`https://polyhaven.com/a/${id}`,license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',files:format},null,2));
  console.log(`Verified editable source: ${id}`);
}
