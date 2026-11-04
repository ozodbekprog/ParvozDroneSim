// Select the Minus Two dependency graph without exporting unrelated game assets.
// The source installation is read-only. Staging and reports stay in ignored data/.
import { readFileSync, mkdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { request } from 'node:http';
import {profile,recoveryFolder} from './content-import-profile.js';

const source = resolve(process.argv.find(value => value.startsWith('--source='))?.slice(9) || profile.source);
const output = resolve(recoveryFolder);
const catalog = JSON.parse(readFileSync(join(source, profile.catalogPath), 'utf8'));
const bucketData = Buffer.from(catalog.m_BucketDataString, 'base64');
const keyData = Buffer.from(catalog.m_KeyDataString, 'base64');
const entryData = Buffer.from(catalog.m_EntryDataString, 'base64');
const buckets = [], keys = [];
for (let i = 0, cursor = 4; i < bucketData.readInt32LE(0); i++) {
  const offset = bucketData.readInt32LE(cursor), count = bucketData.readInt32LE(cursor + 4);
  buckets.push(Array.from({ length: count }, (_, n) => bucketData.readInt32LE(cursor + 8 + n * 4)));
  keys.push(keyData[offset] === 0 ? keyData.toString('utf8', offset + 5, offset + 5 + keyData.readInt32LE(offset + 1)) : null);
  cursor += 8 + count * 4;
}
const roots = profile.roots;
const visited = new Set(), selected = new Map();
function visit(entry) {
  if (visited.has(entry)) return;
  visited.add(entry);
  const offset = 4 + entry * 28;
  const internalId = catalog.m_InternalIds[entryData.readInt32LE(offset)];
  if (internalId.endsWith('.bundle')) selected.set(basename(internalId.replaceAll('\\', '/')), internalId);
  const dependency = entryData.readInt32LE(offset + 8);
  if (dependency >= 0) for (const child of buckets[dependency]) visit(child);
}
for (const key of roots) {
  const index = keys.indexOf(key);
  if (index < 0) throw new Error('Missing catalog key: ' + key);
  for (const entry of buckets[index]) visit(entry);
}
const bundles = [...selected].map(([name, internalId]) => {
  const path = join(source, profile.bundlesPath, name);
  if (!existsSync(path)) throw new Error('Missing dependency: ' + path);
  return { name, internalId, source: path, bytes: statSync(path).size };
});
const previousManifest=join(output,'input-manifest.json');
if(existsSync(previousManifest)){
  const previous=JSON.parse(readFileSync(previousManifest,'utf8'));
  if(previous.source!==source||JSON.stringify(previous.roots)!==JSON.stringify(roots))throw new Error('This staging folder contains another source/scene. Choose a new staging directory.');
}
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'input-manifest.json'), JSON.stringify({ source, roots, bundles, bytes: bundles.reduce((sum, item) => sum + item.bytes, 0) }, null, 2));
if (process.argv.includes('--load')) {
  const body = new URLSearchParams();
  for (const bundle of bundles) body.append('Path', bundle.source);
  // Large UnityFS resources can take longer than fetch's five-minute header timeout.
  const html = await new Promise((resolve, reject) => {
    const req = request(profile.assetRipperUrl+'/LoadFile', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, response => {
      if (response.statusCode !== 200 && response.statusCode !== 302) {
        response.resume(); reject(new Error('AssetRipper load failed: HTTP ' + response.statusCode)); return;
      }
      const chunks=[];
      response.on('data', data=>chunks.push(data));
      response.on('end', ()=>resolve(Buffer.concat(chunks).toString('utf8')));
      response.on('error', reject);
    });
    req.on('error', reject); req.end(body.toString());
  });
  writeFileSync(join(output, 'loaded.html'), html);
}
console.log(JSON.stringify({ bundles: bundles.length, bytes: bundles.reduce((sum, item) => sum + item.bytes, 0), loaded: process.argv.includes('--load'), manifest: join(output, 'input-manifest.json') }));
