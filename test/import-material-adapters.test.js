import test from 'node:test';import assert from 'node:assert/strict';
import {adaptMaterials} from '../tools/import-material-adapters.js';
test('native Tree Creator leaves retain their authored cutout, while bark stays opaque',async()=>{
 const leaves={name:'Optimized Leaf Material',shader:'Hidden/Nature/Tree Creator Leaves Optimized',textures:{}},bark={name:'Optimized Bark Material',shader:'Hidden/Nature/Tree Creator Bark Optimized',textures:{}};
 await adaptMaterials({resources:{materials:[leaves,bark]},prepared:new Map(),propsFor:()=>({m_Floats:{_Cutoff:.88}}),report:[]});
 assert.equal(leaves.pbrOverrides.floats._Mode,1);assert.equal(leaves.pbrOverrides.floats._Cutoff,.88);assert.equal(bark.pbrOverrides,undefined);
 for(const slot of ['_BumpSpecMap','_TranslucencyMap','_ShadowTex'])assert.ok(leaves.ignoredShaderSlots[slot]);
});
test('AFS ferns keep alpha cutout and disclose their packed shading adaptation',async()=>{
 const fern={shader:'AFS/Foliage Shader v4',textures:{}};
 await adaptMaterials({resources:{materials:[fern]},prepared:new Map(),propsFor:()=>({m_Floats:{_AlphaTestRef:.6}}),report:[]});
 assert.deepEqual(fern.pbrOverrides,{floats:{_Mode:1,_Cutoff:.6}});assert.match(fern.ignoredShaderSlots._BumpTransSpecMap,/approximated/);
});
test('static foliage adaptation preserves opaque and cutout source modes and texture bindings',async()=>{
 const leaf={shader:'Shader Forge/LiftoffFoliageTranslucent',textures:{_MainTex:'leaf-atlas',_BumpMap:'leaf-normal'}},flag={shader:'Shader Forge/LiftoffFoliageTranslucent',textures:{_MainTex:'flag-atlas'}},other={shader:'Unknown shader',textures:{}};
 const bindings=structuredClone([leaf.textures,flag.textures]);
 await adaptMaterials({resources:{materials:[leaf,flag,other]},prepared:new Map(),propsFor:m=>({m_Floats:{_Mode:m===leaf?1:0,_Cutoff:.5},m_TexEnvs:{_Noise:{}}}),report:[]});
 assert.deepEqual([leaf.textures,flag.textures],bindings);assert.equal(leaf.pbrOverrides,undefined);assert.equal(flag.pbrOverrides,undefined);
 assert.match(leaf.ignoredShaderSlots._Noise,/static browser geometry/);assert.equal(other.ignoredShaderSlots,undefined);
});
