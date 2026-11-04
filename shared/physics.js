import { sphereContacts, sweepSphere, candidateEntries, nearbyBoxObstacles } from './collision.js';
import { trackGateCollisionBoxes } from './gates.js';
export const FIXED_DT = 1 / 60;
export const GRAVITY = 9.81;
import { DEFAULT_FLIGHT_CONTROLLER, rateDegrees, throttleOutput } from './flight-controller.js';
import {nativeComponentPhysics,nativeBatteryState} from './component-physics.js';
import {isPartCompatible,canUseActionCamera} from './part-compatibility.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

import {rotate,inverseRotate,integrateQuaternion,solveContactImpulses} from './rigid-body.js';
export {rotate,inverseRotate};

import { DRONES, PARTS } from './catalog.js';
export { DRONES, PARTS };

export function defaultBuild(drone='kestrel') {
  return { drone, frame: 'carbon', motors: 'balanced', propellers: 'triblade', battery: 'standard', camera: 'wide', antenna:'fixed', color: '#fc623d', led: '#58d5fb', ...(DRONES[drone]?.accessories?.actionCamera?{actionCamera:false}:{}), ...DRONES[drone]?.stockParts };
}

export function resolveBuild(build = defaultBuild()) {
  const base = DRONES[build.drone] || DRONES.kestrel;
  const part = category => PARTS[category].find(item => item.id === build[category] && isPartCompatible(base,category,item)) || PARTS[category].find(item=>item.id===base.stockParts?.[category]) || PARTS[category][0];
  const frame = part('frame');
  const motors = part('motors');
  const props = part('propellers');
  const battery = part('battery');
  const camera=part('camera');
  const antenna=part('antenna');
  const native=nativeComponentPhysics(base,{frame,motors,propellers:props,battery,camera,...(antenna?{antenna}:{})});
  const mass = Math.max(0.2, base.mass + frame.mass + motors.mass + props.mass + battery.mass);
  return {
    ...base,
    mass,
    thrustToWeight: base.thrustToWeight * base.mass / mass * motors.thrust * props.thrust,
    motorTau: base.motorTau / motors.response,
    // Diagonal body inertia in kg m², separate from controller gains.
    inertia: (base.inertia || [0.55,0.95,0.55].map(factor => base.mass * base.arm ** 2 * factor)).map(value => value * mass / base.mass),
    controllerInertia: base.inertia || [0.55,0.95,0.55].map(factor => base.mass * base.arm ** 2 * factor),
    rotorDrag: (base.rotorDrag || [.06,.012,.045]).map(value => value * props.drag),
    maxRpm: base.maxRpm || (base.class === 'three' ? 32000 : base.class === 'seven' ? 16000 : 24000),
    yawTorqueRatio: base.yawTorqueRatio ?? base.arm * .20,
    drag: base.drag.map(value => value * props.drag),
    batterySeconds: base.batterySeconds * battery.duration,
    fov: part('camera').fov,
    frameId: frame.id,
    motorsId: motors.id,
    propellersId: props.id,
    batteryId: battery.id,
    cameraId: part('camera').id,
    antennaId:antenna?.id,
    actionCamera: build.actionCamera===true && canUseActionCamera(base),
    visualParts: Object.keys(PARTS).map(category => {
      const item=part(category),motorSource=motors.sourcePartId||base.sourcePhysics?.partIds?.motors;
      return {category,...item,mountMatrix:category==='antenna'?base.customization?.slots?.antenna?.[0]?.matrix:item.propellerMountMatrixByBuild?.[base.id+':'+motorSource]||item.mountMatrixByDrone?.[base.id]};
    }).filter(item => (item.model || item.materials?.length) && (!item.compatibleDrones || item.compatibleDrones.includes(base.id)) && (item.category==='antenna' || !item.sourceSpecs || item.id!==base.stockParts?.[item.category] || item.category==='propellers' && motors.id!==base.stockParts?.motors)),
    color: build.color || base.color,
    led: build.led || '#58d5fb',
    durability: frame.durability,
    ...native
  };
}

