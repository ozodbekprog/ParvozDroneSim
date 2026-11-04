# UI, loading, cameras and graphics — 18 October 2026

User request: unified Back buttons; map status inside previews across Fly,
Career, Flight School and Victory; stable profile; help moved to Settings;
Uzbek (Latin), Russian and English including first launch; real Ultra loading
captures with gentle motion; measured Hangar/map loading and Pine/Green FPS
repairs; a separate rigid third-person camera; PBR improvements across maps.

**ui-performance-04 is deployed and finalized** at 2026-10-18T17:11:13.765Z,
source **a469168672489b585ccf7a0337313a48613a3e32**. Integrated UI, language,
camera, loader and material changes, bounded compilation and the repeated-preview
placement repair are online. **443/443 tests**, final local/VM builds, all 112
public deliveries and two-client multiplayer on both new maps pass. Actual
browser checks include the visibly rendered model after repeated Hangar entry.
Revision **c39594a402708803**, protocol **13**. See
[deployment and backups](ORACLE-DEPLOYMENT.md).
The status here supersedes earlier investigation-stage publication notes below.
Preserve production data, admission 20, Always Free / $0, provenance, editable
sources and both the runtime asset mount and retained canonical source release.

## Late browser findings: repeated preview placement

The Hangar still called the renderer's full-scene compiler directly. It now
uses `World.compileGraphics()`, preparing visible variants in the actual
scene-pass context. A second visual check caught an independent cache bug:
returning previews were hidden when their tabletop bounds were measured.
An empty box has an infinite minimum, which moved the model to a nonfinite
height and left the preview blank. Restore the root's visibility before
measuring its visible parts, and skip empty bounds. Hidden stock parts remain
excluded. A regression test reopens the same hidden model three times, checks
finite tabletop placement and also covers an empty model. All 22 affected
scene/compile/orbit tests pass. The actual model is visible after repeated
local entries: [corrected preview](design/ui-performance-20261018/21-local-restored-preview.jpg).

Earlier timing based only on the disappearance of the busy caption did not
prove a rendered model and is not an accepted visual result. Before-fix blank
frames are retained as diagnostic evidence. Local UI action timings alone are
not treated as end-to-end rendering measurements.

The -04 patch also translates the CSS preparation caption in Russian and Uzbek.
The full 443-test suite passes after these final fixes. The -03 package is an unpublished,
superseded local artifact; do not deploy it. No -03 VM release was created.

Final public repeated Minus Two/Luma entry took **1,055 ms including browser
commands**, waiting for the actual stage `aria-busy` state to clear, with the
model visually verified, at 1040×585. See
[final Russian Hangar](design/ui-performance-20261018/19-online-final-hangar.jpg).
This does not establish cold-load speed or UHD 620 performance. Earlier warm
timings paired with blank previews are superseded by this visual result.

Remaining Low geometry work is an asset problem as well as renderer cost.
Counting all exported instances in the canonical deliveries gives Pine
LOD0/LOD1 **11,544,852 / 11,544,852** triangles and LOD2 **10,162,204**;
Green gives **7,163,313 / 7,163,313 / 7,160,757**. These are whole-map totals,
not the visible frame counts above. Merely selecting the existing farther
level cannot reach the 150–300k Low budget. A next asset pass needs genuinely
reduced trunk/structure geometry and baked distant canopy representations
that keep the original tree placements and canopy outline. Do not repeat the
rejected random foliage thinning or interpret fewer draw calls as fewer triangles.

## Completed locally: navigation and download badges

Removed the redundant home heading and moved help to the bottom of Settings.
Back actions share opaque grey styling; English labels and the distinct drone
selection button are preserved. Profile panel dimensions are stable between
Records/Achievements/Rankings; extra content scrolls within the tab.

Fly was checked first in the actual IAB: icon-triggered download progressed to
Downloaded; selection stayed unchanged; the completed icon opens download
details and closing restores focus to the badge. The same independent button
is reused on Career/Flight School cards, Weekly challenge and flight results
(Victory context). Several cards sharing one map all receive live updates;
there are no nested selection/download buttons.

