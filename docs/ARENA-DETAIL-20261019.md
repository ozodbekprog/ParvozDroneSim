# Arena yaw and oblique texture detail — 19 October 2026

Published in `20261020-optimization-01`; see [deployment verification](ORACLE-DEPLOYMENT.md).
No source geometry, map configuration, collisions
or flight tuning was edited. This follows the earlier distance/bounds LOD repair.

## Reproduction and findings

The local browser tool holds the camera at
`[28.254150390625,22.17001724243164,1.5439624786376953]`, FOV 72, actual 1280×720,
adaptation off. It turns 0° → 20° → 0°. Detail range is the UI maximum, 4;
full-resolution textures and normal maps are enabled. Lighting stays Low to
isolate detail from post effects. This is not an Ultra performance measurement.

Across **1,613 source LOD groups**, no selected index changes with yaw on WebGL.
Initial selection: 65 at LOD0, 9 at LOD1, 1,505 distant chunks at LOD2, 34 hidden
groups uninitialized. The map's large exterior grid explains the distant count;
these are not all visible objects. Draws/triangles change with the frustum as
expected: 192 / 567,611 at 0°, 174 / 458,366 at 20°, then exactly back.
The final WebGPU run also preserves every LOD and the same triangle counts
(692 / 670 / 692 draws). No errors are recorded during that complete run.

The centred and returned framebuffer JPEGs match byte-for-byte. The reported
angle-specific polygon LOD switch does **not** reproduce at this position in the
current version. This one view does not prove the absence of every Arena issue.
The renderer uses ordinary frustum culling; no separate occlusion-query system
is making these detail decisions.

Oblique texture blur does reproduce: source textures use anisotropy 1. With the
same geometry and camera, 8× filtering makes the slanted advertising text and
seat textures substantially clearer. [Actual comparison](design/arena-yaw-20261019/).
This is a texture-sampling repair, not evidence of a new geometry LOD algorithm.

## Change and verification

Existing graphics presets now request Low 1×, Medium 4×, High/Ultra 8× filtering,
bounded by the current renderer/device capability. Low retains the source's
existing filtering (including Pine's native 4× tiled terrain). Nearest samplers,
render targets and cube textures are excluded. Reapplying unchanged settings
does not invalidate warm textures; changing quality restores the source baseline.
The existing settings menu remains; no extra product UI was added.

Two regressions failed before the fix and pass after it. All 28 affected
surface/terrain/scene/automatic-graphics/texture-binding tests pass, as does the
production build (150 modules). Browser screenshots and raw LOD selections are
retained with the QA-only `Inspect maximum detail yaw` control.

During repeated development reloads, the browser log recorded a WebGL context
loss and failed fallback initialization at 17:31:47–17:32:09 UTC. Subsequent
complete Arena load/capture runs succeed. These old entries are not silently
treated as a clean session, and robust context-loss handling remains a separate
follow-up; they are not evidence that yaw changes LOD.

Cold first-view freezes, real geometry reduction, Green grass/material art,
high-speed chase visual acceptance and UHD620 performance remain outstanding.
