# Native Pine terrain comparison — 19 October 2026

Actual game framebuffers, fixed 1280×720, adaptation disabled. Before/after
Low shots use the identical camera/quaternion/FOV recorded in their JSON files,
Intel UHD device 0x9BC4, WebGL2. These are not UHD620 acceptance measurements.

- `pine-low-before.jpg`: original baked patch material, 256 px across 93.75 m.
- `pine-low-after.jpg`: original five TerrainLayer textures, native 1 m tiling,
  offsets and two source splat masks, installed before scenery batching.
- `pine-low-profile.json`: integrated load and three warm frame CPU probes.
  Visible overview: 3,392,029 triangles / 218 calls; full loading view:
  5,028,148 triangles / 325 calls. Total static batches: 166 instead of 481.
- `pine-ultra-webgpu.jpg` / JSON / profile: full Ultra, same overview and
  resolution on the Intel gen-9 WebGPU adapter, including native layer normals.
  No shader errors. High draw count and cold preparation remain unresolved.

The tile scale fixes the conspicuous stretched, pale blotches. Source forest
floor colors are retained; this is not complete lighting/vegetation art approval.
The initial WebGL2 Low→Ultra attempt stopped responding and was closed. Fresh
normal-only and full Ultra renders succeeded on both backends without shader
errors. `pine-ultra-webgl2.*` and `pine-normals-webgl2-profile.json` retain the
fresh-context evidence. The first full Ultra WebGL2 frame took 73.1 s; successful
rendering is not performance acceptance. Source comparison/profiling continues.

Original-material controls: `pine-baked-low-profile.json` and
`pine-baked-ultra-profile.json`, same Intel/WebGL2 and fixed resolution. Old Low
first frame 12.94 s (189 new pipelines, 10.88 s creating them); old Ultra 83.41 s
(461 pipelines, 73.85 s creating them). Native Ultra's 73.05 s is not evidence of
an isolated terrain regression. RTT/PostProcessing timings contain nested scene
renders; do not sum them as independent costs.
