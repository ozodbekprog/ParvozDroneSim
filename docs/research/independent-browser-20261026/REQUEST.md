Perform an independent, thorough investigation of modern technology for high-performance browser-based 3D games.

My project is Parvoz Drone Simulator, currently using Three.js. I am dissatisfied with its memory consumption, FPS, frame pacing, map download times, loading times and general browser performance. Previous research was too shallow. I need a serious technology investigation that can change the architecture—not another generic Three.js optimization checklist.

STAGE ONE: RESEARCH AND ANALYSIS

Research first. Do not modify the game, install a collection of dependencies, migrate engines or deploy anything during this stage.

Do not assume that staying with Three.js is correct. Equally, do not assume that WebGPU or switching engines automatically solves the problems. Follow the evidence and recommend substantial changes if justified.

1. Investigate the current ecosystem broadly

Find and evaluate modern engines, rendering frameworks, libraries, plugins, asset pipelines, tools and complete systems relevant to:

- Memory ownership, resource disposal, sharing, pooling and bounded residency.
- CPU overhead, GPU performance, frame pacing and first-use stutters.
- Large-map delivery, spatial streaming, progressive loading and cancellation.
- Geometry compression, simplification, LOD/HLOD, meshlets and virtual geometry.
- Texture compression, texture streaming, mip residency, atlases, material consolidation and virtual texturing.
- Instancing, batching, indirect drawing, visibility systems, occlusion and GPU-driven rendering.
- Shader/pipeline compilation, prewarming and runtime material changes.
- Workers, transferable buffers, WASM, decoding and collision preparation.
- HTTP delivery, caching, range requests, persistent storage and resumable downloads.
- Profiling, browser/GPU diagnostics and repeatable performance testing.
- Free assets and authoring workflows that deliver good visual quality within browser budgets.

Compare complete engines as well as composable solutions around Three.js. Include alternatives outside the most familiar JavaScript libraries when they are credible for browser delivery.

Useful starting points—not the limits of the search:

https://github.com/mikbry/awesome-webgpu
https://github.com/topics/threejs-game
https://github.com/topics/webgl
https://github.com/topics/webgpu
https://webgpu.com/

Explore the projects behind these lists. Do not merely summarize the lists themselves.

2. Search beyond official documentation

Research various independent places:

- Reddit: relevant Three.js, WebGPU, WebGL, gamedev and engine communities.
- Three.js, Babylon.js, PlayCanvas, Godot and other engine forums.
- GitHub issues, discussions, pull requests, releases and example implementations.
- Browser implementation issue trackers.
- Hacker News and technical developer communities.
- Developers’ engineering articles, production postmortems and conference talks.
- Actual browser games, large-world demos and public benchmark repositories.

Prefer firsthand experience with shipped products or inspectable implementations.

Read replies, corrections, linked reproductions and maintainer resolutions. Distinguish an unresolved complaint from a confirmed defect, and a historical defect from a current limitation.

Identify conflicting evidence instead of selecting only posts that support a preferred engine.

Do not treat upvotes, GitHub stars, screenshots, impressive videos or vendor claims as performance proof. Several posts from the same developer/project are not independent corroboration.

3. Verify promising candidates deeply

For each serious candidate, establish:

- What problem it actually solves.
- How it works, including the relevant architecture.
- Current stable version and release date.
- Whether “latest” points to an alpha, beta or stable release.
- Maintenance status and compatibility requirements.
- License and practical costs, including separate cloud/editor services.
- WebGL2 versus WebGPU support and fallback limitations.
- Integration effort with an existing Three.js game.
- Asset preprocessing and format requirements.
- Memory behavior, including temporary allocations during loading.
- Known limitations, unresolved issues and failure cases.
- Evidence from real applications or reproducible benchmarks.
- What remains unverified.

Inspect relevant source code for finalists. Do not repeat a README claim as implementation verification.

For example, if a system claims “streaming,” establish whether it actually avoids downloading and decoding the entire map before first use. Check prioritization, cancellation, concurrency, unloading, shared resources, transient memory and behavior when the active working set exceeds its budget.

