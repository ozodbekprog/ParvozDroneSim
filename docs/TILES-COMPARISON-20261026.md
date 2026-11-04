# 3D Tiles versus grid — local compiled-map comparison

26 October 2026. Companion to the
[collision implementation](BINARY-COLLISION-20261026.md) and
[technology investigation](INDEPENDENT-BROWSER-TECHNOLOGY-20261026.md).
This is a camera-only development experiment, not a game integration or an
engine migration. Oracle is unchanged.

## What is implemented

Pinned Apache-2.0 `3d-tiles-renderer` 0.5.3 as a development dependency.
It uses the installed Three 0.180.0; Three was not upgraded. Only the local QA
entry imports it. The shipped game entry does not import this scheduler.

[Library adapter](../tools/tiles-map-stream.js) consumes the same existing
compiled Minus Two manifest as the grid control. Both use
[StreamChunkLoader](../src/stream-chunk-loader.js), content hashes, Meshopt,
KTX2, texture leases, authored transforms and persistent coarse coverage.
Prefetched glTF bytes are verified and passed into that loader, avoiding a
duplicate model fetch. No map/model export was repeated.

The adapter maps Parvoz Y-up into local Z-up tiles and back at the renderer
group. Bounds cover the actual geometry. Resource disposal stays with the
shared loader: the library cannot destroy a texture still owned by another
tile or coarse coverage. Separate queues and late-result checks keep a retired
comparison from attaching new detail.

The hierarchy is flat near cells plus independently retained coarse coverage,
using explicit 1.0-style tile bounds/content. It is not a qualified HLOD/error
hierarchy or a claim of complete 3D Tiles 1.1 conformance. The original compiled
experiment files are reused from `data/browser-readiness-20261025/minus-two-streaming/`.

## Failure found and correction

The initial eight-slot cache faced 21 visible candidates and repeatedly loaded
and evicted detail: one captured failure had **521 loads / 514 evictions** in
about 30 seconds. A cache maximum alone did not make that working set useful.
That failure remains in ignored `data/collision-binary-20261026/tiles-failure.json`.

Both controls now share the existing radius/look-ahead/retention policy through
[candidate admission](../src/stream-selection.js). The library may further
frustum-cull those admitted candidates. Leaving admission removes/aborts the
stale tile; LRU slot headroom accounts for in-flight placeholders. Resident
geometry admission remains separate from texture leases.

A regression with 21 visible candidates and a two-cell cap now loads exactly
two cells without repeated eviction over settled updates. Tests also cover
coordinate parity, foreign texture ownership, late cancellation and oversized
detail rejection. Settling requires successive completed traversals rather than
treating completion of the root descriptor as readiness.

This is explicitly a library **with Parvoz admission**, not evidence that the
stock library automatically enforces a total browser memory budget. Geometry
estimates exclude texture/transcode/upload/driver peaks; the 64 MiB texture pool
and persistent coarse geometry have their own ownership.

## Browser result

[Functional browser evidence](research/tiles-comparison-check-20261026.json).
Isolated local API/database, admission 20, headless Chrome/GTX 1650,
WebGL2, Low, actual 1280×720, adaptive resolution off:

- Both controls rendered the authored garage in inspected canvas captures.
- Each passed three load/release cycles, returning chunk/image/preparation
  ownership and estimated payload bytes to zero, plus immediate cancellation.
- Neither fetched the original whole-map GLB; both used compiled external
  glTF/binary/KTX2 deliveries. No JavaScript exceptions were captured.
- One settled view had grid 8 ready cells / 194 draws / 323,893 triangles;
  tiles 5 ready cells / 242 draws / 330,644 triangles. Selection/rendered work
  differs, so these are functional observations, not an FPS ranking or visual
  equivalence certificate. Both exceed the preliminary triangle budget there.

Canvas screenshots were checked directly. Automation imports the actual HTML
module URL, including Vite's revision query, and asserts one renderer canvas;
an unversioned second import can otherwise create a misleading empty capture.

All 139 current test files were covered in partitioned runs: **600 distinct
tests pass**, including real-map flight/AI checks. The latest changed streaming
subset passes 12/12. Build/content checks pass. This is not foreground pacing,
fast-flight physics, 90-minute residency or UHD 620 acceptance.

## Continue

With an isolated local API on 2567 and Vite on 2598:

- Grid: `http://127.0.0.1:2598/tools/qa-map-streaming.html?scheduler=grid`
- Library: `http://127.0.0.1:2598/tools/qa-map-streaming.html?scheduler=tiles`

Next decisive work is a true hierarchical compiler slice with useful parent
coverage/error and explicit in-flight reservations, then a matched PlayCanvas
render adapter. Maximum-speed boundary/reset/revisit and long sessions must
precede any game-wide visual streaming adoption. Full-map collision coverage
remains independent and flight behavior must remain unchanged.
