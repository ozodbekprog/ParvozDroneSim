export function sceneDrawDistance(map,graphics){
 const full=Math.max(1500,map?.bounds?Math.hypot(...map.bounds.max.map((v,i)=>v-map.bounds.min[i]))*1.3:1500);
 return graphics.lodMinimum===1||graphics.quality==='low'?Math.min(full,180):full;
}
