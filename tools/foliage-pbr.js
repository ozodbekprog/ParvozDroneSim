import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';
/** Unity's optimized tree/AFS maps explicitly store tangent normal X in A,
 * Y in G. Tree gloss is separate A; AFS smoothness is B (verified shader label).
 * Specular/translucency are not relabelled as AO or metalness. */
export function unpackFoliageNormal(pixels){
 const output=new Uint8Array(pixels.length);
 for(let i=0;i<pixels.length;i+=4){const x=pixels[i+3]/127.5-1,y=pixels[i+1]/127.5-1,z=Math.sqrt(Math.max(0,1-x*x-y*y));output[i]=pixels[i+3];output[i+1]=pixels[i+1];output[i+2]=Math.round(z*127.5+127.5);output[i+3]=255;}
 return output;
}
export function foliageRoughness(pixels,{channel=3,gain=1}={}){
 const output=new Uint8Array(pixels.length);
 for(let i=0;i<pixels.length;i+=4){output[i]=255;output[i+1]=Math.round(255*(1-Math.max(0,Math.min(1,pixels[i+channel]/255*gain))));output[i+2]=0;output[i+3]=255;}
 return output;
}
export async function prepareFoliagePBR(folder,output){
 const recovery=JSON.parse(readFileSync(join(folder,'foliage-pbr/recovery.json'),'utf8')),materials=new Map(),images=new Map();mkdirSync(output,{recursive:true});
 for(const texture of recovery.textures)for(const material of texture.materials){
  let row=materials.get(material.materialKey);if(!row){row={key:material.materialKey,name:material.name,shader:material.shader};materials.set(row.key,row);}
  const kind=material.slot==='_TranslucencyMap'?'roughness':'normal',identity=texture.id+'-'+kind;
  if(!images.has(identity)){
   const image=await sharp(join(folder,'foliage-pbr',texture.file)).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const data=kind==='normal'?unpackFoliageNormal(image.data):foliageRoughness(image.data),file=identity+'.png';await sharp(data,{raw:image.info}).png().toFile(join(output,file));images.set(identity,file);
  }
  row[kind]=images.get(identity);row.environment=material.environment;
  if(material.slot==='_BumpTransSpecMap'){
   const image=await sharp(join(folder,'foliage-pbr',texture.file)).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true}),file=texture.id+'-roughness.png';
   await sharp(foliageRoughness(image.data,{channel:2}),{raw:image.info}).png().toFile(join(output,file));row.roughness=file;
  }
 }
 const result={source:'Original installed Liftoff textures; no redistribution license established.',permissionConfirmed:false,maximumSize:512,normalPacking:'A=X, G=Y; reconstructed positive Z. Source image orientation retained.',roughness:'Tree translucency alpha gloss / AFS packed blue smoothness converted to 1 - smoothness; dielectric metalness 0.',limitations:'Source colored specular, translucency and animated wind remain approximations. No fabricated AO map is generated.',materials:[...materials.values()]};
 writeFileSync(join(output,'materials.json'),JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const [folder,output]=process.argv.slice(2);const result=await prepareFoliagePBR(folder,output);console.log(JSON.stringify({materials:result.materials.length,output}));}
