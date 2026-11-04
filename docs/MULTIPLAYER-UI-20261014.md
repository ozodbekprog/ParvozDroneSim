# Multiplayer presentation — local candidate, 14 October 2026

Other pilots now have translucent nickname markers above their rendered drone
positions. The overlay is drawn above the 3D scene, ignores pointer input,
clips offscreen/behind-camera markers, fades with distance and excludes the
local or spectated aircraft. Names are assigned through `textContent`, not HTML.
Departed players' markers are removed. Markers are hidden outside live
multiplayer flight.

Chat was already available in the flight HUD; the baseline screenshots show
that its small action and always-visible empty transcript made it hard to
discover. The local candidate provides a larger Chat / Enter action, hides an
empty or inactive transcript, shows incoming messages temporarily, opens an
input on Enter, sends on Enter and closes typing on Escape. It retains chat in
the lobby and flight menu as additional access points. Multiplayer continues
while typing, and keyboard flight input is neutralized by the existing input
manager. This is not an autopilot or a multiplayer pause.

The Workbench also shows native hardware specifications and an expanded Flight
performance dialog; basic drone-selection statistics remain compact. Dquad is
labeled Racing. Career no longer promises the retired Viper R.

Verification: marker projection/clipping tests pass; the integrated suite
previously passed 234 checks. A two-client local transport smoke with Gecko and
Dquad passed readiness, content mismatch rejection, controller acknowledgment,
authoritative movement and the fact that multiplayer keeps running during pause.
The 15 October live check found that the initial overlay rules had been placed
in inactive `style.css`. The active entry now imports `multiplayer-ui.css`;
the rules use the existing Sunset palette. Production build and ten affected
tests passed. Two independent browser guests, Gecko and Dquad, then verified:
translucent nicknames over the other aircraft, hidden empty/inactive transcript,
Enter to open/send, Escape to close without pausing, received messages in both
directions, continued multiplayer flight in the flight menu, and removal of a
departed player's marker. The active browser canvas was 1280×720 on Low for
both new aircraft; this computer does not verify UHD 620 performance.

Actual FHD evidence is in `docs/design/ui-audit-20261014/after/`, including
`multiplayer-nameplates.jpg`, `multiplayer-chat-open.jpg`,
`multiplayer-pause.jpg` and `multiplayer-results.jpg`.

This code has not been deployed to Oracle. The screenshot audit distinguishes
the production baseline from the local candidate and lists required retakes.
