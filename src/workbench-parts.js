import {isPartCompatible} from '../shared/part-compatibility.js';
/** Offer mounted components, applying imported native frame rules to saved parts too. */
export function workbenchParts(build, drone, category, parts) {
  if(drone.customization)return parts.filter(part=>isPartCompatible(drone,category,part)&&(part.model||part.id===drone.stockParts?.[category]));
  if(!drone.mounts?.[category])return drone.mounts?parts.filter(part=>part.id===build[category]):parts;
  return parts.filter(part=>part.id===build[category] || part.model && (!part.compatibleDrones || part.compatibleDrones.includes(drone.id)));
}

export function partAppearanceNote(part, category, drone) {
  if(category==='antenna'&&part.sourcePartId==='AntennaBlank')return 'The airframe uses an integrated antenna.';
  if(category==='antenna'&&!part.model)return 'Fixed by the airframe';
  if(part.sourceSpecs)return category==='frame'?'Fixed airframe. Motors, propellers, battery and camera can be changed.':'Native component geometry. Hardware changes affect flight; colors do not.';
  if(!drone.mounts?.[category])return '';
  if(!part.model)return 'Legacy part · standard appearance';
  if(category==='propellers')return part.visualVariant==='HUNTER'?'Two-blade propeller':'Three-blade propeller';
  return `${part.visualVariant==='HUNTER'?'Alternate':'Standard'} ${category==='battery'?'battery wrap':category==='frame'?'frame finish':category==='motors'?'motor finish':'camera finish'}`;
}
