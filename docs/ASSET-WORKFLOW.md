# Asset folders, external editing and delivery

For the developer import command, multi-material PBR overrides and replacement checklist, see [Asset replacement](ASSET-REPLACEMENT.md). For simulation parameters and measured-data requirements, see [Physics research](PHYSICS-RESEARCH.md).

Every official map now has an editable `content/maps/<id>/map.blend`, runtime `model.glb`, `collision.json` and an actual Blender-rendered thumbnail. Open the native source directly and publish with `npm run content:blender -- --map <id> --publish`. The [Blender workflow](BLENDER-WORKFLOW.md) explains route collections, collider proxies, FBX/OBJ imports and safe backups. Maps, courses, missions and lessons all use the folders below; the original locations have no separate loading path.

## Project responsibilities

| Location | Responsibility |
|---|---|
| `content/` | Editable official content, including all original entries and new assets. |
| `tools/content-packages.js`, `tools/glb-content.js` | Compile packages, inspect GLB markers/collision, generate hashed delivery assets. |
| `public/content/` | Generated catalog/assets and the original procedural model recipes. |
| `src/world.js`, `src/asset-loader.js` | Rendering, camera, effects and selected-asset loading/lifetime. |
| `shared/physics.js`, `shared/collision.js` | Shared drone simulation and contact handling. |
| `src/solo-session.js` | Browser-only solo activity and simulation; no WebSocket. |
| `server/index.js` | Accounts, content API, asset delivery and authoritative multiplayer rooms. |
| `editor/`, `tools/unity/` | Optional developer tools, export and Unity authoring bridge. |
| `dist/`, `data/`, `export/` | Built client, persistent server records, and editable export copies, respectively. |

## Drop a map into the project

Keep `npm start` running. Create this folder and copy in your GLB:

```text
content/
  maps/my-airfield/
    model.glb
    map.json              optional: name, atmosphere, transforms
    collision.json        optional: explicitly authored collision
    thumbnail.jpg         optional: actual map screenshot
  races/my-airfield-race/
    race.json
  drones/my-quad/
    model.glb
    drone.json
  parts/my-propeller/
    model.glb
    part.json
  challenges/my-mission/challenge.json
  tutorials/my-lesson/tutorial.json
```

A map folder containing only `model.glb` or `scene.glb` is enough to appear as a map. A standalone `content/maps/my-airfield.glb` is supported too. It gets default atmosphere, a spawn and a free flight course. Use a package folder when adding JSON and textures. IDs use lowercase letters, digits and hyphens; keep existing IDs to preserve saved builds. Each race JSON names its `map` ID. Existing maps and races use exactly these folders. `public/content/catalog.json` and hashed files under `public/content/assets/` are generated delivery output.

The development server watches these folders and compiles changes outside the simulation thread. The menu checks the catalog every five seconds. Active flights retain their current content until they exit. If an import fails, check server output; invalid content is not adopted by the running server. `npm run content:sync` compiles manually, and `npm run content:check` validates the generated files. `npm start` always syncs and builds first.

Use GLB with embedded resources. Convert FBX or OBJ with Blender or UnityGLTF first; dropping FBX/OBJ into runtime folders is not supported. Geometry is measured in metres, Y up, +Z forward. Draco/Meshopt geometry and Basis/KTX2 textures have runtime decoder support. Unity-specific shaders, scripts and scene systems are not exported by a GLB.

## Spawn, gates and collision in a modelling program

- A node named **SPAWN** sets the first course start. Its local +Z points forward.
- Nodes named **GATE_001**, **GATE_002**, etc. set ordered gate centres and yaw. Without custom properties the opening is `6 × scale.x` metres wide and `5 × scale.y` high. For exact dimensions, use glTF extras `flightGate: true`, `width`, `height`, `order`, and optional `track` course ID. Blender can export custom properties as glTF extras.
- Mesh nodes named **COLLIDER_…**, or with extras `collider: true`, become static collision and are hidden during play. When proxies exist, only those meshes are used. Otherwise uncompressed visible triangles are used automatically, up to 100,000 triangles. If geometry is compressed, sparse or too large to analyse, the importer reports a warning and uses per-mesh bounding boxes. Supply low-detail uncompressed proxies or `collision.json` for accurate collision in that case.
- `collision.json` is an array of boxes (`position`, `size`, optional Euler `rotation` in radians) or mesh entries (`type: "mesh"`, `vertices`: flat groups of nine numbers per triangle). Its coordinates must match the final map world coordinates. Mesh collision is compiled into a separate download and a BVH is prepared before flight. Flying drones use compound spheres defined in `drone.json`; model geometry alone does not set an aircraft's collision shape or mass.
- Supplying your own map model replaces the procedural scenery and ground. Use `groundPlane: true` only when you deliberately want the extra generated ground plane. Set your spawn above a solid surface.

