import {icon} from './ui-design.js';

const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mb=bytes=>(Math.max(0,bytes||0)/1e6).toFixed(1)+' MB';
export function downloadLabel(row) {
  if(!row)return 'Checking downloads';
  return {downloaded:'Downloaded',queued:'Queued',downloading:`Downloading ${Math.floor(Math.min(1,row.loaded/Math.max(1,row.total))*100)}%`,error:'Interrupted',canceled:'Canceled',available:row.retainedBytes?'Partly downloaded':'Not downloaded'}[row.state]||'Not downloaded';
}
export function downloadButton(row) {
  return row?.state==='downloaded'?'Downloaded':row?.state==='downloading'?'Downloading…':row?.state==='queued'?'Queued':row?.state==='error'?'Retry':row?.retainedBytes?'Resume':'Download';
}
export function downloadPresentation(row) {
  const busy=['queued','downloading'].includes(row.state),done=row.state==='downloaded';
  const progress=Math.min(1,Math.max(0,row.loaded/Math.max(1,row.total)));
  return {busy,done,progress,showProgress:row.state==='downloading',
    status:row.state==='downloading'?`${Math.floor(progress*100)}%`:downloadLabel(row),
    size:row.state==='downloading'?`${mb(row.loaded)} / ${mb(row.total)}`:'',
    action:busy||done?null:downloadButton(row),
    error:row.unsupported?'':row.error||(row.hint?'Download again to restore missing files.':'')};
}
export function mapDownloadHTML(map) {
  return `<button class="map-download-badge" data-download-map="${html(map.id)}" data-state="checking" title="Checking downloads" aria-label="Check download: ${html(map.name)}"><span data-download-icon>${icon('download')}</span><span class="sr-only" data-download-status="${html(map.id)}">Checking downloads</span></button>`;
}

