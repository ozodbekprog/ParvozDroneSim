import test from 'node:test';
import assert from 'node:assert/strict';
import {quotaDecision,observeAccount,validateBrowserProof,acceptanceStatus,browserChecks,machineChecks} from '../tools/acceptance/core.mjs';
const time=1_793_120_000;
const quota=(short=40,week=30)=>({accountKey:'test-account',observedAt:time,windows:[
  {bucket:'codex',windowDurationMins:300,remainingPercent:short,resetsAt:time+100},
  {bucket:'codex',windowDurationMins:10080,remainingPercent:week,resetsAt:time+500}]});
test('acceptance checkpoints before either quota window reaches the configured threshold',()=>{
  assert.equal(quotaDecision(quota(),5,time).status,'available');
  assert.equal(quotaDecision(quota(5,70),5,time).status,'waiting_for_quota');
  assert.equal(quotaDecision(quota(80,1),3,time).status,'waiting_for_quota');
});
test('missing, stale, reset, future and malformed quota values cannot authorize continuation',()=>{
  for(const input of [null,{...quota(),observedAt:time-121},{...quota(),observedAt:time+20},
    {...quota(),windows:{}},{...quota(),windows:[quota().windows[0]]},
    {...quota(),windows:[...quota().windows,quota().windows[0]]},quota(NaN),quota(true)])assert.equal(quotaDecision(input,5,time).status,'quota_unknown');
  const expired=quota();expired.windows[0].resetsAt=time;assert.equal(quotaDecision(expired,5,time).status,'quota_unknown');
});
test('account change invalidates browser approval while preserving completed machine checks',()=>{
  const state={accountKey:'old',browser:{},checks:{build:{status:'passed'}},events:[]};
  assert.equal(observeAccount(state,'new'),true);assert.equal(state.browser,null);assert.equal(state.checks.build.status,'passed');
  assert.equal(observeAccount(state,'new'),false);assert.equal(state.events.length,1);
});
const state=()=>({runId:'run',sourceDigest:'digest',accountKey:'account',createdAt:new Date(time*1000-1000).toISOString(),baseUrl:'http://127.0.0.1:2589',
  checks:Object.fromEntries(machineChecks.map(name=>[name,{status:'passed'}]))});
const proof=()=>({runId:'run',sourceDigest:'digest',accountKey:'account',observedAt:new Date(time*1000).toISOString(),baseUrl:'http://127.0.0.1:2589',
  browser:'Chrome',verifiedBy:'cua_repl',checks:browserChecks.map(name=>({name,status:'passed',evidence:'evidence/'+name+'.png'}))});
test('build success cannot stand in for a browser check, performance acceptance or deployment',()=>{
  const s=state();assert.equal(acceptanceStatus(s),'awaiting_browser');s.browser=proof();assert.equal(acceptanceStatus(s),'passed');
  s.browser.checks[0].status='not_run';assert.equal(acceptanceStatus(s),'awaiting_browser');
  s.browser.checks[0].status='failed';assert.equal(acceptanceStatus(s),'failed');
});
test('old-account, wrong-source and incomplete browser proofs are rejected',()=>{
  const s=state();assert.equal(validateBrowserProof(proof(),s,time*1000).checks.length,4);
  for(const changes of [{accountKey:'old'},{sourceDigest:'old'},{baseUrl:'https://production.invalid'},{checks:proof().checks.slice(1)},
    {observedAt:new Date(time*1000-31*60_000).toISOString()}])assert.throws(()=>validateBrowserProof({...proof(),...changes},s,time*1000));
});
test('source changes and failed machine checks block a passed result',()=>{
  const s={...state(),browser:proof(),sourceCurrent:false};assert.equal(acceptanceStatus(s),'source_changed');
  s.sourceCurrent=true;s.checks.build.status='failed';assert.equal(acceptanceStatus(s),'failed');
});
