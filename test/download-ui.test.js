import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadPresentation,mapDownloadHTML} from '../src/download-ui.js';

const state=(state,extra={})=>({state,loaded:65000000,total:100000000,retainedBytes:20000000,...extra});

test('map download is an independent accessible button with escaped map identity',()=>{
  const markup=mapDownloadHTML({id:'map-1',name:'Forest "A" <B>'});
  assert.match(markup,/^<button /);assert.equal((markup.match(/<button/g)||[]).length,1);
  assert.match(markup,/data-download-map="map-1"/);
  assert.match(markup,/aria-label="Check download: Forest &quot;A&quot; &lt;B&gt;"/);
  assert.match(markup,/data-download-status="map-1"/);
  assert.doesNotMatch(markup,/<B>/);
});

test('compact download controls expose cancel for a transfer, resume after cancellation and no redundant completed action',()=>{
  const active=downloadPresentation(state('downloading'));
  assert.equal(active.busy,true);assert.equal(active.action,null);assert.equal(active.showProgress,true);
  assert.equal(active.status,'65%');assert.equal(active.size,'65.0 MB / 100.0 MB');
  const queued=downloadPresentation(state('queued'));assert.equal(queued.busy,true);assert.equal(queued.action,null);assert.equal(queued.showProgress,false);
  const canceled=downloadPresentation(state('canceled'));assert.equal(canceled.busy,false);assert.equal(canceled.action,'Resume');
  const done=downloadPresentation(state('downloaded',{loaded:100000000}));
  assert.equal(done.done,true);assert.equal(done.action,null);assert.equal(done.size,'');assert.equal(done.showProgress,false);
});

test('failed or evicted downloads remain actionable while unsupported storage reports only once',()=>{
  const failed=downloadPresentation(state('error',{error:'Connection lost'}));
  assert.equal(failed.action,'Retry');assert.equal(failed.error,'Connection lost');
  const evicted=downloadPresentation(state('available',{retainedBytes:0,hint:'Some saved files were removed'}));
  assert.equal(evicted.action,'Download');assert.match(evicted.error,/restore missing files/);
  const unsupported=downloadPresentation(state('available',{unsupported:true,error:'Storage blocked',hint:'Storage blocked'}));
  assert.equal(unsupported.error,'');
});
