// Reuse the preserved prefab extraction; never re-extract or export the art here.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {nativeSlotTransform} from './native-slot-transform.js';
const input='data/liftoff-new-drone-recovery/';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const write=(file,data)=>writeFileSync(file,JSON.stringify(data,null,2)+'\n');
const source=read(input+'gate-prefab-config.json'),rows=read(input+'gate-prefab-rows.json'),parts=read(input+'part-data.json');
const scripts=new Map(rows.filter(row=>row.type==='MonoScript').map(row=>[row.id,row.name]));
const frames={'luma-5':'Luma5Frame01','armattan-chameleon':'ArmattanChameleonFrame01','dquad-addiction':'DquadAddictionFrame01','armattan-gecko':'ArmattanGeckoFrame01'};
const categories={CameraRestriction:'camera',MotorRestriction:'motors',AntennaRestriction:'antenna',ActionCamRestriction:'actionCamera'};
const cameraSources={'luma-5':'ActionCamFrontHDMountv1Luma501','armattan-chameleon':'ActionCamSessionNoMount01','dquad-addiction':'ActionCamSessionNoMount01','armattan-gecko':'ActionCamSessionNoMount01'};
const evidence={sourceGame:'Liftoff: FPV Drone Racing',source:'https://www.liftoff-game.com/',license:'Proprietary game content; redistribution permission unconfirmed',permissionConfirmed:false,
  prefabSha256:createHash('sha256').update(readFileSync(input+'gate-prefab-config.json')).digest('hex'),
  semantics:'Assembly-CSharp: PartIDRestrictor ALLOW_ONLY=0 / EXCLUDE=1; PropellerSizeRestrictor UseFrameSettings=10; PartSlot.overridePart; ActionCamMountRestriction WITHOUT_MOUNT=0 / WITH_MOUNT=1. SnapPoint child overrides serialized snap fields.'};
const report={...evidence,frames:{}};
for(const [id,frame] of Object.entries(frames)){
  const root=source.roots.find(row=>row.name===frame);if(!root)throw Error('Missing native frame '+frame);
  const records=Object.values(source.records).filter(row=>JSON.stringify(row.collection)===JSON.stringify(root.collection));
  const byId=new Map(records.map(row=>[row.id,row]));
  const components=records.filter(row=>row.type==='MonoBehaviour').map(row=>({row,type:scripts.get(row.data.m_Script?.m_PathID),data:row.data.m_Structure}));
  const config={sourceFrame:frame,slots:{},rules:[],hiddenNodes:[]};
  const raw=[];
  for(const {row,type,data} of components){
    if(type==='PartSlot'){
      const go=byId.get(row.data.m_GameObject.m_PathID),transform=records.find(r=>r.type==='Transform'&&r.data.m_GameObject.m_PathID===go.id);
      const children=(transform?.data.m_Children||[]).map(ref=>byId.get(ref.m_PathID)).filter(Boolean);
      const snap=children.find(child=>byId.get(child.data.m_GameObject.m_PathID)?.data.m_Name==='SnapPoint');
      const slot={name:go.data.m_Name,partType:data.partType,overridePart:data.overridePart?.dronePartID||null,
        position:snap?.data.m_LocalPosition||{x:0,y:0,z:0},rotation:snap?.data.m_LocalRotation||{x:0,y:0,z:0,w:1},scale:snap?.data.m_LocalScale||{x:1,y:1,z:1}};
      const category=({2:'camera',4:'motors',16:'battery',32:'antenna',128:'actionCamera'})[data.partType];
      slot.matrix=nativeSlotTransform(records,root.id,go.id);
      if(category)(config.slots[category]||=[]).push(slot);
      raw.push({type,id:row.id,data});
    }else if(categories[type]){
      config.rules.push({category:categories[type],operation:data.condition===0?'allow':'exclude',sourcePartIds:data.partList,allowBlank:!!data.alwaysAllowBlankCamera});raw.push({type,id:row.id,data});
    }else if(type==='PropellerSizeRestrictor'){
      config.rules.push({category:'propellers',operation:data.condition===1?'minDiameter':'maxDiameter',value:data.condition===10?parts[frame].m_Structure.maxPropellerSize:data.value});raw.push({type,id:row.id,data});
    }else if(type==='AntennaAngleRestriction'){
      config.rules.push({category:'antenna',operation:'isAngled',value:data.condition===1});raw.push({type,id:row.id,data});
    }else if(type==='ActionCamMountRestriction'){
      config.rules.push({category:'actionCamera',operation:'hasMount',value:!!data.onlyAllow,allowBlank:!!data.alwaysAllowBlankCamera});raw.push({type,id:row.id,data});
    }
  }
  const folder='content/drones/'+id+'/',drone=read(folder+'drone.json');
  // The original importer installed the blueprint antenna even for a forced blank slot.
  // Bind exact exported node names, across all LODs, instead of a runtime name heuristic.
  if(config.slots.antenna?.some(slot=>slot.overridePart==='AntennaBlank')){
    for(const level of drone.modelLods||[{model:drone.model}]){
      const bytes=readFileSync(folder+level.model),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
      config.hiddenNodes.push(...gltf.nodes.filter(node=>node.name?.startsWith('Antenna_')).map(node=>node.name));
    }
    config.hiddenNodes=[...new Set(config.hiddenNodes)];
  }
  const accessory=drone.accessories?.actionCamera;
  if(accessory){accessory.sourcePartId=cameraSources[id];accessory.sourceSpecs=parts[cameraSources[id]].m_Structure;}
  drone.customization=config;write(folder+'drone.json',drone);
  report.frames[id]={frame,rootId:root.id,collection:root.collection,components:raw,slotTransforms:records.filter(r=>r.type==='Transform'||r.type==='GameObject'),configuration:config};
}
write('content/shared-assets/liftoff-drone-parts/customization-source.json',report);
console.log('Installed native slot and compatibility data for '+Object.keys(frames).length+' aircraft.');
