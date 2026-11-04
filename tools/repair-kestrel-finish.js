import {readFileSync,writeFileSync,copyFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),folder=join(root,'content/drones/kestrel'),backup=join(root,'data/menu-qa/before-polish/kestrel'),prepared=join(root,'data/menu-qa/kestrel-finish');
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const run=(exe,args)=>{const r=spawnSync(exe,args,{cwd:root,stdio:'inherit',windowsHide:true});if(r.status!==0)throw new Error('Preparation failed: '+(r.error?.message||r.status));};
if(!process.argv.includes('--patch-only')){
  if(existsSync(backup)&&!process.argv.includes('--reuse-backup'))throw new Error('Verified backup already exists. Inspect it; use --patch-only to reuse completed preparation.');
  if(!existsSync(backup)){
    mkdirSync(backup,{recursive:true});const files=['kestrel.blend','hangar.glb','low.glb','far.glb','drone.json','SOURCE.json'];
    const manifest=files.map(file=>{copyFileSync(join(folder,file),join(backup,file));const hash=sha(join(folder,file));if(sha(join(backup,file))!==hash)throw new Error('Backup mismatch');return {file,sha256:hash};});
    writeFileSync(join(backup,'SHA256.json'),JSON.stringify(manifest,null,2));
  }
  for(const entry of JSON.parse(readFileSync(join(backup,'SHA256.json'))))if(sha(join(backup,entry.file))!==entry.sha256)throw new Error('Backup changed: '+entry.file);
  run('D:/Programs/Blender Foundation/Blender 5.1/blender.exe',['--background','--python-exit-code','1','--python','tools/blender/repair_kestrel_finish.py']);
}
const report=JSON.parse(readFileSync(join(prepared,'finish.json'))),images=[...new Set(Object.values(report).flat().map(v=>v.image))];
for(const name of images){const png=join(prepared,name),delivery=png+'.1024.png',ktx=png.replace('.png','.ktx2');await sharp(png).resize({width:1024,height:1024,fit:'inside'}).png().toFile(delivery);run(join(root,'tools/bin/ktx/portable/bin/toktx.exe'),['--t2','--encode','uastc','--genmipmap','--assign_oetf','srgb',ktx,delivery]);}
const pad=buffer=>Buffer.concat([buffer,Buffer.alloc((4-buffer.length%4)%4)]);
for(const file of ['hangar.glb','low.glb','far.glb']){
  // Start from the verified original delivery: no vertex, index, transform or LOD change.
  const bytes=readFileSync(join(backup,file)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length)),offset=20+length;
  let bin=bytes.subarray(offset+8,offset+8+bytes.readUInt32LE(offset));
  const textureCache=new Map(),materialCache=new Map();
  for(const node of json.nodes){
    const settings=report[node.name];if(!settings||node.mesh===undefined)continue;
    const mesh=structuredClone(json.meshes[node.mesh]);
    for(const primitive of mesh.primitives){
      const original=json.materials[primitive.material],setting=settings.find(s=>s.originalMaterial===original.name);if(!setting)throw new Error('Material binding changed: '+node.name);
      if(!textureCache.has(setting.image)){
        const image=readFileSync(join(prepared,setting.image.replace('.png','.ktx2'))),view=json.bufferViews.length;
        json.bufferViews.push({buffer:0,byteOffset:bin.length,byteLength:image.length});bin=Buffer.concat([bin,pad(image)]);
        const imageIndex=json.images.length;json.images.push({name:'Kestrel '+setting.role+' neutral finish',mimeType:'image/ktx2',bufferView:view});
        const texIndex=json.textures.length,oldTexture=json.textures[original.pbrMetallicRoughness.baseColorTexture.index];json.textures.push({sampler:oldTexture.sampler,extensions:{KHR_texture_basisu:{source:imageIndex}}});textureCache.set(setting.image,texIndex);
      }
      const key=setting.material;
      if(!materialCache.has(key)){const material=structuredClone(original);material.name=key;material.pbrMetallicRoughness.baseColorTexture.index=textureCache.get(setting.image);materialCache.set(key,json.materials.length);json.materials.push(material);}
      primitive.material=materialCache.get(key);
    }
    node.mesh=json.meshes.length;json.meshes.push(mesh);
  }
  json.buffers[0].byteLength=bin.length;
  let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);
  const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);bytes.copy(header,0,0,20);header.writeUInt32LE(28+text.length+bin.length,8);header.writeUInt32LE(text.length,12);binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  writeFileSync(join(folder,file),Buffer.concat([header,text,binHeader,bin]));
}
const definition=JSON.parse(readFileSync(join(folder,'drone.json')));
definition.colorBindings.body=Object.keys(report).filter(name=>report[name][0]?.role==='body');
definition.assetChanges+=' Neutral frame/lighting tint textures prepared in the editable Blender source; geometry and flight parameters retained.';
writeFileSync(join(folder,'drone.json'),JSON.stringify(definition,null,2)+'\n');
const source=JSON.parse(readFileSync(join(folder,'SOURCE.json')));source.changes=definition.assetChanges;source.finishPreparation='tools/blender/repair_kestrel_finish.py';writeFileSync(join(folder,'SOURCE.json'),JSON.stringify(source,null,2)+'\n');
console.log('Kestrel finish repaired: original geometry buffers preserved, Blender source saved.');
