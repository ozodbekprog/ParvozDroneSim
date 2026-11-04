/** Menus may reuse a loaded world, but opening settings must not download one. */
export function menuPresentation(world,mapId){
 return world.canReuseEnvironment(mapId)?'retained':'poster';
}
