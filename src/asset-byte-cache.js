const MIB=1024*1024;
export function defaultAssetByteCacheLimit({deviceMemory=Number(globalThis.navigator?.deviceMemory)||0,cores=Number(globalThis.navigator?.hardwareConcurrency)||0}={}){
  if(deviceMemory>=8||(!deviceMemory&&cores>=8))return 320*MIB;
  if(deviceMemory>=4||(!deviceMemory&&cores>=4))return 160*MIB;
  return 64*MIB;
}
/** Retain compressed immutable deliveries, never decoded GPU resources. */
export class AssetByteCache {
  constructor(limit=64*MIB){this.limit=limit;this.bytes=0;this.entries=new Map();}
  get(url,expectedBytes=0){const value=this.entries.get(url);if(!value)return;if(expectedBytes&&value.byteLength!==expectedBytes){this.delete(url);return;}this.entries.delete(url);this.entries.set(url,value);return value;}
  has(url,expectedBytes=0){return !!this.get(url,expectedBytes);}
  delete(url){const value=this.entries.get(url);if(value){this.bytes-=value.byteLength;this.entries.delete(url);}}
  set(url,value){
    if(!/\/content\/assets\/.*-[a-f0-9]{16}\.(glb|json|pcol|png|jpe?g)$/i.test(url)||value.byteLength>this.limit)return;
    const prior=this.entries.get(url);if(prior){this.bytes-=prior.byteLength;this.entries.delete(url);}
    while(this.entries.size&&this.bytes+value.byteLength>this.limit){const [old,bytes]=this.entries.entries().next().value;this.entries.delete(old);this.bytes-=bytes.byteLength;}
    this.entries.set(url,value);this.bytes+=value.byteLength;
  }
}
export const assetByteCache=new AssetByteCache(defaultAssetByteCacheLimit());
