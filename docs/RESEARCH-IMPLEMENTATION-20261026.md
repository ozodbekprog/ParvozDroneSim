# External browser research: review and implementation

26 October 2026, Asia/Tashkent. Started from `c97577b`, branch
`codex/demand-pilots`. The user requested checking, analyzing and implementing
the supplied research. The document's own stage-one/research-only wording is
part of its provenance, not a restriction replacing the user's implementation
request.

The [original supplied report](research/EXTERNAL-BROWSER-INVESTIGATION-20261025.md)
is preserved without edits: SHA-256
`678db3c41a29e19197091b0946e72318be0c10aa9281be6183b9fe0fded943da`.
It explicitly had no repository access and measured no hardware. Its strongest
contribution is separating delivery, residency, decoding, upload and rendering.
Its diagnosis of Parvoz cannot be taken as established without the local audit.

## What changed in the application/build

### Lossless map delivery and texture sharing

`tools/glb-image-dedup.js` finds byte-identical embedded image payloads with the
same declared MIME type, verifies equality after hashing, redirects duplicate
image bufferView references, and compacts only the redundant BIN ranges. It
relocates ordinary and Meshopt buffer offsets while preserving four-byte
alignment. It does not re-encode images, alter UVs, simplify geometry, quantize
attributes or remove LODs. Canonical GLBs and editable sources remain unchanged.

The verifier compares every embedded view and compressed stream, all image
payloads, and all remaining scene/material JSON semantics. Unsupported
buffer-relative extensions and overlapping ranges fail closed. A no-duplicate
input returns the original bytes. Content publication uses the actual optimized
hash/length, caches the transform for incremental builds, and still resolves
generated URLs back to the canonical source when the editor writes packages.

Readback of all five generated files passed, including matching canonical
SHA-256 values against the previous map audit. The
[machine-readable check](research/map-image-delivery-check-20261026.json) records
the exact file hashes. Sizes are decimal bytes, without HTTP compression:

| Map | Before | Generated delivery | Saved |
| --- | ---: | ---: | ---: |
| Minus Two | 26,340,900 | 26,340,900 | 0 |
| Hangar C03 | 270,814,652 | 270,304,988 | 509,664 |
| Liftoff Arena | 174,042,140 | 173,899,476 | 142,664 |
| Pine Valley | 204,877,164 | 136,088,540 | 68,788,624 |
| The Green | 265,604,208 | 263,294,924 | 2,309,284 |

Total removal is **71,750,236 bytes**. Pine is **33.58% smaller**; its 372
duplicate views now refer to their canonical payloads. The small difference
from the earlier image-only opportunity includes JSON changes and retained
alignment tails. This is a file-size result, not a measured network-time or
GPU-memory reduction.

Three r180's actual `GLTFLoader.loadTextureImage()` caches by image bufferView
and sampler. A real-loader regression confirms that identical image/sampler
combinations reuse one configured texture after the transform, while differing
samplers remain independent. This is stronger than assuming a smaller BIN
automatically changes GPU residency; exact whole-game memory savings remain
unmeasured.

The generated catalog changed only the four model URL substitutions, asset
lengths and content revision. Its normalized semantic comparison passed.
Revision is `85331b4bc0057c68`; protocol, gameplay definitions and physics do
not change.

### Shared geometry decoding with bounded batches and cancellation

The previous Meshopt integration exposed a Promise API but ran decoding on the
main thread. The new `src/model-decoder.js` uses the existing matching Three
Meshopt decoder in one module worker, shared by normal models and streaming
chunks. It sends up to 128 views per message, normally bounded to 8 MiB of
estimated encoded-copy plus decoded payload. Source views remain on the caller;
only admitted jobs are copied/transferred. Returned arrays transfer back.

An indivisible larger view runs alone and is counted explicitly. Pine has two
such views; the observed peak batch estimate is 17,372,090 bytes. This limit
does **not** bound an entire parsed GLTF, active scene, GPU allocation or browser
process.

