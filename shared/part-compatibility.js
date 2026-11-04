/** Native rules apply to menu choices, saved builds, physics and race hardware alike. */
export function isPartCompatible(drone,category,part){
  if(!part||!drone)return false;
  if(part.compatibleDrones&&!part.compatibleDrones.includes(drone.id))return false;
  const config=drone.customization;
  if(!config)return true;
  const sourceId=part.sourcePartId;
  // Imported airframes cannot silently accept unmounted generic legacy components.
  if(!sourceId)return false;
  for(const slot of config.slots?.[category]||[])if(slot.overridePart&&slot.overridePart!==sourceId)return false;
  return (config.rules||[]).filter(rule=>rule.category===category).every(rule=>{
    if(rule.allowBlank&&sourceId==='ActionCamBlank')return true;
    switch(rule.operation){
      case 'allow':return rule.sourcePartIds.includes(sourceId);
      case 'exclude':return !rule.sourcePartIds.includes(sourceId);
      case 'maxDiameter':return Number.isFinite(part.sourceSpecs?.diameter)&&part.sourceSpecs.diameter<=rule.value;
      case 'minDiameter':return Number.isFinite(part.sourceSpecs?.diameter)&&part.sourceSpecs.diameter>=rule.value;
      case 'hasMount':return !!part.sourceSpecs?.hasMount===rule.value;
      case 'isAngled':return !!part.sourceSpecs?.isAngled===rule.value;
      default:return false;
    }
  });
}

export function canUseActionCamera(){
  // Product decision, 2026-10-19: no separate HD camera on any aircraft.
  // Keep the recovered native compatibility and art for provenance/restoration.
  return false;
}