26 affected tests pass. Browser checks cover home, Fly, help and lesson cards.
Profile width/height matched exactly across three tabs; Achievements overflow
scrolled internally. Evidence: [Fly](design/ui-performance-20261018/03-fly-status.jpg),
[lessons](design/ui-performance-20261018/01-shared-lesson-status.jpg),
[Settings](design/ui-performance-20261018/02-settings-help.jpg).
This section describes the first UI step; the integrated publication above
supersedes its earlier local-only status.

## Loader and camera measurements / local repair

The GLTF fragment lookup scanned the entire parsed graph for every named chunk.
Pine has 26,762 GLTF nodes and 3,325 clone requests; Green has 42,739 nodes and
12,379 requests. A shared per-asset name index now scans once, preserving errors
for absent/ambiguous names. Browser Pine lookup time dropped **13,795→12.7 ms**;
whole map preparation was **24,621→7,969 ms** in these runs. Read/parse/cache
conditions vary, so the whole-load difference is not a controlled network result.
Read, parse, lookup and clone timings are separately available in the local
`tools/qa-performance.html` probe; diagnostics retain at most 128 asset rows.

Warm Pine Hangar preparation took 633 ms for the environment, 9.6 ms to assemble
the already parsed Kestrel and 113 ms to compile/upload. Dquad's first inspection
was 1,115 ms, but forcing complete release caused a second parse on reopening
(257 ms here). Menu-map swaps previously performed that release automatically.
One hidden inspected aircraft now survives those swaps, is repositioned at the
new workbench on reuse, and is released on ordinary flight cleanup/replacement.
The global 48/96 MiB idle-cache budget is unchanged; all aircraft are not pinned.

A separate `chase-rigid` mode uses a body-fixed position/orientation, looks at
the aircraft origin and has no smoothing, velocity offset or look-ahead. Existing
dynamic chase remains `chase`; C cycles all three modes, also in replay controls.
Settings exposes all modes and preserves existing saved FPV/dynamic selections.
Rigid mode deliberately does not dolly around obstacles; its fixed offset can
intersect nearby scenery. Dynamic/FPV/inspection retain their obstruction guards.
Centering through pitch/roll/yaw/flips and scene resource lifetimes are tested.
22 affected tests pass; actual rigid rendering on The Green was checked.

Before draw batching, WebGL2 Low / fixed 1280×720 / adaptive off:

| Scenario | Median frame ms | p95 ms | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: |
| Pine FPV at native start | 36.4 | 60.6 | 2,734 | 5,022,454 |
| Green FPV at native start | 42.1 | 60.7 | 1,227 | 1,570,314 |
| Green dynamic chase | 18.2 | 24.5 | 561 | 756,415 |
| Green rigid chase | 18.2 | 24.5 | 590 | 779,010 |

These short warmed samples diagnose the current machine; they are not target
hardware acceptance. Chase sees fewer objects because of its narrower FOV.
Reports are ignored in `data/ui-performance-20261018/`. Batching/LOD, packed
foliage material recovery, localization and Ultra loading captures remain open.

## Current continuation: shared renderer and languages

Spatial static-scene batching is implemented with per-instance frustum culling
and synchronized LOD visibility. Transparent/custom/skinned meshes, mesh parents
and animated/course content are excluded. Batches retain geometry and material
identity across quality changes and release their GPU resources on disposal.
Pine's measured draw calls dropped **2,734 to 665**, but the 36.4 ms median did
not improve. Further profiling below locates most CPU time in draw submission;
the original five million visible triangles also exceed the Low budget.
Never report batching alone as a verified FPS improvement.

Full loading overlays now suppress competing scene renders; static menu
backgrounds are paced at 24 fps while flight and interactive Hangar keep the
normal animation loop. Model loading still performs explicit GPU preparation.

English/Russian/Latin Uzbek catalogs, first-launch chooser, Settings language
category and persisted `parvoz-language-v1` are implemented. Authored labels,
help, lesson instructions and HUD feedback translate reversibly; inputs, chat,
pilot/build/replay names, technical IDs and existing save keys are preserved.
All twelve lesson copies have a coverage check. Six locale tests pass, including
interpolation, storage failures and returning to English without losing source
copy. Production Vite build passes; actual three-language browser review awaits
restored browser access. Help remains the last Settings action.

