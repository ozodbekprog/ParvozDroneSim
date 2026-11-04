export function rotate(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx];
}

export function inverseRotate(q, v) {
  return rotate([-q[0], -q[1], -q[2], q[3]], v);
}

export function integrateQuaternion(q, omega, dt) {
  const [x, y, z, w] = q;
  const [ox, oy, oz] = omega;
  const next = [
    x + 0.5 * (w * ox + y * oz - z * oy) * dt,
    y + 0.5 * (w * oy + z * ox - x * oz) * dt,
    z + 0.5 * (w * oz + x * oy - y * ox) * dt,
    w + 0.5 * (-x * ox - y * oy - z * oz) * dt
  ];
  const length = Math.hypot(...next) || 1;
  return next.map(value => value / length);
}

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];

// Static-world sequential impulses. Velocities are world linear/body angular;
// contacts carry world-space offsets from the centre of mass. No orientation
// override or velocity damping: both friction and support come from impulses.
export function solveContactImpulses(state,spec,contacts) {
  if(!contacts.length)return {impact:0,supported:false};
  const mass=spec.mass??.68;
  const inertia=spec.inertia||[.55,.95,.55].map(f=>mass*(spec.arm??.115)**2*f);
  // Solve in the body frame: inertia stays diagonal and transforms are paid
  // once per contact rather than hundreds of times inside the iteration loop.
  let velocity=inverseRotate(state.rotation,state.velocity);
  const pointVelocity=r=>add(velocity,cross(state.angularVelocity,r));
  const effective=(r,d)=>{
    const c=cross(r,d);
    return 1/mass+c[0]*c[0]/inertia[0]+c[1]*c[1]/inertia[1]+c[2]*c[2]/inertia[2];
  };
  const apply=(r,impulse)=>{
    const torque=cross(r,impulse);
    for(let i=0;i<3;i++){
      velocity[i]+=impulse[i]/mass;
      state.angularVelocity[i]+=torque[i]/inertia[i];
    }
  };
  const friction=spec.contactFriction??.6,restitution=spec.contactRestitution??.12;
  const unique=new Map();
  for(const c of contacts){
    const key=[...c.r,...c.normal].map(v=>Math.round(v*1e5)).join(',');
    if(!unique.has(key))unique.set(key,{r:inverseRotate(state.rotation,c.r),normal:inverseRotate(state.rotation,c.normal),up:c.normal[1]});
  }
  const rows=[...unique.values()].map(c=>{
    const speed=dot(pointVelocity(c.r),c.normal);
    return {...c,normalImpulse:0,frictionImpulse:[0,0,0],mass:effective(c.r,c.normal),bounce:speed< -1?-restitution*speed:0,approach:Math.max(0,-speed)};
  });
  for(let iteration=0;iteration<24;iteration++){
   let change=0;
   for(const c of rows){
    const speed=dot(pointVelocity(c.r),c.normal),old=c.normalImpulse;
    c.normalImpulse=Math.max(0,old+(c.bounce-speed)/c.mass);
    change=Math.max(change,Math.abs(c.normalImpulse-old));
    apply(c.r,scale(c.normal,c.normalImpulse-old));
    const velocity=pointVelocity(c.r),tangent=add(velocity,scale(c.normal,-dot(velocity,c.normal))),length=Math.hypot(...tangent);
    let next=c.frictionImpulse;
    if(length>1e-10){
      const direction=scale(tangent,1/length);
      next=add(c.frictionImpulse,scale(direction,-length/effective(c.r,direction)));
    }
    // A falling normal impulse also reduces static friction's budget, even
    // when the contact's instantaneous tangential velocity is already zero.
    const limit=friction*c.normalImpulse,magnitude=Math.hypot(...next);
    if(magnitude>limit)next=scale(next,limit/magnitude);
    const delta=add(next,scale(c.frictionImpulse,-1));
    change=Math.max(change,Math.hypot(...delta));
    apply(c.r,delta);c.frictionImpulse=next;
   }
   if(change<1e-10)break;
  }
  state.velocity=rotate(state.rotation,velocity);
  return {impact:Math.max(0,...rows.map(c=>c.approach)),supported:rows.some(c=>c.up>.6&&c.normalImpulse>1e-8)};
}
