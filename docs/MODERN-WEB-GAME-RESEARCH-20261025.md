# Modern browser game systems: stage-one research

25 October 2026, Asia/Tashkent. Parvoz source baseline: `8dce6de` on
`codex/demand-pilots`. Research and source inspection only. No new engine,
runtime dependency, map conversion, asset upload, browser benchmark or Oracle
release was performed in this stage. Existing presentation edits are independent.

**Further research:** [payload breakdown and deeper source review](WEB-GAME-DEEP-RESEARCH-20261025.md)
adds a fresh five-map audit, Pine's duplicated images, unused Meshopt workers,
new streaming/terrain systems and revised per-map experiment priorities.
[Community evidence follow-up](COMMUNITY-WEB-GAME-RESEARCH-20261025.md) checks
Reddit/forum reports, maintainer resolutions, public benchmark methods and
additional systems against pinned source and current package metadata.

## Decision

The browser problems require a delivery and resource-management redesign plus
measured renderer work. The evidence does not justify declaring Three.js either
the sole cause or the winning long-term engine. **Retain it as the control;
qualify NASA 3D Tiles and Needle progressive loading; compare PlayCanvas and
Babylon.js on identical content before deciding on an engine migration.**

The highest-value new candidates are:

1. **3D Tiles Renderer**: hierarchical visual selection, prioritized loading,
   bounded cache and separate GPU unloading. Compare it with the existing local
   streamer before maintaining a larger custom streaming system.
2. **Needle gltf-progressive**: independently loaded mesh and texture LODs with
   screen-density selection. Test its stable release and its resource lifecycle;
   its default npm tag currently selects an alpha.
3. **WebGPU Inspector, SpectorJS and webgl-memory**: establish where GPU time,
   allocations, shaders and passes go. Existing JS heap and scene estimates are
   insufficient to diagnose all browser memory.
4. **PlayCanvas and Babylon.js**: serious engine challengers, tested separately
   from content changes. Neither automatically repairs an oversized asset graph.
5. **Existing glTF Transform / Meshoptimizer / KTX tools, used differently**:
   independently loadable LODs, shared prototypes, shared textures, authored
   distant coverage, and limited decode/upload work. These tools are already
   installed; merely enabling their codecs again has no value.

These are research priorities, not measured performance rankings. Full-game
UHD 620 acceptance is still absent. Preserve Kestrel handling, current map and
route identities, production data, the 20-player limit, the $0 budget, and the
retired Ironworks archive.

## Evidence and freshness

The user's five starting points were opened: [awesome-webgpu][discovery],
[threejs-game][topic-games], [webgl][topic-gl], [webgpu][topic-gpu] and
[webgpu.com][showcase]. They are discovery indexes; stars, screenshots and
update dates do not establish performance or compatibility. Technical findings
below follow upstream documentation, source and registry metadata.

[Collected metadata](research/browser-stack-20261025/upstream-metadata.json)
records 21 public repositories, 15 npm packages, licenses as reported upstream,
publication dates, distribution tags, peer dependencies and five source checks
at the packages' published Git commit IDs. The
[collector](research/browser-stack-20261025/collect.mjs) performs read-only HTTP
requests, with no installs or account credentials. Source checks retain URLs,
SHA-256 and line anchors, not copied third-party source trees. Seven GitHub API
refreshes hit HTTP 403 after earlier successful collection; their earlier
responses are retained with timestamps and explicit refresh errors. Registry
and pinned-source checks succeeded. An npm unpacked size is **not** a shipped
bundle size. A recent push is **not** a release or evidence of reliability.

| Component | Installed / observed upstream version | Interpretation |
| --- | --- | --- |
| Three.js | game 0.180.0; registry 0.186.1 | An isolated r186 comparison already exists; no improvement established |
| PlayCanvas | registry 2.23.3 | Engine candidate; graphics docs still label WebGPU Beta |
| Babylon.js core | registry 9.32.0 | Engine candidate with WebGL/WebGPU paths |
| 3d-tiles-renderer | registry 0.5.3 | Apache-2.0; published source includes unload, load-region and batching plugins |
| Needle gltf-progressive | `stable` 3.6.2; `latest` 4.0.0-alpha.8 | MIT runtime; pin deliberately, do not equate latest with stable |
| InstancedMesh2 | 0.3.16; separate 1.0.0-beta.0 tag | MIT; WebGL-specific implementation details need attention |
| three-mesh-bvh | 0.9.16 | MIT; query/serialization candidate, not a replacement flight solver |
| glTF Transform | installed/upstream 4.5.1 | Already current in this collection |
| meshoptimizer | installed/upstream 1.3.0 | Already current in this collection |
| ktx-parse | installed 1.1.0; upstream 2.0.0 | Container parser; a major upgrade is not a transcoding-speed fix |
| Rapier compat | 0.21.0 | Old rapier.js repository is archived because code moved into main Rapier |
| Jolt JS | 1.1.1 | Separate WASM/embedded and multithread build choices |
| bitECS | 0.4.0 | MPL-2.0; candidate only for measured entity-loop costs |

