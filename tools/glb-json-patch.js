// Preserve compressed geometry/texture payloads while repairing scene metadata.
export function readGlb(bytes){
  if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB');
  let json,bin;
  for(let offset=12;offset<bytes.length;){
    const size=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
    if(size%4||offset+8+size>bytes.length)throw Error('Truncated GLB');
    const data=bytes.subarray(offset+8,offset+8+size);
    if(type===0x4e4f534a)json=JSON.parse(data.toString('utf8'));
    else if(type===0x004e4942)bin=data;
    else throw Error('Unexpected GLB chunk');
    offset+=8+size;
  }
  if(!json||!bin)throw Error('Expected JSON and binary GLB chunks');
  return {json,bin};
}
const pad=(bytes,value=0)=>Buffer.concat([bytes,Buffer.alloc((4-bytes.length%4)%4,value)]);
export function writeGlb({json,bin}){
  const metadata=pad(Buffer.from(JSON.stringify(json)),0x20),binary=pad(bin),header=Buffer.alloc(12),a=Buffer.alloc(8),b=Buffer.alloc(8);
  header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+metadata.length+binary.length,8);
  a.writeUInt32LE(metadata.length);a.writeUInt32LE(0x4e4f534a,4);b.writeUInt32LE(binary.length);b.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,a,metadata,b,binary]);
}
export function appendGlbImage(document,bytes,{name,mimeType='image/ktx2',sampler=0}={}){
  const {json}=document;document.bin=pad(document.bin);
  const view=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:document.bin.length,byteLength:bytes.length});
  document.bin=Buffer.concat([document.bin,bytes]);json.buffers[0].byteLength=document.bin.length;
  const source=json.images.length;json.images.push({name,mimeType,bufferView:view});
  const index=json.textures.length;
  json.textures.push(mimeType==='image/ktx2'?{sampler,extensions:{KHR_texture_basisu:{source}}}:{sampler,source});
  if(mimeType==='image/ktx2'){
    json.extensionsUsed=[...new Set([...(json.extensionsUsed||[]),'KHR_texture_basisu'])];
    json.extensionsRequired=[...new Set([...(json.extensionsRequired||[]),'KHR_texture_basisu'])];
  }
  return index;
}

/** Drop orphaned image payloads without transcoding any retained resource. */
export function pruneGlbImages(document){
  const {json,bin}=document,textureInfos=[],oldImageCount=json.images?.length||0;
  function infos(value){
    if(!value||typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){
      if(/texture$/i.test(key)&&child&&Number.isInteger(child.index))textureInfos.push(child);
      else if(key!=='extras')infos(child);
    }
  }
  for(const material of json.materials||[])infos(material);
  const usedTextures=new Set(textureInfos.map(info=>info.index)),textureMap=new Map();
  const textures=(json.textures||[]).filter((_,i)=>{if(!usedTextures.has(i))return false;textureMap.set(i,textureMap.size);return true;});
  for(const info of textureInfos)info.index=textureMap.get(info.index);
  const usedImages=new Set();
  for(const texture of textures){
    if(texture.source!==undefined)usedImages.add(texture.source);
    for(const extension of Object.values(texture.extensions||{}))if(extension.source!==undefined)usedImages.add(extension.source);
  }
  const imageMap=new Map(),removedViews=new Set(),retainedViews=new Set();
  const images=(json.images||[]).filter((image,i)=>{
    if(!usedImages.has(i)){if(image.bufferView!==undefined)removedViews.add(image.bufferView);return false;}
    imageMap.set(i,imageMap.size);if(image.bufferView!==undefined)retainedViews.add(image.bufferView);return true;
  });
  for(const texture of textures){
    if(texture.source!==undefined)texture.source=imageMap.get(texture.source);
    for(const extension of Object.values(texture.extensions||{}))if(extension.source!==undefined)extension.source=imageMap.get(extension.source);
  }
  // A shared image view can also serve another image or a geometry accessor.
  const findViews=value=>{
    if(!value||typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){
      if(key==='bufferView'&&Number.isInteger(child))retainedViews.add(child);
      else if(key!=='extras')findViews(child);
    }
  };
  for(const [key,value] of Object.entries(json))if(!['images','bufferViews','extras'].includes(key))findViews(value);
  const views=[],viewMap=new Map();
  for(let i=0;i<json.bufferViews.length;i++)if(!removedViews.has(i)||retainedViews.has(i)){viewMap.set(i,views.length);views.push(json.bufferViews[i]);}
  const remap=value=>{
    if(!value||typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){
      if(key==='bufferView'&&Number.isInteger(child)){
        if(!viewMap.has(child))throw Error('Cannot prune a referenced GLB view');value[key]=viewMap.get(child);
      }else if(key!=='extras')remap(child);
    }
  };
  json.images=images;json.textures=textures;json.bufferViews=views;remap(json);
  const chunks=[],segments=new Map();let length=0;
  const copy=(offset,size)=>{
    const key=offset+':'+size;if(segments.has(key))return segments.get(key);
    if(offset<0||offset+size>bin.length)throw Error('GLB view exceeds its binary buffer');
    const aligned=(length+3)&~3;if(aligned>length)chunks.push(Buffer.alloc(aligned-length));
    const destination=aligned;chunks.push(bin.subarray(offset,offset+size));length=aligned+size;segments.set(key,destination);return destination;
  };
  for(const view of views){
    if((view.buffer??0)===0)view.byteOffset=copy(view.byteOffset||0,view.byteLength);
    for(const key of ['EXT_meshopt_compression','KHR_meshopt_compression']){
      const ext=view.extensions?.[key];
      if(ext&&(ext.buffer??0)===0)ext.byteOffset=copy(ext.byteOffset||0,ext.byteLength);
    }
  }
  document.bin=Buffer.concat(chunks);json.buffers[0].byteLength=document.bin.length;
  return {removedImages:oldImageCount-images.length,bytesBefore:bin.length,bytesAfter:document.bin.length};
}

