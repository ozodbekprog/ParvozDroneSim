import {validateColliders} from './catalog-schema.js';
import {buildPackedCollisionTree} from './packed-collision-tree.js';

export const COLLISION_BINARY_VERSION=1;
const MAGIC=[80,86,90,67,79,76,76,0],HEADER=32,ENDIAN=0x01020304;
const littleEndian=new Uint8Array(new Uint32Array([ENDIAN]).buffer)[0]===4;
const align8=value=>Math.ceil(value/8)*8;
const fail=()=>{throw Error('Invalid prepared collision data');};
const crcTable=Uint32Array.from({length:256},(_,i)=>{
 for(let bit=0;bit<8;bit++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;
 return i>>>0;
});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function asBytes(input){
 if(input instanceof ArrayBuffer)return new Uint8Array(input);
 if(ArrayBuffer.isView(input))return new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
 return fail();
}
export function isCollisionBinary(input){const bytes=asBytes(input);return bytes.length>=4&&MAGIC.slice(0,4).every((n,i)=>bytes[i]===n);}
export const collisionFileFor=item=>item?.preparedCollisionFile||item?.collisionFile;

/** Offline only: exact prepared arrays, not a new or quantized collision model.
 * sourceHash identifies JSON.stringify(validated authored colliders), UTF-8.
 * All offsets are relative to the aligned binary section, never JS pointers. */
export function encodeCollisionBinary(colliders,{sourceHash}={}){
 if(!littleEndian)throw Error('Prepared collision encoding requires little endian');
 validateColliders(colliders);
 if(!/^[a-f0-9]{64}$/.test(sourceHash||''))throw Error('Prepared collision source hash is required');
 let cursor=0;const blocks=[];
 const records=colliders.map(collider=>{
  if(collider.type!=='mesh')return {collider};
  const {vertices,...metadata}=collider,tree=buildPackedCollisionTree(vertices),arrays={};
  for(const [name,array]of Object.entries(tree)){
   cursor=align8(cursor);arrays[name]={offset:cursor,length:array.length};
   blocks.push({offset:cursor,array});cursor+=array.byteLength;
  }
  return {collider:metadata,arrays};
 });
 const json=new TextEncoder().encode(JSON.stringify({sourceHash,treeVersion:1,records})),dataStart=align8(HEADER+json.length);
 if(json.length>16*1024*1024||dataStart+cursor>0xffffffff)throw Error('Prepared collision package is too large');
 const bytes=new Uint8Array(dataStart+cursor),view=new DataView(bytes.buffer);
 bytes.set(MAGIC);view.setUint32(8,COLLISION_BINARY_VERSION,true);view.setUint32(12,ENDIAN,true);
 view.setUint32(16,bytes.length,true);view.setUint32(20,json.length,true);bytes.set(json,HEADER);
 for(const {offset,array}of blocks)bytes.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),dataStart+offset);
 view.setUint32(24,crc32(bytes.subarray(HEADER)),true);
 return bytes;
}

