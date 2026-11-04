import {TilesRenderer} from '3d-tiles-renderer/three';
import {PriorityQueue,DownloadPriorityQueue} from '3d-tiles-renderer/core';
import {selectStreamPackages} from '../src/stream-selection.js';

function box(bounds){
 const {min,max}=bounds;
 if(![min,max].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||min.some((n,i)=>n>max[i]))throw Error('Invalid tile bounds');
 // Parvoz (x,y,z) -> local right-handed Z-up (x,-z,y).
 const center=min.map((n,i)=>(n+max[i])/2),half=min.map((n,i)=>(max[i]-n)/2);
 return [center[0],-center[2],center[1],half[0],0,0,0,half[2],0,0,0,half[1]].map(n=>n===0?0:n);
}
export function createLocalTileset(manifest,manifestURL){
 if(manifest.version!==2||!manifest.experiment)throw Error('Expected compiled streaming experiment');
 const coverage=manifest.packages.find(p=>p.kind==='coarse');if(!coverage?.bounds)throw Error('Missing persistent coarse coverage');
 const allBounds=manifest.packages.filter(p=>p.bounds).map(p=>p.bounds),rootBounds={min:[0,1,2].map(i=>Math.min(...allBounds.map(b=>b.min[i]))),max:[0,1,2].map(i=>Math.max(...allBounds.map(b=>b.max[i])))};
 return {asset:{version:'1.0'},extensionsUsed:['3DTILES_content_gltf'],geometricError:1e6,root:{boundingVolume:{box:box(rootBounds)},geometricError:1e6,refine:'ADD',children:manifest.packages.filter(p=>p.kind==='near').map(pkg=>({boundingVolume:{box:box(pkg.bounds)},geometricError:0,content:{uri:new URL(pkg.model,manifestURL).href},extras:{parvozCell:pkg.cell}}))}};
}

/** Isolated existing-library challenger, never imported by the game.
 * Same compiled packages, loader and texture leases as the grid control.
 * Flat near-tile hierarchy: this does NOT qualify measured HLOD/SSE quality.
 * Resident geometry admission excludes decode/upload transients and textures. */
class OwnedTilesRenderer extends TilesRenderer{
 constructor(owner,rootURL){super(rootURL);this.owner=owner;}
 async loadRootTileset(){const root=createLocalTileset(this.owner.manifest,this.owner.manifestURL);this.preprocessTileset(root,this.rootURL);return root;}
 async fetchData(url,{signal}={}){return this.owner.loader.readVerified(url,signal);}
 async parseTile(bytes,tile,_extension,_url,signal){
  const owner=this.owner,pkg=owner.packages.get(tile.extras?.parvozCell);
  if(!pkg)throw Error('Unknown compiled tile');
  const job=owner.loader.load(pkg,{signal,modelBytes:bytes});owner.pending.add(job);
  let result;
  try{
   result=await job;
   if(owner.closed||signal.aborted)throw new DOMException('Tile canceled','AbortError');
   if(!Number.isFinite(result.bytes)||result.bytes<0||owner.bytes+result.bytes>owner.maxBytes)throw Error('Detail exceeds resident geometry budget');
   result.group.rotation.x+=Math.PI/2;
   tile.engineData.scene=result.group;
   // The shared loader owns all resources. Library disposal must not destroy
   // texture leases still used by another tile or persistent coarse coverage.
   tile.engineData.geometry=[];tile.engineData.materials=[];tile.engineData.textures=[];
   owner.results.set(tile,{result,pkg});owner.bytes+=result.bytes;owner.loaded++;
  }catch(error){result?.dispose();throw error;}
  finally{owner.pending.delete(job);}
 }
 calculateBytesUsed(tile){return this.owner.results.get(tile)?.result.bytes||0;}
 calculateTileViewError(tile,target){
  super.calculateTileViewError(tile,target);
  const cell=tile.extras?.parvozCell;
  if(cell&&!this.owner.allowed.has(cell)){target.inView=false;target.error=0;target.distanceFromCamera=Infinity;}
 }
 setTileVisible(tile,visible){
  const entry=this.owner.results.get(tile);
  if(entry){if(visible)this.owner.activate(entry.result,entry.pkg);else this.owner.deactivate(entry.result,entry.pkg);}
  super.setTileVisible(tile,visible);
 }
 disposeTile(tile){
  const owner=this.owner,entry=owner.results.get(tile);
  if(entry){owner.deactivate(entry.result,entry.pkg);entry.result.dispose();owner.bytes-=entry.result.bytes;owner.results.delete(tile);owner.evicted++;}
  // The override remains installed while super.dispose unregisters plugins.
  super.disposeTile(tile);
 }
}

