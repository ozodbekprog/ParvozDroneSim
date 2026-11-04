# Spacious Blender maps and official custom content

All **12 maps, 19 courses, 24 missions and four lessons** use canonical packages under `content/`. The original seven locations now load GLB scenes the same way as manually imported maps. Existing IDs, gate order, mission references and account progress stay valid. Layouts intentionally change travel distances; mission time limits have increased. Old recordings still contain old coordinates.

## Map layouts

| Package | Intended spaces and landmarks |
|---|---|
| canyon — Redline | Wider canyon circuit, cliffs, roads, outpost and bridges. |
| forest — Mossline | Forest clearing, varied trees, gravel road, creek, cabins and lookout. |
| hangar — Flight Academy | Spacious training hall, maintenance bays, gantry rails and skylight. |
| harborworks — Harborworks | 860×840 m port: workshop, containers, cranes, terminals, fabrication halls, offices, roads and tanks. |
| industrial — Ironworks | Service yard, flyable warehouses, tanks, elevated pipes and access roads. |
| neon — Nocturne | Night streets, open entrances, facade panels and roof landmarks. |
| nightgrid — Nightgrid | Street and rooftop district with windows, transit structures and roof beacons. |
| orbital — Orbit One | Station hall, observation decks, equipment modules, reactors and ceiling structure. |
| pinecrest — Pinecrest Reserve | Creek route, ranger cabins, varied vegetation and landmark tower. |
| ridgeway — Ridgeway Pass | Road bends, bridge, ridge relief, outpost and distant rocky landmarks. |
| ruins — Afterlight | Ruins, partially open structures, courtyards and weathered towers. |
| sunscar — Sunscar Flats | Desert, solar arrays, roads, canal and control structures. |

Outdoor base terrain is roughly **880×880 m**; original flight circuits expand twice horizontally and 1.35 times vertically. Indoor halls are approximately **350×370 m**. Geometry is modular, with moderate stylized detail. Terrain remains mainly flat around existing courses. Replace individual objects and materials with your final assets.

The follow-up FPV pass brings open passages, close structural piers, service barriers, overhead beams and roof features to the actual flight routes. Terrain has Blender-generated texture detail; previews use a perspective camera at pilot height. The intent is to read entrances, height and exits while flying. This follows the focus on race and freestyle opportunities described in [Liftoff's overview](https://www.liftoff-game.com/liftoff-fpv-drone-racing), while [its environment design article](https://www.liftoff-game.com/news/environment-design-philosophy) also illustrates how object placement changes usable flight paths. All modeling, material creation, rendering and GLB export are executed inside Blender; no external asset-library models are copied.

## Edit and publish

Every `content/maps/<id>/` package has `map.blend`, `map.json`, `model.glb`, `collision.json`, `thumbnail.png` and `authoring.json`. Original scenes were exported and imported into **Blender 5.1.0**, then extended with native objects. Harborworks was authored by Astra; other maps by Sol. Rebuild scripts live in `tools/blender/`; normal editing uses the saved `.blend`, not generator reruns.

Follow [the Blender workflow](BLENDER-WORKFLOW.md) for FBX/OBJ/GLB imports, materials, collision and checkpoint editing. Publish a saved scene:

```powershell
npm run content:blender -- --map harborworks --publish
```

This keeps the native source, backs up overwritten files and exports geometry, collision and course marker poses into canonical folders. Native files and backups are not downloaded by players. Remote servers require deploying the new build.

## Courses, gates and objectives

Every course is `content/races/<id>/race.json`. A map supports many courses with independent ordered gates and starts. Missions and lessons in `content/challenges/` and `content/tutorials/` refer to the same IDs. Their rules, hints and text are edited in JSON. No content creation menu is exposed to players.

| Gate class | Typical clear opening | Purpose |
|---|---|---|
| precision-5 | 1.8×1.6 m | Technical lines for small craft. |
| sport-7 | 3×2.4 m | Medium gates suitable for larger craft. |
| open | 6–9×4.2–6 m | Fast routes and beginner lessons. |

Classes indicate difficulty, not aircraft restrictions. Frames and supports share visual and physical dimensions. Explicit `support.baseY` plants gates on ground or roofs; suspended mounts can be authored too. Sizes describe the clear opening.

## Checks and remaining playtest

Focused checks cover content validation, gate contact/crossing, sparse collision queries, Blender export roundtrips and room dialogs/filters. A build and brief Chrome scene/menu check are included. Longer playtests remain with the developer: fly all courses, check doorways and roof transitions, try all gate classes with 5/7-inch craft, and inspect missions after changed travel distances. Some decorative trim is intentionally non-colliding; simplified tree/tank proxies can be refined in Blender.
