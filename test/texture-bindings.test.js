import test from 'node:test';
import assert from 'node:assert/strict';
import {Texture} from 'three';
import {NodeSampledTexture} from 'three/src/renderers/common/nodes/NodeSampledTexture.js';
import NodeSampler from 'three/src/renderers/common/nodes/NodeSampler.js';
import {refreshDisposedBindings} from '../src/texture-bindings.js';
test('resized texture restores real Three r180 cached samplers before group initialization',()=>{
  const texture=new Texture(),node={value:texture};
  const binding=new NodeSampledTexture('albedo',node,{}),sampler=new NodeSampler('filter',node,{});
  texture.dispose();texture.needsUpdate=true;
  const copied=binding.clone(),copiedSampler=sampler.clone(),group={bindings:[copied,copiedSampler]};
  assert.equal(copied.texture,null);
  assert.throws(()=>new WeakMap().set(copied.texture,{}),TypeError);
  refreshDisposedBindings(group);
  assert.equal(copied.texture,texture);assert.equal(copiedSampler.texture,texture);assert.doesNotThrow(()=>new WeakMap().set(copied.texture,{}));
  texture.dispose();assert.equal(copied.texture,null,'disposal listener is restored too');
});