function validateTree(tree){
 const {vertices,indices,bounds,nodes}=tree,triangles=vertices.length/9,nodeCount=nodes.length/4;
 if(vertices.length%9||vertices.length>900000||indices.length!==triangles||nodes.length%4||nodeCount<1||nodeCount>Math.max(1,2*triangles-1)||bounds.length!==nodeCount*6)fail();
 for(const n of vertices)if(!Number.isFinite(n)||Math.abs(n)>=1e6)fail();
 const used=new Uint8Array(triangles),covered=new Uint8Array(triangles),seen=new Uint8Array(nodeCount);
 for(const n of indices){if(n>=triangles||used[n])fail();used[n]=1;}
 const stack=[0];
 while(stack.length){
  const node=stack.pop();if(node>=nodeCount||seen[node])fail();seen[node]=1;
  const base=node*4,bound=node*6,left=nodes[base],right=nodes[base+1],start=nodes[base+2],count=nodes[base+3];
  if(start<0||count<0||start+count>triangles)fail();
  if(triangles===0){
   if(nodeCount!==1||left!==-1||right!==-1||start||count||!bounds.every((n,i)=>n===(i<3?Infinity:-Infinity)))fail();
   continue;
  }
  for(let axis=0;axis<3;axis++)if(!Number.isFinite(bounds[bound+axis])||!Number.isFinite(bounds[bound+axis+3])||bounds[bound+axis]>bounds[bound+axis+3])fail();
  if(left>=0){
   if(left<=node||right<=node||left>=nodeCount||right>=nodeCount||count!==0)fail();
   for(const child of [left,right])for(let axis=0;axis<3;axis++)if(bounds[child*6+axis]<bounds[bound+axis]||bounds[child*6+axis+3]>bounds[bound+axis+3])fail();
   stack.push(right,left);
  }else{
   if(left!==-1||right!==-1||count<1||count>16)fail();
   for(let i=start;i<start+count;i++){
    if(covered[i])fail();covered[i]=1;
    for(let v=0;v<9;v++){const n=vertices[indices[i]*9+v],axis=v%3;if(n<bounds[bound+axis]||n>bounds[bound+axis+3])fail();}
   }
  }
 }
 if(seen.some(n=>!n)||covered.some(n=>!n))fail();
}

/** Validates before exposing zero-copy views. These views keep one owned binary
 * buffer alive. A worker transfers that buffer once, never once per view.
 * CRC detects damaged deliveries; content provenance/authenticity is separate. */
export function decodeCollisionBinary(input){
 let bytes=asBytes(input);
 if(!littleEndian)throw Error('Prepared collision decoding requires little endian');
 if(bytes.byteOffset%8)bytes=bytes.slice();
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<HEADER||!MAGIC.every((n,i)=>bytes[i]===n)||view.getUint32(8,true)!==COLLISION_BINARY_VERSION||view.getUint32(12,true)!==ENDIAN||view.getUint32(16,true)!==bytes.length||view.getUint32(28,true)!==0)fail();
 const jsonLength=view.getUint32(20,true),dataStart=align8(HEADER+jsonLength);
 if(jsonLength>16*1024*1024||dataStart>bytes.length||view.getUint32(24,true)!==crc32(bytes.subarray(HEADER)))fail();
 const metadata=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(HEADER,HEADER+jsonLength)));
 if(metadata.treeVersion!==1||!/^[a-f0-9]{64}$/.test(metadata.sourceHash)||!Array.isArray(metadata.records))fail();
 const colliders=[],trees=[];let cursor=0;
 for(const record of metadata.records){
  const collider=record?.collider;if(!collider||typeof collider!=='object')fail();
  if(collider.type!=='mesh'){
   if(record.arrays!==undefined)fail();validateColliders([collider]);colliders.push(collider);continue;
  }
  if(Object.hasOwn(collider,'vertices'))fail();
  validateColliders([{...collider,vertices:[]}]);
  const tree={};
  for(const [name,Type]of [['vertices',Float64Array],['indices',Uint32Array],['bounds',Float64Array],['nodes',Int32Array]]){
   const array=record.arrays?.[name];cursor=align8(cursor);
   if(!array||array.offset!==cursor||!Number.isSafeInteger(array.length)||array.length<0||array.length>(bytes.length-dataStart-cursor)/Type.BYTES_PER_ELEMENT)fail();
   tree[name]=new Type(bytes.buffer,bytes.byteOffset+dataStart+cursor,array.length);cursor+=tree[name].byteLength;
  }
  validateTree(tree);collider.vertices=tree.vertices;trees.push({index:colliders.length,tree});colliders.push(collider);
 }
 if(dataStart+cursor!==bytes.length)fail();
 return {colliders,trees,sourceHash:metadata.sourceHash};
}
