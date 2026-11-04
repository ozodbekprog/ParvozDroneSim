import {FlightLoading, nextPaint} from './flight-loading.js';
import {AssetProgress} from './asset-progress.js';
import {LoadingEstimate} from './loading-estimate.js';

/** Initial readiness includes the selected workshop; other maps stay on demand. */
export class StartupLoading extends FlightLoading {
  constructor({onRetry}={}) {
    super([],[],{title:'Welcome to Parvoz',onRetry});
    this.overlay.classList.add('startup-loading');
    this.overlay.querySelector('.loading-cancel').hidden=true;
    this.stage('Connecting to the flight server');
  }
  resources(urls,assets) {
    this.urls=[...new Set(urls)];this.progress=new AssetProgress(this.urls,assets);
    this.estimate=new LoadingEstimate(JSON.stringify([this.timingKey,this.urls]),{now:performance.now()});this.update(true);
  }
  ready(onPlay,onSignIn) {
    this.stage('Ready to play');clearInterval(this.timer);this.release();
    const play=this.overlay.querySelector('.loading-cancel');
    play.hidden=false;play.textContent='Play';play.className='button primary loading-cancel';play.onclick=onPlay;
    const signIn=document.createElement('button');signIn.className='button ghost';signIn.textContent='Sign in';signIn.onclick=onSignIn;
    play.parentElement.appendChild(signIn);this.signIn=signIn;
    play.focus();
  }
  opening() {
    this.overlay.querySelector('.loading-stage').textContent='Starting';
    this.overlay.querySelector('.loading-cancel').disabled=true;
    if(this.signIn)this.signIn.disabled=true;
  }
  error(error){super.error(error);this.overlay.querySelector('.loading-stage').textContent='Could not prepare the flight deck';}
}

export async function prepareStartup({loading,connect,prepareRenderer,prepareHangar}) {
  loading.stage('Connecting to the flight server');await connect();loading.check();
  loading.stage('Preparing menu');await nextPaint();loading.check();
  await prepareRenderer();loading.check();
  if(prepareHangar){loading.stage('Preparing Hangar');await prepareHangar();loading.check();}
}
