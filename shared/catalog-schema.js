import { GATE_CLASSES } from './gates.js';
const id = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,63}$/.test(value);
const vec = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const color = value => /^#[a-f0-9]{6}$/i.test(value);
const asset = value => typeof value==='string' && /^\/content\/assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9._-]+\.(glb|png|jpe?g|json|pcol)$/i.test(value) && !value.includes('..');
const assert = (value, message) => { if (!value) throw new Error(message); };
const categories=['frame','motors','propellers','battery','camera'];
const matrix=value=>Array.isArray(value)&&value.length===16&&value.every(x=>number(x,-100,100))&&value[3]===0&&value[7]===0&&value[11]===0&&value[15]===1;
function componentSpecs(spec,category){
  assert(spec && number(spec.weight,category==='antenna'?0:.00001,2),'Invalid component weight');
  const required=category==='motors'?{velocityConstant:[100,20000],internalResistance:[.001,10],noLoadI:[0,20],maxPower:[1,5000],diameter:[1,100],StatorLength:[1,100]}:category==='propellers'?{diameter:[1,20],pitch:[.1,20],blades:[2,8],propConstant:[.1,10]}:category==='battery'?{mAh:[10,20000],numberOfCells:[1,12],voltagePerCell:[2,5],cellResistance:[.0001,1]}:{};
  for(const [key,range] of Object.entries(required))assert(number(spec[key],...range),`Invalid component ${key}`);
}
export function validateColliders(colliders) {
  assert(Array.isArray(colliders),'Collision data must be an array');
  for(const collider of colliders) {
    if(collider.type==='mesh')assert(Array.isArray(collider.vertices)&&collider.vertices.length%9===0&&collider.vertices.length<=900000&&collider.vertices.every(x=>Number.isFinite(x)&&Math.abs(x)<1e6),'Invalid collision triangles');
    else {assert(vec(collider.position)&&vec(collider.size)&&collider.size.every(x=>number(x,.01,2000)),'Invalid collision box');if(collider.rotation)assert(vec(collider.rotation),'Invalid collider rotation');}
    if(collider.type==='capsule'){
      assert(number(collider.radius,.005,1000)&&number(collider.halfLength,0,1000)&&[0,1,2].includes(collider.axis),'Invalid round collider');
      assert(collider.size.every((size,axis)=>size+1e-7>=2*(collider.radius+(axis===collider.axis?collider.halfLength:0))),'Round collider bounds are too small');
    }
  }
  return colliders;
}
function transform(value = {}) {
  for (const key of ['position', 'rotation']) if (value[key] !== undefined) assert(vec(value[key]), `Invalid ${key}`);
  if (value.scale !== undefined) assert(number(value.scale, 0.001, 1000), 'Invalid model scale');
}
function visual(item) {
  if(item.modelNodeByRotor!==undefined)assert(item.model && Array.isArray(item.modelNodeByRotor)&&item.modelNodeByRotor.length===4&&item.modelNodeByRotor.every(name=>typeof name==='string'&&name.length>0&&name.length<=200),'Invalid rotor model nodes');
  for(const key of ['mountMatrixByDrone','propellerMountMatrixByBuild'])if(item[key]!==undefined){
    assert(item[key]&&typeof item[key]==='object'&&!Array.isArray(item[key]),'Invalid mount matrix map');
    for(const value of Object.values(item[key]))assert(matrix(value),'Invalid component mount matrix');
  }
  if(item.modelNode!==undefined)assert(item.model && typeof item.modelNode==='string' && item.modelNode.length>0 && item.modelNode.length<=200,'Invalid model node');
  if(item.compatibleDrones!==undefined)assert(Array.isArray(item.compatibleDrones) && item.compatibleDrones.length>0 && item.compatibleDrones.every(id),'Invalid compatible drone IDs');
  if (item.modelLods !== undefined) {
    assert(item.model && Array.isArray(item.modelLods) && item.modelLods.length >= 2 && item.modelLods.length <= 4, 'LOD requires a base model and 2–4 levels');
    item.modelLods.forEach((level, i) => {
      if(level.modelNode!==undefined)assert(typeof level.modelNode==='string' && level.modelNode.length>0 && level.modelNode.length<=200,'Invalid LOD model node');
      assert(asset(level.model) && level.model.endsWith('.glb'), 'Invalid LOD model');
      assert(number(level.distance, 0, 10000) && (i === 0 ? level.distance === 0 : level.distance > item.modelLods[i - 1].distance), 'LOD distances must start at zero and increase');
    });
  }
  if (item.lowLod !== undefined) assert(Number.isInteger(item.lowLod) && item.lowLod >= 0 && item.lowLod < (item.modelLods?.length || 0), 'Invalid minimum Low LOD');
  for (const field of ['mounts', 'partBindings']) if (item[field] !== undefined) {
    assert(item[field] && typeof item[field] === 'object' && !Array.isArray(item[field]), `Invalid ${field}`);
    for (const [category, names] of Object.entries(item[field])) {
      assert(['frame','motors','propellers','battery','camera','antenna'].includes(category) && Array.isArray(names) && names.length > 0 && names.length <= 64 && new Set(names).size === names.length && names.every(name => typeof name === 'string' && name.length > 0 && name.length <= 200), `Invalid ${field} bindings`);
      if (field === 'mounts') assert(names.length === (['motors','propellers'].includes(category) ? 4 : 1), `Invalid ${category} mount count`);
    }
  }
  if (item.colorBindings) for (const [key, names] of Object.entries(item.colorBindings)) assert(['body','led'].includes(key) && Array.isArray(names) && names.length <= 128 && names.every(name => typeof name === 'string' && name.length > 0 && name.length <= 200), 'Invalid color mesh bindings');
  if (item.model) assert(asset(item.model) && item.model.endsWith('.glb'), `${item.id}: invalid runtime GLB path`);
  transform(item.modelTransform || {});
  for (const material of item.materials || []) {
    assert(typeof material.mesh === 'string', 'Material needs a mesh name');
    if (material.material !== undefined) assert(typeof material.material === 'string' && material.material.length > 0, 'Invalid material slot name');
    if (material.baseColor) assert(color(material.baseColor), 'Invalid material color');
    if (material.emissiveColor) assert(color(material.emissiveColor), 'Invalid emission color');
    if (material.emissiveIntensity !== undefined) assert(number(material.emissiveIntensity,0,20), 'Invalid emission strength');
    if (material.normalScale) assert(Array.isArray(material.normalScale) && material.normalScale.length === 2 && material.normalScale.every(x=>number(x,0,10)), 'Invalid normal scale');
    if (material.opacity !== undefined) assert(number(material.opacity,0,1), 'Invalid material opacity');
    if (material.alphaMode) assert(['OPAQUE','MASK','BLEND'].includes(material.alphaMode), 'Invalid alpha mode');
    if (material.alphaCutoff !== undefined) assert(number(material.alphaCutoff,0,1), 'Invalid alpha cutoff');
    if (material.doubleSided !== undefined) assert(typeof material.doubleSided === 'boolean', 'Invalid double sided material');
    for (const key of ['roughness','metalness']) if (material[key] !== undefined) assert(number(material[key],0,1), `Invalid ${key}`);
    for (const key of ['baseTexture','normalTexture','roughnessTexture','metalnessTexture','occlusionTexture','emissiveTexture']) if (material[key]) assert(asset(material[key]) && /\.(png|jpe?g)$/i.test(material[key]), `Invalid ${key} path`);
  }
}
export function validateCatalog(value) {
  assert(value?.version === 2, 'Content catalog version must be 2');
  if (value.assets) {
    const urls = new Set();
    for (const entry of value.assets) { assert(asset(entry.url) && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 && !urls.has(entry.url), 'Invalid asset size index'); urls.add(entry.url); }
  }
  for (const category of ['maps','drones','parts','challenges','tutorials']) assert(Array.isArray(value[category]), `${category} must be an array`);
  const unique = (items, category, key = item => item.id) => {
    const seen = new Set();
    for (const item of items) { assert(id(item.id) && typeof item.name === 'string' && item.name.length > 0, `Invalid ${category} ID/name`); assert(!seen.has(key(item)), `Duplicate ${category}: ${key(item)}`); seen.add(key(item)); }
  };
  for (const key of ['maps','drones','challenges','tutorials']) unique(value[key],key);
  unique(value.parts,'part',item=>`${item.category}:${item.id}`);
  const trackIds = new Set();
  for (const map of value.maps) {
    visual(map);
    if(map.terrainSplat){
      const t=map.terrainSplat,pair=(v,check=Number.isFinite)=>Array.isArray(v)&&v.length===2&&v.every(check);
      assert(typeof t.materialPrefix==='string'&&/^TerrainSurface_\d+_$/.test(t.materialPrefix),'Invalid terrain material prefix');
      assert(pair(t.origin)&&pair(t.worldScale,v=>v===-1||v===1)&&pair(t.size,v=>number(v,.1,100000)),'Invalid terrain coordinates');
      assert(Array.isArray(t.layers)&&t.layers.length>0&&t.layers.length<=5,'Invalid terrain layers');
      assert(Array.isArray(t.alpha)&&t.alpha.length===Math.ceil(t.layers.length/4)&&t.alpha.every(url=>asset(url)&&url.endsWith('.png')),'Invalid terrain paint masks');
      for(const l of t.layers)assert(asset(l.diffuse)&&asset(l.normal)&&pair(l.tile,v=>number(v,.001,10000))&&pair(l.offset)&&number(l.normalScale,0,10)&&number(l.roughness,0,1)&&number(l.metalness,0,1),'Invalid terrain layer');
    }
    if(map.collisionFile) assert(asset(map.collisionFile) && map.collisionFile.endsWith('.json'), 'Invalid collision file');
    if(map.preparedCollisionFile)assert(asset(map.preparedCollisionFile)&&map.preparedCollisionFile.endsWith('.pcol'),'Invalid prepared collision file');
    if(map.thumbnail) assert(asset(map.thumbnail) && /\.(png|jpe?g)$/i.test(map.thumbnail), 'Invalid thumbnail');
    assert(['hangar','ruins','forest','industrial','neon','orbital','canyon','custom'].includes(map.theme), `${map.id}: invalid environment recipe`);
    if(map.environment !== undefined) assert(typeof map.environment === 'string' && /^[a-z][a-z0-9-]{1,63}$/.test(map.environment), `${map.id}: invalid environment identity`);
    if(map.indoor !== undefined) assert(typeof map.indoor === 'boolean', `${map.id}: invalid indoor setting`);
    if(map.fogDensity !== undefined) assert(number(map.fogDensity,0,.05), `${map.id}: invalid fog density`);
    if(map.floorY !== undefined) assert(number(map.floorY,-2000,2000), `${map.id}: invalid floor elevation`);
    if(map.bounds) assert(vec(map.bounds.min) && vec(map.bounds.max) && map.bounds.min.every((v,i)=>v<map.bounds.max[i] && Math.abs(v)<1e6 && Math.abs(map.bounds.max[i])<1e6), `${map.id}: invalid map bounds`);
    if(map.menuCamera) assert(vec(map.menuCamera.position) && vec(map.menuCamera.target), `${map.id}: invalid menu camera`);
    if(map.garage){
      visual(map.garage);transform(map.garage);assert(map.garage.model && vec(map.garage.anchor),`${map.id}: invalid garage model/anchor`);
      for(const shot of Object.values(map.garage.cameraShots||{}))assert(Number.isFinite(shot.azimuth)&&shot.elevation>=.08&&shot.elevation<=1.35&&shot.zoom>=.55&&shot.zoom<=2.5,`${map.id}: invalid garage camera shot`);
    }
    for (const key of ['sky','fog','ground','sun']) assert(color(map[key]), `${map.id}: invalid ${key}`);
    assert(vec(map.wind) && vec(map.sunPosition) && number(map.gravity,0.1,2), `${map.id}: invalid atmosphere`);
    assert(Array.isArray(map.tracks) && map.tracks.length && Array.isArray(map.colliders), `${map.id}: courses/colliders required`);
    validateColliders(map.colliders);
    for (const object of map.objects || []) { visual(object); assert(object.model, 'Scene object needs a model'); transform(object); }
    for (const track of map.tracks) {
      if(track.collisionFile)assert(asset(track.collisionFile)&&track.collisionFile.endsWith('.json'),`${track.id}: invalid track collision file`);
      if(track.preparedCollisionFile)assert(asset(track.preparedCollisionFile)&&track.preparedCollisionFile.endsWith('.pcol'),`${track.id}: invalid prepared track collision file`);
      for(const object of track.objects||[]){visual(object);assert(object.model,'Track object needs a model');transform(object);}
      validateColliders(track.colliders||[]);
      assert(id(track.id) && !trackIds.has(track.id), 'Duplicate/invalid course ID'); trackIds.add(track.id);
      assert(Number.isInteger(track.laps) && number(track.laps,1,20) && Array.isArray(track.gates) && track.gates.length >= 1 && track.gates.length <= 200, `${track.id}: invalid course`);
      assert(track.spawn && vec(track.spawn.position) && Number.isFinite(track.spawn.yaw), `${track.id}: invalid spawn`);
      for (const gate of track.gates) {
        visual(gate);
        if(gate.frameSource !== undefined) {
          assert(['default','track','map'].includes(gate.frameSource), `${track.id}: invalid gate frame source`);
          if(gate.frameSource==='track') assert(track.objects?.length>0, `${track.id}: embedded track gate requires track models`);
          if(gate.frameSource==='map') assert(map.model || map.objects?.length>0, `${track.id}: embedded map gate requires a map model`);
          assert(!gate.model || gate.frameSource==='default', `${track.id}: gate cannot have two visual sources`);
        }
        if(gate.aperture!==undefined)assert(['rectangle','ellipse'].includes(gate.aperture),`${track.id}: invalid checkpoint aperture`);
        if(gate.model)assert(typeof gate.signalMaterial==='string' && gate.signalMaterial.length>0 && gate.signalMaterial.length<=200, `${track.id}: authored gate needs a signal material`);
        assert(vec(gate.position) && Number.isFinite(gate.yaw) && number(gate.width,0.3,100) && number(gate.height,0.3,100), `${track.id}: invalid gate`);
        if(gate.respawn!==undefined)assert(gate.respawn&&vec(gate.respawn.position)&&Number.isFinite(gate.respawn.yaw),`${track.id}: invalid gate respawn`);
        if(gate.axes){
          assert(['map','track'].includes(gate.frameSource),`${track.id}: tilted gate requires its authored frame`);
          const vectors=['normal','right','up'].map(key=>gate.axes[key]);
          assert(vectors.every(v=>vec(v)&&Math.abs(Math.hypot(...v)-1)<.001),`${track.id}: invalid gate axes`);
          for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert(Math.abs(vectors[i].reduce((sum,x,k)=>sum+x*vectors[j][k],0))<.001,`${track.id}: non-orthogonal gate axes`);
        }
        if (gate.gateClass !== undefined) assert(Object.hasOwn(GATE_CLASSES,gate.gateClass), `${track.id}: invalid gate class`);
        if (gate.frameThickness !== undefined) assert(number(gate.frameThickness,.05,.25), `${track.id}: invalid gate frame thickness`);
        if (gate.support !== undefined) {
          assert(gate.support && ['ground','roof','suspended','none'].includes(gate.support.type) && number(gate.support.baseY,-2000,2000), `${track.id}: invalid gate support`);
          if (gate.support.type === 'ground' || gate.support.type === 'roof') assert(gate.support.baseY <= gate.position[1]-gate.height/2 + 1e-6, `${track.id}: gate support base must be below opening`);
          if (gate.support.type === 'suspended') {
            const thickness = gate.frameThickness ?? (GATE_CLASSES[gate.gateClass] || GATE_CLASSES.open).frameThickness;
            assert(gate.support.baseY >= gate.position[1]+gate.height/2+thickness - 1e-6, `${track.id}: suspended gate anchor must be above frame`);
          }
        }
      }
    }
  }
  for (const drone of value.drones) {
    visual(drone);
    if(drone.customization){
      const config=drone.customization,name=value=>typeof value==='string'&&value.length>0&&value.length<=200;
      const slotCategories=['camera','motors','battery','antenna','actionCamera'];
      assert(name(config.sourceFrame)&&config.slots&&typeof config.slots==='object'&&!Array.isArray(config.slots),'Invalid native customization');
      for(const [category,slots] of Object.entries(config.slots)){
        assert(slotCategories.includes(category)&&Array.isArray(slots)&&slots.length<=4,'Invalid native slots');
        for(const slot of slots)assert(name(slot.name)&&(slot.overridePart===null||name(slot.overridePart))&&['position','rotation','scale'].every(key=>slot[key]&&Object.values(slot[key]).every(Number.isFinite))&&(slot.matrix===undefined||matrix(slot.matrix)),'Invalid native slot transform');
      }
      assert(Array.isArray(config.rules)&&config.rules.length<=32,'Invalid native rules');
      for(const rule of config.rules){
        assert([...slotCategories,'propellers'].includes(rule.category)&&['allow','exclude','maxDiameter','minDiameter','hasMount','isAngled'].includes(rule.operation),'Invalid native rule operation');
        if(['allow','exclude'].includes(rule.operation))assert(Array.isArray(rule.sourcePartIds)&&rule.sourcePartIds.length<=200&&rule.sourcePartIds.every(name),'Invalid native part list');
        else if(['hasMount','isAngled'].includes(rule.operation))assert(typeof rule.value==='boolean','Invalid native mount rule');
        else assert(number(rule.value,.1,30),'Invalid native diameter rule');
      }
      assert(Array.isArray(config.hiddenNodes)&&config.hiddenNodes.length<=200&&config.hiddenNodes.every(name),'Invalid hidden component bindings');
      for(const rule of config.visibility||[])assert(rule.when&&typeof rule.when==='object'&&Object.keys(rule.when).every(key=>['cameraId','motorsId','batteryId','propellersId','antennaId','actionCamera'].includes(key))&&Array.isArray(rule.hide)&&rule.hide.every(name),'Invalid conditional component visibility');
    }
    if(drone.visualDetails){
      const details=drone.visualDetails;visual(details);
      assert(details.model && (details.frameNode==null || typeof details.frameNode==='string' && details.frameNode.length>0 && details.frameNode.length<=200),'Invalid electrical frame node');
      assert(details.batteryNodes && typeof details.batteryNodes==='object' && !Array.isArray(details.batteryNodes),'Invalid battery wiring nodes');
      for(const [battery,node] of Object.entries(details.batteryNodes))assert(value.parts.some(part=>part.category==='battery'&&part.id===battery) && typeof node==='string'&&node.length>0&&node.length<=200,'Invalid battery wiring binding');
    }
    if(drone.accessories){
      assert(typeof drone.accessories==='object'&&!Array.isArray(drone.accessories) && Object.keys(drone.accessories).every(key=>key==='actionCamera'),'Invalid aircraft accessories');
      for(const accessory of Object.values(drone.accessories)){
        visual(accessory);assert(accessory.model && typeof accessory.name==='string'&&accessory.name.length<=100,'Invalid action camera');
        if(accessory.mountMatrix!==undefined)assert(matrix(accessory.mountMatrix),'Invalid accessory mount');
        if(accessory.mass!==undefined)assert(number(accessory.mass,0,.5),'Invalid accessory mass');
      }
    }
    if(drone.thumbnail)assert(asset(drone.thumbnail)&&/\.(png|jpe?g)$/i.test(drone.thumbnail),'Invalid drone thumbnail');
    if(drone.sourcePhysics){
      const source=drone.sourcePhysics;
      assert(source && Array.isArray(source.motorPositions)&&source.motorPositions.length===4&&source.motorPositions.every(vec),'Invalid native motor positions');
      for(const category of categories){
        componentSpecs(source.parts?.[category],category);
        assert(vec(source.sizes?.[category])&&source.sizes[category].every(x=>number(x,.00001,2)),'Invalid stock component size');
        const stock=value.parts.find(part=>part.category===category&&part.id===drone.stockParts?.[category]);
        assert(stock?.sourceSpecs && stock.sourcePartId===source.partIds?.[category] && stock.compatibleDrones?.includes(drone.id),'Invalid stock component reference');
      }
      for(const position of Object.values(source.positions||{}))assert(vec(position),'Invalid component mass position');
      if(source.antenna){
        componentSpecs(source.antenna.specifications,'antenna');
        assert(vec(source.antenna.size)&&source.antenna.size.every(x=>number(x,.00001,2)),'Invalid antenna size');
        const antenna=value.parts.find(p=>p.category==='antenna'&&p.id===drone.stockParts.antenna);
        assert(antenna?.sourcePartId===source.antenna.sourcePartId&&antenna.compatibleDrones?.includes(drone.id),'Invalid stock antenna reference');
        assert(matrix(drone.customization?.slots?.antenna?.[0]?.matrix),'Missing native antenna slot');
      }
    }
    if(drone.groundClearance!==undefined)assert(number(drone.groundClearance,.005,2),`${drone.id}: invalid landing clearance`);
    assert(number(drone.mass,0.1,10) && number(drone.arm,0.04,0.6) && number(drone.thrustToWeight,1.1,15) && number(drone.motorTau,0.005,0.2) && vec(drone.drag) && drone.drag.every(x=>number(x,0,2)) && number(drone.angularDrag,0,2) && number(drone.batterySeconds,30,3600), `${drone.id}: invalid aircraft physics`);
    if (drone.inertia) assert(vec(drone.inertia) && drone.inertia.every(x=>number(x,.00001,10)), `${drone.id}: invalid inertia`);
    if (drone.rotorDrag) assert(vec(drone.rotorDrag) && drone.rotorDrag.every(x=>number(x,0,2)), `${drone.id}: invalid rotor drag`);
    if (drone.maxRpm !== undefined) assert(number(drone.maxRpm,1000,100000), `${drone.id}: invalid motor RPM`);
    if (drone.yawTorqueRatio !== undefined) assert(number(drone.yawTorqueRatio,.001,.2), `${drone.id}: invalid reaction torque ratio`);
    for (const sphere of drone.collision?.spheres || []) assert(vec(sphere.position) && number(sphere.radius,0.005,2), `${drone.id}: invalid collision sphere`);
    assert(!drone.collision?.spheres || drone.collision.spheres.length <= 64, 'Limit aircraft compound collision to 64 spheres');
  }
  for (const part of value.parts) {
    visual(part); transform(part);
    assert(['frame','motors','propellers','battery','camera','antenna'].includes(part.category), 'Invalid part category');
    if(part.sourceSpecs){componentSpecs(part.sourceSpecs,part.category);assert(vec(part.physicalSize)&&part.physicalSize.every(x=>number(x,.00001,2)),'Invalid native component size');}
    if(part.compatibleDrones)assert(part.compatibleDrones.every(id=>value.drones.some(drone=>drone.id===id)),'Unknown compatible airframe');
    for (const key of ['mass','thrust','response','drag','duration','durability','cost']) if (part[key] !== undefined) assert(number(part[key],key==='mass'?-1:0,key==='cost'?10000:5), `${part.id}: invalid ${key}`);
    if (part.fov !== undefined) assert(number(part.fov,75,125), 'Invalid camera FOV');
  }
  for (const entry of [...value.challenges,...value.tutorials]) {
    assert(value.maps.some(map=>map.id===entry.map && map.tracks.some(track=>track.id===entry.track)), `${entry.id}: missing course`);
    for (const object of entry.objects || []) { visual(object); assert(object.model, `${entry.id}: scene object needs a model`); transform(object); }
    validateColliders(entry.colliders || []);
  }
  for (const challenge of value.challenges) {
    assert(number(challenge.target,1,3600) && number(challenge.reward,0,10000), `${challenge.id}: invalid mission target/reward`);
    for (const hint of challenge.hints || []) assert(typeof hint.text === 'string' && hint.text.length <= 500 && Number.isInteger(hint.afterGate) && number(hint.afterGate,0,200) && (hint.lap === undefined || Number.isInteger(hint.lap) && number(hint.lap,1,20)), `${challenge.id}: invalid mission hint`);
  }
  for (const tutorial of value.tutorials) {
    if (tutorial.order !== undefined) assert(Number.isInteger(tutorial.order) && number(tutorial.order,0,1000), `${tutorial.id}: invalid lesson order`);
    if (tutorial.topic !== undefined) assert(typeof tutorial.topic === 'string' && tutorial.topic.length > 0 && tutorial.topic.length <= 80, `${tutorial.id}: invalid lesson topic`);
    if (tutorial.description !== undefined) assert(typeof tutorial.description === 'string' && tutorial.description.length <= 500, `${tutorial.id}: invalid lesson description`);
    assert(tutorial.steps?.length > 0, `${tutorial.id}: add at least one step`);
    for (const step of tutorial.steps) {
      if (step.title !== undefined) assert(typeof step.title === 'string' && step.title.length > 0 && step.title.length <= 100, tutorial.id+': invalid lesson step title');
      assert(typeof step.text==='string' && ['altitude','speed','land','gate','manual','reach'].includes(step.objective) && number(step.target,0,500) && number(step.duration,0,120), `${tutorial.id}: invalid tutorial step`);
      if (step.objective === 'reach') assert(vec(step.position) && number(step.radius,.2,100), `${tutorial.id}: invalid target position/radius`);
      if (step.position !== undefined) assert(vec(step.position) && number(step.radius,.2,100), `${tutorial.id}: invalid target position/radius`);
      if (step.maxSpeed !== undefined) assert(number(step.maxSpeed,0,100), `${tutorial.id}: invalid lesson speed limit`);
      if (step.flightMode !== undefined) assert(['angle','horizon','acro'].includes(step.flightMode), `${tutorial.id}: invalid lesson flight mode`);
      if (step.airborne !== undefined) assert(typeof step.airborne === 'boolean', `${tutorial.id}: invalid lesson airborne condition`);
      if (step.heading !== undefined) assert(number(step.heading,-Math.PI,Math.PI) && number(step.headingTolerance,.01,Math.PI), `${tutorial.id}: invalid lesson heading`);
      else assert(step.headingTolerance === undefined, `${tutorial.id}: heading tolerance needs a heading`);
      if (step.objective === 'gate') assert(Number.isInteger(step.target) && step.target < value.maps.find(map=>map.id===tutorial.map).tracks.find(track=>track.id===tutorial.track).gates.length && step.duration === 0, `${tutorial.id}: gate steps require an existing gate and zero hold duration`);
    }
  }
  assert(value.maps.length > 0 && value.drones.some(drone=>drone.id==='kestrel'), 'Install a map and keep the kestrel ID for existing saves');
  for (const category of ['frame','motors','propellers','battery','camera']) assert(value.parts.some(part=>part.category===category), `No ${category} parts`);
  return value;
}
