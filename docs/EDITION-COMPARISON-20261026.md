# Main simulator and education views — 26 October 2026

The user requested a direct comparison after questioning whether Oracle had
received the education version instead of the main simulator. A fresh public
browser inspection and source comparison confirm one published application with
three entry views. No new deployment or runtime change was needed for this check.

| View | Entry | Main differences |
| --- | --- | --- |
| Full simulator | `/` | Fly, Multiplayer, Hangar, Career, Flight School, Weekly Challenge, Replays and Settings. This is the default. |
| Parvoz Start | `/?edition=start` | The same 12 lessons arranged as a sequence, next exercise, per-pilot local completion history, learner CSV and instructor JSON exports. |
| Parvoz Class | `/?edition=class` | Start lesson selection plus learner assignment links, a practice plan, a private-room shortcut, a local roster of up to 20 learner codes, imported learner reports, date filtering and group CSV. |

All three share the same maps, aircraft, physics, controls, renderer, loading,
collision workers, memory-retirement fixes, server and content catalog. Start and
Class both expose **Full simulator**, which returns to `/`. Their education
workflow is primarily an additional interface around existing simulator lessons.
Class reports/rosters remain local to the browser and use imported JSON; this is
not a server-managed classroom service or independently verified grading system.

## Evidence

- Public browser: root opened the full menu with `#app[data-edition=standard]`.
  Start and Class opened through their visible buttons; Full simulator returned
  to the root menu. No lessons were completed or learner data imported in this
  inspection. The user's existing flight tab was left intact.
- The public root and both education views use `/assets/index-BMjsxyqU.js`.
  Both public hostnames returned HTTP 200 and healthy `/api/health` replies.
- SSH readback at `2026-10-26T05:20:49Z` confirmed current remains
  `/opt/liftoff/releases/20261025-browser-03`; no release activation occurred.
- `src/practice-editions.js:6` selects Start/Class only from the `edition` query
  parameter; an absent/unknown value selects standard.
- `src/main.js:642` selects the home layout. The three entry views use the same
  imported `TUTORIALS`, the `tutorial-…` action handler and `SoloSession` launch.
- `src/practice-layout.js` and `src/practice-classroom*.js` supply the additional
  education interfaces and local reports. No edition switch is present in the
  physics, network-flight or server entry code.
- GitHub `main` at inspection is `93f3556f51d52d0a191754dca08bc17469e63990`.
  The deployed runtime source is `2d003d296f51052b18b6172a38e01073938e5c29` on
  `codex/demand-pilots`. The branch name does not identify an education-only
  build; it contains the newer collision/loading fixes as well as these views.

Ignored screenshots are under `data/oracle-browser-20261025/`:
`public-main-20261026-before.png`, `public-start-20261026.png`,
`public-class-20261026.png`. This comparison does not measure FPS, loading times
or prove UHD 620 acceptance. Production data, assets, admission and backups were
not modified.
