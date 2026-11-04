# Parvoz Drone Simulator: Browser 3D Technology Investigation (Stage 1)

*Compiled 2026-10-25. Every "retrieved" date is 2026-10-25 unless stated. Research only: no game code, dependencies, builds, deployments, accounts or production systems were touched.*

## 0. Limits of this investigation (read first)

1. **No repository access.** I could not open `C:\DroneLiftoffUz` or the private GitHub repo, so I did not read `AGENTS.md` or `docs/AI-QUICKSTART.md`. Nothing below claims to know what your code already does or that a technology is compatible with it. Section 9 contains a one-day audit that answers "what is active and effective" before anything is adopted.
2. **I measured nothing.** No code was run and no hardware was available. "Documented" below means *checked against a primary page on the retrieval date* (release notes, official docs, issue/PR text, package source listings). It does not mean benchmarked.
3. **Source inspection was partial.** I read the byte-budgeted eviction code of 3d-tiles-renderer (as a published package listing), copies of `KTX2Loader`, and PR/issue text for `BatchedMesh`. I did not clone or step through any repository.
4. **Channel gaps.** My search tooling surfaced three.js, Babylon.js and PlayCanvas forums, GitHub issues/PRs, Hacker News and some engineering write-ups. It did **not** surface usable Reddit threads, browser bug-tracker entries (crbug, Bugzilla) or conference talks. Those channels are not covered and should not be assumed to agree with this report.
5. **Not investigated:** Wonderland Engine, Cocos Creator, Defold, Galacean, Orillusion, xeokit, Potree, Filament/WASM. Reason: time, and a low prior that any of them preserves your Three.js flight code at $0. They are listed in section 4.9 so the omission is visible.

**Evidence tags used throughout**

| Tag | Meaning |
| --- | --- |
| **\[D\]** | Documented: stated by a primary source I read today |
| **\[S\]** | Source observation: seen in source code or PR diff text |
| **\[R\]** | Reported measurement by a third party (not reproduced) |
| **\[I\]** | Engineering inference (reasoning, not evidence) |
| **\[H\]** | Untested hypothesis; needs an experiment |

---

## 1. Bottom line

**Recommended direction: keep Three.js, keep `WebGLRenderer` as the default, and replace the loading/residency architecture around it.** Do not migrate engines now, and do not adopt `WebGPURenderer` as a performance fix without an A/B on the UHD 620 target.

The concrete architecture to prototype:

1. **Spatial tiles with HLOD**, streamed on demand with byte budgets, priorities and cancellation. The only maintained open-source system I found that implements these primitives for Three.js is [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS) (Apache-2.0). If it fails the prototype, copy its residency design into an in-house manager and keep the tile format.
2. **A build-time asset pipeline**: split, simplify, merge per tile, meshopt-compress geometry, and encode textures as KTX2 with mip chains.
3. **A residency manager with separate budgets** for encoded bytes in flight, decoded CPU bytes, GPU bytes, decode concurrency and per-frame upload milliseconds.
4. **Precomputed collision** (serialized BVH per tile) so flight never waits for worker generation.
5. **Static batching** (merge per tile, `BatchedMesh` or `InstancedMesh2` for props) to cut draw calls on whichever renderer wins the A/B.
6. **A repeatable test harness** on the real UHD 620 laptop, with instrumented runs kept separate from timing runs.

**What this changes about priorities.** Your complaints (memory, map download, load time, first-use hitches) are mostly *delivery and residency* problems. Renderer choice mostly affects steady-state CPU cost per draw. The evidence I found says that cost is *not* automatically lower on WebGPU in Three.js or Babylon.js (section 2, finding 1).

---

## 2. The strongest findings

**Finding 1: WebGPU is not a performance fix by itself, and in Three.js it can regress many-mesh scenes.**

