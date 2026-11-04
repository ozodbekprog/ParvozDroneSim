# Browser game performance: community reports checked against sources

25 October 2026, Asia/Tashkent. Third research pass for Parvoz Drone Simulator,
following the [technology survey](MODERN-WEB-GAME-RESEARCH-20261025.md) and
[map-payload/source audit](WEB-GAME-DEEP-RESEARCH-20261025.md).
Research started at `a3e03df`, branch `codex/demand-pilots`.

This pass searches Reddit, Three.js, Babylon.js, PlayCanvas and Godot forums,
Hacker News, developers' postmortems, public benchmark repositories and browser
implementation sources. It follows replies and corrections rather than treating
an opening post, upvotes, a video or a search snippet as a verified conclusion.
The tables distinguish reported measurements, maintainer confirmations and our
engineering inferences. None of these external results is a Parvoz measurement.

Only research documents and a public-source metadata collector were added.
No upstream package was installed or executed, no stress demo was run, and no
game runtime, canonical asset or Oracle release was changed by this work.

## Decisions strengthened or changed

1. **Keep PlayCanvas as the first full-engine comparison candidate.** Current
   public benchmarks supply a stronger reason to test its submission path.
   They do not establish that migrating Parvoz will improve its target-device
   FPS, startup, transient memory or map download size.
2. **Measure presented motion, not only a JavaScript FPS counter.** A corrected
   Babylon development report shows how far those can diverge. Use normal
   browser pacing for acceptance; label uncapped throughput experiments separately.
3. **Prioritize shared assets and bounded loading before adding more effects.**
   Community examples reinforce the concrete Pine image duplication already
   measured locally. Encoded bytes, decoded CPU data and GPU allocations need
   separate budgets, including reservations for work still in flight.
4. **Qualify batching on the actual backend.** A Three `BatchedMesh` benchmark
   reports different render counters across classic WebGL, native WebGPU and
   the node renderer's WebGL2 fallback. Check actual calls, passes and image
   correctness instead of assuming a class name implies one draw.
5. **Add OptiPixel, FastHDR and DriftEngine to the evaluated references.** Their
   useful ideas have different integration costs. OptiPixel targets PlayCanvas;
   FastHDR concerns environment lighting; DriftEngine is a whole-engine port.
   They are not substitutes for the existing map-streaming qualification.

## Community evidence: loading and memory

Each row identifies the original venue and date. “Reported” means we read the
developer's account; it does not imply independent reproduction.