Metadata is a point-in-time observation. Compatibility claims require a pinned
production build and browser execution. Engine license metadata does not cover
every sample, imported model, editor service or transitive dependency.

## What is actually wrong in this project

Previously recorded measurements are explicitly distinguished from source-level
findings. This stage re-read the loader, LOD, collision, streaming, memory and
delivery code and reused existing experiments instead of repeating exports.

| Evidence | Finding | Consequence |
| --- | --- | --- |
| Current source: `src/asset-loader.js:63` | Whole downloaded buffer enters `GLTFLoader.parseAsync` before selecting a named node | Choosing a small part does not avoid parsing the large file |
| Current source: `src/visual-lod.js:27` | All visual levels are requested together | Visible Low LOD is not a Low-only download or decode |
| Current source: `src/asset-loader.js:80` | Scene nodes are cloned and materials copied per selected model | Object/material creation is another candidate cost; exact contribution needs profiling |
| Current source: `src/model-memory.js` | Idle estimate deduplicates within one GLTF and approximates textures from dimensions | It is not a format-aware global GPU-residency counter |
| Current source: `src/spatial-map-stream.js:45` | Detail budget is checked after `load()` returns | Resident limits do not reserve decode memory before preparation; transient peaks can exceed them |
| Current source: `src/shared-stream-textures.js` | Leases share configured textures; accounting checks happen after decoding | Useful ownership foundation, still not a process/GPU memory ceiling |
| Current source / prior report | Streaming classes are exercised by a QA camera tool, not the normal map path | Prototype success does not establish game loading success |
| Current source / prior recovery | Collision JSON parsing/tree preparation is now in a cancellable worker; compact trees and retirement are implemented locally | Do not repeat the old claim that all current collision preparation is synchronous |
| Current delivery: `deploy/Caddyfile` | zstd/gzip and immutable asset headers already exist | Another generic compression/cache switch is not the missing solution |

The [earlier audit](BROWSER-READINESS-AUDIT-20261025.md) inspected these local
file sizes. Decimal MB, not HTTP bytes or resident memory:

| Map | Main visual GLB | Collision JSON |
| --- | ---: | ---: |
| Minus Two | 26.341 MB | 4.517 MB |
| Hangar C03 | 270.815 MB | 27.243 MB |
| Arena | 174.042 MB | 22.688 MB |
| Pine Valley | 204.877 MB | 102.990 MB |
| The Green | 265.604 MB | 138.108 MB |

All five main models already contain Meshopt and Basis/KTX2 extensions. The
current catalog has five maps; historical instructions about three imports
describe an earlier state.

The [recovery record](BROWSER-RECOVERY-20261025.md) reports a public The Green
transfer lasting 112.446 seconds for its GLB, 10.891 MB of transferred collision
data expanding to 138.108 MB, approximately 2.46 GB reported JS heap, and long
tasks of 7.881 and 3.923 seconds. Settings were inherited and exact controllable
flight time was not captured: this is evidence of severe stalls, not a valid
Low/FPS comparison or a fresh measurement from this stage.

The same record shows local compact collision storage reducing retained Node
heap from 336.60 to 87.53 MiB **plus 54.90 MiB ArrayBuffers**. Twenty CPU lifecycle
cycles return heap/buffers near baseline, while RSS remains higher. This is
meaningful progress, but not GPU/browser leak acceptance. The pending Oracle
candidate does not contain a completed integrated streaming solution.

### Download time has a physical lower bound

Calculated with decimal units and ideal sustained throughput, excluding
latency, protocol overhead, retries and preparation:

`transfer seconds = delivered bytes * 8 / link bits per second`.

