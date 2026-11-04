const KEY='parvoz-loading-times-v1';
const processing=['Processing models','Planning race opponents','Preparing graphics'];
const download=phase=>/Downloading|cached/i.test(phase);
const seconds=ms=>Math.max(1,Math.ceil(ms/1000));
const optionalStorage=()=>{try{return globalThis.localStorage;}catch{return undefined;}};

/** Download rate is observed; preparation estimates require a matching completed run. */
export class LoadingEstimate {
  constructor(key,{storage=optionalStorage(),now=0}={}) {
    this.key=key;this.storage=storage;this.samples=[];this.durations={};this.phase=null;this.phaseAt=now;
    try{this.history=JSON.parse(storage?.getItem(KEY)||'{}');}catch{this.history={};}
    if(!this.history||Array.isArray(this.history)||typeof this.history!=='object')this.history={};
    this.prior=this.history[key]?.durations||{};
  }
  stage(phase,now) {
    if(phase===this.phase)return;
    if(this.phase&&processing.includes(this.phase))this.durations[this.phase]=(this.durations[this.phase]||0)+now-this.phaseAt;
    this.phase=phase;this.phaseAt=now;
  }
  estimate(now,{loaded,total,done},deliveredBytes) {
    const after=processing.slice(Math.max(0,processing.indexOf(this.phase)));
    const known=phase=>Number.isFinite(this.prior[phase])&&this.prior[phase]>0&&this.prior[phase]<600000;
    if(download(this.phase)){
      this.samples.push({now,bytes:deliveredBytes});
      while(this.samples.length>1&&this.samples[1].now<now-5000)this.samples.shift();
      if(this.samples.length>128)this.samples.splice(0,this.samples.length-128);
      const first=this.samples[0],span=now-first.now,delta=deliveredBytes-first.bytes;
      if(done||!total||span<1500||delta<=0||this.samples.at(-1).bytes<first.bytes)return null;
      const remaining=(Math.max(0,total-loaded)/(delta/span));
      // With no observed processing history, label this as download time only.
      const tail=processing.filter(known);
      const hasPreparation=tail.includes('Processing models')&&tail.includes('Preparing graphics');
      return {seconds:seconds(remaining+(hasPreparation?tail.reduce((n,p)=>n+this.prior[p],0):0)),scope:hasPreparation?'ready':'download'};
    }
    if(!processing.includes(this.phase)||!known(this.phase))return null;
    const remaining=after.filter(known).reduce((n,p)=>n+this.prior[p],0)-(now-this.phaseAt);
    return remaining>0?{seconds:seconds(remaining),scope:'ready'}:null;
  }
  finish(now) {
    this.stage('Ready',now);
    const durations=Object.fromEntries(Object.entries(this.durations).filter(([,ms])=>Number.isFinite(ms)&&ms>0&&ms<600000).map(([phase,ms])=>[phase,Number.isFinite(this.prior[phase])?(this.prior[phase]+ms)/2:ms]));
    if(!Object.keys(durations).length)return;
    const entries=Object.entries(this.history).filter(([key])=>key!==this.key).slice(-7);
    entries.push([this.key,{durations}]);
    try{this.storage?.setItem(KEY,JSON.stringify(Object.fromEntries(entries)));}catch{/* Estimates never gate flight readiness. */}
  }
}
