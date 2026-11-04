import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

// The stopped-container path avoids BuildKit unpacking a second copy of a large
// retained asset image. It receives only the context already checked by the
// incremental builder; neither secrets nor the production volume are attached.
export function validateCommittedImage(previous,candidate,{sourceCommit,sharedAssets}){
 assert.equal(candidate.Os,previous.Os);assert.equal(candidate.Architecture,previous.Architecture);
 for(const key of ['Entrypoint','Cmd','User','WorkingDir','Env','Healthcheck','ExposedPorts','Volumes','StopSignal','Shell','OnBuild']){
  assert.deepEqual(candidate.Config[key],previous.Config[key],`Image config changed: ${key}`);
 }
 assert.deepEqual(candidate.Config.Labels,{...previous.Config.Labels,'org.opencontainers.image.revision':sourceCommit,'org.parvoz.shared-assets':sharedAssets});
 assert.equal(candidate.RootFS.Layers.length,previous.RootFS.Layers.length+1,'Expected exactly one patch layer');
 assert.deepEqual(candidate.RootFS.Layers.slice(0,-1),previous.RootFS.Layers,'Retained layers changed');
}

export function commitIncremental(context,image,sourceCommit,sharedAssets,docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:16*1024*1024}).trim()){
 assert.match(image,/^sha256:[a-f0-9]{64}$/);assert.match(sourceCommit,/^[a-f0-9]{40}$/);assert.ok(['0','1'].includes(sharedAssets));
 const inspect=(kind,id)=>JSON.parse(docker(kind,'inspect',id))[0];
 const previous=inspect('image',image);assert.equal(previous.Id,image);
 let container;
 try{
  container=docker('create','--network','none','--tmpfs','/data:rw,size=1m',image);
  assert.match(container,/^[a-f0-9]{64}$/);
  const stopped=inspect('container',container);
  assert.equal(stopped.State.Status,'created');assert.equal(stopped.State.Running,false);
  assert.equal(stopped.HostConfig.NetworkMode,'none');
  assert.deepEqual(stopped.HostConfig.Binds||[],[]);assert.deepEqual(stopped.HostConfig.Mounts||[],[]);
  assert.deepEqual(stopped.HostConfig.Tmpfs,{'/data':'rw,size=1m'});
  assert.ok((stopped.Mounts||[]).every(m=>m.Type==='tmpfs'&&m.Destination==='/data'),'Unexpected container mount');
  for(const file of ['package.json','package-lock.json'])docker('cp',join(context,file),container+':/app/'+file);
  for(const directory of ['server','shared','tools','dist','public'])docker('cp',join(context,directory)+'/.',container+':/app/'+directory+'/');
  assert.equal(inspect('container',container).State.Status,'created','Patch container must never run');
  const candidate=docker('commit','--change',`LABEL org.opencontainers.image.revision=${sourceCommit}`,'--change',`LABEL org.parvoz.shared-assets=${sharedAssets}`,container);
  assert.match(candidate,/^sha256:[a-f0-9]{64}$/);
  validateCommittedImage(previous,inspect('image',candidate),{sourceCommit,sharedAssets});
  docker('image','tag',candidate,'liftoff-game');
  return candidate;
 }finally{if(container)docker('rm',container);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [context,image,sharedAssets]=process.argv.slice(2),sourceCommit=readFileSync(join(context,'source-commit'),'utf8').trim();
 console.log(JSON.stringify({incrementalBuilder:'commit',candidateImage:commitIncremental(resolve(context),image,sourceCommit,sharedAssets)}));
}
