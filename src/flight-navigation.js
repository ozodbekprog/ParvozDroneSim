import { Vector3 } from 'three';
import {rotate} from '../shared/rigid-body.js';

export function lessonFeedback(step,state,heldSeconds,index,total,mode) {
  if (!step) return '';
  const parts=[`Step ${index+1}/${total}`];
  if (step.airborne && state.grounded) parts.push('Take off into the marker');
  if (step.flightMode && step.flightMode!==mode) parts.push(`Switch to ${step.flightMode.toUpperCase()}`);
  if (step.maxSpeed!==undefined) parts.push(`Speed ${Math.hypot(...state.velocity).toFixed(1)} / ${step.maxSpeed} m/s`);
  if (step.heading!==undefined) {
    const forward=rotate(state.rotation,[0,0,1]);
    const degrees=x=>Math.round((x*180/Math.PI+360)%360)%360;
    parts.push(`Heading ${degrees(Math.atan2(forward[0],forward[2]))}° · aim ${degrees(step.heading)}°`);
  }
  if (step.duration>0) parts.push(`Hold ${Math.min(heldSeconds,step.duration).toFixed(1)} / ${step.duration} s`);
  return parts.join(' · ');
}

export function flightTargets(track, player, mode, lesson) {
  if (lesson?.position) return [{ position: lesson.position, label: 'TARGET', radius: lesson.radius || 2 }];
  if (lesson?.objective === 'gate') {
    const index = Math.min(lesson.target, track.gates.length - 1);
    return track.gates.slice(index,index+2).map((gate,offset)=>({position:gate.position,label:offset ? `THEN ${index+2}` : `GATE ${index+1}`}));
  }
  if (['training', 'freestyle'].includes(mode) && lesson?.objective !== 'manual') return [];
  const gate = player?.gate || 0, lap = player?.lap || 1;
  const count = Math.min(2, (track.laps - lap) * track.gates.length + track.gates.length - gate);
  return Array.from({ length: Math.max(0, count) }, (_, offset) => {
    const index = (gate + offset) % track.gates.length;
    return { position: track.gates[index].position, label: offset ? `THEN ${index + 1}` : `NEXT ${index + 1}` };
  });
}

// Screen-space markers follow the same camera pose as the rendered flight.
export function projectFlightTarget(target, camera, width, height) {
  camera.updateMatrixWorld();
  const point = new Vector3(...target.position), distance = point.distanceTo(camera.position);
  const local = point.clone().applyMatrix4(camera.matrixWorldInverse);
  const clip = point.project(camera);
  const front = local.z < -camera.near;
  const visible = front && Math.abs(clip.x) <= .88 && Math.abs(clip.y) <= .78;
  let x = clip.x, y = -clip.y;
  if (!front) { x = -x; y = -y; }
  if (!visible && (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < .001)) { x = 0; y = -1; }
  if (!visible) {
    const edge = Math.max(Math.abs(x) / .88, Math.abs(y) / .72);
    x /= edge; y /= edge;
  }
  return { x: (x + 1) * width / 2, y: (y + 1) * height / 2, visible, bearing: Math.atan2(y, x) * 180 / Math.PI + 90, distance };
}
