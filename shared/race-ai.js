import {FIXED_DT,GRAVITY,gateCrossed,rotate,DRONES,PARTS,defaultBuild,resolveBuild} from './physics.js';
import {simulateCommand,resetAtCheckpoint} from './flight-session.js';
import {DEFAULT_FLIGHT_CONTROLLER} from './flight-controller.js';
import {nativeBatteryState} from './component-physics.js';
import {RaceNavigation} from './race-ai-navigation.js';
import {isPartCompatible} from './part-compatibility.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
const NAMES=['Aziza','Timur','Lola'];
export const RACE_OPPONENT_COUNT=3;

function aligned(a,b,c){
  const incoming=b.map((v,i)=>v-a[i]),outgoing=c.map((v,i)=>v-b[i]);
  return incoming.reduce((n,v,i)=>n+v*outgoing[i],0)>Math.hypot(...incoming)*Math.hypot(...outgoing)*.995;
}
function simplifyApproach(from,path,navigation){
  const result=path.map(point=>[...point]);
  // Only discard a navigation point on an essentially straight, swept-clear
  // segment. Gate progress still requires the physical body to cross its plane.
  while(result.length>1&&aligned(from,result[0],result[1])&&navigation.clear(from,result[1]))result.shift();
  return result;
}
function continuousRoute(from,route,item){
  const nav=item.pilot.navigation,result=route.map(point=>[...point]),last=result.at(-1);
  const nextIndex=(item.gate+1)%nav.track.gates.length;
  const next=nav.prepared&&!(nextIndex===0&&item.lap===nav.track.laps)?nav.routes.get(nextIndex)?.[0]:null;
  const previous=result.at(-2)||from;
  if(last&&next&&aligned(previous,last,next)&&nav.clear(last,next))result.push(next);
  return simplifyApproach(from,result,nav);
}

export function createRaceOpponents(player,spec,map,track,obstacles,count=RACE_OPPONENT_COUNT,{random=Math.random,builds=null}={}) {
  const models=Object.values(DRONES);
  for(let i=models.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[models[i],models[j]]=[models[j],models[i]];}
  const roster=Array.from({length:clamp(count,0,RACE_OPPONENT_COUNT)},(_,index)=>{
    if(builds)return structuredClone(builds[index%builds.length]);
    const drone=models[index%models.length],build=defaultBuild(drone.id);
    for(const category of Object.keys(PARTS)){
      const choices=PARTS[category].filter(part=>isPartCompatible(drone,category,part)&&
        (part.id===build[category]||part.model&&(drone.mounts?.[category]||drone.customization?.slots?.[category])));
      if(choices.length)build[category]=choices[Math.floor(random()*choices.length)].id;
    }
    build.actionCamera=false;return build;
  });
  const specs=roster.map(resolveBuild);
  const radius=Math.max(...specs.map(spec=>Math.max(...(spec.collision?.spheres||[{position:[0,0,0],radius:.25}]).map(s=>Math.hypot(...s.position)+s.radius))))+.06;
  const navigation=new RaceNavigation(map,track,obstacles,radius);
  return Array.from({length:clamp(count,0,RACE_OPPONENT_COUNT)},(_,index)=>{
    const item={id:`race-ai-${index+1}`,name:NAMES[index],ai:true,build:roster[index],gate:0,lap:1,score:0,resetId:0,finishMs:null};
    item.pilot={navigation,spec:specs[index],skill:.78+index*.11,delay:index*.28,path:[],pathGate:-1,waypoint:0,stuck:0,lastPosition:null,recoveries:0,planFailed:false};
    resetRaceOpponent(item,track);return item;
  });
}
export function resetRaceOpponent(item,track) {
  resetAtCheckpoint(item,{mode:'race',track});
  Object.assign(item.pilot,{path:[],pathGate:-1,waypoint:0,stuck:0,lastPosition:[...item.state.position],planFailed:false,failedFor:0});
  if(item.gate===0&&item.lap===1)item.pilot.path=[item.state.position.map((v,i)=>i===1?v+.9:v)];
}

