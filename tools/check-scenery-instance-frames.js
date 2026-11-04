import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

const [folder,prefix='pine',output]=process.argv.slice(2);
if(!folder)throw Error('Usage: node tools/check-scenery-instance-frames.js CAPTURE_FOLDER [PREFIX] [REPORT_JSON]');
const read=name=>JSON.parse(readFileSync(join(folder,name)));
const payload=r=>({initialDrawCalls:r.phases.find(phase=>phase.name==='First rendered frame and post effects')?.draws,initialTriangles:r.phases.find(phase=>phase.name==='First rendered frame and post effects')?.triangles,batchGeometryAttributeBytes:r.batchResources.geometryAttributeBytes,sceneGeometryAttributeBytes:r.resources.geometryAttributeBytes,
 reachableBackingBufferBytes:r.resources.cpuBackingBufferBytes,instancedMeshes:r.batchResources.instancedMeshes,multiDrawBatches:r.batchResources.multiDrawBatches});
const before=read(prefix+'-original.json'),after=read(prefix+'-instances.json'),frames=[];
for(const suffix of ['','-gate','-reverse']){
 const left=prefix+'-original'+suffix,right=prefix+'-instances'+suffix,a=read(left+'-camera.json'),b=read(right+'-camera.json');
 for(const key of ['map','track','quality','framebuffer','adaptiveResolution','position','quaternion','fov'])if(!isDeepStrictEqual(a[key],b[key]))throw Error('Capture mismatch: '+key);
 const rawBefore=readFileSync(join(folder,left+'.jpg')),rawAfter=readFileSync(join(folder,right+'.jpg'));
 const first=await sharp(rawBefore).removeAlpha().raw().toBuffer(),second=await sharp(rawAfter).removeAlpha().raw().toBuffer();
 if(first.length!==second.length)throw Error('Image size mismatch');
 let sum=0,changedPixels=0,maxChannelDifference=0;
 for(let i=0;i<first.length;i+=3){let changed=false;for(let c=0;c<3;c++){const delta=Math.abs(first[i+c]-second[i+c]);sum+=delta;maxChannelDifference=Math.max(maxChannelDifference,delta);changed ||= delta!==0;}if(changed)changedPixels++;}
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 frames.push({angle:suffix.slice(1)||'overview',cameraAndSettingsIdentical:true,framebuffer:a.framebuffer,beforeSha256:sha(rawBefore),afterSha256:sha(rawAfter),
  pixels:first.length/3,changedPixels,meanAbsoluteChannelDifference:sum/first.length,maxChannelDifference});
}
const report={checkedAt:new Date().toISOString(),method:'Real World scene loads, count reachable typed-array payloads, then compare matching exported JPEG RGB frames. Counts include inactive LOD/source data. Excludes driver/JS/renderer overhead and external caches. No FPS, process memory, loading-time or UHD 620 inference.',
 hardware:after.hardware,backend:after.backend,quality:after.quality,targetHardwareVerified:false,before:payload(before),after:payload(after),
 avoidedBatchGeometryBytes:before.batchResources.geometryAttributeBytes-after.batchResources.geometryAttributeBytes,
 avoidedSceneGeometryBytes:before.resources.geometryAttributeBytes-after.resources.geometryAttributeBytes,frames};
if(output)writeFileSync(resolve(output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
