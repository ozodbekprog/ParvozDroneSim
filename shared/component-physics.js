// Source masses/electrical specifications are exact imports. Aerodynamic coefficients are estimates.
const density=1.225,inch=.0254;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const sum=values=>values.reduce((a,b)=>a+b,0);
const source=part=>part.sourceSpecs||part;
const derivedCache=new WeakMap();

export function motorPropellerCurve(motor,propeller,voltage){
  const m=source(motor),p=source(propeller),diameter=p.diameter*inch;
  const pitchRatio=Math.sqrt(p.pitch/p.diameter),bladeRatio=p.blades/3,shape=p.propConstant||1.2;
  const ct=.09*shape*pitchRatio*bladeRatio,cp=.04*shape*pitchRatio*bladeRatio;
  const kt=60/(2*Math.PI*m.velocityConstant),resistance=Math.max(.001,m.internalResistance),idle=m.noLoadI||0;
  let low=0,high=m.velocityConstant*voltage;
  for(let i=0;i<36;i++){
    const rpm=(low+high)/2,omega=rpm*Math.PI/30,n=rpm/60;
    const aerodynamicTorque=cp*density*n*n*diameter**5/(2*Math.PI);
    const electricalTorque=kt*Math.max(0,(voltage-rpm/m.velocityConstant)/resistance-idle);
    const available=Math.min(electricalTorque,m.maxPower*.8/Math.max(omega,1));
    if(available>aerodynamicTorque)low=rpm;else high=rpm;
  }
  const rpm=(low+high)/2,n=rpm/60,omega=rpm*Math.PI/30;
  const power=cp*density*n**3*diameter**5;
  const rotorInertia=.1*m.weight*(m.diameter/2000)**2 + .25*p.weight*(diameter/2)**2;
  const damping=kt*kt/resistance + 2*cp*density*omega*diameter**5/(2*Math.PI)**3;
  return {rpm,thrust:ct*density*n*n*diameter**4,power,tau:clamp(.012+rotorInertia/Math.max(damping,.000001),.005,.2)};
}

function intrinsic(part,category){
  const value=source(part),size=part.physicalSize||[.04,.02,.06];
  if(category==='propellers'){
    const r=value.diameter*inch/2;return [.25,.5,.25].map(factor=>factor*value.weight*r*r);
  }
  return [0,1,2].map(axis=>value.weight*(size[(axis+1)%3]**2+size[(axis+2)%3]**2)/12);
}

