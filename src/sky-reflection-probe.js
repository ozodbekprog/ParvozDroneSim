import {Scene,Color,Vector3} from 'three';

/** A distant outdoor lighting probe needs sky/ground radiance, not six renders
 * of an entire forest. Nearby occlusion and sun shadows remain in the main
 * renderer. Indoors continue to capture the authored environment. */
export function skyReflectionProbe(sky,ground){
 if(!sky)return null;
 const scene=new Scene(),dome=sky.clone(false);dome.geometry=sky.geometry.clone();dome.material=sky.material.clone();
 dome.position.set(0,0,0);dome.quaternion.identity();dome.scale.setScalar(1);dome.frustumCulled=false;
 const positions=dome.geometry.attributes.position,colors=dome.geometry.attributes.color;
 const radius=sky.geometry.parameters.radius,bottom=new Color(ground).multiplyScalar(.5),color=new Color();
 if(colors)for(let i=0;i<colors.count;i++){
  color.fromBufferAttribute(colors,i).lerp(bottom,Math.max(0,Math.min(1,-positions.getY(i)/radius*4)));
  colors.setXYZ(i,color.r,color.g,color.b);
 }
 scene.add(dome);
 return {scene,position:new Vector3(),far:radius*1.1,dispose:()=>{dome.geometry.dispose();dome.material.dispose();scene.clear();}};
}
