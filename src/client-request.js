import {retryWait,retryableStatus} from './network-recovery.js';

/** Keep one account action in flight, including its follow-up profile request. */
export class SingleAction {
  busy = false;
  async run(action) {
    if (this.busy) return;
    this.busy = true;
    try { return await action(); }
    finally { this.busy = false; }
  }
}

export async function requestJSON(url, options = {}, timeoutMs = 15000, {retryDelayMs=750}={}) {
  const attempts=(options.method||'GET').toUpperCase()==='GET'?3:1;
  for(let attempt=0;attempt<attempts;attempt++){
    options.signal?.throwIfAborted();
    try{return await requestOnce(url,options,timeoutMs);}
    catch(error){
      options.signal?.throwIfAborted();
      if(attempt+1===attempts||!error.retryable)throw error;
      await retryWait(retryDelayMs*(attempt+1),options.signal);
    }
  }
}

async function requestOnce(url,options,timeoutMs){
  const controller = new AbortController();
  const cancel=()=>controller.abort(options.signal.reason);
  options.signal?.addEventListener('abort',cancel,{once:true});
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    controller.signal.throwIfAborted();
    const data = await response.json().catch(() => {
      throw Object.assign(new Error('The game server did not send a valid response. Please try again.'),{status:response.status,retryable:retryableStatus(response.status)});
    });
    controller.signal.throwIfAborted();
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed. Please try again.');
      error.status = response.status;
      error.retryable=retryableStatus(response.status);
      throw error;
    }
    return data;
  } catch (error) {
    options.signal?.throwIfAborted();
    if (controller.signal.aborted) throw Object.assign(new Error('The server took too long to respond. Please try again.'),{retryable:true});
    if (error instanceof TypeError) throw Object.assign(new Error('Cannot reach the game server. Check your connection and try again.'),{retryable:true});
    throw error;
  } finally { clearTimeout(timeout);options.signal?.removeEventListener('abort',cancel); }
}
