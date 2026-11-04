# Browser recovery implementation — 25 October 2026

Continuation of [the readiness audit](BROWSER-READINESS-AUDIT-20261025.md).
Implementation in progress; Oracle has not been updated by this work.

The user confirmed UHD 620 remains the minimum and that laptop must be tested
before release. The present i5-10300H/UHD/GTX 1650 computer cannot provide that
acceptance. Browser Use became available again in the continuation. The
[streaming prototype report](MAP-STREAMING-PROTOTYPE-20261025.md) records actual
Edge rendering, repeated resource-release cycles, movement and cancellation
checks. Full-game integration and target-hardware acceptance are still pending.

## Scene retirement follow-up

Menu/Hangar draft commits and the neutral workshop now retire the previous
map's prepared collision store, after a successful replacement. A failed or
pending replacement keeps the active physics. Repeated transitions also exposed
a stale `workbench` value that could reopen the wrong map; scene commits now
transfer that state and the reuse guard verifies the active map.

The regression failed before the fix and passes 20 alternating menu/Hangar
transitions, failed replacement retention, and neutral-workshop retirement.
31 affected scene/collision tests and the production build pass. This is an
automated lifecycle regression using small collision fixtures, not 20 measured
full-map browser cycles or a GPU-memory acceptance result.

The actual collision payloads from all five imported maps were then prepared
and retired over 20 cycles through the client's install/release functions in
Node with forced GC. Baseline/final heap: **38.997/39.128 MiB**;
baseline/final ArrayBuffers: **0.034/0.034 MiB**. Largest sampled active heap:
61.567 MiB; largest sampled active ArrayBuffers: 54.900 MiB. First retirement
still showed 7.433 MiB of ArrayBuffers; final retirement returned to baseline.
RSS was 95.879 MiB initially and 241.059 MiB finally, so this does not claim the
process returned all reserved allocator memory to the OS. Sampling with GC is
intrusive and does not measure transient peaks, browser workers or GPU memory.

Reproduce separately from frame timing:

```powershell
node --expose-gc tools/benchmark-collision-lifecycle.js data/browser-readiness-20261025/collision-lifecycle-20.json 20
```

## Worker preparation verified locally

The browser now parses/validates collision JSON and builds packed trees in a
cancellable module worker. Typed arrays transfer back without per-triangle
object cloning; broadphase installation yields between bounded batches. Cached
download buffers are not detached. Map retirement releases decoded physics.
Solo, replay and multiplayer preparation pass the loading-session abort signal.

Full suite passed **540/540** before the final completed-session cache guard;
the guard adds one focused regression. Production build passed and emitted the
collision worker. Local IAB actually entered Minus Two free flight and returned
through pause/exit with no warning/error logs. Recorded load phase to flight:
4.033 seconds; largest observed startup task 300 ms. This is local development
delivery, not a cold public comparison or FPS acceptance.

An isolated **real browser worker** probe using all The Green collision data
completed in 1,732.1 ms: parse/validation 551 ms, tree build 901.7 ms. During the
probe the page delivered 103 timer callbacks at a requested 16 ms interval and
recorded **zero >=50 ms main-thread tasks**. A preceding real worker cancellation
returned AbortError; retry succeeded with 20,364 colliders. This probe excludes
network and visual-model preparation and does not claim all startup freezes fixed.

Edge disconnected between turns; this worker verification used IAB, so its
timings are not treated as a matched before/after with the earlier Edge run.
Machine inventory: i5-10300H, Intel UHD Graphics and GTX 1650. This is not the
required UHD 620 hardware. Temporary test database is isolated under data/.

## Verified offline map delivery experiment

New tools use the existing glTF Transform 4.5.1 / meshoptimizer 1.3.0 pipeline
and explicitly pin the already-transitive `ktx-parse` 1.1.0 development
dependency. They keep the full-quality canonical models and editable sources.
No experimental package is installed in the game or published to Oracle.

`low-map-delivery.js` keeps the authored Low LOD selectors and selects existing
KTX2 mip payloads up to 256 pixels, without texture recompression or geometry
decimation. This is a Low texture-quality experiment requiring visual approval.
It verifies node transforms, instance arrays, vertex attributes, and triangle
membership/order/winding after writing and reading. Meshopt may losslessly
rotate a triangle's starting corner; the verifier accepts that rotation and
rejects reversed winding or moved vertices. Skins, animations and morphs fail
closed. Unsupported texture layouts also fail closed.

`chunk-map-delivery.js` packages top-level selectors by map placement cell.
It emits separate glTF/binary resources, shared encoded textures by content
hash, original object placement indices, resource hashes and a manifest. Every
package is read back and checked against its input geometry. This does not yet
provide runtime streaming, distance coverage, prefetch, eviction, quality
upgrades, or proof that fast flight cannot outrun visual delivery. Full authored
collisions remain mandatory for flight.

Sizes below are decimal bytes, without HTTP compression or cache assumptions:

| Experiment | Total bytes | Packages | Largest individual package including all dependencies |
| --- | ---: | ---: | ---: |
| Minus Two original | 26,340,900 | 1 | 26,340,900 |
| Minus Two Low monolith | 16,574,984 | 1 | 16,574,984 |
| Minus Two Low, 24 m cells | 17,049,518 | 24 | 3,442,851 |
| The Green original | 265,604,208 | 1 | 265,604,208 |
| The Green Low monolith | 147,544,556 | 1 | 147,544,556 |
| The Green Low, 512 m cells | 151,417,261 | 65 | 75,795,184 |
| The Green Low, 128 m cells | 181,762,133 | 1,025 | 26,665,051 |