| Case | Evidence and resolution | Limit and implication for Parvoz |
| --- | --- | --- |
| C01. [Lorebound asset sharing][reddit-sharing], Reddit, 25 July 2026 | The author reports replacing separate image loads for repeated assets: 517 assets use 31 images, with an estimated 568 MB saved in one scene. | No comparable memory capture or target hardware is supplied. This is the same developer/project as C02, not independent corroboration. Our Pine hashes, rather than this number, justify a local dedup experiment. |
| C02. [Lorebound WebGPU migration][reddit-migration], Reddit, 1 August 2026 | The developer reports pipeline churn from short-lived VFX materials, then shared pools and prewarming. Reported p95 changes from 169 ms before migration to 1,539 ms after the initial port, then 54 ms after repairs. Other users still report mobile stutters and long transitions. | A large recovery can still miss a smooth-play target. The author's explanation that mobile memory caps cause a particular stall is a hypothesis. Exercise first use of effects, respawn and map changes; precompiling only the static scene is insufficient. |
| C03. [VHS room KTX2 conversion][reddit-vhs], Reddit, 16 October 2026 | The author reports memory falling from approximately 1.5 GB to 335 MB after converting JPEG/WebP textures, while download grows from about 26 to 34 MB. | Memory accounting and hardware are not fully specified. Both download and residency matter; KTX2 does not always minimize both. Our maps already use KTX2 almost everywhere, so conversion is not a new universal fix for Parvoz. |
| C04. [Quest gallery KTX2 discussion][reddit-ktx], Reddit, 30 May–3 June 2026 | A gallery developer describes memory pressure; a different commenter reports a PixiJS delivery becoming much larger after conversion, despite memory savings. The discussion includes corrections and uncertain encoder settings. | Do not transfer the numerical tradeoff between projects or repeat the thread's incorrect suggestion that KTX2 cannot carry HDR. Compare ETC1S/UASTC settings, actual transcode target and image quality. “Mipmaps use smaller samples” also does not mean ordinary mipmapped textures release their larger resident levels. |
| C05. [Large-image upload stalls][three-images], Three.js forum, 15–17 January 2024 | Maintainer Don McCurdy explains the distinction between image decoding and first GPU upload; the original user reports improvement with KTX2. ImageBitmap and explicit texture initialization address different stages. | Older but still technically useful; checked against loader source. A completed fetch or parse is not proof that first-visible-frame work has finished. Instrument upload and first use separately. |
| C06. [Samsung streaming stalls and buffer limits][pc-samsung], PlayCanvas forum, 9–10 October 2026 | A tablet in desktop-site mode received an unbounded splat budget and exceeded its storage-buffer binding limit. Separately, the author initially suspected a new streaming scheduler, then found that delaying video requests removed stalls across more than ten loads. | Maintainer confirms budget zero means uncapped. The video/HTTP2 mechanism remains an application-specific diagnosis, not a general browser defect. Use device limits rather than UA labels. Investigate competing requests only when our network trace shows them; no video contention is established for Parvoz. |
| C07. [Apparent VRAM leak after unload][pc-stats], PlayCanvas forum, 11–15 August 2022 | Rising/NaN VRAM statistics looked like a leak. The maintainer's fix changed shared vertex-buffer accounting; actual allocation behavior was already correct. | Historical resolved case, not a current PlayCanvas defect. Reconcile resource ledgers with independent process/heap observations and repeated load/unload cycles before announcing a leak or a fix. |
| C08. [Textures surviving a scene switch][pc-unload], PlayCanvas forum, 27 July 2022 | The discussion distinguishes destroying scene entities from unloading retained texture assets. | An engine migration still needs asset ownership, sharing and an unload policy. Releasing one map must not destroy a texture still owned by another active scene. |
| C09. [Audio-related growth in a web export][godot-audio], Godot forum, 7–8 June 2025 | The author isolates growth by repeatedly playing sound effects; disabling those effects stabilizes their test while scene/node counts remain stable. The underlying audio cause is not resolved in the thread. | A stable object count does not exclude growth elsewhere. Include motor audio, menu audio and repeated effects in a long session; do not assume every browser memory problem belongs to graphics. |
| C10. [Slow startup on a local web server][reddit-local], Reddit/Godot, 9 October 2026 | The developer reports sluggish early gameplay even through a server on their own computer, with better behavior after a previous run. Replies speculate about browser support; the author confirms Chrome and disabled threading. | Unresolved report. It illustrates why transfer, WASM initialization, compilation and first interaction must be separated. It proves neither that the network nor the engine is the cause. |

The first two rows are one project's experiences across two posts. Several
threads include AI-assisted write-ups. Their disclosure, confidence or polished
language does not substitute for inspectable artifacts, matched rendering and
reproduction. Conversely, dismissing an entire report because AI assisted it
would discard useful corrections and source-linked evidence.

### C11. Browser-game postmortem: a cache can waste its own preload

[Shards of Stone][shards], dated 11 June and updated 13 August 2026, describes
compressed variants silently absent from deployment metadata, and a preload
that fetched far more decoded image data than its cache could retain. Its
revised preload selects a fitting working set first, rather than loading and
immediately evicting most of it. These are firsthand postmortem claims, not a
reproduced benchmark.

