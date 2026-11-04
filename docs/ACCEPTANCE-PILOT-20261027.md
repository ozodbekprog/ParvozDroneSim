# Acceptance pilot — 27 October 2026

Implemented a local acceptance runner for the diagnostics/setup-guide slice,
connected to the existing account quota and Chrome recovery tools. The pilot
passed on source snapshot
`af66f67221f5ccb70942588fab7f24f53498ce08945c9fc82cc3661f48914e2f`.
Game runtime and Oracle release are unchanged by this workflow change.

## Entry points and evidence

`npm run acceptance -- start --recovery-dir PATH --thread ID --serve` starts;
`resume --run ID --serve` resumes; `status --run ID` reads progress;
`reconnect --run ID` invokes native-host recovery, then requires a real Chrome
check. See [usage](../tools/acceptance/README.md) and
[browser scenario](../tools/acceptance/BROWSER-SCENARIO.md).

Final run: `data/acceptance/2026-10-27T16-06-41-506Z-e5e6d7/`.
Read its `REPORT.md`, `checkpoint.json`, `browser-proof.json` and `evidence/`.
Private logs, database and source snapshots stay in ignored data. The earlier
successful run `2026-10-27T15-59-56-883Z-435610` used the earlier runner version.

## Verification

- 37 focused tests, including six acceptance decision tests.
- Existing content validation: 5 maps, 30 races, 5 drones, 42 parts, 5 missions,
  12 tutorials, 44,114 asset references. Separate Vite production build passes.
- Existing two-player smoke on the isolated database passes: different aircraft,
  stale content rejection, readiness/controller order and authoritative movement.
- Real Chrome passes all four pilot checks: game menu, diagnostics outside
  flight, keyboard guide navigation and return to the unchanged lesson screen.
- Explicitly synthetic 1% quota stops before machine checks with a durable
  `waiting_for_quota` checkpoint. Resume without the fixture reads real quotas,
  invalidates the fixture account's browser state and proceeds in the same run.
  The desktop account itself was not switched.
- A controlled stop after machine checks followed by resume retained exactly
  the same saved machine results; none were rerun. Browser verification then
  completed on the reloaded isolated source snapshot.
- Existing account/Chrome recovery module: 16 tests pass.

Source, tests and content metadata are copied and hashed. Installed node_modules
and existing generated public asset directories are shared through junctions
for read-only use. This is code/build/database isolation, not a full container
or frozen copy of every asset byte. Avoid concurrent asset regeneration or
dependency installation during a run.

## Chrome finding

Initially Chrome was closed and absent from the supported browser inventory.
Starting the installed Chrome made its extension available. This initial failure
was not an account-switch repro.

Soft native-host recovery on the working connection kept the app/browser open
but retired browser ID 3. The same extension instance appeared as ID 4. Rebinding
the existing tab through that current connection restored reading and navigation.
Recovering the transport must therefore be followed by rediscovery of the same
extension/profile and a real operation in the affected chat. Native-host restart
alone does not prove browser access. The original account-switch root cause
remains unproven.

## Account continuity and scope

Both quota windows are checked before phases and every 30 seconds while waiting
for browser evidence. Missing/stale data or the configured threshold saves state
and stops this runner. Interrupted phases retry; completed phases remain cached
for the same snapshot. A changed account invalidates browser proof, changed
sources require a new snapshot. Proof from a different run/source/account/URL,
an old timestamp or an incomplete checklist is rejected.

Current Codex chats remain the interface. Full automatic Stop → account login →
Continue is not implemented: the supported Computer Use instructions prohibit
automating the ChatGPT desktop UI. A normal manual account switch followed by
continuing the same chat uses the saved `CONTINUE.md`. No active login was
changed; no third-party switcher or new scheduled background agent was installed.

This is bounded developer acceptance, not whole-product acceptance, UHD 620 FPS
acceptance, a diagnosis of gameplay stutter, deployment or a full account-switch
solution. Oracle data, 20-player admission and the $0 budget follow their
separate release rules.
