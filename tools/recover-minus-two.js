// Recover only the chosen scene through AssetRipper Free's local OpenAPI.
// No game scripts are exported and the installed game remains read-only.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {profile,recoveryFolder} from './content-import-profile.js';

const output = recoveryFolder;
const base = profile.assetRipperUrl;
const manifest = JSON.parse(readFileSync(join(output, 'input-manifest.json'), 'utf8'));
const get = async (url) => {
  const response = await fetch(base + url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response;
};
const rowsFrom = html => [...html.matchAll(/<tr data-class="([^"]+)"><td>([^<]+)<\/td><td>[^<]+<\/td><td><a href="([^"]+)"[^>]*>([^<]*)<\/a>/g)]
  .map(m => ({ type: m[1], id: m[2], url: m[3], name: m[4] }));
const collections = new Map();
async function collectionData(path) {
  const key = JSON.stringify(path);
  if (collections.has(key)) return collections.get(key);
  const promise = (async () => {
    const html = await (await get('/Collections/View?Path=' + encodeURIComponent(key))).text();
    const dependencies = { 0: path };
    for (const match of html.slice(html.indexOf('<h2>Dependencies')).matchAll(/<tr><td>(\d+)<\/td><td><a href="([^\"]+)"/g)) {
      dependencies[match[1]] = JSON.parse(decodeURIComponent(match[2].split('Path=')[1]));
    }
    return { rows: rowsFrom(html), dependencies };
  })();
  collections.set(key, promise);
  return promise;
}
const assetKey = (collection, id) => JSON.stringify(collection) + ':' + id;
const assetUrl = (collection, id, kind) => '/Assets/' + kind + '?Path=' + encodeURIComponent('{"C":' + JSON.stringify(collection) + ',"D":' + id + '}');
const parse = text => JSON.parse(text
  .replace(/("m_PathID"\s*:\s*)(-?\d+)/g, '$1"$2"')
  .replace(/(:\s*)(NaN|-?Infinity)(?=[,\s}])/g, '$1null'));
async function jsonAsset(collection, id) {
  return parse(await (await get(assetUrl(collection, id, 'Json'))).text());
}
async function pointer(collection, ptr) {
  if (!ptr || ptr.m_PathID === '0' || ptr.m_PathID === 0) return null;
  const c = (await collectionData(collection)).dependencies[ptr.m_FileID];
  if (!c) throw new Error('Missing dependency collection: ' + ptr.m_FileID);
  return { collection: c, id: String(ptr.m_PathID), key: assetKey(c, ptr.m_PathID) };
}
async function pool(items, operation, width = 8) {
  let cursor = 0;
  await Promise.all(Array.from({ length: width }, async () => {
    while (cursor < items.length) await operation(items[cursor++]);
  }));
}

