// Establishing shots use the course itself, so imported maps get a live menu view too.
const SHOTS = {
  canyon: [44, 21, 16], forest: [38, 23, 18], hangar: [20, 7, 8],
  harborworks: [42, 22, 15], industrial: [44, 23, 16], neon: [44, 24, 16],
  nightgrid: [42, 22, 15], orbital: [18, 5, 6], pinecrest: [45, 24, 17],
  ridgeway: [39, 17, 14], ruins: [44, 23, 16], sunscar: [47, 18, 17]
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createMenuCameraShot(map, track) {
  if(map.menuCamera) return {...map.menuCamera, right:[1,0,0], drift:.35, fov:58};
  const gate = track.gates[0];
  const next = track.gates[1] || gate;
  const environment = map.environment || map.theme;
  const indoor = map.indoor ?? ['hangar', 'orbital'].includes(environment);
  const [distance, rise, side] = SHOTS[environment] || (indoor ? [20, 7, 8] : [42, 20, 16]);
  const yaw = gate.yaw || 0;
  const forward = [Math.sin(yaw), 0, Math.cos(yaw)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const position = gate.position.map((value, index) => value - forward[index] * distance + right[index] * side + (index === 1 ? rise : 0));
  const courseWeight = indoor ? 0.07 : 0.18;
  const target = gate.position.map((value, index) => value + (next.position[index] - value) * courseWeight + (index === 1 ? 0.6 : 0));
  if (map.bounds) {
    for (const index of [0, 2]) {
      const margin = Math.min(12, (map.bounds.max[index] - map.bounds.min[index]) * 0.04);
      position[index] = clamp(position[index], map.bounds.min[index] + margin, map.bounds.max[index] - margin);
    }
    position[1] = Math.max(position[1], map.bounds.min[1] + 1.5);
    if (indoor) position[1] = Math.min(position[1], map.bounds.max[1] - 0.8);
  }
  return { position, target, right, fov: indoor ? 58 : 61, drift: indoor ? 0.3 : 0.7 };
}

export function sampleMenuCameraShot(shot, elapsedSeconds, reducedMotion = false) {
  const lateral = reducedMotion ? 0 : Math.sin(elapsedSeconds * Math.PI * 2 / 32) * shot.drift;
  const vertical = reducedMotion ? 0 : Math.sin(elapsedSeconds * Math.PI * 2 / 47) * shot.drift * 0.2;
  return {
    position: shot.position.map((value, index) => value + shot.right[index] * lateral + (index === 1 ? vertical : 0)),
    target: shot.target.map((value, index) => value + shot.right[index] * lateral * 0.14)
  };
}

export function previewCameraDistance(diameter, fov, viewport, stage) {
  const widthFraction = Math.max(0.1, Math.min(1, stage.width / viewport.width));
  const heightFraction = Math.max(0.1, Math.min(1, stage.height / viewport.height));
  const halfAngle = Math.atan(Math.tan(fov * Math.PI / 360) * Math.min(heightFraction, widthFraction * viewport.width / viewport.height));
  // Leave a small border around all propeller tips, including when the model is rotated.
  return Math.max(0.25, diameter * 0.55 / Math.sin(halfAngle));
}

/** Fit the actual flat aircraft instead of fitting a sphere around its propeller tips. */
export function previewBoundsDistance(bounds, center, fov, viewport, stage, azimuth, elevation) {
  const tan=Math.tan(fov*Math.PI/360),margin=.88;
  const h=tan*viewport.width/viewport.height*Math.min(1,stage.width/viewport.width)*margin;
  const v=tan*Math.min(1,stage.height/viewport.height)*margin;
  const back=[Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)];
  const right=[Math.cos(azimuth),0,-Math.sin(azimuth)];
  const up=[-Math.sin(azimuth)*Math.sin(elevation),Math.cos(elevation),-Math.cos(azimuth)*Math.sin(elevation)];
  const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
  let distance=.2;
  if(bounds.points?.length){
    for(let i=0;i<bounds.points.length;i+=3){
      const x=bounds.points[i]-center[0],y=bounds.points[i+1]-center[1],z=bounds.points[i+2]-center[2];
      const depth=x*back[0]+y*back[1]+z*back[2];
      distance=Math.max(distance,depth+Math.abs(x*right[0]+z*right[2])/Math.max(.01,h),depth+Math.abs(x*up[0]+y*up[1]+z*up[2])/Math.max(.01,v));
    }
    return distance+.015;
  }
  for(let corner=0;corner<8;corner++){
    const point=center.map((value,i)=>(corner&(1<<i)?bounds.max[i]:bounds.min[i])-value);
    distance=Math.max(distance,dot(point,back)+Math.abs(dot(point,right))/Math.max(.01,h),dot(point,back)+Math.abs(dot(point,up))/Math.max(.01,v));
  }
  return distance+.015;
}
