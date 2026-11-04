# Second external investigation: checked against Parvoz

26 October 2026, Asia/Tashkent. Started from `aca048b` on
`codex/demand-pilots`. The newly supplied document differs from the first report.
The [unaltered second report](research/EXTERNAL-BROWSER-INVESTIGATION-SECOND-20261026.md)
has SHA-256 `182ac779feaf265814062dd70e5b3686269f5db1e68c3ffc24dd1303428d8ed0`.
Its research-only wording describes that author's work; the user separately
authorized checking, analysis and implementation here.

## Findings that change the implementation

The report correctly calls for measuring the active representation before
choosing a renderer or installing a streaming library. A new local resource
snapshot exposed a particularly expensive part of Parvoz's WebGL2 path:
Pine's scenery batches contained **653,904,630 bytes of geometry attributes**,
in addition to the source geometry retained for ownership/LOD/recovery. This
is counted typed-array payload, not measured driver VRAM or process memory.

The game already had a true `InstancedMesh` path, with per-placement frustum
culling and LOD visibility, but enabled it only for WebGPU. WebGL2 used
`BatchedMesh` even for repeated prototypes carrying uniform vertex-color
variations. That preserved draw submission grouping but copied a large amount
of repeated vertex/index data. Core Three instancing is the appropriate
existing library feature for this particular issue; adding a second instancing
library is not a prerequisite.

An initial exact-attribute sharing experiment in `BatchedMesh` was tested on
the real map and found **zero** shareable wrappers: the uniform color variants
make the complete attribute sets distinct. It did not improve Pine's payload
and is not retained as a supposed optimization. The useful transformation is
sharing the prototype while representing its exact uniform RGB as an instance
tint. Spatially varying color and vertex alpha remain in the geometry.

The audit also found a correctness defect in the existing instance key:
`InterleavedBufferAttribute` has no `.id`. Non-indexed interleaved geometries
could therefore collide even when their vertex data differed. The instance
key now uses stable weak object identities for indices and attributes.
Unrelated interleaved geometry cannot become one prototype. No deep hashing,
vertex mutation or image recompression is introduced.

## Implemented and measured

The normal renderer policy now enables the existing true-instance path for
both WebGL2 and WebGPU. Heterogeneous `BatchedMesh` creation is controlled
separately by multi-draw support. Without that optional WebGL extension,
repeatable prototypes still become core instances; unique meshes stay visible
in the ordinary path. Transparent/custom-material exclusions, per-placement
frustum culling, spatial cells and authored LOD visibility remain in force.

The [reproducible browser comparison](research/scenery-instance-check-20261026.json)
records actual Pine flight-scene loads with identical Low settings and assets:

| Counted payload | Previous WebGL2 path | True instances |
| --- | ---: | ---: |
| Batch geometry attributes | 653,904,630 bytes | 221,122,360 bytes |
| Entire scene geometry attributes | 870,700,164 bytes | 437,917,894 bytes |
| Known reachable backing buffers | 879,856,020 bytes | 447,566,429 bytes |
| True instance batches | 0 | 57 |
| Heterogeneous batches | 166 | 58 |
| Initial rendered draw calls | 325 | 294 |
| Initial rendered triangles | 5,028,148 | 5,028,148 |

**432,782,270 geometry attribute bytes are avoided** in the batching subtree,
a 66.2% reduction. Source geometry stays available. The delivered assets and
material texture contents stay unchanged; this improvement is geometry
representation, not a new texture compression or map-download result.
The initial view still exceeds the provisional Low budgets: fewer draws do not
make five million triangles fit the 150–300k production guideline.

The overview, close gate and reverse captures at 1280×720 have matching camera
poses/settings and **identical exported JPEG hashes / zero changed RGB pixels**.
The actual frames were also inspected. This verifies those three Low views,
not every possible camera/quality/driver permutation. The images and raw QA
reports are retained under ignored `data/research-followup-20261026/`; the
compact checked-in report records image hashes and payloads. Reproduce it with:

```powershell
node tools/check-scenery-instance-frames.js data/research-followup-20261026 pine
```

The forced no-multi-draw QA configuration also reached Ready with **57 instance
batches and zero heterogeneous batches**; unique meshes remain on the ordinary
path. This exercises the fallback configuration on the available GPU, not a
claim that its physical driver lacks the extension.