const rootHtml = await (await get('/Bundles/View?Path=' + encodeURIComponent('{"P":[]}'))).text();
let scene=manifest.sceneCollection;
if(!scene){
  const sceneBundle = [...rootHtml.matchAll(/href="([^\"]+)"[^>]*>([^<]+)<\/a>/g)].find(m => m[2] === manifest.bundles[0].name);
  if (!sceneBundle) throw new Error('Selected scene bundle is not loaded: '+profile.roots[0]);
  const bundleHtml = await (await get(sceneBundle[1])).text();
  const sceneLink = [...bundleHtml.matchAll(/href="([^\"]+)"[^>]*>([^<]+)<\/a>/g)].find(m => m[1].startsWith('/Collections/') && !m[2].endsWith('.sharedassets'));
  scene = JSON.parse(decodeURIComponent(sceneLink[1].split('Path=')[1]));
}
const sceneRows = (await collectionData(scene)).rows;
const types = new Set(['GameObject', 'Transform', 'MeshFilter', 'MeshRenderer', 'BoxCollider', 'MeshCollider', 'SphereCollider', 'CapsuleCollider', 'LODGroup', 'Light', 'LightmapSettings']);
const metadataPath = join(output, 'scene-metadata.json');
let records;
if (existsSync(metadataPath)) records = JSON.parse(readFileSync(metadataPath, 'utf8'));
else {
  records = {};
  const selected = sceneRows.filter(r => types.has(r.type));
  let done = 0;
  await pool(selected, async row => {
    records[row.id] = { type: row.type, name: row.name, data: await jsonAsset(scene, row.id) };
    if (++done % 2000 === 0) console.log('Scene metadata', done, '/', selected.length);
  });
  writeFileSync(metadataPath, JSON.stringify(records));
}
const materials = new Map(), meshes = new Map();
for (const record of Object.values(records)) {
  if (record.type === 'MeshRenderer' && record.data.m_Enabled) {
    for (const ref of record.data.m_Materials || []) {
      const p = await pointer(scene, ref);
      if (p) materials.set(p.key, p);
    }
  }
  if (record.type === 'MeshFilter' || record.type === 'MeshCollider') {
    const p = await pointer(scene, record.data.m_Mesh);
    if (p) meshes.set(p.key, p);
  }
}
const resources = { scene, records: 'scene-metadata.json', materials: [], meshes: [] };
mkdirSync(join(output, 'meshes'), { recursive: true });
mkdirSync(join(output, 'materials'), { recursive: true });
let number = 0;
for (const p of materials.values()) {
  const data = await jsonAsset(p.collection, p.id);
  const shaderPointer=await pointer(p.collection,data.m_Shader),shaderRow=shaderPointer?(await collectionData(shaderPointer.collection)).rows.find(r=>r.id===shaderPointer.id):null;
  let shader=shaderRow?.name;
  if(shader&&/^[0-9a-f]{32}$/i.test(shader)){const shaderData=await jsonAsset(shaderPointer.collection,shaderPointer.id);shader=shaderData.m_ParsedForm?.m_Name||shaderData.m_Name||shader;}
  const file = 'materials/material-' + number++ + '.json';
  writeFileSync(join(output, file), JSON.stringify(data));
  resources.materials.push({ ...p, file, name: data.m_Name, shader });
}
console.log('Materials recovered', resources.materials.length);
const textures = new Map();
for (const material of resources.materials) {
  const data = JSON.parse(readFileSync(join(output, material.file), 'utf8'));
  material.textures = {};
  for (const [slot, environment] of Object.entries(data.m_SavedProperties?.m_TexEnvs || {})) {
    if (!['_MainTex', '_BaseMap', '_BumpMap', '_MetallicGlossMap', '_EmissionMap', '_OcclusionMap','_DetailAlbedoMap','_DetailNormalMap','_DetailMask'].includes(slot)) continue;
    const p = await pointer(material.collection, environment.m_Texture);
    if (p) {
      textures.set(p.key, { ...p, hdr: false });
      material.textures[slot] = p.key;
    }
  }
}
resources.lightmaps = [];
const lighting = Object.values(records).find(r => r.type === 'LightmapSettings');
for (const map of lighting?.data.m_Lightmaps || []) {
  const p = await pointer(scene, map.m_Lightmap);
  if (!p) { resources.lightmaps.push(null); continue; } // Retain the renderer's source indices.
  textures.set(p.key, { ...p, hdr: true });
  resources.lightmaps.push(p.key);
}
mkdirSync(join(output, 'textures'), { recursive: true });
resources.textures = [];
number = 0;
for (const p of textures.values()) {
  const extension = p.hdr ? 'exr' : 'png';
  const file = 'textures/texture-' + number++ + '.' + extension;
  if (!existsSync(join(output, file)) || statSync(join(output,file)).size === 0) {
    const response = await get(assetUrl(p.collection, p.id, 'Image') + '&Extension=' + extension);
    const bytes=Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error('Empty recovered texture: ' + p.key);
    writeFileSync(join(output, file), bytes);
  }
  const metadata=await jsonAsset(p.collection,p.id);
  writeFileSync(join(output,'textures/texture-'+(number-1)+'.json'),JSON.stringify(metadata));
  const row = (await collectionData(p.collection)).rows.find(r => r.id === p.id);
  resources.textures.push({ ...p, name: row?.name || p.id, file, width:metadata.m_Width, height:metadata.m_Height,
    format:metadata.m_Format, colorSpace:metadata.m_ColorSpace, usage:metadata.m_LightmapFormat });
  console.log('Texture',number,'/',textures.size, row?.name || p.id);
}
console.log('Textures recovered', resources.textures.length, 'lightmaps', resources.lightmaps.length);
number = 0;
for (const p of meshes.values()) {
  const file = 'meshes/mesh-' + number++ + '.glb';
  if (!existsSync(join(output, file))) {
    const bytes = Buffer.from(await (await get(assetUrl(p.collection, p.id, 'Model.glb'))).arrayBuffer());
    if (bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error('Invalid recovered mesh: ' + p.key);
    writeFileSync(join(output, file), bytes);
  }
  resources.meshes.push({ ...p, file });
}
for (const [key, value] of collections) resources.collectionDependencies ||= {}, resources.collectionDependencies[key] = (await value).dependencies;
writeFileSync(join(output, 'resources.json'), JSON.stringify(resources, null, 2));
console.log(JSON.stringify({ records: Object.keys(records).length, materials: materials.size, meshes: meshes.size, output }));
