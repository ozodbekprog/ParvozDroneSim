# Author browser content in Unity

This is an authoring bridge. The game continues to run in Three.js; Unity does not run the browser flight simulation.

1. Create a Unity project and install [Khronos UnityGLTF](https://github.com/KhronosGroup/UnityGLTF) using its installation instructions. Enable its importer if you want to import the exported game GLBs. Use supported PBR materials; arbitrary Unity shaders and scripts are not exported to glTF.
2. Copy `FlightMapAuthoring.cs`, `FlightGateAuthoring.cs`, `FlightSpawnAuthoring.cs` into your project's `Assets/FlightContent/`. Copy `Editor/FlightContentExport.cs` into `Assets/FlightContent/Editor/`.
3. Import the existing GLB from `export/editable/maps/<id>/model.glb`, or create a map. Use metres. Make an empty root with no parent, position zero, rotation zero and scale one. Add **FlightMapAuthoring** and set its ID, display name and `contentFolder` to `C:/DroneLiftoffUz/content`.
4. Add **BoxCollider** or **MeshCollider** components to the ground and solid obstacles. Meshes must have **Read/Write Enabled**. Simplify collision independently from visual meshes. Trigger colliders are ignored. Sphere, capsule, terrain and other collider types must be converted to boxes or readable mesh proxies first.
5. Add a **FlightSpawnAuthoring** transform. Add **FlightGateAuthoring** transforms, choose the course ID and unique order values, and set gate dimensions in metres. The cyan gizmo is the opening; its local +Z direction is the direction of travel. Gates can be empty objects. Existing GLB marker objects need these components added before using this exporter.
6. Select the root and choose **Parvoz Drone Simulator → Export selected map to content folder**. It writes `maps/<id>/model.glb`, `map.json`, `collision.json`, and `races/<course-id>/race.json`. UnityGLTF reflects X when exporting; the bridge applies the same conversion to collision, spawn and gate data.
7. Keep `npm start` running and return to the game's main menu. Valid local changes appear after compilation and the next catalog poll. Check server output if an entry fails validation. Publish the rebuilt game to update online players.

For drones and parts, use UnityGLTF's **Assets → UnityGLTF → Export selected as GLB**, replace the corresponding package's `model.glb`, and retain/edit its `drone.json` or `part.json`. Keep rotor nodes named `prop_0` through `prop_3`, or specify `motorBindings` in drone data. Physical properties remain explicit JSON values: a mesh alone cannot specify thrust, mass or a motor response curve.

The bridge's API follows the current UnityGLTF exporter. It has not been compiled or exercised in a Unity Editor in this workspace; check its import and coordinate alignment with one small map before exporting a large environment. Keep exported proxies and gates visible while comparing positions, then hide collision meshes from the visible model if desired.
