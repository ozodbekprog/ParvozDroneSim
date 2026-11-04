// Reuses the cached Pine Valley recovery; never scans or reimports the game.
import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source='data/liftoff-pine-valley-recovery/',folder='content/maps/liftoff-pine-valley-demo/',target=folder+'native-terrain/';
const parse=file=>JSON.parse(readFileSync(source+file,'utf8').replace(/("m_PathID"\s*:\s*)(-?\d+)/g,'$1"$2"'));
const terrain=parse('terrain/source-0.json'),layers=parse('terrain/source-layers.json'),resources=parse('browser-resources.json');
const read=file=>JSON.parse(readFileSync(file,'utf8')),write=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n');
mkdirSync(target,{recursive:true});
const records=[];
function texture(pointer){
 const record=resources.textures.find(item=>item.key.endsWith(':'+pointer.m_PathID));
 if(!record)throw Error('Missing native terrain texture '+pointer.m_PathID);
 const name=record.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png';
 copyFileSync(source+record.file,target+name);
 records.push({name:record.name,sourceId:pointer.m_PathID,file:name,sha256:createHash('sha256').update(readFileSync(target+name)).digest('hex')});
 return 'native-terrain/'+name;
}
const data=terrain.data,config={materialPrefix:'TerrainSurface_0_',origin:[0,0],worldScale:[-1,1],size:[(data.m_Heightmap.m_Resolution-1)*data.m_Heightmap.m_Scale.m_X,(data.m_Heightmap.m_Resolution-1)*data.m_Heightmap.m_Scale.m_Z],alpha:data.m_SplatDatabase.m_AlphaTextures.map(texture),layers:[]};
for(const reference of data.m_SplatDatabase.m_TerrainLayers){
 const layer=layers[reference.m_PathID].data;
 if(layer.m_MaskMapTexture?.m_PathID!=='0')throw Error('Native mask adaptation is required');
 config.layers.push({name:layer.m_Name,diffuse:texture(layer.m_DiffuseTexture),normal:texture(layer.m_NormalMapTexture),tile:[layer.m_TileSize.x,layer.m_TileSize.y],offset:[layer.m_TileOffset.x,layer.m_TileOffset.y],normalScale:layer.m_NormalScale,metalness:layer.m_Metallic,roughness:1-layer.m_Smoothness});
}
const map=read(folder+'map.json');map.terrainSplat=config;write(folder+'map.json',map);
copyFileSync(source+'terrain/source-layers.json',target+'source-layers.json');
const provenance=read(folder+'SOURCE.json');
write(target+'SOURCE.json',{source:provenance.source,sourceGame:provenance.sourceGame,author:provenance.author,license:provenance.license,permissionConfirmed:false,adaptation:'Native TerrainLayer tiling, offsets, splat alpha weights and PBR factors on retained heightmap geometry. Static browser PBR; no Unity wind or terrain tessellation.',textures:records});
provenance.nativeTerrain={sourceLayers:'native-terrain/source-layers.json',provenance:'native-terrain/SOURCE.json',layers:config.layers.length,description:'Native metre-scale tiled diffuse/normal layers and unscaled splat painting replace undersampled patch color in the browser; original baked GLB remains recoverable.'};
write(folder+'SOURCE.json',provenance);
console.log('Installed native terrain:',config.layers.length,'layers,',records.length,'textures');