/** Resolve all hardware effects together, including the propeller's load on the selected motor. */
export function nativeComponentPhysics(base,parts){
  if(!base.sourcePhysics)return null;
  const inputs=Object.values(parts),key=inputs.map(part=>part.id).join(':');
  let cache=derivedCache.get(base);if(!cache){cache=new Map();derivedCache.set(base,cache);}
  const cached=cache.get(key);if(cached?.inputs.every((part,index)=>part===inputs[index]))return cached.value;
  const stock={...base.sourcePhysics.parts},effective={};
  for(const category of ['frame','motors','propellers','battery','camera'])effective[category]=parts[category].sourceSpecs?parts[category]:{sourceSpecs:stock[category],physicalSize:base.sourcePhysics.sizes?.[category]};
  if(base.sourcePhysics.antenna&&parts.antenna?.sourceSpecs){stock.antenna=base.sourcePhysics.antenna.specifications;effective.antenna=parts.antenna;}
  const weights=category=>effective[category].sourceSpecs.weight-stock[category].weight;
  const legacyMass=sum(Object.values(parts).filter(part=>!part.sourceSpecs).map(part=>part.mass||0));
  const mass=Math.max(.1,base.mass+weights('frame')+weights('battery')+weights('camera')+4*weights('motors')+4*weights('propellers')+(effective.antenna?weights('antenna'):0)+legacyMass);
  const battery=effective.battery.sourceSpecs,motor=effective.motors.sourceSpecs,prop=effective.propellers.sourceSpecs;
  const nominalVoltage=battery.voltagePerCell*battery.numberOfCells;
  const curve=motorPropellerCurve(motor,prop,nominalVoltage);
  const reference=motorPropellerCurve(stock.motors,stock.propellers,stock.battery.voltagePerCell*stock.battery.numberOfCells);
  const thrustMultiplier=(parts.motors.sourceSpecs?1:parts.motors.thrust)*(parts.propellers.sourceSpecs?1:parts.propellers.thrust);
  const thrustToWeight=base.thrustToWeight*base.mass/mass*curve.thrust/reference.thrust*thrustMultiplier;
  const inertia=(base.inertia||[.55,.95,.55].map(factor=>base.mass*base.arm**2*factor)).slice();
  const positions=base.sourcePhysics.motorPositions||[[-base.arm,0,-base.arm],[base.arm,0,-base.arm],[base.arm,0,base.arm],[-base.arm,0,base.arm]];
  for(const category of Object.keys(effective)){
    const count=['motors','propellers'].includes(category)?4:1;
    const old={sourceSpecs:stock[category],physicalSize:category==='antenna'?base.sourcePhysics.antenna.size:base.sourcePhysics.sizes?.[category]};
    const nextIntrinsic=intrinsic(effective[category],category),previousIntrinsic=intrinsic(old,category);
    for(let axis=0;axis<3;axis++){
      inertia[axis]+=count*(nextIntrinsic[axis]-previousIntrinsic[axis]);
      for(let i=0;i<count;i++){
        const position=count===4?positions[i]:category==='antenna'?base.customization?.slots?.antenna?.[0]?.matrix?.slice(12,15)||[0,0,0]:base.sourcePhysics.positions?.[category]||[0,0,0];
        inertia[axis]+=weights(category)*(position[(axis+1)%3]**2+position[(axis+2)%3]**2);
      }
      inertia[axis]=Math.max(.00001,inertia[axis]);
    }
  }
  const energyWh=battery.mAh/1000*nominalVoltage;
  const referenceEnergy=stock.battery.mAh/1000*stock.battery.voltagePerCell*stock.battery.numberOfCells;
  const propDrag=(prop.diameter/stock.propellers.diameter)**2*(prop.blades/stock.propellers.blades);
  const voltageSamples=Array.from({length:13},(_,i)=>{
    const voltage=nominalVoltage*(.45+i*.075);return {voltage,rpm:motorPropellerCurve(motor,prop,voltage).rpm};
  });
  const value={mass,inertia,thrustToWeight,motorTau:clamp(base.motorTau*curve.tau/reference.tau/(parts.motors.sourceSpecs?1:parts.motors.response),.005,.2),maxRpm:curve.rpm,propellerBlades:prop.blades,
    rotorDrag:(base.rotorDrag||[.06,.012,.045]).map(value=>value*propDrag*(parts.propellers.sourceSpecs?1:parts.propellers.drag)),
    drag:base.drag.map(value=>value*Math.sqrt(propDrag)*(parts.propellers.sourceSpecs?1:parts.propellers.drag)),
    batterySeconds:base.batterySeconds*energyWh/referenceEnergy/(mass/base.mass)**1.5*(parts.battery.sourceSpecs?1:parts.battery.duration),
    nativePower:{nominalVoltage,energyWh,cells:battery.numberOfCells,resistance:battery.cellResistance*battery.numberOfCells,peakMechanicalWatts:curve.power*4,efficiency:.8,idleWatts:6,voltageSamples},
    componentMasses:Object.fromEntries(Object.entries(effective).map(([category,part])=>[category,part.sourceSpecs.weight*(['motors','propellers'].includes(category)?4:1)]))};
  if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{inputs,value});return value;
}

export function nativeBatteryState(state,spec){
  const p=spec.nativePower;if(!p)return null;
  const openVoltage=p.cells*(3.2+clamp(state.battery,0,1));
  const atVoltage=voltage=>{
    const samples=p.voltageSamples;
    for(let i=1;i<samples.length;i++)if(voltage<=samples[i].voltage){
      const a=samples[i-1],b=samples[i],f=clamp((voltage-a.voltage)/(b.voltage-a.voltage),0,1);return a.rpm+(b.rpm-a.rpm)*f;
    }
    return samples.at(-1).rpm;
  };
  const consumption=rpm=>p.idleWatts+p.peakMechanicalWatts/p.efficiency*(rpm/spec.maxRpm)**3*sum(state.motors.map(speed=>Math.max(0,speed)**3))/4;
  let voltage=openVoltage;
  for(let i=0;i<3;i++){const watts=consumption(atVoltage(voltage));voltage=(voltage+Math.max(openVoltage*.45,openVoltage-watts/Math.max(voltage,1)*p.resistance))/2;}
  const rpm=atVoltage(voltage);
  return {rpm,thrustScale:(rpm/spec.maxRpm)**2,watts:consumption(rpm),voltage};
}