export function createDroneState(position = [0, 1.4, 0], yaw = 0) {
  return {
    position: [...position], previousPosition: [...position], velocity: [0, 0, 0],
    rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], angularVelocity: [0, 0, 0],
    motors: [0, 0, 0, 0], battery: 1, health: 1, crashed: false,
    pidIntegral: [0, 0, 0], pidDerivative: [0, 0, 0], pidPreviousRates: [0, 0, 0], launchElapsed: 0, launchReleased: false,
    takeoffSupportY: null
  };
}

// Commands and network snapshots run at 60 Hz; motors and rigid-body dynamics at 240 Hz.
// Body axes are +X left, +Y up, +Z forward. Positive stick yaw therefore means -Y.
export function stepDrone(state, input, spec, dt = FIXED_DT, mode = 'acro', wind = [0, 0, 0], gravityScale = 1, controller = DEFAULT_FLIGHT_CONTROLLER, floorY = 0, onSubstep) {
  state.previousPosition = [...state.position];
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  for (let index = 0; index < steps; index++) {
    const previous={position:[...state.position],rotation:[...state.rotation]};
    integrateDrone(state, input, spec, dt / steps, mode, wind, gravityScale, controller, floorY);
    if(onSubstep)onSubstep(previous,dt/steps);
    else resolveEnvironmentCollision(state,{floorY},null,[],spec,previous,dt/steps,true);
  }
  return state;
}

