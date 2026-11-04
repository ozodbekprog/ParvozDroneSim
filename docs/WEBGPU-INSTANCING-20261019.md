# Repeated scenery on WebGPU — 19 October 2026

Published in `20261020-optimization-01`; see [deployment verification](ORACLE-DEPLOYMENT.md).
Catalog revision
`2132caf43c0e38df`, flight tuning, collisions and canonical models are unchanged.

## Diagnosis and implementation

Three r180's WebGPU BatchedMesh submits one draw per visible placement. Pine's
166 spatial batches therefore still produced 2,737 draws in the Low FPV view.
Source trees reuse position/normal/UV/index accessors, but their uniform vertex
colors differed. Those colors unnecessarily separated identical prototypes.

The WebGPU path now uses real InstancedMesh draws for repeated prototypes within
the existing spatial/material groups. Only an exactly uniform, opaque RGB color
can become an instance tint. Nonuniform painting and vertex alpha are preserved.
Geometry, transforms, source materials, per-placement frustum tests and each
source LOD's visibility remain. Several LODs at one placement do not count as
useful repetition. Other geometry retains BatchedMesh; WebGL retains multi-draw.

Static placement spheres are cached. Visible transforms/colors are packed only
when the visible ID sequence changes; an unchanged view reuses its upload.
Camera/shadow views and LOD changes invalidate the right selection. Source data
updates invalidate the packed view. Prototype geometry stripped of uniform color
is owned by the scene and uses the existing cleanup path.

The first experimental grouping counted mutually exclusive LODs as repetitions:
1,673 groups, worse CPU cost, no FPS improvement. It was never enabled in the
client. Requiring three distinct placements reduces the final group count to
115, versus the original 166. All 22,292 batched source meshes are retained.

## Measurements and limits

Same IAB Intel UHD / device 0x9BC4 (reported `intel gen-9`), WebGPU, Low,
actual 1280×720, adaptive resolution off. This is not a UHD 620 acceptance test.
Raw results and frame metadata: [evidence](design/webgpu-instancing-20261019/).

| Measurement | Original batches | Final instances |
| --- | ---: | ---: |
| FPV draws | 2,737 | 442 |
| FPV visible triangles | 5,028,148 | 5,028,148 |
| FPV median CPU | 13.2 ms | 9.5 ms |
| FPV median frame interval | 44.9 ms | 39.0 ms |
| FPV p99 frame interval | 67.5 ms | 77.9 ms |
| Fixed moving route, mean draws | 1,661.9 | 306.5 |
| Fixed moving route, median CPU | 9.7 ms | 9.6 ms |
| Fixed moving route, p99 CPU | 24.3 ms | 15.5 ms |
| Fixed moving route, median frame interval | 36.4 ms | 37.1 ms |
| Fixed moving route, maximum frame interval | 693 ms | 161 ms |

The moving comparison renders the same 90 camera poses twice; the table uses
the second pass. Triangle counts match at **all 90 poses**. A preceding candidate
pass measured 34.7 ms median; the final 37.1 ms shows why a stable moving-FPS gain
is not claimed. Time-based tours sample different areas more often when stalls
occur; their raw results include one anomalous CPU-heavy repeat. The fixed route
was added to avoid treating those unequal samples as a controlled comparison.

The first fixed pass still stalls: maximum interval 5.23 s original / 5.96 s
final. Preparing resources outside the initial view remains unresolved. Instancing
does not reduce the five million visible triangles or establish 60 FPS. Genuine
geometry LODs, cold first-view preparation and target-hardware checks remain.

## Verification

- Actual Low overview before/final JPEGs are byte-identical, SHA-256
  `71624774fc0f0e7dff1828c0aa454b2673a48266bd0494228976b85ad6b77c30`.
- Actual Ultra frame with normals, reflections and shadows renders without
  console errors; its matching earlier original-batching frame remains in the
  native-terrain evidence. This is a regression check, not art acceptance.
- Green loads/renders without errors (245 initial draws). Pine WebGL retains
  166 multi-geometry groups, 325 initial draws and 5,028,148 triangles, no errors.
- 31 batching/compiler/LOD/static-scene tests and 26 cleanup/surface/scene tests
  pass. Includes per-object frustum restoration, LOD hide/show, exact tint,
  preserved alpha/painting, source-update invalidation and backend selection.
- Production build passes (150 modules). The QA page's repetition, CPU and fixed
  course controls are local developer tools, outside the shipped entry point.

## Continue

Use `/tools/qa-performance.html?map=liftoff-pine-valley-demo&webgpu=1` for the
normal WebGPU path. Append `&legacyBatches=1` for the original control, or omit
`webgpu` for WebGL. Load flight, then `Fixed course comparison` runs both passes.
Never claim the original cold-view freezes or the Low triangle budget are fixed.
