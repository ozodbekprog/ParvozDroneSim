import test from 'node:test';import assert from 'node:assert/strict';
import {supportsSceneryBatches,sceneryBatchOptions} from '../src/scenery-batch-support.js';
test('WebGL2 without optional multi-draw still supports core instances',()=>{
 assert.equal(supportsSceneryBatches({backend:{isWebGLBackend:true},hasFeature:()=>false}),true);
 assert.equal(supportsSceneryBatches({backend:{isWebGLBackend:true},hasFeature:name=>name==='WEBGL_multi_draw'}),true);
 assert.equal(supportsSceneryBatches({isWebGLRenderer:true,extensions:{has:()=>false}}),true);
 assert.equal(supportsSceneryBatches({backend:{isWebGPUBackend:true}}),true);
 assert.equal(supportsSceneryBatches({}),false);
});
test('both backends share repeated prototypes; heterogeneous batching follows multi-draw support',()=>{
 assert.equal(sceneryBatchOptions({backend:{isWebGPUBackend:true}}).instancing,true);
 // Feature detection is independent of static-merge and cell-size defaults.
 const support=renderer=>{const {instancing,multiDraw}=sceneryBatchOptions(renderer);return {instancing,multiDraw};};
 assert.deepEqual(support({backend:{isWebGLBackend:true}}),{instancing:true,multiDraw:false});
 assert.deepEqual(support({isWebGLRenderer:true,extensions:{has:()=>true}}),{instancing:true,multiDraw:true});
 const overridden=sceneryBatchOptions({backend:{isWebGPUBackend:true}},{instancing:false,cellSize:64});
 assert.equal(overridden.instancing,false);assert.equal(overridden.multiDraw,true);assert.equal(overridden.cellSize,64);
});
