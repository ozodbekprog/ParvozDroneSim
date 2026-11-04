# Native foliage PBR sources — 18 October 2026

The **material-only patch is now selected by map.json** through model.glb.
All geometry, LODs, UVs, original textures, collisions and courses are unchanged;
material-only-verification.json checks every node and mesh. The canonical
map.blend plus editable foliage-materials.blend retain the geometry/material
sources separately, avoiding a duplicate 780 MB scene. Original Liftoff content belongs to
LuGus Studios and its credited providers; individual authors are not established.
Source: https://www.liftoff-game.com/ . No redistribution license is established;
`permissionConfirmed:false` remains in the parent SOURCE.json. The user's online
multiplayer-test authorization is retained, not expanded to commercial use.

Eleven packed texture PNGs in `packed/` are decoded from the exact existing Pine
bundles with UnityPy 1.25.4 (MIT). Bundle identities, image SHA256 and source
material bindings are in recovery.json. UnityPy was installed in ignored
tools/bin/unitypy only. No game scripts or other scenes were exported.

Tree Creator normals are A=X/G=Y, separate translucency alpha is gloss; verified
against [Unity's shader source](https://github.com/TwoTailsGames/Unity-Built-in-Shaders/blob/master/DefaultResourcesExtra/Nature/TreeCreator/TreeCreatorLeavesOptimized.shader).
The original AFS shader property metadata is saved and states normal GA,
translucency R, smoothness B. Twelve prepared maps at max 512px reconstruct normal
Z and convert source gloss to roughness, with dielectric metalness zero. Source
specular/translucency are not mislabelled as AO. Wind and light transmission are
still approximations. Reader orientation matched original fern albedo exactly.

Reproduce editable materials **into a separate candidate**, without assembly:

```powershell
& 'D:/Programs/Blender Foundation/Blender 5.1/blender.exe' --background content/maps/liftoff-pine-valley-demo/map.blend --python tools/blender/apply_foliage_pbr.py -- content/maps/liftoff-pine-valley-demo/pbr-candidate/materials.json data/ui-performance-20261018/pine-pbr-candidate.blend
```

That command was executed with the same prepared maps in data/. Nine bound
materials and packed images were saved; canonical input was not overwritten.
The small library was extracted from that candidate with
tools/blender/extract_foliage_library.py, checking all nine source keys. Append
its materials and bind by sourceMaterialKey to reproduce the editable result.
`tools/derive-map-lods.js` separately derives lighter LOD1/2 from native UV topology
and thins whole leaf/grass cards. LOD0 fingerprint, texture bytes and course
inputs remain unchanged. `tools/patch-foliage-pbr.js` binds these source materials
by `sourceMaterialKey` into a separate GLB. Candidate reports retain exact hashes.

Browser access was restored. Low measurement of the reduced packed geometry
gave 644,623 visible triangles but 36.4 ms median frames on GTX 1650; its canopy
is too sparse. That geometry experiment is rejected for promotion. Native PBR
source textures remain useful independently of geometry reduction; keep the
original dense forest in the accepted material-only patch. Actual Ultra views
were checked beside native rocks/trees and on a course; see the UI/performance
continuation. The result still approximates light transmission, wind and baked
occlusion; this is not a claim of modern photorealistic art acceptance.

`tools/quantize-reduced-lods.js` tested an isolated 16-bit packing of reduced
levels; authored full-detail attributes are unchanged. Node and GPU-instance
placement compensation has two tests. See packing-candidate-report.json:
278.9 MB versus the original 201.4 MB. Download-size growth remains unresolved,
so this structurally verified experiment is not accepted for release.
