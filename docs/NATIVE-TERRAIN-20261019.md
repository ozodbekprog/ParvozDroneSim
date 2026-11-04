# Pine Valley native terrain — 19 October 2026

Continuation of [optimization](OPTIMIZATION-20261019.md), published in
`20261020-optimization-01`. Public Pine free flight and tiled ground are verified;
see [deployment verification](ORACLE-DEPLOYMENT.md).
Native customization is already integrated in the existing Workbench; its separate
record is [NATIVE-CUSTOMIZATION-20261019.md](NATIVE-CUSTOMIZATION-20261019.md).

## Reproduction and source evidence

The actual Low overview reproduced conspicuous pale, enlarged ground blotches.
Raycasts hit TerrainSurface_0_192_224 / TerrainSurface_0_224_224 with their intended
terrain color maps, not a wrong horizon/LOD fallback. A patch spans 93.75 m;
512 px source baking becomes 256 px on Low (about 36.6 cm per texel).

The five cached native TerrainLayer records specify 1×1 m tiles, offset
0.3333333433 m on both axes, normal scale 1, metallic 0 and smoothness 0.
A targeted read of the already installed game's 7 KB layer bundle recovered
only these missing records; the map, aircraft and full recovery were not rerun.
Original layer JSON, textures, IDs, hashes, author/source and unconfirmed
permission metadata are retained in `content/maps/liftoff-pine-valley-demo/native-terrain/`.

## Change and verification

The runtime combines the five original diffuse/normal layers with the two
original splat masks using continuous world coordinates and the source tiling.
Low keeps 256 px tiled diffuse and disables normal detail. Paint masks retain
their source resolution; higher settings restore normals/resolution from RAM.
No tint, geometry, collision, route, flight tuning or new vegetation was added.

One shared terrain material is installed before batching. Only explicitly
registered node materials can be batched; unrelated custom shaders are excluded.
All texture URLs enter normal preflight delivery. Node texture ownership now
participates in quality changes, memory estimation and scene disposal, including
failed/canceled preparation. Old cloned terrain materials are released while
the original GLB remains in the existing model cache.

55 related tests pass across three focused runs: native sources/preload/schema,
shared material/batching, quality/ownership/cancellation, content round trip,
renderer compilation, scene retention and existing material/physics behavior.
Production build passes (149 modules). Catalog revision: `2132caf43c0e38df`.

Actual fixed 1280×720 Low before/after frames have identical camera transforms:
[evidence](design/native-terrain-20261019/README.md). The enlarged pale blotches
are gone. Static batches: 481 → 166. Full initial view retains 5,028,148 triangles,
352 → 325 calls; fixed overview has 3,392,029 triangles / 218 calls. Three warm
overview renders total 46.8 ms CPU render submission in the diagnostic sample;
this is not a frame-rate acceptance benchmark.

Native normals render without shader errors on both WebGL2 and WebGPU. Full
Ultra frames also render on both, at the same fixed resolution and overview.
WebGL2's first Ultra frame still stalls badly (73.1 s in the fresh-context run);
WebGPU's first Ultra frame is 8.1 s. These timings are not accepted performance.
The initial long WebGL2 attempt was closed after control timed out; the fresh
run completed and its complete measurement is retained.

## Remaining work

- The original baked material reproduces the cold stall: Low first frame
  12.94 s, 189 new pipelines / 10.88 s in pipeline creation; Ultra first frame
  83.41 s, 461 pipelines / 73.85 s creating them. Native terrain's 73.05 s Ultra
  sample is not an isolated new failure. The original forest materials and
  distance-baked surface dominate; RTT/PostProcessing rows include nested scene
  work and must not be added together. Cold driver/pipeline work still needs
  diagnosis. QA `bakedTerrain=1` and first-frame object/pipeline probes retain
  a reproducible comparison. Normal-only WebGL2 preparation was also 8.9 s.
- WebGPU currently emulates BatchedMesh with individual draws: 2,737 calls in
  the full Low view, despite 166 batches. Replacing this submission path is a
  separate performance change. No target GPU claim follows from WebGL2 counts.
- Real lighter scenery LODs preserving canopy shape/density, Green grass and
  visual contacts, Arena angle/LOD and high-speed chase observation remain.
- UHD620 / 60 FPS and complete modern lighting/foliage art remain unverified.
  Oracle publication and public Pine flight were subsequently verified in
  `20261020-optimization-01`. Existing baked GLBs and editable sources remain.

Reproduction uses `node tools/install-native-terrain.js` only when changing the
cached source adaptation, followed by `npm run content:sync`. Do not repeat it
for ordinary continuation. Local profiling URL:
`/tools/qa-performance.html?map=liftoff-pine-valley-demo`; `webgpu=1` selects the
primary backend; default forces WebGL2. All QA controls stay outside the game.
