# Correct renderer pipeline warmup — 19 October 2026

Follow-up to [native terrain](NATIVE-TERRAIN-20261019.md), published in
`20261020-optimization-01`. See [deployment verification](ORACLE-DEPLOYMENT.md).

## Reproduced causes and change

The original baked Pine map reproduced 189 new pipelines during its first Low
frame, despite the preceding compileAsync call. Two independently failing tests
confirmed missing r180 distinctions in the representative key: receiveShadow,
indexed/interleaved layouts, per-batch matrix bindings and instance identity.
The key now retains these distinctions, morph identities and skeleton size.
Ordinary equivalent meshes still share the smallest visible representative.
Hidden/distant/inactive LOD geometry stays excluded; visibility is restored
synchronously before waiting for the GPU, as before.

A third failing test reproduced the Low render-target mismatch. Renderer r180
renders screen output into its internal linear framebuffer, then converts it
for output. compileAsync does not choose that framebuffer automatically. Low
had compiled against the canvas, with different output-transform shaders.
World.compileGraphics now selects the same internal framebuffer; explicit
scene-pass targets retain priority. Previous target/MRT state is restored on
success and failure. This uses r180's internal helper, with a guarded fallback
for other renderer types; review this integration when upgrading Three.

## Measured control

Same Intel UHD 0x9BC4, WebGL2, fixed 1280×720, adaptation disabled, original
baked Pine map (`bakedTerrain=1`). Before evidence is under
`design/native-terrain-20261019/`; after JSON is under
`design/renderer-warmup-20261019/`. These are first-use diagnostic samples in
fresh browser contexts, not controlled driver-cache resets or FPS acceptance.

| Stage | Before | After |
| --- | ---: | ---: |
| Low geometry compilation | 1.330 s | 6.141 s |
| Low first rendered frame | 12.940 s | 0.274 s |
| Low new first-frame pipelines | 189 | 1 (output conversion) |
| Ultra geometry compilation | 6.425 s | 30.418 s |
| Ultra first rendered frame | 83.408 s | 2.341 s |
| Ultra new first-frame pipelines | 461 | 55 |

Combined compilation/first-frame time also decreases (Low 14.27→6.42 s;
Ultra 89.83→32.76 s). This is not merely moving all the same synchronous work
behind the loading screen. Geometry, map parse counts and rendered triangle/draw
counts are unchanged in each matched control. Nested RTT/PostProcessing timings
must not be added as independent work.

27 related tests and production build pass. Native terrain also passes: first
Low frame 250.2 ms on WebGL2 and 35.6 ms on WebGPU, one new output pipeline in
each. These are measured first-frame costs, not frame-rate or UHD620 acceptance.
Remaining Ultra pipelines include post effects and shadow/
distance material variants; total cold preparation remains too long. This does
not solve the large WebGPU draw count, canopy geometry/LOD budget, Green grass,
Arena visual complaint, chase visual observation or target UHD620 acceptance.
