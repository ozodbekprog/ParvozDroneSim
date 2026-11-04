/** Wait between bounded read retries; a departing scene must never restart later. */
export function retryWait(ms,signal){
 signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const finish=()=>{signal?.removeEventListener('abort',abort);resolve();};
  const timer=setTimeout(finish,ms);
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal.reason||new DOMException('Canceled','AbortError'));};
  signal?.addEventListener('abort',abort,{once:true});
 });
}
export const retryableStatus=status=>[408,425,429,500,502,503,504].includes(status);
