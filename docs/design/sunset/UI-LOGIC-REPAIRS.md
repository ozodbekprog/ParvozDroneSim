# UI flow repairs — 2026-10-03

The Sunset visual direction is retained. Screens now use functional titles and consistent actions.

| Issue | Repair |
| --- | --- |
| Modified filter displayed an Original and its actions | Preview, details and actions always belong to a visible card; the empty filter has no hidden selection. |
| Previewing a drone looked like choosing it for flight | Drone Selection explains preview vs Use drone; Home and Locations show the drone in use. |
| Tuning edited the last previewed aircraft | Controls opens the active drone, with an explicit Create tuning copy action for Originals. |
| Saving a different copy changed the drone in use | Save changes edits the copy; Use drone is a separate action. Saving the active copy updates its server build. |
| Navigation silently discarded edits | Leaving Workbench offers Save changes, Discard changes or Keep editing. Dirty status updates for parts, appearance and tuning. Reload/close warns about unsaved edits. |
| Editing while saving could lose newer values | Workbench inputs and navigation are blocked during the save. Tuning uses native range/required validation. |
| Drone changes lost the location-selection workflow | Back to locations returns to the selected activity, map and course. |
| Free flight offered a required race course | Free flight omits the course selector; race/time show Course and freestyle shows Gate layout. Modes have descriptions and readable labels. |
| Escape skipped the flight menu after changing controls | Escape returns one level, works on sliders, closes Explore first, and pauses countdown as well as flight. |
| Replay naming left solo flight running | Saving from the HUD pauses solo flight. Native modal dialogs contain focus and prevent flight shortcuts. Multiplayer explicitly says flight continues. |
| Replay camera changed future flight settings | Replay camera mode is separate from flight settings; replay uses its recorded build's camera. Camera follows a remaining pilot if its original target finishes. |
| Ranked queue remained active after leaving | Visible search status and Cancel matchmaking; navigation, connection errors and socket close clear pending queue state. Guests see the account requirement. |
| Ranked model/build disagreed with its physics | Server publishes the same canonical Kestrel/default build used by physics and enforces default controller/slot 0. Saved custom account builds remain intact. |
| Freestyle leaderboard used finish time | Freestyle sorts by score; timed modes sort by finite finish time with DNF last. |
| Weekly challenge could never submit weekly results | Weekly starts a server solo flight and waits for controller/assets readiness; its authoritative finish path writes account leaderboard times. Guests can practice. |
| Failed async screens or replay operations left confusing states | Loading/error/retry screens and navigation guards; replay operations catch storage/missing-record errors. |
| Callsign requirements were incomplete | Form explains and validates letters/numbers/underscores and password length; Enter signs in. Server error matches the rules. |
| A temporary connection failure erased the saved sign-in | Only an expired/unauthorized session clears sign-in. Other failures show Reconnect and preserve the same pilot/session. |
| Switching Workbench tabs bypassed tuning range checks | Invalid or empty tuning values remain unsaved and return the pilot to Tuning, instead of being silently clamped. |

## Verification

- Full regression suite: **106/106 passed**, including isolated real HTTP/WebSocket tests for weekly readiness, ranked builds/controller and cancelled queues. See `ui-logic-tests.log`.
- Production Vite build succeeded. See `ui-logic-build.log`.
- Root agent personally checked browser flows: filter selection and empty state; active-drone tuning; keep/discard/save-on-exit; explicit Use drone; location/course return; free flight; Escape from focused controls; paused replay saving; replay camera independence; weekly server HUD/pause/restart; failed room join; account requirement; ranked status/cancel/navigation; callsign validation; tuning validation after tab changes; recovery after stopping/restarting the server with the same guest preserved; built application.
- Test drone copies and replay were removed. Ranked browser checks used a disposable separate server/database; normal account data was not modified.
- Full manual course completions and physical radio/WebHID were not exercised in this pass. Weekly leaderboard writes were checked in the authoritative server finish path; readiness/start were verified over actual transport.

Screenshots of the built UI are in `screenshots/ui-logic-home.png` and `screenshots/ui-logic-drone-selection.png`.
