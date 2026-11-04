# Flight quality audit — 7 October 2026

The user wants flight realism and product quality comparable to Liftoff, and reports unsatisfactory drone physics, third-person camera behavior and UI/UX. The user flies with an RC transmitter and says its calibration and on-screen channel response are correct. Treat the transmitter setup as working; investigate the simulation and presentation.

This is an audit of local source and a deterministic physics probe, not a confirmed reproduction of the user's flight or a comparison measurement against Liftoff. No flight coefficients, Kestrel IDs, published assets or Oracle deployment were changed. The local checkout may contain work from other chats; compare the deployed release before applying these findings to production.

## First priority: the flight model

The existing model already integrates four motors and rigid-body motion at 240 Hz, including motor response, thrust, inertia, PID, drag and contacts. The issue is fidelity and tuning, not simply the absence of physics.

Verified model limitations:

- Throttle-to-thrust demand uses a fixed exponent of 1.85. Motor response uses a fixed time constant, and maximum thrust is derived from thrust-to-weight and a simplified voltage factor. These are not a calibrated motor/propeller/ESC dataset.
- Battery voltage depends on remaining charge; consumption uses throttle and time. Instantaneous electrical load, internal resistance, transient voltage sag and battery/motor current limits are not modeled by those equations.
- Inertia and aerodynamic coefficients are estimated for fictional drones. Forward-flight inflow/thrust variation, ground effect, rotor gyroscopic moments and propwash remain unimplemented, as documented in PHYSICS-RESEARCH.md. The existing per-rotor drag is useful but does not implement all these effects.
- PID gains are normalized simulator coefficients rather than an implementation of Betaflight firmware. Passing a stability or rate-response test does not establish real-flight fidelity.

Measured existing baseline: Kestrel mass 0.68 kg, thrust-to-weight 5.6, motor time constant 35 ms, theoretical level hover approximately 39.4% throttle. These are observations, not validated real-aircraft targets.

The probe starts in free air at 100 m with no collisions, uses default Acro controller and constant theoretical hover throttle, applies roll for 250 ms, then releases it. At 25% roll, the commanded rate is about 60.6 degrees/s; the model reaches about 73 degrees/s at 100 ms. At 350 ms (100 ms after release), the rate is about -7 degrees/s. Full roll similarly shows a reversal after release. This warrants measuring controller overshoot and braking; it does not prove that this behavior caused the user's complaint or that a real craft must have zero overshoot.

Probe evidence: `data/flight-quality-baseline-20261007.json`. All original coefficients were preserved.

### Calibration work to perform next

1. Use one repeatable 5-inch reference setup, the same Acro mode, camera angle, FOV and rate curve. Separate simulator controller settings from physical motor/inertia/aerodynamic parameters.
2. Record hover, a throttle pulse, stick steps and release, acceleration, a banked turn, throttle-cut descent and descent recovery. Measure rates, response delay, overshoot, stopping time, speed, vertical motion and RPM. Repeat offline and online to distinguish dynamics from network/render correction.
3. Compare these traces with a real flight/Blackbox reference, or a controlled Liftoff comparison. Specify the Liftoff version and comparable setup. Do not infer physical correctness from the feel of an unmatched craft or a passing internal test.
4. Test one parameter/model change at a time in an opt-in experimental profile or physics version. Preserve the existing baseline and account data. If physics materially changes, version competitive results rather than silently comparing incompatible records.
5. Add complex aerodynamic effects only after the basic thrust, inertia and controller response are calibrated. Extra wobble, stronger gravity and arbitrary smoothing are not substitutes for calibration.

## Second priority: third-person camera

In `src/world.js`, chase position follows the drone's full forward vector, offset by -4.2 m and world-space height +1.65 m. Position alone is smoothed with a 0.1 s time constant; the look target follows full orientation immediately, with fixed world up. Thus a pitched loop carries the desired camera position above and then ahead of the aircraft while retaining a level up vector. Near vertical pitch, the target direction approaches that up vector. This is a code-level risk, not yet a visual reproduction of the reported problem.

Define intended behavior first: a stable horizon, predictable following during flips, separately controlled framing, reset/mode-switch continuity and obstacle avoidance. Test these in tight turns, near walls, steep climbs and loops. A chase-camera redesign must not alter the drone's trajectory. FPV remains the main view for judging flight realism.

## Third priority: UI/UX

Audit task flows with an RC pilot, not just DOM assertions: begin free flight, change drone, adjust flight-controller settings, reset a crash, repeat a course and join a friend's room. Measure unnecessary navigation and whether the user can identify the active aircraft, flight profile, mode, camera and online state.

Candidate improvements: a direct return to the last flight; quick access to flight tuning with a clear distinction between rates/PID and hardware; a focused HUD; consistent Back/Resume/Restart behavior; clear room creation, joining and loading feedback. Validate these against the live UI before declaring individual flows broken. Visual composition was not freshly reviewed in this audit.

## Additional quality requirements

Stable frame timing and input-to-image latency, trustworthy collisions, reference scale, motor audio consistent with load, and useful tutorials contribute to perceived realism. Maintain the project's actual UHD 620 Low acceptance target; a physics frequency of 240 Hz does not guarantee smooth presentation or low latency.

Recommended order: baseline measurements → one calibrated drone → camera → core user flows → target-hardware and multiplayer checks → versioned Oracle release. More maps, cosmetics, payments and engine migration do not address the reported flight-quality concern.

## Sources

- Local `shared/physics.js`, `shared/flight-controller.js`, `src/world.js`, `src/input.js`, `src/main.js`, and `docs/PHYSICS-RESEARCH.md`.
- [Liftoff simulation technology](https://www.liftoff-game.com/liftoff-simulations): describes measured thrust data, dynamic thrust, ground effects, aerodynamics and battery modeling. This is the developer's description, not access to its proprietary implementation.
- [Liftoff 1.7.0 / Physics 6.0 release](https://www.liftoff-game.com/news/milestone-170-released): changes to drag, propeller aerodynamics and hardware power limits; legacy competitive results are separated after the physics update.
