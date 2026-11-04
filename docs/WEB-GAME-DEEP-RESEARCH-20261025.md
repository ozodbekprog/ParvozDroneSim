# Browser game research: payloads, streaming internals and GPU execution

25 October 2026, Asia/Tashkent. Follow-up to
[the first technology survey](MODERN-WEB-GAME-RESEARCH-20261025.md).
Source baseline `58d2207`, branch `codex/demand-pilots`. New work consists of
read-only inspections of all five canonical map GLBs, upstream source and
documentation. No engine was installed or benchmarked, and no game asset,
production account, runtime or Oracle release was changed.

**Next research pass:** [community reports and maintainer resolutions](COMMUNITY-WEB-GAME-RESEARCH-20261025.md)
adds Reddit/forums, benchmark-method checks and further system qualifications.

## Findings that change the priorities

1. **Pine Valley has 68.783 MB of repeated, byte-identical embedded images.**
   It has 610 image entries but 238 unique encoded payloads. This is a concrete
   deduplication opportunity before changing an engine or reducing quality.
2. **Hangar and Arena are geometry-heavy deliveries; The Green is texture-heavy.**
   Their first experiments should differ. Generic texture advice cannot address
   the majority of Hangar's file.
3. **Our Meshopt geometry decoder supports workers but currently runs without
   them.** Its Promise API falls back to synchronous decoding inside a Promise
   callback. This is distinct from the collision worker already implemented.
4. **The scene description is a substantial payload too.** The Green includes
   16.123 MB of JSON and 42,739 nodes; Pine includes 13.503 MB and 26,762 nodes.
   Moving only decompression does not remove scene construction and cloning.
5. **Shared delivery across maps has another 51.123 MB of image reuse**, after
   deduplicating each map independently. Cacheable content-hash URLs can exploit
   this; embedding everything inside different GLBs cannot reuse individual
   images through the HTTP cache.
6. **Some newly found systems are useful references but not qualified drop-ins.**
   `stream-glb` has limitations in range handling and memory accounting;
   its advertised npm package returned public-registry HTTP 404. hello-terrain
   requires newer Three and is alpha. loaders.gl's new tiles package is also
   alpha, with APIs different from its older documentation.

These are source/file observations and engineering implications. They do not
establish how many milliseconds each cost contributes on the target laptop.

## New local evidence: what is inside our maps

The [read-only audit](research/browser-stack-20261025/audit-payloads.mjs) reads
GLB JSON, image buffer spans, KTX2/PNG headers and SHA-256 hashes. It does not
decode meshes or images, export models, or alter canonical files. Full file
hashes and raw figures are in
[map-payload-audit.json](research/browser-stack-20261025/map-payload-audit.json).

All sizes here are decimal MB of local file bytes. Compressed HTTP transfer,
browser allocation and GPU memory are separate quantities.

| Map | Whole GLB | JSON | Embedded images | Meshopt compressed spans | Logical decoded Meshopt views |
| --- | ---: | ---: | ---: | ---: | ---: |
| Minus Two | 26.341 | 1.219 | 13.617 | 11.501 | 30.665 |
| Hangar C03 | 270.815 | 6.396 | 74.352 | 190.055 | 472.608 |
| Arena | 174.042 | 4.869 | 62.152 | 107.009 | 216.823 |
| Pine Valley | 204.877 | 13.503 | 122.728 | 68.615 | 191.674 |
| The Green | 265.604 | 16.123 | 177.697 | 71.752 | 162.020 |

Small remaining BIN spans and chunk headers/padding explain the remainder.
Decoded-view sizes sum `count * byteStride` from Meshopt declarations. They
are not measured peak memory, do not include all scene/texture/physics data,
and may include levels that are never simultaneously visible.

Hangar's geometry occupies **70.2%** of the file; Arena's **61.5%**. The Green's
images occupy **66.9%**. Pine's image bytes are **59.9%**, but duplicates account
for much of that. The candidate architecture should follow these differences.

