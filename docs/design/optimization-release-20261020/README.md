# Public release evidence - 20 October 2026

Actual in-app browser at https://parvoz-drone-sim.duckdns.org/ after activation of
`20261020-optimization-01`, revision `2132caf43c0e38df`. Captures use the existing
browser viewport; they are functional visual evidence, not UHD620 performance
measurements or full artistic acceptance.

- [Gecko native antenna restriction](gecko-native-antenna.png): only no separate
  antenna is offered. Its camera category offers only Redot Split Mini.
- [Luma native antenna](luma-native-antenna.png): Soupape Micro is its sole
  compatible selection in the existing Workbench.
- [Pine public free flight](pine-public-flight.png): live flight HUD and native
  tiled ground. Pause and exit to the main menu subsequently succeeded.

Guest entry, Hangar return and Settings/back also passed. Separate action-camera
controls are absent. Public two-client races on Pine and Green and all 132
delivery HEAD/Range/cache checks passed independently of these screenshots.

No error-level browser messages were captured. The map transition produced
`Scene cleanup: Cannot read properties of undefined (reading 'usedTimes')`
warnings; these are recorded as unresolved, not silently treated as a clean
renderer-resource check. Cold stalls, geometry budgets and target-hardware FPS
remain outstanding. See [deployment record](../../ORACLE-DEPLOYMENT.md).
