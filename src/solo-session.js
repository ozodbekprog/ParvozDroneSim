import { MAPS, GAMEPLAY_OBSTACLES, getTrack, getTrackObstacles } from '../shared/content.js';
import { resolveBuild, gateCrossed, FIXED_DT } from '../shared/physics.js';
import { validateFlightController } from '../shared/flight-controller.js';
import { simulateCommand, resetAtCheckpoint, checkpointSpawn } from '../shared/flight-session.js';
import { resetFreestyle, scoreFreestyle } from '../shared/freestyle.js';
import { fixedSteps } from '../shared/timing.js';
import { selectedMap } from '../shared/map-selection.js';
import {courseEnabled,sceneTrack} from '../shared/scene-content.js';
import {createRaceOpponents,advanceRaceOpponent,resetRaceOpponent} from '../shared/race-ai.js';
import {tutorialStepMet} from '../shared/tutorial-objectives.js';

// Local flight owns its clock and state. This module has no transport dependency.
export class SoloSession {
  constructor({ map, track, mode, user, profile, tutorial, challenge, onCheckpoint, now = Date.now() }) {
    this.onCheckpoint=onCheckpoint;
    const course=courseEnabled({mode,tutorial,challenge});
    this.map = selectedMap(MAPS,map); map=this.map.id; this.track = sceneTrack(getTrack(map, track),course);
    this.profile = validateFlightController(profile); this.tutorial = tutorial; this.challenge = challenge;
    const extraObstacles = [...(tutorial?.colliders || []), ...(challenge?.colliders || [])];
    this.obstacles = extraObstacles.length ? [...getTrackObstacles(map,track,{course}), ...extraObstacles] : getTrackObstacles(map,track,{course});
    this.item = { id: user.id, name: user.username, build: structuredClone(user.build), gate: 0, lap: 1, score: 0, resetId: 0, finishMs: null };
    this.spec = resolveBuild(this.item.build);
    this.opponents = mode==='race'&&!tutorial&&!challenge ? createRaceOpponents(this.item,this.spec,this.map,this.track,this.obstacles) : [];
    this.room = { solo: true, host: user.id, map, track: this.track.id, mode, sceneCourse:course, players: [this.item,...this.opponents] };
    this.restart(now);
  }
  restart(now = Date.now()) {
    Object.assign(this.item, { gate: 0, lap: 1, finishMs: null, score: 0 });
    this.elapsed = 0; this.clock = now; this.accumulator = 0; this.stepIndex = 0; this.stepTime = 0; this.tutorialCheckpoint = null;
    if (this.tutorial?.steps[0]?.objective === 'gate') this.item.gate = this.tutorial.steps[0].target;
    Object.assign(this.room, { status: 'countdown', countdown: now + 3000, started: now + 3000, pausedAt: 0 });
    this.reset(); resetFreestyle(this.item);
    for(const opponent of this.opponents){Object.assign(opponent,{gate:0,lap:1,finishMs:null,score:0});opponent.pilot.recoveries=0;resetRaceOpponent(opponent,this.track);}
  }
  async prepareOpponents(yieldFrame) {
    if(this.opponents.length)await this.opponents[0].pilot.navigation.prepare(this.item.state.position,yieldFrame);
  }
  reset() {
    resetAtCheckpoint(this.item, { mode: this.room.mode, track: this.track }, this.tutorialCheckpoint);
    this.accumulator = 0; this.stepTime = 0;
    if (this.room.mode === 'freestyle') resetFreestyle(this.item, true);
  }
  advanceTutorialStep() {
    const step = this.tutorial.steps[this.stepIndex];
    if (step.objective === 'gate') {
      this.tutorialCheckpoint = checkpointSpawn(this.track, step.target + 1);
      this.item.gate = (step.target + 1) % this.track.gates.length;
    }
    this.stepIndex++; this.stepTime = 0;
    const next = this.tutorial.steps[this.stepIndex];
    if (next?.objective === 'gate') this.item.gate = next.target;
    if (!next) { this.item.finishMs = Math.round(this.elapsed); this.room.status = 'ended'; }
  }
  advanceManual() {
    if (this.room.status !== 'running' || this.tutorial?.steps[this.stepIndex]?.objective !== 'manual') return;
    this.advanceTutorialStep();
  }
  pause() { if (!['running','countdown'].includes(this.room.status)) return; this.previousStatus = this.room.status; this.room.status = 'paused'; this.room.pausedAt = this.clock; }
  resume(now = Date.now()) {
    if (this.room.status !== 'paused') return;
    const gap = now - this.clock; this.room.started += gap; this.room.countdown += gap;
    this.clock = now; this.room.pausedAt = 0; this.room.status = this.previousStatus;
  }
  update(dt, input, flightMode, now = Date.now()) {
    if (['paused','ended'].includes(this.room.status)) return;
    this.clock = now;
    if (this.room.status === 'countdown') {
      if (now < this.room.countdown) return;
      this.room.status = 'running'; this.room.started = now; dt = 0;
    }
    const advance = fixedSteps(this.accumulator, dt); this.accumulator = advance.remainder;
    for (let n = 0; n < advance.steps && this.room.status === 'running'; n++) {
      const old = [...this.item.state.position];
      simulateCommand(this.item.state, { input, flightMode }, this.spec, this.map, this.track, this.obstacles, this.profile);
      this.elapsed += FIXED_DT * 1000;
      for(const opponent of this.opponents)advanceRaceOpponent(opponent,this.spec,this.map,this.track,this.obstacles,this.elapsed);
      if (this.item.state.crashed) {
        this.reset();
        if (this.room.mode === 'freestyle' && this.elapsed >= 180000) this.room.status = 'ended';
        // The remaining commands belong to the crashed pose. Let the caller
        // release throttle before advancing the newly spawned drone.
        break;
      }
      if (this.room.mode === 'freestyle') scoreFreestyle(this.item, old, this.track, this.obstacles.filter(o=>o.size), this.elapsed, FIXED_DT);
      else if (this.room.mode !== 'training') {
        if (gateCrossed(old, this.item.state.position, this.track.gates[this.item.gate])) {
          this.onCheckpoint?.(this.item.gate);
          this.item.gate++;
          if (this.item.gate >= this.track.gates.length) { this.item.gate = 0; this.item.lap++; }
          if (this.item.lap > this.track.laps) { this.item.finishMs = Math.round(this.elapsed); this.room.status = 'ended'; }
        }
      }
      if(this.room.mode==='training'&&!this.tutorial){
        const crossed=this.track.gates.findIndex(gate=>gateCrossed(old,this.item.state.position,gate));
        if(crossed>=0)this.onCheckpoint?.(crossed);
      }
      const step = this.tutorial?.steps[this.stepIndex];
      if (step) {
        const state = this.item.state;
        const met = tutorialStepMet(step,{state,previous:old,map:this.map,track:this.track,flightMode});
        this.stepTime = met ? this.stepTime + FIXED_DT : 0;
        if (met && this.stepTime >= step.duration) {
          if(step.objective==='gate')this.onCheckpoint?.(step.target);
          this.advanceTutorialStep();
        }
      }
      if (this.room.mode === 'freestyle' && this.elapsed >= 180000) this.room.status = 'ended';
    }
  }
  get state() { return this.item.state; }
}