Experimental `tools/derive-map-lods.js` creates separate deliveries. It preserves
the LOD0 fingerprint (all geometry/UV attributes/transforms), original texture
bytes, collisions and native course inputs. Native UV topology is simplified;
independent leaf/grass cards are thinned as complete components with nested
distance sets. Pine candidate `public/content/assets/qa/pine-lod-caac846413aa05ae.glb`
is verified structurally: source 11,544,852 triangles per original level;
candidate LOD1 4,543,510 / LOD2 1,400,065; LOD0 unchanged. SHA256
caac846413aa05ae6744ffc0af6ff3c361561bdf3f2c59707543c89f22fa4beb.
285,782,364 bytes. This is **not promoted**: compare Low/Ultra silhouettes,
foliage density, real route and frame timings first. The QA page supports a
validated local hashed `candidate` URL without changing the canonical catalog.
Earlier raw/native prototypes in the ignored QA folder are weaker experiments,
not release assets. Do not rerun them or overwrite canonical art.

Recovered the eleven previously skipped packed Tree Creator/AFS texture images
from the authorized Pine bundles using scoped `tools/recover-foliage-textures.py`
and UnityPy 1.25.4 (MIT), installed only in ignored tools/bin. Results and hashes:
`data/liftoff-pine-valley-recovery/foliage-pbr/recovery.json`; missing list is empty.
Native Unity Tree Creator source confirms AG normal, red specular and separate
translucency alpha gloss. The original AFS shader property description confirms
`Normal (GA) Trans(R) Smoothness(B)`. Converted nine materials / twelve textures
at max 512px; tests cover channel packing and keep specular/translucency distinct
from AO/metalness. A fern albedo decoded by both readers matched pixel-for-pixel;
vertical flip was rejected. No invented AO texture is added.
Material candidate `public/content/assets/qa/pine-lod-pbr-a81b308b30d7fc2a.glb`
preserves the same full-detail fingerprint; SHA256
a81b308b30d7fc2a20e064089b986ca5e737ab8fb892dd266ef4f2bfd4d50b4e,
288,649,472 bytes. Editable counterpart was saved in Blender to
`data/ui-performance-20261018/pine-pbr-candidate.blend`; nine bound materials,
packed images, original canonical blend unchanged. Review before promotion.
Do not repeat full AssetRipper recovery or scene exports.

Browser became unavailable in Work after the earlier successful checks. The
user enabled it and several subsequent tool calls still returned the disabled
state. Real new Ultra screenshot capture, candidate profiling and visual locale
review remain outstanding. Oracle remains learning-01; no publication performed.

Final integrated automated suite: **427 passed / 0 failed** (330 seconds), run
with authorized temporary local server processes after sandbox EPERM prevented
those subprocess tests. Current production Vite build also passes. This does
not substitute for the outstanding browser/hardware checks. New source packet
is saved under `content/maps/liftoff-pine-valley-demo/pbr-candidate/`: original
packed images, converted maps, source bindings, shader/orientation evidence and
candidate reports, without activating them in the game catalog.

Reduced-level coordinate packing was separately tested in an isolated document
so original LOD0 is never quantized. Mesh-local 16-bit coordinates compensate
node and GPU-instance transforms; two new tests check world positions and UVs.
The resulting candidate is `public/content/assets/qa/pine-lod-packed-da39aad474385012.glb`,
SHA256 da39aad474385012e40547ba2af8993d99c17c96b3bcee321cd5d8188e050365,
278,903,824 bytes, full-detail fingerprint unchanged. It saves 9.7 MB compared
with the native-PBR candidate, but is still larger than the original 201,436,156
byte delivery. **Not accepted for publication**: runtime savings and increased
download cost must be resolved together. Consider separate optional full-detail
delivery after measuring this candidate; do not change cache/download semantics
without tests. Source blend and model SHA256 match their existing Git LFS oids.

