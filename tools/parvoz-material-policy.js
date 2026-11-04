import policy from '../content/shared-assets/parvoz-neutral-surfaces/policy.json' with {type:'json'};
export function neutralMaterialKind(name=''){
  if(policy.clothPrefixes.some(prefix=>name.toLowerCase().startsWith(prefix.toLowerCase()))||policy.clothNames.includes(name))return 'cloth';
  if(policy.displayNames.includes(name))return 'display';
  if(policy.plaqueNames.includes(name))return 'plaque';
  return null;
}
export function neutralizeMaterial(material,texture){
  const kind=neutralMaterialKind(material.name);if(!kind)return false;
  const pbr=material.pbrMetallicRoughness||={};
  const alpha=pbr.baseColorFactor?.[3]??1;
  pbr.metallicFactor=kind==='plaque'?.1:0;pbr.roughnessFactor=kind==='cloth'?.9:.75;
  if(kind==='cloth'){
    pbr.baseColorTexture={index:texture};
    const tint=/Dark|Black|InflatableArchBrandless/i.test(material.name)?.11:.88;pbr.baseColorFactor=[tint,tint,tint,alpha];
  }else {delete pbr.baseColorTexture;pbr.baseColorFactor=kind==='display'?[.035,.045,.055,alpha]:[.24,.25,.26,alpha];}
  // Artwork can also be embossed into normal/AO or printed into emissive maps.
  for(const key of ['normalTexture','occlusionTexture','emissiveTexture'])delete material[key];
  delete pbr.metallicRoughnessTexture;
  material.emissiveFactor=[0,0,0];
  material.extras={...material.extras,parvozBrandingRemoved:true};
  return true;
}
