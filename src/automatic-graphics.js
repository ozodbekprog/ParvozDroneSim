/** GPU identity chooses a starting preset; RAM alone cannot identify GPU performance. */
export function automaticGraphicsPreset({gpu='',memoryGB,mobile=false}={}){
  const name=gpu.toLowerCase();
  if(/swiftshader|llvmpipe|software|basic render|warp/.test(name)||Number(memoryGB)>0&&Number(memoryGB)<=2)return 'low';
  if(/(?:uhd|hd)\s*(?:graphics\s*)?(?:[456]\d\d)|intel.*gen[- ]?9/.test(name))return 'low';
  if(mobile)return 'low';
  if(/nvidia|geforce|quadro|radeon.*\brx\b|intel.*arc.*[ab]\d|apple.*\b(?:pro|max|ultra)\b/.test(name))return Number(memoryGB)>0&&Number(memoryGB)<=4?'medium':'high';
  return 'medium';
}

export async function graphicsHardware(renderer){
  let gpu='';
  try{
    const gl=renderer.backend?.gl;
    if(gl?.getParameter){const extension=gl.getExtension('WEBGL_debug_renderer_info');if(extension)gpu=gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)||'';}
    if(!gpu&&globalThis.navigator?.gpu){
      const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      const info=adapter?.info || await adapter?.requestAdapterInfo?.();
      if(info)gpu=[info.vendor,info.architecture,info.device,info.description].filter(Boolean).join(' ');
    }
  }catch{/* Privacy-restricted browsers use the neutral desktop default. */}
  return {gpu,memoryGB:globalThis.navigator?.deviceMemory,mobile:/Android|iPhone|iPad/i.test(globalThis.navigator?.userAgent||'')};
}
