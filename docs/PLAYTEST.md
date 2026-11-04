# September flight repair playtest

Start **Play.cmd** or run **npm start**, then open http://localhost:2567. Both singleplayer and multiplayer are available here. Keep the terminal open. After a code update, close the old game terminal before starting again. A protocol mismatch displays a restart message.

1. Fly Kestrel, Swift, and Atlas in Acro, FPV and chase. Try rapid reversals and zero-throttle descents. The default Kestrel hover point is about 39–40%. Grounded zero-throttle sticks must not spin the craft.
2. Connect the radio in USB joystick mode, calibrate, and check pitch up = nose down; roll right = bank right; yaw right = turn right. Unplug/replug it. Confirm the mapping survives and the selected device does not change silently.
3. In a race pass a gate, press R. It must place you just after the last gate, preserving lap, next gate, and timer. Escape/PAUSE freezes solo; Restart deliberately starts a new event. Multiplayer keeps running.
4. Save Replay from the HUD or pause, name it, and open Replays. Watch, seek, rename. Refresh and check that the replay remains. It is local to this browser and address.
5. Change Graphics, flight mode, camera view, FPV tilt/FOV. Refresh. You should return to the main menu with preferences intact. Use the same address (localhost and 127.0.0.1 have different browser storage).
6. Inspect the workbench, radio panels, scrollbars, and actual map thumbnails at Windows 150%. Try AO on a hangar wall; check for remaining artifacts on your GPU. Auto now chooses Medium on desktop to keep flight responsive.
7. Open the same public HTTPS game link on both PCs. Host: Multiplayer → Create Room → choose map → Create Room. Friend: Multiplayer → enter code → Join Room. Host: Start Race. Check actual movement of both pilots and compare with solo.

The physics integrates individual rotor speeds, thrust and reaction torque, mass/inertia, rigid-body coupling, battery voltage, drag, and ground friction at 240 Hz. It is a simulator model with tunable parameters, not a measured match to Liftoff or VelociDrone. Hardware flight feel and collision edge cases still need your feedback.

For permanent hosting, deploy Dockerfile to a host supporting persistent containers, WebSockets, and a persistent /data volume. Set PORT as required by the host and use its HTTPS URL. `docker compose up --build -d` starts it on a server with Docker. The local editor is excluded from the runtime image. A temporary Cloudflare test link only works while the tunnel and this computer are running; it is not permanent hosting.
