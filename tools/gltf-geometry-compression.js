import{reorder,quantize,meshopt}from'@gltf-transform/functions';
import{EXTMeshoptCompression}from'@gltf-transform/extensions';
import{MeshoptEncoder}from'meshoptimizer';
export async function compressGeometry(document,floatPositions=false){
 await MeshoptEncoder.ready;
 if(!floatPositions){await document.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));return;}
 await document.transform(reorder({encoder:MeshoptEncoder,target:'size'}),quantize({pattern:/^(?!POSITION$)/,patternTargets:/^(?!POSITION$)/}));
 document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
}
