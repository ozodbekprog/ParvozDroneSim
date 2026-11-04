/** Conditions for a comparable timing run. Slow frames are retained: poor FPS
 * alone is never grounds for discarding a valid foreground measurement. */
export function timingInvalidReasons({hidden=false,focused=true,width,height,adaptiveResolution=false,quality,backend},{width:expectedWidth=1280,height:expectedHeight=720,quality:expectedQuality,backend:expectedBackend}={}){
 const reasons=[];
 if(hidden)reasons.push('Tab became hidden');
 if(focused===false)reasons.push('Document lost focus');
 if(width!==expectedWidth||height!==expectedHeight)reasons.push(`Framebuffer was not ${expectedWidth}×${expectedHeight}`);
 if(adaptiveResolution)reasons.push('Adaptive resolution was enabled');
 if(expectedQuality!==undefined&&quality!==expectedQuality)reasons.push('Graphics preset changed');
 if(expectedBackend!==undefined&&backend!==expectedBackend)reasons.push('Renderer backend changed');
 return reasons;
}

/** Measure callback pacing with application rendering paused, before timed work.
 * This reference is separate from game frames, whose stalls must be retained. */
export function summarizeIdlePacing(samples,{maximumMedianMs=100,minimumSamples=8}={}){
 const sorted=samples.filter(ms=>Number.isFinite(ms)&&ms>0).sort((a,b)=>a-b);
 const medianMs=sorted.length?sorted[Math.floor(sorted.length/2)]:null;
 const valid=sorted.length>=minimumSamples&&medianMs<=maximumMedianMs;
 return {valid,samples:sorted.length,medianMs,p95Ms:sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]:null,maximumMedianMs,
  invalidReasons:sorted.length<minimumSamples?['Insufficient idle frame reference']:medianMs>maximumMedianMs?['Idle frame reference was throttled or overloaded']:[]};
}
