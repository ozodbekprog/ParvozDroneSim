import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {RipperClient} from './assetripper-client.js';
import {profile,recoveryFolder} from './content-import-profile.js';
import {addressableIndex} from './addressable-index.js';
const folder=recoveryFolder,resources=JSON.parse(readFileSync(folder+'resources.json','utf8')),client=new RipperClient();
const catalog=addressableIndex(profile.source,profile.catalogPath,profile.bundlesPath);
let rows=await client.index().catch(error=>{if(error.message.startsWith('AssetRipper 404 /Bundles/View'))return[];throw error;});const added=[];
for(const material of resources.materials){
  const props=JSON.parse(readFileSync(folder+material.file,'utf8')).m_SavedProperties;
  for(const slot of ['_DetailAlbedoMap','_DetailNormalMap','_DetailMask','_DetailTex','_SpecGlossMap','_BaseColormap','_BaseNormalmap','_NormalMap2','_ParallaxMap','_ScreenOverlay']){
    const pointer=props?.m_TexEnvs?.[slot]?.m_Texture;if(!pointer||String(pointer.m_PathID)==='0')continue;
    if(material.textures[slot]&&resources.textures.some(t=>t.key===material.textures[slot]))continue;
    const originalCollection=resources.collectionDependencies[JSON.stringify(material.collection)][pointer.m_FileID],key=JSON.stringify(originalCollection)+':'+pointer.m_PathID;
    let row=rows.find(r=>r.id===String(pointer.m_PathID)&&r.type==='Texture2D');
    if(!row){
      const prefix=material.name.replace(/ScreensNoLogo$/,'');
      const roots=catalog.keys.filter(v=>v?.includes('/Textures/')&&v.split('/').at(-1).startsWith(prefix));
      const files=roots.length?catalog.bundlesFor(roots):[];
      if(!files.length)throw new Error('No catalog texture dependencies for '+material.name+' '+slot);
      const body=new URLSearchParams();for(const file of files)body.append('Path',file);
      const response=await fetch(profile.assetRipperUrl+'/LoadFile',{method:'POST',body});if(!response.ok)throw new Error('Could not load material texture dependencies');await response.text();
      client.collections.clear();rows=await client.index();row=rows.find(r=>r.id===String(pointer.m_PathID)&&r.type==='Texture2D');
    }
    if(!row)throw new Error('Missing detail texture '+pointer.m_PathID);
    const file='textures/detail-'+pointer.m_PathID+'.png';
    if(!existsSync(folder+file))writeFileSync(folder+file,Buffer.from(await(await client.get(client.url(row,'Image')+'&Extension=png')).arrayBuffer()));
    const data=await client.json(row);if(!resources.textures.some(t=>t.key===key))resources.textures.push({key,file,name:row.name,width:data.m_Width,height:data.m_Height,hdr:false});
    material.textures[slot]=key;added.push({material:material.name,slot,name:row.name});
    writeFileSync(folder+'resources.json',JSON.stringify(resources,null,2));
  }
}
writeFileSync(folder+'resources.json',JSON.stringify(resources,null,2));console.log(added);
