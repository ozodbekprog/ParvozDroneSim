// CPU inspection of the actual GLB loader hierarchy; textures are omitted only here.
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Box3, Sphere } from 'three';
export async function readGeometry(file) {
  const bytes=readFileSync(file), oldLength=bytes.readUInt32LE(12);
  const json=JSON.parse(bytes.subarray(20,20+oldLength));
  delete json.images; delete json.textures; delete json.samplers;
  json.extensionsRequired=json.extensionsRequired?.filter(name=>name!=='KHR_texture_basisu');
  for(const material of json.materials || []) {
    for(const key of Object.keys(material))if(key.endsWith('Texture'))delete material[key];
    for(const key of Object.keys(material.pbrMetallicRoughness || {}))if(key.endsWith('Texture'))delete material.pbrMetallicRoughness[key];
  }
  let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);
  const bin=bytes.subarray(20+oldLength), header=Buffer.alloc(20);
  bytes.copy(header,0,0,20);header.writeUInt32LE(20+text.length+bin.length,8);header.writeUInt32LE(text.length,12);
  const glb=Buffer.concat([header,text,bin]);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.length),'');
}
if(process.argv[1]?.endsWith('inspect-drone-runtime.js')) {
  const gltf=await readGeometry('content/drones/kestrel/hangar.glb');
  const definition=JSON.parse(readFileSync('content/drones/kestrel/drone.json'));
  const matches=name=>gltf.scenes.flatMap(s=>{const a=[];s.traverse(n=>{if(n.name===name)a.push(n);});return a;});
  console.log('Bindings',Object.values(definition.mounts).flat().concat(Object.values(definition.colorBindings).flat()).map(name=>[name,matches(name).length]));
  for(const scene of gltf.scenes){scene.updateMatrixWorld(true);console.log(scene.name,new Box3().setFromObject(scene).getBoundingSphere(new Sphere()));}
}
