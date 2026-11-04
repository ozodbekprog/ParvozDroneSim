# Optimization and correctness — 19 October 2026

User scope: profile first; menu/map reuse and frame stalls; camera/LOD;
Pine/Green/Arena/Hangar materials and collisions; native configurable aircraft;
faster, varied physical race opponents with random hardware and unchanged tuning.
Baseline: `f83ac24`, clean main matching origin. Implemented repairs in this
report were published as `20261020-optimization-01` on 20 October, 02:47 Tashkent.
See [deployment verification](ORACLE-DEPLOYMENT.md) for exact scope and remaining
limitations. The measurements below retain their original local chronology.

## Baseline before runtime changes

Actual Chrome / WebGL2 / GTX 1650 / reported 16 GB memory, Low, fixed 1280×720,
adaptive resolution off. `tools/qa-performance.html?map=liftoff-arena-demo`
is a local developer page, excluded from the client entry point.

- Cold Arena: map 11,289.5 ms; map GLB read 1,578.6 ms / parse 8,500.8 ms;
  aircraft 1,675.3 ms; shader preparation 604.8 ms; first draw 621.9 ms.
- Static batching already exists: 6,038 meshes / 316 batches, 917.1 ms setup.
- Same-map Hangar environment: 143.3 ms; inspection assembly 4.5 ms;
  compile/upload 201.6 ms. No second map parse in this operation.
- The added Warm menu lifecycle button repeats real World menu/Hangar APIs
  and the existing shell cleanup. All three cycles retain the map scene;
  **all three destroy/recreate the home aircraft**. Warm Hangar times:
  569.6 / 1,154.2 / 1,150.3 ms. Return: 458.1 / 1,246.5 / 1,216.2 ms.
  Settings and return (two synchronous draws): 445.7 / 437.8 / 429.0 ms.
  This reproduces delays without another map download.
- The initial tour sample ran at approximately 1-second animation intervals
  in browser automation. It is invalid as an FPS measurement and is discarded.
  No UHD 620 claim is made.

Ranked probes: (1) aircraft lifetime / GPU resource recreation, (2) deferred
GPU upload and shader compilation as scenery first enters view, (3) asynchronous
compiler mutating live scene visibility and racing LOD selection. Additional
map art, collider and native configuration audits remain in progress.

