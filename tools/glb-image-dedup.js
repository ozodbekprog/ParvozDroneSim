import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export const GLB_IMAGE_DEDUP_VERSION = 1;
const JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function unpack(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 28 || bytes.toString('ascii', 0, 4) !== 'glTF' ||
      bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error('Expected a complete GLB 2.0');
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw Error('Truncated GLB chunk');
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    if (length % 4 || offset + 8 + length > bytes.length) throw Error('Invalid GLB chunk length');
    chunks.push({type, bytes: bytes.subarray(offset + 8, offset + 8 + length)});
    offset += 8 + length;
  }
  if (chunks.length !== 2 || chunks[0].type !== JSON_CHUNK || chunks[1].type !== BIN_CHUNK) throw Error('Expected JSON and BIN chunks only');
  const json = JSON.parse(chunks[0].bytes.toString('utf8').trim()), bin = chunks[1].bytes;
  if (json.buffers?.[0]?.uri || !Number.isSafeInteger(json.buffers?.[0]?.byteLength) ||
      json.buffers[0].byteLength > bin.length || json.buffers[0].byteLength < bin.length - 3) throw Error('Invalid embedded GLB buffer');
  return {json, bin};
}

function span(bin, descriptor) {
  const offset = descriptor.byteOffset ?? 0, length = descriptor.byteLength;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > bin.length) throw Error('Invalid GLB buffer range');
  return bin.subarray(offset, offset + length);
}

// Every buffer-relative storage location must be known before moving BIN data.
// Accessor byteOffsets are relative to their bufferView and do not move here.
function storage(json) {
  const known = new Set(), rows = [];
  for (const [index, view] of (json.bufferViews || []).entries()) {
    known.add(view);
    rows.push({index, descriptor: view});
    for (const name of ['EXT_meshopt_compression', 'KHR_meshopt_compression']) if (view.extensions?.[name]) {
      const descriptor = view.extensions[name]; known.add(descriptor); rows.push({descriptor});
    }
  }
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'buffer') && (Object.hasOwn(value, 'byteOffset') || Object.hasOwn(value, 'byteLength')) && !known.has(value)) throw Error('Unsupported buffer-relative extension');
    for (const child of Object.values(value)) visit(child);
  };
  visit(json);
  return rows.filter(row => row.descriptor.buffer === 0);
}

function pack(json, bin) {
  const text = Buffer.from(JSON.stringify(json)), padded = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 32)]);
  const out = Buffer.alloc(28 + padded.length + bin.length);
  out.write('glTF'); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(padded.length, 12); out.writeUInt32LE(JSON_CHUNK, 16); padded.copy(out, 20);
  const offset = 20 + padded.length;
  out.writeUInt32LE(bin.length, offset); out.writeUInt32LE(BIN_CHUNK, offset + 4); bin.copy(out, offset + 8);
  return out;
}

/** Lossless delivery transform. Keep all nodes/materials/samplers/image entries,
 * redirect identical embedded image views and remove only their duplicate BIN
 * bytes. No transcoding, quantization, simplification or editable-source edits. */
