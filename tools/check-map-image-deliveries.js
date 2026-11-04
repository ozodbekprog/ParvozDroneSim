import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyGlbImageDedup} from './glb-image-dedup.js';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const baseline = read('docs/research/browser-stack-20261025/map-payload-audit.json');
const catalog = read('public/content/catalog.json'), index = read('public/content/import-cache/files.json');
const rows = [];
for (const previous of baseline.maps) {
  const map = catalog.maps.find(map => map.id === previous.id);
  if (!map || !/^\/content\/assets\/maps\/[a-z0-9-]+\/[a-z0-9-]+-[a-f0-9]{16}\.glb$/.test(map.model)) throw Error('Unexpected map delivery');
  const original = readFileSync(previous.file), generated = readFileSync(resolve('public', map.model.slice(1)));
  const sourceSha256 = sha(original), deliverySha256 = sha(generated);
  if (sourceSha256 !== previous.sha256) throw Error('Canonical source changed: ' + previous.id);
  if (!map.model.endsWith('-' + deliverySha256.slice(0, 16) + '.glb')) throw Error('Delivery hash mismatch');
  verifyGlbImageDedup(original, generated);
  rows.push({id: map.id, source: previous.file, delivery: map.model, sourceSha256, deliverySha256,
    canonicalUnchanged: true, byteAndSceneParity: true, sourceBytes: original.length, deliveryBytes: generated.length,
    savedBytes: original.length - generated.length, imageEntries: index[resolve(previous.file)]?.imageDedup?.imageEntries,
    sharedImageViews: index[resolve(previous.file)]?.imageDedup?.sharedImageViews});
}
const report = {checkedAt: new Date().toISOString(), revision: catalog.revision,
  method: 'Read back generated files; compare canonical SHA-256 with the previous audit and verify every stored view, compressed stream, image payload and all other scene/material JSON semantics. No rendering or texture transcoding.',
  savedBytes: rows.reduce((n, row) => n + row.savedBytes, 0), maps: rows};
if (process.argv[2]) { mkdirSync(dirname(resolve(process.argv[2])), {recursive: true}); writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify(report, null, 2));
