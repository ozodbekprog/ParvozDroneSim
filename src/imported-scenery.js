/** Native Unity editor markers were baked into several delivered environments. */
export function isImportedSceneryMarker(name='') {
  return /^(?:(?:Low|Far)\s+)?(?:Runtime|Repeated)\s+(?:PlayerDummy|DroneDummy|PowerBox|CombinedCharacter)/i.test(name);
}
export function suppressImportedSceneryMarkers(root){
  root.traverse(object=>{if(isImportedSceneryMarker(object.name)){object.visible=false;object.userData.excludedSceneryMarker=true;}});
}