| Map | Image entries | Unique encoded images | Repeated encoded bytes inside this GLB |
| --- | ---: | ---: | ---: |
| Minus Two | 85 | 85 | 0 MB |
| Hangar C03 | 375 | 373 | 0.510 MB |
| Arena | 330 | 328 | 0.143 MB |
| Pine Valley | 610 | 238 | **68.783 MB** |
| The Green | 910 | 896 | 2.309 MB |

Image spans do not overlap in these five files, so this is not merely multiple
JSON references to the same stored bytes. For example, one 337,884-byte Pine
KTX2 payload appears eight times at image indices 17, 29, 37, 149, 157, 165,
483 and 499. SHA-256 groups and indices are retained in the audit.

Removing only identical encoded image copies has a theoretical Pine file-size
opportunity of about **204.877 -> 136.094 MB**, before changed JSON/padding and
exporter behavior. This is an arithmetic estimate, not an exported result.
At ideal 5 Mbps it represents approximately 110 seconds of avoided transfer.
Actual delivery depends on compression, throughput and cache state. Preserve
separate samplers, UV transforms, texture roles and color spaces when sharing
an image; identical image bytes do not imply identical material state.

Across all five GLBs there are 1,630 unique image payloads totaling 327.679 MB.
After per-map deduplication, another **51.123 MB** is repeated between maps.
This is an upper opportunity when visiting all those maps, not a first-flight
gain for every map or proof of currently duplicated GPU allocations.

The inspected embedded images have dimensions no larger than **512x512**.
There are 598 KTX2 plus 12 PNG images in Pine; every embedded image in the other
four files is KTX2. Advising a blanket 2K-to-512 reduction would miss the current
state. The useful texture choices are **which images/levels become resident,
how many duplicate copies survive, codec/target format, and an explicitly
reviewed further reduction where appearance allows it**.

## A more immediate reuse opportunity: Meshopt's existing workers

Inspected local r180 files:

- `src/asset-loader.js:15` attaches `MeshoptDecoder` without enabling workers.
- `src/stream-chunk-loader.js:78` uses that decoder as well.
- `node_modules/three/examples/jsm/loaders/GLTFLoader.js:1718` chooses
  `decodeGltfBufferAsync` when present.
- `node_modules/three/examples/jsm/libs/meshopt_decoder.module.js:181` uses
  a worker only when its worker list is nonempty. Otherwise `ready.then(...)`
  invokes `decode(...)` synchronously.

The [official Meshoptimizer JS guide][meshopt-js] documents `useWorkers(count)`.
Thus there is an implementation-ready experiment using an existing dependency:
one or two geometry workers, compared to zero, with the same assets/settings.
No library migration is required for that experiment.

Do not set every available pool to the number of logical CPUs. KTX2's local
WorkerPool defaults to four, collision has its own worker, and the render/UI
threads still need CPU time. Each geometry worker has its own WASM state.
The inspected Meshopt implementation copies each compressed view into an
owned typed array before transfer and transfers the decoded result back.
This keeps the original bytes usable but has staging and queue costs.

The acceptance comparison must measure main-thread long tasks, total ready
time, queued/in-flight decoded bytes, worker/WASM memory and cancellation while
a map changes. Codec workers alone do not move GLB JSON parsing, Object3D
construction, material copying or GPU upload off the main thread. A reduction
in blocking may be valuable even if total loading time stays similar.

## New streaming candidates and source qualifications

The [source collection](research/browser-stack-20261025/deep-source-audit.json)
records 17 upstream file inspections, five public repository HEAD snapshots,
nine package lookups and local decoder/loader hashes. Eight package lookups
succeeded; the `stream-glb` lookup returned 404 and remains recorded. Repository
HEAD, published npm version and older documentation are deliberately separate.
The [collector](research/browser-stack-20261025/collect-deep.mjs) reads source;
it does not execute downloaded code or install packages.

