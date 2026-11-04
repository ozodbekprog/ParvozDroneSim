# Browser framework research and release status

## What comparable Three.js projects use

| Project | Verified stack | Relevance |
|---|---|---|
| [Bruno Simon driving portfolio](https://github.com/brunosimon/folio-2019/blob/master/package.json) | Three.js, Cannon, Howler, GSAP, Vite | A game-like driving experience built from focused libraries rather than an all-in-one HTML5 engine. |
| [Ecctrl demos/toolkit](https://github.com/pmndrs/ecctrl) | React Three Fiber, Rapier; optional Drei/Leva | Component lifecycle, controllers and physics tooling, including per-propeller drones. This is a toolkit and demo, not an FPV racing product. |
| [Rogue Engine examples](https://rogueengine.io/examples) | Three.js editor ecosystem; Rapier FPS and Croquet/Multisynq multiplayer examples | An established editor/runtime option for new projects. |
| [Needle Engine](https://engine.needle.tools/docs/getting-started/) | Three.js runtime with Unity and Blender authoring workflows | A possible alternative when authoring in Unity is the central requirement. |

HTML/CSS currently draws the menus; Three.js draws the game. In the built-in test browser, disabling full-resolution AO changed the measured scene from about 9 FPS to 47 FPS. That isolates a relative effect cost in that browser; it is **not** a valid measurement of the user's hardware-accelerated Chrome performance. Performance and final visual checks must use the user's Chrome via its connected extension. This update keeps the renderer and shared flight model, adds tested Three.js loaders, a renderer-owned frame loop, cached collision preparation and an external asset workflow. Moving the entire runtime into React Three Fiber, Rogue or Needle would be a separate migration with regression risks; no such migration is claimed.

The custom flight model still needs comparison against real drone measurements and expert playtests. A generic physics engine alone does not provide the correct motor coefficients, propeller aerodynamics or controller tuning.

## Public testing versus a permanent release

A temporary HTTPS tunnel can expose the local server for two-computer testing with no installation on the second computer. It depends on the PC, game process and tunnel staying online. The multiplayer smoke checks two accounts, create/join, assets-ready, countdown, sequenced input acknowledgements and continued simulation during a pause overlay. It does not prove real-world latency, packet-loss recovery or capacity.

The Docker deployment is ready for a host that supports Node 24, HTTPS, WebSocket upgrades and a persistent `/data` volume. A permanent provider account/server and domain are still required. Static-only hosting cannot run the authoritative multiplayer server. No permanent hosting account, billing or DNS setup is available in this workspace.

## Remaining release gates

1. Verify the new build with your RadioMaster devices, all three aircraft and real flight expectations; tune coefficients from measured data.
2. Check representative desktop GPUs, WebGPU and WebGL2 fallback, Android graphics compatibility, preset switching and larger imported maps. Ultra is still heavier than Auto; adaptive resolution is a frame-rate aid, not a guarantee.
3. Compile/test the Unity authoring bridge; round-trip one externally edited map, drone and part before larger imports.
4. Deploy persistent public hosting; verify two real remote machines, reconnection, adverse networks and multi-room capacity. Add operational monitoring, backups and account-abuse controls before a public release.
5. Finish content polish, onboarding and sustained replay/session testing. Progressive map/LOD streaming and cloud replay syncing are not included.

Focused tests and a short visual check are appropriate now. Extended flight, hardware, Android and multiplayer playtesting remains with the developer as requested.
