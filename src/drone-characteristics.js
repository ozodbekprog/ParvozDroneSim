import {resolveBuild} from '../shared/physics.js';
const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const metrics=[
  {id:'mass',label:'Weight',unit:'g',max:1200,digits:0,value:s=>s.mass*1000},
  {id:'thrust',label:'Thrust / weight',unit:'×',max:12,digits:1,value:s=>s.thrustToWeight},
  {id:'response',label:'Motor response / Delay',unit:'ms',max:200,digits:1,value:s=>s.motorTau*1000},
  {id:'energy',label:'Battery energy',unit:'Wh',max:60,digits:1,value:s=>s.nativePower?.energyWh??null},
  {id:'endurance',label:'Est. flight time',unit:'min',max:20,digits:1,value:s=>s.batterySeconds/60}
];

/** Display the same derived values used by flight; scales are physical values, not ratings. */
export function buildCharacteristics(build,baseline) {
  const spec=resolveBuild(build),before=baseline?resolveBuild(baseline):null;
  return metrics.map(metric=>{
    const value=metric.value(spec),previous=before?metric.value(before):null;
    const delta=value!==null&&previous!==null?value-previous:null;
    return {...metric,value,previous,delta};
  });
}

export function characteristicsHTML(build,{baseline,comparisonLabel='Compared with saved build'}={}) {
  const format=(n,digits)=>n.toFixed(digits),percent=(value,max)=>Math.max(0,Math.min(100,value/max*100));
  const spec=resolveBuild(build);
  return `<section class="characteristics" aria-label="Drone characteristics"><h2>Characteristics</h2>${baseline?`<p class="characteristics-comparison">${html(comparisonLabel)}</p>`:''}
    ${buildCharacteristics(build,baseline).map(m=>{
      const known=Number.isFinite(m.value),changed=Number.isFinite(m.delta)&&Math.abs(m.delta)>=.5*10**-m.digits;
      return `<div class="characteristic" data-characteristic="${m.id}"><div class="characteristic-label"><span>${m.label}</span><strong translate="no">${known?`${format(m.value,m.digits)} ${m.unit}`:'—'}</strong></div>
        <div class="characteristic-track" aria-hidden="true" title="0–${m.max} ${m.unit}"><span style="width:${known?percent(m.value,m.max):0}%"></span>${changed?`<i style="left:${percent(m.previous,m.max)}%"></i>`:''}</div>
        ${changed?`<small class="characteristic-delta" translate="no">${format(m.previous,m.digits)} → ${format(m.value,m.digits)} ${m.unit} (${m.delta>0?'+':''}${format(m.delta,m.digits)})</small>`:!known?'<small>Data unavailable</small>':''}</div>`;
    }).join('')}
    <p class="characteristic-label"><span>Camera</span><strong translate="no">${spec.fov}°</strong></p>
    <p class="characteristics-note">Response and endurance are simulation estimates.</p></section>`;
}

export function partSpecifications(part,category) {
  const s=part?.sourceSpecs;if(!part)return [];
  if(s){
    const rows=[];
    if(Number.isFinite(s.weight))rows.push({label:['motors','propellers'].includes(category)?'Weight per item':'Weight',value:(s.weight*1000).toFixed(1)+' g'});
    if(['motors','propellers'].includes(category)&&Number.isFinite(s.weight))rows.push({label:'Set of four',value:(s.weight*4000).toFixed(1)+' g'});
    if(category==='motors')rows.push({label:'Velocity constant',value:s.velocityConstant+' KV'},{label:'Stator',value:`${s.diameter} × ${s.StatorLength} mm`},{label:'Maximum power',value:s.maxPower+' W'});
    if(category==='propellers')rows.push({label:'Diameter / pitch',value:`${s.diameter} × ${s.pitch} in`},{label:'Blades',value:String(s.blades)});
    if(category==='battery')rows.push({label:'Cells',value:s.numberOfCells+'S'},{label:'Capacity',value:s.mAh+' mAh'},{label:'Nominal voltage',value:(s.numberOfCells*s.voltagePerCell).toFixed(1)+' V'},{label:'Battery energy',value:(s.numberOfCells*s.voltagePerCell*s.mAh/1000).toFixed(1)+' Wh'});
    return rows;
  }
  const signed=n=>(n>=0?'+':'')+n;
  if(category==='frame')return [{label:'Weight change',value:signed(part.mass*1000)+' g'},{label:'Durability',value:part.durability+'×'}];
  if(category==='motors')return [{label:'Thrust multiplier',value:part.thrust+'×'},{label:'Response multiplier',value:part.response+'×'}];
  if(category==='propellers')return [{label:'Thrust multiplier',value:part.thrust+'×'},{label:'Drag multiplier',value:part.drag+'×'}];
  if(category==='battery')return [{label:'Endurance multiplier',value:part.duration+'×'},{label:'Weight change',value:signed(part.mass*1000)+' g'}];
  if(category==='camera')return [{label:'Field of view',value:part.fov+'°'}];
  return [];
}