Each parsing owner has one abort listener. Canceling it rejects/discards its
queued views without terminating another owner's work. An already-running
batch may finish; abandoned results cannot commit. A worker startup failure or
crash retries retained source views using a time-sliced main-thread fallback.
Small fallback jobs share a slice, avoiding a timer penalty for every tiny view.

Worker defaults are conservative: no geometry worker below four reported CPU
threads; one geometry worker otherwise. KTX2 uses one texture worker below
eight threads and two otherwise, instead of its previous default four. These
are scheduling defaults, not proofs that CPU hints identify a device's capacity.

The [browser decoder observations](research/decoder-browser-observations-20261026.json)
cover all **14,540 Pine views / 191,673,962 decoded bytes**. Every output view
has the same hash under both paths. Two diagnostic samples showed:

| Path | Total decode time | Largest observed timer heartbeat gap |
| --- | ---: | ---: |
| Previous blocking decoder | 269.8–288.1 ms | 269.8–288.1 ms |
| Bounded batched worker | 380.9–504.7 ms | 17.9–31.4 ms |

This improves responsiveness at a total decode-time cost; it is not advertised
as faster decoding. The initial one-view-per-message worker approach was
discarded after it showed excessive messaging overhead. The final design
reduces that overhead by batching.

These short in-app-browser probes exclude transfer, JSON, texture transcoding,
scene assembly, worker initialization and GPU work. Raw decoding always ran
first; other applications were open. Document validity flags passed, but native
presentation and input latency were not independently measured. They are not
UHD 620 or FPS acceptance results.

### Initial visible texture uploads

`src/prepare-scene-textures.js` warms the initial camera-visible material
textures before the flight ready gate, yielding after approximately eight
milliseconds of cumulative uploads. Shared textures are selected once. Hidden,
offscreen and collider-only meshes, generated render-target textures and videos
are excluded. A scene replacement cancels further warming. The renderer's own
version/resource management handles repeated preparation and recovery.

This is distinct from shader compilation. A single texture upload cannot be
preempted by this loop, and the selected set does not include every material
node or all geometry uploads. It does not promise that future camera turns or
LOD changes cannot hitch. The QA flight-scene tool now exercises this same
production method and reports selected/uploaded counts, yields and the longest
individual upload separately.

## Recommendations checked against the actual repository