// Produces ordinary bounded sticks. It never writes pose, velocity, motors,
// battery or health. Angle mode is the same flight controller a player can use.
export function racePilotCommand(state,target,spec,map,skill=1,maxSpeed=12) {
  const delta=target.map((v,i)=>v-state.position[i]),horizontal=Math.hypot(delta[0],delta[2]);
  const fraction=Math.min(.8,maxSpeed*skill/Math.max(.001,Math.hypot(...delta)),2.5/Math.max(.001,Math.abs(delta[1])));
  const desired=delta.map(v=>v*fraction);
  const acceleration=desired.map((v,i)=>i===1?clamp((v-state.velocity[i])*3,-7,10):(v-state.velocity[i])*3);
  const horizontalAcceleration=Math.hypot(acceleration[0],acceleration[2]);
  if(horizontalAcceleration>5){acceleration[0]*=5/horizontalAcceleration;acceleration[2]*=5/horizontalAcceleration;}
  const forward=rotate(state.rotation,[0,0,1]),up=rotate(state.rotation,[0,1,0]),yaw=Math.atan2(forward[0],forward[2]),cos=Math.cos(yaw),sin=Math.sin(yaw);
  const gravity=GRAVITY*(map.gravity??1),vertical=Math.max(2,gravity+acceleration[1]);
  const native=nativeBatteryState(state,spec),voltage=native?native.rpm/spec.maxRpm:1-(1-state.battery)*.16;
  const input={
    pitch:clamp(Math.atan2(acceleration[0]*sin+acceleration[2]*cos,vertical)/(Math.PI/3),-.7,.7),
    roll:clamp(-Math.atan2(acceleration[0]*cos-acceleration[2]*sin,vertical)/(Math.PI/3),-.7,.7),
    yaw:horizontal>1?clamp(-wrap(Math.atan2(delta[0],delta[2])-yaw)*.18,-.35,.35):0,
    throttle:clamp(Math.pow(vertical/Math.max(.4,up[1])/GRAVITY/spec.thrustToWeight/Math.max(.1,voltage**2),1/1.85),0,1)
  };
  return {input,flightMode:'angle'};
}

export function advanceRaceOpponent(item,spec,map,track,obstacles,elapsed) {
  const pilot=item.pilot,state=item.state;
  spec=pilot.spec||spec;
  if(item.finishMs!==null){
    if(state.crashed){resetRaceOpponent(item,track);pilot.finishPosition=[...item.state.position];return;}
    simulateCommand(state,racePilotCommand(state,pilot.finishPosition,spec,map,pilot.skill),spec,map,track,obstacles,DEFAULT_FLIGHT_CONTROLLER);
    return;
  }
  if(elapsed<pilot.delay*1000){simulateCommand(state,{input:{throttle:0},flightMode:'angle'},spec,map,track,obstacles,DEFAULT_FLIGHT_CONTROLLER);return;}
  if(state.crashed){pilot.recoveries++;resetRaceOpponent(item,track);return;}
  if(!pilot.path.length||pilot.waypoint>=pilot.path.length) {
    pilot.path=continuousRoute(state.position,(pilot.navigation.prepared?pilot.navigation.preparedRoute(state.position,item.gate,item.gate===0&&item.lap===1):pilot.navigation.gateRoute(state.position,item.gate))||[],item);pilot.pathGate=item.gate;pilot.waypoint=0;
    if(!pilot.path.length){
      pilot.planFailed=true;
      simulateCommand(state,racePilotCommand(state,state.position,spec,map,pilot.skill),spec,map,track,obstacles,DEFAULT_FLIGHT_CONTROLLER);
      pilot.failedFor+=FIXED_DT;if(pilot.failedFor>8){pilot.recoveries++;resetRaceOpponent(item,track);}
      return;
    }
    pilot.planFailed=false;pilot.failedFor=0;
  }
  const target=pilot.path[pilot.waypoint];
  if(pilot.speedTarget!==target){
    pilot.speedTarget=target;
    // High-speed flight needs room for physical tracking error as attitude and
    // thrust settle. Keep the proven precision speed next to trees and frames.
    pilot.maxSpeed=pilot.navigation.clear(state.position,target,pilot.navigation.radius+1)?12:6;
  }
  // The planner reserves 6 cm beyond the aircraft. Match that tolerance at turns
  // so the next precomputed segment is reachable from the actual rigid body.
  const tolerance=pilot.pathGate===-1?.005:.06;
  if(distance(state.position,target)<tolerance&&Math.hypot(...state.velocity)<1.3)pilot.waypoint++;
  const old=[...state.position],command=racePilotCommand(state,target,spec,map,pilot.skill,pilot.maxSpeed);
  item.input=command.input;simulateCommand(state,command,spec,map,track,obstacles,DEFAULT_FLIGHT_CONTROLLER);
  if(state.crashed){pilot.recoveries++;resetRaceOpponent(item,track);return;}
  if(gateCrossed(old,state.position,track.gates[item.gate])) {
    item.gate++;if(item.gate>=track.gates.length){item.gate=0;item.lap++;}
    if(item.lap>track.laps){item.finishMs=Math.round(elapsed);pilot.finishPosition=[...pilot.path.at(-1)];}
    else if(pilot.navigation.prepared){
      const route=pilot.navigation.preparedRoute(state.position,item.gate);
      if(route?.length&&aligned(old,state.position,route[0])&&pilot.navigation.clear(state.position,route[0])){
        pilot.path=continuousRoute(state.position,route,item);pilot.pathGate=item.gate;pilot.waypoint=0;
      }
    }
  }
  pilot.stuck+=FIXED_DT;
  if(distance(state.position,pilot.lastPosition)>.5){pilot.lastPosition=[...state.position];pilot.stuck=0;}
  if(pilot.stuck>8){pilot.recoveries++;resetRaceOpponent(item,track);}
}
