import {SRGBColorSpace,NoColorSpace,RepeatWrapping} from 'three';
import {MeshStandardNodeMaterial} from 'three/webgpu';
import {texture,positionWorld,vec2,vec3,float,normalMap} from 'three/tsl';
import {loadTexture} from './asset-loader.js';
import {registerMaterialResources} from './material-resources.js';
import {registerSceneryMaterial} from './scenery-batches.js';

/** Restore native terrain splat painting without baking metre-sized tiles into
 * a 94 m patch image. World UVs also remain continuous across patches and LODs. */
export async function installNativeTerrain(root,config,{load=loadTexture}={}){
 if(!config)return null;
 const textures=[],alpha=[],colors=[],normals=[];
 const get=(url,color=false,tiled=false)=>{
  const map=load(url);textures.push(map);map.colorSpace=color?SRGBColorSpace:NoColorSpace;map.name=url;
  if(tiled){map.wrapS=map.wrapT=RepeatWrapping;map.anisotropy=16;}
  return map;
 };
 for(const url of config.alpha)alpha.push(get(url));
 for(const layer of config.layers){colors.push(get(layer.diffuse,true,true));normals.push(get(layer.normal,false,true));}
 try{await Promise.all(textures.map(map=>map.assetsReady));}catch(error){for(const map of textures)map.dispose();throw error;}
 if(root.userData.disposed){for(const map of textures)map.dispose();return null;}
 const sourceUV=vec2(positionWorld.x.mul(config.worldScale[0]),positionWorld.z.mul(config.worldScale[1])).sub(vec2(...config.origin));
 const paintUV=sourceUV.div(vec2(...config.size)),masks=alpha.map(map=>texture(map,paintUV));
 const weights=config.layers.map((_,i)=>masks[Math.floor(i/4)][['r','g','b','a'][i%4]]);
 let color=vec3(0),normal=vec3(0),total=float(0),roughness=float(0),metalness=float(0);
 for(const [i,layer] of config.layers.entries()){
  const uv=sourceUV.add(vec2(...layer.offset)).div(vec2(...layer.tile)),weight=weights[i];
  color=color.add(texture(colors[i],uv).rgb.mul(weight));total=total.add(weight);
  const encoded=texture(normals[i],uv).rgb.mul(2).sub(1);
  normal=normal.add(vec3(encoded.xy.mul(layer.normalScale),encoded.z).mul(weight));
  roughness=roughness.add(weight.mul(layer.roughness));metalness=metalness.add(weight.mul(layer.metalness));
 }
 const material=new MeshStandardNodeMaterial();material.name='Native tiled terrain';
 material.colorNode=color.div(total.max(.001));material.roughnessNode=roughness.div(total.max(.001));material.metalnessNode=metalness.div(total.max(.001));
 // Patch UV0 points towards -Z; native layer V points towards +Z.
 const detailNormal=normalMap(normal.normalize().mul(.5).add(.5),vec2(1,-1));
 registerMaterialResources(material,{textures,unscaled:new Set(alpha),applySettings(settings){
  const next=settings.normalMaps===false?null:detailNormal;
  if(material.normalNode!==next){material.normalNode=next;material.needsUpdate=true;}
 }});
 registerSceneryMaterial(material);
 let meshes=0;const old=new Set();
 root.traverse(object=>{if(object.isMesh&&!Array.isArray(object.material)&&object.material?.name.startsWith(config.materialPrefix)){
  old.add(object.material);object.material=material;object.castShadow=false;meshes++;
 }});
 // Old maps belong to the retained source GLB, but cloned materials are ours.
 for(const previous of old)previous.dispose();
 if(!meshes){material.dispose();for(const map of textures)map.dispose();throw Error('Native terrain meshes are missing');}
 return {meshes,material,textures};
}
