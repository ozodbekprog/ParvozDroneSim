# Browser product readiness: evidence and technology decision

25 October 2026, Asia/Tashkent. Source inspected: `560cd1b145149999c227f8bc6b301e01dcd03378`.
This is a source/package audit and current official-documentation review. No new
browser performance measurement, runtime fix, engine migration or Oracle release
was performed. Existing presentation changes were left intact.

## Decision

The current evidence does not establish a market-ready product. Recommend making
first-flight performance, loading reliability and memory stability the next
release milestone before expanding features. Keep Three.js as the baseline for
a bounded comparison, with PlayCanvas as the first alternative to benchmark.
An engine migration is not yet justified by measured comparative evidence.

The strongest problems found are content packaging and synchronous preparation.
These remain relevant in any engine. Existing modern libraries are present, but
their presence has not produced a verified end-to-end result on target hardware.

## Directly inspected evidence

Read `package-lock.json`, the local generated catalog, filesystem asset sizes,
GLB JSON headers, loading/rendering/collision code, and the required deployment
and acceptance documents. Read only GLB headers/JSON, without decoding models or
repeating exports. Local catalog revision: `2132caf43c0e38df` as recorded by the
deployment documentation; live revision was not independently rechecked here.

Sizes below are decimal MB of local files, **not measured HTTP transfer bytes**.
HTTP compression can reduce them; especially collision JSON can compress well.
JSON still expands before parsing and building collision structures.

| Map | Main GLB MB | Collision JSON MB | Objects with three LODs | Distinct model URLs used by those LODs |
| --- | ---: | ---: | ---: | ---: |
| Minus Two | 26.341 | 4.517 | 46 | 1 |
| Hangar C03 | 270.815 | 27.243 | 2,857 | 1 |
| Arena | 174.042 | 22.688 | 1,526 | 1 |
| Pine Valley | 204.877 | 102.990 | 1,108 | 1 |
| The Green | 265.604 | 138.108 | 4,126 | 1 |

These are main model/collision files only, excluding selected drone, race props,
workbench and other dependencies. All five main GLBs declare
`EXT_meshopt_compression` and `KHR_texture_basisu`. The Green contains 42,739
nodes, 9,371 mesh definitions and 910 images. Those counts are not draw calls,
visible triangles or measured GPU memory.

Specific architectural findings:

1. **Spatial names do not provide network streaming.** Catalog object LODs
   reference different nodes in one large GLB per map. `src/asset-loader.js`
   receives the whole file and calls `GLTFLoader.parseAsync` before selecting and
   cloning the requested node. `src/visual-lod.js:loadVisualLOD` requests all
   levels and awaits all of them. Selecting Low changes visible LODs but does
   not give these maps independent Low-only downloads/parsing.
2. **Physics preparation performs substantial synchronous work.**
   `src/map-collisions.js` loads/parses JSON, validates colliders and calls
   `prepareCollisions`. `shared/collision.js` creates Triangle/Vector3 objects
   and recursively sorts/slices arrays to build trees. A Promise around this
   work does not move it off the main thread. This is a source-level risk;
   a trace is required to attribute exact milliseconds and memory.
3. **Cache limits are not a total memory budget.** `src/asset-byte-cache.js`
   caps retained encoded bytes at 64 MiB. `src/asset-loader.js` separately limits
   idle decoded models to 48/96 MiB using an estimate. Neither cap bounds active
   map resources, in-flight parsing, scene clones, collision structures or all
   render targets. `src/model-memory.js` estimates payloads; it does not measure
   process memory or actual GPU residency. No memory leak is proven by this audit.
4. **Modern components already exist.** WebGPU with fallback, KTX2/Basis, Meshopt,
   Draco loader support, instancing/batching, LOD, immutable disk caching,
   retries and partial transfer recovery are implemented. `deploy/Caddyfile`
   already configures zstd/gzip and immutable asset caching. Adding another
   compression/cache switch without measurement would duplicate existing work.
5. **The renderer is behind the currently listed release.** Lockfile Three.js
   is 0.180.0; the official release page retrieved today lists r186 latest.
   Review migration changes and benchmark an upgrade, particularly custom
   batching, packed attributes, texture-binding and WebGPU paths. No automatic
   upgrade or speedup is claimed.

The 23 October release record reports cold menu Ready at 3.489 s, repeat 1.298 s,
and 3.271 s on its throttled cold-menu run, with zero startup model requests.
It explicitly leaves two after-release scenarios unfinished. These are menu
results, not first-flight timings. Earlier slow startup/flight observations in
the same documents concern older builds and must not be attributed to the latest
release. UHD 620 acceptance remains absent. See
[deployment evidence](ORACLE-DEPLOYMENT.md) and [acceptance](WEB-BETA.md).

## Current solutions and their fit

These are candidate choices, not performance rankings. Official documentation
was consulted on 25 October; no competing engine was run in this audit.

