import {collisionCandidates, sphereContacts, sweepSphere} from './collision.js';
import {gateCollisionBoxes} from './gates.js';
import {checkpointSpawn} from './flight-session.js';

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s);

// The planner and rigid bodies use the same authored colliders. A swept sphere
// reserves room for the whole tilted aircraft, rather than testing a centre ray.
export class RaceNavigation {
  constructor(map,track,obstacles,radius=.46) {
    this.map=map;this.track=track;this.radius=radius;
    this.obstacles=[...obstacles,...track.gates.flatMap(gateCollisionBoxes)];
    this.cache=new Map();this.queries=0;
    this.routes=new Map();this.recoveryRoutes=new Map();this.prepared=false;
  }
  clear(a,b,radius=this.radius) {
    this.queries++;
    if(Math.min(a[1],b[1])-radius<(this.map.floorY??0))return false;
    const middle=a.map((v,i)=>(v+b[i])/2);
    for(const collider of collisionCandidates(this.obstacles,middle,distance(a,b)/2+radius)) {
      if(sphereContacts(b,radius,collider).length||sweepSphere(a,b,radius,collider))return false;
    }
    return true;
  }
  path(from,to) {
    if(this.clear(from,to))return [to];
    // Local 3-D A*: bounded nodes and height, shared results for all competitors.
    // The grid is anchored to the destination so low gate approaches stay level.
    for(const cell of [2,1]) {
      const budget=cell===2?6000:9000,margin=24;
      const low=from.map((v,i)=>Math.min(v,to[i])-margin),high=from.map((v,i)=>Math.max(v,to[i])+margin);
      low[1]=Math.max((this.map.floorY??0)+this.radius,Math.min(from[1],to[1])-4);
      high[1]=Math.max(from[1],to[1])+12;
      const key=p=>p.join(','),world=p=>p.map((v,i)=>to[i]+v*cell);
      const origin=from.map((v,i)=>Math.round((v-to[i])/cell));
      const nodes=new Map(),open=[];
      const push=node=>{open.push(node);let i=open.length-1;while(i){const p=(i-1)>>1;if(open[p].f<=node.f)break;open[i]=open[p];i=p;}open[i]=node;};
      const pop=()=>{const first=open[0],last=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let c=i*2+1;if(c+1<open.length&&open[c+1].f<open[c].f)c++;if(last.f<=open[c].f)break;open[i]=open[c];i=c;}open[i]=last;}return first;};
      const start={grid:origin,p:[...from],g:0,f:distance(from,to),parent:null};nodes.set(key(origin),start);push(start);
      let found=null,expanded=0;
      while(open.length&&expanded++<budget) {
        const node=pop();if(node.closed)continue;node.closed=true;
        if(distance(node.p,to)<cell*2&&this.clear(node.p,to)){found={p:to,parent:node};break;}
        for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++) {
          if(!x&&!y&&!z)continue;
          const grid=add(node.grid,[x,y,z]),id=key(grid),prior=nodes.get(id);if(prior?.closed)continue;
          const p=world(grid);if(p.some((v,i)=>v<low[i]||v>high[i]))continue;
          const cost=node.g+cell*Math.hypot(x,y,z);if(prior&&prior.g<=cost)continue;
          if(!this.clear(node.p,p))continue;
          const next={grid,p,g:cost,f:cost+distance(p,to)*1.08,parent:node};nodes.set(id,next);push(next);
        }
      }
      if(found) {
        const raw=[];for(let n=found;n?.parent;n=n.parent)raw.unshift(n.p);
        const result=[];let start=from,index=0;
        while(index<raw.length){let end=index;while(end+1<raw.length&&this.clear(start,raw[end+1]))end++;result.push(raw[end]);start=raw[end];index=end+1;}
        return result;
      }
    }
    return null;
  }
  gateRoute(from,index) {
    const key=index+':'+from.map(v=>Math.round(v/2)).join(',');
    const cached=this.cache.get(key);if(cached&&this.clear(from,cached[0]))return cached;
    const gate=this.track.gates[index],normal=gate.axes?.normal||[Math.sin(gate.yaw),0,Math.cos(gate.yaw)];
    const right=gate.axes?.right||[Math.cos(gate.yaw),0,-Math.sin(gate.yaw)],up=gate.axes?.up||[0,1,0];
    // Authored centres can overlap signs/stands. Search only inside the legal
    // aperture; gateCrossed remains the sole authority for awarding progress.
    const offsets=[[0,0],[0,.25],[0,-.25],[.25,0],[-.25,0],[0,.65],[0,-.65],[.6,0],[-.6,0],[.6,.6],[-.6,.6]];
    for(const y of [0,.3,-.3,.6,-.6,.85,-.85,1,-1])for(const x of [0,.3,-.3,.6,-.6,.85,-.85,1,-1])offsets.push([x,y]);
    for(const [x,y] of offsets) {
      const centre=add(add(gate.position,right,x*Math.max(0,gate.width/2-this.radius)),up,y*Math.max(0,gate.height/2-this.radius));
      if(gate.aperture==='ellipse'&&((x*Math.max(0,gate.width/2-this.radius)/(gate.width/2))**2+(y*Math.max(0,gate.height/2-this.radius)/(gate.height/2))**2>=1))continue;
      // Nearby scenery can block the usual long exit while leaving the authored
      // opening clear. Reserve the same aircraft radius along shorter approaches.
      for(const approach of [2,1,.65])for(const departure of [1.5,1,.65]){
        const before=add(centre,normal,-approach),after=add(centre,normal,departure);
        if(!this.clear(before,after))continue;
        const route=this.path(from,before);if(route){const result=[...route,after];if(this.cache.size<128)this.cache.set(key,result);return result;}
      }
    }
    return null;
  }
  async prepare(spawn,yieldFrame=async()=>{}) {
    this.recoveryRoutes.clear();
    const prepareRecovery=(index,route)=>{
      if(!route?.length)return;
      const reset=checkpointSpawn(this.track,index,index===0?2:1).position;
      for(let i=0;i<route.length-1;i++)if(this.clear(reset,route[i]))return;
      // A legal checkpoint reset can be on the other side of a frame from the
      // normal exit. Prepare that short detour now, never inside the flight tick.
      const join=this.path(reset,route[0]);
      if(join)this.recoveryRoutes.set(index,[...join,...route.slice(1)]);
    };
    let from=spawn.map((v,i)=>i===1?v+.9:v);
    for(let index=0;index<this.track.gates.length;index++) {
      const route=this.gateRoute(from,index);this.routes.set(index,route);
      if(index===0)this.routes.set('start',route);
      if(route)from=route.at(-1);
      if(index>0)prepareRecovery(index,route);
      await yieldFrame();
    }
    if(this.track.laps>1){this.routes.set(0,this.gateRoute(from,0));prepareRecovery(0,this.routes.get(0));}
    this.prepared=true;
  }
  preparedRoute(from,index,initial=false) {
    const route=this.routes.get(initial?'start':index);
    if(!route)return null;
    // Reset checkpoints are 20 cm before the normal path exit. Find the first
    // reachable navigation waypoint, while always retaining the gate approach.
    for(const candidate of [route,...(initial?[]:[this.recoveryRoutes.get(index)])]){
      if(!candidate)continue;
      for(let i=0;i<candidate.length-1;i++)if(this.clear(from,candidate[i]))return candidate.slice(i);
    }
    return null;
  }
}
