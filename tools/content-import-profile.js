import {readFileSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';

export const profilePath=resolve(process.env.CONTENT_IMPORT_PROFILE || 'tools/import-profiles/minus-two-demo.json');
export const profile=JSON.parse(readFileSync(profilePath,'utf8'));
const validId=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]{1,63}$/.test(id);
const propsOnly=profile.kind==='prop-set';
if(profile.adapter!=='liftoff-unity-2022'||!(propsOnly?[profile.id]:[profile.id,profile.course?.id,profile.course?.practiceId,profile.tutorial?.id,profile.challenge?.id]).every(validId))throw new Error('Invalid content import profile or unsupported adapter.');
if(!Array.isArray(profile.roots)||!profile.roots[0]?.endsWith('.unity'))throw new Error('The first catalog root must be the selected scene.');
const vec=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
if(!vec(profile.probe?.position,3)||!vec(profile.probe?.target,3)||!propsOnly&&(!vec(profile.course?.spawn?.position,3)||!vec(profile.course?.gridBounds,4)||!profile.course?.waypoints?.every(v=>vec(v,2))))throw new Error('Invalid probe, spawn or course coordinates.');
if(!vec(profile.lod?.distances,3)||profile.lod.distances[0]!==0||profile.lod.distances.some((v,i,a)=>i&&v<=a[i-1])||!vec(profile.lod?.ratios,2)||profile.lod.ratios.some(v=>v<=0||v>1)||!Number.isFinite(profile.lod.cellSize)||profile.lod.cellSize<=0||!Array.isArray(profile.lod.texturedFarMaterials))throw new Error('Invalid spatial LOD settings.');
if(profile.nodePrefix&&!/^[a-zA-Z0-9_]{1,80}$/.test(profile.nodePrefix))throw new Error('Invalid model node prefix.');
const stagingRelative=relative(resolve('data'),resolve(profile.staging));
if(!stagingRelative||stagingRelative.startsWith('..')||isAbsolute(stagingRelative))throw new Error('Each import needs its own staging directory within data/.');
export const recoveryFolder=profile.staging.replaceAll('\\','/').replace(/\/$/,'')+'/';
export const mapFolder=(propsOnly?'content/shared-assets/':'content/maps/')+profile.id+'/';