| Solution | Relevant capability | Recommendation for Parvoz |
| --- | --- | --- |
| Updated Three.js | Current WebGPU/WebGL fallback renderer and ongoing rendering fixes | Baseline with existing gameplay; evaluate upgrade separately from content changes so gains can be attributed |
| PlayCanvas | Web-focused engine, runtime asset loading/unloading, WebGPU/WebGL, integrated profiling | First engine challenger for a matched map/camera/material benchmark; its asset system still needs independently loadable packages |
| Babylon.js | WebGPU/WebGL, instances, LOD, inspector and snapshot rendering | Credible second alternative; snapshot rendering targets particular mostly-static scenes and chiefly reduces JS cost, not GPU workload |
| glTF Transform + meshoptimizer + KTX2/Basis | Geometry optimization and compressed GPU texture delivery | Already used; improve package granularity, sharing and quality-specific delivery rather than merely enabling codecs again |
| three-mesh-bvh | Spatial queries, serialization/deserialization and worker generation | Benchmark against the custom collision tree; preserve collision response, contact ordering and client/server agreement |
| Browser performance/memory tools + SpectorJS | Main-thread/network/heap evidence; WebGL frame inspection | Use for reproducible attribution; SpectorJS is for WebGL, and JS heap is not total GPU/process memory |
| Unity/Godot web export | Full engine workflow with documented web-specific constraints | No evidence they solve this application's browser loading or memory problem by migration alone |

PlayCanvas's graphics documentation labels its WebGPU backend Beta. Test the
actual target browser/device and WebGL fallback rather than assuming WebGPU is
available or faster. Godot's retrieved stable web guide specifies WebGL2 and no
WebGPU. Unity's current web performance guide still calls out CPU/threading and
draw-call constraints. A native desktop product is a separate distribution
decision worth testing if complete large environments are mandatory and the
browser cannot satisfy the agreed target. It also needs optimization.

Primary references:

- [Three.js releases](https://github.com/mrdoob/three.js/releases) and
  [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html).
- [PlayCanvas optimization](https://developer.playcanvas.com/user-manual/optimization/),
  [loading/unloading](https://developer.playcanvas.com/user-manual/assets/loading-unloading/),
  [graphics](https://developer.playcanvas.com/user-manual/graphics/), and
  [load time](https://developer.playcanvas.com/user-manual/optimization/load-time/).
- [Babylon capabilities](https://www.babylonjs.com/specifications/) and
  [snapshot rendering](https://github.com/BabylonJS/Documentation/blob/master/content/setup/support/webGPU/webGPUOptimization/webGPUSnapshotRendering.md).
- [glTF Transform](https://gltf-transform.dev/cli),
  [meshoptimizer](https://github.com/zeux/meshoptimizer), and
  [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh).
- [Chrome heap snapshots](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots)
  and [SpectorJS](https://spector.babylonjs.com/).
- [Godot web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
  and [Unity web performance](https://docs.unity.com/en-us/engine/7000.0/manual/platform-specific/webgl/develop/performance).

## Proposed recovery milestone

Use the recorded beginner/club/classroom direction as a hypothesis, not verified
market demand. Deliver one complete first lesson with useful flight quality,
controller setup, retry and saved result. Existing maps remain available; a
smaller first-flight package must not silently remove their geometry or routes.
An eventual commercial product still needs owned or appropriately licensed art;
the Liftoff online-test permission is unchanged.

1. **Capture the end-to-end baseline.** Direct public URL, cold HTTP/app caches
   without deleting accounts/progress, actual encoded/decoded bytes, first
   controllable flight, parse/collision/shader timing, peak memory, and a fixed
   flight route. Repeat warm and cold. Separate each map and backend. Measure
   normal operation separately from intrusive profiling.
2. **Build one representative package experiment.** Keep the original files.
   Split existing authored chunks into independently loadable assets; share
   textures without cross-package duplication. Test a Low-only package first,
   then spawn-area/route prefetch with coarse distant coverage and explicit
   cancellation/eviction. A fast drone must never encounter unloaded collision:
   retain full collision initially, or prove a safe look-ahead boundary before
   streaming it. Verify all gates, contacts and visual continuity.
3. **Move collision preparation out of the blocking path.** Compare compact
   typed-array binary data with prebuilt serialized acceleration structures and
   worker preparation. Keep original geometry/flight parameters and verify
   server/client collision outcomes. A BVH library is not a replacement flight
   physics model. Do not blindly apply geometry decimation that previously
   caused holes.
4. **Measure lifecycle memory.** Include active scene, decoded cache, encoded
   buffers, workers and render targets. Run 20 menu/map/flight/exit cycles with
   bounded caches and post-settle snapshots. Distinguish intentional cache
   growth from unexplained retention; verify cancellation during preparation.
5. **Compare engines on identical work.** Three.js baseline/current-version
   candidate versus PlayCanvas, same asset payload, visible quality, camera
   route, backend, true framebuffer, collision workload and cache conditions.
   Measure download/startup, frame percentiles, memory and implementation
   complexity. An engine wins only if it passes the target and reduces total
   delivery risk; FPS from unrelated demos does not decide migration.
6. **Publish only after acceptance.** Finish the missing current-release
   checks, then apply the documented backup/drain/release/rollback process for
   any new runtime/content release. Preserve production accounts, 20-player
   admission and the $0 constraint. Update Oracle evidence after actual release.

Proposed additional launch target: first controllable lesson within 15 seconds
on 5 Mbps /160 ms, cold, with menu within the existing proposed 10-second limit.
This is a target for discussion and measurement, not an achieved result. At
5 Mbps, 15 seconds permits only 9.375 MB of theoretical transfer before protocol,
latency and processing costs; aim for at most 5 MB of encoded critical content
to leave headroom, then validate actual timing. Large-map complete downloads may
remain optional and must disclose their size.

Retain existing hardware acceptance: UHD 620, Low, actual 1280x720, adaptation
off, median frame time <=16.7 ms and 1% low >=50 FPS. Use a repeatable moving
route, not a mostly stationary average. Record draw calls, triangles and texture
residency evidence. Require responsive cancellation/retry and stable memory over
repeated sessions. No target-machine pass, migration speedup, full product
readiness or live fix is claimed by this document.
