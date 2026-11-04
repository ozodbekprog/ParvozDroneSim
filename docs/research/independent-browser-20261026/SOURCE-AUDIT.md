# Finalists: source-level qualification

Retrieved/inspected 26 October 2026. This appendix supports section D of the
[decision report](../../INDEPENDENT-BROWSER-TECHNOLOGY-20261026.md). All code
inspection was read-only. Exact npm archives were downloaded as research data,
not installed; no upstream CLI, build script or benchmark was executed. Public
raw code snapshots are in ignored `data/independent-browser-20261026/`.
Tags and package metadata are not sufficient alone; the source manifest records
the [inspected bytes](source-manifest.json). Some matching 3D Tiles snapshots from the preceding review
were reused rather than downloaded/exported again.

## D1. 3d-tiles-renderer 0.5.3

**Role:** the first existing spatial-streaming control-plane candidate, not a
renderer/physics replacement. Published 18 September 2026, Apache-2.0. Its peer
range includes Three >=0.167.0; that is a declaration, not an integration test.
An isolated read of installed r180 confirmed `TextureUtils.getByteLength` exists,
so that particular imported API is not a compatibility blocker.

**Source observations, S:**

- [TilesRendererBase](https://raw.githubusercontent.com/NASA-AMMOS/3DTilesRendererJS/v0.5.3/src/core/renderer/tiles/TilesRendererBase.js)
  creates a per-tile AbortController. LRU removal aborts it, removes queued
  download/parse work and invokes disposal. Fetch receives its signal. Parsing
  can still finish after cancellation; leaving the view is not itself proof of
  immediate network abort, because cache/selection policy decides retention.
- [Three TilesRenderer](https://raw.githubusercontent.com/NASA-AMMOS/3DTilesRendererJS/v0.5.3/src/three/renderer/tiles/TilesRenderer.js)
  checks abort before committing a parsed scene and cleans up abandoned texture
  results. Normal disposal owns tile geometry/materials/textures. That default
  ownership is unsafe to assume for a separately introduced cross-tile pool.
- [LRUCache](https://raw.githubusercontent.com/NASA-AMMOS/3DTilesRendererJS/v0.5.3/src/core/renderer/utilities/LRUCache.js)
  checks registered usage at admission; usage is updated as content becomes
  known. This does not reserve arbitrary compressed input, decoded arrays,
  texture staging, pending GPU uploads or retiring scene generations in advance.
- [MemoryUtils](https://raw.githubusercontent.com/NASA-AMMOS/3DTilesRendererJS/v0.5.3/src/three/renderer/utils/MemoryUtils.js)
  estimates geometry and enumerable material texture properties. Compressed
  mips use their data sizes; unknown sizes can return zero. Deduplication is
  local to one scene traversal. Material arrays and hidden node-graph resources
  need a custom accounting path; per-tile totals are not a global ownership ledger.
- [UnloadTilesPlugin](https://raw.githubusercontent.com/NASA-AMMOS/3DTilesRendererJS/v0.5.3/src/three/plugins/UnloadTilesPlugin.js)
  deliberately disposes GPU resources while retaining CPU model data for later
  upload. This is useful but different from complete eviction. It introduces
  re-upload work and must respect shared resources and context recovery.

**How it fits Parvoz, I:** compile a local-coordinate tileset with independently
useful glTF content. The
[specification](https://github.com/CesiumGS/3d-tiles/blob/main/specification/README.adoc#coordinate-reference-system-crs)
explicitly allows local Cartesian sites. Normalize the Z-up/Y-up boundary once
in the visual adapter and test every authored transform. Use replacement
refinement/coarse coverage, not simultaneous duplicate detail unless intended.

Supply the existing matched KTX2/Meshopt decoders. Bridge lifecycle events to
leases in the texture/prototype pool. Add conservative in-flight reservations
outside the LRU estimate and count unknowns as unresolved. Keep flight collision
coverage separate. Budgets and error targets must be configured for Low; the
library does not automatically enforce Parvoz's triangle budget.

**Effort:** moderate for the adapter, high for a correct compiler/ownership
integration. **Costs:** library and local pipeline can remain $0; no Cesium ion
account is required by the format. **Not verified:** matched full-map flight,
target hardware, buffer peaks, network cancellation under reversal, quality
switches, pooled disposal and context-loss recovery. Those are experiment gates,
not reasons to discard a mature existing scheduler before trying it.

## D2. Needle progressive and local build pipeline

The registry's current runtime `latest` is **4.0.0-alpha.8** (15 October), while
the highest numeric non-prerelease is **3.6.2**. The exact inspected runtime is
MIT. The local compiler is **3.0.2**, with separate licensing not established
as permissive by its package metadata. The Needle Engine `latest` itself is an
alpha; do not use unpinned `@latest` in a production recommendation.

**S — published runtime artifact**, particularly
[`lib/extension.js`](https://www.npmjs.com/package/@needle-tools/gltf-progressive/v/4.0.0-alpha.8):
LOD resources have their own URLs and queued requests. Generation/current checks
prevent stale cache lifetimes from committing. Texture ownership uses explicit
reference counts/disposal and weak references in parts of the cache; resolved
geometry/geometry arrays can stay strongly cached. Explicit disposal also
attaches cleanup to late results. The queue defaults to 20 mobile / 50 desktop
concurrent tasks, adjustable, without establishing a global byte reservation.
The main-thread path uses GLTFLoader loads; the worker path has its own loader.
No transport AbortSignal is established by the readiness helper alone.

**S — `lods.promise.js`:** abort resolves the captured wait group. That is a
useful cancelable readiness API, but it is not evidence that every underlying
LOD HTTP request or transcode is canceled. Test both paths independently.

The [official mechanism documentation](https://engine.needle.tools/docs/gltf-progressive/)
does establish separate low proxies and detail files. It does not turn an
unprocessed Parvoz GLB into a streamed map at runtime. The downloaded build
package's README establishes a local CLI and warns that generated delivery files
are not the editable Blender source. Neither the CLI nor its bundled binaries
was run here.

**Cost qualification:** [Needle's FAQ](https://engine.needle.tools/docs/reference/faq/)
describes commercial engine licensing and license-server/team activation.
[Mesh Baker](https://engine.needle.tools/docs/products/needle-mesh-baker/)
allows free evaluation but gates local downloads behind a license and licenses
its command-line use separately. These facts do not revoke the progressive
runtime's MIT license, and its MIT license does not establish rights to every
authoring tool. No account was created and no restricted asset was uploaded.

**Fit:** good asset-level progressive-loading candidate, especially for optional
detail. **Effort:** moderate runtime adapter plus pipeline compatibility and
licensing qualification. **Not selected as a global memory manager:** no proven
hard resident-plus-in-flight budget, complete cancellation chain, or safe
coexistence with Parvoz's existing texture leases. Compare stable and prerelease
separately; do not silently make the alpha the default.

## D3. PlayCanvas 2.23.3

Published 15 October, MIT engine. Private hosted-editor licensing is separate;
an engine-only local project is a legitimate option. It is therefore incorrect
to reject the engine solely because a hosted editor plan has a price.

**S:**

- [`Asset.unload`](https://raw.githubusercontent.com/playcanvas/engine/v2.23.3/src/framework/asset/asset.js)
  clears resources and loader-cache entries, revokes its object URL and destroys
  owned resources. Entity removal is not a universal asset-unload policy. An
  application still needs ownership of shared containers/textures.
- [`glb-parser.js`](https://raw.githubusercontent.com/playcanvas/engine/v2.23.3/src/framework/parsers/glb-parser.js)
  has async buffer-view processing hooks. This is a concrete seam for the
  existing Meshopt decoder; do not assume the current Parvoz codec setup transfers
  automatically. The normal whole-container buffer/resource path is not spatial
  streaming merely because parsing returns asynchronously.
- [`webgpu-render-pipeline.js`](https://raw.githubusercontent.com/playcanvas/engine/v2.23.3/src/platform/graphics/webgpu/webgpu-render-pipeline.js)
  creates a WebGPU render pipeline synchronously in the inspected creation path.
  Lower steady-state submission cost therefore does not establish lower
  shader-cold stutter. Warmup and pipeline creation need their own comparison.
- [`webgpu-graphics-device.js`](https://raw.githubusercontent.com/playcanvas/engine/v2.23.3/src/platform/graphics/webgpu/webgpu-graphics-device.js)
  has explicit binding and indirect-draw paths. A capability existing in the
  graphics layer does not mean arbitrary glTF meshes use it automatically.

**Streaming distinction:** the current
[Streamed SOG format](https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/streamed-sog/)
is a genuine hierarchy of independently loadable splat chunks. It is not a
triangle-mesh map compiler. Its published success is evidence for coarse-first
architecture, not that it can stream these existing GLBs unchanged.

**Visibility plugin:** [OptiPixel's backend matrix](https://raw.githubusercontent.com/AlexAPPi/playcanvas-opti-pixel/1cb3a2ed0bb486c7e1820e5e782835062310685d/docs/occlusion/choosing-backend.md)
distinguishes worker software tests, delayed WebGL HZB/readback, WebGL queries,
and same-frame WebGPU indirect results. Coverage paths add staging/readback;
unknown visibility remains visible. The inspected 1.2.0 snapshot is Apache-2.0
and PlayCanvas-specific. This is a qualified design reference, not a verified
performance result or a Three-compatible plugin.

**Integration effort:** moderate/high render adapter, material/terrain/sky/post
port, asset callbacks, shadow/quality parity and recovery. JS flight, accounts,
IDs and network state can remain independent. **Why first challenger:** public
submission benchmarks justify spending a small experiment on it. **Unverified:**
UHD 620, large transparent/alpha-tested maps, exact Meshopt/KTX payload parity,
first-use stalls, integrated tile adapter and complete application ownership.

## D4. Babylon.js 9.32.0 and Babylon Lite 1.36.0

Both have Apache-2.0 distributions. They are different architecture choices,
not two names for the same feature coverage.

### Full Babylon.js

The inspected
[`WebGPUEngine.dispose`](https://raw.githubusercontent.com/BabylonJS/Babylon.js/9.32.0/packages/dev/core/src/Engines/webgpuEngine.pure.ts)
contains the last-engine static-cache reset discussed in the community's merged
teardown fix. This does not make a persistent streaming world's caches
automatically bounded. A scene transition inside a still-running engine needs
its own policy. Thin instances, frozen state and snapshot rendering are useful
specialized paths, with restrictions to qualify for changing/streamed content.

**Fit/effort:** a second full-engine render adapter; standard glTF and existing
3D Tiles adapter help, while TSL materials and Parvoz lifecycle code still need
porting. Match both default and documented tuned configurations. A setting that
disables culling or retained-state updates is not a free optimization for fast
flight. Do not replace flight physics with the engine's physics plugin.

### Babylon Lite

The registry distribution is `@babylonjs/lite` 1.36.0; the repository's internal
workspace package version is not the published version. The inspected tag is
`npm-lite-v1.36.0`.
Registry `latest` is 1.36.0. A numerically higher 2.0.0 exists but is explicitly
deprecated as an erroneous release; numeric sorting alone is not a valid
recommended-version policy. The metadata records that exception.

- [`gpu-resource-retirement.ts`](https://raw.githubusercontent.com/BabylonJS/Babylon-Lite/npm-lite-v1.36.0/packages/babylon-lite/src/engine/gpu-resource-retirement.ts)
  batches releases behind GPU queue completion. Teardown/device-loss paths
  claim batches once and continue through disposal failures. Retiring resources
  are real transient memory until the fence drains; queue completion is not
  presentation timing.
- [Texture ownership store](https://raw.githubusercontent.com/BabylonJS/Babylon-Lite/npm-lite-v1.36.0/packages/babylon-lite/src/resource/texture-reference-store.ts)
  is a lazy WeakMap. Allocation acquire/release functions update ownership and
  destroy on final release. This is stronger implementation evidence than a
  “low memory” tagline, but not a complete audit of every feature's ownership.
- [`load-gltf.ts`](https://raw.githubusercontent.com/BabylonJS/Babylon-Lite/npm-lite-v1.36.0/packages/babylon-lite/src/loader-gltf/load-gltf.ts)
  resolves URL sources through a full `arrayBuffer()` before classifying the
  asset. It also accepts supplied bytes/blobs, allowing a custom delivery layer.
  It does not itself turn one monolithic GLB into spatial streaming.
- The separate
  [`lite-gl` package](https://raw.githubusercontent.com/BabylonJS/Babylon-Lite/npm-lite-v1.36.0/packages/babylon-lite-gl/README.md)
  is a WebGL2 micro-engine. Its low-level mesh/effect facilities do not establish
  a drop-in full-scene/PBR fallback for Lite's WebGPU renderer.

**Evidence limits:** [vendor parity metrics](https://doc.babylonjs.com/lite/)
cover small reference scenes, RAF CPU and their bundle/memory protocol. They do
not prove a fivefold reduction in Parvoz's geometry, a UHD 620 frame time or an
automatic TSL-to-Lite port. **Decision:** keep as a conditional WebGPU arm,
with stable numeric release distinguished from long-term API compatibility.

## D5. Filament 1.78.1

Published 21 October, Apache-2.0. This is a serious non-JS renderer architecture,
not a complete game framework migration package.

**S:** the [current JS binding](https://raw.githubusercontent.com/google/filament/v1.78.1/web/filament-js/extensions.js)
explicitly branches on `Backend.WEBGPU`; the other path creates a WebGL2
context. Older descriptions that categorically call the browser binding
WebGL-only are insufficient for this revision. The shipped build/configuration
and target backend still need an actual trial.

**S/V:** [`FilamentAsset`](https://raw.githubusercontent.com/google/filament/v1.78.1/libs/gltfio/include/gltfio/FilamentAsset.h)
has explicit ownership of entities, buffers and textures, a queue of renderables
that become ready during asynchronous resource loading, and a source-data release
boundary. Progressive reveal is not the same as spatial network streaming.
Releasing parse/source state is a useful memory-contract alternative, but a
browser restoration path must know how to reload/rebuild discarded data.

**Effort:** high. Its material compiler, generated material packages, native
resource APIs and JS/WASM bridge replace significant Three-specific code. Test
glTF IDs, upload lifetimes and context/device recovery, not only a PBR screenshot.
**Decision:** later renderer challenger if the first two adapters cannot resolve
measured renderer overhead. No game-scale or target-laptop win is established.

## D6. Defold 1.14.0 and Bevy 0.20.0

**Defold S:** the exact
[`resource.cpp`](https://raw.githubusercontent.com/defold/defold/1.14.0/engine/resource/src/resource.cpp)
increments resource references on reuse and destroys/releases a resource through
the type path on final release. This demonstrates an engine-owned resource
contract, not immunity from an application retaining references. Its
[Live Update system](https://defold.com/manuals/live-update/) separates optional
content archives from the initial package. Archive delivery is not automatically
a screen-error terrain hierarchy.

The [HTML5 packaging documentation](https://github.com/defold/doc/blob/master/docs/en/manuals/html5.md)
describes threaded/non-threaded WASM variants and fallback selection. Threaded
builds need cross-origin isolation. The custom Defold License permits game
commercialization while restricting commercialization of the engine itself;
do not relabel it Apache-2.0. Actual shipped-web evidence is in the community
appendix. The 2D physics case does not qualify 3D foliage/terrain. Port effort
for Parvoz is high and contact/UI/material compatibility remains untested.

**Bevy S:** the
[pinned Cargo feature table](https://raw.githubusercontent.com/bevyengine/bevy/v0.20.0/docs/cargo_features.md)
states that WebGPU overrides WebGL2 for WASM. A browser fallback is therefore
a deployment/build-selection problem, not an assumed runtime switch in one
existing artifact. Rust ECS and asset/render infrastructure can change CPU
architecture; a performance gain is still a hypothesis. MIT/Apache-2.0 permits
a $0 local stack, but rebuilding the application/material/simulation boundary
is a much larger decision than replacing a JS renderer.

Neither is rejected because WASM is intrinsically slow or JavaScript is
intrinsically faster. Neither currently has matched Parvoz evidence sufficient
to justify that port over a reusable compiler plus smaller render adapter.

## D7. GPU-driven and virtual-geometry systems

[nanite-webgpu](https://github.com/Scthe/nanite-webgpu#faq) explicitly documents
no VRAM eviction/streaming and preallocation scaling limits. A meshlet hierarchy
can reduce selected geometry but does not solve network delivery or working-set
ownership by itself. The 0.1.3 `three-virtual-geometry` package is a static-mesh
WebGPU research candidate, not a verified UHD 620 map system. Readmes/demos
were inspected; their full shader implementations were not audited here.

The [browser's experimental multi-draw-indirect announcement](https://developer.chrome.com/blog/new-in-webgpu-131)
must not be promoted to an unflagged cross-browser baseline. Single indirect
draws, GPU instance compaction and hierarchical visibility can still be useful,
but include their buffer/pass cost. New
[immediates/transient attachments](https://developer.chrome.com/blog/new-in-webgpu-149-150)
and [compatibility mode](https://developer.chrome.com/blog/new-in-webgpu-146)
are separate feature-qualified directions. No renderer gets their benefits
merely by being called “WebGPU.”

## D8. Three r180 instance-buffer uploads

The [racing-game engineering account](https://andersonmancini.dev/blog/threejs-punk-fewer-uploads-faster-frames)
motivated inspection of the exact installed Parvoz dependency. Its reported
timings are external and its workaround is WebGPU-specific; neither is adopted
as a measured local fix.

**S:** [InstanceNode](https://github.com/mrdoob/three.js/blob/r180/src/nodes/accessors/InstanceNode.js)
uses `buffer(...).element(instanceIndex)` for matrix groups **<=1,000**; larger
groups use instanced attributes. This is not the blog's rounded 1,024 boundary.
[NodeUniformBuffer](https://github.com/mrdoob/three.js/blob/r180/src/renderers/common/nodes/NodeUniformBuffer.js)
inherits the unconditional `true` update in
[Buffer](https://github.com/mrdoob/three.js/blob/r180/src/renderers/common/Buffer.js).
[Bindings](https://github.com/mrdoob/three.js/blob/r180/src/renderers/common/Bindings.js)
then requests an update for that binding, and
[WebGPUBindingUtils](https://github.com/mrdoob/three.js/blob/r180/src/renderers/webgpu/utils/WebGPUBindingUtils.js)
writes its buffer. These files were read in the installed dependency, without
executing it. Parvoz's scenery currently uses ordinary instance matrices.

**I/H:** count actual calls/bytes across passes; qualify an attribute/storage
path or upstream upgrade only if the cost is material. Preserve mutable LOD
matrices/colors, shader normals and both required backends. Low already disables
shadows, so a multi-shadow-pass saving from another game cannot be copied into
the expected gain. This observation does not change the earlier pixel-identical
instancing result; shared geometry and per-frame upload cost are separate.
The newer release's complete corresponding path was not audited in this check.

## D9. Octahedral impostors: inspectable distant-forest alternative

[Pinned source](https://github.com/ektogamat/octahedral-impostor-component/tree/f94290693e0966dbb2e2dba89591734753a4582f),
MIT; package says private demo 1.0.0, Three `^0.185.1`, R3F/React. This is not a
published stable drop-in package. Its
[author's explanation](https://andersonmancini.dev/blog/octahedral-impostors)
provides production context, not measured Parvoz performance.

**S:** the pinned `createImpostorAtlasMaterial.js` samples three atlas cells and
blends their color/alpha on a depth-writing, double-sided basic node material.
It enables alpha-to-coverage; that does not establish good edges on Parvoz Low,
where MSAA is disabled. It does not supply per-pixel geometric depth/parallax.

**S:** `useOctahedralAtlas.js` has module-level Maps for finished and pending
atlases. Pending entries are removed on settlement; the finished atlas Map has
no byte eviction in the inspected module. It bakes through temporary WebGL,
pixel readback and a canvas, then creates an ordinary mipmapped CanvasTexture.
Successful cleanup of temporary geometry/materials is visible, but it is not a
global lifetime policy. This is a reference baker, not a bounded map subsystem.

**I:** a 4096² RGBA8 atlas with a complete mip chain alone is about 85.3 MiB of
uncompressed GPU payload, before source textures/canvas/bake staging; actual
runtime representation must be checked. Use offline baking plus qualified KTX2
deliveries and resource leases rather than generating every atlas at startup.

**S:** the direction math has hemisphere and full-octahedron branches; hemisphere
clamps directions below the horizon. **H:** below-canopy flight, steep banks,
close silhouettes, lighting changes, alpha minification and transitions need
visual trials. Retain real nearby trees/collision. A full-sphere atlas or an
earlier mesh transition may be necessary. Three-sample alpha fill/bandwidth can
offset triangle savings on UHD 620. Pure material/math pieces can be adapted
without migrating the game's UI to React; the demo hook/cache is not that adapter.

## Adoption rules from this audit

1. Define the compiled map/resource contract independently of engine classes.
2. Keep byte reservations, ownership and late-result cleanup explicit across
   queue, decode, upload, render and retirement—not just the active tile set.
3. Treat unsupported/unknown resource estimates as unknown, never free.
4. Exercise failure, cancel, revisit and context recovery before selecting a
   library. Source mechanisms are necessary but not sufficient evidence.
5. Qualify exact releases/codecs/materials and current backend limits. A broad
   peer range, marketing demo or successful parse is not a complete game test.
