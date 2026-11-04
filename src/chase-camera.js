import { Vector3 } from 'three';
import { rotate } from '../shared/physics.js';

export const CHASE_DISTANCE=1.2, CHASE_HEIGHT=.38, CHASE_FOV=72;
export const flightCameraFov=(mode,fpvFov)=>mode==='chase'||mode==='chase-rigid'?CHASE_FOV:fpvFov;
export function chaseCameraShot(state,memory=null,dt=0) {
  const forward=new Vector3(...rotate(state.rotation,[0,0,1]));
  const horizontal=Math.hypot(forward.x,forward.z);
  // Pitch has no meaningful heading at the vertical pole. Keep the last
  // heading through that region, with hysteresis to avoid switching sides.
  const vertical=horizontal<(memory?.vertical ? .3 : .15);
  if(memory)memory.vertical=vertical;
  let yaw;
  if((vertical||state.crashed)&&Number.isFinite(memory?.yaw))yaw=memory.yaw;
  else if(vertical){
    const right=rotate(state.rotation,[1,0,0]);
    yaw=Math.atan2(-right[2],right[0]);
  }else yaw=Math.atan2(forward.x,forward.z);
  if(memory){
    if(!Number.isFinite(memory.yaw))memory.yaw=yaw;
    else {
      const delta=Math.atan2(Math.sin(yaw-memory.yaw),Math.cos(yaw-memory.yaw));
      memory.yaw+=delta*(1-Math.exp(-Math.max(0,dt)/.1));
    }
    yaw=memory.yaw;
  }
  const heading=new Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const origin=new Vector3(...state.position);
  const offset=heading.clone().multiplyScalar(-CHASE_DISTANCE).add(new Vector3(0,CHASE_HEIGHT,0));
  // Carry the interpolated aircraft origin directly. Smoothing world position
  // introduces speed-dependent trailing distance and unstable obstacle clamps.
  return {position:origin.clone().add(offset),
    target:origin.clone().addScaledVector(heading,.75)};
}