export function stripMapProxyMaterials(json,materialNames,definitions,{rebuildMaterialNames=[]}={}){
  const materials=new Set(json.materials.map((m,i)=>materialNames.includes(m.name)?i:-1).filter(i=>i>=0));
  const rebuild=new Set(json.materials.map((m,i)=>[...materialNames,...rebuildMaterialNames].includes(m.name)?i:-1).filter(i=>i>=0));
  const byName=new Map(json.nodes.map((n,i)=>[n.name,i]));
  const contains=(index)=>{
    const node=json.nodes[index];
    return node.mesh!==undefined&&json.meshes[node.mesh].primitives.some(p=>rebuild.has(p.material))||(node.children||[]).some(contains);
  };
  const affected=definitions.filter(d=>d.modelLods?.length===3&&d.modelLods.slice(0,2).some(l=>contains(byName.get(l.modelNode))));
  const replacement=new Map();let removedPrimitives=0;
  for(const node of json.nodes){
    if(node.mesh===undefined)continue;
    const index=node.mesh;
    if(!replacement.has(index)){
      const mesh=json.meshes[index],primitives=mesh.primitives.filter(p=>!materials.has(p.material));
      removedPrimitives+=mesh.primitives.length-primitives.length;
      if(primitives.length===mesh.primitives.length)replacement.set(index,index);
      else if(primitives.length){replacement.set(index,json.meshes.length);json.meshes.push({...mesh,primitives});}
      else replacement.set(index,null);
    }
    const next=replacement.get(index);if(next===null)delete node.mesh;else node.mesh=next;
  }
  const cloneNode=index=>{
    const node=structuredClone(json.nodes[index]);node.name='Repaired distance '+(node.name||index);
    if(node.children)node.children=node.children.map(cloneNode);
    const result=json.nodes.length;json.nodes.push(node);return result;
  };
  // Far proxy surfaces were baked into shared vertex-color meshes. Reuse the
  // intact textured low geometry in only the affected cells instead of deleting
  // arbitrary triangles from those combined meshes or rebuilding whole maps.
  for(const definition of affected){
    const low=json.nodes[byName.get(definition.modelLods[1].modelNode)],far=json.nodes[byName.get(definition.modelLods[2].modelNode)];
    delete far.mesh;far.children=(low.children||[]).map(cloneNode);
  }
  return {removedPrimitives,repairedDistanceCells:affected.length};
}
