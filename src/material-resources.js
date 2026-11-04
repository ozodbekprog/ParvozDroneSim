// Node graphs do not expose their texture dependencies as ordinary map fields.
const registrations=new WeakMap();
export function registerMaterialResources(material,resources){registrations.set(material,resources);}
export function materialResources(material){return registrations.get(material);}
export function materialTextures(material){
 return new Set([...Object.values(material).filter(value=>value?.isTexture),...(registrations.get(material)?.textures||[])]);
}
