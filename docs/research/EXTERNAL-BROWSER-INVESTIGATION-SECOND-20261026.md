# Parvoz Drone Simulator: browser 3D technology investigation (stage one)

*Research only. Written and sources retrieved 26 October 2026. No code, dependencies, assets, accounts or production systems were touched.*

## 0. Limits of this report (read first)

- **No repository access.** I could not open C:\\DroneLiftoffUz or the private ParvozDroneSim repository, so nothing here claims compatibility with your code, and I cannot say which of your existing compression, batching/instancing, LOD, cache and worker systems are active or effective. Experiment E0 in section F exists to settle that before anything is adopted.
- **I measured nothing.** Every number below is a third party’s report, a figure from official documentation, or arithmetic, and is labelled.
- **Coverage gap.** The search tool I had did not return Reddit or Hacker News threads. Community evidence therefore comes from the Three.js, Babylon.js and PlayCanvas forums, GitHub issues, PRs and commits, official docs and release notes. “No Reddit/HN corroboration” is a gap in this report, not a finding about any technology.
- **Source-level inspection is partial.** I read KTX2Loader.js (r182), excerpts and API docs of 3DTilesRendererJS, three-mesh-bvh’s README and changelog, BatchedMesh docs and PR text, the READMEs of nanite-webgpu and three-virtual-geometry, Hilo3d’s texture-streaming document, a Dawn commit and Babylon Lite’s announcement. I did **not** read the implementation of 3DTilesRendererJS’s unload/abort path, InstancedMesh2’s BVH code, gltf-progressive, or any Babylon.js or PlayCanvas runtime code. Section D lists the gaps per candidate.
- **Label key:** **\[V\]** confirmed in primary/official documentation or a release page; **\[S\]** observed in project source, README or commit; **\[R\]** third-party reported measurement; **\[I\]** my inference or arithmetic; **\[H\]** untested hypothesis.

## A. The strongest findings

