# Minus Two streaming prototype — 25 October 2026

Local development experiment. Not installed in the game or deployed to Oracle.
UHD 620 acceptance, complete game integration and market readiness remain open.

## Delivery and ownership

`tools/chunk-map-delivery.js ... 24 streaming` produces a version-2 manifest
from the already-verified Minus Two Low model. One package contains the entire
authored distant LOD, plus the environment and unlevelled objects. Another 23
packages contain nearby Low detail. Textures share content-hash URLs in one
directory. Package resources total **17,199,690 bytes**; complete distant
coverage and its dependencies are **5,993,535 bytes**, before HTTP compression.
The separate manifest adds 115,060 bytes. Aircraft, physics and the client
bundle are excluded from these model-delivery figures.
No new geometry is generated or decimated. All 93 authored selectors retain
the existing geometry/transform parity checks.

Manifest bounds include the actual geometry, normalized packed positions,
hierarchy, authored placement, rotation/scale and GPU instances. Placement-cell
coordinates alone cannot safely drive streaming: a mesh can extend beyond them.

`SpatialMapStream` defaults to 36 m detail radius, 52 m retention radius, two
seconds of look-ahead, two concurrent preparations, at most eight selected
packages and 48 MiB of estimated resident detail geometry. Distant coverage
remains installed while detail downloads or fails. A detail swap hides only
the corresponding distant objects; eviction restores them before disposing
detail. These are prototype parameters, not accepted production budgets.

`StreamChunkLoader` checks resource lengths and SHA-256 before parsing, shares
decoded KTX images and configured GPU Texture objects through leases, and owns
each chunk's geometry/materials/blob URLs. Sampler, color space and UV state
are part of texture identity. The shared texture pool defaults to a 64 MiB
CPU/GPU payload estimate; driver, renderer and JavaScript overhead are excluded.
The distant geometry is separate from the detail limit. Canceled work cannot
commit a late result. The final image consumer cancels the download; a decoder
already in progress may finish and its abandoned result is disposed.

## Verification and current limitations

16 affected automated tests pass, including real GLTF parsing, exact placement,
shared texture identity/lifetime, delayed cancellation, hash rejection/retry,
bounded scheduling, geometry bounds and the existing Three r180 binding repair.

Browser Use is available again. Edge on this computer reports Intel UHD
Graphics, **not UHD 620**. The current game QA page loaded Minus Two with no
warning/error logs at actual 1280×720/WebGL2/Low. The separate streaming page
visibly rendered the map and eight nearby packages. The recorded 3,055.6 ms
distant-frame observation is **invalid as loading-speed evidence**: subsequent
inspection found Edge minimized and route callbacks throttled. Do not reuse
these background elapsed times for loading/FPS comparisons. Resource ownership,
rendered geometry, functional cancellation and disposal counters remain separate
observations.

Twenty prototype load/release cycles completed with no detail-loading errors,
and a second set of twenty passed after the renderer binding setup correction.
Each returned renderer counters to the empty baseline: **1 internal geometry,
2 internal textures**. The map loader reported **zero** remaining chunks,
images, configured textures, preparations and estimated payload bytes. These
final cycles are saved as `streaming-cycles-20-final.json`. The repaired moving
route exchanged at least 117 detail packages with no new warning/error logs
after the repair. Forced browser GC is unavailable
through this browser connection. Live heap samples are not a retained-heap
leak test, and renderer counters are not total process/GPU memory.

The first moving test exposed the known Three r180 empty cached sampler issue.
The shipped World's renderer already installs `repairTextureBindings`; the
separate prototype now installs the same existing repair. The original error
and initial-cycle report are retained under ignored
`data/browser-readiness-20261025/`. Do not describe that first moving run as a
pass or infer that the game's renderer was missing this repair.

The immediate-start/cancel browser control also reproduced a real race: a map
could revive if cancel happened while startup was awaiting its first frames.
Startup now captures its generation before that await. The same control then
passed, with no map installed. Before/after results are saved in
`streaming-cancel-before.json` and `streaming-cancel-after.json`. Ordinary scene
loading and the fixed boundary path are separate checks; no physics or collision
streaming is implied by these camera-prototype results.

The initial spawn view reported **323,975 triangles and 243 draws**, without
course/aircraft. Geometry already exceeds the provisional 300k Low ceiling at
that view. Model loading improvements do not establish the FPS target. The
prototype is a camera tour with complete distant visual coverage; it does not
stream collision data or include flight physics, drone, course, multiplayer,
graphics-quality switching, public network delivery or production caching.

## Continue without re-exporting

With the isolated local API on 2567 and Vite on 2598, open:

`http://127.0.0.1:2598/tools/qa-map-streaming.html`

The existing verified assets/manifest are in
`data/browser-readiness-20261025/minus-two-streaming/`; reuse them. The page has
load, release, fixed camera tour, distant-only, retry and 20-cycle controls.
Use the ordinary game separately to validate actual flight and map switching.
No changes to live data, release directories, account/progress or admission.

## Existing library challenger

The production streaming choice is still open. The npm registry reports
`3d-tiles-renderer` **0.5.3**, Apache-2.0, with Three >=0.167.0. Its maintained
[NASA-AMMOS implementation](https://github.com/NASA-AMMOS/3DTilesRendererJS)
provides hierarchical tile selection and bounded cache controls, and its
[GLTF extension plugin](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/src/three/plugins/API.md)
supports supplying KTX2 and Meshopt loaders. Compare it on the same authored
packages before choosing a production scheduler. Its
[cache API](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/src/core/renderer/API.md)
also makes clear that limits and fallback quality must be configured; a library
cannot make oversized source packages fit a smaller budget. No library/engine
winner or migration speedup has been measured. It has not been installed merely
to add a dependency.
