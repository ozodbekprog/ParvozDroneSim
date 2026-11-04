# Developer guide

[Project overview](../README.md) · [Documentation](README.md)

Setup, controls, authoring and architecture for contributors with repository access.
For the public web beta, use the [game link](https://parvoz-drone-sim.duckdns.org/).

## Play — one launcher for both modes

Requires Node.js 24 or newer and a browser with WebGPU or WebGL2.

Double-click **Play.cmd**, or run:

```powershell
npm ci
npm start
```

Open **http://localhost:2567**. Singleplayer modes and **Multiplayer** are in the same menu. The launcher builds the latest client, starts the game server and starts the developer editor locally. `npm run solo` is now an alias for the same launcher. Stop an older game terminal with Ctrl+C before restarting after an update.

For two computers on a LAN, the second computer opens **http://HOST-IP:2567**. It needs no project files or npm installation. In Multiplayer, join a listed public room or enter a private room code. Creators choose visibility, capacity (2–8 pilots) and mode. See [rooms, championships and chat](MULTIPLAYER-ROOMS.md). Use a public **HTTPS** game link for online play and browser radio/WebHID permissions. HTTP LAN pages may restrict hardware APIs; the optional legacy local proxy remains available for that case.

Accounts, builds, guest sessions and records persist in `data/liftoff.sqlite`. Refresh returns to the main menu and leaves the current flight; it does not erase preferences or saved replays. Graphics, calibration, camera and flight profiles save in this browser. Use the same hostname each time because localhost, 127.0.0.1, and a public link are different browser storage origins.

The web beta is deployed at **[parvoz-drone-sim.duckdns.org](https://parvoz-drone-sim.duckdns.org/)** with persistent SQLite, Caddy HTTPS/WebSocket support and a 20-player multiplayer limit. The [previous address](https://drone-liftoff-uz.duckdns.org/) remains a working alias. Accounts and progress use the same server database; move browser settings and replays to the new origin through the existing local backup export/import. See the [actual Oracle deployment status](ORACLE-DEPLOYMENT.md), [hosting guide](FREE-HOSTING.md) and [acceptance checklist](WEB-BETA.md). The goal of 100 across rooms remains unverified until both hour-long capacity scenarios and real regional play pass on the selected VM.

Registered pilots can create or replace a secret recovery code in Profile after checking their password. Save the code when shown: the server stores only its hash. Password recovery consumes the code and revokes old sessions; issue a fresh code after logging in. Career and records follow the account across computers; calibration, graphics settings and manually saved replays remain local.

Multiplayer uses protocol 13; restart the server and refresh every client after an update so prediction and authority use the same version. Maps download on Start Flight or room entry, with total file sizes and processing stages. See [prediction, loading and content publishing](MULTIPLAYER-LOADING-UPDATE.md).

## Controls and radios

Keyboard: **W/S** pitch, **A/D** roll, **Q/E** yaw, hold **Left Shift/F** to increase/decrease throttle, **R** returns to the last completed race checkpoint, **Escape** opens pause, **C** changes FPV/chase view, and **M** cycles angle/horizon/acro flight modes. Acro is the default for new pilots. Controls also has per-drone FPV tilt and field-of-view settings.

USB gamepads and radios that expose a joystick are read through the browser Gamepad API. Named radios are preferred when several devices are connected. In **Controls**, choose the device or **Keyboard only**, remap and invert axes, calibrate endpoints for nine seconds, and tune dead zone. The live 2D radio shows stick movement plus raw and calibrated values. Use **Full travel** for an RC radio or **Centered** for a spring-centered gamepad. Compatible HID radios can use **Connect WebHID Radio**. RadioMaster Pocket and TX12 should be configured in USB joystick mode. Confirm all four directions and endpoints before flying.

Open **Hangar → Customize a copy / Open Workbench → Tuning** to adjust rates, PID, level assist, throttle curve, idle throttle and launch control. These affect solo and multiplayer flight. Save the customized aircraft to retain its tuning; registered accounts synchronize saved aircraft copies and settings. The current catalog contains Kestrel 5, Luma 5, Armattan Chameleon, Armattan Gecko and Dquad Addiction. Setup education is described in a separate workshop proposal.

Solo pause freezes the simulation and clock. A LAN pause is an overlay while the room continues. The **Replays** menu watches, renames, and deletes flights you manually save from pause or results. These watchable replays are stored in the current browser only; existing best-run ghosts remain on the server. The **Graphics** menu controls WebGPU/WebGL2 rendering quality and effects. On supported Android Chrome devices the renderer can start with WebGPU or fall back to WebGL2; touch flight controls are not included.

Multiplayer pause shows the pilot roster. After finishing, watch the remaining pilots with **Next Pilot**, save the replay or open pause. **Enter** opens room chat. The host advances a championship to its next course after results.

## Developer content workflow

The archived original **12 maps** have editable Blender 5.1 scenes, layouts, modular scenery, runtime GLBs, collision proxies and thumbnails. Their historical **19 courses, 24 missions and four tutorials** use the same `content/` folder workflow. They are inactive; use the [manual restoration instructions](MAP-ARCHIVE.md) when explicitly requested. See [original map layouts](NEW-CONTENT.md) and the [Blender editing instructions](BLENDER-WORKFLOW.md).

Minus Two, Hangar C03, Liftoff Arena, Pine Valley and The Green are included in the user's authorized Oracle test. The two new maps include eleven authored Liftoff courses, editable sources, practice routes and introductory lessons. Both exceed the preliminary Low rendering budget; UHD 620 / 60 FPS remain unconfirmed. Provenance and unconfirmed redistribution permission remain in each map's SOURCE.json. For repeated imports, follow [the AI content import instructions](AI-CONTENT-IMPORT.md). Aircraft setup education remains a [separate Hangar workshop proposal](TUNING-LEARNING-PROPOSAL-20261018.md), independent of piloting lessons.

The developer editor starts automatically with **npm start** at **http://127.0.0.1:2570/editor/**. You can also double-click **Editor.cmd**, or start only the editor with:

```powershell
npm run editor
```

The easiest workflow is now the **[content/](../content/)** folder. Drop `model.glb` into `content/maps/my-map/`; it appears automatically while the development server is running. Built-in maps, courses, drones, parts, missions and lessons have editable definitions in the same folders. Add JSON when you want precise physical properties, checkpoints or materials. The compiler generates the delivery catalog and hashed assets; the player menu has no import controls. See [asset folders and online delivery](ASSET-WORKFLOW.md).

Use `npm run content:import -- --type map --id my-map --file "C:/Models/scene.glb"` to import or replace a package with backups. FBX/OBJ conversion accepts `--blender "C:/Path/To/blender.exe"`. See [model/material replacement](ASSET-REPLACEMENT.md) and [flight model research](PHYSICS-RESEARCH.md). Race HUD markers show the next two gates; missions may have their own course and hints that unlock after checkpoints.

The optional editor remains at `http://127.0.0.1:2570/editor/`; GLB uploads support up to 250 MB. **Save Draft → Publish** writes to the canonical content folders. `npm run content:sync` compiles manually and `npm run content:check` validates the output. For permanent online delivery, rebuild/redeploy the game; dropping files locally does not change a remote deployment.

Open **http://127.0.0.1:2570/editor/export.html** to export actual GLB map/drone/part models to `export/editable/`, including map spawn/gate/collision markers. Edit them in Blender or Unity and copy the matching folders into `content/`. `npm run content:export` also copies editable definitions to `export/sources/`. The [Unity authoring bridge](../tools/unity/README.md) exports Unity map scenes, checkpoints and colliders into this folder workflow; its Editor compilation needs verification on your machine. A Unity version of the game runtime would still be a separate project.

Only selected flight assets are downloaded, with progress, hashed caching and compressed-model decoder support. A single GLB is fully loaded before play; progressive LOD streaming is not implemented. The [loading guide](ASSET-WORKFLOW.md) explains map sizes and deployment. [Framework research and release gates](FRAMEWORKS-AND-RELEASE.md) explains comparable browser projects and what remains for a permanent release.

## Architecture and scope

Solo flight runs its 60 Hz input commands and 240 Hz motor/rigid-body substeps inside the browser, with no multiplayer socket. Multiplayer sends sequenced commands to the server; the server broadcasts 20 Hz snapshots, while the browser predicts its own drone and interpolates remote drones. The model includes motor response, thrust, drag, wind, gravity, tuned controller behavior, angle/horizon/acro modes, gate crossing, compound drone collision, static box or triangle map collision, and crash reset. Ranked flights use a shared airframe performance baseline. Records, unlocks, upgrades, achievements, best-run ghosts, and host-local rating are saved in SQLite. Manually saved watchable replays remain in this browser's IndexedDB.

This is a playable foundation. RadioMaster Pocket/TX12 behavior and broader radio compatibility need device testing. The flight model is an approximation that still needs tuning against measured drone behavior; visual quality and frame rate depend on the player's GPU and graphics preset.

## Checks

```powershell
npm run content:check
npm test
npm run build
npm run smoke:lan
npm run check:public -- --url=https://your-name.duckdns.org
```

The smoke script expects the server at `http://localhost:2567` unless `BASE_URL` is set. It creates two guest pilots, joins a private room, starts the race, and checks for authoritative state snapshots. It can also target the local client proxy with `BASE_URL=http://localhost:2568`.

## Local research editions (not yet deployed)

`?edition=start` opens the guided practice sequence; `?edition=class` opens the
instructor preparation view with assignment links and a practice plan. Completed
lessons can be exported as a local CSV report. These are test variants, not
commercial or certified training releases. See
[demand evidence, prospects and acceptance status](DEMAND-PILOTS-20261023.md).