- A three.js forum post dated 2026-05-30 (r183, CAD viewer with 4,000 meshes and about 8M triangles) reports `WebGPURenderer` costing about 2x the CPU time per `render()` and a 5-10x slower cold first frame than `WebGLRenderer`, and the same on the `forceWebGL` backend. \[R\] [thread #91904](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904). Replies advised staying on `WebGLRenderer`; I saw no maintainer resolution in the retrieved text.
- A r181 thread reports 2-4x lower FPS on WebGPU and 5-10x lower with `forceWebGL`, and a respondent describes a known many-draw-call issue tied to per-object uniform buffers that maintainers are still trying to improve. \[R\] [thread #87939](https://discourse.threejs.org/t/webgpu-performance-issue/87939).
- Babylon.js's team independently explains why: in WebGPU each mesh needs roughly 6-10 API calls (index buffer, vertex buffers, pipeline, bind groups, draw) versus a single VAO bind in WebGL2, so tens of thousands of draws are not sustainable. \[D\] [Babylon forum](https://forum.babylonjs.com/t/why-webgpu-backend-is-slower/24091). That post is old; Babylon's mitigation (snapshot rendering) is WebGPU-only, restricted, and has open usage problems in 2025 threads ([example](https://forum.babylonjs.com/t/how-to-enable-snapshot-rendering-with-webgpu/52734)).
- Three.js's own manual says `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile()` modifications are unsupported in `WebGPURenderer`. \[D\] [manual](https://threejs.org/manual/en/webgpurenderer). If your game has custom GLSL, this is a porting cost, not just a flag.
- Caveat: all of these are scenes with thousands of separate meshes. A scene that is already batched may behave differently. \[I\]

**Finding 2: Memory ownership and "playable" time are residency problems, and streaming primitives exist for Three.js.**

- 3d-tiles-renderer keeps an LRU cache with item-count and byte limits, evicts unused tiles by priority, and treats the limits as hard caps: when the visible set does not fit, refinement stops and coarser tiles remain rather than loading more. \[D\] [README gotchas](https://github.com/NASA-AMMOS/3DTilesRendererJS), [LRUCache docs](https://gkjohnson.github.io/tools/docs/3d-tiles-renderer/core/LRUCache/).
- Its `UnloadTilesPlugin` frees GPU data for hidden tiles while keeping the parsed CPU copy until cache eviction, and it exposes an estimated GPU byte count. \[D\] [docs](https://gkjohnson.github.io/tools/docs/3d-tiles-renderer/three/plugins/UnloadTilesPlugin.md). That is the "separate CPU and GPU residency" design you need.
- Redundant loads are cancelled through abort signals (changed from an older index scheme in v0.4.1), and several renderers can share one cache and one download priority queue. \[D\] [v0.4.1 notes](https://github.com/NASA-AMMOS/3DTilesRendererJS/releases/tag/v0.4.1).

**Finding 3: Texture upload, not shader compile, is a likely first-use hitch, and `compileAsync()` does not cover it.**

- A three.js forum user with a first-person camera saw seconds of stutter after load; `compileAsync()` did nothing, while rendering each mesh once off-screen removed the lag. Respondents suspected texture and geometry upload rather than shader compile. \[R\] [thread #86191](https://discourse.threejs.org/t/reduce-first-render-lag-renderer-compileasync-is-not-doing-anything/86191).
- A three.js issue reports roughly 8 s blocked on the main thread uploading about 7x16k and 8k textures; KTX2 cut `gpuSize` about 10x but upload remained a main-thread cost. \[R\] [issue #28101](https://github.com/mrdoob/three.js/issues/28101).
- The `compileAsync()` PR itself names texture uploads and shader compiles as the two longest blocking operations when an object first appears. \[D\] [PR #19752](https://github.com/mrdoob/three.js/pull/19752).

**Finding 4: Smaller files do not equal lower memory.** Meshopt/Draco shrink transfer; decoded vertex attributes are the same size on the GPU (a single-author test confirms attributes were identical after decode, \[R\] [DEV article](https://dev.to/alicia_lu/threejs-glb-loading-cache-decode-and-the-first-gpu-frame-51kf)). KTX2/Basis is the exception: it stays block-compressed on the GPU, so it reduces *GPU* bytes too. \[D\] [Three.js KTX2Loader docs](https://threejs.org/docs/pages/KTX2Loader.html). PNG/JPEG are fully decoded on upload. \[D\] [Utsubo tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips).

**Finding 5: Nanite-style virtual geometry does not fit a UHD 620 / WebGPU-optional target.** `three-virtual-geometry` needs WebGPU and r180+ ([repo](https://github.com/elad12390/three-virtual-geometry)). A Hacker News thread on a Nanite-in-three.js demo reports about 1 fps on one commenter's integrated-graphics work PC and 20-40 fps on a decade-old Celeron integrated GPU (hardware details thin, so this conflict is unresolved). \[R\] [HN](https://news.ycombinator.com/item?id=42974461). WebGPU also still lacks standard multi-draw-indirect; Chrome exposes it only as an experimental flagged feature. \[D\] [Chrome blog](https://developer.chrome.com/blog/new-in-webgpu-131).

**Finding 6: No complete engine alternative offers streamed mesh worlds, $0 cost, and your flight code.**

- PlayCanvas's streaming work is Gaussian-splat specific ([v2.23.0 notes](https://radiancefields.com/playcanvas-engine-v2.23.0-returns-gaussian-splat-lod-to-distance-only-selection)); its hosted editor needs a paid plan for private projects ([plans](https://playcanvas.com/plans)).
- Godot's web export is WebGL 2 only per its docs ([4.5 docs](https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html)).
- Unity 6.2/6.3 docs still label WebGPU experimental ([docs](https://docs.unity3d.com/Manual/web-graphics-apis-intro.html)); a secondary report says 6.6 (2026-09-01) made it supported but opt-in ([Cinevva](https://app.cinevva.com/news/2026-09-01-unity-6-6-webgpu-production)).
- Any of these means rewriting flight code while "preserve existing flight behavior" is a hard constraint, with no independent iGPU benchmark in the evidence that shows a better result. \[I\]

**Finding 7: Several "easy win" claims in circulation are single-source.** Example: a repo claiming p99 21.5 to 13.7 ms, texture VRAM 800 to 120 MB, heap 1.5 to 0.87 GB ([iniGlowee](https://github.com/iniGlowee/threejs-game-optimization)) gives no hardware, no reproduction harness I could see, and one author. Treat as hypothesis generation, not proof. \[R\]

**Finding 8: Your Three.js version is six releases behind, with visual-change risk.** You use 0.180.0; r186 is current (npm 0.186.0 published 2026-09-08 per [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed); the GitHub releases listing shows a 24 Sep stamp for r186, a discrepancy I could not resolve; a 0.186.1 patch is in use in a [Oct 2026 article](https://dev.to/alicia_lu/threejs-glb-loading-cache-decode-and-the-first-gpu-frame-51kf)). Notable between r180 and r186 \[D, secondary\]: shadow-map behavior changed (r182, `PCFSoftShadowMap` removed in r186), PBR energy conservation reworked (r186), the deprecated `BatchedMesh` multi-draw instancing path was removed (r184), `Clock` is deprecated in favor of `Timer` (r183). Pin one version for all experiments so that engine-version effects do not contaminate comparisons.

---

## 3. The problems, kept separate

The table maps each bottleneck to what addresses it and what it leaves untouched. **Encoded bytes, decoded CPU bytes, JS/WASM heap, GPU resources, browser-process memory and disk-cache storage are six different numbers.**

| Problem | Addressed by | Does NOT fix |
| --- | --- | --- |
| Download size / transfer time | Tiles (fetch only what's near), meshopt/Draco, KTX2 ETC1S, Brotli/HTTP caching, CDN with free egress | Decoded RAM, GPU size, time to upload |
| Parse and scene construction | Fewer, larger objects per tile (merge); tile granularity; moving parse off the main thread where possible | Network, GPU memory |
| Geometry decode | Meshopt (WASM) per tile; quantization to keep attributes small | Texture cost; draw calls |
| Image decode / transcode | KTX2 in worker pool (transcode, no full RGBA decode) | Main-thread upload; non-KTX2 images still decode to full RGBA |
| Collision preparation | Precomputed serialized BVH per tile ([three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) serialize/deserialize) | Visual memory |
| Shader / pipeline compile | `compileAsync()` (uses `KHR_parallel_shader_compile`), fewer unique material programs | Texture/geometry upload stalls |
| GPU upload | Per-frame upload budget, `initTexture`-style warming spread over frames, compressed textures | Network, steady-state cost |
| Time until the player can fly | Residency manager that gates "flyable" on collision + near-ring tiles only | Long-session stability |
| Steady CPU frame time | Fewer draw calls (merge, batch, instance), cheaper per-frame JS, stable matrices | GPU fragment cost |
| Steady GPU frame time (UHD 620 at 720p) | Cheaper materials, less overdraw, shadow and post-process cuts, fewer pixels | CPU-bound scenes |
| Long frames / pacing | Budgeted decode/upload/GC, no per-frame allocation | Average-FPS problems |
| Long-session memory and map-switch peaks | Ownership registry, refcounts, explicit disposal, release of CPU copies, cancellation | A smaller file format |

Two caveats that matter for planning:

- **`dispose()` frees GPU objects but not everything.** `ImageBitmap` sources must be closed by application code, and `renderer.info.memory` still reports objects after a full cleanup, by design. \[D\] [three.js manual](https://threejs.org/manual/en/how-to-dispose-of-objects.html). Do not use `renderer.info` as proof of release.
- **Dropping CPU copies after upload has a cost.** `BufferAttribute.onUpload()` exists for exactly this purpose ([docs](https://threejs.org/docs/api/en/core/BufferAttribute.html)), but a forum answer notes WebGL context loss needs those arrays to rebuild resources ([thread](https://discourse.threejs.org/t/how-to-free-cpu-side-memory-for-geometry-texture-already-on-gpu/70602)). With tiles re-fetchable from a local cache, re-fetching after context loss is an acceptable trade. \[I\]

---

## 4. Ecosystem comparison by problem

### 4.1 Renderers and complete engines

| Candidate | Version / date seen | License / cost | Backends | Relevant strength | Decision |
| --- | --- | --- | --- | --- | --- |
| **Three.js** | r186 (0.186.0, 2026-09-08 per Utsubo) | MIT, $0 | `WebGLRenderer`; `WebGPURenderer` with WebGL 2 fallback | Already integrated; r184 added node materials on `WebGLRenderer` through a compatibility layer \[D, secondary\] | **Keep.** `WebGLRenderer` default; WebGPU as A/B only |
| **Babylon.js** | 9.0 on 2026-03-26 ([announcement](https://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0)) | Apache-2.0 (from project knowledge, not re-verified) | WebGL 2 + WebGPU | Thin instances, frozen meshes, clustered lighting on both backends, Frame Graph; 3D Tiles integration documented ([guide](https://doc.babylonjs.com/features/featuresDeepDive/geospatial/loading3dTiles/)) | **Only credible migration candidate.** Spike only if E3 shows renderer CPU dominates |
| Babylon Lite | 1.33.0 (Oct 2026) | not checked | WebGPU only | Small bundle ([docs](https://doc.babylonjs.com/lite/02-feature-comparison/)); no classic `InstancedMesh` ([docs](https://doc.babylonjs.com/lite/01-getting-started/)) | **Reject:** no WebGL 2, young |
| PlayCanvas engine | 2.23.0 (2026-10-02) | Engine MIT; Editor free tier is public-projects only ([plans](https://playcanvas.com/plans)) | WebGL 2 + WebGPU | Mature web engine; splat LOD streaming | **Reject for now.** Public free projects conflict with your provenance constraints; paid private plans break the $0 budget |
| Unity | 6.6 (2026-09-01, reported) | not researched | WebGL 2 default; WebGPU opt-in (reported) | GPU Resident Drawer / GPU occlusion culling need WebGPU (reported) | **Reject:** full rewrite; flight behavior risk; large builds |
| Godot | 4.5 docs; 4.7 reported June 2026 | MIT | WebGL 2 only (docs) | Small tooling | **Reject** |
| Godot WebGPU fork | May 2026 beta, single developer, AI-assisted per its README | MIT-style fork | WebGPU only | Claims up to 5x vs WebGL on particle benchmark \[R\] ([repo](https://github.com/dwalter/godotwebgpu)) | **Reject:** unreviewed fork |
| Bevy | docs-level only | MIT/Apache | Cargo feature picks `webgl2` **or** `webgpu` ([features](https://docs.rs/crate/bevy/latest/source/docs/cargo_features.md)) | Rust ECS | **Reject:** rewrite; renderer not threadsafe on wasm per [Bevy issue #4078](https://www.github.com/bevyengine/bevy/issues/4078) |
| Hilo3d 2.0 alpha | alpha.8 | not checked | WebGPU | Asset-streaming addon; its own doc says physical-device evidence is pending ([doc](https://hilo3d.js.org/docs/media/ASSET_STREAMING.md)) | **Watch only** |

Browser platform context: caniuse data pulled 2026-10-09 puts WebGPU at 85.72% full support and WebGL 2 at 96.44% of global traffic ([report](https://creategame.ai/blog/are-games-moving-to-the-web/)) \[R, aggregate\]. That says nothing about a UHD 620 under your Chrome/driver combination. **I found no source confirming WebGPU behavior on UHD 620 specifically. \[H\]** Note that `WebGPURenderer` falls back to its WebGL 2 backend *silently* ([note](https://agent-browser.dev/webgpu)), so every experiment must log which backend actually ran.

### 4.2 Large-map delivery, streaming, LOD and virtual geometry

| Candidate | What it actually does | Decision |
| --- | --- | --- |
| **3d-tiles-renderer** (NASA-AMMOS, Apache-2.0, 2.4k stars, supports Three.js and Babylon.js) | Loads `tileset.json`, selects tiles by screen-space error, budgeted LRU, abort-based cancellation, shared priority queue, fade plugin, GPU-unload plugin | **Prototype (E2)** |
| Obj2Tiles (OpenDroneMap) | OBJ to 3D Tiles: split, QEM decimation into LODs, texture atlas repack, per-LOD texture scale, octree mode, `.3tz` output ([repo](https://github.com/OpenDroneMap/Obj2Tiles)) | **Pipeline candidate;** built for photogrammetry, not multi-material game scenes |
| Mesh2Tile (ISPRS 2026) | Adaptive octree tiling OBJ to 3D Tiles for game engines ([paper](https://isprs-archives.copernicus.org/articles/XLIX-B2-2026/485/2026/isprs-archives-XLIX-B2-2026-485-2026.pdf)) | **Read for method;** not evaluated |
| Needle `gltf-progressive` | Per-mesh and per-texture LOD streaming through a glTF extension ([docs](https://engine.needle.tools/docs/gltf-progressive/)) | **Conditional.** Latest tag is **3.6.0-alpha.3** ([changelog](https://engine.needle.tools/docs/reference/changelogs/gltf-progressive)); LOD generation is advertised through Needle Cloud, a third-party upload path (see section 8 permission gate) |
| `three-virtual-geometry` | Cluster LOD and GPU culling, WebGPU only | **Reject** (finding 5) |
| In-house residency manager | Same primitives without the 3D Tiles format | **Fallback** if E2 fails |
| Virtual texturing | Three.js issue #34733 (open 2026-10) proposes it; the author had not yet measured the Three.js implementation ([issue](https://github.com/mrdoob/three.js/issues/34733)) | **Reject:** not shipped |

### 4.3 Geometry and texture pipeline

| Candidate | Role | Decision |
| --- | --- | --- |
| meshoptimizer v1.0+ and `gltfpack`; glTF-Transform | Simplification, meshlet and cluster-LOD building (`clusterlod.h`), vertex/index compression (`EXT_meshopt_compression`) ([releases](https://github.com/zeux/meshoptimizer/releases), [v1.0 summary](https://www.x-cmd.com/blog/251217/)) | **Adopt** for build pipeline |
| Draco | Geometry compression | Secondary; meshopt preferred for decode speed \[I\] |
| KTX2 + Basis Universal v2.1 (2026-02-24) | ETC1S/UASTC/XUASTC LDR, transcodable to BC7 and ASTC ([release notes](https://github.com/BinomialLLC/basis_universal/wiki/Release-Notes)) | **Adopt.** Whether Three.js's bundled transcoder handles XUASTC is **unverified** |
| Texture atlases, material consolidation | Fewer materials, fewer state changes | **Adopt** per tile |

### 4.4 Instancing, batching, visibility

| Candidate | Notes | Decision |
| --- | --- | --- |
| `BatchedMesh` (core) | On `WebGPURenderer` it does **not** use multi-draw ([PR #27937](https://github.com/mrdoob/three.js/pull/27937)); on WebGL it uses `WEBGL_multi_draw` or a draw loop fallback ([PR #27178](https://github.com/mrdoob/three.js/pull/27178)) | **Use** for static props |
| `InstancedMesh2` and `batched-mesh-extensions` (single maintainer) | CPU BVH frustum culling, per-instance LOD and visibility; per-instance uniforms are `WebGLRenderer`-only ([npm](https://www.npmjs.com/package/@three.ez/batched-mesh-extensions)) | **Candidate** for props |
| Indirect / GPU-driven draws | Needs WebGPU compute; no standard multi-draw-indirect | **Defer** |
| Occlusion culling | Not evaluated in depth | **Open** |

A Babylon forum participant states that ANGLE implements `WEBGL_multi_draw` as a loop on D3D11, so gains come mostly from bind-once ordering ([thread](https://forum.babylonjs.com/t/webgl-multi-draw-extension/47345)). Chrome on Windows normally runs ANGLE over D3D11. \[R, single post\] If true on your target, multi-draw does not reduce driver draw calls, only JS-to-C++ overhead. **Unverified; test in E3.**

### 4.5 Shader and pipeline prewarming

`WebGLRenderer.compileAsync()` uses `KHR_parallel_shader_compile` ([docs](https://threejs.org/docs/pages/WebGLRenderer.html)). In r184, `compileAsync()` on `WebGPURenderer` stopped blocking rendering \[D, secondary\]. Neither warms texture or geometry uploads (finding 3).

### 4.6 Workers, WASM, collision

- KTX2Loader uses a worker pool, requires `detectSupport(renderer)`, and warns if several loader instances exist ([source listing](https://app.unpkg.com/three-stdlib@2.35.15/files/loaders/KTX2Loader.js)). \[S\]
- three-mesh-bvh builds BVHs in `GenerateMeshBVHWorker`, or in parallel with `SharedArrayBuffer` (`ParallelMeshBVHWorker`), and can serialize/deserialize for transfer or storage ([docs](https://gkjohnson.github.io/tools/docs/three-mesh-bvh/SerializedBVH.md)). Parallel generation needs cross-origin isolation headers. \[I\]

### 4.7 HTTP delivery, caching, storage

- Cloudflare R2 free tier: 10 GB-month storage, 1M Class A and 10M Class B operations per month, zero egress fees, Standard storage only ([Cloudflare docs text](https://developers.cloudflare.com:8443/r2/llms-full.txt)). \[D\] Many small tile GETs count as Class B reads, which the free tier tolerates at moderate scale. \[I\]
- Cloudflare Pages: per-file 25 MB and 20,000 files on free ([summary](https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/)). \[R, secondary\] Keep every tile far below this.
- Browser storage: Cache Storage for network resources, OPFS for file-like content, `navigator.storage.persist()` to avoid best-effort eviction ([web.dev](https://web.dev/articles/storage-for-the-web), [MDN](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)). \[D\]
- Content-hashed tile names with long-lived immutable cache headers \[I\].

### 4.8 Profiling and diagnostics

- [webgl-memory](https://github.com/greggman/webgl-memory) and [webgpu-memory](https://github.com/greggman/webgpu-memory) report buffer/texture bytes at API level (not driver-resident). \[D\]
- `performance.measureUserAgentSpecificMemory()` needs cross-origin isolation, is Chromium-only, and measures JS/DOM/worker memory, not GPU ([web.dev](https://web.dev/articles/monitor-total-page-memory-usage)). \[D\]
- Chrome Task Manager has an optional GPU Memory column ([guide](https://www.superchargebrowser.com/library/which-browser-uses-least-gpu-memory-2026.md)). \[R, secondary\]
- `EXT_disjoint_timer_query_webgl2` reaches about 86% of Windows and 72% of Chrome-family reports ([web3dsurvey](https://web3dsurvey.com/webgl2/extensions/EXT_disjoint_timer_query_webgl2)); on ANGLE D3D11, only elapsed-time queries work, not timestamps ([Chromium review](https://codereview.chromium.org/1687353002)). Check availability on the actual UHD 620 machine. \[D/H\]

### 4.9 Free assets, authoring, and items not investigated

I did not research asset libraries in this pass. From general knowledge only (verify each license before use): CC0 sources such as Poly Haven, ambientCG, Kenney and Quaternius exist; Blender plus glTF export plus the pipeline above is the usual $0 workflow. \[I, unverified\] **Not investigated:** Wonderland Engine, Cocos Creator, Defold, Galacean, Orillusion, xeokit, Potree, Filament.

---

## 5. Community and independent evidence

Each entry lists date, source, hardware/version where known, the claim, reproduction quality, resolution, and relevance. Several posts from one developer count once. None of these are my measurements.

**5.1 Three.js forum: WebGPURenderer slower on many-mesh scenes (the key conflicting evidence)**

- *Source and date:* [thread #91904](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904), 2026-05-30, three.js r183, CAD/BIM viewer, 4,000 meshes, about 8M triangles. GPU/browser not captured in my retrieval.
- *Claim:* about 2x CPU time inside `render()` and a 5-10x slower cold first frame versus `WebGLRenderer`; identical on the WebGPU and `forceWebGL` backends, which suggests a renderer-class cost rather than a backend cost.
- *Reproduction:* table of numbers in the post; I did not see a linked live repro in the retrieved text.
- *Resolution:* none seen. Other users advised sticking with `WebGLRenderer`, and one called `WebGPURenderer` a few years old with bugs and edge cases.
- *Relevance:* high if your maps contain thousands of separate meshes. Low if tiles are merged.
- **Corroboration (independent posters, same direction):** [#87939](https://discourse.threejs.org/t/webgpu-performance-issue/87939) (r181, StackBlitz demo, WebGPU 2-4x slower, `forceWebGL` 5-10x slower; a respondent says the many-draw-call issue is real and that per-object uniform buffers are the constraint maintainers are working around), [#77629](https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629) (about 2x slower for non-instanced meshes; 1M meshes dropped fps 4x; a respondent attributes it to `setBindGroup`/`writeBuffer` churn), and an older [r154 report](https://discourse.threejs.org/t/webgpu-performance-significantly-slower-rendering-non-instanced-geometries/54135) (5,000 cubes about 20 fps vs about 130; later release said to improve it). These are separate people, so the pattern is real across versions, but each is a synthetic or specific scene. **Historical vs current:** the r154 case is historical; the r183 case is current as of May 2026.
- **Counter-evidence:** a maintainer-adjacent reply in [#86635](https://discourse.threejs.org/t/understanding-about-webgpurenderer/86635) says swapping the renderer alone should not be expected to speed things up, and that instancing/batching stays important. That agrees with the above rather than contradicting it. I found no independent post showing a *large* iGPU frame-time win from switching a streamed, batched game scene to `WebGPURenderer`. Absence of evidence, not evidence of absence. \[H\]

**5.2 Babylon.js team on WebGPU per-mesh cost**

- *Source:* [Babylon forum, "Why WebGPU backend is slower?"](https://forum.babylonjs.com/t/why-webgpu-backend-is-slower/24091) (date not captured; early WebGPU era). A Babylon maintainer explains 6-10 API calls per mesh and introduces snapshot rendering via render bundles.
- *Resolution:* snapshot rendering exists but is WebGPU-only and restricted. A later forum user could not enable it without buffer errors ([thread](https://forum.babylonjs.com/t/how-to-enable-snapshot-rendering-with-webgpu/52734)); a sprite-based user found fast snapshot mode does not support sprites ([thread](https://forum.babylonjs.com/t/questions-about-using-sprite-with-snapshotrendering/60262)). The Babylon best-practices thread recommends thin instances, `freezeWorldMatrix()` on static meshes, and snapshot rendering ([thread](https://forum.babylonjs.com/t/best-practices-for-optimizing-babylon-js-scenes-not-just-on-lower-end-devices/58688)).
- *Relevance:* an independent engine team describing the same API-call arithmetic as Three.js forum participants. Historical for the exact numbers; the structural point (WebGPU moves cost from per-draw driver work to per-draw JS API calls) remains.

**5.3 First-use hitches are texture/geometry upload (not only shader compile)**

- [Three.js forum #86191](https://discourse.threejs.org/t/reduce-first-render-lag-renderer-compileasync-is-not-doing-anything/86191) (date not captured; adjacent to Sept 2025 threads): `compileAsync()` had no visible effect; rendering each mesh once removed the stutter; two respondents suspect upload rather than compile.
- [Issue #28101](https://github.com/mrdoob/three.js/issues/28101): about 8 s blocked on the main thread for 7x16k and 8k textures on controlled hardware; KTX2 reduced GPU size about 10x; the reporter wants non-blocking or tiled upload. A respondent notes Three.js can only offer what the browser/WebGPU APIs allow.
- *Reproduction:* partial (screenshots and numbers, no minimal repro in my retrieval). *Resolution:* no upstream non-blocking upload API found.
- *Relevance:* high. It reframes "first-use stutter" from a shader-only problem to a resource-admission problem.

**5.4 Nanite-style demos on integrated graphics (unresolved conflict)**

- [HN item 42974461](https://news.ycombinator.com/item?id=42974461) (Feb 2025, 625 days before retrieval): one commenter reports about 1 fps on a work PC with integrated graphics; another reports about 20 fps near-field and 40 fps with heavy far-field LOD on a late-2010s Celeron iGPU. Hardware models, browsers and resolutions are not given.
- *Resolution:* none. A commenter also notes virtual geometry in native engines relies on 64-bit atomics that WebGPU does not offer.
- *Relevance:* medium. The spread (1 vs 20-40 fps) is exactly why a UHD 620 measurement is required rather than assumed.

**5.5 Shipped or inspectable Three.js projects**

- [CrazyTaxi rebuilt in Three.js](https://agentiloop.ai/blog/making-crazy-taxi-in-threejs): 13,779 meshes produced 3,000-4,500 draw calls per frame; fix was static merging per 4,000-unit cell plus a 374-texture atlas; KTX2 release 51 MB versus 551 MB of PNG/JPEG. \[R\] Single author, hardware not captured, project appears agent-assisted; the technique matches other sources but the numbers are not independent.
- [iniGlowee threejs-game-optimization](https://github.com/iniGlowee/threejs-game-optimization): claims p99 21.5 to 13.7 ms, texture VRAM about 800 to 120 MB, heap about 1.5 GB to 0.87 GB. \[R\] Single author, no hardware, no harness I could see.
- [Meshopt GLB first-frame test](https://dev.to/alicia_lu/threejs-glb-loading-cache-decode-and-the-first-gpu-frame-51kf) (Oct 2026): Three.js 0.186.1, Chromium 155, Windows, RTX 5070 Ti; one 6,056-triangle plant; file shrank 59.2% with meshopt and decoded attributes were identical; fresh-URL first-frame median fell 35.7 to 17.6 ms over 20 trials. \[R\] **Does not confirm your target hardware.** Useful as a measurement method: it separates fetch, parse/decode, compile and GPU-completed first frame.

**5.6 Vendor and aggregator claims (low weight)**

- [PlayCanvas v2.19](https://radiancefields.com/supersplat-ships-compute-based-webgpu-rendering-and-automatic-streamed-lod): 35M-splat scene 13 to 76 fps on WebGPU vs WebGL 2 (PlayCanvas CEO announcement as reported). Gaussian splats only; not meshes.
- [Utsubo studio posts](https://www.utsubo.com/blog/threejs-2026-what-changed) and [Cinevva engine-comparison posts](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison): useful for release dates and feature lists; both are studios/vendors with products to sell, and Cinevva's comparison tables score its own engine. I used them for dates only and labelled them secondary.
- [Godot WebGPU fork](https://github.com/dwalter/godotwebgpu): benchmark claims (up to 5x vs WebGL on GPU particles, about 80% of native) come from the fork's author, undated reviewers. Not usable as evidence.

---

## 6. Deep evaluation of finalists

### 6.1 3d-tiles-renderer (primary streaming candidate)

**Problem it solves.** On-demand, error-driven loading of a hierarchical tile set so that the whole map is never downloaded, parsed or resident at once.

**Version, license, maintenance.** Apache-2.0, Caltech/JPL copyright. I confirmed package listings for 0.4.19 ([source](https://app.unpkg.com/3d-tiles-renderer@0.4.19/files/src/core/renderer/utilities/LRUCache.js)) and an API document under 0.5.0 ([API](https://unpkg.com/3d-tiles-renderer@0.5.0/src/core/renderer/API.md)); the repository shows 2,986 commits and about 100 open issues ([GitHub](https://github.com/NASA-AMMOS/3DTilesRendererJS)). **I could not confirm which version npm's `latest` tag points to, or whether it is stable vs pre-release.** Check `npm view 3d-tiles-renderer dist-tags` before pinning. It now supports Three.js, Babylon.js and react-three-fiber ([README](https://github.com/NASA-AMMOS/3DTilesRendererJS)), which preserves optionality if you later spike Babylon.

**How it works (architecture).** A `TilesRenderer` owns a tile tree from `tileset.json`, traverses it each frame against one or more cameras using a screen-space error target, queues downloads through a priority queue, parses model content with Three.js loaders, and adds visible tiles to a `group`. Tile content lives in an `LRUCache`. \[D\]

**Streaming claim check (does "streaming" mean what you need?)**

| Question | Finding | Tag |
| --- | --- | --- |
| Avoids downloading and decoding the whole map before first use? | Yes by design: only the root tileset and tiles selected for the current view are requested | D |
| Prioritization | Download priority queue; eviction order configurable via `unloadPriorityCallback`; default eviction is by last use | D |
| Cancellation | Redundant loads cancelled via abort signals (v0.4.1 replaced older index logic) | D |
| Concurrency | A shared `PriorityQueue` limits parallel work; **default concurrency values not verified** | D / unverified |
| Unloading | LRU eviction with min/max item counts (defaults 6,000 / 8,000) and min/max bytes (defaults about 322 MB / 430 MB); evicts 5% of excess per pass by default | D |
| Eviction code behavior | Loop continues while cached bytes exceed the max or item count exceeds max; items both in-use and loaded are skipped | S |
| GPU vs CPU residency | `UnloadTilesPlugin` frees GPU data for hidden tiles and keeps CPU data until eviction; `estimatedGpuBytes` vs `lruCache.cachedBytes` | D |
| Behavior when working set exceeds budget | **Hard cap:** no new tiles load; coarser tiles stay visible and refinement stops. Raise `maxBytesSize` or `errorTarget`. Monitor `cachedBytes` and `isFull()` | D |
| Shared resources | Several renderers can share one `LRUCache` and `PriorityQueue` | D |
| Byte accounting | Documented as working only with Three.js r166+; **how compressed (KTX2) texture bytes are estimated is unverified** | D / unverified |
| Transient memory during load | Not documented; parse buffers, transcoder worker memory and decoded CPU copies are not budgeted by the cache | unverified |
| Where parse runs | Uses Three.js loaders; GLB JSON/accessor parsing is generally main-thread; **must be profiled** | H |

**Integration effort with your game.** Tile set generation is the main cost. Tools: Obj2Tiles (OBJ only, photogrammetry-oriented: splitting, quadric decimation, atlas repack; per-LOD texture scaling and octree mode are documented; `.3tz` archive output) and a custom glTF-Transform/gltfpack script that you write yourself. Renderer integration is smaller: add `tilesRenderer.group` to the scene, call `setCamera`, call `update()` each frame, register KTX2/meshopt loaders on the manager, and hook `onLoadModel`/`onDisposeModel` for materials and collision. The README states glTF decoding extensions are added via the loader manager. \[D\]

**Asset requirements.** 3D Tiles content (glTF/GLB tiles in current spec; legacy b3dm). Non-geospatial game maps need a local coordinate frame; an Obj2Tiles example takes lat/lon/alt, so confirm local-origin handling in the prototype. \[H\]

**Known limitations and failure cases.**

- Tile count and per-tile draw calls: each tile's meshes are still separate draw calls unless merged in the build step. \[I\]
- Hard caps degrade quality instead of failing, which is acceptable for visuals but needs a policy for collision tiles (collision must never be evicted while near the drone). \[I\]
- A GitHub issue shows tilesets with non-conforming embedded glTF fail to render; the maintainers' position is that Three.js's `GLTFLoader` defines what works ([issue #78](https://github.com/NASA-AMMOS/3DTilesRendererJS/issues/78)). \[D, historical\] Use validated glTF from your own pipeline.
- Not verified: behavior with 10,000+ small tiles, `.3tz` reading, and per-frame traversal cost on a UHD 620 laptop CPU.

**Evidence from real applications.** NASA JPL Mars, Google Photorealistic 3D Tiles and city demos are public ([examples](https://github.com/NASA-AMMOS/3DTilesRendererJS)); I found no shipped *game* using it. Geospatial datasets are a different content shape from dense, multi-material drone maps. \[I\]

**Verdict.** Prototype in E2. If tile parse or GPU admission causes long frames you cannot budget, keep the tile format and replace the loader with an in-house residency manager.

### 6.2 Renderer choice: WebGLRenderer vs WebGPURenderer (same Three.js version)

- **Documented support:** `WebGPURenderer` falls back to WebGL 2; custom `ShaderMaterial` and `onBeforeCompile` are not supported ([manual](https://threejs.org/manual/en/webgpurenderer)). r184 added node-material support on `WebGLRenderer` through a compatibility layer, which lets you adopt TSL without WebGPU \[D, secondary: Utsubo\].
- **BatchedMesh:** `WebGPURenderer` renders it without multi-draw ([PR #27937](https://github.com/mrdoob/three.js/pull/27937)); on WebGL, it uses `WEBGL_multi_draw` with a fallback draw loop ([PR #27178](https://github.com/mrdoob/three.js/pull/27178)). The TSL `drawIndex` works only on WebGL 2 multi-draw ([thread](https://discourse.threejs.org/t/webgpu-tsl-equivalent-of-gl-drawid/87930)). \[D/S\]
- **GPU-driven rendering:** Three.js issue #28389 discusses `drawIndirect`/multi-draw as a WebGPU flagship feature with no WebGL 2 equivalent except slower workarounds ([issue](https://github.com/mrdoob/three.js/issues/28389)). With MDI still experimental in Chrome, your portable path remains CPU-driven batching. \[D/I\]
- **Intel UHD 620 status:** no direct evidence found. Chrome's compatibility mode (Chrome 146) is for GPUs lacking full WebGPU capability; it is not evidence about your device ([Chrome blog](https://developer.chrome.com/blog/new-in-webgpu-136), [report](https://app.cinevva.com/signals/2026-03-27-browser-rendering-best-month)). \[H\]
- **Upgrade from 0.180.0 to r186** is allowed within the migration guide's 10-release window ([Utsubo summary of the guide](https://www.utsubo.com/blog/threejs-2026-what-changed)). Because shadow and PBR behavior changed, visual diffs must be part of acceptance. `Clock` is deprecated; if flight integration uses `THREE.Clock` for dt, keep the time-step source unchanged to preserve flight behavior.
- **Verdict:** keep `WebGLRenderer`; run `WebGPURenderer` as an A/B in E3 and log the actual backend.

### 6.3 Asset pipeline: meshopt and KTX2

**Meshopt.** `EXT_meshopt_compression` decodes in WASM; the DEV test above found the same decoded attributes, with smaller transfer and a faster first frame on a high-end GPU. \[R\] To reduce *GPU* geometry bytes you need quantization (for example `KHR_mesh_quantization`) and fewer vertices via simplification; confirm in E1 using webgl-memory rather than file size. \[I\]

**KTX2/Basis.**

- KTX2 textures stay block-compressed on the GPU and are transcoded at load in a worker pool ([docs](https://threejs.org/docs/pages/KTX2Loader.html)). \[D\]
- Target format selection depends on `detectSupport()`. A Three.js issue records that Firefox may report formats it emulates in the driver and that BC1/BC3 may be preferable to BC7 when transcoding ETC1S ([issue #29745, mirror](https://gh.nn.ci/mrdoob/three.js/issues/29745)). \[D\]
- On a Windows Intel iGPU I expect BCn targets (BC7 or BC1/BC3) and no ASTC. **This is an inference; log `texture.format` and the transcoder target on the target laptop.** \[I\]
- Size arithmetic for planning only: RGBA8 is 32 bits per texel; BC7 and BC3 are 8 bits per texel; BC1 is 4 bits per texel; a full mip chain adds about one third in each case. So expect roughly 4x (BC7/BC3) to 8x (BC1) lower GPU texture bytes than RGBA8, matching the 4-8x quoted by [Utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips). \[I\]
- Basis Universal v2.0 (2026-01-19) and v2.1 (2026-02-24) added XUASTC LDR and ASTC LDR; v2.1 changed container details so files written by v2.1 may not load in v2.0 tools ([release notes](https://github.com/BinomialLLC/basis_universal/wiki/Release-Notes)). **Pin encoder and transcoder together** and test the bundled Three.js transcoder with your output.
- Main-thread GPU upload is not removed by KTX2 (finding 3). Plan a per-frame upload budget regardless.

### 6.4 Batching, culling, props

- Merge static geometry per tile at build time; use `BatchedMesh` for different geometries sharing a material and `InstancedMesh`/`InstancedMesh2` for repeated props. A forum answer states `BatchedMesh` uses multi-draw while `InstancedMesh` uses instanced draw, and that many distinct trees/rocks favors `BatchedMesh` ([thread](https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221)). \[R\]
- `InstancedMesh2` gives per-instance frustum culling (dynamic BVH), LOD and visibility; the culling runs on the CPU, and the author says GPU culling is a future WebGPU compute step ([forum](https://discourse.threejs.org/t/ideas-on-performing-fast-per-instance-frustum-culling-on-instancedmesh/85156)). \[R\] That means on a CPU-limited laptop the culling itself has a cost to measure. \[I\]
- Single-maintainer dependency risk for `@three.ez/*`. \[I\]
- Material consolidation lowers shader-program count and state changes; combine with atlases (CrazyTaxi example above, \[R\]).

### 6.5 Collision preparation

Use three-mesh-bvh: build BVHs offline or in `GenerateMeshBVHWorker`, ship serialized trees alongside tiles, and `deserialize` on load; share via `SharedArrayBuffer` where cross-origin isolation is available ([docs](https://gkjohnson.github.io/tools/docs/three-mesh-bvh/SerializedBVH.md)). \[D\] The BVH index buffer belongs to the geometry, so releasing CPU geometry arrays after upload would break collision; keep a separate low-poly collision mesh per tile. \[I\] Whether your existing collision already uses a BVH is unknown (section 9).

### 6.6 Delivery stack

- R2 for tile storage (free egress, 10 GB-month free) fits a $0 budget only if the *content* may be hosted publicly, which is a provenance question (section 8).
- Cache Storage plus `navigator.storage.persist()` for revisits and cold-start recovery; OPFS if you prefer file semantics. \[D\]
- Range requests are only useful if you pack many tiles in one archive (`.3tz` or custom). With small content-hashed tile files you may not need them. \[I\]

### 6.7 Babylon.js 9.x as the migration candidate

- Release: 9.0 on 2026-03-26 with clustered lighting (WebGPU and WebGL 2), Frame Graph, volumetric lighting and Gaussian splatting updates ([announcement](https://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0)). A secondary comparison cites Babylon.js 9.26 as of September 2026 ([Cinevva](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)); not verified.
- Strengths relevant to you: thin instances (no per-instance overhead), frozen world matrices, official 3D Tiles integration, WebGL 2 as a full backend.
- Costs: rewrite of the Three.js scene layer, custom materials, loaders and any `onBeforeCompile` usage; unknown flight-integration surface; npm download volume is about 39x smaller than Three.js ([Utsubo, Sept 2026](https://www.utsubo.com/blog/threejs-2026-what-changed)), so fewer community answers. \[R\]
- No independent iGPU benchmark found that shows Babylon beating a batched Three.js scene. **Therefore a migration needs its own experiment (E7), not a hunch.**

---

## 7. Architecture options

|  | **A. Improve the current Three.js architecture** | **B. Specialized systems around Three.js** (recommended) | **C. Migrate engine** |
| --- | --- | --- | --- |
| What changes | Fix leaks and ownership, add budgets and warm-up to what exists, merge draw calls, upgrade Three.js | A plus tiled HLOD streaming, KTX2/meshopt pipeline, residency manager, precomputed collision, CDN and local cache | New engine, new scene layer, loaders, materials, flight integration |
| Fixes memory peaks and map-switch growth | Partly (ownership) | Yes (bounded residency, cancellation) | Only if the new engine ships equivalent streaming; none found at $0 for meshes |
| Fixes map download and load time | Little | Yes (tiles, fewer bytes before flying) | Same caveat |
| Fixes steady-state CPU cost | If draw calls are the issue | Yes via merge/batch | Babylon thin instances might; unproven on target |
| Fixes GPU fragment cost at 720p on UHD 620 | No | No (needs shading cuts) | No by itself |
| Risk to flight behavior | Very low | Low (flight code not touched; collision handoff needs care) | High |
| $0 compliant | Yes | Yes if hosting is permitted (section 8) | Yes for engines; PlayCanvas editor private projects are not |
| Cost to try | Days | Weeks for E1-E5 | Weeks to months per candidate |

**Recommendation: B, staged, with A done first because it is cheap and some of it may already exist.**

**Target architecture if E1-E5 pass (all \[I\], derived from the evidence above):**

1. **Build stage:** import map, split into spatial cells, simplify per LOD (meshoptimizer/gltfpack), merge static geometry per tile and material, atlas where practical, encode textures to KTX2 with mips, meshopt-compress geometry, emit a low-poly collision mesh and a serialized BVH per tile, emit content-hashed files plus a tileset index. Record asset provenance per tile.
2. **Delivery stage:** tiles on a CDN with immutable cache headers; Cache Storage (and `persist()`) on the client.
3. **Runtime residency manager** (the 3d-tiles-renderer design, or your own with the same shape): separate budgets for (a) encoded bytes in flight, (b) decoded CPU bytes, (c) GPU bytes, (d) decode/transcode concurrency, (e) upload milliseconds per frame. Priority = time-to-arrival along the drone's velocity, then screen-space error. Every request carries an `AbortController`. Collision tiles around the drone are pinned and never evicted.
4. **Ready gate:** "flyable" means collision tiles for the start area are resident, the near visual ring is uploaded, and shaders for the active material set are compiled. Everything else streams.
5. **Ownership:** one registry owns every geometry, texture, material, BVH, bitmap and tile; refcounts per shared resource; map switches release by owner, not by traversal.
6. **Renderer:** `WebGLRenderer` unless E3 shows a clear `WebGPURenderer` win on the target.

**Evidence that would change this recommendation**

| If this happens | Then |
| --- | --- |
| E0 shows the UHD 620 is fragment-bound at 720p low (frame time scales with pixel count) | Streaming and engine choice will not fix FPS. Priority becomes shading cost (shadows, post effects, overdraw, material complexity) |
| E3 shows `WebGPURenderer` beats `WebGLRenderer` on the target by the thresholds in section 10 | Make WebGPU the default with WebGL fallback, after porting custom shaders |
| E2 shows 3d-tiles-renderer's parse or upload causes long frames you cannot budget | Keep the tile format; write an in-house residency manager |
| E7 shows Babylon at least 25% lower median CPU frame time and better 1% low on identical content | Plan a renderer-layer migration (and reuse the same tile set through Babylon's 3D Tiles integration) |
| Section 8 shows maps cannot be publicly hosted | Delivery design changes (access control or a different distribution model); streaming still helps memory |
| The audit (section 9) shows most of B already exists | Skip to measurement of what is *ineffective* |

---

## 8. Provenance, permission and hosting gate

This is a gate, not a legal opinion. Your brief says existing Liftoff-content access does not establish redistribution rights.

- **Serving tiles to players is distribution.** A public CDN bucket or a public Pages deployment redistributes every byte of every tile. Before moving any imported-map data to R2, a new CDN or a new pipeline, confirm the permission scope for that specific content. \[I\]
- **Do not upload restricted assets to third-party processing services** (for example Needle Cloud for LOD generation, Cesium ion, or similar hosted converters) unless that use is covered by the permission. Local command-line tools (gltfpack, glTF-Transform, KTX tools, Obj2Tiles) keep data on your machines. \[I\]
- **PlayCanvas free plan** limits you to public projects and the paid private plan costs $15/month per seat ([plans](https://playcanvas.com/plans)), so its hosted editor conflicts with both $0 and provenance for restricted content. Its engine library is MIT and can be used without the editor. \[D\]
- **Tile provenance records:** emit a per-tile manifest entry (source asset ID, license/permission note, transform history). A derived tile inherits the source's restrictions. Ironworks is retired and must not be regenerated; exclude it from any pipeline run. \[I\]
- **Production isolation:** all experiments run against a separate non-production host, a local server, or a private bucket. Do not load-test production.

---

## 9. One-day repository audit (what is already active and effective)

I could not do this. Run it before E1 so you do not re-adopt features you already have. For each row, record *present / active at runtime / measured effective*.

| Area | Probe |
| --- | --- |
| Three.js usage | Which renderer and which shader paths (`ShaderMaterial`, `onBeforeCompile`) are in use? |
| Geometry compression | Do shipped maps contain meshopt, Draco or raw buffers? Check `extensionsUsed` in each GLB |
| Textures | KTX2 present? Print `texture.format`, mip count and `texture.image` dimensions for every texture at runtime; count PNG/JPEG still in use |
| Batching/instancing | Count draw calls (`renderer.info.render.calls`), unique materials/programs, instanced vs separate meshes per map |
| LOD | Is LOD authored, runtime-generated, or absent? What is the switching metric? |
| Caching | HTTP cache headers, service worker, Cache Storage, IndexedDB contents per map |
| Workers | Which tasks run off-thread (decode, BVH, transcode)? One `KTX2Loader` instance or several? |
| Collision | Is a BVH used? Built at load or shipped? On which thread? |
| Disposal | Is there an owner registry? What does a map switch release? Compare `webgl-memory` totals before and after |
| Map delivery | Per large map: encoded bytes, number of files, largest file, decoded CPU bytes, GPU bytes |
| Time-to-fly | Current definition of "ready" and the measured phases |
| Shader programs | `renderer.info.programs.length` per map and at map switch |

---

## 10. Prioritized experiment plan

### 10.1 Measurement protocol (applies to every experiment)

- **Target machine:** the actual Intel i5 / UHD 620 laptop. Record CPU model, RAM, driver version, Windows build, Chrome version, power plan (plugged in, same plan every run), display refresh rate. RTX, Apple Silicon or software-renderer results do not count toward acceptance.
- **Thermals:** 5-minute warm-up before each timed run; discard the first 10 seconds of each run; note throttling (U-series laptop chips throttle). \[I\]
- **Framebuffer and settings:** Low preset; confirm `gl.drawingBufferWidth x drawingBufferHeight` equals 1280x720 and `devicePixelRatio` effects are controlled; adaptive resolution **off**.
- **Fixed content and visual quality:** one pinned Three.js version for all arms; same maps; same lighting/shadow settings; screenshot diff at fixed camera poses with a threshold agreed *before* running (suggest structural similarity plus a worst-region check).
- **Fixed route:** record real flight input once, replay deterministically (same seed, same fixed simulation step) for each arm. Include a fast-flight segment, sharp turns and a revisit. Keep your existing flight timestep source unchanged.
- **Two run types, never mixed:**
  - *Timing runs:* only a lightweight logger writing `requestAnimationFrame` timestamps and counters into a preallocated typed array, flushed at the end. No DevTools, tracing, overlays or memory wrappers.
  - *Instrumented runs:* DevTools Performance/tracing, `webgl-memory`/`webgpu-memory`, timer queries if available, heap snapshots. Reported as diagnosis only.
- **Metrics:** median frame time, p95, p99, mean frame time of the worst 1% of frames (reported as the "1% low" FPS: for your target the worst-1% mean must be at most 20 ms), count of frames over 33.3 ms and over 50 ms, and longest task. Frame times from `requestAnimationFrame` deltas do not prove displayed frames; add a presentation-based capture (for example a display-timing tool such as Intel PresentMon) for the final acceptance run. \[I, tool not researched\]
- **Load scenarios:** *cold* (new Chrome profile, empty HTTP cache, Cache Storage and shader cache; Chrome caches compiled shaders, so cold vs warm shader state must be controlled, see [PR #16662 discussion](https://github.com/mrdoob/three.js/pull/16662)), *warm* (second load, same profile), *hot* (service worker and persisted storage). Also run under a fixed bandwidth profile and on the real network, reported separately.
- **Repeats:** at least 5 loads and 3 flights of 120 seconds or more per arm; report median and range; discard runs with background interference.
- **Define time-to-fly** before measuring: the first moment when input is accepted, collision for the start area is resident, and no frame exceeds 50 ms for the following 5 seconds.
- **Log which backend actually ran** (`WebGPURenderer` can fall back to WebGL 2 silently) and the KTX2 transcode target format.

### 10.2 Experiments in priority order

**E0: Baseline and bottleneck decomposition (do first; no code changes except instrumentation)**

- *Question:* what actually limits each large map: bytes, parse, decode, upload, compile, CPU frame, GPU frame, or memory growth?
- *Inputs:* current build, one small map and each large map.
- *Measures:* encoded bytes, decoded CPU bytes (heap snapshot, `measureUserAgentSpecificMemory` in a cross-origin-isolated test build), GPU bytes (`webgl-memory` plus Chrome Task Manager GPU memory), phase timeline to time-to-fly, shader program count, main-thread long tasks. Steady state: JS main-thread ms per frame vs frame interval. Two diagnostic tests: render at 100%, 75% and 50% internal resolution (frame time falling roughly with pixel count means fragment-bound); and temporarily hide half of the draw calls (frame time falling means CPU/driver-bound).
- *Success:* no pass/fail; produces a ranked bottleneck list per map. *This ranking decides which later experiments matter.*

**E1: Asset-form matrix on one representative map slice**

- *Arms:* current; meshopt geometry; KTX2 ETC1S; KTX2 UASTC; meshopt plus best KTX2; plus quantization.
- *Measures:* encoded bytes; decode/transcode ms in workers; actual transcode target format; GPU texture and buffer bytes (`webgl-memory`); main-thread upload ms; visual diff.
- *Success (proposed):* at least 3x lower GPU texture bytes with visual difference inside the agreed threshold, and no increase in main-thread long tasks during load.
- *Failure:* GPU bytes do not drop (for example transcoder falls back to uncompressed RGBA), or quality fails the threshold; then use UASTC for hero textures only or abandon ETC1S for that content.

**E4: First-use stutter and warm-up strategies** (cheap; run right after E1)

- *Arms:* none; `compileAsync()` only; `compileAsync()` plus spaced `initTexture()` or one-time hidden pre-render of each new batch; per-frame upload budget (admit at most N ms of uploads per frame).
- *Measures:* count and total duration of frames over 33.3 ms and over 50 ms in the first 30 s of fast flight, cold and warm.
- *Success (proposed):* zero frames over 50 ms after time-to-fly, and a large reduction in frames over 33.3 ms versus baseline.
- *Failure:* stutter remains with upload budgeting; then the cause is elsewhere (GC, decode on main thread, or shader programs created at runtime). Use the instrumented run to attribute.

**E3: Renderer A/B and draw-call reduction**

- *Arms (same Three.js version):* `WebGLRenderer` unmerged; `WebGLRenderer` merged per tile plus `BatchedMesh`/`InstancedMesh2`; `WebGPURenderer` (WebGPU backend, only if an adapter is available) on the merged scene; `WebGPURenderer` with `forceWebGL`.
- *Measures:* CPU ms inside `render()`, cold first-frame ms, median/p99 frame time, draw calls, GPU memory, backend actually used. Add the multi-draw check: does the ANGLE path loop internally (see 4.4)?
- *Success for adopting WebGPU (proposed):* median frame time at least 10% better than the best `WebGLRenderer` arm, p99 and 1% low not worse, cold first-frame not worse, and custom shaders portable with acceptable effort.
- *Success for merging/batching on WebGL:* draw calls reduced and CPU render time reduced with equal visuals.
- *If both renderers are GPU-bound:* record it, stop pursuing renderer changes, and go to shading-cost work.

**E2: Streaming prototype (largest build)**

- *Inputs:* one large map converted to tiles by a local pipeline (Obj2Tiles or a glTF-Transform script plus your own splitter) with HLOD, merged tiles, KTX2 and meshopt; 3d-tiles-renderer with KTX2/meshopt registered on its loader manager.
- *Measures:* encoded bytes before time-to-fly (cold, warm, hot); time-to-fly; peak JS heap and GPU bytes during load; resident bytes vs budget during fast flight; tile cancellations; revisit cache hit rate; long frames per minute; visible tile pop-in.
- *Budget-pressure test:* set `maxBytesSize` to about half of the route's working set and verify graceful degradation (coarser tiles, no crash, no thrash, collision still resident).
- *Success (proposed):* bytes before time-to-fly and time-to-fly both clearly below baseline, memory plateau below baseline peak, and no frame over 50 ms attributable to tile parse/upload after time-to-fly.
- *Failure:* main-thread parse or upload breaks the frame budget with no setting that fixes it; then switch to the in-house manager using the same tiles.

**E5: Map transitions, cancellation and long sessions**

- *Protocol:* alternate A-to-B-to-A for 20 transitions; abort a load halfway through and confirm resources return; 30-minute flight with revisits. Use a test build with forced garbage collection available (for example Chrome's `--js-flags=--expose-gc`, test build only).
- *Measures:* post-GC JS heap slope, GPU bytes slope (`webgl-memory` and Task Manager), `renderer.info` counts (diagnostic only), peak at each switch, count of live tiles/textures/BVHs by owner.
- *Success (proposed):* post-GC slope within measurement noise after the first full cycle, and switch peak not above the baseline's peak.
- *Failure:* monotonic growth; use the ownership registry to identify the leaking owner class.

**E6: Delivery and caching**

- *Arms:* current host vs a private test bucket (R2 or equivalent) with immutable hashed names; with and without Cache Storage persistence; optional single-archive packing with range requests.
- *Measures:* cold/warm/hot load times, request counts, revalidation behavior, failure and resume behavior when the connection drops mid-load.
- *Gate:* section 8 must be cleared before any restricted content is uploaded.

**E7: Babylon.js spike (conditional on E3 showing renderer-side CPU dominates and merge/batch does not fix it)**

- *Inputs:* one map slice using thin instances, frozen world matrices, and optionally the same tile set via Babylon's 3D Tiles integration; same camera route.
- *Success (proposed):* at least 25% lower median CPU frame time and better 1% low than the best Three.js arm at identical visuals. Otherwise stop; do not migrate.

---

## 11. Remaining uncertainty

**Documented facts (checked against primary pages today)**

- Three.js release dates and migration notes (via release pages and Utsubo summary); `WebGPURenderer` unsupported-material list; `KTX2Loader` role; `BufferAttribute.onUpload` purpose; dispose-manual caveats; 3d-tiles-renderer LRU defaults, hard-cap behavior, `UnloadTilesPlugin`; Godot web export is WebGL 2 only (4.5 docs); Unity 6.2/6.3 docs call WebGPU experimental; PlayCanvas plan limits; Cloudflare R2 free-tier numbers; Basis Universal v2.0/2.1 dates; Chrome multi-draw-indirect is experimental and flagged.

**Source-code observations (partial)**

- LRU eviction logic (byte and item caps, skipping in-use loaded items); `KTX2Loader` worker pool and `detectSupport` requirement; `BatchedMesh` WebGPU path has no multi-draw (PR text).

**External reported measurements (not reproduced)**

- The forum benchmarks in section 5; CrazyTaxi, iniGlowee and DEV-article numbers; Nanite-demo fps on integrated GPUs; PlayCanvas splat speedup; Godot-fork claims.

**Engineering inferences**

- BCn transcode targets on Intel Windows; GPU byte arithmetic for compressed formats; merging per tile to cut per-tile draw calls; ANGLE multi-draw acting as a loop; separate collision meshes; dependency risk of single-maintainer libraries; hosting implications of provenance.

**Untested hypotheses**

- That your maps are CPU/draw-call bound rather than fragment-bound; that texture upload dominates your first-use stutter; that 3d-tiles-renderer's parse/upload fits a 16.7 ms budget; WebGPU behavior on UHD 620 under your Chrome and driver; whether Three.js's bundled Basis transcoder handles XUASTC; behavior of 3d-tiles-renderer with tens of thousands of small tiles and with `.3tz`; unverified `latest` tag stability for every package named here.

**Could not determine**

- What your code already does; your actual map sizes and structure; your current host; the permission scope for each imported asset; Reddit, browser bug-tracker and conference-talk evidence; independent benchmarks of any alternative engine on UHD 620-class hardware.

**No FPS promise.** Nothing here predicts frame rate. Every FPS or memory claim above is either someone else's measurement on other hardware or a hypothesis for the experiments in section 10.
