# Replace the placeholder content

## One official source

All published maps, races, aircraft, parts, career missions and tutorials come from `content/`. Keep current IDs when replacing geometry to preserve saved builds. A map can contain any number of named courses from `content/races/`, with different gate positions and starts. Developer tools are local; players do not get an import menu.

## Import files without the visual editor

```powershell
npm run content:import -- --type map --id hangar --file "C:/Models/hangar.glb"
npm run content:import -- --type drone --id kestrel --file "C:/Models/quad.fbx" --blender "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe"
npm run content:import -- --type part --id my-prop --category propellers --file "C:/Models/prop.obj" --blender "C:/Path/To/blender.exe"
npm run content:sync
```

The destination is `content/<category>/<id>/model.glb`. Existing model/definition backups go into `data/content-import-*/previous/`. FBX/OBJ are converted by installed Blender into embedded GLB; GLB imports do not require Blender. This converter does not change geometry detail or automatically bake arbitrary shader graphs. Blender conversion must be checked with your own files; no FBX/OBJ model was supplied for acceptance testing.

Add `--dry-run true` to prepare and inspect the conversion in `data/` without replacing any official content.

Keep FBX/OBJ textures and MTL files beside the original model so the importer can resolve them. New parts use the supplied ID (for example `my-prop`) and category `propellers`; selection saves that part ID. Replacing an existing part should use its existing folder name, e.g. `propellers-triblade`, to retain its current saved ID.

## Materials

Prefer authored GLB PBR materials with embedded textures and stable mesh/material names. Multi-material meshes are retained. [Blender's glTF material documentation](https://docs.blender.org/manual/en/3.3/addons/import_export/scene_gltf2.html) describes the supported material export path; procedural shaders need texture baking when the target format cannot represent them.

Optional overrides in `map.json`, `drone.json` or `part.json`:

```json
"materials": [{
  "mesh": "BodyShell", "material": "Paint",
  "baseColor": "#ffffff", "baseTexture": "paint.png",
  "normalTexture": "normal.png", "normalScale": [1, 1],
  "roughnessTexture": "roughness.png", "roughness": 0.7,
  "metalnessTexture": "metalness.png", "metalness": 0.1,
  "occlusionTexture": "ao.png",
  "emissiveTexture": "light.png", "emissiveColor": "#ffffff", "emissiveIntensity": 1,
  "alphaMode": "MASK", "alphaCutoff": 0.5, "doubleSided": true
}]
```

Omit `material` to affect all slots on the mesh; `mesh: "*"` applies a default. Base/emission textures use sRGB; normal, roughness, metalness and AO are linear. Roughness reads green, metalness blue, AO red; grayscale maps work in all channels. Use MASK for cutout leaves/fences, BLEND for actual translucency, OPAQUE for solid surfaces. Imported material settings remain intact unless overridden.

For player colors add `colorBindings: {"body": ["BodyShell"], "led": ["LED"]}` to the aircraft, and `motorBindings` for animated rotor nodes. This changes materials and rotor transforms without rebuilding model geometry.

## Collision and courses

Author low-detail `COLLIDER_*` proxies inside the GLB, or matching `collision.json` in final world coordinates. Named proxies are invisible during flight. High-poly visible geometry is not a good collision mesh. Above 100,000 collision triangles the existing importer falls back to mesh bounds and reports a warning; add proxies to avoid square approximations. Replacing a map clears the old inline primitive collisions, while an explicitly supplied `collision.json` remains authoritative.

Aircraft use compound spheres in `drone.json`; adjust them to the new frame/motor shape. Mass/inertia/rotor physics are separate from the visual mesh. Use metres, Y up and +Z nose/forward in the game. Check transform scale and spawn height before flying.

Create each course in `content/races/<course-id>/race.json` with `map`, `spawn`, `laps` and ordered `gates`. Alternatively export SPAWN and GATE markers; `track` extras assign markers to different courses. Add `thumbnail.jpg` to each custom map so cards never need its large GLB.

## Missions and lessons

The Cadet mission now references its own `hangar-cadet` course. Its `hints` contain `afterGate`, optional `lap`, and `text`; the most recent eligible hint is shown in flight. Tutorials contain ordered steps: altitude, speed, land, gate, manual, or reach. Gate targets are zero-based and require `duration: 0`; a crossing is instantaneous. Reach steps use `position`, `radius`, `target: 0` and a hold `duration`. Their HUD marker points at the target.

Add new definitions beside existing ones, then run `npm run content:sync`. A permanent deployment needs a new build/publication; the temporary link uses this PC's running server. For the first real replacement, provide one map and one drone with their textures/proxies rather than changing every asset simultaneously.

## Verification recorded

- Chrome: all seven stock map screenshots appeared before entering any map; no horizontal panel overflow at 1280×720; both guidance markers and the Cadet hint were visible in flight with no console errors.
- Short checks: target projection/lap wrapping, mass-dependent response, airflow forces, PID and network agreement, material slot isolation, collision/content compilation, tutorial hold timing, and a developer GLB import dry run. The two-client local smoke passed.
- Client build passed. Extended radio flight and real large FBX/OBJ/GLB imports remain developer acceptance work. No replacement geometry or textures were supplied in this request.
