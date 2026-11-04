// Inspect the actual compressed detail deliveries and source terminal contracts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const folder='content/shared-assets/drone-details/';
const source=JSON.parse(readFileSync(folder+'preparation.json','utf8'));
const report={aircraft:[],levels:[],joinedBatteryVariants:0,sourceActiveFrameWires:0,maximumDeliveryTerminalError:0};
for(const level of ['hangar','low','far']){
  const doc=await io.read(folder+level+'-delivery.glb'),root=doc.getRoot();
  const nodes=new Map(root.listNodes().map(node=>[node.getName(),node]));
  const authored=await io.read(folder+level+'-source.glb');
  const sourceNodes=new Map(authored.getRoot().listNodes().map(node=>[node.getName(),node]));
  let meshUvCount=0;
  const count=node=>node.listChildren().reduce((sum,child)=>sum+count(child),node.getMesh()?.listPrimitives().reduce((sum,primitive)=>sum+(primitive.getIndices()?.getCount()||primitive.getAttribute('POSITION').getCount())/3,0)||0);
  const levels={name:level,activeAircraft:{},textures:root.listTextures().length};
  for(const texture of root.listTextures()){assert.equal(texture.getMimeType(),'image/ktx2');assert.ok(texture.getSize().every(size=>size<=512));}
  for(const identifier of Object.keys(source.aircraft)){
    const drone=JSON.parse(readFileSync('content/drones/'+identifier+'/drone.json','utf8'));
    const detail=JSON.parse(readFileSync('content/drones/'+identifier+'/details.json','utf8'));
    const electrical=detail.visualDetails, camera=detail.accessories.actionCamera;
    for(const name of [electrical.frameNode,...Object.values(electrical.batteryNodes),camera.modelNode].filter(Boolean))assert.ok(nodes.get(name),'Missing semantic detail node: '+name);
    const active=[electrical.frameNode,electrical.batteryNodes[drone.stockParts?.battery],camera.modelNode].filter(Boolean);
    levels.activeAircraft[identifier]={withCameraTriangles:active.reduce((sum,name)=>sum+count(nodes.get(name)),0),withoutCameraTriangles:active.filter(name=>name!==camera.modelNode).reduce((sum,name)=>sum+count(nodes.get(name)),0)};
    for(const [batteryId,wires] of Object.entries(source.aircraft[identifier].batteries)){
      for(const wire of wires){
        const target=source.aircraft[identifier].frameWires.find(frame=>frame.connection===wire.connection).end;
        assert.ok(Math.hypot(...target.map((value,index)=>value-wire.terminal[index]))<1e-7,'Disconnected source terminals');
        const node=nodes.get(electrical.batteryNodes[batteryId]+'_'+wire.connection);assert.ok(node?.getMesh());
        const matrix=node.getWorldMatrix();let nearest=Infinity;
        for(const primitive of node.getMesh().listPrimitives()){
          const position=primitive.getAttribute('POSITION');
          // Solid silicone needs no texture in delivery; pruning may discard its
          // unused UV. The authored export retains an editable unwrap.
          assert.ok(sourceNodes.get(node.getName()).getMesh().listPrimitives()[0].getAttribute('TEXCOORD_0'),'Authored wire has no UV');meshUvCount++;
          for(let vertex=0;vertex<position.getCount();vertex++){
            const v=position.getElement(vertex,[]),world=[0,1,2].map(axis=>matrix[axis]*v[0]+matrix[axis+4]*v[1]+matrix[axis+8]*v[2]+matrix[axis+12]);
            nearest=Math.min(nearest,Math.hypot(...target.map((value,index)=>value-world[index])));
          }
        }
        assert.ok(nearest<.0017,level+' delivery terminal moved beyond the 1.2mm cable cap: '+nearest);
        report.maximumDeliveryTerminalError=Math.max(report.maximumDeliveryTerminalError,nearest);
      }
    }
    if(level==='low'){
      report.aircraft.push({id:identifier,actionCameraSource:source.aircraft[identifier].camera.sourcePart,cosmeticOnly:camera.cosmeticOnly,cameraMassDisplay:camera.mass,activeTriangles:levels.activeAircraft[identifier]});
      report.joinedBatteryVariants+=Object.keys(source.aircraft[identifier].batteries).length;report.sourceActiveFrameWires+=source.aircraft[identifier].frameWires.length;
    }
  }
  assert.ok(meshUvCount>0);report.levels.push(levels);
}
const provenance=JSON.parse(readFileSync(folder+'SOURCE.json','utf8'));assert.equal(provenance.permissionConfirmed,false);assert.equal(provenance.sourceGame,'Liftoff: FPV Drone Racing');
writeFileSync(folder+'validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
