import test from 'node:test';import assert from 'node:assert/strict';
import {latestCapture,diagnosticSummary} from '../src/diagnostics-ui.js';
import {StutterRun} from '../src/stutter-capture.js';
test('latest export and UI choose an existing report, including a recording still in progress',()=>{
  const earlier={report:{},finishedAt:20},later={report:{},finishedAt:40};
  assert.equal(latestCapture(earlier,later),later);assert.equal(latestCapture(later,earlier),later);
  assert.equal(latestCapture({run:{}},earlier),earlier);assert.equal(latestCapture(undefined,{}),null);
});
test('diagnostics shows comparable gameplay, not paused intervals, and never fabricates empty-run FPS',()=>{
  const run=new StutterRun({});const s={flying:true,hidden:false,focused:true,width:1280,height:720,graphicsKey:'low',backend:'WebGL2'};
  run.update(0,s);run.update(16,s);run.update(116,{...s,flying:false});run.update(216,{...s,flying:false});
  const markup=diagnosticSummary(run.result());assert.match(markup,/16\.0 ms/);assert.doesNotMatch(markup,/100\.0 ms/);
  assert.match(markup,/GPU time is not measured/);
  const empty=new StutterRun({});empty.update(0,s);assert.match(diagnosticSummary(empty.result()),/No comparable flight frames/);
  assert.doesNotMatch(diagnosticSummary(empty.result()),/NaN|Infinity|0\.0 FPS/);
});