The earlier browser-disabled state ended after the user's Browser access update.
The IAB is now accessible through the Browser plugin. Public health and private
Git fetch also succeed. Oracle has not been deployed during this work.

## Browser continuation: rejected reduced forest and submission profiling

Actual fixed 1280×720 / WebGL2 / Low / adaptive-off measurements now identify the
GPU as **NVIDIA GTX 1650**, not the target UHD 620. The packed reduced candidate
draws 644,623 triangles but still takes 36.4 ms median; its sparse canopy also
fails the visual check. It remains isolated and is **rejected for promotion**.
Its 278.9 MB size is another reason not to ship it over the 201.4 MB original.

On original geometry, a QA-only timing wrapper measured 23.5 ms of 32.2 ms CPU
time in renderer submission, 2.7 ms in projection and less than 1 ms outside the
renderer. Cell-size comparisons keep per-object frustum culling and every source
vertex/material/transform; only submission groups differ:

| Original forest, cell size | Frame median / p95 ms | CPU median ms | Calls | Visible triangles |
| --- | ---: | ---: | ---: | ---: |
| 64 m | 30.4 / 48.4 | 32.2 | 665 | 5,028,148 |
| 256 m | 24.3 / 36.5 | 25.2 | 401 | 5,028,148 |
| 512 m | 18.2 / 24.3 | 16.8 | 352 | 5,028,148 |

These are short warmed samples on this machine, subject to scheduling noise.
They support the 512 m submission setting, not a target-hardware guarantee.
The shared pipeline retains ordinary meshes when `WEBGL_multi_draw` is missing:
r180's WebGL fallback otherwise skips BatchedMesh drawing entirely. Eight
affected batching/static-scene/support tests pass; 22 including scene transitions
and render scheduling pass. The Green also improves in the short Low FPV sample:
42.1→24.1 ms median, 1,227→246 calls, unchanged 1,570,314 triangles. Dynamic chase
measures 16 ms median / 24 ms p95, 186 calls, unchanged 756,415 triangles. These
camera samples still do not reproduce a separate third-person-only regression.
An original-forest route sample revealed first-use shader stalls up to 3.3 s;
shader preparation and actual map traversal remain open.

QA controls now choose native courses, expose renderer projection/submission
timings, pause rendering, and explicitly export the real full framebuffer plus
quality/camera/GPU metadata. A transparent Hangar layout div no longer intercepts
second-row controls. Initialization disables actions until handlers are ready.
The export avoids clipping the 1280×720 game frame to the browser viewport.

The actual first-launch language check exposed a separate WebGPU startup hang:
`GPUPipelineError: arrayStride (6) is not a multiple of 4` on normalized SHORT
VEC3 attributes. r180 selects a padded GPU format without padding the imported
vertex record. The loader now decodes only incompatible normalized packed
attributes into matching-size float attributes once per shared parsed geometry.
CPU semantic values, bounds, indices, shared ownership and canonical delivery
files stay unchanged. Two regression cases cover signed vectors, sharing,
interleaved UVs and morph normals; ten loader/cache/cleanup checks pass. The
actual WebGPU startup now reaches Ready and opens the Uzbek main menu.

Three-language browser review: first-run chooser shows the three native names;
Uzbek selection opens translated startup/home/Settings, live Russian and English
switches work, and English survives the development reload. Guest identity
`Guest 3829` stays unchanged. Russian lesson titles/descriptions/outlines and the
English profile were inspected at the actual compact viewport. This caught and
fixed missing accessible download/page labels and a greedy count placeholder
that had translated `Hangar C03 · 3 steps` as one count. Map names and step
counts now occupy separate text spans; counts accept numeric values only.
Sixteen locale/menu/download checks pass, including the regression. Screenshots
06–10 in the design folder record first run, Uzbek home, Russian Settings and
lessons, and English profile. This is local browser verification, not publication.

## Current graphics preparation checks

