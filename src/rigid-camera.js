import {Vector3,Quaternion} from 'three';
export const CAMERA_MODES=['fpv','chase','chase-rigid'];
export const normalizeCameraMode=mode=>CAMERA_MODES.includes(mode)?mode:'fpv';
export const nextCameraMode=mode=>CAMERA_MODES[(CAMERA_MODES.indexOf(normalizeCameraMode(mode))+1)%CAMERA_MODES.length];
export const cameraModeLabel=mode=>({'fpv':'FPV','chase':'Dynamic chase','chase-rigid':'Rigid chase'}[normalizeCameraMode(mode)]);

/** Body-fixed transform: no lag, velocity offset, shake or forward look-ahead. */
export function rigidCameraShot(state,{distance=1.2,height=.38,memory}={}){
 const rotation=new Quaternion(...state.rotation),target=new Vector3(...state.position);
 const offset=new Vector3(0,height,-distance).applyQuaternion(rotation),up=new Vector3(0,1,0).applyQuaternion(rotation);
 if(memory){
  // Preserve the last flying shot after impact, while the body tumbles below it.
  if(state.crashed&&memory.rigidOffset){offset.copy(memory.rigidOffset);up.copy(memory.rigidUp);}
  else {memory.rigidOffset=offset.clone();memory.rigidUp=up.clone();}
 }
 return {target,position:offset.add(target),up};
}
