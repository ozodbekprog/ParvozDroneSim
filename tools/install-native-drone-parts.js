// Install the explicitly requested airframes/components from the preserved Blender reports.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {motorPropellerCurve} from '../shared/component-physics.js';
const library='content/shared-assets/liftoff-drone-parts/';
const report=JSON.parse(readFileSync(library+'preparation.json','utf8'));
const rawParts=JSON.parse(readFileSync('data/liftoff-new-drone-recovery/part-data.json','utf8'));
const ids=['luma-5','armattan-chameleon','armattan-gecko','dquad-addiction'];
const slug=value=>'lf-'+value.replace(/([a-z])([A-Z])/g,'$1-$2').replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase();
const write=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const human={
  Hypetrain2306Motor01:'Hypetrain 2306 · 2450KV',HypetrainVanover2207Motor01:'Hypetrain Vanover 2207 · 1860KV',
  Bushmaster1507motor3600KV01:'Bushmaster 1507 · 3600KV',Bushmaster1507motor2800KV01:'Bushmaster 1507 · 2800KV',
  HQV1Series5040TriPropeller01:'HQ V1 5×4 · 3 blades',Gemfan51466HurricaneMCKV2Propeller01:'Gemfan Hurricane MCK V2',
  Dal3050Propeller01:'DAL 3×5 · 3 blades',DAL5040CycloneTriPropeller01:'DAL Cyclone 5×4 · 3 blades',HQProp2Bullnose3045Propeller01:'HQ Bullnose 3×4.5 · 2 blades',
  TattuRline6SBattery01:'Tattu R-Line · 6S 1300mAh',TattuRline4SBattery01:'Tattu R-Line · 4S 1550mAh',
  AhtechInfinityBattery01:'Infinity · 4S 1500mAh',AmpAgeBattery01:'AmpAge · 4S 500mAh',HyperionBattery2S01:'Hyperion · 2S',
  CameraFibonacci01:'Fibonacci FPV',CameraRotorRiot01:'Rotor Riot FPV',CameraRedotSplitMini01:'Redot Split Mini'
};
const provenance={sourceGame:'Liftoff: FPV Drone Racing',source:'https://www.liftoff-game.com/',author:'LuGus Studios and original credited drone manufacturers',license:'Proprietary game content; redistribution permission unconfirmed',permissionConfirmed:false,testAuthorization:{date:'2026-10-14',scope:'User explicitly requested Gecko, Dquad and component customization, including them in the Oracle multiplayer test.'},changes:'Recovered authored meshes, mounting transforms and specifications; Blender assembly, texture-preserving PBR conversion and LOD export. Aerodynamics are calibrated simulation estimates, not manufacturer thrust measurements.'};
write(library+'SOURCE.json',provenance);
copyFileSync('data/liftoff-new-drone-recovery/part-data.json',library+'extracted-specifications.json');
write(library+'SOURCE.json',{...provenance,specificationsSha256:createHash('sha256').update(readFileSync(library+'extracted-specifications.json')).digest('hex')});
for(const entry of report.parts){
  const category=entry.category,identifier=slug(entry.sourceId),folder='content/parts/'+category+'-'+identifier+'/';
  mkdirSync(folder,{recursive:true});
  const small=category==='motors'?entry.specifications.diameter<20:category==='propellers'?entry.specifications.diameter<=3.1:category==='battery'?['AmpAgeBattery01','HyperionBattery2S01'].includes(entry.sourceId):false;
  const compatibleDrones=category==='camera'?ids:small?['armattan-gecko']:ids.filter(id=>id!=='armattan-gecko');
  const relative='../../shared-assets/liftoff-drone-parts/';
  const part={id:identifier,category,name:human[entry.sourceId]||entry.sourceId,sourcePartId:entry.sourceId,sourceSpecs:entry.specifications,physicalSize:entry.size,
    mass:0,thrust:1,response:1,drag:1,duration:1,durability:1,cost:0,position:[0,0,0],rotation:[0,0,0],scale:1,materials:[],
    compatibleDrones,model:relative+'hangar-delivery.glb',modelNode:entry.nodes[0],modelLods:[['hangar',0],['low',12],['far',40]].map(([name,distance])=>({model:relative+name+'-delivery.glb',distance,modelNode:entry.nodes[0]})),lowLod:1,
    mountMatrixByDrone:entry.mountMatrixByDrone,propellerMountMatrixByBuild:entry.propellerMountMatrixByBuild,
    assetLicense:provenance.license,assetCredit:provenance.author,assetSource:provenance.source,attributionFile:relative+'SOURCE.json',localOnly:true};
  if(category==='propellers')part.modelNodeByRotor=[entry.nodes[0],entry.nodes[1],entry.nodes[0],entry.nodes[1]];
  if(category==='camera')part.fov=105;
  write(folder+'part.json',part);
}
for(const identifier of ids){
  const folder='content/drones/'+identifier+'/',stock=report.stockAircraft[identifier],prep=JSON.parse(readFileSync(folder+'preparation.json','utf8'));
  const file=folder+'drone.json';let definition;
  const camera=stock.specifications.camera,motor=stock.specifications.motors,prop=stock.specifications.propellers,battery=stock.specifications.battery;
  const arm=prep.motorPositions.reduce((sum,position)=>sum+Math.hypot(position[0],position[2]),0)/4;
  const curve=motorPropellerCurve(motor,prop,battery.voltagePerCell*battery.numberOfCells);
  if(['luma-5','armattan-chameleon'].includes(identifier))definition=JSON.parse(readFileSync(file,'utf8'));
  else {
    const energy=battery.mAh/1000*battery.voltagePerCell*battery.numberOfCells;
    const groundClearance=Math.max(.008,-prep.bounds.min[2])+.002;
    const spheres=[{position:[0,.015,0],radius:identifier==='armattan-gecko'?.035:.045}];
    for(const position of prep.motorPositions){
      spheres.push({position,radius:Math.max(.012,motor.diameter/2000)});
      for(let i=0;i<8;i++){const theta=i*Math.PI/4;spheres.push({position:[position[0]+prop.diameter*.0254/2*Math.cos(theta),position[1],position[2]+prop.diameter*.0254/2*Math.sin(theta)],radius:.008});}
    }
    definition={id:identifier,name:identifier==='armattan-gecko'?'Armattan Gecko 3″':'Dquad Addiction',class:identifier==='armattan-gecko'?'three':'five',mass:prep.mass,arm,
      thrustToWeight:Math.max(1.1,Math.min(15,4*curve.thrust/(prep.mass*9.81))),motorTau:curve.tau,drag:identifier==='armattan-gecko'?[.022,.031,.016]:[.029,.039,.018],angularDrag:.11,
      batterySeconds:Math.max(30,Math.min(3600,energy*3600/(4*curve.power/.8*.45**1.5+6))),color:'#ffffff',unlock:'starter',model:'hangar-delivery.glb',modelLods:[['hangar',0],['low',12],['far',40]].map(([name,distance])=>({model:name+'-delivery.glb',distance})),lowLod:1,
      motorBindings:prep.motorBindings,mounts:Object.fromEntries(Object.entries(prep.mounts).filter(([,names])=>names.length)),partBindings:prep.partBindings,groundClearance,collision:{spheres},
      colorBindings:{body:prep.partBindings.frame.filter(name=>name.includes(stock.parts.frame)),led:[]},materials:[]};
  }
  const stockParts=Object.fromEntries(Object.entries(stock.parts).map(([category,name])=>[category,slug(name)]));
  const sizes=Object.fromEntries(report.parts.map(part=>[part.sourceId,part.size]));
  const frameSize=[arm*1.5,.025,arm*1.5];
  definition.stockParts=stockParts;
  if(identifier==='dquad-addiction')definition.flightRole='racing';
  definition.sourcePhysics={partIds:stock.parts,parts:stock.specifications,motorPositions:prep.motorPositions,sizes:Object.fromEntries(Object.entries(stock.parts).map(([category,name])=>[category,category==='frame'?frameSize:sizes[name]])),positions:{battery:[0,.025,0],camera:[0,0,arm*.5]}};
  definition.assetLicense=provenance.license;definition.assetCredit=provenance.author;definition.assetSource=provenance.source;definition.assetLicenseURL=provenance.source;definition.assetChanges=provenance.changes;definition.attributionFile='SOURCE.json';definition.localOnly=true;
  definition.contentStatus='User-authorized online multiplayer test; redistribution license unconfirmed';
  write(file,definition);write(folder+'SOURCE.json',{...provenance,airframe:stock.name,stockPartIds:stock.parts});
  const frameFolder='content/parts/frame-'+stockParts.frame+'/';mkdirSync(frameFolder,{recursive:true});
  write(frameFolder+'part.json',{id:stockParts.frame,category:'frame',name:stock.name+' frame',sourcePartId:stock.parts.frame,sourceSpecs:stock.specifications.frame,physicalSize:frameSize,compatibleDrones:[identifier],mass:0,thrust:1,response:1,drag:1,duration:1,durability:1,cost:0,materials:[]});
  if(['armattan-gecko','dquad-addiction'].includes(identifier)){
    const blueprint=identifier==='armattan-gecko'?'ArmattanGecko3inch_0001':'DquadAddiction_0001';
    copyFileSync('data/liftoff-new-drone-recovery/'+blueprint+'.xml',folder+'blueprint.xml');
    const source=JSON.parse(readFileSync(folder+'SOURCE.json','utf8'));source.blueprintSha256=createHash('sha256').update(readFileSync(folder+'blueprint.xml')).digest('hex');write(folder+'SOURCE.json',source);
  }
}
for(const identifier of ['swift','atlas','viper'])writeFileSync('content/drones/'+identifier+'/.disabled','Retired by the user on 14 October 2026. Source/history retained; remove this marker only on explicit request.\n');
console.log('Installed four Liftoff airframes, 17 interchangeable models and stock frames; Kestrel preserved; three generated airframes retired.');
await import('./import-native-customization.js');
