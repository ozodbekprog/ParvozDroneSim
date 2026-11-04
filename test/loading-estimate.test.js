import test from 'node:test';import assert from 'node:assert/strict';
import {LoadingEstimate} from '../src/loading-estimate.js';
const memory=()=>{let saved='{}';return {getItem:()=>saved,setItem:(_,value)=>{saved=value;}};};
test('cold loads estimate observed download time only and do not promise unmeasured processing',()=>{
  const eta=new LoadingEstimate('map',{storage:memory()});eta.stage('Downloading assets',0);
  assert.equal(eta.estimate(0,{loaded:0,total:10000},0),null);
  const result=eta.estimate(2000,{loaded:2000,total:10000},2000);
  assert.deepEqual(result,{seconds:8,scope:'download'});eta.stage('Processing models',2000);
  assert.equal(eta.estimate(2100,{loaded:10000,total:10000,done:true},2000),null);
});
test('successful matching runs teach preparation estimates, with bounded history and no zero countdown',()=>{
  const storage=memory(),eta=new LoadingEstimate('map',{storage});eta.stage('Processing models',0);eta.stage('Preparing graphics',2000);eta.finish(5000);
  const next=new LoadingEstimate('map',{storage});next.stage('Processing models',10000);
  assert.deepEqual(next.estimate(11000,{},0),{seconds:4,scope:'ready'});
  assert.equal(next.estimate(16000,{},0),null);
  const other=new LoadingEstimate('different-quality',{storage});other.stage('Preparing graphics',0);assert.equal(other.estimate(100,{},0),null);
  for(let i=0;i<12;i++){const run=new LoadingEstimate(String(i),{storage});run.stage('Processing models',0);run.finish(1000);}
  assert.equal(Object.keys(JSON.parse(storage.getItem())).length,8);
});
test('stalled, cached, unknown-size and failed/cancelled runs cannot fabricate a countdown or teach history',()=>{
  const storage=memory(),eta=new LoadingEstimate('map',{storage});eta.stage('Using cached assets',0);
  assert.equal(eta.estimate(2000,{loaded:10000,total:10000,done:true},0),null);
  eta.stage('Processing models',3000);assert.deepEqual(JSON.parse(storage.getItem()),{});
  const download=new LoadingEstimate('x',{storage});download.stage('Downloading assets',0);
  download.estimate(0,{loaded:0,total:10000},0);download.estimate(2000,{loaded:1000,total:10000},1000);
  assert.equal(download.estimate(10000,{loaded:1000,total:10000},1000),null);
  assert.equal(download.estimate(11000,{loaded:1500,total:0},1500),null);
});
