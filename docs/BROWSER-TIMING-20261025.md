# Foreground timing and isolated renderer comparison — 25 October 2026

Browser access is restored. The isolated API uses a test database on localhost
2567; the ordinary client QA is on 2598 and the renderer candidate is on 2599.
Oracle and production accounts are unchanged. The required UHD 620 laptop has
not been tested; the available machine reports i5-10300H / Intel UHD Graphics
(ANGLE device 0x9BC4), with 16 GB reported by the browser.

## Measurement corrections

F4 game captures now invalidate loss of document focus, including a short blur
between frames. Existing hidden-tab, fixed framebuffer and adaptive-resolution
checks remain. Slow foreground frames are retained and can fail the FPS budget.

The local QA tool records Three revision and validity conditions, checks idle
callback pacing separately before timed rendering, and aborts when the document
loses focus. Interrupted actions append an explicitly invalid result instead of
leaving only an earlier successful comparison in the report. The fixed route
sets and reports a 72-degree camera FOV, restoring the previous FOV afterwards;
the screenshot control previously changed this value and made comparisons use
different visible geometry.

**Browser debugging can emulate focus and visibility even for background tabs.**
For this test, the supported tab CDP capability explicitly sends
`Emulation.setFocusEmulationEnabled` with `enabled:false` before measurement.
Inspect the native browser window as well as the document conditions. A library
cannot detect a deliberately emulated foreground from those page flags alone.
Neither the idle reference nor the validity check filters slow game frames.

The deliberate tab-switch check with focus emulation disabled returned
`Timing stopped: QA document lost focus`, `hidden:true`, `focused:false`.
Earlier minimized-Edge, hidden-IAB and focus-emulated timing observations must
not be used as loading/FPS evidence. Functional resource/disposal checks remain
separate from elapsed-time claims.

## Renderer candidate

`tools/vite-three-candidate.config.js` aliases Three and its addons to an
isolated **0.186.1** install, uses its matching Basis decoder and a separate
Vite cache. Main dependencies and production decoders remain at r180.

```powershell
npm install --prefix data/browser-readiness-20261025/three-candidate --save-exact --no-audit --no-fund three@0.186.1
node node_modules/vite/bin/vite.js --config tools/vite-three-candidate.config.js
```

The candidate builds and loads the actual Minus Two map/course/Kestrel at Low,
1280×720, WebGL2. It reports migration warnings for the removed
`PCFSoftShadowMap` fallback and the `Source` → `TextureSource` rename. This is
an isolated compatibility probe, not a completed upgrade or visual acceptance.

Final reports are saved under ignored `data/browser-readiness-20261025/` as
`edge-three180-fixed72.json` and `edge-three186-fixed72.json`. Each uses the same
90 camera positions twice with adaptive resolution disabled. First-pass shader
stalls remain in the reports; second-pass timings are warm. This short camera
probe excludes player input, physics simulation, multiplayer and public network
conditions, and cannot certify the full flight performance requirement.

| Three | Pass | Median frame (ms) | P95 frame (ms) | Median CPU submission (ms) |
| --- | --- | ---: | ---: | ---: |
| r180 | First | 11.2 | 58.9 | 5.7 |
| r180 | Warm | 11.2 | 11.4 | 5.2 |
| r186 | First | 11.2 | 59.9 | 5.7 |
| r186 | Warm | 11.2 | 11.4 | 5.6 |

Both versions submit at most 169 draw calls and 396,019 triangles in the warm
route. The triangle count exceeds the preliminary Low budget of 300,000.
No frame-time improvement is established by this short comparison. The near
11.2 ms idle cadence also limits what these display-paced frame measurements
can resolve. Neither version avoids the first-pass stalls.

## Verification and next work

Seven timing/report tests pass: focus loss invalidates acceptance, genuine slow
foreground frames remain valid failed-budget evidence, idle pacing catches
severe callback throttling, and existing frame/texture summaries remain correct.
The production build passes with the existing large-client-chunk warning.

Retain r180 until a broader controlled comparison and migration/visual checks
justify an upgrade. Continue the collision delivery and authored map-LOD work
from the [recovery record](BROWSER-RECOVERY-20261025.md); the separate
[streaming prototype](MAP-STREAMING-PROTOTYPE-20261025.md) is not installed in
the game. The UHD 620 acceptance run remains required before release.
