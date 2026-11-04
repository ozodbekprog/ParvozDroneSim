import test from 'node:test';import assert from 'node:assert/strict';import {sceneRenderDue} from '../src/render-scheduling.js';
test('covered loading scenes do not compete with parsing, while flight renders every frame',()=>{
 assert.equal(sceneRenderDue(10000,0,{loading:true}),false);
 assert.equal(sceneRenderDue(100,99),true);
});
test('static menu background is paced without delaying controls or interactive inspection',()=>{
 assert.equal(sceneRenderDue(116,100,{menu:true}),false);
 assert.equal(sceneRenderDue(142,100,{menu:true}),true);
 assert.equal(sceneRenderDue(116,100,{menu:false}),true);
});
