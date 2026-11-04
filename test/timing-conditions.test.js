import test from 'node:test';
import assert from 'node:assert/strict';
import {timingInvalidReasons,summarizeIdlePacing} from '../src/timing-conditions.js';
import {PerformanceRun} from '../src/performance-report.js';

test('a visible but unfocused document cannot produce an accepted timing run',()=>{
 const frame={width:1280,height:720,focused:false,hidden:false};
 assert.deepEqual(timingInvalidReasons(frame),['Document lost focus']);
 const run=new PerformanceRun({warmupMs:0,durationMs:20});run.update(0,frame);run.update(20,{...frame,focused:true});
 assert.equal(run.result().valid,false);assert.equal(run.result().meetsFrameBudget,false);
 assert.ok(run.result().invalidReasons.includes('Document lost focus'));
});

test('slow valid foreground frames remain valid evidence of a failed performance budget',()=>{
 const frame={width:1280,height:720,focused:true,hidden:false};
 const run=new PerformanceRun({warmupMs:0,durationMs:3000});for(const t of [0,1000,2000,3000])run.update(t,frame);
 const result=run.result();assert.equal(result.valid,true);assert.equal(result.summary.medianMs,1000);assert.equal(result.meetsFrameBudget,false);
});

test('an independent idle callback reference detects severe throttling without filtering game stalls',()=>{
 assert.equal(summarizeIdlePacing(Array(12).fill(16.7)).valid,true);
 assert.equal(summarizeIdlePacing(Array(12).fill(1000)).valid,false);
 assert.equal(summarizeIdlePacing([16,17,NaN]).valid,false);
 assert.equal(summarizeIdlePacing([...Array(11).fill(16.7),1000]).valid,true,'one slow idle callback cannot erase a valid reference');
});
