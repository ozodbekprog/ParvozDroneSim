# Flightline — browser FPV simulator design

Version 1.0 · Product baseline · 27 September 2026

## Vision

A browser flight simulator for learning and practicing FPV quadcopter control with a real radio. Its central promise is predictable stick response, a readable view, and fast iteration after mistakes. Racing and social play extend that foundation. The design does not require copying a commercial simulator's assets, interface, or proprietary flight model.

## Audience and use

The primary pilot owns a USB radio and wants practice between real flights. New pilots need clear calibration and a short route from first hover to Acro control. Experienced pilots need their rates, camera angle, and aircraft setup to remain consistent across sessions. A desktop browser with a hardware controller is the initial target. Mobile graphics compatibility does not imply a suitable touch flight interface.

## Product principles

1. Input is immediate and repeatable. Calibration is shared by the preview and flight.
2. Flight time belongs to the pilot. Offline solo physics must not wait for a network server.
3. Visual clarity takes priority over cinematic effects. Motion blur is optional and initially disabled.
4. Recovery is predictable. Reset returns to a safe checkpoint; Restart begins a new activity.
5. The content editor is a separate developer tool. Pilots select official content and customize eligible parts.
6. All official and later content uses one versioned catalog and one asset root.

## Player loop

Choose aircraft → calibrate/check controller → choose activity/location → fly → recover or finish → review result/replay → adjust setup → fly again. A saved pilot reaches a new flight within a few menu selections. Menus use short labels, visible selection states, and persistent back/continue actions.

## Modes

| Mode | Goal | Time and recovery |
| --- | --- | --- |
| Free flight | Explore and practice | Unlimited; start-position reset |
| Tutorial | Follow authored lessons | Pause freely; repeat a step or lesson |
| Time trial | Complete an ordered course quickly | Valid forward gate passage; checkpoint reset |
| Race | Complete the required laps | Same gate rules; solo or multiplayer |
| Freestyle | Link recoverable maneuvers | Authored duration and scoring rules |
| Mission | Meet an authored objective | Clear success conditions and restart |

Singleplayer owns its simulation, activity clock, pause, and checkpoint state locally. Multiplayer owns a separate connection and uses authoritative room state with local prediction and remote interpolation. Entering multiplayer explicitly establishes that connection. Exiting closes it. Network loss returns multiplayer to a recoverable menu and cannot affect solo flight.

## Flight model

The craft is a six-degree-of-freedom rigid body. Its specification defines mass, center of mass, inertia, motor locations, thrust limits, motor response, propeller characteristics, drag, battery behavior, and collision geometry. Each motor has an individual shaft-speed state. Rotor thrust varies with shaft speed squared; lever arms and rotor reaction torque generate angular acceleration. Body angular momentum couples the rotational axes.

Controller rates convert calibrated stick positions into requested angular rates. A tunable rate controller commands physically limited motor output. Acro does not self-level. Angle mode requests a limited attitude; Horizon adds level assistance near stick center. Calibration deadzone and controller expo are separate, applied once each. Ground contact and static friction resist rotation at idle. Air-mode authority must not turn a landed zero-throttle craft into a spinning object.

Motor and rigid-body integration uses fixed substeps independent of display refresh. The camera uses the current local pose; correcting a multiplayer prediction error must not become permanent stick smoothing. Flight feel is validated against hover equilibrium, angular step response, release response, motor saturation, momentum, and repeatable contact cases. Matching a named commercial simulator requires flight comparisons and measured tuning, not a claim based on these equations alone.

## Input and camera

Support USB Gamepad devices, compatible USB radio transmitters, and supported WebHID devices. Key bindings remain available for accessibility and debugging. A named selected controller never silently changes to a different device after disconnection. Profiles survive device index changes. Show raw channels, calibrated channels, stick direction, and disconnected status.

FPV tilt and FOV are per aircraft. Camera roll follows the craft. Chase view follows the selected player reliably. A small near plane avoids cockpit/obstacle clipping while retaining usable depth precision. Pause, reset, and camera switching never change the active camera target unexpectedly.

## Content and developer tools

The catalog contains locations, scene/model references, materials, collision descriptors, aircraft, compatible parts, courses, missions, and tutorials. Stable IDs connect records and saved builds to content. Courses own ordered gates and spawn points. Missions reference a location/course and define measurable goals. Tutorials contain ordered text and input/flight objectives with optional scene props.

The local developer editor loads the same catalog as the game. Existing content is editable using the same operations as new content: select, inspect, transform, override materials, place collision, place/order gates, author instructions, save draft, validate, publish. Publishing is atomic and preserves a previous catalog backup. The game has no publish/upload/editor controls.

GLB is the runtime interchange format. FBX and OBJ are authoring inputs that can be converted to GLB. Imported scene geometry does not silently become a single bounding box. Static collision can use an explicitly generated triangle mesh or simple authored proxies. Moving craft use a compound collision shape describing the body, arms, and motors; the developer can inspect and adjust it. Collision and visible geometry are related but stored separately for predictable simulation cost.

## Presentation

A restrained graphite interface with neutral typography, clear spacing, and one cool accent. Use 3D aircraft and actual map renders as selection previews. A workbench presents the craft without hiding it behind the controls panel. Built-in geometry can be replaced without redesigning menus or changing physics code.

Layouts respond to CSS viewport size, including browser zoom and operating-system scaling. Use internal styled scroll areas when content does not fit. Essential actions stay reachable. Disable selection on game chrome while allowing text fields. Graphics presets expose resolution, shadows, antialiasing, AO, bloom, atmosphere, and exposure. AO must use valid depth/normals and filtering; optional effects cannot break flight.

## Pause, persistence, and replays

Solo pause freezes physics and the activity clock. Multiplayer pause is a menu overlay labelled as live. Keep Continue, Restart, Controls, Graphics, Save Replay, and Exit reachable. Refresh returns to the menu with preferences and saved content intact; restoring a live online race requires an explicit reconnect design.

Preferences save automatically. Builds and progression are associated with a pilot. Browser-only data clearly states its scope. Replay recording uses a bounded in-memory buffer. The player explicitly saves named flights. A local library supports play, seek, speed, camera, rename, and delete. Report storage failures and never show a success message before a transaction commits.

## Release gates

- No missing local aircraft or camera target on activity start/reset.
- Radio preview and actual turn directions agree.
- Fixed-step results do not depend on display FPS.
- Solo remains functional without a multiplayer socket.
- Idle-ground, hover, full-stick response, checkpoint, and pause checks pass.
- Preferences and manually saved replays survive refresh.
- Existing and newly authored catalog entries use the same validation/load paths.
- Menus remain usable at 1280×720 CSS pixels and narrower zoomed viewports.
- A public HTTPS deployment accepts two independent browsers in the same room.

## Scope boundaries

Initial delivery does not promise measured aerodynamic equivalence to a specific real quad, touch-flight controls, public matchmaking at large scale, or automatic Unity scene conversion. A Unity version can reuse the catalog/schema and model assumptions while implementing its own runtime and editor integration.
