import test from 'node:test';import assert from 'node:assert/strict';
import {commitIncremental,validateCommittedImage} from '../deploy/commit-incremental.js';
const image='sha256:'+'a'.repeat(64),container='b'.repeat(64),candidate='sha256:'+'c'.repeat(64),sourceCommit='d'.repeat(40),sharedAssets='1';
const previous={Id:image,Os:'linux',Architecture:'arm64',Config:{User:'node',Entrypoint:['docker-entrypoint.sh'],Cmd:['node','server/index.js'],Env:['NODE_ENV=production'],WorkingDir:'/app',Healthcheck:{Test:['CMD','node','health.js']},Volumes:{'/data':{}},Labels:{old:'retained'}},RootFS:{Layers:['base','assets']}};
const next=()=>({...structuredClone(previous),Id:candidate,Config:{...structuredClone(previous.Config),Labels:{old:'retained','org.opencontainers.image.revision':sourceCommit,'org.parvoz.shared-assets':sharedAssets}},RootFS:{Layers:['base','assets','patch']}});
function fixture({badMount=false,failCopy=false,badConfig=false}={}){
 const calls=[];const docker=(...args)=>{calls.push(args);
  if(args[0]==='image'&&args[1]==='inspect')return JSON.stringify([args[2]===image?previous:(badConfig?{...next(),Config:{...next().Config,User:'root'}}:next())]);
  if(args[0]==='create')return container;
  if(args[0]==='container')return JSON.stringify([{State:{Status:'created',Running:false},Mounts:badMount?[{Type:'volume',Destination:'/data'}]:[],HostConfig:{NetworkMode:'none',Tmpfs:{'/data':'rw,size=1m'},Binds:null,Mounts:[]}}]);
  if(args[0]==='cp'&&failCopy)throw Error('copy failed');
  if(args[0]==='commit')return candidate;
  return '';
 };return {calls,docker};
}
test('stopped patch reuses layers/config, attaches no player volume and tags only a validated image',()=>{
 const {calls,docker}=fixture();assert.equal(commitIncremental('/verified',image,sourceCommit,sharedAssets,docker),candidate);
 assert.deepEqual(calls.find(x=>x[0]==='create'),['create','--network','none','--tmpfs','/data:rw,size=1m',image]);
 assert.equal(calls.filter(x=>x[0]==='cp').length,7);
 assert.ok(calls.filter(x=>x[0]==='cp').slice(2).every(x=>x[1].endsWith('/.')));
 assert.equal(calls.some(x=>['run','start','exec'].includes(x[0])),false);
 assert.deepEqual(calls.at(-1),['rm',container]);assert.ok(calls.some(x=>x.join(' ')==='image tag '+candidate+' liftoff-game'));
});
test('failed or unsafe patch cleans its stopped container and leaves the production tag alone',()=>{
 for(const options of [{badMount:true},{failCopy:true},{badConfig:true}]){
  const {calls,docker}=fixture(options);assert.throws(()=>commitIncremental('/verified',image,sourceCommit,sharedAssets,docker));
  assert.deepEqual(calls.at(-1),['rm',container]);assert.equal(calls.some(x=>x[0]==='image'&&x[1]==='tag'),false);
 }
});
test('commit rejects changed runtime config, retained layers or unintended labels',()=>{
 validateCommittedImage(previous,next(),{sourceCommit,sharedAssets});
 for(const mutate of [x=>x.Config.Cmd=['other'],x=>x.Config.Env.push('SECRET=no'),x=>x.Config.Healthcheck=null,x=>x.RootFS.Layers[0]='other',x=>x.RootFS.Layers.pop(),x=>x.Config.Labels.extra='unexpected']){
  const changed=next();mutate(changed);assert.throws(()=>validateCommittedImage(previous,changed,{sourceCommit,sharedAssets}));
 }
});
