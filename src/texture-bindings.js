// Three r180 clears sampler references on Texture.dispose(). Resizing a loaded
// texture can then clone an empty cached binding before its normal update runs.
// Restore the node's current texture before the renderer initializes that group.
export function refreshDisposedBindings(group){
  for(const binding of group.bindings)if(binding.isSampler&&!binding.texture&&binding.textureNode?.value?.isTexture)binding.update();
}
export function repairTextureBindings(renderer){
  const bindings=renderer._bindings;
  if(!bindings||bindings.textureRepair||typeof bindings._init!=='function')return;
  const initialize=bindings._init;
  bindings._init=function(group){refreshDisposedBindings(group);return initialize.call(this,group);};
  bindings.textureRepair=true;
}
