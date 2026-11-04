import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..', 'content', 'source-assets');
const ids = ['modular_factory_facade', 'modular_industrial_pipes_01', 'concrete_road_barrier', 'metal_tool_chest'];
async function json(url) {
  const response = await fetch(url); if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.json();
}
async function download(folder, name, file) {
  const destination = resolve(folder, name);
  if (!destination.startsWith(folder + sep)) throw new Error('Unsafe asset path');
  try { const bytes = await readFile(destination); if (file.md5 && createHash('md5').update(bytes).digest('hex') === file.md5) return; } catch {}
  const response = await fetch(file.url); if (!response.ok) throw new Error(`${response.status}: ${file.url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (file.md5 && createHash('md5').update(bytes).digest('hex') !== file.md5) throw new Error(`Checksum mismatch: ${name}`);
  await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes);
}
const catalog = await json('https://api.polyhaven.com/assets?type=models');
for (const id of ids) {
  const folder = resolve(root, id), files = await json(`https://api.polyhaven.com/files/${id}`);
  const format = files.blend['1k'].blend;
  await download(folder, `${id}.blend`, format);
  // Keep the author's editable Blender asset and every original image dependency.
  for (const [name, file] of Object.entries(format.include || {})) await download(folder, name, file);
  await writeFile(resolve(folder, 'SOURCE.json'), JSON.stringify({ id, title: catalog[id].name, authors: catalog[id].authors, source: `https://polyhaven.com/a/${id}`, license: 'CC0-1.0', licenseURL: 'https://polyhaven.com/license', files: format }, null, 2));
  console.log(`Downloaded Blender source: ${id}`);
}
const droneFolder = resolve(root, 'bluemesh-racing-drone');
const droneURL = 'https://raw.githubusercontent.com/mqnc/propwash/HEAD/assets/drones/racing_drone_lite_graphics_version.glb';
await download(droneFolder, 'original.glb', { url: droneURL });
await writeFile(resolve(droneFolder, 'SOURCE.json'), JSON.stringify({title:'Racing drone (Lite Graphics Version)', author:'BlueMesh', source:'https://skfb.ly/6zBPO', mirror:droneURL, license:'CC-BY-4.0', licenseURL:'https://creativecommons.org/licenses/by/4.0/', attributionEvidence:'https://github.com/mqnc/propwash#attributions', modifications:'None in original.glb. Derived Kestrel assets record their modifications separately.'},null,2));
console.log('Downloaded licensed BlueMesh drone for visual evaluation.');
