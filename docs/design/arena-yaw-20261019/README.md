# Arena detail evidence

[Findings and limits](../../ARENA-DETAIL-20261019.md).
Reports store group names once in `sourceLODGroups`; each row's `levels` array
contains the corresponding selected indices. This lossless indexing avoids
repeating thousands of names across the three views.

- `arena-low-overview.jpg`: initial Low framing, not the full-detail comparison.
- `arena-max-yaw-webgl.json`, `arena-max-webgl-0/1/2.jpg`: original 1× filtering,
  full texture size and detail distance 4, yaw 0° / 20° / 0°. Every LOD stays fixed.
- `arena-max-yaw-filtered-webgl.json`, `arena-filtered-webgl-0/1/2.jpg`:
  diagnostic 8× experiment before the production preset change.
- `arena-final-webgl.json`, `arena-final-webgl-0/1/2.jpg`: final production surface
  setting, 8× requested. Identical draws/triangle counts to the original comparison;
  no yaw-induced source LOD changes. The 0°/returned JPEG SHA-256 is identical:
  `8b73ec5f551d8aec26223db87c78df48a44336a07c0824e25e084b0ce5ade794`.
- `arena-final-webgpu.json`, `arena-final-webgpu-0/1/2.jpg`: final WebGPU check,
  unchanged source LODs and matching triangle counts. Returned-frame SHA-256:
  `ed4d8e834916fec386a27b5ac95d6498795557c6d25b84e53842c9bd54f7ad64`.
  `webgpu-browser-check.json` records the run window and no console errors.

All are actual 1280×720 framebuffers on Intel UHD 0x9BC4, adaptation off. Low
lighting stays enabled while texture resolution and LOD range are maximized.
No target-hardware FPS or general map-art acceptance is implied.