Minus Two verifies 93 selectors; The Green verifies 8,253. Minus Two is the
better next streaming prototype. A single package is not the complete area
needed for flight, and its size does not establish first-flight timing. The
Green experiment demonstrates why this split alone is insufficient: large
packages, geometry duplication and 2,944 total resources. Do not install it as
a completed loading fix. Both Low monoliths still share substantial geometry
with the original higher-detail levels.

The existing Khronos KTX CLI successfully validates all **85 Minus Two + 895
The Green unique textures** with glTF BasisU compatibility and warnings treated
as errors. All **980** also actually transcode to RGBA8. This validates files
and native decoding; the browser's Basis worker, GPU upload and visible quality
still require checks after Browser Use is enabled. Final focused tests: **35/35**
(scene switching, collision preparation/cache/release, mip selection, chunk
integrity/sharing and geometry parity). The production build for the runtime
scene-retirement fixes passed before these development-tool-only additions.

Reproduction (use a new output folder for each chunk experiment):

```powershell
node tools/low-map-delivery.js content/maps/minus-two-demo/map.json data/browser-readiness-20261025/minus-two-new-low.glb
node tools/chunk-map-delivery.js content/maps/minus-two-demo/map.json data/browser-readiness-20261025/minus-two-new-low.glb data/browser-readiness-20261025/minus-two-new-chunks 24
node tools/check-delivery-textures.js data/browser-readiness-20261025/minus-two-new-chunks/delivery-manifest.json tools/bin/ktx/portable/bin/ktx.exe data/browser-readiness-20261025/minus-two-new-textures.json
```

Existing experiments/reports are under ignored `data/browser-readiness-20261025/`:
`minus-two-low.glb`, `the-green-low.glb`, `minus-two-chunks-final/`,
`green-chunks-512/`, `green-chunks-128/`, their manifests, and
`*-texture-validation.json`. Reuse them for browser verification rather than
repeating imports/exports. Earlier partial chunk directories are diagnostics,
not delivery candidates. Source/output hashes are in each Low report and
resource manifest.

## Acceptance still outstanding

1. Browser Use is now enabled; prototype rendering and release checks are in
   the linked report. Verify actual
   menu/Hangar/flight switching; repeat 20 full-map browser cycles with settled
   memory samples. Native decoding and Node GC do not substitute for this.
2. Integrate and measure the bounded Minus Two streaming prototype, including shared
   GPU resources, contiguous distant coverage, look-ahead/cancel/retry and
   quality switching. The local prototype now demonstrates resource ownership,
   distant coverage, moving detail and cancellation. The Green needs finer
   geometry/resource partitioning.
3. Run the matched current-Three/updated-Three/PlayCanvas comparison described in
   the audit. No engine winner or migration speedup has been measured.
4. Test the UHD 620 laptop at real 1280×720, Low, adaptation off, on a repeatable
   moving route. Existing F4 capture performs 30 s warmup + 3 min measurement;
   F6 downloads raw frames and the report. Confirm hardware separately and
   record backend, framebuffer, draw calls, triangles and texture-budget
   evidence. Median <=16.7 ms and 1% low >=50 FPS remain required.
5. Complete public acceptance and the documented backup/drain/release/rollback
   process only after these gates. Oracle is unchanged by this work; the full
   market-ready product is not yet accepted.

## Compact collision trees

Replaced per-triangle retained Triangle/Vector3 trees with transferable typed
buffers. Float64 coordinates, median split, stable leaf order and existing
contact/sweep calculations are preserved. Box/capsule physics is unchanged.

Fresh-process CPU diagnostic for The Green (681,147 triangles, 20,364 colliders):

| Metric | Before | Compact trees |
| --- | ---: | ---: |
| Parse + validation + preparation | 3,293.86 ms | 1,941.09 ms |
| Tree/index preparation alone | 2,722.76 ms | 1,363.98 ms |
| Retained JS heap after forced GC | 336.60 MiB | 87.53 MiB |
| ArrayBuffer storage | 0.04 MiB | 54.90 MiB |
| Process RSS at sample | 529.99 MiB | 329.00 MiB |

606 deterministic contact/sweep/broadphase probes have identical SHA-256:
`d05e5c585b1a971cb5a928d3374d2007cf028a8445c5de98d2435160b4e7b9ad`.
These are single-run Node CPU diagnostics on this machine, not browser FPS,
peak-memory measurements or UHD 620 acceptance. Heap and ArrayBuffers must be
considered together. Reproduce with:

```powershell
node --expose-gc tools/benchmark-collision-preparation.js liftoff-the-green-demo data/browser-readiness-20261025/green-result.json
```

44 focused tests passed, including all stock drones taking off on all five
actual imported maps, continuous wall/floor sweeps, contact dynamics,
broadphase ordering and typed-buffer transfer. Subsequent browser worker
integration and cancellation results are recorded above.

## Public baseline observed before implementation

Direct Edge tab at the public URL still serves `index-D31s-vkZ.js`. Menu code
was HTTP cached; this was not a cold-menu acceptance run. Selected The Green
free flight. Its GLB transferred 265,604,508 bytes including reported overhead,
with a 112,446 ms resource duration. Collision JSON transferred 10,891,164 bytes
and expanded to 138,107,819 bytes; resource duration 49,720 ms.
The page reached flight. Reported JS heap was about 2.46 GB; longest observed
main-thread tasks were 7,881 ms and 3,923 ms. Flight readiness was not captured
at the exact transition, and no standardized moving FPS route was recorded.
This confirms large transfers/stalls, not their complete attribution. Public
settings were inherited, so this is not a matched Low benchmark.
