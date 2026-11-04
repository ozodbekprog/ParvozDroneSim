# Physical contact repair — 15 October 2026

## Finding

The initial physics-01 repair restored stick input, but did not make ground
response physically consistent. An off-centre downward impact changed linear
velocity without creating any angular velocity. A rotating arm entering the floor
was ignored when the centre of mass had no inward velocity. Hidden upright
launch leveling, a heuristic support-torque subtraction and exponential contact
brakes were also still present. Motor stop zeroed external angular momentum;
terminal damage froze the rigid body in midair.

Those observations distinguish a controller bug from contact dynamics. Making
every inverted drone turn on a stick command is not a valid realism criterion.
Ordinary positive thrust points along body up: upside down it pushes toward the
surface. Unequal motor forces create torque, but a broad support can balance it.
A narrow battery/canopy pivot can permit tipping. Neither result implies reverse
thrust or guaranteed self-righting.

## Implementation

- Static-world sequential impulses use point velocity `v + omega × r`, inverse
  mass and diagonal body inertia. Each impulse changes both linear and angular
  velocity. Unilateral accumulated normal impulses cannot pull a separating body
  toward a surface; Coulomb friction is bounded by the normal impulse.
- Existing supports are solved after applied forces and before pose integration.
  Swept collisions and penetration correction retain compound spheres against
  authored boxes/triangles. The fallback plane uses the same rotated geometry.
  Duplicate contacts are merged. Rotation-only sweeps are no longer skipped.
- Ground orientation overrides, support-torque cancellation and contact-count
  velocity damping are removed. Acro requests remain rate requests during launch.
  Full pitch/roll on the floor may tip the craft instead of guaranteeing takeoff.
- Native rotor lever arms now use their actual configured motor positions.
  Local rotor airflow includes the full angular-velocity cross-product.
- Motor stop no longer freezes angular momentum. A crashed craft keeps falling
  and colliding with its motors stopped. The existing game reset policy remains.
- Authority and prediction share the implementation; network protocol is 13.
  Pose-based replay files and catalog/component tuning are unchanged.

The method follows [Erin Catto's sequential impulse presentation](https://box2d.org/files/ErinCatto_SequentialImpulses_GDC2006.pdf),
adapted to three-dimensional body inertia. Flight/control expectations follow
[Betaflight's documented modes](https://betaflight.com/docs/wiki/guides/current/Modes)
and the rigid-body/rotor-drag equations in
[Faessler et al.](https://rpg.ifi.uzh.ch/docs/RAL18_Faessler.pdf).
This is our implementation, not imported Liftoff physics or Betaflight firmware.

## Verification

Eleven focused tests cover off-centre impact, rotation-driven contact,
separation, retained external momentum, inverted downward thrust, falling damaged
craft, narrow versus broad support, analytic effective mass, friction limits,
150 deterministic passive-energy cases and rotational invariance with unequal
inertia axes. Regression cases cover both stick signs at 50/80% throttle for all
five drones on plane/mesh floors; the same stock aircraft on all three maps;
neutral Acro, duplicate geometry, thin-wall sweeps, neutral takeoff and exact
prediction replay. Old tests requiring hidden Acro leveling or forced tipping
were replaced with physically meaningful criteria, not relaxed tolerances.

The isolated release-source suite passed 267 tests with one optional Luma source
cache UV test skipped (fixture absent); the shared working-tree suite previously
passed 271 tests. All 32 affected regressions passed after solver optimization.
The isolated client build, content validation and two-client local multiplayer
smoke passed. An independent GPT-6.1 SOL xhigh reviewer additionally checked
20,000 randomized passive-contact energy cases and six 60-second rest fixtures
without a correctness finding. That review was interrupted by its usage limit
before the optional final Luma timing comparison. Desktop timing is not a
capacity or minimum-hardware acceptance test.

Published as 20261015-contacts-01, protocol 13; all 32 affected tests also
passed against the deployed source on Oracle. Publication and full cloud
restore/player-row checks are recorded in [ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md).
The new Chrome screenshot proves protocol-13 startup/rendering; it does not
prove physical calibration. The earlier image predates this solver.

## Limits

This fixes identified nonphysical behavior; it is not a claim of full measured
fidelity. Collision spheres approximate the frame/battery/canopy, without
individual prop strikes, flexible blades or deformation. Sweeps approximate
rotation by endpoint motion, and positional overlap correction is not a complete
continuous rigid-body solver. Default friction/restitution are estimates rather
than measured material pairs. There is no warm-started persistent manifold.

Thrust curves, spool constants, drag, centre of mass and inertia still require
hardware calibration. Ground motor stop below 3% and airborne Airmode remain
game policies; Turtle Mode is not implemented. No resolved prop wash, ground
effect, measured blackbox comparison or Liftoff numerical equivalence is claimed.
4 GB total RAM, UHD 620 frame rate and capacity beyond the retained 20-player
admission are unconfirmed.