**A1. Most of your list is pipeline and ownership work, not a renderer-API problem.** Download size, parse and decode, collision preparation, texture residency, map-switch peaks and “time until the player can fly” are decided by how maps are packaged, decoded and owned in memory. Three.js does not release GPU resources on garbage collection; a January 2026 fix in an open-source three.js app removed [linear GPU-memory growth on every dataset switch](https://github.com/HSF/phoenix/pull/783) by adding explicit disposal \[R\]. No engine I examined removes the need for an ownership model. \[I\]

**A2. WebGPURenderer is not a safe performance bet for a draw-call-heavy, integrated-GPU target today.**

- A forum report on r183 (29 May 2026, Chrome 148, RTX 4090 Laptop, 4,000 separate meshes) measured CPU render time of [4.5 ms on WebGLRenderer versus 9.7 ms on WebGPURenderer and 10.3 ms with forceWebGL, and a cold first frame of 32 ms versus 167 ms and 344 ms](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904) \[R\]. The gap is the same on both backends, so the poster attributes it to renderer-class cost (per-object uniform-buffer and bind-group churn, tracked as three.js issue #30560) and paused the migration. The repro is a public CodePen; it is synthetic.
- A r181 thread reports [5k cubes at roughly 350 fps (WebGL), 140 fps (WebGPU) and 50 fps (WebGPURenderer with forceWebGL)](https://discourse.threejs.org/t/webgpu-performance-issue/87939), hardware unstated \[R\].
- The official manual says [ShaderMaterial, RawShaderMaterial and onBeforeCompile modifications are not supported by WebGPURenderer, EffectComposer is not supported, and WebGLRenderer stays maintained but gets no large new features](https://threejs.org/manual/en/webgpurenderer.html) \[V\]. A port means rewriting every custom material in TSL.
- Conflicting evidence: [a vendor guide](https://www.utsubo.com/blog/threejs-best-practices-100-tips) claims 2–10× gains in “draw-call-heavy scenes”. It gives no reproduction, and the forum cases above are non-instanced meshes. A forum participant’s reading is that [batching and instancing stay important whatever the API](https://discourse.threejs.org/t/understanding-about-webgpurenderer/86635). I treat the vendor claim as unproven for your workload.
- No UHD 620 evidence was found either way. Dawn carries [driver-specific workarounds for Intel Gen9/Gen11 on D3D12](https://dawn.googlesource.com/dawn/+/refs/heads/chromium/6312%5E) \[S\], which shows these GPUs are supported, not that they are fast. \[I\]

**A3. KTX2 on your target machines will almost certainly be transcoded to BC formats, and GPU size is fixed by that target format, not by file size.** Khronos’ WebGL guidance says that on Windows [ASTC and ETC need an OpenGL or Vulkan ANGLE backend](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXDeveloperGuideWebGL.md) \[V\]. Survey data shows [ASTC exposed on only about 2.5% of Windows reports](https://web3dsurvey.com/webgl/extensions/WEBGL_compressed_texture_astc) against [about 99% for BPTC/BC7](https://web3dsurvey.com/webgl/extensions/EXT_texture_compression_bptc) \[R\]. Three.js’s [KTX2Loader.detectSupport](https://app.unpkg.com/three@0.182.0/files/examples/jsm/loaders/KTX2Loader.js) chooses the transcode target from the renderer’s extensions \[S\]. Arithmetic for one 2048×2048 texture \[I\]: RGBA8 is 16 MiB (about 21 MiB with mips); BC7 is 4 MiB (about 5.3 MiB); BC1 is 2 MiB (about 2.7 MiB). A smaller ETC1S or UASTC file shrinks the download but not GPU residency, and the transcode costs worker CPU time on an i5. Check which formats the target laptop really exposes (E2).

**A4. Streaming is an architecture (chunks, hierarchy, budget). The one mature open-source control plane for Three.js is 3DTilesRendererJS.** It provides [priority download and parse queues, an LRU cache with byte limits, and screen-space-error traversal](https://gkjohnson.github.io/tools/docs/3d-tiles-renderer/core/TilesRendererBase/) \[V\], and it is [Apache-2.0 with Three.js, Babylon.js and r3f support](https://github.com/NASA-AMMOS/3DTilesRendererJS) \[V\]. Its README warns that [cache limits are hard caps: when the tiles a view needs do not fit, coarser tiles are shown and refinement stops](https://github.com/NASA-AMMOS/3DTilesRendererJS) \[V\]. That is the right failure mode for a 1280×720 UHD 620 target, but it makes the quality of coarse proxies (HLOD) decisive. It does **not** author your tileset (you need an offline “map compiler”), compress textures, own collision data, or free resources you attach outside its tiles. Whether it aborts in-flight fetches when a tile leaves view, and how it unloads shared textures, is unverified (E5).

**A5. First-use stutter has a documented WebGL mitigation and a documented WebGPURenderer regression.** On WebGL, [compileAsync() was added so a scene can be compiled with minimal blocking, using KHR\_parallel\_shader\_compile when present](https://github.com/mrdoob/three.js/pull/19752) \[S\]. The extension is [not Baseline](https://developer.mozilla.org/docs/Web/API/KHR_parallel_shader_compile) \[V\], and a Khronos list thread notes that [common status-check patterns serialise compilation](https://www.khronos.org/webgl/public-mailing-list/public_webgl/1904/msg00041.php) \[R\]. On WebGPURenderer, the r183 report shows a cold first frame 5–10× slower on many meshes, which the poster attributes to lazy render-object creation \[R, cause H\]. Texture-upload stalls are a separate cost fixed by neither.

**A6. Collision preparation can leave the main thread and can be pre-baked.** [three-mesh-bvh provides MeshBVH.serialize/deserialize, GenerateMeshBVHWorker and ParallelMeshBVHWorker (which needs SharedArrayBuffer)](https://github.com/gkjohnson/three-mesh-bvh) \[V\]. BVH generation [modifies the geometry’s index buffer in place](https://github.com/unitycoder/three-mesh-bvh) \[V, older README mirror\], so a baked BVH must ship with its reordered index data.

**A7. Cross-origin isolation (COOP/COEP headers) is a cross-cutting hosting decision.** It is required for [performance.measureUserAgentSpecificMemory()](https://developer.mozilla.org/docs/Web/API/Performance/measureUserAgentSpecificMemory) \[V\] (the only in-page whole-page memory estimate I found; flagged limited availability) and for SharedArrayBuffer (parallel BVH building, threaded WASM), and it constrains third-party embeds and cross-origin asset hosting. Decide it once, before configuring any CDN or bucket.

**A8. $0 hosting is plausible, but the limits are operation counts.** Cloudflare R2’s [free tier is 10 GB-month storage, 1 million Class A and 10 million Class B operations per month, with free egress](https://developers.cloudflare.com/r2/pricing) \[V\]. If a cold session fetches about 400 objects (chunks, textures, manifests), 10 million reads covers roughly 25,000 cold sessions a month \[I\], so chunk granularity is a cost lever. A secondary directory lists [a payment method as required](https://freetier.co/directory/products/cloudflare-r2) \[R\]; confirm signup requirements and overage exposure against the $0 rule before relying on it. In the browser, Chromium allows an origin [up to 60% of disk, with persistence requestable through navigator.storage.persist()](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) \[V\]. Incognito and “clear site data on exit” users get far less, and [Safari evicts script-written storage after seven days without interaction](https://web.dev/articles/storage-for-the-web) \[V\].

**A9. No engine I examined demonstrably fixes your bottlenecks for you. The migration candidates differ in cost and risk, not in proof.** Babylon Lite’s own announcement reports [about 3.6× faster frames (RAF CPU time), 2.5× faster startup and 5× less memory than Babylon.js](https://forum.babylonjs.com/t/introducing-babylon-lite/63648) as medians over small parity scenes, with images diffed in CI on a software Vulkan backend \[R, vendor\]. It is WebGPU-only with no fallback, and states backward compatibility is not a goal. PlayCanvas’ hosted editor’s [free plan is public projects with 1 GB storage](https://playcanvas.com/plans) \[V\]; private projects need a paid plan, which collides with the $0 rule and your asset-permission constraint if you used the hosted editor. Godot’s web export is [WebGL 2 Compatibility only, with no WebGPU](https://docs.godotengine.org/es/4.4/tutorials/export/exporting_for_web.html) \[V\]. See sections B, D and E.

**A10. What this changes about priorities.**

1. Build the measurement harness and bound-triage on a real UHD 620 laptop first (E0). Everything else is ordered by what it shows.
2. Memory ownership ledger, map-switch and soak behaviour (E1): engine-independent and the most likely source of long-session growth.
3. Texture budget and format (E2): usually the largest GPU and decode cost.
4. Offline map compiler plus chunked, budgeted streaming with HLOD (E5), using 3DTilesRendererJS or a minimal custom grid streamer, chosen by experiment.
5. Draw-call reduction (E3) and shader pre-warm (E4), ordered by what E0 shows.
6. Baked collision (E6).
7. A gated renderer/engine spike (E7), only after 2–6, with explicit falsifiers (section E).

Stay on WebGLRenderer for the performance path. Moving from Three.js 0.180.0 to the current [r186 (released 8 September 2026)](https://cgworld.jp/flashnews/01-202610-Threejs-r186.html) should be a measured A/B (E3 baseline), not an assumed gain.

## B. Ecosystem comparison, organised by the problem solved

Decision key: **Shortlist** (carried into section D), **Spike** (small gated experiment), **Watch**, **Reject** (with reason).

### B1. Renderer and engine

- **Three.js r186, WebGLRenderer.** Current numbered release; your 0.180.0 is six releases behind. Solves none of the pipeline problems by itself; it is the baseline every alternative must beat. **Shortlist.**
- **Three.js WebGPURenderer.** See A2. Also note the r185 release includes a [compute-shader rasterizer example](https://newreleases.io/project/github/mrdoob/three.js/release/r185) \[S\], which shows direction of travel, not suitability for UHD 620. **Spike (E7), not a migration target.**
- **Babylon.js 9.x.** [9.23.0 is listed on the releases page](https://github.com/babylonjs/Babylon.js/releases); [9.0 was announced 26 March 2026](https://codezine.jp/news/detail/23821). WebGL2 and WebGPU, integrated physics and inspector, license reported as Apache-2.0 by a secondary source. Solves tooling integration; it does not remove your packaging, residency or collision work. Not read at source here. **Spike (E7).**
- **Babylon Lite.** WebGPU-only, tree-shakable, data-oriented, rapid releases ([1.33.0 reported 14 October 2026](https://radiancefields.com/tags/streaming)); the project says [backward compatibility is not a first-class goal](https://forum.babylonjs.com/t/introducing-babylon-lite/63648). Vendor numbers measure small parity scenes. **Spike if E3/E4 point at renderer CPU overhead; otherwise Watch.**
- **PlayCanvas Engine v2.23.0** ([2 October 2026](https://radiancefields.com/playcanvas-engine-v2.23.0-returns-gaussian-splat-lod-to-distance-only-selection)), MIT. Its recent streaming work targets Gaussian splats, not triangle-mesh maps \[V\]. Engine-only use avoids the editor plan problem, but then you lose its main value. **Watch; hosted editor rejected under your constraints.**
- **Godot 4.x web export. Reject:** WebGL 2 Compatibility renderer only, and threaded builds need cross-origin-isolation headers \[V, [docs](https://docs.godotengine.org/es/4.4/tutorials/export/exporting_for_web.html)\]; a secondary source puts empty exports at [about 5 MB with Brotli](https://app.cinevva.com/de/guides/godot-vs-unity-web-games) (that source sells a competing engine).
- **Bevy/wgpu. Reject:** a Rust rewrite, and Bevy’s [webgpu feature overrides webgl2, so one wasm build cannot serve both](https://docs.rs/crate/bevy/latest/source/docs/cargo_features.md) \[V\].
- **Unity Web. Reject for migration cost;** only secondary sources were consulted, so I make no claim about its web memory or loading behaviour.
- **Not evaluated:** Needle Engine (Three.js-based; its gltf-progressive package is evaluated in D), Orillusion, Galacean, Wonderland Engine (paid), Hilo3d (niche; its [streaming document](https://hilo3d.js.org/docs/media/ASSET_STREAMING.md) is useful mainly as an honest statement of limits).

### B2. Draw calls, batching, visibility

- **BatchedMesh (core).** [Multi-draw batching with per-object frustum culling and sorting on by default, and a slower fallback without WEBGL\_multi\_draw](https://threejs.org/docs/pages/BatchedMesh.html) \[V\]. A later PR added [instanced rendering of repeated geometry; the prototype reported geometry memory falling from about 192 MB to about 23 KB for 20,000 items of three geometries](https://github.com/mrdoob/three.js/pull/28462) \[R, PR author\]. Culling is a CPU loop over instances \[S, from a port of the same logic\]. Solves draw-call count for many different geometries sharing one material. Leaves untouched: material and texture variety, CPU culling cost at large instance counts. **Shortlist.**
- **InstancedMesh2 (@three.ez/instanced-mesh).** [Per-instance frustum culling, dynamic BVH (best for mostly static scattered instances), sorting, per-instance visibility and LOD](https://www.npmjs.com/package/@three.ez/instanced-mesh) \[V\]. A community answer suggests [BatchedMesh for many different tree/rock types, InstancedMesh otherwise](https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221) \[R\]. WebGPU support is unverified. **Shortlist.**
- **@three.ez/batched-mesh-extensions.** [BVH, LOD and culling extras for BatchedMesh, with separate WebGL and WebGPU builds](https://classic.yarnpkg.com/en/package/@three.ez/batched-mesh-extensions) \[V\]; version 0.0.11 when listed, so API churn risk. **Watch.**
- **WebGPU render bundles.** A PR demo reports [23.7 ms to 15.9 ms for 8,000 meshes](https://github.com/mrdoob/three.js/pull/28347) \[R, author’s demo\]. They save JavaScript overhead only, require a static scene, and need WebGPU. **Reject for now.**
- **GPU-driven culling and indirect draws.** Possible on WebGPU via compute and [indirect buffers](https://www.utsubo.com/blog/threejs-best-practices-100-tips) (vendor description) \[R\]; it needs extra passes and, on your target, unproven compute throughput. For open-terrain flight, occlusion culling probably has low value. \[H\] **Reject for now.**

### B3. Spatial streaming, LOD, virtual geometry

- **3DTilesRendererJS.** See A4 and D. **Shortlist.**
- **Minimal custom grid streamer** (manifest of chunks with bounds, byte sizes and parent/child proxies; your own queue and LRU). Less generality, less integration risk if your maps are not geospatial. **Shortlist (decided by E5).**
- **@needle-tools/gltf-progressive.** Progressive texture and mesh LODs for any Three.js project, but it needs [assets pre-processed to carry LOD data, with generation through Needle Cloud or Needle Engine](https://engine.needle.tools/docs/gltf-progressive/) \[V\], and its [latest changelog entry is an alpha (3.6.0-alpha.3, 27 May 2026) with worker loading still opt-in](https://engine.needle.tools/docs/reference/changelogs/gltf-progressive) \[V\]. **Conditional (D).**
- **nanite-webgpu and three-virtual-geometry. Reject for this target.** nanite-webgpu’s README lists [no streaming or VRAM eviction, a 32-bit visibility packing forced by WebGPU lacking 64-bit atomics, and software rasterisation](https://github.com/Scthe/nanite-webgpu) \[S\]. three-virtual-geometry v0.1.3 needs r180+ and WebGPU, handles [static meshes only, and reports its results on an M4 Pro](https://cdn.jsdelivr.net/npm/three-virtual-geometry@0.1.3/README.md) \[S, R\]. Neither is evidence for UHD 620 at 1280×720.
- **Texture-residency libraries.** I found none for Three.js beyond gltf-progressive. Hilo3d documents [whole-file KTX2 fetches, re-fetch on refinement, and no sparse range streaming or global budget](https://hilo3d.js.org/docs/media/ASSET_STREAMING.md) \[S\], a useful reminder of how narrow “texture streaming” often is. I found no production-ready browser virtual-texturing system. \[I\]

### B4. Geometry compression, simplification, LOD generation

- **meshoptimizer v1.0 with gltfpack.** [Faster clusterisation, better simplification, the clusterlod.h cluster-hierarchy library, and gltfpack support for KHR\_meshopt\_compression via -cz, while loader support for that extension is not yet widely available and EXT\_meshopt\_compression stays the default](https://scour.ing/@matmat/p/https://meshoptimizer.org/v1.html) \[V, mirror of the project post\]. The repo’s [nanite.cpp demo describes itself as not for production](https://docs.rs/crate/gltfpack-sys/latest/source/meshoptimizer/demo/nanite.cpp) \[S\]. Three.js r183 notes list a [documentation update for KHR\_meshopt\_compression](https://github.com/mrdoob/three.js/releases/tag/r183) \[V\]; whether r186’s GLTFLoader decodes it is unverified. Solves transfer size, decode speed, offline simplification for HLOD proxies. Leaves untouched: texture memory, residency. **Shortlist.**
- **Draco.** Alternative geometry codec; I did not gather current decode-time evidence, so I make no ranking claim. Test against meshopt on your chunks (E5).

### B5. Textures

- **KTX2 (Basis Universal) via KTX2Loader.** [Worker pool, default four workers; one transcoder per loader instance; a warning against multiple active loaders; dispose() releases workers](https://unpkg.com/@types/three@0.184.0/examples/jsm/loaders/KTX2Loader.d.ts) \[S\]. On a four-thread i5 the default four workers can compete with the render thread. \[I\] Solves transfer size and GPU bytes (to the BC target). Leaves untouched: residency policy, CPU-side copies. **Shortlist.**
- **CPU-side copies.** Three.js keeps source data for context-loss recovery; a forum answer warns that [dropping CPU buffers after upload prevents restoring the context](https://discourse.threejs.org/t/how-to-free-cpu-side-memory-for-geometry-texture-already-on-gpu/70602) \[R\]. Freeing them is a deliberate trade, to be measured in E1/E2.
- **Resolution caps, atlases and trim sheets** are asset-level decisions that no loader can replace.

### B6. Shader and pipeline compilation

- **WebGLRenderer.compileAsync plus a hidden warm-up frame** (details in A5 and E4). **Shortlist.**
- **WebGPURenderer pipelines.** Lazy render-object creation reported (A5). Pre-warming recipe unverified. **Spike only.**

### B7. Workers, WASM, decoding

- KTX2 and BVH workers are above. SharedArrayBuffer-dependent options (parallel BVH, threaded WASM) require cross-origin isolation (A7).
- OffscreenCanvas rendering: Babylon Lite ships a demo that [keeps rendering in a worker while the main thread is blocked](https://forum.babylonjs.com/t/introducing-babylon-lite/63648) \[R, vendor\]; I did not evaluate a Three.js equivalent. **Watch.**

### B8. Delivery, caching, persistence

- **Cloudflare R2** for $0 object hosting (A8). **Shortlist, pending signup check.**
- **Cache API for network resources, OPFS for file-like content** is the [web.dev recommendation](https://web.dev/articles/storage-for-the-web) \[V\]. **Range requests with ETag/If-Range for resumable chunk downloads** are standard HTTP, but I evaluated no library for them. \[I\] **Design in E9.**

### B9. Profiling and diagnostics

- **Long Animation Frames** (long frames with script and rendering attribution; [Chrome shipping on desktop from version 123 per its intent](https://groups.google.com/a/chromium.org/g/blink-dev/c/5IzAuV4WtfU/m/ajbaoKf6BgAJ?hl=ja) \[V\]); **measureUserAgentSpecificMemory** (A7); **renderer.info** and Chrome’s Performance panel and task manager. For presented-frame pacing on Windows, Intel’s PresentMon is the tool I would use \[I, not retrieved\]. Browsers enforce vsync, so unthrottled FPS readouts mislead; nanite-webgpu’s author makes the same warning \[S\].

### B10. Free assets and authoring

- Kenney’s CC0 labelling is stated in [three-virtual-geometry’s README](https://cdn.jsdelivr.net/npm/three-virtual-geometry@0.1.3/README.md) \[S\], which also uses Poly Haven models; I did not re-verify any asset licence on the sites themselves, so check each pack’s page before use.
- Rule that follows from your constraints: **never upload permission-restricted or Liftoff-derived assets to a cloud conversion service** (Needle Cloud, Cesium ion or similar). Process them locally. \[I\]

### B11. Sources I rejected, and why

- A [“Three.js r160” article](https://digitalstrategyforce.com/journal/what-does-threejs-r160-mean-for-web-developers-in-2026/) dated 2026 describing r160 as the release that shipped WebGPU: it contradicts the real release history (r186 shipped 8 September 2026) and I treat it as unreliable.
- AI-generated summary pages and benchmark roundups that quote numbers without hardware, versions or reproduction.
- Vendor comparison posts (Utsubo, Cinevva) are used only where they state something checkable; their rankings are not evidence.

## C. Community evidence

Each entry gives date, original source, hardware/version where known, the claim, reproduction quality, resolution, and relevance to Parvoz. Upvotes, stars and screenshots were not used as evidence. Several posts by one project are counted once.

**C1. WebGPURenderer about 2× slower CPU and 5–10× slower cold first frame on many-mesh scenes.** 29–30 May 2026, [Three.js forum](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904). r183 (0.183.2), Chrome 148, Windows 11, RTX 4090 Laptop. Claim: 4,000 meshes, WebGL 4.5 ms / WebGPU 9.7 ms / forceWebGL 10.3 ms CPU render. Reproduction: public CodePen rendering all three renderers on one rAF; synthetic (200 shared geometries, one trivial material, frustumCulled=false, matrixAutoUpdate=false). Resolution: none in-thread; the poster links the open issue #30560 and pauses the migration; another participant advises staying on WebGLRenderer unless a WebGPU-only feature is needed. I could not fetch issue #30560, so its status after May 2026 is unverified. Relevance: high if your maps submit thousands of non-instanced meshes, lower once they are batched.

**C2. Cube-count benchmark on r181.** Activity November 2025, [Three.js forum](https://discourse.threejs.org/t/webgpu-performance-issue/87939). 5k cubes: WebGL \~350 fps, WebGPU \~140, forceWebGL \~50; 10k cubes with forceWebGL: 14 fps. Hardware unstated, demo is MeshBasicMaterial cubes. Replies describe a known issue affecting many draw calls and say the current emphasis is performance. Unresolved. Relevance: medium (confirms the pattern, weak on detail).

**C3. Mechanism: per-object uniform buffers.** February 2025, [Three.js forum](https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629). 20,000 cubes about 2× slower; a participant attributes it to each cube using its own UBO for object-scope uniforms, causing many setBindGroup/bindBufferBase and writeBuffer/bufferData calls. A moderator asked for a GitHub issue. The C1 poster later ties current behaviour to the same cause. Relevance: explains why instancing or batching, not the API swap, changes the result.

**C4. Render bundles for static groups.** 2024, [three.js PR #28347](https://github.com/mrdoob/three.js/pull/28347) and [issue #26876](https://github.com/mrdoob/three.js/issues/26876). Claim: 8,000 meshes, 23.7 ms to 15.9 ms average in the author’s demo. Reproduction: author-hosted demo, hardware not recorded in what I read. Discussion in #26876: a maintainer notes bundles save JavaScript time between draw calls only. Relevance: CPU-side, static scenes, WebGPU only. Low for a GPU-bound integrated target.

**C5. GPU memory growth on dataset switch.** Merged 24 January 2026, [HSF/phoenix PR #783](https://github.com/HSF/phoenix/pull/783). Claim: scene-graph removal without dispose made GPU memory climb linearly over repeated event switches, until geometries, materials and textures were disposed. Reproduction: stated procedure (switch 20–30 times, watch Chrome’s Performance Monitor), no numbers. Merged. Relevance: high, as a real-world confirmation of the disposal requirement and a cheap test pattern for map switching.

**C6. Freeing CPU copies versus context loss.** [Three.js forum](https://discourse.threejs.org/t/how-to-free-cpu-side-memory-for-geometry-texture-already-on-gpu/70602), date not retrieved. The asker could not make ArrayBuffers collectable by nulling references; the answer is that the data is needed to restore after context loss. Relevance: sets the trade-off for E1/E2 (memory saved versus recovery path).

**C7. Babylon Lite announcement and first replies.** 17 June 2026, [Babylon.js forum](https://forum.babylonjs.com/t/introducing-babylon-lite/63648). Vendor medians over 100+ parity scenes: 19× less gzipped JS, 3.6× faster RAF CPU time, 2.5× faster startup, 5× less memory, images diffed in CI on SwiftShader. Reproduction: public repo and demos, but small scenes and CPU time, not GPU frame time or large-map streaming. A reply notes Chrome still lacked WebGPU by default on Linux. A maintainer clarifies Lite [is not a replacement and Babylon.js continues](https://forum.babylonjs.com/t/babylon-x-vs-lite-vs-9/63786). Relevance: credible direction, no evidence for your map sizes or for UHD 620.

**C8. PlayCanvas plans.** [Plans page](https://playcanvas.com/plans) (retrieved today) and [forum answers](https://forum.playcanvas.com/t/solved-converting-free-account-to-organization-and-payment-questions/8361): free is public projects only; private projects lock if a paid plan is cancelled. Relevance: a hard constraint conflict if the hosted editor were used.

**C9. Hilo3d streaming document.** Package 2.0.0-alpha.8, [docs](https://hilo3d.js.org/docs/media/ASSET_STREAMING.md). States it fetches whole KTX2 files, re-fetches on refinement, and does not claim range streaming, virtual textures or a global budget. Relevance: a precise vocabulary for what to demand from any “streaming” claim.

**C10. nanite-webgpu README.** [GitHub](https://github.com/Scthe/nanite-webgpu). Documents what a browser Nanite needed (software rasteriser, packing into 32 bits) and what it omits (streaming, eviction, compression). Relevance: scoping information; 1k stars is not performance evidence.

**Conflicts and status.** Vendor claims of 2–10× WebGPU gains and a secondary post’s [about 30% lower memory from one developer](https://www.buildmvpfast.com/blog/threejs-webgl-to-webgpu-renderer-migration-2026) conflict with C1–C3 for many-mesh scenes; the workloads differ (particles and compute versus non-instanced meshes), and none was reproduced on UHD 620. A 2023 report of [20 vs 130 fps on r154](https://discourse.threejs.org/t/webgpu-performance-significantly-slower-rendering-non-instanced-geometries/54135) was marked solved, so it is a historical defect; C1–C2 show a later, different regression pattern. C1–C3 are unresolved as of the pages I read.

## D. Deep evaluation of finalists

### D1. Three.js r186 with WebGLRenderer (baseline and upgrade)

- **Solves:** nothing alone. **Version:** r186, [8 September 2026](https://cgworld.jp/flashnews/01-202610-Threejs-r186.html) (stable numbered release; main branch has r187-labelled PRs open). You run 0.180.0.
- **Compatibility:** custom GLSL and onBeforeCompile remain valid on WebGLRenderer \[V, [manual](https://threejs.org/manual/en/webgpurenderer.html)\]; the release notes between r181 and r186 and the [migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide) were not read line by line.
- **Unverified:** whether any r181–r186 change helps or hurts your scenes. Treat the upgrade as E3’s first A/B.

### D2. 3DTilesRendererJS (streaming control plane)

- **What it does:** screen-space-error traversal ([errorTarget default 16 px](https://gkjohnson.github.io/tools/docs/3d-tiles-renderer/core/TilesRendererBase/)), a download queue (per-origin limit default 25), a parse queue (default 5), and an LRU cache with min/max byte limits, all configurable \[V\]. An older source excerpt shows smaller defaults (4 downloads, 1 parse) \[S\], so defaults are version-dependent.
- **Memory behaviour:** hard caps (A4). Parse concurrency bounds transient decode memory, but what the byte counter measures (encoded size, decoded CPU data, or GPU bytes) is **unverified**, and that decides whether your 1280×720 budget is actually enforced.
- **License and status:** Apache-2.0; [2.4k stars, 100 open issues](https://github.com/NASA-AMMOS/3DTilesRendererJS) on the page I read. Current npm version not verified.
- **Integration cost:** you must produce a 3D Tiles tileset (hierarchy with geometric error, per-tile glTF/b3dm). It also works with Babylon.js, so the streaming layer survives an engine change \[V\]. Fit for non-geospatial local coordinates is plausible but **untested** \[H\].
- **Unverified:** abort of in-flight fetches on unload; dedup of shared textures between tiles; behaviour under fast camera speeds; WebGL context-loss recovery.

### D3. Minimal custom chunk streamer (fallback to D2)

Requirements I would hold it to, derived from your brief: AbortController on every chunk fetch; priority by distance and velocity direction; decode in workers; per-frame upload budget; LRU with a pinned working set and byte accounting in **decoded GPU bytes**; coarse proxy always resident; context-loss replay; manifest carrying encoded and decoded sizes. Cost: more code you own; benefit: exact control of the properties D2 leaves unverified. Choose by E5.

### D4. Asset pipeline: meshoptimizer/gltfpack, KTX2, toktx

- **Version:** meshoptimizer v1.0 (December 2025 per a [summary of the release](https://x-cmd.com/blog/251217)); gltfpack [preserves KHR\_texture\_basisu, EXT\_texture\_webp, EXT\_mesh\_gpu\_instancing and EXT\_meshopt\_compression inputs](https://github.com/zeux/meshoptimizer/releases) \[V\].
- **Use here:** offline simplification for HLOD proxies, vertex-cache and quantisation optimisation, optional compression. Needle’s docs say [toktx v4.1.0 or newer is needed for KTX2 production builds](https://engine.needle.tools/docs/how-to-guides/optimization/) \[V\].
- **Memory:** compression reduces transfer only; decoded vertex data and BC textures occupy their full size at runtime \[I\].
- **Risks:** gltfpack merging and instancing flags can change scene structure, which may touch identifiers; run it on copies and diff node names, since you must preserve Kestrel identifiers.

### D5. three-mesh-bvh (collision and queries)

- **What it does:** BVH raycast and spatial queries; serialisation; worker generation; parallel generation with SharedArrayBuffer; build options trading build time and memory (strategy, maxLeafTris, maxDepth) \[V, [README](https://github.com/gkjohnson/three-mesh-bvh), [changelog](https://github.com/gkjohnson/three-mesh-bvh/blob/master/CHANGELOG.md)\].
- **Integration cost:** unknown, because I do not know your current collision code. Hard rule: flight behaviour must be unchanged, so use it only as an accelerator behind the same collision queries, and test determinism against recorded flights.
- **Unverified:** version and license text (believed MIT, not re-read); deserialisation copy cost versus transferable buffers at your chunk sizes.

### D6. BatchedMesh versus InstancedMesh2

- BatchedMesh: [constructor takes max instance, vertex and index counts and a material or material array](https://threejs.org/docs/pages/BatchedMesh.html), so capacity planning is up front; per-object culling and sorting are CPU work. InstancedMesh2: [BVH-accelerated culling is aimed at mostly static scattered instances; dynamic updates can be expensive](https://www.npmjs.com/package/@three.ez/instanced-mesh).
- **Unverified:** both libraries’ behaviour at your instance counts on a UHD 620; whether your current batching already does this; InstancedMesh2 license and WebGPU status. Decide by E3.

### D7. @needle-tools/gltf-progressive (conditional)

- **Mechanism:** a glTF extension (NEEDLE\_progressive) with mesh and texture LOD variants loaded on demand by screen density \[V, [docs](https://engine.needle.tools/docs/gltf-progressive/)\]. The README’s CDN snippet uses the @latest tag while the changelog’s newest entry is an alpha, so “latest” may resolve to a pre-release; check the npm dist-tags before any trial.
- **Constraint risk:** its documented generation path is Needle Cloud or Needle Engine. Cloud processing is incompatible with your asset-permission rules; a local build path ([@needle-tools/gltf-build-pipeline](https://engine.needle.tools/docs/how-to-guides/optimization/)) exists but I did not evaluate it.
- **Unverified:** memory release of replaced LODs, cancellation, license text.

### D8. Migration candidates (Babylon.js 9, Babylon Lite, PlayCanvas Engine)

- **What would carry over:** glTF assets (Babylon’s own claim for Lite \[V\]), the streaming layer (Babylon.js only) and your asset pipeline. **What would not:** all rendering code, 3DTilesRendererJS custom shaders and materials, post-processing, loaders, and the Three.js-specific BVH integration.
- **What is unknown:** whether any of them lowers your time-to-fly, decoded memory or UHD 620 frame time on your maps. Their published figures are vendor-run, small-scene and CPU-time based (C7), or, for PlayCanvas, about splats.
- **Therefore:** a spike (E7) with falsifiers, not a decision.

### D9. Rejected after inspection

nanite-webgpu and three-virtual-geometry (B3), Godot web export and Bevy (B1). Reasons are in those sections.

## E. Recommended architecture options

**Option 1: improve the current Three.js architecture (WebGLRenderer, no new runtime dependencies).** Audit what is active (E0), add a per-map resource ownership ledger and disposal, set a texture format and resolution budget, batch or instance what E3 shows, pre-warm shaders with compileAsync, move collision building off the main thread. Solves: leaks and map-switch growth, first-use stutter, draw-call overhead. Leaves untouched: whole-map download and parse, decoded-memory size of large maps, collision data size. Cost: low to moderate. Risk: low.

**Option 2: adopt specialised systems around Three.js (recommended).** Option 1, plus an offline *map compiler* (spatial chunks merged by material, meshopt-optimised geometry, KTX2 textures, simplified HLOD proxies, baked BVH, a manifest with encoded and decoded byte sizes), a budgeted streamer (3DTilesRendererJS or a small custom grid streamer, decided by E5), and $0 delivery (R2 or similar, with Cache API/OPFS persistence). Solves: time-to-fly, bounded residency, cancellation, collision prep. Leaves untouched: GPU-bound steady-state cost if E0 shows fill-rate limits; that is addressed by resolution, overdraw and material work, not by any library here. Cost: moderate to high, mostly tooling. Risks: the compiler is real engineering; 3D Tiles fit for non-geospatial maps is untested; every step must preserve asset provenance and Kestrel identifiers.

**Option 3: migrate to another engine.** Babylon.js 9 is the lowest-risk migration (WebGL2 and WebGPU, a streaming layer that carries over). Babylon Lite has the highest claimed upside and the highest risk (WebGPU-only, young, explicitly unstable API). PlayCanvas engine-only is possible, the hosted editor is not (C8). Cost: very high, since rendering, materials, post-processing, loaders and the BVH integration are rewritten. Evidence today: none that it improves your bottlenecks.

**Recommendation.** Option 2 with WebGLRenderer. Reasons: (1) every bottleneck you listed except renderer CPU overhead is decided by data layout and memory ownership, which any engine would still need; (2) the independent evidence on WebGPURenderer is negative for many-mesh scenes (A2) and absent for UHD 620; (3) the engine-swap evidence is vendor-run on small scenes (C7). This is a decision to *not* migrate yet, made with explicit exit conditions, not a loyalty to Three.js.

**What would change this recommendation (falsifiers; thresholds are my proposals, not given by you):**

- If, after E3 and E4, E0 still shows renderer CPU time as the binding constraint, **and** E7 shows another engine at least 30% lower median frame time with equal or better 1% low and lower memory on the UHD 620, reproduced twice on matched scenes, then prototype one map end to end in that engine.
- If E5 shows 3DTilesRendererJS cannot abort fetches, mis-counts bytes, or cannot take your coordinates, build the custom streamer instead.
- If “WebGPURenderer is slower” stops being true (issue #30560 resolved) and E7 shows parity on UHD 620 with batching, reconsider WebGPU for compute-based culling and for Babylon Lite-class options. Also require evidence about how many of your players can run WebGPU at all; I have none.
- If E2 shows BC transcoding on the target CPU delays time-to-fly more than it saves, choose UASTC versus ETC1S per texture class, or lower resolution, before concluding anything about formats.

## F. Prioritised experiment plan

Order: E0 first; then E1 and E2 in parallel; then E3 and E4; then E5 and E6; then E9; E7 last and only when gated. All pass/fail numbers are proposals for you to confirm.

### Protocol shared by every experiment

- **Hardware:** a real Intel i5 with UHD 620 laptop, plugged in, high-performance power mode, five minutes of thermal warm-up, no other heavy apps, fixed Chrome version and GPU driver, with chrome://gpu text saved with each run. RTX, Apple Silicon and software-renderer results do not count toward the target.
- **Rendering:** low settings, a verified 1280×720 drawing buffer (log renderer.getDrawingBufferSize()), adaptive resolution disabled.
- **Matched visuals and simulation:** recorded input replay with fixed seeds so flight behaviour is identical; fixed-pose screenshots compared against the baseline with an agreed threshold plus human review.
- **Routes:** R1 slow 60 s orbit; R2 fast straight corridor at maximum speed across at least three chunk regions; R3 out-and-back (revisit); R4 zig-zag and reversal at chunk boundaries (cancellation); R5 respawn teleports; R6 map switch A→B→A, ten cycles.
- **Two run types, never mixed:** *ordinary timing runs* (no DevTools, no profiler; rAF deltas written to a preallocated array plus a few performance.mark calls, dumped at the end) and *instrumented runs* (Performance panel traces, Long Animation Frames, renderer.info, memory APIs).
- **Cold and warm:** cold is a fresh browser profile (empty HTTP cache, Cache API, OPFS and GPU shader cache); warm is a second load in the same profile; also report the mixed case (shader-cold, assets-warm). At least five cold and ten warm runs; report median, p95, min, max and 1% low (state how it is computed).
- **No production contact.** Local or staging servers only, with network throttling for download tests.

### E0. Baseline, audit of existing systems, bound triage

- **Inputs:** current build (Three.js 0.180.0), the two largest maps and one small map, routes R1–R2.
- **Measure:** (a) inventory of what is active: renderer.info calls, triangles, geometries, textures, programs; per-map encoded versus decoded bytes; per-texture formats; whether workers, caches, LOD and batching actually engage. (b) A *time-to-fly* timeline with marks: click or navigation → manifest → bytes complete → parse → geometry decode → image decode/transcode → collision ready → shader compile → first GPU upload → first frame → “flyable” (input accepted, collision active, no frame over 50 ms in the next 3 s). (c) Bound triage on R2: internal resolution 100%, 75%, 50% (if median frame time falls roughly in proportion it is GPU or fill bound; if flat it is CPU or main-thread bound), then hide half the meshes to measure draw-call sensitivity. (d) Long Animation Frames. (e) Memory at menu, after load, after ten switches.
- **Success:** a table of per-stage milliseconds and bytes, and a ranked cause list that sets the order of everything below. **Failure:** if the harness cannot separate stages, fix the harness before anything else.

### E1. Memory ledger, map switching, soak

- **Inputs:** R6 for ten cycles, then a 90-minute soak looping R2/R3 plus switches.
- **Measure:** a ledger of every created and disposed geometry, material, texture, render target, BVH, worker, ImageBitmap and blob URL per map scope; renderer.info.memory; Chrome task manager and Windows shared GPU memory; heap snapshots after forced GC; measureUserAgentSpecificMemory in an isolated instrumented build only (A7); frame-time p95 drift every five minutes.
- **Success:** resource counts return to baseline after every switch; process memory after GC within +5% of cycle two at cycle ten; no monotonic growth above 2% per hour in the soak; peak transient during a switch no more than 25% above the larger map’s steady state. **Failure:** any monotonic growth; produce the retained-object list.

### E2. Texture pipeline A/B

- **Inputs:** 20 representative textures from the largest map (albedo, normal, packed material, alpha, atlas); variants: current format, KTX2 ETC1S, KTX2 UASTC, resolution caps.
- **Measure:** encoded bytes; transcode milliseconds per texture in the worker pool with 1, 2 and 4 workers on the target CPU; main-thread long frames during upload; GPU bytes (format and mip arithmetic, cross-checked against shared GPU memory change); CPU bytes retained after upload; extensions exposed on the target (BC, ASTC, ETC) logged; visual diff at fixed poses.
- **Success:** GPU bytes at most 50% of baseline with visual diff inside the agreed threshold, no frame over 33 ms attributable to uploads when uploads are rate-limited, and transcode throughput able to fill the working set inside the time-to-fly target. **Failure:** time-to-fly worse than the current decode path, or visible regressions (normal maps are the usual casualty of ETC1S \[H\]).

### E3. Draw-call and culling A/B (includes the Three.js upgrade)

- **Variants (all WebGLRenderer):** (a) current 0.180.0; (b) r186 with the same code; (c) static merge per chunk; (d) BatchedMesh; (e) InstancedMesh2 for repeated props. Routes R2 and R4.
- **Measure:** renderer.info.render.calls and triangles; milliseconds inside render(); frame-time distribution from ordinary runs; culling CPU cost versus instance count; geometry bytes.
- **Success:** median at most 16.7 ms and 1% low at least 50 FPS, or at least 15% median improvement over variant (b) with no visual diff. **Failure:** no gain, or higher memory or pop-in.

### E4. Shader and pipeline pre-warm

- **Variants:** no pre-warm versus compileAsync on a warm-up scene covering every material, light, shadow, fog and post permutation (including variants created by runtime material changes) plus one hidden frame that forces texture uploads.
- **Measure:** renderer.info.programs, compile time, whether KHR\_parallel\_shader\_compile is exposed, long frames in the first 60 s of R1 and R2, with shader cache cold and warm.
- **Success:** zero frames over 50 ms after “flyable” in the first 60 s of R2 on a cold shader cache, with time-to-fly rising by no more than 2 s. **Failure:** spikes persist, which means a permutation is missing from the warm-up set.

### E5. Chunked, budgeted streaming prototype

- **Inputs:** the largest map converted by an offline script into grid chunks merged by material, meshopt-optimised, KTX2-textured, with two or three HLOD levels, baked per-chunk BVH and a manifest. Variants: (i) 3DTilesRendererJS with a generated tileset; (ii) a custom grid streamer meeting D3; (iii) the current whole-map load.
- **Measure:** bytes and time before “flyable”; peak transient CPU memory; steady GPU bytes versus a configured budget; **cancellation** (bytes fetched for chunks never shown; aborted requests visible in the Network panel under R4); **revisit** (cache hits, time to refine under R3); **over-budget** (set the budget to 50% of the natural working set and confirm coarse fallback without out-of-memory); fast-flight pop-in (frames showing coarsest LOD at speed under R2); context-loss recovery via WEBGL\_lose\_context.
- **Success:** cold time-to-fly at most half of baseline; peak memory not above baseline; no frame over 50 ms in R2 or R4; budget respected; aborts observed. **Failure:** whole-file downloads before first use, unbounded transient memory, or main-thread parse stalls.

### E6. Collision preparation

- **Variants:** build on the main thread on load; build in a worker; pre-baked serialised BVH per chunk delivered with transferable buffers.
- **Measure:** main-thread tasks over 50 ms, time to collision-ready, BVH bytes per chunk, and **identical collision outcomes** against recorded flights.
- **Success:** no main-thread task over 50 ms from collision prep and identical contact events. **Failure:** any behavioural difference; do not adopt, since flight behaviour must be preserved.

### E7. Renderer and engine spike (gated)

- **Gate:** run only if E0 shows renderer CPU overhead binding after E3 and E4, or as a scheduled risk check once E5 assets exist. Time-box to two days per engine.
- **Variants:** WebGLRenderer; WebGPURenderer on WebGPU; WebGPURenderer with forceWebGL; Babylon.js 9 on WebGL2 and WebGPU; Babylon Lite; optionally PlayCanvas engine-only. Same chunked assets, same routes, matched visuals (start unlit or simple PBR), same culling approach.
- **Measure:** cold time to first frame; CPU time in the render call; GPU frame time where timestamp queries exist; median and 1% low at 1280×720; memory; first-use spikes; navigator.gpu availability and chrome://gpu on the target.
- **Success (migration worth planning):** at least 30% lower median frame time, better 1% low and lower memory on the UHD 620, reproduced twice. **Failure:** anything less.

### E8. Delivery, resumption and storage

- **Setup:** a local or staging server (and a staging bucket, never production) with throttled bandwidth and latency; cold, warm, offline and interrupted-download runs.
- **Measure:** resume through Range and ETag/If-Range without re-fetching completed chunks; navigator.storage.persist() outcome; Cache API versus OPFS read throughput for chunk files; Brotli versus none for already-compressed assets (KTX2 and meshopt should gain little from extra compression \[H\]); immutable hashed file names; COOP/COEP and CORP behaviour on the bucket; object-operation count per cold session against the R2 free-tier model (A8).
- **Success:** zero bytes re-downloaded on a warm start with unchanged assets, interrupted downloads resume, and operations per cold session fit the free tier. **Failure:** isolation-header breakage of cross-origin assets or quota errors with no recovery path.

## G. Remaining uncertainty

**Independently verified facts \[V\]** (confirmed against primary documentation or release pages today): Three.js r186 is current (8 September 2026) and WebGPURenderer does not support ShaderMaterial or onBeforeCompile; 3DTilesRendererJS provides queues, an LRU byte cache and hard-cap behaviour under Apache-2.0; R2’s free-tier quantities; Chromium and MDN storage quota rules; PlayCanvas free plans are public-only; Godot web export has no WebGPU; Bevy’s webgpu feature overrides webgl2; measureUserAgentSpecificMemory needs cross-origin isolation.

**Source-code observations \[S\]:** KTX2Loader’s worker pool (default four), per-instance transcoder and capability-based target selection; compileAsync’s addition with parallel-compile polling; Dawn’s Intel Gen9/Gen11 workaround; the stated limitations in nanite-webgpu, three-virtual-geometry and Hilo3d documents.

**External reported measurements \[R\]:** all forum benchmarks (C1–C3), the render-bundle and BatchedMesh PR figures, the Babylon Lite vendor figures, web3dsurvey extension rates, and the HSF memory-growth report. None was reproduced by me.

**Engineering inferences \[I\]:** BC targets and texture byte arithmetic; the R2 operations estimate; default KTX2 workers competing with the render thread on a four-thread i5; the conclusion that engine choice does not address most listed bottlenecks.

**Untested hypotheses \[H\]:** that your maps are CPU-bound by draw calls (E0 decides); that 3D Tiles fits non-geospatial maps; that normal maps degrade under ETC1S; that extra compression of KTX2 or meshopt files is wasteful.

**Not checked at all:** your repository and which existing systems are effective; any UHD 620 WebGPU behaviour or the share of your players with WebGPU; Reddit and Hacker News; the current status of three.js issue #30560; 3DTilesRendererJS unload and abort source; InstancedMesh2 and gltf-progressive internals and licences; PlayCanvas and Babylon runtime code; asset licences on source sites; R2 signup and overage terms; Unity Web beyond secondary summaries; whether r186’s GLTFLoader decodes KHR\_meshopt\_compression.

**Suggested first step when you have repository access:** read AGENTS.md and docs/AI-QUICKSTART.md, then run E0 on the largest imported map. Its output decides whether E3 or E5 comes first.
