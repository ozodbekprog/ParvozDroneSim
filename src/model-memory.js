/** Conservative retained CPU + GPU payload estimate, deduplicated within a GLTF. */
export function modelMemoryBytes(gltf) {
  const arrays=new Set(),images=new Set();let bytes=0;
  const array=value=>{const buffer=value?.array?.buffer;if(buffer&&!arrays.has(buffer)){arrays.add(buffer);bytes+=buffer.byteLength*2;}};
  for(const scene of gltf.scenes||[gltf.scene])scene?.traverse(object=>{
    for(const attribute of Object.values(object.geometry?.attributes||{}))array(attribute);
    array(object.geometry?.index);
    for(const attributes of Object.values(object.geometry?.morphAttributes||{}))for(const attribute of attributes)array(attribute);
    for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)for(const texture of Object.values(material))if(texture?.isTexture){
      const mipmaps=Array.isArray(texture.mipmaps)&&texture.mipmaps.length?texture.mipmaps:null;
      const mipBytes=mipmaps?mipmaps.reduce((sum,mip)=>sum+(mip?.data?.byteLength||0),0):0;
      if(mipBytes>0){
        const token=texture.source||mipmaps;if(images.has(token))continue;images.add(token);
        bytes+=mipBytes*2;continue;
      }
      const image=texture.source?.data||texture.image;if(!image||images.has(image))continue;images.add(image);
      bytes+=Math.ceil((image.width||1)*(image.height||1)*8*4/3);
    }
  });
  return Math.max(bytes,1024);
}

export function idleModelBudget(memoryGB) {
  const gb=memoryGB===undefined&&Number(globalThis.navigator?.hardwareConcurrency)>=8?8:Number(memoryGB);
  return (gb>8?160:gb>4?96:48)*1024*1024;
}
