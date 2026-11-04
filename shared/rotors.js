// Matches the thrust mixer in physics.js; +Z is the nose. Direction is shaft spin.
export const ROTOR_LAYOUT = [
  { x: 1, z: 1, direction: -1 }, { x: -1, z: 1, direction: 1 },
  { x: -1, z: -1, direction: -1 }, { x: 1, z: -1, direction: 1 }
];
export function rotorTelemetry(state = {}, spec = {}) {
  const maximum = spec.maxRpm || (spec.class === 'three' ? 32000 : spec.class === 'seven' ? 16000 : 24000);
  const voltage = 1 - (1 - (state.battery ?? 1)) * 0.16;
  const blades = spec.propellerBlades || (spec.propellersId === 'efficient' ? 2 : 3);
  return ROTOR_LAYOUT.map((layout, index) => {
    const speed = Math.max(0, Math.min(1, state.motors?.[index] || 0));
    const rpm = Math.max(0, state.motorRpm?.[index] ?? speed * maximum * voltage);
    return { ...layout, index, rpm, speed, radiansPerSecond: rpm * Math.PI / 30, bladeHz: rpm * blades / 60 };
  });
}