Transferable lesson: validate the release manifest and admit work before it
allocates. Do not copy its absolute memory caps or device-memory formula into
Parvoz. Also narrow its statement that compression cannot fix memory: that
applies to the discussed ordinary image encodings; GPU-compressed textures
change residency. A cap on retained entries alone cannot bound temporary
decode/upload memory or an active set that exceeds the cap.

### C12. Babylon cache retention: read through to the resolution

The [3–14 October 2026 thread][babylon-cache] begins with retained WebGPU bind
groups and includes explicit corrections to early stress-test interpretations.
It ends with an application-controlled cleanup policy working under ordinary
GC in the measured streaming workload; the maintainer does not request default
runtime eviction. The project's threshold is explicitly not a general setting.
JS object collection does not establish exact native descriptor-release timing.

[PR #18977][babylon-cache-pr] merged on 10 October. We separately checked the
[9.32.0 implementation][babylon-dispose]: disposing the last WebGPU engine
resets the two static caches. Therefore this is not evidence that the current
release has an unfixed last-engine teardown leak. It remains a useful reason
to test resource churn over long visits, reuse resources where possible, and
measure cache retention separately from live scene resources. Do not transplant
Babylon-specific reset calls into Three.js.

## Frame time and rendering: community results with important caveats

### C13. Approximately 87 reported FPS was not smooth displayed motion

In a [13–23 October Babylon optimization discussion][babylon-cpu], the author
corrects an uncapped test: the page reported about 87 FPS while a recording
showed only 71–76 distinct images in 81 seconds. Work had queued far ahead of
the GPU. The maintainer explains that queue-completion promises are not
presentation timestamps and asks for sequence numbers, traces and separate
FPS-cap/queue-limit comparisons. Proposed opt-ins are not established shipped
APIs merely because they appear in a forum post.

The same discussion redirected effort from reducing encoder calls toward
measured scene/material work. It also distinguishes whole-frame CPU divided
by draws from isolated draw-call cost. For Parvoz, keep detailed counters
outside timing runs and capture normal-paced motion. Do not infer input latency
from `onSubmittedWorkDone()` or copy a universal four-frame queue limit.

| Case | What it contributes | What it does not establish |
| --- | --- | --- |
| C14. [Open-world R3F/Three WebGPU demo][reddit-openworld], Reddit, 28 July 2026 | Real-user device feedback contradicted the developer's experience. The author subsequently disabled postprocessing and adjusted quality; initial boot was reported at 15–30 seconds. | A good development video and a modern stack do not establish cross-device playability. The post's guesses about cache behavior and texture limits are not confirmed mechanisms. Preserve exact Low settings during comparisons. |
| C15. [Axion light pooling and integration queue][reddit-axion], Reddit, 15 March 2026 | The author reports avoiding shader variants through fixed light pools and spreading scene integration over frames. A commenter reports workers increasing total load time on Quest. | Self-reports without matched public traces. Pooling has shader/light costs, and one chunk per frame is not a time bound when chunks differ. Measure shared worker CPU/memory pressure, transfer copies and per-chunk integration cost. |
| C16. [WebGL/WebGPU visualization comparison][reddit-compare], Reddit, 31 July 2026 | The team reports opposing backend results on Intel Gen9 and AMD GCN5, with a postprocessing-heavy scene. | The changed triangle/draw counts need pass accounting before being interpreted as equal work. No reproducible UHD 620 acceptance result is provided. A bandwidth-bound fullscreen effect and CPU submission pressure demand different remedies. |
| C17. [BatchedMesh resize artifacts][three-batch], Three.js forum, 13–14 January 2026 | On r182 WebGPU, the reporter associates a frame of incorrect transforms with buffer resizing and reports preallocation as their workaround. | Self-resolved, not a verified current-release general bug. Test allocation growth, LOD changes and spawn transforms; reserve bounded capacity rather than an unlimited maximum. |
| C18. [Godot web CPU usage issue][godot-cpu], GitHub, 26 March–10 April 2026 | A 4.6.1 minimal reproduction and another user report say an FPS cap/low-processor setting increases CPU usage. The issue remains open with `needs testing` at retrieval. | Do not label it confirmed on current Godot 4.7 or use it as a general engine ranking. Test idle/menu/background behavior as well as active flight in any migration candidate. |
| C19. [15-million-node WebGPU stress demo][hn-nodes], Hacker News, 2025 discussion | Author describes GPU compute, culling and indirect draws for moving rectangles. A visitor reports millions at 60 FPS on RX 7800 XT; the author reports freezing their PC at a much larger count. | Rectangles and GPU-resident simulation are not imported PBR scenery, collision, networking or loading. Study the architecture, but do not run unbounded stress counts or extrapolate them to a drone simulator. |

## Public benchmarks: useful harnesses, different questions

These were inspected, not run. They have different scenes, timing definitions,
output paths and devices. Combining their FPS tables into a single engine
league table would be misleading.

| Benchmark | Reproducible material inspected | What we can reasonably take from it |
| --- | --- | --- |
| B01. [Web Engines Compare, October 1 snapshot][compare-readme] | Pinned source `92c450a`; separate objects, many materials/meshes, shadows, Chrome on M4 Max, RTX 2070 Windows and Pixel 8 Pro. CPU timing includes the engine frame, excluding GPU execution; its default per-count window is only 20 measured frames after short warmup. Three's WebGPU opaque sorting is explicitly adjusted by the adapter. | PlayCanvas 2.23 is a credible CPU-submission challenger. Ratios are not isolated API-call latency, scene-independent speedups or a long-session result. Keep adapter defaults/overrides visible. The author's PlayCanvas affiliation is disclosed context, not grounds to ignore the open harness. |
| B02. [Endel's multi-engine suite][endel] | Pinned source `25723d7`; M1 Pro results across Chrome/Firefox/Safari, naive and optimized paths, animation, instancing, lights, postprocessing and loading. Its harness distinguishes classic Three WebGL from the node renderer fallback. It uses 1920×1080, 4× MSAA, special uncapped browser flags and mostly short samples. | Useful scenario matrix and independent timing/counter passes. Its “frame cost” proxy takes max(CPU p95, GPU p95); it is not displayed frame-time p95. Fastest-repeat startup reporting cannot characterize first-visit download. Safari/Firefox observations are version-specific. Do not copy its headline “best engine” as a universal verdict. |
| B03. [Plant benchmark][plant], Three.js forum, 22 October 2026 | r186.1, owned 6,056-triangle fixture, 240 desktop attempts; classic WebGL, actual WebGPU and forced node WebGL2. Published data/harness, five repeats, visible pages, 1280×720 on RTX 5070 Ti. | Most small instanced rows hit display pacing. A native-WebGPU BatchedMesh row reports 1,001 renderer calls where classic WebGL reports one; these are counters, not directly counted API calls. Qualify each backend rather than inferring batching behavior from the public object type. No target-laptop or phone acceptance follows. |
| B04. [DriftEngine six-engine comparison][drift-benchmark], 11 October 2026 | Vendor-authored comparison with method, images and limitations. RX 9070 XT desktop and phone, five scenes, release pins; desktop fixed-count runs interleaved three times, phone/search cells once. | The report acknowledges phone weaknesses and differences such as automatic ECS instancing versus explicit instance arrays. Useful additional evidence against one universal ranking. Its ceiling searches and averaged timing readings are not our acceptance protocol; a non-flat image alone cannot prove every expected object rendered. |

For B01/B02, benchmark counters and timers can validate parts of a hypothesis
without predicting Parvoz. For B03, retain the downloadable fixture's own terms;
the measurement data being CC BY 4.0 does not license the developer's private
garden runtime or seasonal production assets.

## Newly qualified systems found through community leads

The [metadata/source audit](research/browser-stack-20261025/community-source-audit.json)
records retrieval time, three npm packages, sixteen fetched source-file hashes
and fixed repository references. The
[collector](research/browser-stack-20261025/collect-community.mjs) reads public
data only. A repository HEAD and its published npm artifact are not automatically
the same revision.

### OptiPixel: worthwhile occlusion reference and PlayCanvas extension

[The forum introduction][opti-forum] leads to [OptiPixel's source][opti]. npm
`playcanvas-opti-pixel` is 1.2.0, published 17 August 2026, declared Apache-2.0.
The inspected HEAD is `1cb3a2e`, whereas the npm metadata identifies `7513ab4`;
HEAD documentation is not proof of the exact published package behavior.

The [backend guide][opti-backends] makes an important distinction: WebGPU HZB
writes indirect arguments on the GPU; WebGL HZB supplies delayed CPU results
using readback. A software worker path can use explicit occluders, and unknown
results must remain visible. It also warns against running duplicate readback
testers. This is substantially more useful than an unqualified “occlusion
supported” badge.

**Parvoz decision:** test only after spatial grouping and measured visibility
cost. The PlayCanvas extension is not a Three plugin. A direct port would need
depth conventions, first-person geometry, foliage transparency, rapid camera
turns, shadow behavior, synchronization and lifecycle checks. Compare culling
off/on along the same indoor/outdoor route; count hidden geometry and extra
passes. An open aerial map may have little occlusion to exploit.

### FastHDR: a narrow asset-pipeline experiment, not a map loader

[A Needle developer's Reddit post][reddit-fasthdr] leads to the
[FastHDR documentation][fasthdr]: preprocessed environment lighting using KTX2
HDR and offline PMREM work. Its broad zero-CPU/no-stall/all-device language is
vendor marketing, not a device-independent guarantee.

Three's [r180 KTX2Loader][ktx-r180] already has an HDR branch, worker transcoding
and an uncompressed half-float fallback. This supports a small experiment using
a compatible preprocessed environment without assuming an engine migration is
necessary. It does not prove a particular Needle file, PMREM layout, decoder
binary and backend combination works correctly in Parvoz.

For the full Needle engine, npm `latest` currently resolves to **6.0.0-alpha.7**;
its separate `stable` tag is **5.1.16**. These are different from the standalone
progressive library's versions in the preceding reports. Do not accidentally
install a prerelease or infer full-engine license/service terms from the MIT
progressive runtime. No paid/cloud processing is assumed approved.

**Parvoz decision:** first establish the existing environment's share of load
time and resident bytes. If material, compare current versus offline-prefiltered
lighting at the same visible quality. Log actual target format and fallback,
boot cost, upload spikes and reflections. A sky optimization cannot remove
Hangar's geometry or Pine's duplicated images.

### DriftEngine: public source merits inspection, migration remains unqualified

[DriftEngine's public repository][drift] and core npm package are Apache-2.0;
`@driftengine/core` 4.14.0 was published 18 October 2026 and its gitHead matches
the inspected `1d001b9`. The author describes a baked `.drft` representation,
region streaming, instancing recovery, GPU-compressed textures and a rendered
backend probe. Those features make its asset path worth examining.

The vendor's own benchmark is not independent production evidence. A compatible
asset converter, visual parity, long-session residency, cancellation, collision
preparation and actual target-device performance remain untested here. Generic
determinism/rollback features also do not validate our flight model.

**Parvoz decision:** research/watchlist, behind the smaller PlayCanvas comparison
and existing Three streaming candidates. Any spike must replay existing Kestrel
simulation outputs through a rendering adapter. Do not replace flight physics,
network protocol, accounts or admission rules to make a renderer benchmark work.

## Advice rejected or narrowed after fact-checking

| Common claim encountered | Checked interpretation |
| --- | --- |
| “Every browser tab has a 2 GB/4 GB limit.” | The old [V8 wasm32 article][v8-memory] describes linear-memory addressing, not a universal page-process/VRAM budget. GPU buffer binding limits are another quantity; [GPUWeb capability definitions][gpu-limits] distinguish them. Disk quotas are different again. Record the failing allocator, feature limits and device; do not invent a universal safe size. |
| “A refresh must download every asset again.” | [Browser storage documentation][storage] describes origin-specific storage, quotas and possible eviction. HTTP caching and application caches also have separate policies. Test cold, warm, evicted and changed-revision runs. Disk persistence never implies assets remain decoded or resident on the GPU. |
| “WebGPU has no software implementation, so headless success proves hardware.” | [Dawn's test infrastructure][dawn-tests] includes SwiftShader tests. Conversely, normal browser exposure is not guaranteed: the [current Emscripten report][emscripten-swift] shows a launch flag preventing WebGPU availability. [Chromium's documentation][chromium-swift] also distinguishes opt-in software testing from deprecated automatic WebGL fallback. Verify the actual backend/adapter; software correctness runs are not FPS acceptance. |
| “Request high performance and the discrete GPU is guaranteed.” | [GPUWeb's adapter-option contract][gpu-preference] calls power preference a hint. Adapter choice can depend on system state. Log the actual adapter when exposed and retain OS/browser diagnostics. |
| “KTX2 is uploaded with zero processing” or “cannot contain HDR.” | [Khronos KTX][ktx] and [Basis codec documentation][basis-hdr] describe multiple payloads and transcoding. A container suffix alone proves neither resident compression nor HDR support on a specific path. Worker work still uses CPU and memory. Keep loader/decoder revisions aligned and check the selected target. |
| “A 1024² RGBA8 texture becomes 16 MB with mipmaps.” | A [2026 Godot forum post][godot-art] contains this incorrect arithmetic and sweeping pipeline claims without a reproducible harness. The base is 4 MiB; a complete ordinary square mip chain is approximately 5.33 MiB total, not 16. The entire post is not reliable benchmark evidence just because it contains a table. |

The mip calculation is `4 * (1024² + 512² + ... + 1²)` bytes. Driver alignment,
other copies, render targets and different pixel formats are additional costs;
they should not be mislabeled as the mip chain. HDR support is also not implied
by older LDR-specific descriptions of UASTC; inspect the exact codec revision.

## Concrete next experiments for Parvoz

These are proposed, not executed by this research. They extend the previous
reports rather than restarting imports or regenerating retired content.

| Priority | Bounded experiment | Evidence needed to choose the next step |
| --- | --- | --- |
| 1 | Pine exact-byte image deduplication and shared content-hash assets; preserve editable sources, permission metadata and visual content | Actual delivery reduction versus the previously measured 68.783 MB intra-map opportunity; no new material/texture duplication at runtime; identical map appearance and correct cache invalidation. Do not promise equal RAM savings from encoded-byte dedup alone. |
| 2 | Trace one cold load, one warm load and first interaction on Minus Two, then a geometry-heavy map | Separate download, full-body copies, JSON parsing, Meshopt, KTX transcode, object creation/clone, collision preparation, pipeline compilation, GPU upload and first playable frame. Network-only tuning is justified only by the trace. |
| 3 | A globally budgeted loading/streaming scheduler with existing 3D Tiles/Needle candidates as references | Reserve estimated decoded/transcoded/upload bytes before starting jobs; cancel stale work, discard late results and bound integration by measured time and bytes. Saturated pinned residency must choose coarser detail or defer work instead of endless load/evict churn. Check transient peaks, not only a post-load cache counter. |
| 4 | Controlled Meshopt worker counts and reuse, under the combined collision/KTX workload | Compare zero/one/two geometry workers with identical input and quality; record main-thread long tasks, time-to-playable, copies, worker count and peak memory. Faster total load with worse input responsiveness is a tradeoff to expose. More workers is not the result by definition. |
| 5 | PlayCanvas render-only challenger against current Three classic WebGL and actual WebGPU paths | One matched map slice, materials, shadows, draw set, internal resolution and camera route. Report native batching/counters and pixels; preserve simulation. Include Babylon's normal and documented fast paths if it enters a later comparison. Re-recording and invalidation costs belong in streaming tests. |
| 6 | Long-session ownership/recovery test before production integration | Revisit cells, switch maps repeatedly, cancel mid-load, respawn, use effects/audio, background/resume, resize and lose/recreate the graphics device. Observe resource counts, process/JS/ArrayBuffer trends and visible correctness after recovery. [Device loss][device-lost] can happen after initialization; successful startup fallback alone does not cover it. |

For streaming, our proposed accounting invariant is that **admitted jobs plus
resident assets plus reserved transition headroom fit the selected budget**.
Separate ledgers are needed for network buffers, decoded CPU geometry, image
transcode output, GPU buffers/textures and retained pipeline/bind-group state.
These are estimates reconciled with observations, not a claim that browsers
expose exact total VRAM. Deduplicate by content and sharing ownership before
counting; prevent a shared texture from being charged or destroyed per instance.

Protect flight collision independently of visual LOD: visual eviction must not
remove a collider the drone can reach before the next chunk is ready. Derive
look-ahead from measured flight speed and tail fetch/prepare latency. Include
turnaround/revisit and poor-network routes, not only forward motion through
successfully prefetched cells.

Acceptance remains the actual **i5/UHD 620, Low, 1280×720 internal framebuffer,
adaptive resolution off**, median frame time at most 16.7 ms and 1% low at least
50 FPS. Record the precise 1%-low calculation and frame-time percentiles rather
than silently substituting a different statistic. Keep the earlier moving-route
protocol, normal VSync behavior, repeated runs and separate cold-start results.
Log backend, framebuffer, browser/driver, render passes, triangles, draws,
resource estimates and pipeline events. Supplement page timing with sequence
numbers and browser/presentation evidence where available; capture limitations
must be stated. Collect heavy profiling/counter captures separately.

No study here establishes that acceptance. Research-only changes require no
Oracle update. Existing player data, the 20-player admission limit, flight
parameters, Kestrel IDs and the retired Ironworks archive are outside these
experiments' mutation scope.

## Sources

All links were read during this research on 25 October 2026. Dates in the text
are publication/discussion dates, not the retrieval date. Repository hashes and
npm metadata are recorded separately in the source audit.

[reddit-sharing]: https://www.reddit.com/r/threejs/comments/1v68epk/worried_about_performance/
[reddit-migration]: https://www.reddit.com/r/threejs/comments/1vcnk3t/webgl_to_webgpu_migration/
[reddit-vhs]: https://www.reddit.com/r/threejs/comments/1x7hiix/a_tip_if_your_scene_has_a_lot_of_textures_use/
[reddit-ktx]: https://www.reddit.com/r/threejs/comments/1tseqjc/threejs_textureheavy_scenes_hit_vram_limits_fast/
[three-images]: https://discourse.threejs.org/t/help-with-large-images/60329
[pc-samsung]: https://forum.playcanvas.com/t/engine-2-23-1-gsplat-issues-on-samsung-internet-galaxy-tab-s8-ultra-buffer-over-webgpu-limit-with-budget-0-and-streaming-stalls/42657
[pc-stats]: https://forum.playcanvas.com/t/possible-memory-issue-with-model-asset-unloading/27005
[pc-unload]: https://forum.playcanvas.com/t/solved-is-it-normal-for-textures-to-not-unload-from-vram-on-scene-switch/26756
[godot-audio]: https://forum.godotengine.org/t/my-web-export-has-a-memory-leak/112958
[reddit-local]: https://www.reddit.com/r/godot/comments/1x1u2qs/performance_issues_loading_from_a_web_server_even/
[shards]: https://www.shardsofstone.com/blog/browser-game-memory-budget
[babylon-cache]: https://forum.babylonjs.com/t/webgpu-the-bind-group-cache-keeps-entries-for-disposed-meshes-and-textures-forever-also-after-engine-dispose/64212
[babylon-cache-pr]: https://github.com/BabylonJS/Babylon.js/pull/18977
[babylon-dispose]: https://github.com/BabylonJS/Babylon.js/blob/9.32.0/packages/dev/core/src/Engines/webgpuEngine.pure.ts#L4058
[babylon-cpu]: https://forum.babylonjs.com/t/webgpu-cpu-cost-per-draw-call-in-9-29-9-30-and-which-small-prs-would-you-welcome/64298
[reddit-openworld]: https://www.reddit.com/r/threejs/comments/1v8r3lb/openworld_webgpu_threejs/
[reddit-axion]: https://www.reddit.com/r/threejs/comments/1rucy28/building_a_aaastyle_open_world_engine_for_the_web/
[reddit-compare]: https://www.reddit.com/r/threejs/comments/1vbj3ca/we_tested_webgpu_vs_webgl_in_a_real_threejs_scene/
[three-batch]: https://discourse.threejs.org/t/batchedmesh-setmatrixat-delay-with-webgpu/89108
[godot-cpu]: https://github.com/godotengine/godot/issues/117875
[hn-nodes]: https://news.ycombinator.com/item?id=45935117
[compare-readme]: https://github.com/mvaligursky/web-engines-compare/blob/92c450af301dc0e40974f5539044982fb1cad751/README.md
[endel]: https://github.com/endel/webgpu-webgl-benchmarks/tree/25723d75c516488854794b8494a0a847bc9c933f
[plant]: https://discourse.threejs.org/t/three-js-plant-instancing-benchmark-240-desktop-samples-csv-json-and-a-standalone-harness/95719
[drift-benchmark]: https://driftengine.dev/blog/webgpu-engines-measured
[opti-forum]: https://forum.playcanvas.com/t/optipixel-library/42206
[opti]: https://github.com/AlexAPPi/playcanvas-opti-pixel/tree/1cb3a2ed0bb486c7e1820e5e782835062310685d
[opti-backends]: https://github.com/AlexAPPi/playcanvas-opti-pixel/blob/1cb3a2ed0bb486c7e1820e5e782835062310685d/docs/occlusion/choosing-backend.md
[reddit-fasthdr]: https://www.reddit.com/r/threejs/comments/1s1mdgc/working_on_fasthdr_support_for_needle_engine/
[fasthdr]: https://engine.needle.tools/docs/explanation/fasthdr.html
[ktx-r180]: https://github.com/mrdoob/three.js/blob/r180/examples/jsm/loaders/KTX2Loader.js
[drift]: https://github.com/drftrun/driftengine/tree/1d001b941b6ce138ac620b4666a2ab6d6b333731
[v8-memory]: https://v8.dev/blog/4gb-wasm-memory
[gpu-limits]: https://gpuweb.github.io/cts/docs/tsdoc/functions/webgpu_capability_info.getDefaultLimitsForDevice.html
[storage]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
[dawn-tests]: https://dawn.googlesource.com/dawn/+/b33d203f05723739550be35b0d21eaf51dd42236/infra/specs/test_suites.pyl
[emscripten-swift]: https://github.com/emscripten-core/emscripten/issues/27994
[chromium-swift]: https://github.com/chromium/chromium/blob/main/docs/gpu/swiftshader.md
[gpu-preference]: https://gpuweb.github.io/types/interfaces/GPURequestAdapterOptions.html
[ktx]: https://www.khronos.org/ktx/
[basis-hdr]: https://github.com/BinomialLLC/basis_universal/wiki/KTX2-File-Format-Support-Technical-Details
[godot-art]: https://forum.godotengine.org/t/godot-4-web-export-stutters-on-mobile-its-probably-your-art-pipeline-not-your-code-31fps-to-60fps-benchmarks-inside/143268
[device-lost]: https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost
