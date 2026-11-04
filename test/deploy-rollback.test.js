import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,existsSync,chmodSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep,delimiter} from 'node:path';
import {spawnSync} from 'node:child_process';

const image='sha256:'+'a'.repeat(64);
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
const mock=`#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == inspect ]]; then
 if [[ "$3" == '{{.Image}}' ]]; then printf '%s\\n' "$TASK_OLD_IMAGE"; else printf '%s\\n' "$TASK_PREVIOUS"; fi
elif [[ "$1" == image && "$2" == tag ]]; then
 [[ "$TASK_FAIL_PIN" == 0 ]] || exit 1
 touch "$TASK_STATE/pinned"
elif [[ "$1" == image && "$2" == inspect ]]; then
 [[ ! -e "$TASK_STATE/old-image-removed" ]] || exit 1
 printf '%s\\n' "$TASK_OLD_IMAGE"
elif [[ "$1" == compose ]]; then
 for arg in "$@"; do
  case "$arg" in
   ps) printf 'old-container\\n'; exit 0 ;;
   build) touch "$TASK_STATE/built"; exit 0 ;;
   exec) printf '0\\n'; exit 0 ;;
   up) touch "$TASK_STATE/activated"; [[ -e "$TASK_STATE/pinned" ]] || touch "$TASK_STATE/old-image-removed"; exit 0 ;;
  esac
 done
fi
`;

function scenario(failPin) {
 const root=mkdtempSync(join(tmpdir(),'parvoz-deploy-test-'));
 const unix=p=>p.replaceAll('\\','/');
 try {
  for(const folder of ['candidate/deploy','previous','bin','state'])mkdirSync(join(root,folder),{recursive:true});
  const candidate=join(root,'candidate'),docker=join(root,'bin','docker');
  copyFileSync(new URL('../deploy/deploy.sh',import.meta.url),join(candidate,'deploy','deploy.sh'));
  writeFileSync(join(candidate,'deploy','production.env'),'MAX_MULTIPLAYER_PLAYERS=20\n');
  writeFileSync(docker,mock);chmodSync(docker,0o755);
  const env={...process.env,PATH:join(root,'bin')+delimiter+process.env.PATH,TASK_STATE:unix(join(root,'state')),TASK_PREVIOUS:unix(join(root,'previous')),TASK_OLD_IMAGE:image,TASK_FAIL_PIN:failPin?'1':'0'};
  const result=spawnSync(bash,['deploy/deploy.sh'],{cwd:candidate,env,encoding:'utf8'});
  assert.equal(result.error,undefined);
  if(failPin){
   assert.notEqual(result.status,0,result.stderr);
   assert.equal(existsSync(join(root,'state','built')),false);
   assert.equal(existsSync(join(root,'state','activated')),false);
  }else{
   assert.equal(result.status,0,result.stderr);
   assert.equal(existsSync(join(root,'state','activated')),true);
   const inspect=spawnSync(bash,[unix(docker),'image','inspect',image],{env,encoding:'utf8'});
   assert.equal(inspect.status,0,'The previous image must survive replacement of its container.');
   assert.equal(readFileSync(join(candidate,'deploy','previous-release.txt'),'utf8').trim(),env.TASK_PREVIOUS+'\n'+image);
  }
 } finally {
  const absolute=resolve(root);
  assert.ok(absolute.startsWith(resolve(tmpdir())+sep)&&absolute.split(sep).at(-1).startsWith('parvoz-deploy-test-'));
  rmSync(absolute,{recursive:true,force:true});
 }
}

test('previous image survives latest-tag replacement and old-container removal',()=>scenario(false));
test('failure to preserve previous image aborts before build and activation',()=>scenario(true));