A 265.604 MB model alone needs about **425 seconds at 5 Mbps**, or **106 seconds
at 20 Mbps**. A different renderer cannot make that transfer instantaneous.
HTTP compression may alter delivered bytes, but the existing public model
observation was approximately its file size.

Even the existing Minus Two prototype's **5.994 MB distant coverage** needs
about **9.6 seconds at 5 Mbps**, before physics, aircraft and code. Therefore
claiming a five-second complete first flight from that prototype would be
unsupported. A loading screen can describe progress; it cannot fix this budget.

## Engine and framework comparison

Cost ratings below are engineering judgments for this repository, not time or
speed estimates. A renderer adapter is medium work; replacing the full game
scene/asset system is high work. Physics and multiplayer need not be rewritten
just to compare rendering.

| Candidate | Useful capabilities | Important qualification | Decision / cost |
| --- | --- | --- | --- |
| Three.js + TSL | Existing gameplay integration; WebGPU and WebGL2 fallback [docs][three-gpu] | It leaves asset ownership and world streaming to the application. Current r180/r186 test found the same 11.2 ms median and first-pass stalls | Control; targeted upgrade later / low-to-medium |
| PlayCanvas | Runtime asset load/unload; instancing, batching; profiling; both backends [assets][pc-assets], [graphics][pc-graphics] | Engine is MIT and can be self-hosted. Do not assume hosted editor services are required or free. WebGPU is labeled Beta; custom terrain/reflections and disposal need parity tests | First challenger / medium harness, high migration |
| Babylon.js | Thin instances, asset containers, glTF LOD facilities, Inspector and WebGPU snapshot rendering [thin instances][babylon-thin], [snapshot][babylon-snapshot] | Thin-instance groups have all-or-none visibility; partition spatially. Snapshot rendering chiefly saves JS submission and has dynamic-scene restrictions; streaming can force re-recording | Second challenger / medium harness, high migration |
| Babylon Lite | Separate WebGPU-only, tree-shakable project; documented optional GPU instance culling and indirect draws [project][babylon-lite], [architecture][babylon-lite-ti] | Smaller renderer code is different from smaller maps. No WebGL fallback. Its compatibility/parity claims are upstream, not verified against our custom materials | Experimental comparison after main shortlist / high |
| Needle Engine / standalone progressive library | Blender/Unity-to-web workflow and progressive glTF [docs][needle] | Use the standalone MIT runtime to test without a whole-engine migration. Qualify offline asset generation, service terms, cancellation and bounded cache separately | Loader shortlist; whole engine conditional / medium-to-high |
| Cocos Creator | Built-in asset bundles, dependency handling, preload versus parse/load separation [bundles][cocos] | Removing a bundle is not the same as releasing its resources. Requires rebuilding our content/game integration. No matched benefit measured | Reserve alternative / high |
| Godot web | Full editor/export workflow | Retrieved stable web guide specifies WebGL2; thread-enabled exports require isolation headers. Native renderer features do not establish equivalent web support [guide][godot] | No first migration experiment / high |
| Unity web | Full content pipeline; newer docs include WebGPU and fallback configuration [WebGPU][unity-gpu] | Retrieved 7000.0 docs are **Alpha**, not production evidence. WASM memory, loading and draw-call costs still need optimization [performance][unity-perf] | Native/export strategy only after a separate product decision / very high |
| Orillusion | WebGPU-focused rendering [source][orillusion] | Its current README labels it Beta and advises against commercial use. No qualified fallback or Parvoz parity | Research watchlist / high |
| React Three Fiber / Drei ecosystem | Scene composition and useful Three helpers [project][r3f] | Still uses Three. Introducing React cannot itself reduce our map bytes, GPU overdraw or physics allocations | Use only for a separately justified UI/authoring need |
| TypeGPU / raw WebGPU / wgpu | Typed GPU programming or lower-level rendering control [TypeGPU][typegpu] | These increase responsibility for materials, lifetime, culling and tooling; they do not supply an integrated map system | Targeted compute only after evidence, not a rewrite |

No candidate engine was executed in this research stage. The previous
[fixed-route comparison](BROWSER-TIMING-20261025.md) covered r180 and r186 on
this machine, WebGL2, Minus Two, 90 camera positions, no gameplay simulation.
It found up to 169 draws and 396,019 triangles. That triangle count exceeds the
provisional Low budget; the test cannot certify UHD 620 or WebGPU performance.

## Streaming: compare reusable systems before growing custom code