function integrateDrone(state, input, spec, dt, mode, wind, gravityScale, controller, floorY) {
  const throttleStick = clamp(Number(input.throttle) || 0, 0, 1);
  const throttle = throttleOutput(throttleStick, controller.throttle);
  const roll = clamp(Number(input.roll) || 0, -1, 1);
  const pitch = clamp(Number(input.pitch) || 0, -1, 1);
  const yaw = clamp(Number(input.yaw) || 0, -1, 1);
  const up = rotate(state.rotation, [0, 1, 0]);
  const right = rotate(state.rotation, [1, 0, 0]);
  const forward = rotate(state.rotation, [0, 0, 1]);
  const levelRoll = -Math.atan2(right[1], up[1]);
  const levelPitch = Math.atan2(forward[1], up[1]);
  const radians = Math.PI / 180;
  let targetRoll = rateDegrees(roll, controller.rates.roll) * radians;
  let targetPitch = rateDegrees(pitch, controller.rates.pitch) * radians;
  let targetYaw = -rateDegrees(yaw, controller.rates.yaw) * radians;
  if (mode === 'angle' || mode === 'horizon') {
    const assist = mode === 'angle' ? 1 : Math.max(0, 1 - Math.max(Math.abs(roll), Math.abs(pitch)) * (1.5 * 100 / Math.max(1, controller.level.horizonStrength)));
    const limit = controller.level.angleLimit * radians;
    const strength = 3.1 * controller.level.angleStrength / 30;
    targetRoll = targetRoll * (1 - assist) + clamp(roll * limit + levelRoll, -limit, limit) * strength * assist;
    targetPitch = targetPitch * (1 - assist) + clamp(pitch * limit + levelPitch, -limit, limit) * strength * assist;
  }
  state.launchElapsed = (state.launchElapsed || 0) + dt;
  if (throttleStick >= 0.15 || state.launchElapsed >= 3) state.launchReleased = true;
  if (controller.launchControl && !state.launchReleased) {
    targetRoll = clamp(levelRoll * 3, -3, 3);
    targetPitch = clamp(levelPitch * 3, -3, 3);
    targetYaw = 0;
  }
  state.pidIntegral ||= [0, 0, 0];
  state.pidDerivative ||= [0, 0, 0];
  state.pidPreviousRates ||= [0, 0, 0];
  const axes = ['pitch', 'yaw', 'roll'];
  // Mass distributed between the central stack/battery and four motor arms.
  const inertia = spec.inertia || [0.55, 0.95, 0.55].map(factor => spec.mass * spec.arm ** 2 * factor);
  const controllerInertia = spec.controllerInertia || inertia;
  const resting = state.grounded===true;
  state.takeoffSupportY=null; // Legacy snapshot field; no hidden ground leveling.
  const targets = [targetPitch, targetYaw, targetRoll];
  const stopped = state.crashed || (resting && throttleStick < 0.03);
  const control = targets.map((target, index) => {
    const config = controller.pid[axes[index]];
    const error = target - state.angularVelocity[index];
    if (stopped) { state.pidIntegral[index] = 0; state.pidDerivative[index] = 0; state.pidPreviousRates[index] = 0; return 0; }
    // Conditional integration prevents windup when motor allocation saturates.
    if (!state.motorSaturated && !resting) state.pidIntegral[index] = clamp(state.pidIntegral[index] + error * dt, -1.5, 1.5);
    else state.pidIntegral[index] *= Math.exp(-dt * 4);
    const derivative = (state.angularVelocity[index] - state.pidPreviousRates[index]) / Math.max(dt, 0.001);
    state.pidDerivative[index] += (derivative - state.pidDerivative[index]) * (1 - Math.exp(-dt / 0.008));
    state.pidPreviousRates[index] = state.angularVelocity[index];
    const base = DEFAULT_FLIGHT_CONTROLLER.pid[axes[index]];
    const acceleration = error * 45 * config.p / base.p + state.pidIntegral[index] * 55 * config.i / base.i - state.pidDerivative[index] * 0.3 * config.d / Math.max(1, base.d);
    return acceleration * controllerInertia[index];
  });
  const weight = spec.mass * GRAVITY;
  const nativeBattery=nativeBatteryState(state,spec);
  const voltage = nativeBattery ? nativeBattery.rpm/spec.maxRpm : 1 - (1 - state.battery) * 0.16;
  const maxThrust = weight * spec.thrustToWeight / 4 * voltage ** 2;
  const collective = Math.pow(throttle, 1.85) * maxThrust;
  const arm = spec.arm / Math.SQRT2;
  const rotorPositions=spec.sourcePhysics?.motorPositions||[[arm,0,arm],[-arm,0,arm],[-arm,0,-arm],[arm,0,-arm]];
  const pitchArm=rotorPositions.reduce((sum,p)=>sum+Math.abs(p[2]),0)/4;
  const rollArm=rotorPositions.reduce((sum,p)=>sum+Math.abs(p[0]),0)/4;
  const yawLever = spec.yawTorqueRatio ?? spec.arm * 0.20;
  const signs = [[-1, -1, 1], [-1, 1, -1], [1, -1, -1], [1, 1, 1]];
  const mix = signs.map(sign => collective + sign[0] * control[0] / (4 * pitchArm) + sign[1] * control[1] / (4 * yawLever) + sign[2] * control[2] / (4 * rollArm));
  // Shift collective only in the air (airmode). Grounded zero-throttle sticks
  // cannot spin up opposite motors and turn the craft into a ground spinner.
  const shift = resting ? 0 : Math.min(0, maxThrust - Math.max(...mix)) + Math.max(0, -Math.min(...mix));
  state.motorSaturated = mix.some(force => force + shift < 0 || force + shift > maxThrust);
  const idle = controller.throttle.idle / 100;
  // With airmode disabled on the ground, rate demand cannot create full motor
  // thrust from a nearly closed throttle. Keep differential authority within
  // the requested collective; airborne allocation is unchanged.
  const availableThrust = resting ? Math.min(maxThrust, Math.max(collective * 2, idle ** 2 * maxThrust)) : maxThrust;
  for (let i = 0; i < 4; i++) {
    // state.motors stores normalized shaft speed; each rotor produces k * RPM².
    const targetSpeed = stopped ? 0 : Math.sqrt(clamp((mix[i] + shift) / maxThrust, idle ** 2, availableThrust / maxThrust));
    const tau = spec.motorTau * (targetSpeed < state.motors[i] ? 0.7 : 1);
    state.motors[i] += (targetSpeed - state.motors[i]) * (1 - Math.exp(-dt / tau));
  }
  const motorThrust = state.motors.map(speed => speed * speed * maxThrust);
  state.motorThrust = motorThrust;
  state.motorRpm = state.motors.map(speed => speed * (spec.maxRpm || (spec.class === 'three' ? 32000 : spec.class === 'seven' ? 16000 : 24000)) * voltage);
  const totalThrust = motorThrust.reduce((a, b) => a + b, 0);
  const torque = [
    -motorThrust.reduce((sum,f,i)=>sum+rotorPositions[i][2]*f,0),
    yawLever * (-motorThrust[0] + motorThrust[1] - motorThrust[2] + motorThrust[3]),
    motorThrust.reduce((sum,f,i)=>sum+rotorPositions[i][0]*f,0)
  ];
  // Linear rotor drag depends on shaft speed and local airflow at each arm.
  // Quadratic fuselage drag remains separate; these are forces, not pose smoothing.
  const localVelocity = inverseRotate(state.rotation, state.velocity.map((value, index) => value - wind[index]));
  const rotorForce = [0,0,0];
  rotorPositions.forEach(([x,y,z], index) => {
    const [wx,wy,wz] = state.angularVelocity;
    const air = [localVelocity[0]+wy*z-wz*y, localVelocity[1]+wz*x-wx*z, localVelocity[2]+wx*y-wy*x];
    const force = air.map((speed, axis) => -(spec.rotorDrag?.[axis] || 0) * state.motors[index] * speed / 4);
    for(let axis=0;axis<3;axis++) rotorForce[axis] += force[axis];
    torque[0] += y*force[2]-z*force[1]; torque[1] += z*force[0]-x*force[2]; torque[2] += x*force[1]-y*force[0];
  });
  const omega = [...state.angularVelocity];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3, k = (i + 2) % 3;
    const coupling = (inertia[k] - inertia[j]) * omega[j] * omega[k];
    const acceleration = (torque[i] - coupling) / inertia[i] - spec.angularDrag * omega[i] * (1 + Math.abs(omega[i]) * 0.05);
    state.angularVelocity[i] = clamp(omega[i] + acceleration * dt, -70, 70);
  }
  const dragLocal = localVelocity.map((value, index) => -spec.drag[index] * value * Math.abs(value) + rotorForce[index]);
  const dragWorld = rotate(state.rotation, dragLocal);
  const newUp = rotate(state.rotation, [0, 1, 0]);
  for (let i = 0; i < 3; i++) {
    const acceleration = (newUp[i] * totalThrust + dragWorld[i]) / spec.mass - (i === 1 ? GRAVITY * gravityScale : 0);
    state.velocity[i] += acceleration * dt;
  }
  state.battery = Math.max(0, state.battery - (spec.nativePower ? dt*nativeBatteryState(state,spec).watts/(spec.nativePower.energyWh*3600) : dt * (0.45 + throttle * throttle * 1.1) / spec.batterySeconds));
  if (state.battery === 0) state.crashed = true;
  return state;
}

