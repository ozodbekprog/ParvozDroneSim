# Project alignment with the independent FPV design

[GAME-DESIGN.md](GAME-DESIGN.md) is the product baseline. It was written without treating existing code as a requirement. This document maps that design to the current browser game and records limits that still need real flight and hardware testing.

| Design area | Current implementation | Further validation |
| --- | --- | --- |
| Local solo | `src/solo-session.js` owns fixed-step physics, countdown, pause, reset, scoring and tutorial state. Solo flight opens no WebSocket. | Fly all maps with a radio; measure frame pacing on the target PC. |
| Multiplayer | `server/index.js` owns rooms and snapshots. The socket opens on a multiplayer action and closes when returning to solo or leaving. | Two computers over the published HTTPS link, including reconnect and packet loss. |
| Social and competition | Public/unlisted rooms with 2–8 pilot capacity, room-local chat, multiplayer pause roster, finished-player spectator flow, precision mode and three-round championships with SQLite account leaderboard. | Complete a cup on three real computers and check disconnected-pilot behavior. |
| Flight model | Per-motor speed, thrust, torque, mass, inertia, battery and PID tuning in `shared/physics.js`. Compound drone spheres and static box or triangle contacts in `shared/collision.js`. | Tune against measured hover throttle, full-stick rotation, propwash and real quad logs. Current aerodynamics are approximate. |
| Camera | The local drone is explicitly marked as the active camera target each frame; FPV uses its current pose. Near plane is 0.02 m. | Long FPV/chase runs through race starts and resets. |
| Content | Canonical packages in `content/` hold all original and custom maps, courses, drones, parts, missions and tutorials. The compiler generates `public/content/catalog.json` and hashed delivery assets. Large collision data is a selected-map sidecar. | Round-trip a full-size externally authored map; check loading/memory on target hardware. |
| Authoring | Drop GLB package folders into `content/`, export stock GLB assets at `/editor/export.html`, or use the optional loopback editor. Unity authoring scripts export scene geometry, collision and checkpoints to the same folders. | Compile and verify the Unity bridge in a real Unity project; author a complete map and lesson. |
| UI and graphics | Compact graphite/blue layout, camera framing by stage bounds, reduced near plane, adjusted light/shadow response and existing WebGPU/WebGL postprocessing. Two upcoming gates have projected HUD markers and distinct lighting; stage hints are content-defined. No 3D models were remodeled for this update. | Inspect 1280×720 and zoomed windows on the user's display and compare visual quality across graphics presets. |
| Replays and persistence | IndexedDB replay library with explicit save, playback and rename; browser preferences persist. Solo result records sync through a noncompetitive API after a completed flight. | Storage quota, multiple browsers and refresh during recording. |

The current renderer and physics do not claim measured equivalence to Liftoff or VelociDrone. Authoritative online racing still uses the server simulation. Local solo times should not be used as anti-cheat protected rankings.

## Release priorities after this change

The catalog now includes detailed Harborworks and four editable GLB blockouts, ten new courses, sixteen missions and two lessons. See [new content and replacement workflow](NEW-CONTENT.md). Route centerlines have geometric clearance checks; authored courses still need manual flying. A short isolated socket test verifies three cup rounds and post-finish control isolation.

1. RadioMaster Pocket and TX12 calibration and direction checks on actual hardware.
2. Multi-minute solo FPV/chase flights on each map, including collisions and checkpoint resets.
3. Two-computer room test through public HTTPS, then permanent hosting with a persistent data volume.
4. Performance profiling on target GPU and Android WebGPU/WebGL fallback.