The Green also reached Ready under the normal default policy, with **139 true
instance batches and 548 heterogeneous batches**, and rendered at Low 1280×720.
Opening its hangar also reached Ready. No warning/error logs were reported in
the checked Pine-instance and Green-default browser runs. This second-map check
is functional, not a measured Green before/after memory or frame-rate trial.

**73 affected tests passed** after the final renderer policy and diagnostic fix, covering instance
packing, colors, LOD/frustum behavior, interleaved identity, optional-extension
fallback, scene switching, compilation, preparation and diagnostic accounting.
The final production build passed. The existing large main-bundle warning
remains; this work adds no runtime dependency or shader/codec version change.
The diagnostic fix explicitly excludes generated render-target textures from
the material texture estimate, matching that function's documented scope.
Resource counts still do not establish a complete GPU-memory budget.

## External claims: corrections and qualification

| Topic | Check and decision |
| --- | --- |
| Classic `WebGLRenderer` as Parvoz's baseline | Incorrect repository assumption. The actual game uses `WebGPURenderer`, TSL and its WebGL2 fallback. Classic WebGL remains in thumbnails. A renderer-class replacement is a material/post-processing project, not a backend toggle. |
| WebGPU overhead for many objects | The upstream [UBO issue #30560](https://github.com/mrdoob/three.js/issues/30560) is still open when checked. This supports investigating submission overhead; synthetic forum figures do not establish Parvoz's frame time or a UHD 620 result. |
| Current Three / meshoptimizer versions | [Published registry metadata](research/package-check-second-20261026.json) reports Three **0.186.1**, meshoptimizer **1.3.0**. Parvoz intentionally still uses matched Three r180 runtime/codecs; an isolated upgrade comparison already exists. No blind dependency upgrade. |
| InstancedMesh2 | Published `@three.ez/instanced-mesh` **0.3.16**, MIT, declares Three >=0.159.0. Repository main's [package manifest](https://raw.githubusercontent.com/agargaro/instanced-mesh/master/package.json) instead requires >=0.186.0. Published artifacts and main are different evidence; a broad peer range alone does not qualify its runtime on r180/TSL. Parvoz's existing core-based implementation was tested first. |
| Needle progressive | The current npm `latest` tag is **4.0.0-alpha.8**, MIT, rather than the report's older changelog entry. It remains a prerelease and requires compatible preprocessed assets. No Liftoff assets are sent to cloud conversion. |
| 3D Tiles hard memory caps | `3d-tiles-renderer` **0.5.3**, Apache-2.0. Its [pinned LRU implementation](https://raw.githubusercontent.com/NASA-AMMOS/3DTilesRendererJS/v0.5.3/src/core/renderer/utilities/LRUCache.js) checks registered usage before admission and updates usage later. This is not a reservation of every in-flight parse/transcode/upload allocation or a hard limit on a browser process. Keep the prior source review and challenger experiment; do not claim total memory safety from an LRU setting. |
| GPU texture format and file size | Correct distinction. Actual local Pine resources report **RGBA_BPTC_Format (BC7)** plus ordinary RGBA textures. The matching [r180 KTX2 loader](https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/jsm/loaders/KTX2Loader.js) selects by format/capabilities; it even preserves a historical ETC1S ordering quirk. Do not infer GPU bytes from encoded GLB/KTX sizes. |
| BVH always reorders source indices | Overbroad. Current [three-mesh-bvh documentation](https://github.com/gkjohnson/three-mesh-bvh) includes an `indirect` option. Its MIT license is verified. The existing packed collision accelerator/worker remains in use; swapping collision libraries is unnecessary for this render-only change. |
| r186 KHR_meshopt support unknown | The pinned [r186 GLTFLoader](https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/jsm/loaders/GLTFLoader.js) explicitly registers `KHR_meshopt_compression`. That does not make the same extension compatible with the current r180 loader. Existing deliveries retain their supported extension. |
| Cache API / retries / byte ranges | Already implemented: shared request ownership, bounded encoded caches, explicit map retention, silence timeouts, retry and verified Range handling. Cross-reload partial persistence is a separate feature; no new R2 account, OPFS store or hosting change is required for the batching improvement. |
| Shader/upload pre-warm | Already implemented and extended by the first research implementation. Shader compilation and texture uploads stay separate. It does not promise every future view is hitch-free. |
| Engine migration, R2, assets | No matched-map target-hardware evidence warrants a renderer/engine rewrite or a new hosting provider. Existing $0 Oracle delivery remains separate. No asset purchase, extraction, source remodel, physics change or cloud upload. |

Only the high-impact claims needed for the implementation were independently
rechecked. The external forum measurements and vendor engine benchmarks were
not reproduced. Unverified migration/streaming alternatives remain candidates,
not declared failures or established speedups.

The second report's missing cancellation/source check was also completed.
The [checked source hashes and findings](research/streaming-source-check-second-20261026.json)
record the pinned v0.5.3 sources. In
[TilesRendererBase](https://raw.githubusercontent.com/NASA-AMMOS/3DTilesRendererJS/v0.5.3/src/core/renderer/tiles/TilesRendererBase.js),
LRU eviction aborts the tile's controller, removes queued work and passes the
signal to `fetchData`. The
[Three implementation](https://raw.githubusercontent.com/NASA-AMMOS/3DTilesRendererJS/v0.5.3/src/three/renderer/tiles/TilesRenderer.js)
checks cancellation before committing a parsed scene and disposes abandoned
texture results. This does not prove immediate cancellation merely on leaving
view. The
[unload plugin](https://raw.githubusercontent.com/NASA-AMMOS/3DTilesRendererJS/v0.5.3/src/three/plugins/UnloadTilesPlugin.js)
retains CPU data for re-upload while disposing GPU resources. Default per-tile
disposal is not proof of safe cross-tile sharing; Parvoz's pooled texture
ownership still needs to be integrated and tested in a matched tileset trial.

## Diagnostic method and limits

`tools/scene-resource-inventory.js` reports unique attribute storage, backing
ArrayBuffers reachable from a subtree, materials, material texture formats and
stored mip payloads. Interleaved attribute storage is counted once. Known
batching-owned source matrices/colors/spheres and metadata texture backing
arrays are included in the reachable-buffer figure. It runs only on explicit
QA reports, outside the flight frame loop.

Hidden source meshes and inactive LODs remain part of the reachable inventory.
The separately reported visible attribute bytes mean view-eligible data, not
driver residency. The snapshot excludes renderer/driver bookkeeping, JS object
overhead, render targets, cache entries outside the subtree and platform
allocations. These counters must never be relabelled total VRAM, browser RSS,
or a completed leak/soak acceptance test.
The compact scenery comparison intentionally records geometry payloads;
ancillary texture totals in the early raw snapshots predate the final
render-target exclusion and must not be used for texture-budget acceptance.

The local QA tool retains `?legacyBatches` and `?instances` comparisons and now
reports both the entire scene and the scenery batching subtree. Actual flight
assets, collision readiness, the configured Low preset and a real 1280×720
framebuffer are used. The available machine has Intel UHD device `0x9BC4`,
not UHD 620. Ordinary load-stage times are incidental diagnostics, not controlled
cold/warm benchmarks. No FPS improvement is inferred from buffer counts.

## Remaining gates

The report's E0/E1/E2/E3 ideas are useful, but their complete acceptance protocols
have not been performed. In particular, the real UHD 620 laptop, five cold/ten
warm runs, a 90-minute memory soak, driver/shared GPU memory, fast-flight
streaming routes, forced context loss and public network delivery are not
qualified here. A reachable payload snapshot is not an ownership event ledger.

The largest remaining architectural work is whole-map residency and spatial
streaming with authored coarse coverage, flight/collision integration and
quality-switch parity. Instancing preserves the triangles of the selected
authored LOD; it does not reduce the excessive triangle count or solve texture
overdraw. Reuse the existing Minus Two streaming prototype and verified map
sources; do not restart extraction, restore Ironworks or invent performance
acceptance from another computer.

This work is local/GitHub. Oracle, production accounts/progress, admission 20,
physics and Kestrel identifiers are unchanged. The prior verified public release
remains separate from this implementation.

Implementation commits are `a19f8fd` (WebGL2 instancing, safe extension fallback
and interleaved-attribute identity) and `33b8c66` (payload diagnostics, material
render-target exclusion and frame comparison tool), both pushed normally to
the agreed private repository. Independent presentation/PDF work and its
quickstart note were kept out of these commits.