| Report recommendation/claim | Review and decision |
| --- | --- |
| Add Meshopt/KTX2, caching, cancellation and collision workers | Already present. Retained the codecs/cache design; repaired geometry scheduling rather than adding duplicate systems. |
| Keep classic `WebGLRenderer` as default | The main game actually uses `WebGPURenderer` with a node-renderer WebGL2 fallback and TSL effects. Classic WebGL currently serves thumbnails. Switching renderer classes is not a flag-only change; no default renderer change was made. The previous isolated r180/r186 comparison also established no target-device win. |
| Exclude PlayCanvas because private editor hosting costs money | Overbroad. The [engine is an open-source library](https://playcanvas.com/products/engine) usable without the hosted editor. Migration remains unqualified, but editor pricing alone is not a reason to reject a render-only comparison. |
| 3D Tiles provides a hard total memory cap | Too strong. The [reviewed v0.5.3 LRU](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/v0.5.3/src/core/renderer/utilities/LRUCache.js) checks registered usage and updates it as work finishes. This does not reserve all parse/transcode/upload allocations or guarantee a bounded active set. The library remains a useful candidate; it is not installed as a supposed cure. |
| Separate hidden GPU residency from CPU cache | Supported by the reviewed [UnloadTilesPlugin](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/v0.5.3/src/three/plugins/UnloadTilesPlugin.js). Re-uploading retained CPU data still has a cost, and shared ownership must be correct. |
| Full spatial/HLOD streaming | Existing Minus Two prototype already covers coarse/detail visuals, sharing, cancellation and eviction. It lacks full flight/collision/quality integration and target-device qualification. It remains a prototype. These delivery changes do not claim that the game now streams complete maps. |
| Replace collision with three-mesh-bvh/offline trees | The project already has its own packed collision representation and cancellable preparation worker. Replacing collision merely to use another library would add flight-risk without demonstrated benefit. Existing flight collision tests remain mandatory. |
| Drop CPU arrays after upload | Not adopted. Collision and graphics recovery need explicit rehydration before discarding their data; clearing arrays blindly can break flight or context restoration. |
| Adopt newer Basis codecs/upgrade Three immediately | Not adopted without encoder/decoder and visual parity checks. Existing map payloads remain byte-identical, and the shipped decoder revision stays matched to Three. |
| Add a new CDN/cloud converter | Unnecessary for these local improvements. Oracle delivery, $0, existing permissions and accounts are unchanged. No restricted assets were uploaded to another processor or hosting service. |

The paper's assertions that the current problems are mostly delivery/residency
and that no alternative engine can fit are hypotheses from a limited search.
Neither replaces CPU/GPU measurements. In particular, large Low scenes can
still exceed the provisional triangle/draw budgets after these changes.

## Validation and remaining limits

Focused tests cover lossless compaction, hash/scene invariants, real GLTF texture
reuse, sampler separation, publication/editor roundtrip, worker batching,
fallback/crash behavior, cancellation isolation, shared-source preservation,
visible-only preparation, yielding and scene replacement. All five generated
deliveries pass readback verification and content validation. Production build
emits the separate geometry worker.

The complete suite passed **582/582 tests**, with no failures, skips or
cancellations. After the final shared texture-preparation method/QA integration,
the 41 affected decoder, texture, compilation and scene-switching checks passed
again. The final production build passed and emits the 22.46 kB geometry worker.
Vite still reports the existing large main-chunk warning; this work does not
resolve that separate startup-bundle issue.

The actual `World` flight loader reached Ready with optimized Pine, Kestrel,
course objects and collision preparation in the local in-app browser. The
rendered scene was inspected and its actual framebuffer exported locally to
`data/research-implementation-20261026/pine-ready-low.jpg`. Opening the hangar
and releasing/reopening the inspection aircraft also reached Ready, with the
shared worker idle and no fallback. These are scenario checks, not long-session
memory acceptance. It used WebGL2, Intel UHD device `0x9BC4`, Low,
1280×720 framebuffer, adaptation off. This is not the required UHD 620 laptop.
The decoder finished with no fallback or pending work; the visible texture
preparation selected/initialized 54 textures, with no scene cancellation.
The initial QA view still reports **5,028,148 triangles / 325 draw calls**,
above the provisional Low production budgets. No flight FPS or cold/warm
network-time improvement is inferred from these checks. Full-suite work and
other applications make the incidental load-phase times unsuitable as a
controlled before/after comparison.

Reproduce the delivery audit with
`node tools/check-map-image-deliveries.js` (read-only unless an output filename
is supplied). Use `tools/qa-model-decoder.html` for per-view parity and decode
responsiveness diagnostics, and `tools/qa-performance.html` for the real scene
loader. Do not repeat source extraction or re-export the maps to resume this
work. Generated map delivery files are rebuilt by the existing content sync;
the source GLBs remain canonical.

Target remains the actual i5/UHD 620, Low, 1280×720 internal resolution,
adaptation off, median frame time ≤16.7 ms and 1% low ≥50 FPS. It was not tested
here. Full-map residency, spatial streaming, long-session browser memory,
farther-view shader/geometry hitches and frame-rate acceptance remain open.

This work is local and GitHub implementation. No Oracle release, production
account/progress change, multiplayer-limit change, physics retuning, source
re-export, Ironworks restoration or paid service was performed. The last
recorded verified public release is the separate 25 October browser-03 release.

Implementation commits: `caa3093` (lossless deliveries) and `9e0dde0` (decoder,
texture preparation and developer checks), pushed normally to the agreed
private repository on `codex/demand-pilots`. A concurrent documentation-only
commit, `99c8486`, was preserved; the unfinished presentation changes were
excluded from this work's commits.
