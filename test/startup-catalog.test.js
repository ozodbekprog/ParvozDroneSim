import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStartupCatalog} from '../src/startup-catalog.js';

test('startup reuses installed maps and asset sizes only for an exact server revision',async()=>{
  const installed={revision:'a/b',maps:[{id:'map'}],assets:[{url:'/map',bytes:42}]};
  let requested;
  const result=await loadStartupCatalog(async path=>{requested=path;return {revision:'a/b',protocol:13,contentUnchanged:true};},installed);
  assert.equal(requested,'/catalog?knownRevision=a%2Fb');
  assert.equal(result.maps,installed.maps);assert.equal(result.assets,installed.assets);
  assert.equal(result.customContent,undefined);
  await assert.rejects(loadStartupCatalog(async()=>({revision:'new',contentUnchanged:true}),installed),/Content changed/);
});

test('changed catalogs and legacy server responses still install full content',async()=>{
  for(const revision of ['old','new']){
    const full={revision,maps:[{id:'server'}],customContent:{revision},assets:[]};
    assert.equal(await loadStartupCatalog(async()=>full,{revision:'old',maps:[],assets:[]}),full);
  }
  let requested;
  await loadStartupCatalog(async path=>{requested=path;return {maps:[]};},{maps:[],assets:[]});
  assert.equal(requested,'/catalog');
});