### NASA 3D Tiles Renderer: first structured-world candidate

The project provides a hierarchy, geometric-error selection, download/parse
queues and an LRU cache with byte and item limits [API][tiles-api]. Its
`UnloadTilesPlugin` distinguishes GPU release from keeping CPU content; load
regions are useful for flight-path prefetch [plugins][tiles-plugins]. Published
0.5.3 source exports these plugins; this was checked against npm's Git revision.

For Parvoz, build a **local-coordinate** tileset from existing authored content;
no Cesium ion subscription or map-service upload is inherent in that experiment.
Preserve persistent distant coverage and use replacement refinement deliberately.
Tile bounds must include rotated geometry, not merely the placement cell. Keep
collision readiness independent of camera visibility.

Its optional batching is **not a universal integration shortcut**. The inspected
plugin accepts a WebGL renderer, accesses its GL context, and documents one mesh,
one material and one material map constraints. Our terrain, material variants
and WebGPU path need a separate rendering strategy. Test the scheduler first.
Do not treat cache-accounting bytes as an exact total browser/GPU footprint.

Qualification: convert one existing Minus Two package set; compare dependency
bytes, scene parity, cancel/retry, 180-degree turns, full release and peak memory
with `SpatialMapStream`. Adopt if it reduces maintenance and satisfies the same
correctness and resource limits. A globe demo alone is insufficient.

### Needle gltf-progressive: first mesh/texture refinement candidate

The standalone loader supports lazy mesh/texture levels selected by screen
density, through the `NEEDLE_progressive` extension [runtime][needle-repo].
Assets must first contain those levels; installing the loader does not transform
our existing GLBs. Runtime MIT licensing is separate from generation/hosting
services. Keep the imported assets local in this experiment.

The metadata distinguishes stable **3.6.2** from latest **4.0.0-alpha.8**.
Inspection of both published revisions found a WebGPU render-list branch; the
alpha also has explicit decoder-worker disposal. This is more precise than
assuming WebGPU incompatibility from older WebGL-typed documentation. However,
it accesses renderer internals (`_renderLists`), making pinned Three compatibility
a concrete test requirement. See the immutable URLs in the metadata and
[stable source][needle-stable].

Qualification: use one representative native material/prototype with locally
prepared levels; test texture identity, quality downgrade, all model clones,
cancel while decoding, repeated unload, and both backends. Require a clear
resident and in-flight byte policy. Screen-density selection and a concurrent
request count are not a global memory guarantee. Keep its low-poly raycast
helpers out of the authoritative flight collision path.

### Why simply cutting a GLB into cells failed

Existing experiments already show the tradeoff:

| The Green package variant | Total size | Largest package with dependencies |
| --- | ---: | ---: |
| Low monolith | 147.545 MB | 147.545 MB |
| 512 m cells | 151.417 MB | 75.795 MB |
| 128 m cells | 181.762 MB | 26.665 MB |

The smaller-cell version has 1,025 packages and 2,944 resources. Smaller spatial
cells increased total bytes. This argues for a dependency graph with shared
geometry prototypes and shared textures, plus splitting oversized individual
meshes when needed. It does not argue for thousands of independent duplicate
GLBs. Reuse the ignored artifacts named in the recovery record.

Keep the existing local streamer as a comparison control. Its two preparation
jobs and detail-budget checks are useful, but it needs reservations **before**
decode, a total ownership ledger, bounded upload work and game-state integration.
More workers can increase simultaneous transient memory and CPU contention.

## Geometry, textures, physics and scheduling

