# Product completion checkpoint — 27 October 2026

The game remains a test beta. This document distinguishes finished slices from
the remaining release gates; it does not declare the entire product complete.
Continue from [the previous UI checks](UI-VISUAL-20261027.md), without repeating
imports, scene exports or the already completed collision deployment upload.

## Finished in this slice

### Player-visible diagnostics

Entry paths: Flight menu → Performance diagnostics, or Settings → Graphics →
Performance diagnostics. The panel explains and starts the existing bounded
60-second capture, returns to flight, stops recording and downloads the latest
finished F4/F7 report. Outside a flight it explains how to begin and disables
Start. It never changes graphics or uploads telemetry. A small in-flight status
shows recording time. F7/F8/F6 remain available; F4 remains the separate Low
control, with mutual exclusion preserved.

The summary uses comparable gameplay frames for current-settings reports. Empty
or immediate-stop recordings show no fabricated FPS. GPU time remains unknown.
Leaving a flight ends an active current-settings recording so a later flight
cannot be mixed into its map/drone metadata. The latest-report selector is shared
by the panel and F6, including when a newer recording is still in progress.

### Setup reference

Entry paths: Flight school → Drone setup guide; Workbench → Drone setup guide.
The four topics explain parts/scales, rates/sticks, PID/level modes, and repeating
one controlled change. Copy follows the actual resolver/controller in
`shared/physics.js`, `shared/component-physics.js` and
`shared/flight-controller.js`. It distinguishes requested rotation from measured
rotation, explains fixed yaw D and limits of the response/energy estimates.

This is a reference, not a new scored flight exercise. The 12 existing lessons,
progress, rewards, physics and controller defaults are unchanged. It does not
silently create/save a copy or modify the Workbench draft. All content has EN,
RU and UZ text, keyboard tab navigation and bounded scrolling.

## Verification

- Production Vite build passes. Sixty focused tests cover diagnostics summary/
  selection, localization uniqueness/placeholders, existing capture invariants,
  menu navigation, lessons, Workbench and controller behavior.
- Real Chrome: Graphics entry outside flight has disabled Start/Download with
  instructions. In Minus Two solo flight, the pause entry starts recording and
  resumes flight; F8 marks it; reopening the panel and pressing Stop displays
  comparable statistics; Download produces a JSON containing 125 raw frames,
  32 comparable frames and one user marker. Auto quality, resolution 1 and
  adaptive enabled are retained. These controlled-browser timings are not FPS
  acceptance and do not diagnose the user's ordinary gameplay stutter.
- Real Chrome: both guide entry points work; arrow-key topic changes work.
  A dirty Roll RC rate 1.15 remains visible after closing the guide. It was
  reverted to the prior saved 1.1 after testing; saved pilot data was not changed
  by the guide. RU and UZ topics were inspected at measured CSS widths 1280 and
  640. Only topic navigation scrolls horizontally at the narrow size; paragraphs
  remain inside the dialog.
- Isolated account test: a disposable account whose cloud fleet selects original
  Luma 5 signs in successfully, and first Hangar shows Luma selected with no busy
  preview. This is a warm functional account-switch check, not an internet cold
  timing measurement. Test account/database stay under the ignored local QA
  setup; production accounts are untouched.

## Remaining product gates

| Priority | Gate | What is still required |
| --- | --- | --- |
| High | Gameplay stutters | A focused current-settings report and DevTools trace from the user's normal flight, then measured fixes. Existing controlled-browser captures cannot establish the cause. |
| High | Published UI/profiler | A separate verified Oracle release, with fresh backup/restore, draining, rollback, public checks and player-data preservation. GitHub push does not update Oracle. |
| High | Earlier collision release | Finish the existing browser/finalizer gates in `ORACLE-COLLISION-20261026.md`; do not assume the `current` pointer identifies the serving Compose directory. |
| High | Target hardware | Real UHD 620, fixed internal 1280×720 Low, adaptation off, median ≤16.7 ms and 1% low ≥50 FPS. No pass yet. |
| Review | Characteristics colors | User rejected the proposed universal better/worse mapping. Neutral actual-value markers remain until the intended mapping is clear. |
| Review | Requested Tip | Exact paragraph still unidentified; do not delete unrelated descriptions. |
| Review | Cold/warm startup | Controlled first launch/sign-in/Hangar timing on the player's computer and connection, including low memory/error/retry cases. |
| Later | Commercial release | Content rights and actual capacity remain separate requirements. Current Liftoff imports are authorized for the existing test only; 100-player admission is not verified. |

Oracle was not changed by this implementation. Preserve its data volume,
admission 20, existing release images, backups and $0 budget.