### stream-glb: valuable worker/prototype ideas, substantial qualification gaps

[AnEntrypoint/stream-glb][stream] describes progressive GLB/VRM baking, a worker
decoder pool and shared instanced geometry. Its reported 1,100-entity/FPS result
is an upstream workload claim, not a Parvoz measurement. Source revision
`44b9a1c524df0aefaa883ea3208af7e834963f78` was inspected.

Source observations:

| Source anchor | What it shows | Implication for Parvoz |
| --- | --- | --- |
| `model-pool.js:217` | Shader injection via `onBeforeCompile`; out-of-frustum vertices are collapsed in the vertex shader | WebGL-oriented path; not compute compaction before vertex work |
| `model-pool.js:712` | Range fetch accepts HTTP 200 and slices the full returned buffer | A server ignoring Range can cause a whole-asset download; a subarray retains its backing buffer while referenced |
| `model-pool.js:715` and worker `:217` | Inspected fetches have no request abort signal | Need cancellation and stale-result ownership tests before integration |
| `model-pool.js:2277` | Byte tracking adds supplied costs into `_totalBytes`; eviction excludes active resources | Does not establish a hard total process/GPU bound; live resources can keep it above target |
| `bake-progressive.mjs:509` | Image generation emits WebP | Must qualify compressed GPU residency; converting our KTX2 images to WebP could increase it |

The range function does not perform our current transfer layer's checks on
Content-Range, encoding and ETag continuity. Preserve or extend
`src/asset-transfer.js` rather than copying that simpler transport path.
The worker's transferable attribute output and shared prototype structure are
useful design references. The README/package declare MIT; the advertised
`@anentrypoint/stream-glb` public registry endpoint returned **HTTP 404** during
this pass. Do not assume its installation command is presently usable.

**Decision:** source reference and isolated candidate, below NASA/Needle for a
first adoption experiment. No demonstrated WebGPU/material/cancel/memory parity.

### loaders.gl: a serious second hierarchy/scheduler candidate

[Tileset3D documentation][tiles-doc] describes visibility-prioritized requests
and an estimated memory budget that may be exceeded by visible content. Its
framework-neutral [GLTFLoader][loaders-gltf] returns scene data, not an already
integrated Three scene with our materials and lifetimes.

Registry observations: `@loaders.gl/tiles` and `@loaders.gl/gltf` latest tags
are **4.5.4**. The separate `@loaders.gl/tiles-3d` latest tag is
**5.0.0-alpha.13**. Current HEAD reorganizes 3D tiles into the latter module.
Its [inspected source][tiles-source] uses `cacheBytes` and
`maximumCacheOverflowBytes`, memory-adjusted screen-space error, ready-ancestor
coverage, and motion/view-based priorities. These are useful mechanisms, but
do not apply old `maximumMemoryUsage` examples to that API indiscriminately.

The [indexed archive source][archive-source] supports archive-backed resource
lookup through `HttpFile` or `BlobFile`. It is relevant to the tradeoff between
thousands of tiny URLs and a monolithic download. It delegates archive opening
and member extraction; that alone does not prove efficient range coalescing,
cancellation, byte accounting or our desired caching behavior.

**Decision:** compare scheduler/resource-source design with NASA's renderer;
start with a stable qualified version and treat 5.x features as a separate
experiment. Do not select an alpha merely to obtain a promising API.

### Nexus: mature multiresolution streaming for large static surfaces

[Nexus][nexus] builds and streams batched multiresolution meshes with compression.
It is relevant to a large detailed terrain/static environment, particularly
when a single huge mesh defeats object-level LOD. Its README distinguishes
**MIT JavaScript** from **GPL C++ tools**; tool/runtime licensing differs.

The experiment must preserve our material/UV representation, map scale, normals,
collision source and gaps. A scanned-object viewer does not cover interactive
props, custom terrain shading or fast flight by itself. Its age is not a reason
to discard proven techniques, but WebGPU integration and present maintenance
need qualification.