| System / library | Use for this game | Limits and recommended experiment |
| --- | --- | --- |
| glTF Transform | Prune unused levels/attributes, deduplicate, instance, partition and validate [CLI][gltf] | `partition` does not invent a correct spatial hierarchy. Keep source selectors and transform/geometry checks |
| Meshoptimizer / gltfpack | Offline locality, quantization, simplification and meshlet tools [upstream][meshopt] | Already used for delivery. Compression is distinct from lower triangle count. Test preservation of small flight gaps, normals, UVs and foliage silhouette |
| KTX2 / Basis / KTX tools | Color textures and normal/data maps with format-appropriate compression, mipmaps and target transcoding [Khronos][ktx], [extension][basis] | Log actual GPU format and mip bytes. Some target/quality combinations fall back to uncompressed data. A .ktx2 filename is not proof of small GPU residency |
| Draco | Alternative geometry transfer codec already supported by loader | Compare total transfer + decode on representative static geometry; do not stack it over Meshopt or assume it is always smaller/faster |
| InstancedMesh2 | Per-instance culling, BVH, LOD and shadow LOD [upstream][instances2] | Published source uses `WebGLRenderer` and `onBeforeCompile`; qualify only as WebGL challenger initially. Test bounds, terrain variants and custom shaders before considering adoption |
| Native instancing + spatial groups | Retain shared tree/prop meshes and reduce scene-object work | Already partially implemented. Whole-map batches can defeat culling; preserve material variants and compare submitted triangles, not just calls |
| three-mesh-bvh | Worker-built/serialized acceleration structures and spatial queries [project][bvh] | Compare to the **new compact** collision baseline. Raycast acceleration does not guarantee identical capsule sweeps/contact response |
| Prebuilt collision buffers | Move validated tree construction offline; load typed arrays in a worker | Measure bytes versus current compressed JSON. An uncompressed prebuilt tree can download slower even if it prepares faster. Version and hash formats; preserve Float64/contact ordering where required |
| Rapier | Mature alternative physics/query experiment [determinism][rapier] | Matching initial values, object order and version matter. Replacing collision response changes handling/replays; no automatic migration. Main source now contains TypeScript bindings |
| JoltPhysics.js | WASM physics candidate, optional threads and build configuration [project][jolt] | Native allocations require lifecycle care. Separate WASM delivery from embedded base64. More threads and another solver are not fixes for oversized visual assets |
| bitECS | Data-oriented update loops [project][bitecs] | Adopt only if profiles identify entity iteration/allocation as significant. Preserve existing domain logic; MPL-2.0 is not MIT |
| Workers + transferable buffers | Decode/prepare off the UI thread; bounded work queues | Already used for collision. Transfer ownership deliberately; avoid detaching bytes needed by another consumer. Object3D assembly and GPU work still need main/render-thread scheduling |
| OffscreenCanvas | Move rendering work away from the DOM thread if submission is a measured problem [API][offscreen] | Requires input/UI/worker boundaries and lifecycle work; does not make GPU rendering or downloading faster. A later experiment |
| Workbox / Cache Storage / IndexedDB | Optional disk/offline cache management [expiration][workbox] | Existing delivery already caches/resumes. Workbox count/age limits are not byte or GPU budgets. Avoid a second redundant asset cache and stale protocol mixtures |

For visual optimization, use Blender sources and reviewed exports. Preserve the
full-quality originals; derive quality-specific deliveries. Large terrain may
need tiled geometry and coarse distant levels; repeated vegetation needs shared
prototypes, sensible shadow distance and overdraw analysis. A billboard can save
triangles while increasing transparent fragment cost. Do not replace accepted
appearance with primitive placeholders or silently remove routes/interiors.

## Memory management must cover transitions and peaks

Use a single ownership model across map visuals, collisions, aircraft, race
props and Workbench. Track these separately:

| Memory class | Account for | Release / pressure response |
| --- | --- | --- |
| Disk cache | Encoded immutable resources, partial downloads | Revision-safe eviction; quota handling; preserve accounts/progress |
| Encoded RAM | Downloads, cached bytes, retained GLB slices | Drop redundant references after consumers finish |
| Decode staging | Transcoder WASM heaps, expanded buffers, image staging, pending parse | Reserve bytes before admission; reduce concurrency under pressure |
| Decoded CPU | Geometry attributes, scene nodes/materials, collision arrays | Lease/refcount shared data; retire old scenes and worker outputs |
| GPU payload | Buffers, texture formats/mips/layers, render targets, shadows | Dispose when last consumer releases; account for simultaneous old/new quality |
| Driver/compiler | Pipelines, shader modules, caches, allocator reserve | Measure separately where exposed; avoid unbounded variants; cannot infer from JS heap |

Proposed transition policy: retain the current safe scene while required new
resources load, but reserve capacity for that overlap before admitting work.
Canceling must prevent late commits and eventually release staged resources.
Fallback to existing distant geometry when detail is late. Memory pressure
should reduce optional detail, not discard physics underneath the aircraft.

The existing dimension-based estimate can remain a conservative cache heuristic,
but a measurement ledger should sum actual attribute buffers and compressed mip
payloads by identity and format. Do not blindly sum JS heap and ArrayBuffers
unless the particular browser's accounting proves they are disjoint. Integrated
GPUs share system memory, so GPU counters and process memory can also overlap.