export function deduplicateGlbImages(bytes) {
  const {json, bin} = unpack(bytes), rows = storage(json), images = json.images || [];
  const canonical = new Map(), aliases = new Map();
  for (const image of images) {
    if (image.uri || image.bufferView === undefined) continue;
    const index = image.bufferView, view = json.bufferViews?.[index];
    if (!view || view.buffer !== 0 || view.byteStride || Object.keys(view.extensions || {}).length) continue;
    const data = span(bin, view), key = `${image.mimeType}:${data.length}:${hash(data)}`;
    const previous = canonical.get(key);
    if (previous === undefined) canonical.set(key, index);
    else if (previous !== index) {
      if (!span(bin, json.bufferViews[previous]).equals(data)) throw Error('Image hash collision');
      aliases.set(index, previous);
    }
  }
  const report = {version: GLB_IMAGE_DEDUP_VERSION, sourceBytes: bytes.length, imageEntries: images.length,
    sharedImageViews: aliases.size, uniqueEmbeddedPayloads: canonical.size, removedBinaryBytes: 0, deliveryBytes: bytes.length};
  if (!aliases.size) return {bytes, report};
  const ranges = [];
  for (const [index, target] of aliases) {
    const view = json.bufferViews[index], first = json.bufferViews[target];
    if ((view.byteOffset ?? 0) === (first.byteOffset ?? 0)) continue;
    // Removing a multiple of four preserves alignment of every later payload.
    // Retain up to three unused tail bytes instead of assuming padding ownership.
    const start = view.byteOffset ?? 0, end = start + Math.floor(view.byteLength / 4) * 4;
    if (end === start) continue;
    for (const row of rows) {
      if (row.index === index) continue;
      const otherStart = row.descriptor.byteOffset ?? 0, otherEnd = otherStart + row.descriptor.byteLength;
      if (otherStart < end && otherEnd > start) throw Error('Image payload overlaps another stored range');
    }
    ranges.push({start, end});
  }
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) if (ranges[i].start < ranges[i - 1].end) throw Error('Overlapping duplicate image ranges');
  const relocate = offset => {
    let removed = 0;
    for (const range of ranges) {
      if (offset >= range.start && offset < range.end) throw Error('A retained range points into removed bytes');
      if (offset < range.end) break;
      removed += range.end - range.start;
    }
    return offset - removed;
  };
  // Snapshot before mutating: canonical views may themselves be relocated.
  const offsets = new Map(rows.map(row => [row.descriptor, row.descriptor.byteOffset ?? 0]));
  for (const row of rows) {
    const target = aliases.has(row.index) ? json.bufferViews[aliases.get(row.index)] : row.descriptor;
    row.descriptor.byteOffset = relocate(offsets.get(target));
  }
  for (const image of images) if (aliases.has(image.bufferView)) image.bufferView = aliases.get(image.bufferView);
  const pieces = []; let cursor = 0;
  for (const range of ranges) { pieces.push(bin.subarray(cursor, range.start)); cursor = range.end; }
  pieces.push(bin.subarray(cursor));
  const compact = Buffer.concat(pieces);
  json.buffers[0].byteLength -= bin.length - compact.length;
  const output = pack(json, compact);
  verifyGlbImageDedup(bytes, output);
  report.removedBinaryBytes = bin.length - compact.length; report.deliveryBytes = output.length;
  return {bytes: output, report};
}

/** Independent invariant check: all stored geometry/compressed streams and all
 * image payloads remain byte-identical, and all other JSON semantics are equal. */
export function verifyGlbImageDedup(before, after) {
  const a = unpack(before), b = unpack(after), originalRows = storage(a.json), nextRows = storage(b.json);
  if (originalRows.length !== nextRows.length || a.json.images?.length !== b.json.images?.length) throw Error('GLB structure changed');
  for (let i = 0; i < originalRows.length; i++) if (!span(a.bin, originalRows[i].descriptor).equals(span(b.bin, nextRows[i].descriptor))) throw Error('Stored geometry or image bytes changed');
  for (let i = 0; i < (a.json.images || []).length; i++) {
    const original = a.json.images[i], next = b.json.images[i];
    if (original.bufferView !== undefined && a.json.bufferViews[original.bufferView].buffer === 0 &&
        !span(a.bin, a.json.bufferViews[original.bufferView]).equals(span(b.bin, b.json.bufferViews[next.bufferView]))) throw Error('Image content changed');
    next.bufferView = original.bufferView;
    if (original.bufferView === undefined) delete next.bufferView;
  }
  for (let i = 0; i < originalRows.length; i++) {
    const original = originalRows[i].descriptor, next = nextRows[i].descriptor;
    if (original.byteOffset === undefined) delete next.byteOffset; else next.byteOffset = original.byteOffset;
  }
  b.json.buffers[0].byteLength = a.json.buffers[0].byteLength;
  if (!isDeepStrictEqual(a.json, b.json)) throw Error('GLB scene or material semantics changed');
  return true;
}