**Decision:** reference or static-surface challenger after current shared-glTF
packaging; not a first whole-game migration.

### hello-terrain, virtual texturing, and Taos

[hello-terrain][hello] provides variable LOD, terrain editing and TSL/compute
integration. Registry latest is **0.0.0-alpha.14**, with Three **>=0.182.0** as
a peer; current game is r180. It is a potential future outdoor-terrain system,
not a direct replacement for arbitrary authored buildings, interiors or bridges.
Its package metadata did not establish a license in this lookup; verify exact
source/package terms before adoption.

The current [virtual-texture RFC/example][vt-rfc] uses a fixed physical atlas,
page table, bounded resident slots and coarse fallback. The author explicitly
leaves KTX2 pages, arbitrary-mesh demand, terrain integration and shared
cross-material residency to later work. It is an open proposal/reference, not
an installed Three core feature. The old `elfrank/virtual-texturing` project
targets much older Three and lists known correctness problems [source][old-vt].

[Taos's terrain book][taos] describes CDLOD, virtual heightmaps and indirect
rendering. The linked GitHub repository returned **404** through the public web
tool in this research. The book is useful architectural reading; source access,
license, buildability and suitability were not established. Do not call it a
verified reusable engine based only on its documentation.

**Decision:** prototype terrain demand and paging separately from a full map
port. Reuse our retained Blender/native terrain data; no terrain regeneration.

## Texture streaming is three different engineering choices

| Approach | What gets smaller first | What still needs engineering |
| --- | --- | --- |
| Whole-texture variants, e.g. progressive 128/256/512 | Initial download and low-quality texture allocation | Temporary old/new overlap, shared identity, cancellation and material updates |
| Fill mip levels of an already allocated full-size texture | Download/upload work before sharp detail | Selecting a smaller view or sampling mip does not itself shrink the allocated texture object |
| Software virtual texture atlas | Resident pages for a much larger logical surface | Page demand, table updates, borders/filtering, normal/data maps and fallback |

WebGPU texture size/mip allocation is selected when creating the texture; a view
selects a subset for access [creation][texture-create], [view][texture-view].
Do not treat a view restricted to low mips as proof of reduced allocation.
For our mostly <=512 images, shared whole-texture variants may be much simpler
than virtualizing every material. Large continuous terrain surfaces are a more
appropriate first virtual-texture case.

Preserve compressed GPU targets. WebP/JPEG/AVIF can reduce transmission yet
expand in GPU memory; Basis/KTX2 can transcode to a compressed target where
available. Record actual BC/ETC/ASTC/RGBA targets, mip chains, and alpha/data-map
requirements on the real adapter. Avoid reporting container byte sizes as VRAM.

Useful arithmetic: a 512x512 RGBA8 image with full mips is about 1.33 MiB; an
8-bit-per-pixel block-compressed equivalent is about 0.33 MiB, plus small block
rounding. A quality swap can temporarily own both. These are payload estimates,
not a measurement of driver/renderer allocations.

## GPU culling: choose the stage that removes the expensive work

Four frequently conflated approaches have different consequences:

| Technique | Work it can avoid | Main limitation |
| --- | --- | --- |
| CPU spatial/frustum selection + compact instance buffers | Entire unselected instances before draw | CPU traversal/upload cost; spatial groups and stable buffers matter |
| Vertex-shader visibility test | Most later raster/fragment work | Vertex shader still runs for submitted geometry; submitted draw counts need honest reporting |
| Compute compaction + indirect draws | Vertex/fragment work for rejected instances | Compute, buffers, synchronization and fallback complexity |
| Occlusion culling (depth/query/software) | Hidden geometry within the frustum | Conservative handling and delayed results; many queries/readbacks can cost more than they save |

Three's [indirect example][indirect] and [occlusion example][occlusion] are useful
small controls. The [city author's software-culling report][city-culling] shows
a conservative depth-buffer approach for an instanced city. Those measurements
belong to that game. Our outdoor/open-space flight, rapid roll/yaw and camera
reset can expose geometry hidden in the prior frame.

For Parvoz, compare spatial instance groups first, then compute/indirect where
GPU submission/vertex work warrants it. Use occlusion principally for dense
Hangar/Arena structures; sparse aerial terrain may offer less benefit. Keep
foreground objects and a conservative camera-motion margin, and invalidate
history on teleport/reset. Flight collision geometry must never follow visual
occlusion. Validate shadows/reflections separately; main-camera visibility is
not necessarily their visibility.

## Loading freezes: shaders, scene assembly, uploads and worker scheduling

The game already has sliced program preparation in
`src/compile-scene-programs.js`. Reuse that work. The [current renderer API][compile]
includes asynchronous compilation, and modern Three also exposes asynchronous
compute compilation. The [WebGPU specification][webgpu] prefers asynchronous
pipeline creation where possible. Neither eliminates material graph generation,
variant count or upload cost.

Qualification checks for the next implementation:

- Cache equivalent structural material/program variants; preserve meaningful
  differences. Recreating materials can still add JS work even when shaders share.
- Bound concurrent compilation rather than compiling every map/LOD immediately.
  Compile actual pass targets and relevant instanced/shadow/terrain variants.
- Separate shader/module creation, pipeline readiness, texture transcode, upload,
  Object3D construction and first controllable frame in the trace.
- Test warmed and fresh application/browser states. Browser and driver pipeline
  caching are implementation-dependent. An [open Firefox report][firefox-cache]
  describes repeat-compilation behavior in one configuration; its unconfirmed
  report is a hypothesis to reproduce, not a universal browser conclusion.
- Use frame-slack scheduling for optional visual work. `requestIdleCallback`
  cannot be relied on to run promptly during sustained flight. Do not put
  mandatory flight readiness behind an idle-only queue.

[Comlink][comlink] can simplify worker messages, and transferables can avoid
copying owned buffers [MDN][transfer]. Neither supplies task cancellation,
admission control or a residency policy automatically. Current worker messages
are already small enough that adding an RPC library is not the first fix.
[react-three-offscreen][offscreen] is explicitly experimental and targets R3F;
its DOM shims should not be treated as a zero-cost migration for our vanilla app.

## Transport, disk caching and memory lifetime

**Range streaming needs a compatible asset layout and HTTP behavior.** An
arbitrary byte slice of our existing GLB does not contain all dependencies needed
to render that portion. A versioned manifest/index must map semantic assets to
their complete compressed views, materials and images. Verify 206 offsets,
Content-Range totals, encoding and resource identity [HTTP guide][ranges].
If an origin responds 200, an explicit full-download fallback must have its own
size/peak budget rather than quietly repeating a 270 MB response per tile.

**Fewer requests and fewer bytes are separate goals.** Compare independent
content-hash resources against indexed packs/range access. Independent resources
favor reuse and immutable caching; packs reduce metadata/request overhead but
need selective access and cache-aware range behavior. Avoid one all-map pack.
Check public Oracle headers/protocol/network timing in a later measurement;
this research did not change server configuration or perform a fresh network
benchmark. The [Edge network guide][network] distinguishes TTFB, queueing and
content-transfer delays. A transport issue cannot be diagnosed from FPS alone.

**A second cache can add copies.** OPFS provides file-oriented storage and
worker access [OPFS][opfs], but a final `file.arrayBuffer()` plus monolithic
GLTF parse still allocates the complete input. Its benefit must be shown for
resumable disk staging or indexed packs. Browser storage is quota/eviction-based
[storage][storage]. Optional map downloads must tolerate missing cached data;
retain production account/progress ownership on the server.

**Response cloning can buffer large bodies.** MDN documents that a slow clone
consumer can accumulate unread data without a limit [clone][response-clone].
Do not add service-worker `response.clone()` caching of very large map files
and assume that it is zero-copy streaming. This is a design qualification,
not a diagnosed current leak.

**ImageBitmap and GPU lifetime need explicit ownership.** GLTFLoader documents
special bitmap cleanup [loader][three-loader]. The generic current model cleanup
disposes textures/geometries/materials; the inspected `src/` paths do not show an
ImageBitmap close policy. Pine has 12 PNG images, so verify their decoded object
type and lifetime before claiming a leak or adding `close()`. Closing a bitmap
still used by a shared texture/re-upload path would introduce a different bug.
Most current images are KTX2 typed payloads, not evidence of this bitmap issue.

**Recovery from device loss is a separate reliability requirement.** WebGPU
exposes `device.lost` [API][device-lost]. Our source search found no application
recovery handler by that name or a WebGL context-loss handler. Qualify actual
renderer behavior before adding one. Recovery should reconstruct resources
through their owners, show a readable status and preserve session/settings;
initial WebGPU-to-WebGL fallback alone does not prove recovery after mid-flight
device loss. The GPU-process/GC distinction is explained in the
[GPUWeb explainer][gpu-explainer].

## Additional engine/system candidates

| Candidate | New information | Position |
| --- | --- | --- |
| Galacean | WebGL/glTF engine, reference-counted resource manager; registry stable 1.6.13 and separate 2.0 alpha track [project][galacean], [resource source][galacean-resource] | Credible additional WebGL comparison if primary challengers fail; not evidence that WebGPU is required |
| Wonderland Engine | WASM-oriented web engine; current pricing page allows free use up to a stated revenue threshold, with royalties beyond [terms][wonderland] | Technically relevant but proprietary licensing/product pipeline is a separate choice; no account, agreement or purchase made |
| Filament web | Emscripten JavaScript/WASM renderer and offline material compilation [source][filament] | Rendering/pipeline reference, not a complete ready Parvoz gameplay/streaming system |
| Spark 2.4.0 | MIT splat renderer; RAD/RADC LOD and paged loading [docs][spark-lod] | Useful residency/streaming reference. Splats do not preserve editable mesh topology or authoritative collision; no map conversion selected |
| PHY 0.14.0 | Worker/direct bridges for multiple physics engines; package peer requires Three >=0.183.2 [project][phy] | Useful solver comparison harness; not a handling-preserving flight upgrade. README notes some backends' sources are not exposed |

These additions broaden the investigation. The main engine challengers remain
PlayCanvas and Babylon.js because they already match more of the web-game
integration requirements. A different authoring/runtime stack must earn its
migration cost with a measured complete scenario.

## Revised experiment queue

| Priority | Concrete experiment | Why now / acceptance evidence |
| --- | --- | --- |
| A | Byte-preserving Pine image dedup in a separate delivery | Large proven redundancy; compare file hashes, image/material bindings, full geometry/route parity and actual transfer |
| A | Meshopt worker 0/1/2 comparison | Existing supported capability is unused; compare responsiveness, total load, staging peak and cancellation |
| A | Texture/prototype dependency manifest | Exploit shared resources inside and across maps without duplicating material configuration |
| B | Hangar/Arena authored Low-only geometry delivery | Addresses their geometry-heavy bytes and decode; preserve distant coverage and flight gaps |
| B | The Green texture admission/refinement + scene/prototype reduction | Addresses texture volume and large scene graph; validate appearance and all routes |
| B | NASA/Needle matched streaming comparisons | Compare reusable systems against our prototype using the same verified resources |
| C | Spatial culling versus compute/indirect; conditional occlusion | Choose from measured CPU/GPU/overdraw costs on the same route and framebuffer |
| C | Renderer adapters and any migration decision | Keep content equal; complete gameplay parity before selecting a replacement |

Deduplication can reduce bytes without reducing image quality. Low-only delivery
and a new texture codec can change appearance and need visual review. Workers
can reduce blocking while increasing memory or leaving total load unchanged.
Those outcomes must be reported separately.

All acceptance gates from stage one still apply: actual UHD 620 laptop,
1280x720 framebuffer, Low, adaptation disabled, median <=16.7 ms and 1% low
>=50 FPS, complete moving-flight/loading/lifecycle scenarios. The current PC
and offline payload audit cannot certify these targets. Keep accounts, progress,
map IDs/handling, admission 20 and the $0 deployment constraints intact.

Reproduce the new research artifacts from the repository root:

```powershell
node docs/research/browser-stack-20261025/audit-payloads.mjs
node docs/research/browser-stack-20261025/collect-deep.mjs
```

The first command reads about a gigabyte of existing assets to hash their
contents, using bounded file reads. The second refreshes public upstream
observations; URLs, tags and accessibility may change. Neither command installs
or executes third-party package code. The next implementation should reuse
these findings rather than repeat full Liftoff extraction or old map exports.

[meshopt-js]: https://github.com/zeux/meshoptimizer/blob/master/js/README.md
[stream]: https://github.com/AnEntrypoint/stream-glb
[tiles-doc]: https://loaders.gl/modules/tiles/docs/api-reference/tileset-3d/
[loaders-gltf]: https://loaders.gl/docs/modules/gltf/api-reference/gltf-loader
[tiles-source]: https://github.com/visgl/loaders.gl/blob/ca90e0c7c0488b18ab0b80a0cd27367563c7b724/modules/tiles-3d/src/tileset-3d/common/tileset-3d.ts
[archive-source]: https://github.com/visgl/loaders.gl/blob/ca90e0c7c0488b18ab0b80a0cd27367563c7b724/modules/tiles-3d/src/tileset-3d/common/indexed-archive-tileset-source.ts
[nexus]: https://github.com/cnr-isti-vclab/nexus
[hello]: https://github.com/kenjinp/hello-terrain
[vt-rfc]: https://github.com/kvnloo/three.js/blob/rfc/virtual-texture-gigapixel/docs/rfcs/virtual-texture-streaming.md
[old-vt]: https://github.com/elfrank/virtual-texturing
[taos]: https://taosengine.com/book/terrain/index.html
[texture-create]: https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createTexture
[texture-view]: https://developer.mozilla.org/en-US/docs/Web/API/GPUTexture/createView
[indirect]: https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_struct_drawindirect.html
[occlusion]: https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_occlusion.html
[city-culling]: https://andersonmancini.dev/blog/threejs-punk-occlusion-culling
[compile]: https://threejs.org/docs/pages/Renderer
[webgpu]: https://www.w3.org/TR/webgpu/
[firefox-cache]: https://bugzilla.mozilla.org/show_bug.cgi?id=2083378
[comlink]: https://github.com/GoogleChromeLabs/comlink
[transfer]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
[offscreen]: https://github.com/pmndrs/react-three-offscreen
[ranges]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests
[network]: https://learn.microsoft.com/en-us/microsoft-edge/devtools/network/issues
[opfs]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
[storage]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
[response-clone]: https://developer.mozilla.org/en-US/docs/Web/API/Response/clone
[three-loader]: https://threejs.org/docs/pages/GLTFLoader.html
[device-lost]: https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost
[gpu-explainer]: https://gpuweb.github.io/gpuweb/explainer/
[galacean]: https://github.com/galacean/engine
[galacean-resource]: https://github.com/galacean/engine/blob/main/packages/core/src/asset/ResourceManager.ts
[wonderland]: https://wonderlandengine.com/pricing/
[filament]: https://github.com/google/filament/blob/main/web/README.md
[spark-lod]: https://sparkjs.dev/docs/lod-getting-started/
[phy]: https://github.com/lo-th/phy
