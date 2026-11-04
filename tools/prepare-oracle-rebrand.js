// Code-only rebrand patch: reuse verified production assets instead of uploading them again.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, relative, sep } from 'node:path';
import { BRAND } from '../shared/brand.js';
import { NETWORK_PROTOCOL } from '../shared/network-flight.js';

const root = resolve(import.meta.dirname, '..'), release = process.argv[2];
if (!/^\d{8}-[a-z0-9-]+$/.test(release || '')) throw Error('Provide a fresh dated release ID.');
const baseline = JSON.parse(readFileSync(join(root, 'data/oracle-release-20261013-scene-02.RELEASE.json')));
const live = JSON.parse(readFileSync(join(root, 'data/oracle-catalog-before-parvoz-20261013.json')));
const local = JSON.parse(readFileSync(join(root, 'public/content/catalog.json')));
if (live.revision !== baseline.revision || local.revision !== baseline.revision || live.protocol !== NETWORK_PROTOCOL)
  throw Error('Production baseline changed; inspect it before preparing this patch.');
if (JSON.stringify(live.maps.map(m => m.id).sort()) !== JSON.stringify(baseline.maps.slice().sort()))
  throw Error('Production map scope differs.');
if (JSON.stringify(live.assets.map(a => [a.url, a.bytes]).sort()) !== JSON.stringify(local.assets.map(a => [a.url, a.bytes]).sort()))
  throw Error('Content deliveries differ; this patch is for branding only.');
const stage = join(root, 'data', 'oracle-patch-' + release);
if (existsSync(stage)) throw Error('Patch stage already exists.');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const safe = file => { if (!file || file.startsWith('/') || /^[a-z]:/i.test(file) || file.includes('\\') || file.split('/').some(s => s === '..') || /\.env$|\.sqlite|\.blend\d*$/.test(file)) throw Error('Invalid/private release path.'); return file; };
const generated = file => file.startsWith('public/content/import-cache/');
const inventory = new Map(baseline.inventory.filter(i => !generated(i.file)).map(i => [safe(i.file), i]));
const sourceFiles = [];
function walk(directory) {
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const file = directory + '/' + entry.name;
    if (/\.env$|oracle-known-hosts$|previous-release\.txt$/.test(file)) continue;
    if (entry.isDirectory()) walk(file); else if (entry.isFile()) sourceFiles.push(file);
    else throw Error('Unexpected code junction.');
  }
}
for (const folder of ['src', 'shared', 'server', 'deploy']) walk(folder);
sourceFiles.push('package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'Dockerfile', 'compose.production.yaml', '.dockerignore');
const managed = file => /^(src|shared|server|deploy)\//.test(file) || sourceFiles.includes(file);
const sourceSet = new Set(sourceFiles), changed = [], removed = [];
for (const item of baseline.inventory) if (generated(item.file) || managed(item.file) && !sourceSet.has(item.file)) {
  removed.push(item.file); inventory.delete(item.file);
}
for (const file of sourceFiles) {
  safe(file);
  let bytes = readFileSync(join(root, file));
  if (file.endsWith('.sh') || file === 'deploy/Caddyfile') bytes = Buffer.from(bytes.toString().replaceAll('\r\n', '\n'));
  const item = { file, bytes: bytes.length, sha256: sha(bytes) };
  if (inventory.get(file)?.sha256 !== item.sha256) {
    const target = resolve(stage, file);
    if (!target.startsWith(stage + sep)) throw Error('Invalid patch destination.');
    mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, bytes); changed.push(item);
  }
  inventory.set(file, item);
}
mkdirSync(stage, { recursive: true });
const changedSet = new Set(changed.map(i => i.file));
const patch = { release, previousRelease: baseline.release, previousRevision: live.revision,
  protocol: NETWORK_PROTOCOL, brand: BRAND.name, files: changed,
  reuse: [...inventory.values()].filter(i => !changedSet.has(i.file)), removed };
const date = release.slice(0, 4) + '-' + release.slice(4, 6) + '-' + release.slice(6, 8);
const record = { ...baseline, release, date, brand: BRAND.name,
  status: 'staged-not-deployed', previousRevision: live.revision, inventory: [...inventory.values()],
  buildVerified: false, contentVerified: false, browserVerified: false, sourceCommit: process.argv[3] || null,
  codeOnlyPatch: true, unchangedDeliveryAssets: live.assets.length };
writeFileSync(join(stage, 'PATCH.json'), JSON.stringify(patch, null, 2) + '\n');
writeFileSync(join(stage, 'RELEASE.json'), JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ stage: relative(root, stage), changedFiles: changed.length,
  uploadBytes: changed.reduce((n, i) => n + i.bytes, 0), reusedFiles: patch.reuse.length,
  unchangedAssets: live.assets.length, revision: live.revision }));
