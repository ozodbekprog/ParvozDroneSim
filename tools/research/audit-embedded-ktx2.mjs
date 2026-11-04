import { open, readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

// Read GLB JSON headers only. No decoding, imports, re-exports or writes.
const root = process.cwd(), publicRoot = resolve(root, 'public');
const catalogBytes = await readFile(resolve(publicRoot, 'content/catalog.json'));
const catalog = JSON.parse(catalogBytes), urls = new Set();
function visit(value) {
  if (typeof value === 'string' && /^\/content\/assets\/.*\.glb$/.test(value)) urls.add(value);
  else if (value && typeof value === 'object') for (const child of Object.values(value)) visit(child);
}
visit(catalog);
const rows = [];
for (const url of [...urls].sort()) {
  const file = resolve(publicRoot, '.' + url);
  if (!file.startsWith(publicRoot + sep)) throw Error('Asset outside public directory');
  const handle = await open(file, 'r');
  let json;
  try {
    const header = Buffer.alloc(20); await handle.read(header, 0, 20, 0);
    if (header.readUInt32LE(0) !== 0x46546c67 || header.readUInt32LE(4) !== 2 || header.readUInt32LE(16) !== 0x4e4f534a) throw Error('Invalid GLB header: ' + url);
    const data = Buffer.alloc(header.readUInt32LE(12)); await handle.read(data, 0, data.length, 20); json = JSON.parse(data.toString('utf8'));
  } finally { await handle.close(); }
  const sources = new Set((json.textures || []).map(texture => texture.extensions?.KHR_texture_basisu?.source).filter(index => index !== undefined));
  const embedded = [...sources].map(index => json.images[index]).filter(image => image.bufferView !== undefined);
  const viewRanges = new Map();
  for (const accessor of json.accessors || []) {
    const view = json.bufferViews?.[accessor.bufferView]; if (!view?.byteStride) continue;
    const ranges = viewRanges.get(accessor.bufferView) || new Set(); viewRanges.set(accessor.bufferView, ranges);
    // Candidate for the upstream clone-view audit, not proof of corruption:
    // runtime normalization may replace the accessor before a geometry clone.
    ranges.add(`${Math.floor((accessor.byteOffset || 0) / view.byteStride)}:${accessor.count}`);
  }
  rows.push({ url, fileBytes: (await stat(file)).size, embeddedKtx2Sources: embedded.length, embeddedKtx2Bytes: embedded.reduce((sum, image) => sum + json.bufferViews[image.bufferView].byteLength, 0), sharedInterleavedViewCandidates: [...viewRanges.values()].filter(ranges => ranges.size > 1).length });
}
process.stdout.write(JSON.stringify({ capturedAt: new Date().toISOString(), catalogRevision: catalog.revision, catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'), note: 'Static scope only; image counts include all catalog GLBs, not a single session. No timing or memory measurement.', models: rows.length, embeddedKtx2Sources: rows.reduce((sum, row) => sum + row.embeddedKtx2Sources, 0), embeddedKtx2Bytes: rows.reduce((sum, row) => sum + row.embeddedKtx2Bytes, 0), rows }, null, 2) + '\n');
