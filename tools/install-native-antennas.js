// Uses only the four already recovered native prefabs and Blender exports.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isPartCompatible} from '../shared/part-compatibility.js';
const library='content/shared-assets/liftoff-antennas/',read=p=>JSON.parse(readFileSync(p,'utf8'));
const write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const slug=s=>'lf-'+s.replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase();
const report=read(library+'preparation.json');
const ids=['luma-5','armattan-chameleon','armattan-gecko','dquad-addiction'];
const names={AntennaPagodaCircular01:'Pagoda circular',AntennaSoupapeMicro01:'Soupape Micro',AntennaSoupape01:'Soupape',AntennaFatsharkCircular01:'Fatshark circular'};
const source={...read('content/shared-assets/liftoff-drone-parts/SOURCE.json'),changes:'Four preserved native antenna prefabs exported in Blender, with original materials. Native frame PartSlot/SnapPoint transforms and restrictions drive mounting and selection.',prefabsSha256:createHash('sha256').update(readFileSync('data/liftoff-new-drone-recovery/gate-prefab-config.json')).digest('hex')};
write(library+'SOURCE.json',source);
const drones=ids.map(id=>read('content/drones/'+id+'/drone.json'));
for(const entry of report.parts){
 const relative='../../shared-assets/liftoff-antennas/';
 const part={id:slug(entry.sourceId),category:'antenna',name:names[entry.sourceId],sourcePartId:entry.sourceId,sourceSpecs:entry.specifications,physicalSize:entry.size,
  mass:0,thrust:1,response:1,drag:1,duration:1,durability:1,cost:0,position:[0,0,0],rotation:[0,0,0],scale:1,materials:[],
  model:relative+'hangar-delivery.glb',modelNode:entry.nodes[0],
  assetLicense:source.license,assetCredit:source.author,assetSource:source.source,attributionFile:relative+'SOURCE.json',localOnly:true};
 part.compatibleDrones=drones.filter(d=>isPartCompatible(d,'antenna',part)).map(d=>d.id);
 const folder='content/parts/antenna-'+part.id+'/';mkdirSync(folder,{recursive:true});write(folder+'part.json',part);
}
for(const [id,name,compatibleDrones,sourcePartId] of [['fixed','Standard antenna',['kestrel'],null],[slug('AntennaBlank'),'No separate antenna',['armattan-gecko'],'AntennaBlank']]){
 const folder='content/parts/antenna-'+id+'/';mkdirSync(folder,{recursive:true});
 write(folder+'part.json',{id,category:'antenna',name,compatibleDrones,...(sourcePartId?{sourcePartId,sourceSpecs:{weight:0,isAngled:false},physicalSize:[.001,.001,.001]}:{}),mass:0,cost:0,materials:[]});
}
const blueprints=['Luma5_0001','ArmattanChameleon5inch_0001','ArmattanGecko3inch_0001','DquadAddiction_0001'];
for(const [i,drone] of drones.entries()){
 const file=['data/liftoff-new-drone-recovery/','data/liftoff-drone-recovery/'].map(p=>p+blueprints[i]+'.xml').find(existsSync);
 const stockId=drone.customization.slots.antenna[0].overridePart||readFileSync(file,'utf8').match(/<antenna>\s*<id>([^<]+)<\/id>/)[1];
 drone.stockParts.antenna=slug(stockId);
 const part=stockId==='AntennaBlank'?{specifications:{weight:0},size:[.001,.001,.001]}:report.parts.find(p=>p.sourceId===stockId);
 drone.sourcePhysics.antenna={sourcePartId:stockId,specifications:part.specifications,size:part.size};
 const bytes=readFileSync('content/drones/'+drone.id+'/'+drone.model),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 drone.partBindings.antenna=gltf.nodes.filter(n=>n.name?.startsWith('Antenna_')).map(n=>n.name);
 write('content/drones/'+drone.id+'/drone.json',drone);
}
console.log('Installed four authored antennas, native frame slots, fixed Kestrel and forced blank Gecko.');
