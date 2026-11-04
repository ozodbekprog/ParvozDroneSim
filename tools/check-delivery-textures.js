import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Use the existing Khronos KTX CLI. This validates and actually transcodes all
// unique experimental textures; it is separate from the browser/GPU check.
const [manifestPath,ktxPath,output]=process.argv.slice(2);
if(!manifestPath||!ktxPath||!output)throw Error('Usage: node tools/check-delivery-textures.js delivery-manifest.json ktx-executable report.json');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8')),failures=[];let validated=0,transcoded=0,bytes=0;
for(const resource of manifest.resources.filter(row=>row.url.endsWith('.ktx2'))){
 try{
  if(!/^[a-f0-9]{32}\.ktx2$/.test(resource.url))throw Error('Unexpected texture resource path');
  const file=resolve(dirname(manifestPath),resource.url),data=readFileSync(file);
  if(data.byteLength!==resource.bytes||createHash('sha256').update(data).digest('hex')!==resource.sha256)throw Error('Texture integrity mismatch');
  bytes+=data.byteLength;
  for(const [mode,args]of [['validate',['validate','--gltf-basisu','--warnings-as-errors',file]],['transcode',['transcode','--target','rgba8','--stdout',file]]]){
   const result=spawnSync(resolve(ktxPath),args,{maxBuffer:16*1024*1024,windowsHide:true});
   if(result.error)throw result.error;
   if(result.status!==0)throw Error(`${mode}: ${result.stderr?.toString().slice(0,1000)||result.stdout?.toString().slice(0,1000)||result.status}`);
   if(mode==='validate')validated++;else if(result.stdout?.length>80)transcoded++;else throw Error('Empty texture transcode');
  }
 }catch(error){failures.push({url:resource.url,error:error.message});}
}
const report={manifest:resolve(manifestPath),ktx:resolve(ktxPath),textures:manifest.resources.filter(row=>row.url.endsWith('.ktx2')).length,validated,transcoded,bytes,failures,browserVerified:false};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,failures:failures.slice(0,3),failureCount:failures.length}));
if(failures.length)process.exitCode=1;
