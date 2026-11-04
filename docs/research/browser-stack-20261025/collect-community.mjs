// Read public metadata/source as data. Never install or execute upstream code.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const retrievedAt = new Date().toISOString();
const pins = {
  'endel/webgpu-webgl-benchmarks': '25723d75c516488854794b8494a0a847bc9c933f',
  'AlexAPPi/playcanvas-opti-pixel': '1cb3a2ed0bb486c7e1820e5e782835062310685d',
  'drftrun/driftengine': '1d001b941b6ce138ac620b4666a2ab6d6b333731',
  'mvaligursky/web-engines-compare': '92c450af301dc0e40974f5539044982fb1cad751',
};
async function bounded(items, fn) {
  let next = 0;
  const out = [];
  await Promise.all(Array.from({length: 3}, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i]); }
      catch (e) { out[i] = {input: items[i], error: e.message}; }
    }
  }));
  return out;
}
async function get(url) {
  const r = await fetch(url, {signal: AbortSignal.timeout(20000)});
  if (!r.ok) throw Error(`HTTP ${r.status}: ${url}`);
  return r;
}
const packages = await bounded([
  'playcanvas-opti-pixel', '@driftengine/core', '@needle-tools/engine',
], async name => {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  const d = await (await get(url)).json();
  const version = d['dist-tags']?.latest, p = d.versions?.[version];
  const stableVersion = d['dist-tags']?.stable, stable = d.versions?.[stableVersion];
  return {name, url, version, publishedAt: d.time?.[version], distTags: d['dist-tags'],
    license: p?.license, gitHead: p?.gitHead, peerDependencies: p?.peerDependencies,
    stableAlternative: stableVersion && stableVersion !== version ? {
      version: stableVersion, publishedAt: d.time?.[stableVersion],
      license: stable?.license, gitHead: stable?.gitHead,
    } : undefined};
});
const files = [
  ['endel/webgpu-webgl-benchmarks', 'README.md'],
  ['endel/webgpu-webgl-benchmarks', 'src/harness/matrix.ts'],
  ['endel/webgpu-webgl-benchmarks', 'package.json'],
  ['mvaligursky/web-engines-compare', 'README.md'],
  ['mvaligursky/web-engines-compare', 'results/2026-10-01/README.md'],
  ['AlexAPPi/playcanvas-opti-pixel', 'README.md'],
  ['AlexAPPi/playcanvas-opti-pixel', 'package.json'],
  ['AlexAPPi/playcanvas-opti-pixel', 'docs/occlusion/choosing-backend.md'],
  ['AlexAPPi/playcanvas-opti-pixel', 'docs/occlusion/hzb.md'],
  ['drftrun/driftengine', 'README.md'],
  ['drftrun/driftengine', 'LICENSE'],
  ['drftrun/driftengine', 'packages/core/package.json'],
  ['BabylonJS/Babylon.js', 'packages/dev/core/src/Engines/webgpuEngine.ts', '9.32.0'],
  ['BabylonJS/Babylon.js', 'packages/dev/core/src/Engines/webgpuEngine.pure.ts', '9.32.0'],
  ['mrdoob/three.js', 'examples/jsm/loaders/KTX2Loader.js', 'r180'],
  ['mrdoob/three.js', 'examples/jsm/loaders/KTX2Loader.js', 'r186'],
];
const patterns = ['compatibilityMode', 'ResetCache', 'dispose()', 'HDR', 'transcode',
  'UNKNOWN', 'readback', 'indirect', 'private', 'license'];
const sources = await bounded(files, async ([repo, path, explicitRef]) => {
  const ref = explicitRef || pins[repo];
  const url = `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
  const body = await (await get(url)).text(), lines = body.split('\n');
  return {repo, path, ref, url, sha256: createHash('sha256').update(body).digest('hex'),
    lines: lines.length,
    anchors: Object.fromEntries(patterns.map(p => [p,
      lines.flatMap((line, i) => line.includes(p) ? [i + 1] : [])]))};
});
await writeFile(new URL('./community-source-audit.json', import.meta.url),
  JSON.stringify({retrievedAt, scope: 'Source inspection, not execution or performance measurement. Three repository HEADs resolved with git ls-remote; benchmark comparison pin is the October 1 publication snapshot. Tags may move; source hashes preserve observed bytes. Literal anchors are navigation aids, not feature-absence proofs.',
    pins, packages, sources}, null, 2) + '\n');
console.log(JSON.stringify({packages, sourceCount: sources.length,
  errors: sources.filter(s => s.error)}, null, 2));
