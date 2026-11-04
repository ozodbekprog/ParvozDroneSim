import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
for(const folder of readdirSync('content/races')){
  const file='content/races/'+folder+'/race.json';if(!existsSync(file))continue;
  const race=JSON.parse(readFileSync(file));
  const objects=(race.objects||[]).filter(o=>!o.model?.endsWith('ribbons.glb'));
  const ribbons=new Set(),owners=new Set();
  for(const object of objects){
    if(!object.model?.endsWith('props.glb'))continue;
    const model=resolve(dirname(file),object.model),candidate=resolve(dirname(model),'ribbons.glb');
    if(existsSync(candidate)){ribbons.add(candidate);owners.add(dirname(model));}
  }
  if(!ribbons.size)continue;
  // Practice routes reuse native props. Their old copied collision arrays had
  // fallen behind source collider recovery, leaving visible frames non-solid.
  for(const owner of owners)if(resolve(dirname(file))!==owner){
    const original=JSON.parse(readFileSync(resolve(owner,'race.json')));
    race.colliders=original.colliders;
  }
  // This asset contains only its ribbons. Loading the complete scene also
  // avoids depending on GLTFLoader's sanitized form of Blender display names.
  for(const ribbon of ribbons)objects.push({model:relative(dirname(file),ribbon).replaceAll('\\','/'),position:[0,0,0],rotation:[0,0,0],scale:1});
  race.objects=objects;writeFileSync(file,JSON.stringify(race,null,2)+'\n');
  const sourceFile='content/races/'+folder+'/ribbon-source.json',inventoryFile='content/races/'+folder+'/track-import.json';
  if(existsSync(sourceFile)&&existsSync(inventoryFile)){
    const source=JSON.parse(readFileSync(sourceFile)),inventory=JSON.parse(readFileSync(inventoryFile));
    inventory.propMeshes??=inventory.meshes;inventory.ribbonMeshes=source.ribbons.length;inventory.meshes=inventory.propMeshes+inventory.ribbonMeshes;inventory.ribbonTriangles=source.triangles;
    for(const ribbon of source.ribbons){const item=inventory.inventory[ribbon.blueprintIndex];if(item){item.meshes=1;item.sourceRibbon=true;}}
    inventory.visibleInstances=inventory.inventory.filter(i=>i.meshes>0).length;writeFileSync(inventoryFile,JSON.stringify(inventory,null,2)+'\n');
  }
  console.log(JSON.stringify({race:folder,ribbonModels:ribbons.size}));
}