## Profiling tools and what each can establish

| Tool | Useful evidence | Does not establish |
| --- | --- | --- |
| Browser Performance + Network + heap snapshots | Request timing/bytes, main-thread tasks, allocation retainers and worker activity | Exact GPU residency from JS heap alone |
| WebGPU Inspector | GPU objects, command/pass captures, shader debugging and available timing [upstream][gpu-inspector] | Uninstrumented FPS; capture itself adds work and memory |
| SpectorJS | WebGL draw/state/texture captures [upstream][spector] | A WebGPU capture |
| webgl-memory | Instrumented WebGL allocation estimates [upstream][gl-memory] | Full driver allocation or WebGPU memory |
| Engine stats / existing F4-F6 | Comparable frame arrays, backend, framebuffer, calls/triangles | Hardware identity or GPU memory without separate evidence |
| `measureUserAgentSpecificMemory` | Supported browser estimates including workers/frames [API][memory-api] | Portable exact VRAM; it has restricted availability and isolation requirements |
| GPU timestamp queries | GPU execution timing when available [timing][gpu-timing] | Input latency or total frame time; must avoid blocking readbacks |

Take diagnostic captures separately from acceptance timings. Disable debugging
focus emulation, keep the window visibly foreground, and preserve real slow
frames. Do not report display-paced medians as CPU throughput. Do not reintroduce
the invalid hidden-tab measurements corrected in the timing record.

Also measure network delivery independently: DNS/connect/TTFB, sustained bytes,
HTTP content encoding, retry/range behavior, asset cache hits and simultaneous
transfers. A CDN may help latency/throughput but cannot fix local parsing or GPU
cost; evaluate the existing Oracle path first. No paid CDN or hosting migration
is selected. HTTP/2/3 multiplexing still does not make thousands of requests free.

## Modern demos: what to learn and what not to infer

| Reference | Transferable lesson | Qualification |
| --- | --- | --- |
| Project Endurance by Anderson Mancini [author][endurance] | Comparable browser racing use case; inspect staged rendering/physics, assets and actual play behavior | No matched benchmark or reusable source license was established here |
| Author's WebGPU memory investigation [article][endurance-memory] | Account for compiler/driver costs as well as textures and buffers | His reported iPhone process threshold is device/workload evidence, not a universal 300 MB browser limit or an UHD 620 result |
| Scthe nanite-webgpu [source][nanite] | Meshlet hierarchy, LOD, culling and impostor research | Author explicitly lists no streaming/VRAM eviction/compression and scalability limitations; not our production streaming replacement |
| Official WebGPU samples [samples][gpu-samples] | Isolate render-bundle, compute or API behavior before integrating | Small demo timing does not establish full-game performance |
| Sketchbook [source][sketchbook] | Open vehicle/playground structure for historical comparison | Repository is archived; unsuitable as the principal current engine dependency |
| Topic-listed Three games | Useful interaction/implementation references | Small scenes and different gameplay do not reproduce our large native maps |

The latest API features also need qualification. Chrome's compatibility mode
can broaden WebGPU reach, but implementation/platform restrictions remain;
transient attachments target eligible render passes, not arbitrary map textures
[Chrome update][chrome-gpu]. Feature-detect on the actual laptop and keep a
working fallback. Do not turn on browser experimental flags as a requirement
for normal players.

## Assets and authoring sources

Asset selection is part of performance engineering, but this stage did not
download or substitute any art. These sources are candidates for future owned
content, not an instruction to reactivate Ironworks or replace imported maps.

| Source | Suitable use | Acceptance condition |
| --- | --- | --- |
| Poly Haven [license][polyhaven] | Authored/scanned props, textures, lighting references | CC0 assets; inspect each source's triangles, materials and texture sizes. Photorealism does not imply web readiness |
| ambientCG [license][ambientcg] | Material sources for atlas/trim/baked deliveries | CC0; derive appropriate resolutions and KTX targets, retain provenance |
| Kenney Nature Kit [pack][kenney] | Small stylized comparison environment or low-cost vegetation study | Pack declares CC0; aesthetic change requires user choice, not an invisible optimization |
| Quaternius Ultimate Nature [pack][quaternius] | Editable .blend nature library for a stylized candidate | Pack page still says CC0, while the current general site license is QAL [terms][quaternius-license]. Preserve and verify the exact downloaded pack's terms rather than labeling the entire site CC0 |