Outdoor reflections now capture a small sky/ground lighting probe instead of
rendering the full forest in six directions. Indoor maps retain their authored
scene captures. The probe owns cloned geometry/materials and releases only its
own resources. A Pine Ultra run separated surfaces/reflections (125 ms), scene
shader compilation (303 ms) and first postprocessed frame (16.5 s). Compiling
every map material worsened entry and was abandoned. Current prewarming only
selects visible variants, uses the actual scene-pass render target, restores
visibility on failures, and updates the real camera before compilation.

Completely inactive batches are now hidden at the object level, avoiding uniform
and shader work for invisible LODs. Active-instance counts are idempotent and
restore a batch when its level returns. Ultra/high proximity uses distance to
native chunk bounds, fixing coarse rock atlases beside the camera when the
chunk centre is high in the canopy. Low retains its previous distance policy
and intentional minimum detail. Final Green Low startup took 9.18 s for map,
0.88 s for aircraft, 40 ms for surfaces/reflections, 871 ms for shader preparation
and 1.09 s for the first frame. Its warmed FPV sample is 18.2 ms median / 30.2 ms
p95, unchanged 246 calls / 1,570,314 triangles. Thirty-five targeted graphics,
transition and scheduling tests pass. Final Ultra checks and build continue.

Actual 1280×720 Ultra Pine course frames are saved in data/. Original canopy is
retained; native PBR-only candidate is 204,877,164 bytes, SHA256
86db6d5ba657a81a7849f993b8392ddc90e6778afda05110e0b4413a1bb79214,
with the original full-detail fingerprint unchanged. Its nine recovered native
materials also have a small 5.9 MB editable Blender material library, extracted
from the already saved candidate without loading/exporting the entire map.
The initial full-scene library export was stopped to release RAM; subsequent
extraction completed. The material-only patch is now canonical: all 26,762 nodes,
5,313 meshes, every LOD/index/attribute/instance array and 598 original texture
bytes match. Twelve additional textures provide the nine native material
bindings. The editable material library is committed beside metadata; map.blend
retains the unchanged geometry. SOURCE.json states the remaining translucent
lighting/wind approximations and preserves permissionConfirmed:false. Content
sync/check pass: revision c39594a402708803, five maps / 30 courses / twelve lessons.

## Real Ultra loading gallery

The gallery now uses three actual **1920×1080 / Ultra / WebGL2** game frames:
Pine Valley's first native course, The Green's first course and Minus Two's
Turn Signals. QA controls export the full framebuffer and camera/GPU/quality
metadata rather than a clipped browser viewport. Every image is hash-bound to
captures.json, with provenance and unchanged permission metadata. The initial
frame order is shuffled. Existing Ken Burns/crossfade and reduced-motion support
remain. Low map thumbnails and the old Low fallback image are no longer used.
Eleven loading/gallery checks pass. Actual Russian startup shows the new gallery
and translated controls: design/ui-performance-20261018/12-ultra-loading-gallery.jpg.
The final full suite/build and integrated Oracle publication are now verified;
see the current status above.

Remaining work:

1. Produce genuinely reduced scenery LODs with preserved canopy density/outline.
   The packed/thinned candidate is rejected; do not repeat or promote it.
2. Measure on the actual UHD 620 at fixed 1280×720 / Low / adaptation off.
   The measured GTX 1650 results do not establish target acceptance.
3. Continue native grass/foliage material work and inspect artist-approved Low
   and Ultra frames. Nine recovered Pine materials are not a full art overhaul.
4. Profile cold shader/postprocessing stalls separately from download, parsing
   and the now repaired repeated-preview path.
5. Review VM disk before another release. Preserve -04's runtime assets, -01's
   canonical build sources, all rollback images and production data. The next
   unchanged-content code patch can use the explicit read-only source mode;
   a content update needs a full source candidate.

## Design contract

Retain the accepted compact game UI: panel #23262b, secondary #373c43,
border #656c76, text #f0f1f1, quiet text #adb1b7, primary #eea462.
Source Sans 3 supports ordinary UI and Cyrillic; readable hierarchy and clear
focus states take priority over decoration. All navigation stays left aligned.
Back labels remain unchanged in the English version. Loading motion respects
reduced-motion preferences and does not block navigation.

