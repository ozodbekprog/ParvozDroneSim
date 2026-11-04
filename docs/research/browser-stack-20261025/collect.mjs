// Read-only upstream metadata collection. No installs, asset uploads, or tokens.
// Run from the repository root; public API failures remain explicit in output.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const outputUrl = new URL('./upstream-metadata.json', import.meta.url);
let previous;
try { previous = JSON.parse(await readFile(outputUrl, 'utf8')); } catch {}
const repos = [
  'mrdoob/three.js', 'playcanvas/engine', 'BabylonJS/Babylon.js',
  'NASA-AMMOS/3DTilesRendererJS', 'needle-tools/gltf-progressive',
  'agargaro/instanced-mesh', 'gkjohnson/three-mesh-bvh',
  'donmccurdy/glTF-Transform', 'zeux/meshoptimizer',
  'KhronosGroup/KTX-Software', 'brendan-duncan/webgpu_inspector',
  'greggman/webgl-memory', 'dimforge/rapier.js', 'dimforge/rapier', 'jrouwe/JoltPhysics.js',
  'NateTheGreatt/bitECS', 'Scthe/nanite-webgpu', 'swift502/Sketchbook',
  'pmndrs/react-three-fiber', 'cocos/cocos-engine', 'BabylonJS/Spector.js'
];
const packages = ['three', 'playcanvas', '@babylonjs/core', '3d-tiles-renderer',
  '@needle-tools/gltf-progressive', '@three.ez/instanced-mesh', 'three-mesh-bvh',
  '@gltf-transform/core', 'meshoptimizer', 'ktx-parse', '@dimforge/rapier3d-compat',
  'jolt-physics', 'bitecs', 'webgl-memory', 'spectorjs'];
async function read(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Parvoz-stage-one-research', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return { url, error: `HTTP ${r.status}` };
    return { url, data: await r.json() };
  } catch (e) { return { url, error: e.message }; }
}
async function mapBounded(items, fn) {
  let next = 0; const out = new Array(items.length);
  await Promise.all(Array.from({length: 4}, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}
const repositories = await mapBounded(repos, async name => {
  const r = await read(`https://api.github.com/repos/${name}`);
  if (r.error) return { name, ...r };
  const d = r.data;
  return { name, url: r.url, htmlUrl: d.html_url, defaultBranch: d.default_branch,
    pushedAt: d.pushed_at, archived: d.archived, license: d.license?.spdx_id || null };
});
const registry = await mapBounded(packages, async name => {
  const r = await read(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (r.error) return { name, ...r };
  const version = r.data['dist-tags']?.latest, d = r.data.versions?.[version];
  const stable = r.data['dist-tags']?.stable;
  return { name, url: r.url, latestTag: version, publishedAt: r.data.time?.[version],
    distTags: r.data['dist-tags'], gitHead: d?.gitHead,
    stableAlternative: stable ? { version: stable, gitHead: r.data.versions?.[stable]?.gitHead, publishedAt: r.data.time?.[stable] } : undefined,
    license: d?.license, engines: d?.engines, peerDependencies: d?.peerDependencies,
    peerDependenciesMeta: d?.peerDependenciesMeta,
    unpackedBytes: d?.dist?.unpackedSize,
    note: 'Registry unpacked size is not browser bundle size or network transfer.' };
});
const checks = [
  ['3d-tiles-renderer', 'NASA-AMMOS/3DTilesRendererJS', 'src/three/plugins/index.js'],
  ['3d-tiles-renderer', 'NASA-AMMOS/3DTilesRendererJS', 'src/core/renderer/utilities/LRUCache.js'],
  ['@three.ez/instanced-mesh', 'agargaro/instanced-mesh', 'src/core/InstancedMesh2.ts'],
  ['@needle-tools/gltf-progressive', 'needle-tools/gltf-progressive', 'src/lods.manager.ts'],
  ['@needle-tools/gltf-progressive', 'needle-tools/gltf-progressive', 'src/loaders.ts'],
];
const sourceChecks = await mapBounded(checks, async ([name, repo, path]) => {
  const pkg = registry.find(p => p.name === name);
  if (!pkg?.gitHead) return { name, path, error: 'No published gitHead' };
  const url = `https://raw.githubusercontent.com/${repo}/${pkg.gitHead}/${path}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return { name, path, url, error: `HTTP ${r.status}` };
    const body = await r.text(), lines = body.split('\n');
    const patterns = ['WebGLRenderer', 'WebGPURenderer', 'onBeforeCompile', 'maxBytesSize', 'UnloadTilesPlugin', 'LoadRegionPlugin', 'BatchedTilesPlugin', 'AbortSignal', 'dispose('];
    return { name, version: pkg.latestTag, path, url, sha256: createHash('sha256').update(body).digest('hex'), lineCount: lines.length,
      matches: Object.fromEntries(patterns.map(p => [p, lines.flatMap((line, i) => line.includes(p) ? [i + 1] : [])])),
      note: 'Literal source anchors only. Presence/absence does not prove feature support or incompatibility.' };
  } catch (e) { return { name, path, url, error: e.message }; }
});
const report = { retrievedAt: new Date().toISOString(), scope: 'Public upstream metadata; not compatibility or performance validation. pushedAt includes non-code pushes. License identifiers are discovery metadata, not a dependency-license audit.', repositories, registry, sourceChecks };
for (const group of ['repositories', 'registry', 'sourceChecks']) {
  report[group] = report[group].map(row => {
    const old = previous?.[group]?.find(x => x.name === row.name && x.path === row.path);
    if (!row.error || !old || old.error) return row;
    return { ...old, retrievedAt: old.retrievedAt || previous.retrievedAt,
      refreshError: row.error, refreshAttemptAt: report.retrievedAt,
      note: 'Earlier successful response retained; this refresh failed.' };
  });
}
await writeFile(outputUrl, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
