/** InstancedMesh is core in WebGL2. r180's heterogeneous BatchedMesh still
 * needs WEBGL_multi_draw; its availability is passed separately below. */
export function supportsSceneryBatches(renderer){
 return renderer?.isWebGLRenderer===true||renderer?.backend?.isWebGLBackend===true||renderer?.backend?.isWebGPUBackend===true;
}
/** True instances avoid copying repeated prototypes on both backends. Missing
 * optional multi-draw must not disable instancing or hide unique source meshes. */
export function sceneryBatchOptions(renderer,overrides){
 const multiDraw=renderer?.backend?.isWebGPUBackend===true||(renderer?.isWebGLRenderer?renderer.extensions?.has('WEBGL_multi_draw'):renderer?.hasFeature?.('WEBGL_multi_draw'))===true;
 return {instancing:true,multiDraw,mergeStatic:true,cellSize:2048,...overrides};
}
