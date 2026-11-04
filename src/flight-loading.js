import { AssetProgress } from './asset-progress.js';
import { assetByteCache } from './asset-byte-cache.js';
import { assetDelivery, expectedAssetBytes } from './asset-delivery.js';
import {loadingPercent, loadingStage, loadingDetail} from './loading-progress.js';
import {shuffledLoadingShots} from './loading-gallery.js';
import {LoadingEstimate} from './loading-estimate.js';
import {localizedText} from './i18n.js';

const prepared = new Map();
export const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
export function preparedBytes(url) { return prepared.get(url)?.bytes || assetByteCache.get(url, expectedAssetBytes(url)); }

export class FlightLoading {
  constructor(urls, assets, { cached = () => false, onCancel, onRetry, title = 'Preparing flight',timingKey='' } = {}) {
    this.abort = new AbortController(); this.urls = [...new Set(urls)]; this.progress = new AssetProgress(this.urls, assets); this.cached = cached;
    this.started=performance.now();this.sources=new Map();this.networkBytes=0;this.phase='Downloading assets';
    this.timingKey=timingKey;
    this.estimate=new LoadingEstimate(JSON.stringify([timingKey,this.urls]),{now:this.started});
    this.overlay = document.createElement('div'); this.overlay.className = 'flight-loading';
    this.overlay.setAttribute('role', 'dialog'); this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', title);
    this.overlay.innerHTML = '<div class="loading-gallery" aria-hidden="true"></div><div class="loading-brand">PARVOZ<span>DRONE SIMULATOR</span></div><div class="loading-card"><h2></h2><div class="loading-status"><p class="loading-stage" aria-live="polite"></p><output class="loading-percent"></output></div><progress max="100" value="0" aria-label="Preparation progress"></progress><p class="loading-error" role="alert"></p><div class="panel-actions"><button class="button ghost loading-cancel">Cancel</button><button class="button primary loading-retry hidden">Retry</button></div></div>';
    this.overlay.querySelector('h2').textContent = title;
    this.overlay.querySelector('.loading-cancel').onclick = onCancel;
    this.overlay.querySelector('.loading-retry').onclick = onRetry;
    document.querySelector('#app').appendChild(this.overlay);
    const detail=document.createElement('p');detail.className='loading-detail';
    const phase=document.createElement('span');phase.className='loading-phase';
    const metrics=document.createElement('span');metrics.className='loading-metrics';metrics.setAttribute('translate','no');
    detail.append(phase,metrics);this.overlay.querySelector('progress').after(detail);
    const eta=document.createElement('p');eta.className='loading-eta';this.overlay.querySelector('progress').after(eta);
    this.stage('Downloading assets'); this.update();
    this.timer=setInterval(()=>this.update(),500);this.timer.unref?.();
  }
  check() { this.abort.signal.throwIfAborted(); }
  stage(text) { this.check();this.estimate.stage(text,performance.now());this.phase=text; this.overlay.querySelector('.loading-stage').textContent = loadingStage(text);this.overlay.querySelector('.loading-phase').textContent=/^Ready/.test(text)?'':text;this.update(true); }
  setSlides() {
    clearInterval(this.slidesTimer);
    const gallery=this.overlay.querySelector('.loading-gallery');gallery.replaceChildren();
    const images=[];let active=null;
    for(const source of shuffledLoadingShots()) {
      const image=document.createElement('img');image.alt='';image.className='loading-shot';image.decoding='async';
      image.onload=()=>{if(!active){image.classList.add('active');active=image;}};
      image.src=source;images.push(image);gallery.appendChild(image);
    }
    this.slidesTimer=setInterval(()=>{
      const ready=images.filter(image=>image.complete&&image.naturalWidth);
      if(ready.length<2)return;
      const next=ready[(ready.indexOf(active)+1)%ready.length];
      active?.classList.remove('active');next.classList.add('active');active=next;
    },6500);
    this.slidesTimer.unref?.();
  }
  update(force=false) {
    const now=performance.now();
    if(!force && this.lastUpdate!==undefined && now-this.lastUpdate<100)return;
    this.lastUpdate=now;
    const percent=loadingPercent(this.phase,this.progress.value());
    this.overlay.querySelector('progress').value=percent;
    this.overlay.querySelector('.loading-percent').textContent=`${percent}%`;
    this.overlay.querySelector('.loading-metrics').textContent=loadingDetail(this.phase,this.progress.value(),now-this.started);
    const delivered=[...this.sources.values()].filter(item=>!/cache/i.test(item.source)).reduce((n,item)=>n+item.loaded,0);
    const estimate=this.estimate.estimate(now,this.progress.value(),delivered);
    const label=!this.urls.length||/^Ready/.test(this.phase)?'':estimate?
      (estimate.scope==='ready'?`About ${estimate.seconds} seconds remaining`:`Download: about ${estimate.seconds} seconds remaining`):'Estimating remaining time…';
    localizedText(this.overlay.querySelector('.loading-eta'),label);
  }
  async download() {
    await nextPaint(); this.check();
    if(this.urls.every(url=>this.cached(url)||assetByteCache.has(url,this.progress.files.get(url).total)))this.stage('Using cached assets');
    let cursor = 0;
    const worker = async () => {
      while (cursor < this.urls.length) {
        const url = this.urls[cursor++]; this.check();
        if (this.cached(url)||assetByteCache.has(url,this.progress.files.get(url).total)) { const size = this.progress.files.get(url).total;this.sources.set(url,{loaded:size,source:'Memory cache'}); this.progress.update(url, size, size, true); this.update(); continue; }
        const result=await assetDelivery.get(url,{signal:this.abort.signal,expectedBytes:this.progress.files.get(url).total,onProgress:(loaded,source)=>{
          this.check();this.sources.set(url,{loaded,source});this.progress.update(url,loaded);this.update();
        }});
        this.check();prepared.set(url, { owner: this, bytes: result.bytes });
        this.networkBytes+=result.networkBytes||0;
        this.progress.update(url, result.bytes.byteLength, result.bytes.byteLength, true); this.update(true);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, this.urls.length) }, worker)); this.update(true);
  }
  release() { for (const [url, entry] of prepared) if (entry.owner === this) prepared.delete(url); }
  cancel() { clearInterval(this.timer);clearInterval(this.slidesTimer);this.abort.abort(); this.release(); this.overlay.remove(); }
  finish() { this.estimate.finish(performance.now());this.stage('Ready');clearInterval(this.timer);clearInterval(this.slidesTimer); this.release(); this.overlay.remove(); }
  error(error) { clearInterval(this.timer);clearInterval(this.slidesTimer);this.abort.abort(); this.release(); this.overlay.querySelector('.loading-error').textContent = error.message; this.overlay.querySelector('.loading-retry').classList.remove('hidden'); this.overlay.querySelector('.loading-stage').textContent = 'Could not load'; }
}
