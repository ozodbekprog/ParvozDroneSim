import { rotate } from '../shared/physics.js';
import {Quaternion,Vector3} from 'three';

// Aircraft axes: +Z forward, +Y up. Yaw does not affect this instrument.
export function flightAttitude(rotation=[0,0,0,1]) {
  if(!rotation || rotation.length!==4 || !rotation.every(Number.isFinite) || Math.hypot(...rotation)<1e-8) rotation=[0,0,0,1];
  const norm=Math.hypot(...rotation),q=rotation.map(v=>v/norm);
  const forward=rotate(q,[0,0,1]),up=rotate(q,[0,1,0]),right=rotate(q,[1,0,0]);
  return { pitch:Math.asin(Math.max(-1,Math.min(1,forward[1])))*180/Math.PI,
    roll:Math.atan2(right[1],up[1])*180/Math.PI };
}

const inverseCamera=new Quaternion(),direction=new Vector3();
const EPSILON=1e-8;

function cameraProjection(camera,width,height){
  if(!camera?.isPerspectiveCamera || !Number.isFinite(width) || !Number.isFinite(height) || width<=0 || height<=0)return null;
  const projection=camera.projectionMatrix?.elements;
  if(!projection?.every(Number.isFinite) || Math.abs(projection[0])<EPSILON || Math.abs(projection[5])<EPSILON)return null;
  camera.getWorldQuaternion(inverseCamera);
  if(!inverseCamera.toArray().every(Number.isFinite) || inverseCamera.lengthSq()<EPSILON)return null;
  inverseCamera.normalize().invert();
  return projection;
}

function clipRectangle(clip,width,height){
  const bounds=clip || {left:0,top:0,right:width,bottom:height};
  return ['left','top','right','bottom'].every(key=>Number.isFinite(bounds[key])) && bounds.right>bounds.left && bounds.bottom>bounds.top ? bounds : null;
}

/**
 * Project the world-horizontal vanishing line using the camera that rendered
 * this frame. Coordinates are CSS pixels across the complete render viewport,
 * not the smaller attitude widget. FPV tilt, camera smoothing, FOV, aspect, zoom
 * and view offsets are already represented by the real camera.
 *
 * Returns a short clipped segment, or null when the horizon is outside the
 * instrument / at infinity (looking vertically). Fixed rails and aiming
 * reticle must be separate SVG groups; never transform them with this line.
 */
export function projectFlightHorizon(camera,width,height,{span=width*.38,clip}={}){
  const projection=cameraProjection(camera,width,height),bounds=clipRectangle(clip,width,height);
  if(!projection || !bounds || !Number.isFinite(span) || span<=0)return null;
  direction.set(0,1,0).applyQuaternion(inverseCamera);
  if(Math.hypot(direction.x,direction.y)<EPSILON)return null;

  // A camera ray is ((ndcX + P[8])/P[0], (ndcY + P[9])/P[5], -1).
  // Its dot product with camera-space world up is zero on the true horizon.
  let a=2*direction.x/(projection[0]*width),b=-2*direction.y/(projection[5]*height);
  let c=direction.x*(projection[8]-1)/projection[0]+direction.y*(projection[9]+1)/projection[5]-direction.z;
  const normalLength=Math.hypot(a,b);
  a/=normalLength;b/=normalLength;c/=normalLength;
  const distance=a*width/2+b*height/2+c;
  const x=width/2-a*distance,y=height/2-b*distance;
  let dx=-b,dy=a;
  if(dx<0 || (Math.abs(dx)<EPSILON && dy<0)){dx=-dx;dy=-dy;}
  let from=-span/2,to=span/2;
  for(const [origin,delta,minimum,maximum] of [[x,dx,bounds.left,bounds.right],[y,dy,bounds.top,bounds.bottom]]){
    if(Math.abs(delta)<EPSILON){if(origin<minimum || origin>maximum)return null;continue;}
    const first=(minimum-origin)/delta,last=(maximum-origin)/delta;
    from=Math.max(from,Math.min(first,last));to=Math.min(to,Math.max(first,last));
    if(from>=to)return null;
  }
  const x1=x+dx*from,y1=y+dy*from,x2=x+dx*to,y2=y+dy*to;
  const result={x1,y1,x2,y2,x:(x1+x2)/2,y:(y1+y2)/2,angle:Math.atan2(dy,dx)*180/Math.PI};
  return Object.values(result).every(Number.isFinite)?result:null;
}

/**
 * Project a world-space direction at infinity, independently of aircraft
 * attitude. Can be used for a flight-path cue if given velocity; this API does
 * not assert that the second ring in any reference HUD has that meaning.
 * Unlike a world point, a direction has no near/far-plane distance. Directions
 * parallel to / behind the camera plane, zero vectors and off-screen rays hide.
 */
export function projectFlightDirection(vector,camera,width,height,{clip}={}){
  const projection=cameraProjection(camera,width,height),bounds=clipRectangle(clip,width,height);
  if(!projection || !bounds || !vector || vector.length!==3 || !vector.every(Number.isFinite))return null;
  direction.set(...vector);
  if(direction.length()<EPSILON)return null;
  direction.normalize().applyQuaternion(inverseCamera);
  if(direction.z>=-EPSILON)return null;
  const x=(projection[0]*direction.x/-direction.z-projection[8]+1)*width/2;
  const y=(1-projection[5]*direction.y/-direction.z+projection[9])*height/2;
  if(!Number.isFinite(x) || !Number.isFinite(y) || x<bounds.left || x>bounds.right || y<bounds.top || y>bounds.bottom)return null;
  return {x,y};
}
