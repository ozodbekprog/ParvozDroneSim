import { rotorTelemetry } from '../shared/rotors.js';

export class DroneAudio {
  constructor() {
    this.context = new AudioContext();
    const ctx = this.context;
    this.master = ctx.createGain(); this.master.gain.value = 0.35;
    const compressor = ctx.createDynamicsCompressor(); this.master.connect(compressor).connect(ctx.destination);
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noise = noiseBuffer.getChannelData(0); for (let n=0;n<noise.length;n++) noise[n]=(Math.random()*2-1)*0.4;
    const real = new Float32Array([0,0,0,0,0]), imag = new Float32Array([0,1,0.3,0.12,0.06]);
    const wave = ctx.createPeriodicWave(real,imag);
    this.rotors = rotorTelemetry().map(layout => {
      const tone=ctx.createOscillator(), air=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), gain=ctx.createGain(), pan=ctx.createStereoPanner();
      tone.setPeriodicWave(wave); tone.frequency.value=20;
      air.buffer=noiseBuffer; air.loop=true; filter.type='bandpass'; filter.Q.value=0.6;
      gain.gain.value=0; pan.pan.value=layout.x*0.35;
      tone.connect(gain); air.connect(filter).connect(gain); gain.connect(pan).connect(this.master);
      tone.start(); air.start(); return {tone,filter,gain};
    });
  }
  resume() { this.context.resume().catch(()=>{}); }
  checkpoint() {
    if(this.context.state!=='running')return;
    const ctx=this.context, time=ctx.currentTime, tone=ctx.createOscillator(), gain=ctx.createGain();
    tone.type='sine';tone.frequency.setValueAtTime(1350,time);
    tone.frequency.exponentialRampToValueAtTime(2350,time+.065);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.22,time+.008);
    gain.gain.exponentialRampToValueAtTime(.001,time+.13);
    tone.connect(gain).connect(this.master);tone.start(time);tone.stop(time+.14);
    tone.onended=()=>{tone.disconnect();gain.disconnect();};
  }
  update(state, spec, audible) {
    const time=this.context.currentTime;
    // Flight cancellation clears simulation data while the animation loop keeps
    // running. Fade every motor out before reading telemetry for that frame.
    if (state == null || spec == null) {
      for (const channel of this.rotors) channel.gain.gain.setTargetAtTime(0,time,0.012);
      return;
    }
    for (const rotor of rotorTelemetry(state,spec)) {
      const channel=this.rotors[rotor.index];
      channel.tone.frequency.setTargetAtTime(Math.max(20,rotor.bladeHz),time,0.008);
      channel.filter.frequency.setTargetAtTime(600+rotor.speed*4500,time,0.015);
      channel.gain.gain.setTargetAtTime(audible ? rotor.speed**1.5*0.028 : 0,time,0.012);
    }
  }
}
