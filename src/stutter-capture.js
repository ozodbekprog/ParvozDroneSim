import {summarizeFrames} from './performance-report.js';
import {modelCacheStats,modelLoadMetrics} from './asset-loader.js';

/** Diagnostic samples retain stalls and condition changes, never enforce Low. */
export class StutterRun {
  constructor(metadata,{durationMs=60000,maxFrames=18000,maxEvents=256}={}) {
    this.metadata=structuredClone(metadata);this.durationMs=durationMs;this.maxFrames=maxFrames;this.maxEvents=maxEvents;
    this.frames=[];this.events=[];this.longTasks=[];this.started=null;this.last=null;this.complete=false;this.truncated=false;
  }
  event(type,now,details={}) {
    if(this.started===null||this.events.length>=this.maxEvents)return;
    this.events.push({type,timeMs:Math.max(0,now-this.started),...details});
  }
  longTask(start,duration) {
    if(this.started===null||start+duration<this.started||this.longTasks.length>=this.maxEvents)return;
    this.longTasks.push({timeMs:start-this.started,durationMs:duration});
  }
  update(now,sample) {
    if(this.complete)return;
    if(this.started===null)this.started=now;
    const conditions={flying:sample.flying,hidden:sample.hidden,focused:sample.focused,width:sample.width,height:sample.height,graphicsKey:sample.graphicsKey,backend:sample.backend};
    const same=this.last&&Object.keys(conditions).every(key=>conditions[key]===this.last.conditions[key]);
    if(this.last&&!same)this.event('conditions',now,conditions);
    if(this.last){
      this.frames.push({...sample,timeMs:now-this.started,ms:now-this.last.now,
        comparableGameplay:!!same&&sample.flying&&!sample.hidden&&sample.focused});
    }
    this.last={now,conditions};
    if(this.frames.length>=this.maxFrames){this.truncated=true;this.complete=true;}
    if(now-this.started>=this.durationMs)this.complete=true;
  }
  result() {
    const summarize=samples=>{
      const summary=summarizeFrames(samples);if(!summary)return null;
      return {...summary,framesOver33Ms:samples.filter(f=>f.ms>33.333).length,
        framesOver100Ms:samples.filter(f=>f.ms>100).length,framesOver250Ms:samples.filter(f=>f.ms>250).length};
    };
    return {schemaVersion:1,type:'current-settings-stutter',...this.metadata,durationMs:this.durationMs,
      elapsedMs:this.last?this.last.now-this.started:0,complete:this.complete,truncated:this.truncated,
      targetHardwareVerified:false,gpuTimingMeasured:false,
      summary:summarize(this.frames),gameplaySummary:summarize(this.frames.filter(f=>f.comparableGameplay)),
      frames:this.frames,events:this.events,longTasks:this.longTasks};
  }
}

export class StutterCapture {
  constructor(world,notify,{clock=()=>performance.now()}={}) {this.world=world;this.notify=notify;this.clock=clock;}
  start(metadata) {
    if(this.run)return;
    const canvas=this.world.renderer.domElement;
    this.run=new StutterRun({...metadata,graphics:{...this.world.graphics},
      framebuffer:[canvas.width,canvas.height],backend:this.backend(),userAgent:navigator.userAgent,
      devicePixelRatio:window.devicePixelRatio,gpuDurationMs:null,textureMiB:null});
    this.run.update(this.clock(),this.sample({flying:true,cpuMs:0}));
    if(globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')){
      this.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())this.run?.longTask(e.startTime,e.duration);});
      this.observer.observe({type:'longtask'});
    }
    this.notify('Recording current settings for 60 seconds. F8 marks a stutter; F7 stops; F6 downloads the report.');
  }
  backend(){return this.world.renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL2';}
  sample({flying,cpuMs}) {
    const renderer=this.world.renderer,info=renderer.info.render,canvas=renderer.domElement;
    return {flying,hidden:document.hidden,focused:document.hasFocus(),cpuMs,
      width:canvas.width,height:canvas.height,backend:this.backend(),adaptiveResolution:!!this.world.graphics.adaptiveResolution,
      graphicsKey:JSON.stringify(this.world.graphics),triangles:info.triangles,drawCalls:info.drawCalls??info.calls,
      geometries:renderer.info.memory?.geometries??null,textures:renderer.info.memory?.textures??null};
  }
  beginFrame(now){if(this.run){this.phaseAt=now;this.phases={};}}
  phase(name){if(this.run&&this.phases){const now=this.clock();this.phases[name]=now-this.phaseAt;this.phaseAt=now;}}
  update(now,sample) {
    if(!this.run)return;
    this.run.update(now,{...this.sample(sample),phases:this.phases||{}});this.phases=null;
    if(this.run.complete)this.finish();
  }
  mark(){if(this.run){this.run.event('user-stutter',this.clock());this.notify('Stutter marked.');}}
  finish() {
    if(!this.run)return;
    if(this.observer){for(const e of this.observer.takeRecords())this.run.longTask(e.startTime,e.duration);this.observer.disconnect();this.observer=null;}
    this.report={...this.run.result(),modelCache:modelCacheStats(),modelLoads:modelLoadMetrics()};
    this.run=null;this.finishedAt=this.clock();this.phases=null;
    this.notify('Current-settings report ready. F6 downloads it.');
  }
  download() {
    if(!this.report)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(this.report)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`parvoz-stutter-${Date.now()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
