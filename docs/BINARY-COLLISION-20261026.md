# Prepared collision delivery — local implementation

26 October 2026. Implements the first high-priority change from the
[independent investigation](INDEPENDENT-BROWSER-TECHNOLOGY-20261026.md).
Originally implemented locally. On 26 October, release `20261026-collision-01`
began serving this implementation on Oracle; final browser/finalization gates
remain pending. Production accounts/progress and admission 20 are preserved.
See [deployment status and evidence](ORACLE-COLLISION-20261026.md).

## Result

All five map deliveries now include a content-addressed `.pcol` sidecar with
the existing prepared collision arrays. New clients and the server prefer it.
The JSON sidecar remains available for old catalogs and editor recovery; the
new flight asset plan requests only the selected representation. Canonical
authored collision JSON, flight behavior, collider metadata/order, Kestrel IDs
and protocol 13 remain intact. Local content revision: `0fe968941a806c66`.

The binary keeps Float64 coordinates, triangle indices, bounds and tree nodes
without quantization. A worker validates and transfers views of one owned
buffer. It avoids decoding a large text string, parsing millions of JSON
numbers and rebuilding each mesh tree at flight time. Broad-phase installation
still runs; initial download buffers are still copied to protect shared caches.
This is not collision streaming.

## Measured comparison

[Raw samples, parity and browser evidence](research/collision-binary-check-20261026.json).
Intel i5-10300H, Windows, Node 24.15.0. Each sample starts a fresh Node process
and an actual worker, including input copy, transfer and client installation.
Three samples per arm/map, alternating order, warm OS file cache. No concurrent
test/build process from this task; other OS activity was not controlled.
Medians below exclude file read time. Peak RSS is the process high-water,
including its worker; it is not browser heap or VRAM. MiB = 1,048,576 bytes.

| Map | JSON → binary expanded MB | Preparation median, ms | Peak RSS median, MiB | Gzip bytes change |
| --- | ---: | ---: | ---: | ---: |
| Hangar C03 | 27.24 → 11.22 | 445.6 → 362.6 | 210.6 → 165.2 | −8.5% |
| Arena | 22.69 → 10.12 | 446.8 → 424.1 | 215.2 → 171.1 | −10.3% |
| Pine Valley | 102.99 → 46.28 | 1114.0 → 1013.1 | 549.3 → 193.0 | +5.9% |
| The Green | 138.11 → 62.57 | 1662.4 → 1105.1 | 683.2 → 274.8 | +6.3% |
| Minus Two | 4.52 → 1.82 | 168.5 → 146.6 | 144.0 → 138.0 | −1.6% |

These results support adoption for preparation/peak memory, especially on the
two largest collision maps. They do not demonstrate a general download-speed
gain: compressed Pine/Green transfers are slightly larger. Gzip sizes are
offline comparisons, not observed network timings. The first contended benchmark
was excluded from timing evidence and retained in ignored research data.

## Format and ownership

[Codec](../shared/collision-binary.js),
[compiler](../tools/content-packages.js),
[worker/server preparation](../shared/collision-preparation.js).

The 32-byte header records magic, schema version, endian marker, total length,
metadata length, CRC32 and a reserved field. Aligned sections hold typed arrays.
Metadata records the tree version and SHA-256 of normalized validated collider
JSON (`JSON.stringify`, UTF-8). Decoder checks include lengths/alignment,
finite coordinates, tree topology, permutation/leaf coverage and enclosing
bounds. Corrupt or unsupported deliveries fail before installing physics.
CRC32 detects damage; it is not an authentication mechanism.

The prepared pack's views share a backing buffer, so it stays alive until its
last collision consumer releases it. Independent eviction of individual mesh
arrays is not supported. Encoded disk/RAM caches remain separate and bounded
by their existing policies; a smaller pack may now fit the 64 MiB RAM cache.

Generated packs and build caches remain ignored and are reproducible from the
committed code and canonical sources. Compiler identity includes the format
version/source hash, so unchanged builds reuse the prepared output. Editor
source round-trips discard the derived URL and retain editable JSON.

## Verification and limits

- Every prepared tree array and collider metadata record matches the JSON path
  across all five real maps; 2,660 contact/sweep probes also match.
- Tests cover precision, transfer ownership, actual worker cancellation,
  malformed headers/body/cyclic trees, failed preparation, legacy loading,
  selected-only downloads, source round-trips and HTTP gzip/Range/cache behavior.
- Existing actual-map takeoff, flight/contact and all AI course/lap checks pass.
  The broader remaining tests, production build and content validation pass.
- An isolated local browser loaded Minus Two flight/course/Kestrel with binary
  map and route collision, then passed actual worker cancellation and explicit
  legacy JSON loading. This was headless Chrome/GTX 1650, not UHD 620 acceptance.
- The local HTTP server compresses full `.pcol` responses and keeps ranges as
  identity bytes. The future Caddy configuration adds an octet-stream encoding
  matcher because its [default compression matcher](https://caddyserver.com/docs/caddyfile/directives/encode)
  excludes that MIME type. Caddy executable validation/public HTTP are still
  release gates; no Caddy deployment or production request occurred here.

Browser total memory, target-device time-to-fly/FPS, long-session behavior and
public transfer times remain unconfirmed. Whole visual GLBs still dominate
large-map delivery; the separate streaming comparison does not install visual
streaming into the game.

## Reproduce

```powershell
npm run content:sync
node --test test/collision-binary.test.js test/collision-delivery.test.js test/collision-preparation.test.js
node tools/benchmark-collision-binary.js data/collision-binary-repeat.json 3
```

Reuse existing imported sources and generated map models; no re-export or new
Liftoff extraction is necessary. Preserve provenance and permission restrictions.
