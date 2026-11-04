// Read-only GLB layout inspection. No mesh/image decoding or source mutation.
import { open, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const ids = ['minus-two-demo', 'hangar-c03-demo', 'liftoff-arena-demo', 'liftoff-pine-valley-demo', 'liftoff-the-green-demo'];
function unionBytes(ranges) {
  const sorted = ranges.filter(r => r[1] > r[0]).sort((a,b) => a[0]-b[0]);
  let end = 0, total = 0;
  for (const [a,b] of sorted) { total += Math.max(0,b-Math.max(a,end)); end = Math.max(end,b); }
  return total;
}
async function hashFile(file) { const h=createHash('sha256'); for await(const c of createReadStream(file)) h.update(c); return h.digest('hex'); }
const maps=[],globalImages=new Map();
for (const id of ids) {
  const definitionFile=resolve(root, 'content/maps', id, 'map.json');
  const definition=JSON.parse(await readFile(definitionFile,'utf8'));
  const file=resolve(dirname(definitionFile), definition.model), info=await stat(file), handle=await open(file,'r');
  async function readAt(offset,length) {
    if (!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset+length>info.size) throw Error('Invalid GLB span');
    const b=Buffer.alloc(length); const {bytesRead}=await handle.read(b,0,length,offset);
    if(bytesRead!==length)throw Error('Short GLB read');return b;
  }
  try {
    const header=await readAt(0,20), jsonBytes=header.readUInt32LE(12);
    if(header.readUInt32LE(0)!==0x46546c67||header.readUInt32LE(4)!==2||header.readUInt32LE(8)!==info.size||header.readUInt32LE(16)!==0x4e4f534a||jsonBytes>64*1024*1024)throw Error('Unsupported GLB');
    const rawJSON=await readAt(20,jsonBytes), gltf=JSON.parse(rawJSON.toString('utf8'));
    const binHeader=await readAt(20+jsonBytes,8), binOffset=28+jsonBytes, binBytes=binHeader.readUInt32LE(0);
    if(binHeader.readUInt32LE(4)!==0x004e4942||binOffset+binBytes!==info.size)throw Error('Expected one BIN chunk');
    const imageRanges=[], meshoptRanges=[], imageHashes=new Map(), dimensions=new Map(), largestImages=[], mimeTypes={};
    let imageReferenceBytes=0, meshoptDecodedBytes=0, rgba8AllImagesBytes=0, uniqueKtxMipBytes=0, externalImages=0;
    for(const [imageIndex,image] of (gltf.images||[]).entries()) {
      const view=gltf.bufferViews?.[image.bufferView];
      if(!view||view.buffer!==0){externalImages++;continue;}
      const offset=view.byteOffset||0, length=view.byteLength, encoded=await readAt(binOffset+offset,length);
      imageRanges.push([offset,offset+length]); imageReferenceBytes+=length;
      mimeTypes[image.mimeType||'unspecified']=(mimeTypes[image.mimeType||'unspecified']||0)+1;
      const digest=createHash('sha256').update(encoded).digest('hex');
      let width=null,height=null,levels=null,mipPayloadBytes=null;
      if(encoded.subarray(0,12).equals(Buffer.from([171,75,84,88,32,50,48,187,13,10,26,10]))) {
        width=encoded.readUInt32LE(20);height=encoded.readUInt32LE(24);levels=encoded.readUInt32LE(40);
        mipPayloadBytes=0;
        for(let i=0;i<levels;i++)mipPayloadBytes+=Number(encoded.readBigUInt64LE(88+i*24));
        // Hypothetical RGBA8 payload only; not actual compressed GPU memory.
        let rgba=0;for(let i=0;i<levels;i++)rgba+=Math.max(1,width>>i)*Math.max(1,height>>i)*4;
        rgba8AllImagesBytes+=rgba;
        if(!imageHashes.has(digest))uniqueKtxMipBytes+=mipPayloadBytes;
      }
      else if(encoded.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {width=encoded.readUInt32BE(16);height=encoded.readUInt32BE(20);}
      if(width&&height){const key=`${width}x${height}`;dimensions.set(key,(dimensions.get(key)||0)+1);}
      if(!imageHashes.has(digest))imageHashes.set(digest,{sha256:digest,bytes:length,width,height,levels,count:0,indices:[]});
      const imageGroup=imageHashes.get(digest);imageGroup.count++;imageGroup.indices.push(imageIndex);
      largestImages.push({name:image.name||null,encodedBytes:length,width,height,levels,mipPayloadBytes});
    }
    for(const view of gltf.bufferViews||[]) {
      const ext=view.extensions?.EXT_meshopt_compression;
      if(ext){if(ext.buffer===0)meshoptRanges.push([ext.byteOffset||0,(ext.byteOffset||0)+ext.byteLength]);meshoptDecodedBytes+=ext.count*ext.byteStride;}
    }
    const imageBytes=unionBytes(imageRanges), meshoptBytes=unionBytes(meshoptRanges), classifiedBinBytes=unionBytes([...imageRanges,...meshoptRanges]);
    for(const [hash,image] of imageHashes){if(!globalImages.has(hash))globalImages.set(hash,{sha256:hash,bytes:image.bytes,maps:[]});globalImages.get(hash).maps.push(id);}
    const primitiveCount=(gltf.meshes||[]).reduce((n,m)=>n+(m.primitives?.length||0),0);
    const logicalTriangles=(gltf.meshes||[]).reduce((n,m)=>n+(m.primitives||[]).reduce((sum,p)=>sum+((p.mode??4)===4?Math.floor((gltf.accessors?.[p.indices]?.count||gltf.accessors?.[p.attributes?.POSITION]?.count||0)/3):0),0),0);
    maps.push({id,name:definition.name,file:relative(root,file).replaceAll('\\','/'),sha256:await hashFile(file),fileBytes:info.size,jsonBytes,binBytes,imageBytes,meshoptBytes,unclassifiedBinBytes:binBytes-classifiedBinBytes,
      imageReferenceBytes,uniqueEncodedImageBytes:[...imageHashes.values()].reduce((n,x)=>n+x.bytes,0),uniqueEncodedImages:imageHashes.size,externalImages,
      nodes:gltf.nodes?.length||0,meshes:gltf.meshes?.length||0,primitives:primitiveCount,materials:gltf.materials?.length||0,textures:gltf.textures?.length||0,images:gltf.images?.length||0,
      logicalTrianglesAcrossMeshDefinitions:logicalTriangles,meshoptDecodedViewBytes:meshoptDecodedBytes,
      hypotheticalRGBA8KtxImagesWithAuthoredMipsBytes:rgba8AllImagesBytes,uniqueKtxStoredMipPayloadBytes:uniqueKtxMipBytes,mimeTypes,
      largestDuplicateImageGroups:[...imageHashes.values()].filter(x=>x.count>1).map(x=>({...x,redundantEncodedBytes:x.bytes*(x.count-1)})).sort((a,b)=>b.redundantEncodedBytes-a.redundantEncodedBytes).slice(0,5),
      textureDimensions:Object.fromEntries([...dimensions].sort((a,b)=>b[1]-a[1])),largestImages:largestImages.sort((a,b)=>b.encodedBytes-a.encodedBytes).slice(0,5)});
  } finally { await handle.close(); }
}
const globalUniqueImageBytes=[...globalImages.values()].reduce((n,x)=>n+x.bytes,0);
const crossMapSharing={uniqueImages:globalImages.size,uniqueImageBytes:globalUniqueImageBytes,redundantBytesAfterPerMapDedup:maps.reduce((n,m)=>n+m.uniqueEncodedImageBytes,0)-globalUniqueImageBytes,largestSharedImages:[...globalImages.values()].filter(x=>x.maps.length>1).map(x=>({...x,redundantEncodedBytes:x.bytes*(x.maps.length-1)})).sort((a,b)=>b.redundantEncodedBytes-a.redundantEncodedBytes).slice(0,8)};
const report={inspectedAt:new Date().toISOString(),method:'Read GLB JSON, embedded image bytes/KTX2 and PNG headers and SHA-256. No model, image or texture decoding. Unique image hashes exclude material/sampler identity. Meshopt decoded view bytes are logical bufferView sizes, not measured residency. Triangle sum excludes placement/LOD/visibility selection and is not draw count. RGBA8 figure includes KTX2 images only; it is hypothetical and not actual GPU allocation. Stored KTX mip bytes can be supercompressed and are not transcode target sizes.',maps,crossMapSharing};
await writeFile(new URL('./map-payload-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(maps.map(m=>({map:m.name,fileMB:m.fileBytes/1e6,jsonMB:m.jsonBytes/1e6,imagesMB:m.imageBytes/1e6,meshoptMB:m.meshoptBytes/1e6,decodedViewsMB:m.meshoptDecodedViewBytes/1e6,uniqueImageMB:m.uniqueEncodedImageBytes/1e6,nodes:m.nodes,materials:m.materials})),null,2));