| Before | After | Why |
| --- | --- | --- |
| Main menu title duplicates navigation | Navigation begins with Fly | Remove redundant heading |
| Transparent Back buttons | Opaque subdued grey shared secondary style | Improve contrast without competing with primary actions |
| Download status below map cards | Independent accessible icon button inside top-left of preview | Keep status and download action attached to the map |
| Profile height follows tab content | Fixed viewport-bounded panel with internal scrolling | Prevent layout shifts |

## Execution and acceptance

1. Polish Fly, Back, profile and help in the actual local browser. Reuse the
   verified badge in other map selections without nested buttons or changing
   their selection/launch actions. Preserve keyboard and download progress.
2. Add persisted locale choice before initial game preparation, changeable
   in Settings; translate menus, help, HUD and lessons while preserving names,
   account data, identifiers and save keys. Check all three languages.
3. Reproduce/model phase timings for cold/warm Hangar and scene entry. Capture
   deterministic Pine/Green routes, render cost and camera cost before fixing.
   Treat network, decode/parse, assembly, shader/GPU upload separately.
4. Apply measured optimizations to the shared map pipeline, preserve authored
   geometry/collisions in canonical sources, and verify silhouettes/foliage at
   Low and Ultra. Keep dynamic chase and add a centered rigid mode.
5. Use real Ultra captures from multiple maps/courses in the loading slideshow.
   Investigate native normal/roughness/AO resources before adding compatible
   licensed materials; do not claim generated noise is authored PBR detail.
6. Run affected tests, visual checks and the final suite/build; save checked
   changes to private GitHub. For the integrated online update use a fresh
   candidate, backups, public checks and finalization, preserving the old release.

## Research starting points

Final local verification: the complete suite passes **439/439** in 492 seconds,
and the final client build passes. Six later Hangar translation rows passed the
16 affected localization/navigation checks and were checked in the actual
Russian Hangar. The latest build includes those strings. The fresh incremental
packager has two fixture checks, alongside four existing delta reconstruction
checks: retained old URLs, source hashes, duplicate payloads, independent mutable
files and private-file rejection. With read-only source reuse, seven deployment
fixture checks pass. The final complete 443-test suite and publication supersede
the earlier verification counts in the investigation notes.

- [Three.js: optimize many objects](https://threejs.org/manual/pages/optimize-lots-of-objects.html):
  draw calls and scene traversal have a cost; merge/batch by spatial region.
- [Three.js Frustum](https://threejs.org/docs/pages/Frustum.html): bounds govern
  culling; large vegetation batches need localized bounds.
- [Instancing discussion](https://discourse.threejs.org/t/how-to-do-frustum-culling-with-instancedmesh/22633):
  spatial cells preserve useful culling. Verify against the installed r180
  implementation rather than copying old API assumptions.

Do not infer a hardware FPS result from triangle counts or another machine.
The known Low baseline and limitations remain in NEW-MAPS-LOW-20261018.md.

Further primary references used in implementation:

- [BatchedMesh](https://threejs.org/docs/pages/BatchedMesh.html): spatial batches
  with per-object frustum culling; measured fewer calls without claiming less
  vertex work. Existing GPU instances are retained.
- [Meshoptimizer simplifier](https://github.com/zeux/meshoptimizer/blob/master/js/README.md):
  attribute-aware reduced geometry, independently verified against original UVs.
- [Sketchbook](https://github.com/swift502/Sketchbook): a browser 3D reference
  for Blender/GLB scenes and postprocessing. Archived project, studied rather
  than introduced as a maintained dependency.
- [al-ro grass](https://github.com/al-ro/grass): instanced vegetation and GPU
  wind. Study informed spatial batching; no textures/code were copied.
- [Unity Tree Creator shader](https://github.com/TwoTailsGames/Unity-Built-in-Shaders/blob/master/DefaultResourcesExtra/Nature/TreeCreator/TreeCreatorLeavesOptimized.shader):
  channel packing confirmed from vendor shader source. Colored specular and
  light transmission are still approximations in ordinary dielectric glTF PBR.