Example `race.json`:

```json
{
  "id": "my-airfield-race", "name": "Airfield sprint", "map": "my-airfield", "laps": 2,
  "spawn": {"position": [0, 1.4, -12], "yaw": 0},
  "gates": [{"position": [0, 3, 10], "yaw": 0, "width": 8, "height": 6}]
}
```

## Export and edit existing assets

Open **http://127.0.0.1:2570/editor/export.html**. Choose an asset or **Export all assets**. It writes actual GLB geometry and JSON to `export/editable/`; map exports include collision proxies, gate/spawn markers and a screenshot. Exporting leaves official content unchanged. Copy edited package folders into `content/` when you want to publish them locally. Keep the separate exported `races/` folders with maps. GLB gate markers take precedence over the matching race's gate positions; remove markers if you want JSON to define those positions.

`npm run content:export` also writes the neutral catalog and a copy of editable definitions to `export/sources/`. It does not generate GPU-backed GLB models; use the export page for those.

Edit materials/textures inside the GLB, or add named-mesh overrides in the JSON. Texture paths in source JSON are relative to the package (for example `paint.png`). The compiler copies them to hashed delivery URLs. Drone rotor nodes can be named **prop_0** through **prop_3**, or listed in `motorBindings`. The index order is (+X,+Z), (-X,+Z), (-X,-Z), (+X,-Z). Per-motor RPM drives animation and sound. For a part GLB, author one piece around its origin; `part.json` sets category, scale, attachment transform and physics modifiers. Copy an existing same-category definition as your starting point.

For Unity scene editing, use the [Unity authoring bridge](../tools/unity/README.md). It exports GLB, colliders and ordered courses into these same folders. Its Unity Editor compilation remains to be verified on your machine.

## What players download

The initial page loads JavaScript, fonts, a small catalog, menu imagery and the selected hangar drone. It does **not** fetch every custom map and drone. The chosen map, selected drone/parts and collision data load before its flight begins. Multiplayer waits for both pilots' required assets before countdown. Custom map cards use `thumbnail.jpg/png`; they do not download a 50 MB GLB just for a preview. Models are shared while in use, then released when no scene needs them. Unchanged hashed assets can be served from the browser HTTP cache.

Approximate transfer time, before parsing/decompression/GPU texture upload:

| Asset | 10 Mbps | 50 Mbps | 100 Mbps |
|---|---:|---:|---:|
| 50 MB map | 40 s | 8 s | 4 s |
| 10 MB drone | 8 s | 1.6 s | 0.8 s |

These are ideal estimates, not measured loading guarantees. HTTP responses stream and show download progress, but a single GLB must finish loading and decoding before it is playable. Progressive detail streaming/LOD is **not implemented**. Use small screenshots, simplified collision, compressed geometry and compressed textures to reduce download and GPU memory costs. Large detailed maps can still be expensive to render even when their transfer is fast.

## Deliver local additions online

Local folders change only your development server. To update a permanent public server, deploy a new build containing the generated catalog and hashed assets. The Docker build performs this compilation and includes `public/` in its final image. Keep the persistent `/data` volume for accounts; content belongs in the deployment artifact. New sessions request the new catalog, while unchanged hashed asset URLs stay cached. The current temporary tunnel exposes this PC, so its menu can see valid local additions while the game server remains running.

For larger releases, publish the generated assets to an object store/CDN behind the same `/content/assets/` URL path. Keep JSON/API and WebSocket traffic on the game server. An external CDN is a deployment option; no CDN account is configured here. The loopback editor is never shipped as a player menu.
