# Multiplayer prediction and flight loading

Local inputs advance the shared model immediately at 60 Hz (four motor/rigid-body substeps per command). The client retains 240 commands and complete post-command states. It compares an acknowledged snapshot to that exact past state. Matching acknowledgements preserve the current state object and camera; actual differences restore complete PID/motor state and replay the remaining commands. Visual correction applies only to that difference.

Normal input gaps do not invent server simulation steps. After two seconds without input the server explicitly enters a zero-stick, zero-throttle failsafe. A returning client receives a new reset epoch and complete state before submitting new commands. Duplicate commands are ignored; a missing sequence requires explicit synchronization. Reset, respawn and new flights start command numbering again.

Protocol **5** requires all clients to refresh after the server update. Version 5 adds public/private room settings, chat, cup state and finished-player spectators. Solo remains entirely local. Remote drones use a 32-snapshot buffer with a 100 ms presentation delay and a fresh buffer on reset.

## Loading

Selecting map/course cards does not download their full models. Start Flight or joining a room prepares only its unique required files. The catalog `assets` index contains `{url, bytes}` entries; browser loading displays the sum of file bytes, not the compressed HTTP transport size. The stages are downloading, processing models and preparing graphics. An already resident model contributes immediately to readiness. Browser HTTP caching remains enabled.

Three concurrent downloads feed the existing GLB/Draco/Meshopt/KTX2 loaders. Override textures and collision JSON use those same prepared bytes. Cancel aborts downloads, releases temporary bytes and invalidates the flight; errors expose Retry. A GLB still has to finish decoding before it is playable; this is not progressive detail streaming.

Every room pins its content revision and build roster. Both clients must prepare the map, all pilots' drone/part models and their own acknowledged flight-controller profile before countdown. A stale content revision or roster cannot pass the readiness gate. No build/profile changes apply halfway through a race.

## Imported drone paint

Add mesh-name bindings to the developer's `drone.json`:

```json
"colorBindings": { "body": ["BodyShell"], "led": ["FrontLED", "RearLED"] }
```

The body meshes use the selected paint; LED meshes use its LED color and emission. Other materials remain as authored. The geometry is unchanged. Custom builds are transmitted as IDs/colors; clients resolve their models and materials from the same official catalog.

## Publishing

Sources remain in `content/`. The local watcher validates additions; adoption waits until active races finish and lobbies must prepare the new revision. The temporary public tunnel exposes those local changes while the PC/server/tunnel stay online. For a permanent server, build and deploy the generated catalog and hashed assets to that server; adding folders to this PC alone does not update a remote deployment. Persistent account data stays separate in `/data`.

## Short acceptance checks

- Automated virtual 250 ms delivery plus jitter: matching command states need no corrections; genuine PID differences restore/replay correctly; timeout/sequence/reset behavior; interpolation across more than two samples; file deduplication, size index and GLB color bindings.
- Two-client smoke: different builds/colors, content mismatch rejected, assets/profile gate, countdown and acknowledged movement.
- Chrome: launch/cancel/retry loading, compact HUD, F11 both directions and zoom with effects on/off. Record any browser-control limitation separately from a successful build.
- User playtest: extended two-PC flight, resets and actual 50 MB maps / 10 MB drones. Verify local controls remain responsive while the other drone is buffered.
