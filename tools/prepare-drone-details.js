// Package only the additive aircraft detail library; never re-export the maps.
import {existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const folder='content/shared-assets/drone-details/';
const cache='data/drone-detail-20261015/texture-cache/';mkdirSync(cache,{recursive:true});
const run=(args)=>{const result=spawnSync(process.execPath,args,{stdio:'inherit',windowsHide:true});if(result.status!==0)throw new Error('Detail preparation failed: '+args.join(' '));};
// Keep the uncompressed initial fingerprint table. Subsequent prepared files
// can already contain KTX2 bytes, whose fingerprints are not PNG fingerprints.
const fingerprint=cache+'hangar-prepared.glb';
const prepared=folder+'hangar-delivery.glb.prepared.glb';
if(!existsSync(fingerprint)&&existsSync(prepared))copyFileSync(prepared,fingerprint);
for(const level of ['hangar','low','far']){
  const output=folder+level+'-delivery.glb';
  if(level!=='hangar'&&!existsSync(output))copyFileSync(folder+'hangar-delivery.glb',output);
  const reuse=existsSync(fingerprint)&&existsSync(output)?['--reuse-unchanged-ktx='+fingerprint]:[];
  const metadata='data/liftoff-new-drone-recovery/browser-track-resources.json';
  const materials=existsSync(metadata)?['--unity-materials='+metadata]:[];
  run(['tools/optimize-art.js',folder+level+'-source.glb',output,...materials,...reuse]);
  if(!existsSync(fingerprint))copyFileSync(prepared,fingerprint);
}
run(['tools/check-drone-details.js']);
