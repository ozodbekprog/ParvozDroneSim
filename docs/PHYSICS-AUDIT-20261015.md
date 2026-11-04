# Drone physics audit and inverted ground control — 15 October 2026

This records the initial protocol-12 repair. The subsequent physical-contact
repair supersedes its ground-support/damping implementation; see
[PHYSICAL-CONTACTS-20261015.md](PHYSICAL-CONTACTS-20261015.md).

## Finding and repair

The reported bug was reproduced through `simulateCommand`, the same 60 Hz
command path used by client prediction and server authority (240 Hz dynamics).
All five stock aircraft produced **identical trajectories for roll -1, 0 and +1**
while inverted on the fallback floor at 50% and 80% throttle. They were intact,
with a charged battery and Acro selected. This was a control bug, not a lack of
RAM, a radio calibration problem or an intentional crash lockout.

Three isolated probes compared takeoff assistance, support resistance and contact
damping. Disabling only the inverted takeoff assist restored signed stick response.
Disabling damping alone did not. The assist latched a support height and replaced
pitch/roll requests with leveling until the craft gained altitude. An inverted
craft cannot climb on normal positive thrust, so the pilot never regained control.
The same code also caused unsolicited leveling in Acro with centered sticks.

`shared/physics.js` now clears that assistance outside a 45-degree upright cone.
It retains the previous upright spool-up protection, including the user's earlier
50%-throttle plus direction takeoff repair. This protection is a game assistance,
not a claim to emulate Betaflight exactly.

A second defect multiplied angular velocity by 0.8 for **every** floor contact.
Twelve duplicate contact surfaces reduced a rate by 0.8^12, despite describing
the same floor. Authored-floor damping is now applied once per substep as
`exp(-35 * dt)`, using the actual substep duration. The fallback floor's existing
damping is not applied a second time. Geometry density no longer changes this
damping. This is still an approximate contact model, not a rigid-body impulse solver.

Protocol **12** prevents clients with old ground dynamics from joining the updated
server. No catalog parameters, component masses, legacy Kestrel tuning, assets,
save keys or replay format changed. Replays store poses and remain viewable.

## What realism requires

In ordinary fixed-pitch operation, rotor thrust acts along the drone's local up
axis; inverted thrust presses toward the ground. Different motor forces generate
body torque, but contact geometry and friction determine whether that torque can
actually tip a craft. Motion is not proof that it can recover from every position.
Betaflight distinguishes Acro rate control, Angle/Horizon leveling, Airmode
allocation and **Flip Over After Crash**, which reverses motors. Normal throttle
must not secretly become Turtle Mode. See [Betaflight Modes](https://betaflight.com/docs/wiki/guides/current/Modes).

The rigid-body reference used here is Faessler, Franchi and Scaramuzza,
[Differential Flatness of Quadrotor Dynamics Subject to Rotor Drag](https://rpg.ifi.uzh.ch/docs/RAL18_Faessler.pdf),
especially equations 1–4. It includes gravity, body-axis thrust, orientation,
inertia, rotational coupling and rotor drag. Its experimentally identified
coefficients illustrate why plausible equations alone cannot establish accuracy
for our five aircraft.

Liftoff's own [Physics 4.0 description](https://www.liftoff-game.com/news/physics-40-another-step-towards-physics-accuracy)
describes hardware-dependent behavior and simulation trade-offs. The developer's
[1.7.0 release](https://www.liftoff-game.com/news/milestone-170-released) lists Physics
6.0, motor power limits and wind. These public descriptions are context, not
access to its physics engine or evidence of numerical parity. Installed models
and hardware metadata do not import the Liftoff simulator's dynamics.

## Code audit

| Area | Current implementation | Assessment / remaining gap |
| --- | --- | --- |
| Rigid body | SI mass/inertia, gravity 9.81, quaternion orientation, Euler rotational coupling, 240 Hz substeps | Structurally appropriate. Diagonal inertia only; no measured complete inertia tensors. |
| Motors / props | Four independent shaft speeds, first-order spool-up/down, force proportional to speed squared, arm torque, yaw reaction torque, motor allocation limits | Useful physical model. Throttle exponent 1.85, motor time constants and base thrust-to-weight are tuned estimates. No measured thrust stand curves across inflow. |
| Controller | Acro rates, filtered PID, bounded integral, saturation handling; Angle/Horizon leveling | Simplified controller, not actual Betaflight firmware. Upright launch assistance remains. Ground motor stop below 3% and airborne-only Airmode are game-specific policies. |
| Native components | Mass changes counted per component; four motors/props; parallel-axis inertia changes; motor KV/resistance/power and prop diameter/pitch/blades affect loaded RPM; battery cell count, capacity and resistance affect voltage/energy/sag | Customization changes flight, not just appearance. Aerodynamic coefficients and efficiency are estimates; effects are regression-tested, not bench-calibrated. Cosmetics leave physics unchanged. |
| Air / wind | Body-frame linear rotor drag, quadratic fuselage drag, local airflow at rotor arms and supplied map wind | No resolved prop wash, vortex-ring state, ground effect, rotor gyroscopic dynamics or flexible props. Uniform map wind is not spatial turbulence. |
| Ground / walls | Compound spheres, swept motion, triangle/box contact correction, restitution, approximate support moment and friction/damping | Largest realism gap. No coupled contact impulses using point velocity and angular inertia. Upright footprint resistance is reused when tilted; inverted battery/canopy support and pivot behavior are approximate. This release fixes input suppression and duplicate damping only. |
| Damage | Impact-based scalar health, zero health/battery stops simulation | No bent/broken individual props, motor failures, temperature or structural deformation. Reset remains necessary after a terminal crash. |
| Reverse recovery | Not implemented | A genuine Turtle Mode needs explicit input/state, reversible motor allocation and reverse prop efficiency, plus network/replay handling. Ordinary stick control must not masquerade as it. |
| Network | Same simulation for authority and prediction, acknowledged-command replay | Deterministic command regression passes. This establishes consistency, not real-world accuracy. |

## Verification

Seven new regressions cover signed pitch/roll at 50/80% across all five drones
on fallback and mesh floors (80 cases), neutral inverted Acro, duplicate colliders,
sideways stale assistance, exact prediction replay, and inverted landing/control
on every actual imported map (30 map/drone/axis cases). They use real collision
and component specifications. Existing takeoff, thin-wall sweep, component,
battery, flight-controller, replay and network tests remain required.

The initial bug regressions failed before the fix. A sideways test was corrected
to allow motor spool-up before expecting body motion; its first command still
asserts immediate removal of the stale assist. No motor delay was removed to
satisfy the test. Release verification is recorded in ORACLE-DEPLOYMENT.md.

No matched real-drone blackbox recordings, thrust-stand measurements or controlled
Liftoff stick-input traces were available in this session. Consequently, no claim
of complete physical realism, exact Liftoff equivalence, UHD 620 performance or
4 GB total-memory compliance is made.

## Next accuracy work, ordered by impact

1. Replace approximate ground support with a contact manifold and impulses using
   `v_contact = v + omega × r`, inertia and bounded Coulomb friction. Validate
   upright/inverted/edge pivots and impact energy against controlled fixtures.
2. Add explicit reversible-motor recovery if desired; test zero collective,
   selected-side reverse torque, release-to-stop and multiplayer agreement.
3. Calibrate stock thrust/RPM/spool constants, voltage sag, inertia and drag from
   hardware measurements; then compare identical radio traces and custom builds.
4. Add inflow/prop-wash/ground-effect models only with measurable acceptance data.

These are remaining fidelity improvements, not features delivered by this repair.
