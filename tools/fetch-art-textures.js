import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const ids = process.argv.length > 2 ? process.argv.slice(2) : ['smooth_concrete_floor', 'concrete_floor_worn_001', 'painted_plaster_wall'];
const catalog = await fetch('https://api.polyhaven.com/assets?type=textures').then(r => r.json());
for (const id of ids) {
  const files = await fetch(`https://api.polyhaven.com/files/${id}`).then(r => r.json());
  const folder = resolve('content/source-assets', id);
  await mkdir(folder, { recursive: true });
  const downloaded = {};
  for (const kind of ['diff', 'nor_gl', 'rough', 'ao']) {
    const formats = files[({diff:'Diffuse',rough:'Rough',ao:'AO'})[kind] || kind]?.['1k'];
    if (!formats) continue;
    const file = formats.png || formats.jpg;
    if (!file) throw new Error(`Missing image format: ${id}/${kind}`);
    const response = await fetch(file.url);
    if (!response.ok) throw new Error(`Download failed: ${file.url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('md5').update(bytes).digest('hex') !== file.md5) throw new Error('Checksum mismatch');
    const name = new URL(file.url).pathname.split('/').at(-1);
    await writeFile(resolve(folder, name), bytes);
    downloaded[kind] = { name, ...file };
  }
  await writeFile(resolve(folder, 'SOURCE.json'), JSON.stringify({ id, title:catalog[id].name, authors:catalog[id].authors, source:`https://polyhaven.com/a/${id}`, license:'CC0-1.0', licenseURL:'https://polyhaven.com/license', scaleMeters:catalog[id].scale, files:downloaded }, null, 2));
  console.log(id, Object.keys(downloaded).join(', '));
}