Recommended asset contract: editable source, author/link/license, bounds,
prototype identity, material/texture dependencies, authored LODs, collision
source, compressed bytes, decoded geometry bytes and target texture formats.
Verify silhouettes, UVs, rounded features and in-game Low appearance. A source
model's polygon count is not the final visible triangle budget.

## Stage-two experiment order and decision gates

This is the implementation plan produced by stage one, not a claim of completed
work. Each experiment is independently revertible and gets its own checked
commit/push. Reuse the current caches and previous reports. No new release is
needed for this research document.

| Order | Experiment | Evidence required / adoption gate |
| --- | --- | --- |
| 1 | Attribute the current real-game critical path | Separate menu Ready, first visible map, physics ready, first controllable flight, and optional detail completion. Capture positive network bytes and phase timings |
| 2 | Qualify 3D Tiles against current streamer | Same Minus Two geometry/textures; continuous distant coverage, full physics, cancellation/retry and 20 lifecycle cycles; bounded staging/resident accounting |
| 3 | Qualify Needle stable separately | Same object/detail ladder and both backends; prove local generation and resource ownership, clone behavior, downgrade and unload. Compare alpha only for a specific needed fix |
| 4 | Redesign The Green package graph | Shared prototypes/textures; bounded largest package; lower first-flight bytes without losing routes/contacts. No repeat of the known 128 m duplication result |
| 5 | Compare renderer adapters | Current Three, pinned modern Three, PlayCanvas, Babylon; same asset hashes, camera route, FOV, materials, texture sizes, lighting/shadows and framebuffer |
| 6 | Apply the measured CPU/GPU fix | Geometry LOD/overdraw if GPU-bound; culling/submission/material reuse if CPU-bound; collision binary/BVH only if that phase still matters |
| 7 | Complete target acceptance, then publication | Real UHD 620 run and end-to-end scenarios; separate Oracle backup/drain/release/rollback process when releasing implementation |

For renderer comparison, first freeze the content and warm/cold state. Then run
a separate content-pipeline comparison. Otherwise a lower-detail engine port
can falsely appear to have a faster renderer. Preserve the authoritative
simulation while testing renderer-only adapters; follow with a full-game
integration run before choosing a migration.

Measure at least three controlled cold and three warm loading runs per shortlisted
configuration, report every run and median/range. Do not label a three-run maximum
as a reliable P95. Distinguish fresh HTTP/app cache from warm driver shader cache.
Use all five maps for functional coverage, and Minus Two plus The Green as the
first controlled performance cases. Include slow 5 Mbps / 160 ms conditions,
cancel/retry, rapid reversal, map/quality switching, and decode/asset failure.

For streaming look-ahead, derive distance from measured worst relevant flight
speed and delivery latency: `distance >= speed * (transfer + decode + upload
latency + margin)`. The existing fixed two-second look-ahead is a prototype
parameter, not proof. Fast turns and teleport/reset need additional policy.
Persistent complete collisions are the initial safe choice; do not make physics
depend on whether scenery happens to be in view.

Existing acceptance remains **Low, actual 1280x720 framebuffer, adaptation off,
i5/UHD 620, median frame <=16.7 ms, 1% low >=50 FPS**, with 30-second warmup and
180-second standardized moving capture. Record thermal/power state and browser/
driver/backend. Keep the preliminary 150–300k visible triangles, <=250 calls
and <=256 MiB texture-with-mips budgets. These are not guarantees of FPS.

Additional proposed experiment gates, not user-accepted product promises:

- Prefer a materially lower end-to-end first-flight time and peak allocation
  over a modest isolated renderer gain. Record a target improvement before
  each comparison, once its baseline exists; no invented speedup percentage.
- Twenty full map transitions must show no unexplained upward retained-resource
  trend after settling. Check GPU objects and worker lifetimes as well as heap.
  A fixed plateau can be an allocator/cache effect; monotonic growth needs
  attribution. Forced-GC diagnostics remain separate from normal play.
- During warm streaming flight, investigate every main-thread task above 50 ms
  and every visible detail hole; collisions must never disappear. Count compile
  hitches separately from network wait.
- Reject a candidate that achieves speed by missing assets, reduced resolution,
  broken terrain/materials, changed handling, background throttling or lost
  fallback support. Engine migration requires passing the complete lesson/race,
  controller, replay, Workbench and multiplayer scenarios.

