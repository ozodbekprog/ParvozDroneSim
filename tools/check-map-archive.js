import {cpSync,existsSync,readFileSync,renameSync,mkdirSync} from 'node:fs';
import {resolve,sep,join} from 'node:path';
import assert from 'node:assert/strict';
import {syncContent} from './content-packages.js';
const root=resolve(import.meta.dirname,'..'), source=join(root,'content/archived-maps/hangar'), active=join(root,'content/maps/hangar'), checked=join(root,'data/menu-qa/restored-hangar');
for(const path of [source,active,checked])assert.ok(resolve(path).startsWith(root+sep));
assert.ok(!existsSync(active),'Do not overwrite a restored user map');assert.ok(!existsSync(checked),'Check already retained; inspect its report before repeating');
cpSync(source,active,{recursive:true});
try {
  const {catalog}=syncContent(root),map=catalog.maps.find(m=>m.id==='hangar');
  assert.equal(map.tracks.length,3);assert.ok(catalog.challenges.some(c=>c.id==='cadet'));assert.ok(catalog.tutorials.some(t=>t.id==='gate-basics'));
  const manifest=JSON.parse(readFileSync(join(source,'archive-manifest.json')));assert.equal(manifest.bundles.races.length,map.tracks.length);
  console.log('Single-folder restoration verified: 3 courses, 2 missions, 2 lessons.');
} finally {
  mkdirSync(resolve(checked,'..'),{recursive:true});renameSync(active,checked);syncContent(root);
}
