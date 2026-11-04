# Community evidence and conflicting results

Retrieved 26 October 2026. Supports section C of the
[decision report](../../INDEPENDENT-BROWSER-TECHNOLOGY-20261026.md).
All numerical results below are **R: external reports**, not measurements of
Parvoz. Hardware/version omissions are material. Replies and status were read
where described; linked demos were not executed. None confirms UHD 620 at a
fixed 1280×720 framebuffer with Parvoz's flight simulation.

## C1. Three.js, WebGPU and texture reports

| Date / original source | Hardware, workload and claimed result | Replies, reproduction and resolution | Consequence for Parvoz |
| --- | --- | --- | --- |
| 31 Jul 2026: [real-scene WebGPU/WebGL comparison](https://www.reddit.com/r/threejs/comments/1vbj3ca/we_tested_webgpu_vs_webgl_in_a_real_threejs_scene/) | Intel Gen9: approximately 195 FPS WebGL versus 172–184 WebGPU; AMD GCN5: 136 versus 205. About 262k triangles, GTAO/bloom/FXAA. Exact target framebuffer/driver parity not established. | A reply by estebanrfp challenges differing draw/triangle counters; the paths do not establish identical work. Fill/bandwidth explanations are hypotheses. Neither direction of the result should be discarded. | An Intel-family loss and AMD win can coexist. Test both backends with matched passes; do not use this as proof for UHD 620. |
| 27–28 Aug 2026: [compute-heavy comparison](https://www.reddit.com/r/threejs/comments/1vzl57h/webgpu_vs_webgl_ver21/) | A commenter reports 1M elements at 60 versus 11 FPS on iPhone 16 Pro/Brave; another reports 50 versus 16 without detailed hardware. | Read the replies. This is a compute-oriented demo, not a controlled triangle-map rendering comparison; timing, thermal and presentation methods are incomplete. | Positive evidence for suitable compute workloads, not a forecast for the current imported maps. |
| 1–3 Aug 2026: [Lorebound WebGPU migration](https://www.reddit.com/r/threejs/comments/1vcnk3t/webgl_to_webgpu_migration/) | Author reports p95 frame time 169→1,539→54 ms across migration and subsequent material pooling/preparation. Device details do not establish a matched target test. | Pixel/Chrome and iPhone 13 mini/Safari replies still report stutters and 10–20 s transitions. The author's mobile-memory explanation is not a measured cause. Posts from this same project are one evidence family. | Pooling/preparation can address variant churn; migration can initially worsen tails. Validate transitions and mobile/backend limits separately. |
| October 2026; exact absolute publication date not exposed in retrieved view: [VHS texture conversion](https://www.reddit.com/r/threejs/comments/1x7hiix/a_tip_if_your_scene_has_a_lot_of_textures_use/) | Author claims texture memory about 1.5 GB→335 MB with KTX2, while download grew 26→34 MB. Hardware and accounting method are incomplete. | A reply asks for the actual transcode format and repeated room/cover cycling. No independent sustained-memory replication was found. The page's relative age is not used to invent a precise date. | A useful counterexample to “smaller download equals smaller GPU memory.” Log format/mips and ownership; Parvoz already uses KTX2. |
| 19 Feb 2025, still open at retrieval: [Three #30560](https://github.com/mrdoob/three.js/issues/30560) | r173, M1 Pro, 20k separate cubes: approximately 60 FPS WebGL versus 15 WebGPU reported. | Inspectable synthetic reproduction; open issue does not establish that every later release/workload has the same cost. | Retain separate-mesh and instanced arms; isolate submission overhead from large-map GPU cost. |
| 17 Mar 2026: [Three #33194](https://github.com/mrdoob/three.js/issues/33194), linked [#32916](https://github.com/mrdoob/three.js/issues/32916) | Windows 11/RTX 5080, roughly 1,300 multi-material meshes; reported 66 versus 54 FPS and 80 versus 211 MB. Exact release identification is weak. | #33194 is closed as a duplicate, not proof of a universal fix. #32916 was completed in May with its work linked to #26673/r185. Distinguish that history from still-open #30560. | Exact-release comparison matters. Do not cite a historical complaint as a current confirmed regression or treat closure as target acceptance. |

## C2. Public benchmark repositories

| Date / source | Controlled scope and reported measurements | Bias, corrections and missing evidence | Decision value |
| --- | --- | --- | --- |
| 1 Oct 2026 results: [Web Engines Compare](https://github.com/mvaligursky/web-engines-compare) | Chrome 154; M4 Max, i7-10700F/RTX 2070 and Pixel 8 Pro. 1k–20k boxes, 100 meshes/materials, textured PBR plus shadows. Windows CPU µs/draw: PlayCanvas 1.66 GL/1.22 GPU, Three 2.10/4.68, Babylon 4.83/7.34. | Public MIT harness, authored by a PlayCanvas developer. Default unfrozen, non-instanced submission test; tiny boxes intentionally stress CPU. No UHD 620 or production flight scene. | Strong enough to prioritize a PlayCanvas experiment. Insufficient to select an engine or multiply these ratios into Parvoz FPS. |
| September 2026 versions/results: [Endel's independent harness](https://github.com/endel/webgpu-webgl-benchmarks) | Chrome 151/M1 Pro; Three r186, PlayCanvas 2.22.2, Babylon 9.26. Separate 5k animated meshes report 12/24/29 ms CPU respectively; instanced 50k workloads are much closer. | A different author from the first harness, but still one hardware platform. Many runs do not create hardware diversity. CPU timing is not display time. Defaults and tuned paths need separate comparison. | Corroborates a workload-specific submission advantage, while contradicting a blanket engine-speed ranking. Use the actual Parvoz instance/material distribution. |

Neither repository was run during this stage. Public code and reported data
are better than screenshots, but they do not replace matched application inputs.

## C3. Babylon maintainer discussions

| Date / source | Report and inspectable evidence | Replies / current resolution | Relevance |
| --- | --- | --- | --- |
| 13–23 Oct 2026: [draw-submission and pacing discussion](https://forum.babylonjs.com/t/webgpu-cpu-cost-per-draw-call-in-9-29-9-30-and-which-small-prs-would-you-welcome/64298) | Streamed city author proposes small renderer changes. Initial page-side FPS was much higher than distinct captured motion. Latest update reports 56.8 distinct FPS and a 50 ms worst gap. Hardware/method do not establish Parvoz acceptance. | Evgeni Popov explicitly corrects queue-completion versus presentation assumptions and requests isolated pacing comparisons. Proposed changes are not all merged fixes. | Use ordinary vsync timing, presentation evidence and separate capture runs. This is the same author/project as the cache discussion below, not independent corroboration. |
| October 2026; teardown resolution 11 Oct, follow-up through 14 Oct: [bind-group cache lifetime](https://forum.babylonjs.com/t/webgpu-the-bind-group-cache-keeps-entries-for-disposed-meshes-and-textures-forever-also-after-engine-dispose/64212) | Public reproduction distinguishes disposed assets from retained JS bind-group cache entries. A later 20-minute streaming-policy comparison bounds JS objects, while GPU-process medians remain similar, about 1,265/1,285 MB. | Maintainer confirms the last-engine teardown fix, merged as PR #18977. Persistent-world cache policy remains an application concern. Maintainer also separates JS objects from native descriptors. | Do not claim that teardown fixes bound streaming residency, or copy the author's route-specific 545-unload reset interval. Source audit checks the current disposal path separately. |

## C4. PlayCanvas forums and production architecture

| Date / source | Report / hardware | Replies and resolution | Relevance |
| --- | --- | --- | --- |
| 9–10 Oct 2026, automatic closure 13 Oct: [Samsung Internet splat budgets/stalls](https://forum.playcanvas.com/t/engine-2-23-1-gsplat-issues-on-samsung-internet-galaxy-tab-s8-ultra-buffer-over-webgpu-limit-with-budget-0-and-streaming-stalls/42657) | Engine 2.23.1, Galaxy Tab S8 Ultra, desktop-style UA. Budget 0 allowed an allocation beyond the device's 134,217,728-byte storage-buffer limit. | Maintainer explains the budget/device-limit issue; author applies a mobile budget. Initially blamed scheduler stalls were also found with 2.22. HTTP/2 was hypothesized, not established as a browser defect. | Query actual limits and bound admission; browser detection is insufficient. Preserve corrections rather than reporting “new scheduler broken.” Splats differ from triangle cells. |
| 2021–Jan 2022: [Meshopt/texture GLB loading](https://forum.playcanvas.com/t/glb-loading-with-meshopt-compressed-textures/23363) | Historical compressed-container setup; no target performance measurement. | Maintainer supplies preview engine/updated Basis and decoder setup. Author reports success after preload/configuration changes. | Resolved integration history, not proof that current PlayCanvas cannot load compressed GLBs. Qualify the exact codecs/extensions in a migration slice. |
| 9 Apr 2026: [colliders for streamed splats](https://forum.playcanvas.com/t/how-to-properly-add-mesh-colliders-to-streamed-gaussian-splats/42116) | Developer asks how physics should follow streamed visuals. No frame/memory benchmark. | Maintainer distinguishes visual splat streaming from collision data. Other suggested synchronization approaches are proposals, not measured engine guarantees. | Collision coverage needs its own policy. A visual LOD selection must not remove a solid surface during fast flight. |
| 2026, exact publication date not resolved from retrieved page: [Grace Cathedral engineering account](https://blog.playcanvas.com/building-the-grace-cathedral-experience/) | Vendor-hosted implementation story: separate exterior/interior sets, coarse-first SOG, different desktop/mobile splat budgets. | Architecture is described, but no matched Parvoz assets, complete frame-time distribution or independent target run. | Supports useful working sets and coarse-first delivery. It does not establish streaming support for existing monolithic triangle GLBs. |

## C5. Godot experience and browser implementation issues

| Date / source | Hardware/version and report | Replies / status | Relevance |
| --- | --- | --- | --- |
| 18–19 Dec 2025: [Godot web driving-game stutters](https://www.reddit.com/r/godot/comments/1ppdrz0/having_trouble_optimizing_my_3d_game_for_the_web/) | Compatibility renderer, render scale 0.5, max 60 FPS; first particles/meshes stutter despite preparation attempts. Exact hardware absent. | CPU particles and acceleration checks suggested; author says particle change barely helped. No confirmed general resolution in the read replies. | A migration/editor export can retain first-use stalls. Particle advice is not a diagnosis of a different simulator. |
| 21 Aug 2026: [mobile art-pipeline report](https://forum.godotengine.org/t/godot-4-web-export-stutters-on-mobile-its-probably-your-art-pipeline-not-your-code-31fps-to-60fps-benchmarks-inside/143268) | Author reports 31→60 FPS and 612→152 MB after asset changes; 22 s loading also discussed. | Detailed target hardware and independently runnable comparison were not established in the retrieved material. Promotional/generalized “most problems are art” claims are not accepted as population evidence. | Illustrates a plausible asset route; not a promised gain or reason to stop renderer investigation. |
| 26 Mar 2026, still open: [Godot #117875](https://github.com/godotengine/godot/issues/117875) | 4.6.1, Linux/RTX 5080/Ryzen 9800X3D; web export unexpectedly consumes more CPU with larger low-processor sleep or FPS cap. Minimal project attached. | April reply independently reports lower CPU after removing a cap. Issue remains “needs testing,” with no merged fix visible. | Useful reproducible pacing warning. It concerns a particular web delay path, not proof that Godot 4.7.2 or all exports are affected. |
| 14 Jan 2026: [Chromium #475719023](https://issues.chromium.org/issues/475719023?pli=1) | Integrated Intel indirect-draw device-hung report with a small reproduction. Exact UHD 620 equivalence not established. | Assigned/P2/unconfirmed at retrieval; no verified resolution observed. | A driver/backend qualification case. Do not generalize to all Intel GPUs or enable unsafe features to bypass it. |

## C6. Hacker News, actual applications and native-engine experience

| Date / original source | Firsthand scope | Corrections / evidence quality | Project relevance |
| --- | --- | --- | --- |
| 16–17 May 2024: [PlayCanvas announcement discussion](https://news.ycombinator.com/item?id=40379982) | The thread digresses into Unreal web ports: a commenter reports a 117 MB WASM delivery and many tiny files; another waits minutes on RTX 4090. | Port vendor replies with an 8 MB compressed-runtime claim and separate streaming work. These are different demo/build/compression contexts, not a matched contradiction or PlayCanvas loading failure. Other replies report unsupported limits. | Runtime package, request layout and time-to-play matter even on powerful hardware. Historical 2024 browser-support comments are not current support facts. |
| Approximately Nov 2025; precise date not resolved: [15M moving-node discussion](https://news.ycombinator.com/item?id=45935117) | Three-comment discussion read: compute/culling/indirect rectangles; RX 7800 XT/Chromium 142 commenter reports millions at 60 FPS. | Author clarifies visibility/workload; very large settings can freeze the machine. No stress demo was run. Tiny 2D rectangles are not textured scenery. | Evidence of a GPU-driven technique, not large-map delivery, realistic shading or target-laptop performance. |
| 12 Mar 2026: [Fingersoft production interview](https://defold.com/2026/03/12/Interview-Fingersoft/) | Firsthand producer account of five engine prototypes and shipping Hill Climb Racing Lite on Poki; runtime size/tooling/native physics extension influenced Defold selection. | Vendor-hosted interview, not an independent benchmark. Real shipped web production, but a different predominantly 2D game. | Demonstrates an evidence-led engine selection process and native-extension option. Does not certify dense 3D maps or justify replacing Parvoz physics. |
| Current README retrieved 26 Oct 2026: [Skyfall air-combat prototype](https://github.com/a7ul/skyfall) | Desktop Chrome/WebGPU prototype with city tiles. User downloads ZIP parts and grants access to a local map folder; coarse local tiles precede refinements. | Inspectable setup/README, not a complete source/runtime audit or measured production postmortem. Associated HN story had no replies. “AAA” ambitions are not performance evidence. | Relevant flight/map example, but full-map distribution and disk setup occur outside the local readiness experience. Do not present that as instant network streaming. |

## Evidence handling and unresolved gaps

### Additional firsthand production engineering

These three accounts are from **one developer**, Anderson Mancini, and must
not be counted as three independent confirmations:

| Date / primary account | Report and method | Limits and relevance |
| --- | --- | --- |
| 24 Aug 2026: [Threejs-Punk upload overhead](https://andersonmancini.dev/blog/threejs-punk-fewer-uploads-faster-frames) | M2 Max/headless Chrome, reported CPU 7.4→2.4 ms and buffer traffic about 4.1 MB→40 KB/frame after several changes. Describes instance matrices, dynamic attributes and render-group identity. | Multiple changes prevent attribution to one mechanism; headless throughput is not displayed pacing. Exact r180 source inspection in D8 identifies a relevant local seam, without importing the reported gain. |
| 18 Oct 2026: [Endurance iPhone memory investigation](https://andersonmancini.dev/blog/endurance-racing-iphone-gpu-memory) | Reports phone jetsam logs and desktop WebKit footprint experiments; changes shader-module retention and warmup. iPhone 13/iOS 27.0.1 cold launches: new build 5/5 survived versus old 3/5. | Useful distinction between requested resources and process footprint. Approximate 300 MB highwater is observed on those devices, not a universal browser cap. Small sample and desktop/phone methods differ; remaining process/first-frame growth is acknowledged. Do not blindly delete renderer caches. |
| 11 Oct 2026: [octahedral TSL implementation](https://andersonmancini.dev/blog/octahedral-impostors) | Open MIT demo replaces distant trees with blended direction-atlas cards. Reported draw/triangle counts demonstrate representation, not a frame-time benchmark. | Source inspected at a pinned commit in D9. Hemisphere assumptions, atlas memory, unbounded demo cache and alpha edges need adaptation for drone flight. No target FPS result. |

The showcase [Project Endurance](https://webgpu.com/showcase/project-endurance-webgpu-racing/)
was used to discover the developer's original accounts, not as performance proof.

- Reddit posts include contradictory backend outcomes and unresolved reports.
  They are useful failure cases and experiment seeds, not engine rankings.
- Forum/issue status is the retrieved status, not a promise about later fixes.
  Duplicate closure, automatic topic closure and a merged teardown fix have
  different meanings.
- Vendor-hosted articles, employee benchmarks and repeated posts by the same
  team are labeled. Independent authorship alone does not ensure matched work.
- Firsthand shipped 3D-web postmortems with raw long-session memory, displayed
  frame times and UHD 620 data remain scarce in the inspected sources. No such
  target acceptance result was found. This is an evidence gap, not proof that
  a candidate cannot meet the target.
- One HN page later timed out on re-fetch; the earlier three-comment view was
  used. Two newer HN stories retrieved as JSON had no children and were not
  represented as discussions with read replies. No private/login-only replies
  were inferred.

The resulting experiments are specified in section F of the decision report.
They deliberately test the failure modes above rather than repeat their FPS
claims as expected improvements.