If it claims “batching” or “GPU culling,” determine what happens on each supported backend and what extra passes, synchronization or readback it requires.

4. Analyze the problems separately

Keep these distinct:

- Download size and network transfer time.
- Parsing and scene construction.
- Geometry decoding.
- Image decoding/transcoding.
- Collision preparation.
- Shader/pipeline compilation.
- GPU upload.
- Time until the player can actually fly.
- Steady-state CPU and GPU frame time.
- Long frames, input responsiveness and displayed motion.
- Long-session memory growth and map-switch peaks.

Distinguish encoded asset bytes, decoded CPU data, JS/WASM memory, GPU resources, browser-process memory and disk-cache storage.

Do not recommend a smaller download format as a memory solution without checking its decoded/GPU representation. Do not equate a completed fetch with a playable scene.

Explain which solution addresses which bottleneck, and which problems it leaves untouched.

5. Project context and constraints

The project is Parvoz Drone Simulator.

If repository access is available:
- Workspace: C:\DroneLiftoffUz
- Private repository: https://github.com/Fayzullo637/ParvozDroneSim
- Read AGENTS.md and docs/AI-QUICKSTART.md first.
- Respect other work already in progress.

If you cannot inspect the repository, state that clearly. Do not invent code findings or claim a technology is compatible with our implementation.

Known context to verify when possible:
- The game currently uses Three.js 0.180.0.
- Some compression, batching/instancing, LOD, caching and worker systems already exist.
- Determine what is actually active and effective before recommending features we already have.
- Several imported maps are large; use their actual delivery structure and content characteristics when available.

Minimum performance target:
- Intel i5 with integrated UHD 620.
- Low settings.
- Actual internal framebuffer: 1280×720.
- Adaptive resolution disabled during acceptance measurements.
- Target: 60 FPS, median frame time ≤16.7 ms, 1% low ≥50 FPS.

An RTX desktop, Apple Silicon or software-renderer result does not confirm this target.

Constraints:
- Keep the operating budget at $0.
- No paid asset purchases or services.
- Preserve existing flight behavior and Kestrel identifiers.
- Do not change accounts, production data or the 20-player multiplayer admission limit.
- Ironworks is retired; do not regenerate or reactivate it.
- Preserve imported-asset provenance and permission restrictions. Existing access to Liftoff content does not establish redistribution rights.
- Do not change or load-test production during research.

6. Required deliverables

Provide a substantial, source-linked research report containing:

A. The strongest findings
Explain what the investigation changes about the likely architecture and priorities.

B. An ecosystem comparison
Organize candidates by the problem they solve. Explain inclusion and rejection decisions. Breadth matters, but do not pad the report with irrelevant tools.

C. Community evidence
For important reports, include the date, original source, hardware/version where known, claimed result, reproduction quality, corrections/resolution and relevance to this project.

D. Deep evaluation of finalists
Include source-level findings, compatibility, memory/loading behavior, limitations, licensing and integration cost.

E. Recommended architecture options
Compare:
- Improving the current Three.js architecture.
- Adopting existing specialized systems around it.
- Migrating to another engine.

Be willing to recommend migration if the evidence supports it. Explain what evidence would change your recommendation.

F. A prioritized experiment plan
Specify small, decisive comparisons, their inputs, measurements and success/failure criteria. Include cold and warm loads, map transitions, fast flight, revisits, cancellation and long sessions.

Use matched visual quality, resolution, camera routes and simulation. Separate instrumented profiling from ordinary timing runs.

G. Remaining uncertainty
Clearly label:
- Independently verified facts.
- Source-code observations.
- External reported measurements.
- Engineering inferences.
- Untested hypotheses.

Use current information and include retrieval dates. Link directly to supporting material near each important claim.

Do not promise FPS improvements without measurements. Do not stop at “profile first,” “use KTX2,” “reduce draw calls” or “try WebGPU.” Explain which existing systems are worth using, why, how they fit together, their tradeoffs, and what evidence is needed before adoption.

The desired result is an implementation-ready technology decision, supported by broad investigation and deep analysis.