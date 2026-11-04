# WebGPU instancing evidence

[Diagnosis, measurements and limitations](../../WEBGPU-INSTANCING-20261019.md).
All local browser captures use Intel UHD device 0x9BC4, reported `intel gen-9`.
No UHD620/60 FPS or production claim.

- `pine-before-sample.json`: original static FPV, 15 seconds, first 3 seconds
  excluded. Its backend field is transparently corrected from an old QA label;
  the original load and browser renderer were WebGPU.
- `pine-final-fpv.json`, `pine-final-load.json`: final default WebGPU path.
- `pine-fixed-before.json`, `pine-fixed-final.json`: identical 90 camera poses,
  two passes each. Second-pass triangles match for every pose. Use these for a
  controlled moving comparison; each file includes raw per-frame samples.
- `pine-fixed-after.json`, `pine-after-*`, `pine-revised-load.json`: intermediate
  restricted-group candidate. Raw time-based tours include initial shader stalls
  and a CPU-heavy repeat; do not compare unequal route sampling as fixed poses.
- `pine-first-candidate*`, `pine-instance-load.json`: rejected over-grouped
  prototype, retained to explain why fewer draw calls alone were insufficient.
- `pine-moving-detail.json`: 20 controlled small camera moves. Culling totals
  14.7 ms and attribute upload totals 11.8 ms, before static-sphere caching.
- `pine-before.jpg`, `pine-final.jpg` and corresponding metadata: actual same
  1280×720 Low framebuffer, adaptation off. Images are byte-identical.
- `pine-ultra.jpg` / metadata: final normal/reflection/shadow smoke check,
  matching the earlier original-batch view in `../native-terrain-20261019/`.
- `green-load.json`, `green-low.jpg` / metadata: second-map smoke check.
- `pine-webgl-control.json`: unchanged WebGL multi-draw path after the final
  transform-preservation regression fix; no browser console errors.

First-view cold route stalls remain. The unchanged geometry is still well above
the Low triangle budget. These checks establish submission and visual preservation,
not complete map-art or performance acceptance.
