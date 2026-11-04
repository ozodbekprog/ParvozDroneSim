import {selectStreamPackages} from './stream-selection.js';
const finiteVector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);

/** Bounded visual detail scheduler. The caller owns persistent distant coverage
 * and complete flight physics. A failed/late detail load never replaces it. */
export class SpatialMapStream{
 constructor(packages,{load,activate=()=>{},deactivate=()=>{},dispose=value=>value.dispose(),radius=36,retainRadius=52,lookAheadSeconds=2,maxEntries=8,maxBytes=48*1024*1024,maxConcurrent=2}={}){
  if(typeof load!=='function'||![radius,retainRadius,lookAheadSeconds,maxBytes].every(n=>Number.isFinite(n)&&n>=0)||retainRadius<radius||!Number.isInteger(maxEntries)||maxEntries<1||!Number.isInteger(maxConcurrent)||maxConcurrent<1)throw Error('Invalid stream limits');
  this.packages=packages.filter(p=>p.kind==='near'&&p.bounds);
  const ids=new Set();for(const p of this.packages){if(ids.has(p.cell)||!finiteVector(p.bounds.min)||!finiteVector(p.bounds.max)||p.bounds.min.some((n,i)=>n>p.bounds.max[i]))throw Error('Invalid stream bounds/identity');ids.add(p.cell);}
  Object.assign(this,{load,activate,deactivate,disposeResource:dispose,radius,retainRadius,lookAheadSeconds,maxEntries,maxBytes,maxConcurrent});
  this.entries=new Map();this.jobs=new Set();this.blocked=new Map();this.selected=[];this.scores=new Map();this.bytes=0;this.closed=false;this.canceled=0;this.evicted=0;
 }
 update(position,velocity=[0,0,0]){
  if(this.closed)return;if(!finiteVector(position)||!finiteVector(velocity))throw Error('Invalid stream focus');
  const ready=new Set([...this.entries].filter(([,entry])=>entry.state==='ready').map(([cell])=>cell));
  const {selected,scores}=selectStreamPackages(this.packages,position,velocity,{...this,ready});this.scores=scores;
  const key=selected.map(pkg=>pkg.cell).join('|');
  if(key!==this.selectionKey){for(const [id,error]of this.blocked)if(error.budget)this.blocked.delete(id);this.selectionKey=key;}
  this.selected=selected;const wanted=new Set(this.selected.map(p=>p.cell));
  for(const [id,entry]of this.entries)if(!wanted.has(id))this.remove(entry);
  this.pump();
 }
 remove(entry){
  if(this.entries.get(entry.pkg.cell)!==entry)return;this.entries.delete(entry.pkg.cell);entry.controller.abort();
  if(entry.state==='ready'){this.bytes-=entry.result.bytes;this.deactivate(entry.result,entry.pkg);this.disposeResource(entry.result);this.evicted++;}
  else this.canceled++;
 }
 pump(){
  if(this.closed)return;
  for(const pkg of this.selected){
   if(this.jobs.size>=this.maxConcurrent)break;
   if(this.entries.has(pkg.cell)||this.blocked.has(pkg.cell))continue;
   const entry={pkg,controller:new AbortController(),state:'loading'};this.entries.set(pkg.cell,entry);
   const job=Promise.resolve().then(()=>this.load(pkg,{signal:entry.controller.signal})).then(result=>{
    if(this.closed||this.entries.get(pkg.cell)!==entry||entry.controller.signal.aborted){this.disposeResource(result);return;}
    if(!Number.isFinite(result.bytes)||result.bytes<0){this.disposeResource(result);throw Error('Invalid resident payload estimate');}
    const failBudget=()=>{this.disposeResource(result);throw Object.assign(new Error('Detail package exceeds available resident budget'),{budget:true});};
    if(result.bytes>this.maxBytes)return failBudget();
    const worse=[...this.entries.values()].filter(other=>other.state==='ready'&&this.scores.get(other.pkg.cell)>this.scores.get(pkg.cell)).sort((a,b)=>this.scores.get(b.pkg.cell)-this.scores.get(a.pkg.cell));
    for(const other of worse){if(this.bytes+result.bytes<=this.maxBytes)break;this.blocked.set(other.pkg.cell,{message:'Detail yielded to a nearer package',budget:true});this.remove(other);}
    if(this.bytes+result.bytes>this.maxBytes)return failBudget();
    try{this.activate(result,pkg);}catch(error){this.deactivate(result,pkg);this.disposeResource(result);throw error;}
    entry.result=result;entry.state='ready';this.bytes+=result.bytes;
   }).catch(error=>{
    if(this.entries.get(pkg.cell)===entry){this.entries.delete(pkg.cell);if(error.name!=='AbortError')this.blocked.set(pkg.cell,{message:error.message,budget:!!error.budget});}
   }).finally(()=>{this.jobs.delete(job);this.pump();});
   this.jobs.add(job);
  }
 }
 retry(){this.blocked.clear();this.pump();}
 async idle(){while(this.jobs.size)await Promise.all([...this.jobs]);}
 stats(){return {ready:[...this.entries.values()].filter(e=>e.state==='ready').length,pending:this.jobs.size,selected:this.selected.map(p=>p.cell),estimatedGeometryBytes:this.bytes,maxBytes:this.maxBytes,maxEntries:this.maxEntries,canceled:this.canceled,evicted:this.evicted,errors:[...this.blocked].map(([cell,error])=>({cell,...error}))};}
 dispose(){if(this.closed)return;this.closed=true;for(const entry of this.entries.values())this.remove(entry);this.selected=[];}
}