export class TilesMapStream{
 constructor(manifest,manifestURL,{loader,camera,activate=()=>{},deactivate=()=>{},maxEntries=8,maxBytes=48*2**20,maxConcurrent=2,radius=36,retainRadius=52,lookAheadSeconds=2}={}){
  if(!loader||!camera||!Number.isInteger(maxEntries)||maxEntries<1||!Number.isFinite(maxBytes)||maxBytes<0||!Number.isInteger(maxConcurrent)||maxConcurrent<1)throw Error('Invalid tile experiment options');
  if(![radius,retainRadius,lookAheadSeconds].every(n=>Number.isFinite(n)&&n>=0)||retainRadius<radius)throw Error('Invalid tile admission policy');
  Object.assign(this,{manifest,manifestURL,loader,camera,activate,deactivate,maxBytes,maxEntries,radius,retainRadius,lookAheadSeconds});this.allowed=new Set();
  this.packages=new Map(manifest.packages.filter(p=>p.kind==='near').map(p=>[p.cell,p]));this.results=new Map();this.pending=new Set();this.bytes=0;this.loaded=0;this.evicted=0;this.closed=false;this.errors=[];
  const tiles=this.tiles=new OwnedTilesRenderer(this,new URL('comparison-tileset.json',manifestURL).href);
  const download=new DownloadPriorityQueue();download.priorityCallback=tiles.downloadQueue.priorityCallback;download.maxJobsPerOrigin=maxConcurrent;tiles.downloadQueue=download;
  const parse=new PriorityQueue();parse.priorityCallback=tiles.parseQueue.priorityCallback;parse.maxJobs=maxConcurrent;tiles.parseQueue=parse;
  const nodes=new PriorityQueue();nodes.priorityCallback=tiles.processNodeQueue.priorityCallback;nodes.maxJobs=tiles.processNodeQueue.maxJobs;tiles.processNodeQueue=nodes;
  tiles.loadSiblings=false;
  // LRU slots include in-flight placeholders. Candidate admission below caps
  // actual wanted cells; leave queue headroom so a completing cell is not
  // immediately rejected solely because its placeholder filled the cache.
  tiles.lruCache.minSize=0;tiles.lruCache.maxSize=maxEntries+maxConcurrent;tiles.lruCache.minBytesSize=0;tiles.lruCache.maxBytesSize=maxBytes;tiles.lruCache.unloadPercent=1;
  tiles.group.rotation.x=-Math.PI/2;tiles.setCamera(camera);tiles.setResolution(camera,1280,720);
  tiles.addEventListener('load-error',event=>{if(!this.closed)this.errors.push({cell:event.tile?.extras?.parvozCell||null,message:event.error.message});});
 }
 get group(){return this.tiles.group;}
 update(position=this.camera.position.toArray(),velocity=[0,0,0]){
  if(this.closed)return;
  const ready=new Set([...this.results.values()].map(entry=>entry.pkg.cell));
  const {selected}=selectStreamPackages([...this.packages.values()],position,velocity,{...this,ready});this.allowed=new Set(selected.map(pkg=>pkg.cell));
  const stale=[];
  this.tiles.traverse(tile=>{const cell=tile.extras?.parvozCell;if(cell&&!this.allowed.has(cell))stale.push(tile);return false;},null,false);
  for(const tile of stale)this.tiles.lruCache.remove(tile);
  this.camera.updateMatrixWorld();this.tiles.group.updateMatrixWorld(true);this.tiles.update();
 }
 retry(){this.errors.length=0;this.tiles.resetFailedTiles();}
 async idle(){
  let stable=0;
  for(let i=0;i<1200;i++){
   if(this.closed&&!this.pending.size)return;
   this.update();await new Promise(resolve=>setTimeout(resolve,25));
   if(this.tiles.root&&!this.tiles.downloadQueue.running&&!this.tiles.parseQueue.running&&!this.tiles.processNodeQueue.running&&!this.pending.size)stable++;else stable=0;
   // Root completion precedes the next traversal. Require consecutive settled
   // updates rather than treating a fetched root as loaded detail.
   if(stable>=2)return;
  }
  throw Error('Tile experiment did not settle in 30 seconds');
 }
 stats(){return {scheduler:'3d-tiles-renderer@0.5.3',flatHierarchy:true,physicsIncluded:false,totalBrowserMemoryBounded:false,ready:this.results.size,pending:this.pending.size,estimatedGeometryBytes:this.bytes,maxBytes:this.maxBytes,loaded:this.loaded,evicted:this.evicted,visible:[...this.tiles.visibleTiles].map(t=>t.extras?.parvozCell).filter(Boolean).sort(),queues:{download:this.tiles.downloadQueue.running,parse:this.tiles.parseQueue.running,node:this.tiles.processNodeQueue.running,nodeJobs:this.tiles.processNodeQueue.currJobs,nodeWaiting:this.tiles.processNodeQueue.items.length},library:{...this.tiles.stats},errors:this.errors.slice(-12)};}
 dispose(){if(this.closed)return;this.closed=true;this.tiles.dispose();this.group.removeFromParent();}
}