The installed Three r180 renderer is the implementation reference. Its
[compiler](https://threejs.org/docs/pages/Renderer) prepares GPU pipelines;
[BatchedMesh](https://threejs.org/docs/pages/BatchedMesh.html) performs individual
instance frustum culling. Fewer draw calls alone do not demonstrate higher FPS.

## First verified repair: presentation resource lifetime

`World.leaveHangarPreview()` retains both the inspection and home aircraft;
menu-map commits also carry these two resources across. Shader preparation now
restores visibility and renderer target synchronously after pipeline collection,
before awaiting GPU completion. This prevents black/incomplete frames and stale
LOD visibility restoration during that asynchronous wait. r180's initialized
`Renderer.compileAsync` gathers all pipelines before its final Promise.all;
World waits for renderer initialization before invoking this path.

Two reproducing regression tests failed before the change. All 32 affected
scene/compile/LOD/batching tests pass afterwards. Chrome repeats all three
transitions with the same map **and same home drone**, one map parse, no captured
errors. Warm timing still reaches approximately 1.2 seconds in later cycles;
retention alone has **not** solved that cost. Phase-level renderer submission
timings were added to investigate it next. No deployment yet.

## Native customization rules

Reused the preserved prefab records and inspected the installed game's
Assembly-CSharp with the existing ilspy tool. `PartIDRestrictor` uses whitelist
0 / exclusion 1. Propeller condition 10 reads the frame's maximum size.
`PartSlot.overridePart` is authoritative; a child SnapPoint replaces serialized
snap transforms. Evidence and original component records are retained in
`content/shared-assets/liftoff-drone-parts/customization-source.json`, with a
source hash and unchanged proprietary/unconfirmed permission metadata.

Four aircraft now carry their native slot/rule configuration. Gecko and Dquad
only accept Redot Split Mini; Chameleon excludes Fibonacci. Gecko forces
AntennaBlank and ActionCamBlank: the mistakenly imported Fatshark antenna is
hidden at all LODs, and its adapted action camera cannot be selected or restored
from an old save. Menu filtering, save normalization and physics share one
compatibility function. Kestrel legacy selections and flight tuning are retained.
Conditional geometry masks are supported without rebuilding the workshop UI.
The extracted four frame prefabs contain no conditional camera-cover rules;
do not invent them or remove the whole frame mesh. FPV + separate HD is allowed
by the other three native configs. The user subsequently explicitly selected
**no separate action camera on any drone**. Product policy now disables the
workshop control and normalizes old saved builds on all five aircraft; native
source rules and editable art are retained unchanged for provenance.

The regression tests first reproduced illegal cameras and the Gecko accessory.
30 affected tests then passed (fleet, native physics, real component GLBs,
workbench and wiring), with additional all-LOD antenna/mask checks added.
No Blender geometry was regenerated for this configuration correction.

## Follow-up frame probe

On the same Chrome/GTX1650, three settled home frames took 15.8 ms total in
renderer.render (7.9 ms submission, 2.4 ms backend draw), versus 160–250 ms
immediately after presentation transitions. The slowdown is therefore transient;
profiling only an already settled frame misses it. Continue the cost probe
around the transition itself. This is CPU timing, not a UHD620/FPS acceptance.

## Chase camera translation

The old 100 ms world-position lerp adds approximately 5.5 m of lag at 60 m/s
and 60 Hz before obstacle clamping, despite the requested 1.2 m chase distance.
The dynamic camera now carries the interpolated drone position directly and
smooths only its relative heading offset. Reset/mode change clears this history.
23 targeted camera/workbench/scene tests pass, including 30/60/144 Hz equivalence
and a fast translation regression. Browser access was disabled again in Work;
the visual high-speed/collision review remains outstanding.

## Race hardware diversity

Race rosters shuffle the five available models without duplicates among three
opponents and sample only compatible mounted hardware. Every opponent keeps its
own resolved physical specification; default controller tuning is unchanged.
Navigation is shared with clearance for the largest selected aircraft. Seeded
tests cover all models, hardware compatibility and open-gate completion, plus
the real narrow course at three skills and imported Gecko/Luma physics.
Antennas were native fixed components at this stage. The subsequent selectable/
random native antenna integration is recorded in `NATIVE-CUSTOMIZATION-20261019.md`.
This stage did not claim smoother paths.
The existing straight three-gate baseline is 41.617 s, peak 5.978 m/s, no resets.

## Rounded source collisions

The source importer replaced Unity spheres and capsules with bounding boxes.
This reproduces invisible corner contacts around trees. Runtime now resolves
the exact rounded surface and analytically sweeps the aircraft spheres against
it, including rotated capsules and high-speed crossings. Broadphase retains
conservative bounds. Reused existing recovered records; no scene/art re-export.

Converted source proxies: Green 7,702; Pine 2,974; Arena 4,295; Hangar 2,807;
Minus Two 161. Collider order/count and every non-rounded record are retained.
Hashes and counts: `content/shared-assets/liftoff-rounded-collisions-20261019.json`.
Canonical collision files and generated catalog are updated. Blender proxy
roundtrip preserves rounded metadata, recomputes dimensions after resizing and
rejects unsupported shear/reflection instead of silently producing solid boxes.

24 targeted collision/contact tests passed before content synchronization;
after synchronization, all 9 round/flight regression tests passed, including
all stock aircraft taking off on all five actual maps. Blender roundtrip and
content validation pass. This fixes proxy corners, not an assertion that all
source canopy colliders match visible foliage or all checkpoint fences exist.

The first AI acceleration experiment had 11/43 failures on actual routes;
the subsequent diagnosed correction and verification are recorded below.
Browser visual acceptance, menu transient profiling, Green grass, Pine ground,
and antenna hardware remain outstanding. Oracle unchanged.

## Missing track frame/barrier collisions

The separate track importer accepted only BoxCollider/MeshCollider and omitted
every native sphere/capsule. Recovered these existing source records for all 25
authored tracks on all five maps. All earlier colliders and race properties are
unchanged; new rounded surfaces follow the established contact order. No visible
geometry, track layout or saved Blender artwork was regenerated. Collision-only
export no longer loads unused materials/textures. Audit counts are retained in
`content/shared-assets/liftoff-track-rounded-collisions-20261019.json`.

`check-liftoff-tracks.js` passes with each of the five import profiles: original
race order, spawns and every actual checkpoint passage remain valid. Content
schema and focused runtime collision tests pass. Visual contact review remains
pending; this is not a claim that every missing map element has been repaired.

## Additional verification and profiling tools

The local QA page now exposes Frame CPU breakdown and Transition CPU breakdown:
measure renderObject/backend.draw costs, pipeline creation and the slowest
objects during the actual menu-to-home transition. These probes have syntax
validation; transition measurements await restored browser access. They do not
ship in the game entry point. A yaw-only regression with maximum LOD distance
passes; LOD selection is independent of view direction. All 13 LOD/compiler
tests pass, but the specific Arena visual complaint still needs observation.

Production build passed. The non-AI suite had 411/412 passes; its remaining
fleet-save expectation still expected actionCamera=true. Updated it to the
explicit user prohibition and reran the real two-device/restart API scenario:
pass. Thus all 412 non-AI cases are verified across that run and the focused
rerun. This does not replace browser or target-hardware measurements.

## Faster physical race trajectories

Independent X/Z acceleration clamps distorted diagonal commands at high speed,
driving the aircraft off the swept-clear segment into trees. The controller now
caps the horizontal vector magnitude while retaining direction. Open corridors
permit 12 m/s; narrow corridors retain 6 m/s. Collinear swept-clear navigation
points and aligned successive gates no longer force a stop. Tight turns still
use conservative waypoint arrival; broader curved racing lines remain future
work. No pose interpolation/teleport is used for progress, and tuning is unchanged.

The 100 m / three-gate measurement changed from 41.617 s / 5.978 m/s peak to
16.283 s / 10.936 m/s peak, zero recoveries. Intermediate crossings are 10.676
and 10.808 m/s. The final gate permits braking. Initial takeoff now settles
within 5 mm before joining a prepared route: the old 6 cm threshold could make
the low first approach on Minus Two unreachable after restoring omitted props.

Actual-route run passed 29/30 single laps before that takeoff correction; the
remaining Minus Two route passes after it. All five authored multi-lap regression
courses then pass. Narrow course: all three skills, Gecko and Luma pass; hardware
and straight/diagonal regressions pass (4/4). Multi-lap tests retain the existing
battery exhaustion/recovery behavior; single laps require zero recoveries.
Optional RACE_AI_TRACE writes per-route preparation progress for long tests.
Final production build passes after the takeoff-tolerance change (147 modules).

## Exact continuation

### Resumed Browser verification: menu light invalidation

Browser restored. IAB uses Intel UHD (device 0x9BC4), WebGL2, 16 GB reported
memory; fixed 1280x720 Low, adaptation off. This is not the previous GTX1650
sample and does not establish UHD620 FPS. Before/after use this same IAB.
Three warm Settings/back samples: 691.6 / 524.1 / 468.6 ms before, versus
25.0 / 13.2 / 11.5 ms after. Hangar returns: 344.8 / 241.5 / 237.5 ms before,
39.5 / 35.5 / 27.6 ms after. Later warm Hangar entry reaches 30.9 ms; its first
entry remains 462.9 ms while new workshop resources prepare.

Root cause: the home model contained a PointLight. Hiding the model changed
the visible light set, invalidating Three r180's lighting/material cache across
the scene. The fill now lives directly in the scene and follows the model's
world transform; only intensity changes when hidden. A failing regression first
reproduced changed light membership. All 25 affected tests pass, with additional
replacement/removal/intensity/transform coverage passing in the 15 scene tests.
Transition CPU probe: 535.7 -> 17.8 ms; pipeline creation 4 -> 0; submission
524.4 -> 7.5 ms for the same 141 objects. Map/home UUIDs and parse counts remain
unchanged through all three cycles. No arbitrary batching or quality reduction.
Map art, angle-specific LOD and high-speed chase visual checks still remain.

- Current catalog revision: 2132caf43c0e38df after native terrain integration.
  Source collisions are unchanged from f960230488d4d796. No Oracle update.
- [Renderer warmup repair](RENDERER-WARMUP-20261019.md) fixes missing pipeline
  variants and Low's canvas/linear-target mismatch. Same original Pine control:
  Low first frame 12.94→0.274 s / 189→1 new pipeline; Ultra 83.41→2.34 s /
  461→55. Combined compile/frame time also falls. Cold Ultra, WebGPU draw calls
  and target-hardware acceptance remain unresolved; 27 tests/build pass.
- Read-only source audit: Green has no native TerrainData detail prototypes and
  no serialized Project.TerrainDetails component in its scene bundle. The cached
  scene is manifest bundles[0], f3e7ea735fc54c6bd69b5b6278e19446.bundle; manifest
  indices are not AssetRipper collection IDs. Do not rescan the wrong bundle[39].
- Pine ground's undersampled patch bake is replaced by native five-layer tiled
  diffuse/normal and source splat painting. Actual fixed-camera Low comparison
  removes the enlarged pale blotches. 55 tests/build and normal/Ultra renders
  pass on both backends. [Exact evidence and remaining cold-render diagnosis](NATIVE-TERRAIN-20261019.md).
  This is not full lighting/grass/foliage or UHD620 acceptance.
- Transition CPU diagnosis is complete. Browser was restored for actual Workbench
  verification; Arena yaw/LOD, Pine ground, Green grass/contact and chase remain.
  Do not substitute static-code checks for these measurements.
- Native antenna selection/mounting/export/UI and AI integration is now local:
  `NATIVE-CUSTOMIZATION-20261019.md`. The four source prefabs were reused without
  new recovery; Gecko is blank and separate action cameras remain prohibited.
  Exact GLB/socket tests, offline Blender views and actual Workbench checks pass.

### WebGPU repeated scenery

[Measured instancing change](WEBGPU-INSTANCING-20261019.md): real tree instances
replace WebGPU's per-placement BatchedMesh draws. Source geometry, exact uniform
tints, alpha/painting, LOD flags and per-object frustum selection are preserved.
WebGL stays on multi-draw. Pine Low FPV 2,737 to 442 draws, CPU median 13.2 to
9.5 ms; all 90 moving camera triangle counts match. Moving CPU is about unchanged;
frame results vary and are not a stable FPS claim. Low captured JPEGs are identical.
Ultra and Green browser smoke checks, 57 affected tests and production build pass.
Cold route stalls still reach seconds; real geometry LODs and GPU budgets remain.

### Arena angle/detail observation

[Actual maximum-range yaw comparison](ARENA-DETAIL-20261019.md) records no LOD
selection changes at 0°/20°/0° on a fixed camera, and identical returned frames.
The original polygon-switch complaint is not reproduced at that point after the
earlier distance/bounds repair. Oblique texture blur is reproduced and repaired
with device-bounded Medium 4× / High/Ultra 8× anisotropy. Low retains native
filtering. Existing settings UI is reused; 28 focused tests/build pass. This is
not a claim that every Arena angle, all map art or target-hardware FPS is accepted.
