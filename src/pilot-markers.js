import {Vector3} from 'three';
const point=new Vector3(),eye=new Vector3();

export function projectPilotMarker(position,camera,width,height){
  point.set(...position);point.y+=.22;camera.getWorldPosition(eye);
  const distance=eye.distanceTo(point);if(distance>Math.min(220,camera.far))return null;
  point.project(camera);
  if(point.z < -1 || point.z > 1 || Math.abs(point.x)>.98 || Math.abs(point.y)>.96)return null;
  return {x:(point.x+1)*width/2,y:(1-point.y)*height/2,opacity:Math.max(.26,.64-distance*.002)};
}

/** DOM labels stay above the scene; no geometry, depth write or mouse capture. */
export class PilotMarkers {
  constructor(container){
    this.root=document.createElement('div');this.root.className='pilot-markers';this.root.hidden=true;
    this.root.setAttribute('aria-label','Other pilots');container.append(this.root);this.items=new Map();
  }
  update(world,players,ownId,active){
    this.root.hidden=!active;if(!active)return;
    const current=new Set(),width=this.root.clientWidth,height=this.root.clientHeight;
    for(const player of players){
      if(player.id===ownId || player.id===world.activeDroneId)continue;
      const drone=world.drones.get(player.id);if(!drone)continue;current.add(player.id);
      let element=this.items.get(player.id);
      if(!element){element=document.createElement('span');element.className='pilot-marker';this.items.set(player.id,element);this.root.append(element);}
      if(element.dataset.name!==player.name){element.dataset.name=player.name;element.textContent='◇ '+player.name;element.title=player.name;}
      const location=drone.visualPosition?.toArray()||drone.state?.position;
      const marker=location&&projectPilotMarker(location,world.camera,width,height);
      element.hidden=!marker;
      if(marker){element.style.transform=`translate3d(${marker.x}px,${marker.y}px,0) translate(-50%,-100%)`;element.style.opacity=marker.opacity;}
    }
    for(const [id,element] of this.items)if(!current.has(id)){element.remove();this.items.delete(id);}
  }
}