/** Nonmodal panel stays outside menu rerenders, preserving Workbench drafts. */
export class DownloadPanel {
  constructor({root,manager,maps}) {
    Object.assign(this,{root,manager,maps});this.visible=true;this.opened=false;this.lastPaint=0;
    this.element=document.createElement('div');this.element.className='download-manager';
    this.element.innerHTML=`<button class="download-launcher" aria-label="Map downloads" aria-expanded="false" aria-controls="map-download-panel">${icon('download')}<span>Downloads</span><output></output></button><aside id="map-download-panel" class="download-panel" role="dialog" aria-modal="false" aria-label="Downloads" hidden>
      <header><h2>Downloads</h2><button class="download-close" aria-label="Close downloads">×</button></header>
      <div class="download-list">${maps.map(map=>`<article class="download-row" data-download-row="${html(map.id)}" tabindex="-1" aria-label="${html(map.name)} download">
        <div class="download-thumbnail">${map.thumbnail?`<img src="${html(map.thumbnail)}" alt="" loading="lazy"/>`:icon('location')}</div>
        <div class="download-body"><div class="download-title"><strong>${html(map.name)}</strong><span></span></div><progress max="1" value="0" aria-label="${html(map.name)} download progress" hidden></progress><output class="download-size" hidden></output><p class="download-error" role="status"></p></div>
        <div class="download-actions"><button class="mini-button" data-enqueue="${html(map.id)}" aria-label="Download ${html(map.name)}">Download</button><button class="mini-button" data-cancel="${html(map.id)}" aria-label="Cancel ${html(map.name)} download" hidden>Cancel</button><span class="download-complete" aria-hidden="true" hidden>${icon('check')}</span></div>
      </article>`).join('')}</div>
      <footer><p class="download-storage" role="status"></p><details class="download-details"><summary aria-label="About saved downloads">i</summary><p>Maps are saved on this device. Clearing browser data removes them.</p></details></footer>
    </aside>`;
    root.appendChild(this.element);
    this.launcher=this.element.querySelector('.download-launcher');this.panel=this.element.querySelector('.download-panel');
    this.launcher.onclick=()=>this.toggle();this.element.querySelector('.download-close').onclick=()=>this.close();
    this.element.querySelectorAll('[data-enqueue]').forEach(button=>button.onclick=()=>manager.enqueue(button.dataset.enqueue));
    this.element.querySelectorAll('[data-cancel]').forEach(button=>button.onclick=()=>manager.cancel(button.dataset.cancel));
    this.unsubscribe=manager.subscribe(snapshot=>{
      this.latest=snapshot;
      if(!this.timer)this.timer=setTimeout(()=>{this.timer=null;this.paint();},100);
    });
    this.escape=event=>{if(event.code==='Escape'&&this.opened){event.preventDefault();event.stopImmediatePropagation();this.close();}};
    window.addEventListener('keydown',this.escape,true);
  }
  setVisible(value) {if(this.visible===value)return;this.visible=value;this.launcher.hidden=!value;if(!value)this.close(false);this.element.hidden=!value&&!this.opened;}
  toggle(){this.opened?this.close():this.open();}
  open(trigger){this.returnFocus=trigger;this.opened=true;this.element.hidden=false;this.panel.hidden=false;this.launcher.setAttribute('aria-expanded','true');this.paint();this.element.querySelector('.download-close').focus();this.manager.refresh().catch(()=>{});}
  close(focus=true){const was=this.opened;this.opened=false;this.panel.hidden=true;this.element.hidden=!this.visible;this.launcher.setAttribute('aria-expanded','false');if(was&&focus){if(this.returnFocus?.isConnected)this.returnFocus.focus();else if(this.visible)this.launcher.focus();}this.returnFocus=null;}
  bindMapCards(scope) {
    this.scope=scope;
    scope.querySelectorAll('[data-download-map]').forEach(button=>button.onclick=event=>{
      event.stopPropagation();const row=this.latest?.maps.find(item=>item.id===button.dataset.downloadMap);
      if(row&&['downloaded','queued','downloading'].includes(row.state))this.open(button);
      else this.manager.enqueue(button.dataset.downloadMap);
    });
    this.paint();
  }
  paint() {
    if(!this.latest)return;
    const active=this.latest.maps.filter(row=>['queued','downloading'].includes(row.state));
    this.launcher.querySelector('output').textContent=active.length?String(active.length):'';
    for(const row of this.latest.maps){
      const holder=this.element.querySelector(`[data-download-row="${row.id}"]`);if(!holder)continue;
      const focused=document.activeElement;
      const view=downloadPresentation(row),{busy,done}=view;
      holder.dataset.state=row.state;holder.querySelector('.download-title span').textContent=view.status;
      const progress=holder.querySelector('progress');progress.value=view.progress;progress.hidden=!view.showProgress;
      const size=holder.querySelector('.download-size');size.textContent=view.size;size.hidden=!view.size;
      holder.querySelector('.download-error').textContent=view.error;
      const action=holder.querySelector('[data-enqueue]');action.textContent=view.action||'';action.hidden=!view.action;action.disabled=busy||done||row.unsupported;
      action.setAttribute('aria-label',`${view.action||'Download'} ${this.maps.find(map=>map.id===row.id)?.name||row.id}`);
      const cancel=holder.querySelector('[data-cancel]');cancel.hidden=!busy;
      holder.querySelector('.download-complete').hidden=!done;
      if(focused===action&&action.hidden)(busy?cancel:holder).focus();
      else if(focused===cancel&&cancel.hidden)(view.action&&!row.unsupported?action:holder).focus();
      for(const button of this.scope?.querySelectorAll(`[data-download-map="${row.id}"]`)||[]){
        const label=downloadLabel(row),name=this.maps.find(map=>map.id===row.id)?.name||row.id;
        button.querySelector('[data-download-status]').textContent=label;
        button.querySelector('[data-download-icon]').innerHTML=icon(done?'check':busy?'clock':'download');
        button.dataset.state=row.state;button.style.setProperty('--download-progress',view.progress);
        button.title=`${label}: ${name}`;button.setAttribute('aria-label',`${done||busy?label:downloadButton(row)}: ${name}`);button.disabled=!!row.unsupported;
      }
    }
    const storage=this.latest.storage;
    this.element.querySelector('.download-storage').textContent=storage.available===null?'Checking storage…':storage.available?`${mb(storage.used)} on this device`:'Downloads unavailable in this browser.';
  }
  dispose(){clearTimeout(this.timer);this.unsubscribe?.();window.removeEventListener('keydown',this.escape,true);this.element.remove();}
}
