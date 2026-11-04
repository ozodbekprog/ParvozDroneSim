import {readFileSync,readdirSync,unlinkSync,statSync} from 'node:fs';
import {resolve,join,sep,relative} from 'node:path';
const root=resolve('public/content/assets'),used=new Set();
function collect(value){if(typeof value==='string'&&value.startsWith('/content/assets/'))used.add(resolve('public',value.slice(1)));else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);}
collect(JSON.parse(readFileSync('public/content/catalog.json')));
let bytes=0,files=0;
function visit(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);if(!path.startsWith(root+sep))throw new Error('Cleanup escaped generated assets');
  if(entry.isDirectory())visit(path);
  else if(/-[a-f0-9]{16}\.(glb|json|png|jpe?g)$/.test(entry.name)&&!used.has(path)){bytes+=statSync(path).size;files++;if(process.argv.includes('--apply'))unlinkSync(path);}
}}
visit(root);console.log(JSON.stringify({apply:process.argv.includes('--apply'),generatedRoot:root,unusedFiles:files,reclaimMiB:Math.round(bytes/1048576)}));
