import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {readGlb,writeGlb,stripMapProxyMaterials,appendGlbImage,pruneGlbImages} from './glb-json-patch.js';
import {neutralMaterialKind,neutralizeMaterial} from './parvoz-material-policy.js';
import {sourceHierarchy} from './import-source-hierarchy.js';
import {resolve,relative} from 'node:path';
const selected=process.argv.find(v=>v.startsWith('--map='))?.slice(6),apply=process.argv.includes('--apply'),brandingOnly=process.argv.includes('--branding-only');
const ids=selected?[selected]:['hangar-c03-demo','liftoff-arena-demo','minus-two-demo','liftoff-pine-valley-demo','liftoff-the-green-demo'];
const fabric=readFileSync('content/shared-assets/parvoz-neutral-surfaces/fabric.ktx2');
mkdirSync('data/map-repair-20261031',{recursive:true});
for(const id of ids){
  if(apply&&!brandingOnly&&existsSync('content/maps/'+id+'/visual-repair.json'))throw Error('Scene is already repaired; use --branding-only for new artwork replacements: '+id);
  const profileFile='tools/import-profiles/'+id+'.json',profile=JSON.parse(readFileSync(profileFile));
  const resources=JSON.parse(readFileSync(profile.staging+'/resources.json')),records=JSON.parse(readFileSync(profile.staging+'/'+resources.records));
  const hierarchy=sourceHierarchy(records),shadowOnly=new Set(Object.values(records).filter(r=>r.type==='MeshRenderer'&&r.data.m_CastShadows===3&&r.data.m_Enabled&&hierarchy.active(r.data.m_GameObject.m_PathID)).map(r=>r.data.m_GameObject.m_PathID));
  const defaultRenderers=Object.values(records).filter(r=>r.type==='MeshRenderer'&&r.data.m_Enabled&&hierarchy.active(r.data.m_GameObject.m_PathID)&&r.data.m_Materials.some(ref=>resources.materials.some(m=>m.name==='Default-Material'&&m.key===JSON.stringify(resources.collectionDependencies[JSON.stringify(resources.scene)][ref.m_FileID])+':'+ref.m_PathID)));
  if(defaultRenderers.some(r=>!shadowOnly.has(r.data.m_GameObject.m_PathID)))throw Error('Default material is shared with real scenery: '+id);
  const base='content/maps/'+id,definition=JSON.parse(readFileSync(base+'/map.json')),input=readFileSync(base+'/model.glb'),document=readGlb(input);
  const names=['AirflagLiftoffFinishDark01',...(defaultRenderers.length?['Default-Material']:[])];
  const branded=document.json.materials.filter(m=>neutralMaterialKind(m.name)).map(m=>m.name);
  const proxies=brandingOnly?undefined:stripMapProxyMaterials(document.json,names,definition.objects||[],{rebuildMaterialNames:branded});
  const models=[{file:base+'/model.glb',document,input,proxies}],seen=new Set(models.map(m=>resolve(m.file)));
  const catalog=JSON.parse(readFileSync('public/content/catalog.json'));
  const map=catalog.maps.find(m=>m.id===id);
  for(const track of map.tracks){
    const race=JSON.parse(readFileSync('content/races/'+track.id+'/race.json'));
    for(const object of race.objects||[]){
      const file=relative(process.cwd(),resolve('content/races/'+track.id,object.model)).replaceAll('\\','/');
      if(seen.has(resolve(file))||!existsSync(file))continue;seen.add(resolve(file));
      const input=readFileSync(file);models.push({file,input,document:readGlb(input)});
    }
  }
  const report=brandingOnly?JSON.parse(readFileSync(base+'/visual-repair.json')):{map:id,shadowOnlySourceObjects:shadowOnly.size,previewSourceHierarchy:'FreezeFrameFinish',...proxies,models:[]};
  let changedModels=0;
  for(const model of models){
    const materials=model.document.json.materials||[],targets=materials.filter(m=>neutralMaterialKind(m.name)&&(!brandingOnly||!m.extras?.parvozBrandingRemoved));
    if(!targets.length&&!model.proxies)continue;
    const texture=targets.some(m=>neutralMaterialKind(m.name)==='cloth')?appendGlbImage(model.document,fabric,{name:'Parvoz neutral racing fabric'}):null;
    const replaced=[];for(const material of targets)if(neutralizeMaterial(material,texture))replaced.push(material.name);
    const packed=pruneGlbImages(model.document),output=writeGlb(model.document);
    const previous=report.models.find(m=>m.file===model.file);
    const entry={file:model.file,neutralized:replaced,bytesBefore:model.input.length,bytesAfter:output.length,...packed};
    if(previous){previous.neutralized=[...new Set([...previous.neutralized,...replaced])];previous.bytesAfter=output.length;previous.additionalBrandingPass=entry;}
    else report.models.push(entry);
    changedModels++;
    if(apply)writeFileSync(model.file,output);
  }
  if(apply){
    profile.sceneRepairs={...profile.sceneRepairs,suppressShadowOnly:true,excludePreviewFinish:true,neutralBranding:true};
    profile.excludeObjectPrefixes=[...new Set([...(profile.excludeObjectPrefixes||[]),'FreezeFrameFinish'])];
    writeFileSync(profileFile,JSON.stringify(profile,null,2)+'\n');
    writeFileSync(base+'/visual-repair.json',JSON.stringify(report,null,2)+'\n');
  }
  writeFileSync('data/map-repair-20261031/'+id+'-visuals.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({map:id,shadowOnly:report.shadowOnlySourceObjects,...proxies,models:changedModels,brandingOnly,apply}));
}
