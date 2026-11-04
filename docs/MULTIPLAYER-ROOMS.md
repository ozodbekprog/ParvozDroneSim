# Multiplayer rooms and championships

Restart the game with `npm start`, then refresh all connected browsers. This update requires protocol **5**.

## Join or create

Open **Multiplayer**. The public list refreshes every five seconds and shows rooms on the game server hosting this URL. It is a room browser, not a directory of unrelated dedicated servers. Running/full rooms stay visible with joining disabled. Private rooms are omitted and can be joined by their six-character code.

To create: choose **Public** or **Private**, maximum **2–8 pilots**, and a mode; press **Select Map & Create**, select the course, and create the room. The host starts when every pilot has loaded the selected map, participant models and acknowledged flight profile. Private means unlisted/code-only; password protection is not included.

| Mode | Rules |
| --- | --- |
| Race | Ordered checkpoints, course laps, finish time. |
| Precision Run | Same course; every crash or manual reset adds five seconds. Its records are separate from ordinary race times. |
| Freestyle Session | Three minutes of gate passes, flips, dives and proximity scoring. |
| Championship | Three races on different maps; cumulative placement points. |

## Championship

The selected course is round one. Rounds two and three use the next two catalog locations and their first courses. At least two pilots are required to begin. Round points are **10, 6, 4, 3, 2, 1, 1, 1**; a DNF earns zero. Ties use completed rounds, then total finish time. The host chooses **Next Round** after results; all clients prepare the new map before starting.

Late joins after round one are blocked. If a pilot leaves later, remaining participants can continue. Scores of departed pilots are excluded from the final displayed ranking. Guests can participate; account wins, podiums and points are stored in SQLite and appear in the cup leaderboard after round three. An all-DNF championship awards no win. There are no season schedules, brackets, prizes or cross-server leaderboards in this first version.

## Chat, pause and finish

Room chat is available in the lobby, pause and results. During flight, **Enter** or **Chat** opens its input; **Escape** closes it. Text is bounded to 180 characters, six messages per ten seconds, and a thirty-message in-memory history. It is delivered only to pilots in the same room and is displayed as text. Leaving the room clears that room's history from the player view.

Multiplayer pause shows the roster and finish status while simulation continues. After finishing, your drone leaves the active race simulation and the view switches to the remaining pilots. **Next Pilot** cycles the chase camera; **Save Replay** and pause remain available. The server ignores further inputs, resets and resync requests from a finished pilot. When everyone finishes, or the ten-minute race limit expires, results appear for everyone.

## Focused verification

`test/multiplayer-server.test.js` starts an isolated local server and disposable catalog/database. It checks public/private listing, capacity, room-local chat, protocol rejection, post-finish input isolation, three-round transition/scoring and duplicate-award prevention in roughly sixteen seconds. `tools/smoke-lan.js` checks different builds/colors, content readiness, controller acknowledgement and authoritative movement against a running server.

Manual playtest: two or three computers, finish at different times, cycle spectator views, chat from pause, play a whole cup, and confirm account leaderboard persistence after restart. Extended flights and load tests are left to the developer.

The final Chrome layout was checked at a 1280×720 CSS viewport. All twelve map previews appeared before entering a map; Harborworks completed model/graphics preparation and opened solo flight without console errors. The room creation panel fits without scrolling at this size.

![Room setup in Chrome at 1280×720](chrome-multiplayer-rooms.png)
