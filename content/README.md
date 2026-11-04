# Official game content

Drop a map GLB into `maps/my-map/model.glb`. Keep `npm start` running and return to the main menu to load valid changes automatically. All existing definitions live here too.

- `maps/<id>/map.json`: atmosphere, map model, materials and collision.
- `races/<id>/race.json`: map reference, spawn, ordered gates and laps.
- `drones/<id>/drone.json`: physical specification, model and compound collision.
- `parts/<id>/part.json`: category, model, placement and physics modifiers.
- `challenges/<id>/challenge.json`: mission/course and completion target.
- `tutorials/<id>/tutorial.json`: course and lesson steps.
- `shared-assets/`: shared textures and assets imported by the optional editor.

GLB exports: **http://127.0.0.1:2570/editor/export.html** → `export/editable/`. Edit outside the game and copy the matching folders here. A `.disabled` file hides a package; the optional editor creates it when removing a published definition.

See [external editing, collision and download delivery](../docs/ASSET-WORKFLOW.md), and the [Unity authoring bridge](../tools/unity/README.md).

The five new GLB locations and their generators are described in [new content](../docs/NEW-CONTENT.md). Harborworks is the detailed reference; Ridgeway, Sunscar, Nightgrid and Pinecrest are editable blockouts. Each has two courses; the blockouts add sixteen missions and two lessons. Keep these packages in the same folders when replacing models.
