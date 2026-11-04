import {gateCrossed} from './physics.js';
import {rotate} from './rigid-body.js';

// A hold must satisfy every condition continuously. Entering a target at speed
// or facing the wrong direction is not a completed hover or landing exercise.
export function tutorialStepMet(step, {state, previous, map, track, flightMode}) {
  if (step.flightMode && step.flightMode !== flightMode) return false;
  if (step.airborne && state.grounded) return false;
  const speed = Math.hypot(...state.velocity);
  if (step.maxSpeed !== undefined && speed > step.maxSpeed) return false;
  if (step.position && Math.hypot(...state.position.map((v,i)=>v-step.position[i])) > step.radius) return false;
  if (step.heading !== undefined) {
    const forward = rotate(state.rotation,[0,0,1]);
    if (Math.hypot(forward[0],forward[2]) < .01) return false;
    const difference = Math.atan2(Math.sin(Math.atan2(forward[0],forward[2])-step.heading),Math.cos(Math.atan2(forward[0],forward[2])-step.heading));
    if (Math.abs(difference) > step.headingTolerance) return false;
  }
  switch (step.objective) {
    case 'altitude': return state.position[1]-(map.floorY??0) >= step.target;
    case 'speed': return speed >= step.target;
    case 'land': return state.grounded && speed < .5;
    case 'gate': return gateCrossed(previous,state.position,track.gates[Math.min(step.target,track.gates.length-1)]);
    case 'reach': return Boolean(step.position);
    default: return false;
  }
}
