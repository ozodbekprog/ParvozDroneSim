# Web-game forums: qualified changes for Parvoz

31 October 2026, Asia/Tashkent. Research and local implementation only.
This work made no Oracle deployment or public UI update. Existing Gemini/performance,
presentation and UI work in this checkout is preserved outside these changes.
The starting commit was `46754d1`, branch `gemini/perf-overhaul-20261031`.

The user's clarified scope is Three.js and browser-game engineering forums.
This pass checks community replies against the installed Three.js **r180** and
the [r187 release published 30 October](https://github.com/mrdoob/three.js/releases/tag/r187).
Earlier engine surveys remain in the 25–26 October research reports. No engine
migration, dependency upgrade, extraction or content re-export was performed.

## Implemented: direct embedded KTX2 decoding

The newly merged [Three.js #35193](https://github.com/mrdoob/three.js/pull/35193)
removes a redundant embedded-image route: image bytes → Blob → object URL →
fetch → image bytes → KTX2 decoder. The decoder can accept the copied GLB
buffer view directly. Its upstream performance numbers are not Parvoz results.

`src/embedded-ktx2.js` adapts that narrow behavior to r180 through the existing
`cooperativeImageViews` plugin. The game already registers this plugin in its
asset loader. Image-view scheduling still yields; KTX2 transcoding retains its
worker pool. Source-cache cloning, extras, MIME type, samplers, texture transforms
and associations retain the GLTFLoader behavior. External URLs and other image
loaders keep their existing route. `directKtx2:false` selects the old QA control.
The adapter is temporary: remove it when qualifying an upstream loader with
this feature rather than maintaining two implementations indefinitely.

The [read-only asset audit](research/web-forum-systems-20261031/asset-scope.json)
found **64 catalog GLBs, 3,747 referenced embedded KTX2 image sources and
686,454,717 encoded image bytes** (654.65 MiB). These are aggregate static
catalog figures, including repeated content in different deliveries. They are
neither one-session downloads nor measured RAM/VRAM savings. No asset changed.

## Browser proof and automated checks

The reusable local comparison lives at `tools/research/embedded-ktx2.html`.
It loads one real asset through both paths, hashes geometry and compressed
texture mip payloads/settings, and compares rendered pixels. It rejects blank
frames, mismatched payloads, any remaining direct-path image Blob URLs and
non-identical images. Both views use a real 640×360 framebuffer with the same
renderer and camera. This is functional qualification, not UHD 620 acceptance.

| Asset / actual backend | Image Blob URLs, control → direct | Geometry and texture payloads/settings | Pixel comparison |
| --- | --- | --- | --- |
| Luma Low / WebGPU | 31 → 0 | Identical | 0 different pixels |
| Luma Low / WebGL2 fallback | 31 → 0 | Identical | 0 different pixels |
| Minus Two / WebGPU | 85 → 0 | Identical | 0 different pixels |
| Minus Two / WebGL2 fallback | 85 → 0 | Identical | 0 different pixels |

Saved [native WebGPU proof](research/web-forum-systems-20261031/luma-webgpu.json),
[fallback proof](research/web-forum-systems-20261031/luma-webgl.json),
[map WebGPU proof](research/web-forum-systems-20261031/minus-two-webgpu.json),
[map fallback proof](research/web-forum-systems-20261031/minus-two-webgl.json)
and their PNG captures contain exact asset SHA, counts, mip bytes and observed timings.
Control-first load times are single-run observations influenced by startup,
cache and CPU contention; they do not establish a speedup ratio or FPS gain.

Five focused loader tests cover direct worker transfers without GLB detachment,
cooperative yielding, identical image/sampler/transform metadata, shared-source
clones, external/non-KTX2 fallback, synchronous throws and asynchronous failure
without stranding later work. Related asset/decoder/cancellation tests pass.
The production Vite build passes without regenerating unchanged content.

The first full test run had 665 passes and one existing stale expectation in
`test/scenery-batch-support.test.js`: it compared the whole options object with
an older two-field shape. That source/test pair was unchanged by the loader
work. Commit `c722af8` makes the capability test assert its relevant fields and
retains explicit override checks; its two tests pass. The final full run passed
**666/666 tests**, with zero failures, skips or cancellations. The final Vite
production build also passed; its existing large-bundle warning remains.
The [verification record](research/web-forum-systems-20261031/verification.json)
records source/evidence hashes and the successful suite/build log hashes.

During QA the separate legacy `WebGLRenderer` showed blank imported meshes on
both the old and new paths. The initial blank-frame result was rejected and
its capture replaced. The game's `WebGPURenderer`, on native WebGPU and its
WebGL2 backend, displays the real textured drone and passes. The legacy renderer
experiment is not counted as a visual pass or a qualified renderer replacement.

## Other new findings and decisions

| Source, date/status checked 31 October | Verified finding | Parvoz decision |
| --- | --- | --- |
| [Interleaved view cloning #34755](https://github.com/mrdoob/three.js/pull/34755), merged 3 October, included r187 | Different typed-array ranges sharing a backing buffer could be corrupted by cloning/serialization. The merged fix keys the view range. | Audit found zero catalog candidates with multiple interleaved accessor ranges in one buffer view. Keep this as a regression case for new content, not an added copy on every current mesh. The audit is a static screen, not a proof about every runtime geometry. |
| [Instanced geometry replacement #34680](https://github.com/mrdoob/three.js/issues/34680), closed via #34690, r187 | The reported r186 failure involves more than 1,024 instances and disposing/replacing geometry. | Add this scenario to an eventual renderer-upgrade trial. Do not infer that stable, fixed-geometry batches require an engine switch. |
| [BatchedMesh matrix retention #35272](https://github.com/mrdoob/three.js/pull/35272), merged for r187 | Resizing batch instance capacity required additional old-matrix cleanup. | Current scenery code does not call `setInstanceCount()`. Keep fixed capacities; qualify the fix before adding runtime growth. |
| [Renderer texture-listener teardown #34368](https://github.com/mrdoob/three.js/pull/34368), merged for r187 | Texture disposal and renderer teardown have different listener lifetimes. Maintainer discussion also warns that stronger tracking can retain forgotten textures. | Retain explicit per-asset disposal. Test renderer recreation separately in an upgrade experiment; a global renderer reset is not a substitute for bounded scene ownership. |
| [Async compile state #34506](https://github.com/mrdoob/three.js/pull/34506), merged for r187 | Async compilation needs valid renderer state while other work proceeds. | The current branch already contains a live-render compile guard. Compare that behavior against upstream in isolation before removing the guard or taking the full update. |
| [ImageBitmap lifetime](https://discourse.threejs.org/t/how-to-use-imagebitmaploaders-close-method/58418), solved November 2023 | A timer is not proof of upload completion; the reply uses the texture update callback. | Do not close shared/cached images just because one upload finishes. Final-owner disposal and future re-upload needs remain application responsibilities. No bitmap lifetime code was changed here. |
| [GPU stalls on Linux](https://forum.babylonjs.com/t/webgpu-fps-drop-on-linux/63500/5), maintainer reply 19 May 2026 | The supplied trace pointed toward GPU-process stalls while page callback work was small; the suggested browser/driver comparisons were diagnostic steps. | Capture browser/GPU-process traces when page timings fail to explain a hitch. This report is not evidence of a Windows/UHD 620 driver fault. |
| [Canvas size versus motion](https://discourse.threejs.org/t/is-webgpu-bottlenecked-by-canvas-resolution/89052), January 2026 | A reply reports uneven displayed motion despite a good FPS counter, associated with Firefox antialiasing in that example. No universal cause is established. | Keep true framebuffer dimensions and visible motion in acceptance evidence; do not use a JavaScript FPS counter alone. |
| [Babylon Lite physics cadence #332](https://github.com/BabylonJS/Babylon-Lite/issues/332), closed via #349 | A reported fixed step per rendered frame made simulation speed depend on refresh rate. | Preserve Parvoz's separate simulation/network cadence. An engine comparison must include 30/60/120/144 Hz behavior, not just rendering throughput. |

## Instructions for the next engineering slice

1. Start from a local reproduced cost or failure. Record the exact renderer
   class, actual backend, revision, asset SHA, framebuffer and workload.
2. Keep old/new paths selectable in a local qualification tool. Test matching
   payloads/settings and nonblank rendering before comparing time or memory.
3. Treat encoded downloads, retained CPU bytes, transcoded mip bytes, GPU
   allocations and driver/process memory as separate measurements. A file-size
   reduction or `renderer.info` object count does not measure all of them.
4. Preserve copied-view ownership when transferring to workers. Check shared
   image/sampler variants and errors, not just one successful texture.
5. Test native WebGPU and the game's actual WebGL2 fallback. A renderer-class
   replacement is its own experiment even when both use WebGL2.
6. Next: measure first/cold map loading and map-switch peaks on the target
   laptop with this adapter, then consider an isolated r187 upgrade trial with
   skinning/instances, geometry replacement, shadows, compile/cancel and teardown.
   Do not transplant unrelated upstream internals on speculation.
7. Preserve the current public UI and separate Git push from Oracle deployment.
   No public UI release is authorized by this research or its QA screenshots.

Reproduce without asset sync or game/database startup:

```powershell
node --test test/cooperative-image-views.test.js test/asset-warm-cache.test.js test/asset-cancellation.test.js test/model-decoder.test.js test/packed-vertex-attributes.test.js
node tools/research/audit-embedded-ktx2.mjs
npx vite --host 127.0.0.1 --port 2598 --strictPort
# Open /tools/research/embedded-ktx2.html on that local origin.
```

There was no Oracle access or deployment in this work. Another chat's concurrent
release `20261031-perf-01` is now recorded in `docs/ORACLE-DEPLOYMENT.md`. Its
`origin/gemini/oracle-perf-20261031` source tree retains the old image-view plugin
and contains no `src/embedded-ktx2.js`; this loader backport is not part of that
recorded release. Do not overwrite or repeat its deployment/finalization.
This slice changed no production accounts, admission limits, Kestrel flight
parameters or map assets. UHD 620 FPS, cold/warm whole-game startup, every map
and every route remain separate acceptance tasks.
