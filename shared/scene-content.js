/** Training without a lesson is Free Flight: environment only, including physics. */
export function courseEnabled({mode='race',tutorial,challenge,sceneCourse}={}) {
  if(typeof sceneCourse==='boolean')return sceneCourse;
  return mode!=='training' || Boolean(tutorial || challenge);
}
export function sceneTrack(track,course=true) {
  if(course)return track;
  const first=track.gates?.[0],yaw=first?.yaw||0;
  const spawn=track.spawn||(first?{position:[first.position[0]-Math.sin(yaw)*12,first.position[1],first.position[2]-Math.cos(yaw)*12],yaw}:undefined);
  return {...track,spawn,objects:[],gates:[],colliders:[],collisionFile:undefined,preparedCollisionFile:undefined};
}
