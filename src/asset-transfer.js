import {retryWait,retryableStatus} from './network-recovery.js';

/** Recover immutable deliveries without ever joining unverified byte ranges.
 * The timeout measures silence, not total download time on a slow connection. */
export async function transferAsset(url,{fetcher,signal,expectedBytes=0,resumable=false,onProgress=()=>{},stallMs=20000,retryDelayMs=750}={}){
 const chunks=[];let count=0,total=expectedBytes,buffer=null,canResume=false,etag=null,networkBytes=0,timingKnown=true;
 const reset=()=>{chunks.length=0;count=0;buffer=null;canResume=false;etag=null;};
 for(let attempt=0;attempt<3;attempt++){
  signal?.throwIfAborted();
  if(attempt){onProgress(count,'Reconnecting');await retryWait(retryDelayMs*attempt,signal);}
  if(count&&!canResume)reset();
  const offset=count,controller=new AbortController();let timer,reader,stalled=false,response;
  const cancel=()=>controller.abort(signal.reason);
  signal?.addEventListener('abort',cancel,{once:true});
  const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{stalled=true;controller.abort(new DOMException('Download stopped responding','TimeoutError'));},stallMs);};
  const began=globalThis.performance?.now?.()||0;
  try{
   arm();const headers=offset?{Range:`bytes=${offset}-`,...(etag?{'If-Range':etag}:{})}:undefined;
   response=await fetcher(url,{signal:controller.signal,...(headers?{headers}:{})});signal?.throwIfAborted();
   if(!response.ok)throw Object.assign(new Error(`Download failed (${response.status}): ${url}`),{retryable:retryableStatus(response.status)});
   const header=name=>response.headers?.get?.(name);
   const encoding=header('Content-Encoding'),range=header('Content-Range');
   if(response.status===206){
    const parsed=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(range||'');
    if(!offset||encoding||!parsed||Number(parsed[1])!==offset||Number(parsed[2])!==Number(parsed[3])-1||(total&&Number(parsed[3])!==total)||(etag&&header('ETag')&&header('ETag')!==etag)){
     throw Object.assign(new Error('The server returned an invalid download range. Please retry.'),{retryable:false});
    }
    total=Number(parsed[3]);
   }else{
    if(offset)reset();
    const length=!encoding?Number(header('Content-Length')):0;
    total=expectedBytes||length||0;
   }
   canResume=resumable&&!encoding&&header('Accept-Ranges')?.toLowerCase()==='bytes';
   // A 206 confirms byte-range support even when the server omits Accept-Ranges.
   if(response.status===206)canResume=true;
   etag=header('ETag');
   if(total&&!buffer){
    buffer=new Uint8Array(total);let position=0;for(const chunk of chunks){buffer.set(chunk,position);position+=chunk.length;}chunks.length=0;
   }
   reader=response.body?.getReader();
   if(reader)while(true){
    arm();const {value,done}=await reader.read();if(done)break;signal?.throwIfAborted();
    if(buffer){
     if(count+value.byteLength>buffer.length)throw Object.assign(new Error('Downloaded size does not match the catalog.'),{retryable:false,code:'SIZE_MISMATCH'});
     buffer.set(value,count);
    }else chunks.push(value);
    count+=value.byteLength;onProgress(count,'Browser delivery');
   }
   if(total&&count!==total)throw Object.assign(new Error('Downloaded size is incomplete. Please retry.'),{retryable:count<total,code:'SIZE_MISMATCH'});
   clearTimeout(timer);signal?.throwIfAborted();
   if(!buffer){buffer=new Uint8Array(count);let position=0;for(const chunk of chunks){buffer.set(chunk,position);position+=chunk.length;}}
   const absolute=new URL(url,globalThis.location?.href||'http://localhost/').href;
   const timing=globalThis.performance?.getEntriesByName?.(absolute)?.filter(item=>item.startTime>=began).at(-1);
   if(timing?.encodedBodySize)networkBytes+=timing.transferSize===0?0:timing.encodedBodySize;else timingKnown=false;
   return {bytes:buffer.buffer,source:attempt?'Network recovery':timing?.encodedBodySize&&timing.transferSize===0?'Browser cache':timing?.encodedBodySize?'Network':'Browser delivery',networkBytes:timingKnown?networkBytes:null};
  }catch(error){
   signal?.throwIfAborted();
   if(stalled)error=Object.assign(new Error('Download stopped responding. Check your connection and retry.'),{retryable:true});
   const retryable=error.retryable??(error instanceof TypeError||error.name==='AbortError');
   // An incomplete final file cannot be resumed at EOF. Retry from its beginning.
   if(total&&count>=total)reset();
   if(!retryable||attempt===2){
    if(error instanceof TypeError||error.name==='AbortError')throw Object.assign(new Error('Download interrupted. Check your connection and retry.',{cause:error}),{code:'NETWORK_UNAVAILABLE'});
    throw error;
   }
   // Failed responses cannot contribute trustworthy Resource Timing byte counts.
   timingKnown=false;
  }finally{
   clearTimeout(timer);signal?.removeEventListener('abort',cancel);
   if(reader){try{await reader.cancel();}catch{}reader.releaseLock?.();}
   else try{await response?.body?.cancel();}catch{}
  }
 }
}