export function gateCrossed(previous, current, gate) {
  const normal = gate.axes?.normal || [Math.sin(gate.yaw), 0, Math.cos(gate.yaw)];
  const from = previous.map((value, index) => value - gate.position[index]);
  const to = current.map((value, index) => value - gate.position[index]);
  const before = dot(from, normal);
  const after = dot(to, normal);
  if (!(before < 0 && after >= 0)) return false;
  const t = -before / (after - before);
  const point = previous.map((value, index) => value + (current[index] - value) * t - gate.position[index]);
  const side = gate.axes?.right || [Math.cos(gate.yaw), 0, -Math.sin(gate.yaw)];
  const up = gate.axes?.up || [0,1,0];
  const x=dot(point,side)/(gate.width/2),y=dot(point,up)/(gate.height/2);
  return gate.aperture==='ellipse'?x*x+y*y<=1:Math.abs(x)<=1&&Math.abs(y)<=1;
}

export function resolveEnvironmentCollision(state, map, track, obstacles = [], spec = resolveBuild(), previous, dt = 1/240, advance = false) {
  let impact = 0;
  const contacts=[];
  state.grounded=false;
  const spheres = spec.collision?.spheres?.length ? spec.collision.spheres : [{position:[0,0,0],radius:0.13}, ...[-1,1].flatMap(x=>[-1,1].map(z=>({position:[x*spec.arm,0,z*spec.arm],radius:0.07})))];
  const allGateObstacles = trackGateCollisionBoxes(track);
  let maxSphereReach = 0;
  for (let si = 0; si < spheres.length; si++) {
    const sp = spheres[si], p = sp.position;
    const reach = Math.hypot(p[0], p[1], p[2]) + sp.radius;
    if (reach > maxSphereReach) maxSphereReach = reach;
  }
  const compoundRadius = maxSphereReach + .003;
  let supportedBefore=false;
  if(advance){
    // Forces update velocities first. Solve existing supports before integrating
    // the pose, so the craft cannot creep/rock through a supporting contact.
    const initial=[],initialCenter=[0,0,0];
    const nearEntries=candidateEntries(obstacles,state.position,compoundRadius);
    const nearGates=nearbyBoxObstacles(allGateObstacles,state.position,compoundRadius+.05);
    const floorThreshold=(map?.floorY??0)+.003;
    for(let si=0;si<spheres.length;si++){
      const sphere=spheres[si],offset=rotate(state.rotation,sphere.position);
      initialCenter[0]=state.position[0]+offset[0];
      initialCenter[1]=state.position[1]+offset[1];
      initialCenter[2]=state.position[2]+offset[2];
      if(initialCenter[1]-sphere.radius<floorThreshold)
        initial.push({normal:[0,1,0],r:[offset[0],offset[1]-sphere.radius,offset[2]]});
      for(let i=0;i<nearEntries.length;i++){
        const found=sphereContacts(initialCenter,sphere.radius+.003,nearEntries[i].obstacle);
        for(let ci=0;ci<found.length;ci++){
          const contact=found[ci];
          initial.push({normal:contact.normal,r:[offset[0]-contact.normal[0]*sphere.radius,offset[1]-contact.normal[1]*sphere.radius,offset[2]-contact.normal[2]*sphere.radius]});
        }
      }
      for(let i=0;i<nearGates.length;i++){
        const found=sphereContacts(initialCenter,sphere.radius+.003,nearGates[i]);
        for(let ci=0;ci<found.length;ci++){
          const contact=found[ci];
          initial.push({normal:contact.normal,r:[offset[0]-contact.normal[0]*sphere.radius,offset[1]-contact.normal[1]*sphere.radius,offset[2]-contact.normal[2]*sphere.radius]});
        }
      }
    }
    const response=solveContactImpulses(state,spec,initial);
    supportedBefore=response.supported;impact=response.impact;
    state.position=[state.position[0]+state.velocity[0]*dt,state.position[1]+state.velocity[1]*dt,state.position[2]+state.velocity[2]*dt];
    state.rotation=integrateQuaternion(state.rotation,state.angularVelocity,dt);
  }
  // Sweep each 240 Hz motion before resolving overlaps. Use the earliest body
  // contact and project remaining travel along its surface, including corners.
  let from=previous?.position||state.previousPosition||state.position;
  const oldRotation=previous?.rotation||state.rotation;
  for(let pass=0;pass<4;pass++){
    const mx=state.position[0]-from[0],my=state.position[1]-from[1],mz=state.position[2]-from[2];
    const prevRot=pass?state.rotation:oldRotation;
    let swept=null;
    for(let si=0;si<spheres.length;si++){
      const sphere=spheres[si],before=rotate(prevRot,sphere.position),after=rotate(state.rotation,sphere.position);
      if(Math.hypot(mx+after[0]-before[0],my+after[1]-before[1],mz+after[2]-before[2])>sphere.radius*.5){
        if(!swept)swept=[];
        swept.push({sphere,before,after});
      }
    }
    // Short motions cannot cross a surface without overlapping it. Keep their
    // inexpensive contact path, especially for grounded/hovering pilots.
    if(!swept)break;
    const midpoint=[from[0]+mx/2,from[1]+my/2,from[2]+mz/2],halfMotion=Math.hypot(mx,my,mz)/2;
    const nearEntries=candidateEntries(obstacles,midpoint,compoundRadius+halfMotion);
    const nearGates=nearbyBoxObstacles(allGateObstacles,midpoint,compoundRadius+halfMotion+.05);
    let hit=null;
    const sweepFrom=[0,0,0],sweepTo=[0,0,0];
    for(let si=0;si<swept.length;si++){
      const {sphere,before,after}=swept[si];
      sweepFrom[0]=from[0]+before[0];sweepFrom[1]=from[1]+before[1];sweepFrom[2]=from[2]+before[2];
      sweepTo[0]=state.position[0]+after[0];sweepTo[1]=state.position[1]+after[1];sweepTo[2]=state.position[2]+after[2];
      for(let i=0;i<nearEntries.length;i++){
        const contact=sweepSphere(sweepFrom,sweepTo,sphere.radius,nearEntries[i].obstacle);
        if(contact&&(!hit||contact.time<hit.time))hit={...contact,sphere,offset:[before[0]+(after[0]-before[0])*contact.time,before[1]+(after[1]-before[1])*contact.time,before[2]+(after[2]-before[2])*contact.time]};
      }
      for(let i=0;i<nearGates.length;i++){
        const contact=sweepSphere(sweepFrom,sweepTo,sphere.radius,nearGates[i]);
        if(contact&&(!hit||contact.time<hit.time))hit={...contact,sphere,offset:[before[0]+(after[0]-before[0])*contact.time,before[1]+(after[1]-before[1])*contact.time,before[2]+(after[2]-before[2])*contact.time]};
      }
    }
    if(!hit)break;
    contacts.push({normal:hit.normal,r:[hit.offset[0]-hit.normal[0]*hit.sphere.radius,hit.offset[1]-hit.normal[1]*hit.sphere.radius,hit.offset[2]-hit.normal[2]*hit.sphere.radius]});
    const contactPosition=[from[0]+mx*hit.time+hit.normal[0]*1e-6,from[1]+my*hit.time+hit.normal[1]*1e-6,from[2]+mz*hit.time+hit.normal[2]*1e-6];
    const rx=mx*(1-hit.time),ry=my*(1-hit.time),rz=mz*(1-hit.time),inward=Math.min(0,rx*hit.normal[0]+ry*hit.normal[1]+rz*hit.normal[2]);
    state.position=[contactPosition[0]+rx-hit.normal[0]*inward,contactPosition[1]+ry-hit.normal[1]*inward,contactPosition[2]+rz-hit.normal[2]*inward];
    from=contactPosition;
  }
  // A small contact skin keeps a resting craft supported between gravity
  // steps, even when an authored floor lies above the map's fallback plane.
  const contactSkin=.003,sphereCenter=[0,0,0];
  let baseX=state.position[0],baseY=state.position[1],baseZ=state.position[2];
  let baseEntries=candidateEntries(obstacles,state.position,compoundRadius);
  let baseGates=nearbyBoxObstacles(allGateObstacles,state.position,compoundRadius+.05);
  const resolveObstacle=(sphere,offset,obstacle)=>{
    // Recompute after each correction. A cached contact list can contain
    // hundreds of coplanar triangles, each with the same old penetration.
    for(let pass=0;pass<8;pass++){
      sphereCenter[0]=state.position[0]+offset[0];
      sphereCenter[1]=state.position[1]+offset[1];
      sphereCenter[2]=state.position[2]+offset[2];
      const found=sphereContacts(sphereCenter,sphere.radius+contactSkin,obstacle);
      if(!found.length)break;
      let contact=found[0];
      for(let ci=1;ci<found.length;ci++)if(found[ci].depth>contact.depth)contact=found[ci];
      contacts.push({normal:contact.normal,r:[offset[0]-contact.normal[0]*sphere.radius,offset[1]-contact.normal[1]*sphere.radius,offset[2]-contact.normal[2]*sphere.radius]});
      const penetration=Math.max(0,contact.depth-contactSkin);
      if(penetration>0){
        state.position=[
          state.position[0]+contact.normal[0]*penetration,
          state.position[1]+contact.normal[1]*penetration,
          state.position[2]+contact.normal[2]*penetration
        ];
      }
      if(penetration<=1e-7)break;
    }
  };
  for(let si=0;si<spheres.length;si++){
    const sphere=spheres[si],offset=rotate(state.rotation,sphere.position);
    if(state.position[0]!==baseX||state.position[1]!==baseY||state.position[2]!==baseZ){
      baseX=state.position[0];baseY=state.position[1];baseZ=state.position[2];
      baseEntries=candidateEntries(obstacles,state.position,compoundRadius);
      baseGates=nearbyBoxObstacles(allGateObstacles,state.position,compoundRadius+.05);
    }
    let cx=baseX,cy=baseY,cz=baseZ,pending=baseEntries,cursor=0;
    while(cursor<pending.length){
      const entry=pending[cursor++];
      resolveObstacle(sphere,offset,entry.obstacle);
      if(state.position[0]!==cx||state.position[1]!==cy||state.position[2]!==cz){
        cx=state.position[0];cy=state.position[1];cz=state.position[2];
        pending=candidateEntries(obstacles,state.position,compoundRadius,entry.index);
        cursor=0;
      }
    }
    if(allGateObstacles.length){
      const gates=(cx===baseX&&cy===baseY&&cz===baseZ)?baseGates:nearbyBoxObstacles(allGateObstacles,state.position,compoundRadius+.05);
      for(let gi=0;gi<gates.length;gi++)resolveObstacle(sphere,offset,gates[gi]);
    }
  }
  // The fallback plane uses the same compound contact geometry as authored
  // surfaces. Its support height must rotate with the craft, not its centre.
  const floor=map?.floorY??0;
  let lift=0;
  for(const sphere of spheres){
    const r=rotate(state.rotation,sphere.position),gap=state.position[1]+r[1]-sphere.radius-floor;
    if(gap<.003){
      contacts.push({normal:[0,1,0],r:[r[0],r[1]-sphere.radius,r[2]]});
      lift=Math.max(lift,-gap);
    }
  }
  state.position[1]+=lift;
  const response=solveContactImpulses(state,spec,contacts);
  impact=Math.max(impact,response.impact);
  state.grounded=response.supported||(supportedBefore&&contacts.some(c=>c.normal[1]>.6));
  if (!map?.model && (map?.theme === 'hangar' || map?.theme === 'orbital')) {
    for (const [axis, limit] of [[0, 80], [2, 63]]) {
      if (Math.abs(state.position[axis]) > limit) {
        impact = Math.max(impact, Math.abs(state.velocity[axis]));
        state.position[axis] = Math.sign(state.position[axis]) * limit;
        state.velocity[axis] *= -0.22;
      }
    }
    if (state.position[1] > 24.5) {
      impact = Math.max(impact, Math.abs(state.velocity[1]));
      state.position[1] = 24.5; state.velocity[1] = Math.min(0, state.velocity[1]) * 0.22;
    }
  }
  if (impact > 4) state.health = Math.max(0, state.health - (impact - 4) * 0.015);
  if (state.health <= 0) state.crashed = true;
  return state;
}