## Completion and continuation

Stage one delivers this comparison, current upstream metadata and reproducible
source qualifications. It establishes a concrete shortlist and experiment
order. It does **not** establish an engine winner, fixed browser performance,
GPU leak freedom or a published update. Next implementation starts with the
critical-path capture and one bounded streaming comparison, not another import,
full asset export or broad dependency upgrade.

The separate pending deployment state remains in
[ORACLE-BROWSER-20261025.md](ORACLE-BROWSER-20261025.md). This stage did not
attempt SSH/key recovery or change that release. GitHub preservation of this
research and Oracle publication are separate actions.

[discovery]: https://github.com/mikbry/awesome-webgpu
[topic-games]: https://github.com/topics/threejs-game
[topic-gl]: https://github.com/topics/webgl
[topic-gpu]: https://github.com/topics/webgpu
[showcase]: https://webgpu.com/
[three-gpu]: https://threejs.org/docs/pages/WebGPURenderer.html
[pc-assets]: https://developer.playcanvas.com/user-manual/assets/loading-unloading/
[pc-graphics]: https://developer.playcanvas.com/user-manual/graphics/
[babylon-thin]: https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances
[babylon-snapshot]: https://github.com/BabylonJS/Documentation/blob/master/content/setup/support/webGPU/webGPUOptimization/webGPUSnapshotRendering.md
[babylon-lite]: https://github.com/BabylonJS/Babylon-Lite
[babylon-lite-ti]: https://github.com/BabylonJS/Babylon-Lite/blob/master/docs/lite/architecture/12-thin-instances.md
[needle]: https://engine.needle.tools/docs/gltf-progressive/
[needle-repo]: https://github.com/needle-tools/gltf-progressive
[needle-stable]: https://github.com/needle-tools/gltf-progressive/blob/9e524f199dfb8055e7229032acd5abcb002b4720/src/lods.manager.ts
[cocos]: https://docs.cocos.com/creator/3.8/manual/en/asset/bundle.html
[godot]: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
[unity-gpu]: https://docs.unity.com/en-us/engine/7000.0/manual/platform-specific/webgl/develop/graphics/web-gpu/enable
[unity-perf]: https://docs.unity.com/en-us/engine/7000.0/manual/platform-specific/webgl/develop/performance
[orillusion]: https://github.com/Orillusion/orillusion
[r3f]: https://github.com/pmndrs/react-three-fiber
[typegpu]: https://docs.swmansion.com/TypeGPU/
[tiles-api]: https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/src/core/renderer/API.md
[tiles-plugins]: https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/src/three/plugins/API.md
[gltf]: https://gltf-transform.dev/cli
[meshopt]: https://github.com/zeux/meshoptimizer
[ktx]: https://www.khronos.org/ktx/
[basis]: https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_texture_basisu/README.md
[instances2]: https://github.com/agargaro/instanced-mesh
[bvh]: https://github.com/gkjohnson/three-mesh-bvh
[rapier]: https://rapier.rs/docs/user_guides/javascript/determinism/
[jolt]: https://github.com/jrouwe/JoltPhysics.js
[bitecs]: https://github.com/NateTheGreatt/bitECS
[offscreen]: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
[workbox]: https://developer.chrome.com/docs/workbox/modules/workbox-expiration
[gpu-inspector]: https://github.com/brendan-duncan/webgpu_inspector
[spector]: https://github.com/BabylonJS/Spector.js
[gl-memory]: https://github.com/greggman/webgl-memory
[memory-api]: https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory
[gpu-timing]: https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html
[endurance]: https://andersonmancini.dev/blog/endurance-racing
[endurance-memory]: https://andersonmancini.dev/blog/endurance-racing-iphone-gpu-memory
[nanite]: https://github.com/Scthe/nanite-webgpu
[gpu-samples]: https://webgpu.github.io/webgpu-samples/
[sketchbook]: https://github.com/swift502/Sketchbook
[chrome-gpu]: https://developer.chrome.com/blog/new-in-webgpu-146
[polyhaven]: https://polyhaven.com/license
[ambientcg]: https://docs.ambientcg.com/license/
[kenney]: https://kenney.nl/assets/nature-kit
[quaternius]: https://quaternius.com/packs/ultimatenature.html
[quaternius-license]: https://quaternius.com/license.html
