# Flight model research and calibration

## What is simulated

Four independent shaft speeds, RPM-squared thrust, motor acceleration/braking, reaction torque, rigid-body inertia, angular coupling, gravity, body drag, wind, PID and contacts run at 240 Hz. The network submits 60 Hz commands against this shared model. Camera/server correction is separate from the flight forces.

The September update adds airflow-dependent drag at each rotor, including the local velocity caused by body rotation. It also separates the craft's inertia from the controller's reference inertia: adding battery mass now changes angular response rather than silently increasing control torque to cancel it. Hover throttle and rate response remain covered by short checks.

## References and limits

[Faessler, Franchi and Scaramuzza, 2018](https://arxiv.org/abs/1712.02402) describes a quadrotor model including linear rotor drag and the need to identify its coefficients. Our per-rotor airflow extension follows that physical principle; its current coefficients are engineering estimates, not measurements from these fictional aircraft.

[Betaflight PID tuning](https://betaflight.com/docs/wiki/app/pid-tuning-tab) distinguishes rate response, P/I tracking, D damping, feedforward, idle behavior and battery compensation. The game's rates and PID settings affect the actual motor mixer. It is not running Betaflight firmware; its PID numbers are simulator gains, not a guaranteed transferable real-aircraft tune.

We cannot claim equivalence to Liftoff or VelociDrone without measurement and pilot comparison. Their internal model is not available here. Do not add random wobble or extra stick/camera smoothing to imitate realism.

## Editable aircraft data

`drone.json` accepts optional `inertia` (body X/Y/Z kg m²), `rotorDrag` (whole-craft X/Y/Z N s/m at full normalized rotor speed), `maxRpm`, and `yawTorqueRatio` (metres: rotor reaction torque divided by thrust). Existing definitions retain estimated defaults. Part mass, thrust, response and drag modifiers continue to apply.

## Next calibration work

Use one real 5-inch build first. Supply measured all-up mass, motor/prop positions, prop radius, battery placement, thrust-versus-RPM test data, loaded RPM, spin-up/braking traces and a representative Blackbox flight. Fit inertia, torque and motor response, then compare hover, acceleration, braking, full-stick rates and turns against recorded flights. Repeat for 3- and 7-inch aircraft.

Forward-flight inflow/thrust variation, ground effect, rotor gyroscopic moments and propwash need measured parameters and separate validation. They are not claimed as implemented. High-poly visual geometry does not automatically produce mass, inertia or aerodynamic parameters.
