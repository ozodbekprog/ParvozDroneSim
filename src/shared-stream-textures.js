const aborted=()=>new DOMException('Texture request canceled','AbortError');
const budgetError=()=>Object.assign(new Error('Shared texture budget exceeded'),{code:'TEXTURE_BUDGET'});
const textureBytes=texture=>texture.mipmaps?.length?texture.mipmaps.reduce((n,m)=>n+(m.data?.byteLength||0),0):(texture.image?.data?.byteLength||((texture.image?.width||1)*(texture.image?.height||1)*4));
const configuration=texture=>JSON.stringify([
 ...['mapping','channel','wrapS','wrapT','magFilter','minFilter','anisotropy','format','internalFormat','type','colorSpace','flipY','generateMipmaps','premultiplyAlpha','unpackAlignment','compareFunction','matrixAutoUpdate','rotation'].map(key=>texture[key]??null),
 ...['offset','repeat','center','matrix'].map(key=>texture[key]?.toArray?.()||null)
]);

/** Shared decoded images and fully configured Texture objects. Ownership is by
 * chunk lease, so retiring one chunk cannot dispose another chunk's texture.
 * The limit estimates CPU payload + configured GPU payload, excluding drivers. */
export class SharedStreamTextures{
 constructor(load,{maxBytes=64*1024*1024}={}){this.load=load;this.maxBytes=maxBytes;this.entries=new Map();this.bytes=0;this.closed=false;}
 acquire(url,{signal}={}){
  if(this.closed||signal?.aborted)throw aborted();
  let entry=this.entries.get(url);
  if(!entry){
   entry={url,refs:0,controller:new AbortController(),configurations:new Map(),bytes:0,retired:false};this.entries.set(url,entry);
   entry.promise=Promise.resolve().then(()=>this.load(url,entry.controller.signal)).then(texture=>{
    if(entry.retired){texture.dispose();throw aborted();}
    const size=textureBytes(texture);
    if(this.bytes+size>this.maxBytes){texture.dispose();throw budgetError();}
    entry.base=texture;entry.bytes=size;this.bytes+=size;return texture;
   }).catch(error=>{this.retire(entry);throw error;});
   entry.promise.catch(()=>{});
  }
  entry.refs++;let released=false,pending=true,rejectLease;const owned=new Set();
  const release=(error=aborted())=>{
   if(released)return;released=true;signal?.removeEventListener('abort',cancel);
   if(pending){pending=false;rejectLease(error);}
   for(const key of owned){const item=entry.configurations.get(key);if(item&&--item.refs===0){item.texture.dispose();entry.configurations.delete(key);this.bytes-=entry.bytes;}}
   if(--entry.refs===0)this.retire(entry);
  };
  const cancel=()=>release();
  const ready=new Promise((yes,no)=>{rejectLease=no;entry.promise.then(texture=>{if(!released){pending=false;yes(texture);}},error=>release(error));});
  ready.catch(()=>{});signal?.addEventListener('abort',cancel,{once:true});
  return {ready,release,intern:texture=>{
   if(released||entry.retired||!entry.base)throw aborted();
   const key=configuration(texture);let item=entry.configurations.get(key);
   if(!item){
    if(this.bytes+entry.bytes>this.maxBytes)throw budgetError();
    item={texture,refs:0};entry.configurations.set(key,item);this.bytes+=entry.bytes;
   }
   if(!owned.has(key)){owned.add(key);item.refs++;}
   return item.texture;
  }};
 }
 retire(entry){
  if(entry.retired)return;entry.retired=true;entry.controller.abort();
  if(this.entries.get(entry.url)===entry)this.entries.delete(entry.url);
  for(const item of entry.configurations.values()){item.texture.dispose();this.bytes-=entry.bytes;}
  entry.configurations.clear();if(entry.base){entry.base.dispose();this.bytes-=entry.bytes;}
 }
 stats(){return {images:this.entries.size,pending:[...this.entries.values()].filter(e=>!e.base).length,textures:[...this.entries.values()].reduce((n,e)=>n+e.configurations.size,0),estimatedBytes:this.bytes,maxBytes:this.maxBytes};}
 dispose(){if(this.closed)return;this.closed=true;for(const entry of this.entries.values())this.retire(entry);}
}
