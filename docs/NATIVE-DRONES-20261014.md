# Native drone customization — local candidate, 14 October 2026

The requested selectable fleet is Kestrel 5, Luma 5, Armattan Chameleon,
Armattan Gecko 3″ and Dquad Addiction. Swift, Atlas and Viper are disabled;
their authoring files and existing saved builds remain recoverable. Kestrel's
ID, original parts and flight parameters are preserved.

The user selected Gecko plus racing Dquad and explicitly authorized these
airframes and their component variants in the Oracle multiplayer test.
Provenance records retain `permissionConfirmed: false`; this is not a claim of
a redistribution license. The repository must remain private. No map exports
or Ironworks restoration were performed.

## Delivered authoring and hardware

- Editable Blender aircraft sources, native textures and three delivery LODs
  for Gecko and Dquad. Existing Luma and Chameleon deliveries are reused.
- An editable shared Blender component library with 17 interchangeable native
  models: four motors, five propellers, five batteries and three FPV cameras.
  Four stock frame records preserve the identity of their aircraft.
- Three shared component delivery URLs pool model decoding and textures;
  each aircraft uses its actual socket adapters. Propellers include both
  native CW/CCW meshes; their mounts follow the selected motor's propeller slot.
- Gecko stock mass 0.246 kg; Dquad stock mass 0.4414 kg. Part specifications
  and source-blueprint hashes are preserved with the canonical models.

## Physics

Native assemblies use imported absolute component masses. Motor and propeller
mass changes count four units; camera and battery changes count one. Hardware
changes affect inertia, loaded RPM, motor response, propeller drag, thrust and
battery energy. Battery charge and internal resistance affect voltage under
load. Client prediction and authoritative server simulation use the same code.
Paint and LED colors do not alter flight. Server validation rejects incompatible
hardware by returning the airframe's stock component.

The model uses motor KV, internal resistance, no-load current, maximum power,
propeller diameter/pitch/blades, and battery cells/capacity/resistance.
The standard dimensional relations are T = CT·ρ·n²·D⁴ and
P = CP·ρ·n³·D⁵, with n in revolutions per second. See
[NASA's propeller-model report](https://ntrs.nasa.gov/api/citations/20210014010/downloads/NASA-TM-20210014010.pdf?attachment=true).
Motor/battery state is also a standard input to flight simulators; see the
[ArduPilot simulation implementation](https://github.com/ArduPilot/ardupilot/blob/master/libraries/SITL/SIM_Frame.cpp).
No ArduPilot implementation code was copied.

The selected CT/CP factors, rotor inertia, mass-position approximations,
efficiency and response calibration are engineering estimates. Existing Luma
and Chameleon stock thrust/response calibration is retained. These estimates
are not manufacturer bench measurements or proof that the handling matches
Liftoff. Flight performance labels disclose estimated thrust/response/endurance.

## Verification and release state

The final complete suite passed 235 tests after verification additions.
Twenty-three focused fleet, physics and actual-GLB mounting checks subsequently
passed. They cover stock mass, all four native aircraft lifting, hardware
effects, voltage sag, deterministic simulation, appearance invariance,
incompatible hardware and native mounting geometry at Low. The staged release
independently builds and validates: protocol 10, revision `9a0ff4f715bbd733`,
3 maps, 17 routes, 5 aircraft, 36 part records and 71 delivery assets.

Follow-up, 15 October: stock Luma/Chameleon/Gecko/Dquad and native replacements
were inspected in the real Workbench at Low, including two/three-blade props,
motor variants, 2S/6S and alternative batteries, camera models and paint.
FHD evidence is in the UI audit's `after/` folder. Save/discard and the performance
dialog were checked. Both new aircraft moved with keyboard control on Low and
1280×720. Local two-browser nameplates/chat/departure and repeat-loading checks
passed. UHD 620 performance, manufacturer matching and artistic acceptance
remain unconfirmed.

**20261015-native-01 is published**, client/server protocol 10 together.
All 71 public deliveries, native two-client smoke, browser room/chat/results
and before/after restore-tested production backups passed. Existing player
rows and admission 20 were preserved. Reload old protocol-9 tabs before joining.
Details: [deployment record](ORACLE-DEPLOYMENT.md) and
[UI/UX review](design/ui-audit-20261014/REVIEW.md).
