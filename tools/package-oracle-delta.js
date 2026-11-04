// Compare a prepared candidate with the retained deployed inventory; never include secrets.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,join,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const [release,baselineFile]=process.argv.slice(2);
if(!/^\d{8}-[a-z0-9-]+$/.test(release||'')||!baselineFile)throw Error('Usage: package-oracle-delta.js RELEASE BASELINE_RELEASE_JSON');
const root=resolve(import.meta.dirname,'..'),stage=join(root,'data/oracle-release-'+release),patch=join(root,'data/oracle-patch-'+release);
if(existsSync(patch))throw Error('Delta already exists; do not overwrite a reviewed archive.');
const record=JSON.parse(readFileSync(join(stage,'RELEASE.json'))),baseline=JSON.parse(readFileSync(resolve(root,baselineFile)));
if(record.previousRevision!==baseline.revision)throw Error('Unexpected production baseline revision.');
const safe=(base,file)=>{if(!file||file.includes('\\')||file.startsWith('/')||file.split('/').some(x=>x==='..')||/\.env$|\.sqlite|\.key$|\.pem$|\.blend\d*$/.test(file))throw Error('Unsafe/private release path');const p=resolve(base,file);if(!p.startsWith(base+sep))throw Error('Unsafe target');return p;};
const byHash=new Map(baseline.inventory.map(item=>[item.sha256,item]));
const files=[],reuse=[],inventory=[];
const newFilesByHash=new Map();
for(const item of record.inventory){
 const from=safe(stage,item.file),bytes=readFileSync(from),sha256=createHash('sha256').update(bytes).digest('hex');
 const current={file:item.file,bytes:bytes.length,sha256};inventory.push(current);
 const previous=byHash.get(sha256);
 if(previous&&previous.bytes===bytes.length){reuse.push({...current,sourceFile:previous.file});continue;}
 const duplicate=newFilesByHash.get(sha256);
 if(duplicate&&duplicate.bytes===bytes.length){files.push({...current,sourceFile:duplicate.file});continue;}
 const destination=safe(patch,item.file);mkdirSync(dirname(destination),{recursive:true});copyFileSync(from,destination);files.push(current);
 newFilesByHash.set(sha256,current);
}
mkdirSync(patch,{recursive:true});
const removed=baseline.inventory.map(i=>i.file).filter(file=>!inventory.some(i=>i.file===file));
const catalog=JSON.parse(readFileSync(join(stage,'public/content/catalog.json')));
const result={...record,inventory,previousRelease:baseline.release,status:'staged-not-deployed',browserVerified:false,buildVerified:true,contentVerified:true,sourceCommit:null};
const manifest={release,previousRelease:baseline.release,previousRevision:baseline.revision,revision:record.revision,protocol:record.protocol,files,reuse,removed};
writeFileSync(join(patch,'PATCH.json'),JSON.stringify(manifest,null,2)+'\n');writeFileSync(join(patch,'RELEASE.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({patch,changed:files.length,reused:reuse.length,deduplicatedFiles:files.filter(item=>item.sourceFile).length,uploadBytes:[...newFilesByHash.values()].reduce((n,i)=>n+i.bytes,0),revision:catalog.revision,protocol:record.protocol,browserVerified:false}));
