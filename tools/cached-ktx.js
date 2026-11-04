import{createHash}from'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
function glb(bytes){const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim()),offset=20+bytes.readUInt32LE(12)+8;return{json,image(texture){const index=texture.extensions?.KHR_texture_basisu?.source??texture.source,v=json.bufferViews[json.images[index].bufferView];return bytes.subarray(offset+(v.byteOffset||0),offset+(v.byteOffset||0)+v.byteLength);}};}
const slots=m=>({BaseColor:m.pbrMetallicRoughness?.baseColorTexture,Normal:m.normalTexture,MetallicRoughness:m.pbrMetallicRoughness?.metallicRoughnessTexture,Occlusion:m.occlusionTexture,Emissive:m.emissiveTexture});
export function cachedKtx(prepared,compressed){
 const a=glb(prepared),b=glb(compressed),output=new Map(),materials=new Map(b.json.materials.map(m=>[m.name,m]));
 for(const m of a.json.materials)for(const[slot,t]of Object.entries(slots(m))){const encoded=slots(materials.get(m.name)||{})[slot];if(!t||!encoded)continue;const tex=b.json.textures[encoded.index];if(!tex.extensions?.KHR_texture_basisu)continue;output.set(m.name+':'+slot+':'+hash(a.image(a.json.textures[t.index])),b.image(tex));}
 return output;
}
export const textureFingerprint=hash;
