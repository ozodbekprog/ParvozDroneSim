// Preserve BC6H HDR values instead of AssetRipper's byte-valued image preview.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {recoveryFolder} from './content-import-profile.js';
const folder=recoveryFolder,resources=JSON.parse(readFileSync(folder+'resources.json','utf8'));
const manifest=JSON.parse(readFileSync(folder+'input-manifest.json','utf8'));
const source=readFileSync(manifest.bundles[0].source);
function lz4(input,size){
  const out=Buffer.alloc(size);let i=0,o=0;
  while(i<input.length){
    const token=input[i++];let length=token>>4;
    if(length===15){let extra;do{extra=input[i++];length+=extra;}while(extra===255);}
    input.copy(out,o,i,i+length);i+=length;o+=length;
    if(i>=input.length)break;
    const offset=input.readUInt16LE(i);i+=2;
    if(offset===0||offset>o)throw new Error('Invalid LZ4 offset');
    length=(token&15)+4;
    if((token&15)===15){let extra;do{extra=input[i++];length+=extra;}while(extra===255);}
    for(let n=0;n<length;n++)out[o]=out[o++-offset];
  }
  if(o!==size)throw new Error('Incomplete UnityFS block');return out;
}
const decompress=(b,size,flags)=>{
  const compression=flags&63;if(compression===0)return b;
  if(compression===2||compression===3)return lz4(b,size);
  throw new Error('Unsupported UnityFS compression: '+compression);
};
let cursor=0;const cstring=buffer=>{const end=buffer.indexOf(0,cursor),text=buffer.toString('utf8',cursor,end);cursor=end+1;return text;};
if(cstring(source)!=='UnityFS')throw new Error('Not a UnityFS bundle');
const version=source.readUInt32BE(cursor);cursor+=4;cstring(source);cstring(source);
const length=Number(source.readBigUInt64BE(cursor));cursor+=8;
const compressed=source.readUInt32BE(cursor),uncompressed=source.readUInt32BE(cursor+4),flags=source.readUInt32BE(cursor+8);cursor+=12;
if(version>=7)cursor=Math.ceil(cursor/16)*16;
const start=(flags&128)?length-compressed:cursor;
const info=decompress(source.subarray(start,start+compressed),uncompressed,flags);
let dataStart=(flags&128)?cursor:cursor+compressed;if(flags&512)dataStart=Math.ceil(dataStart/16)*16;
cursor=16;const blockCount=info.readUInt32BE(cursor);cursor+=4;
const chunks=[];let dataCursor=dataStart;
for(let n=0;n<blockCount;n++){
  const size=info.readUInt32BE(cursor),packed=info.readUInt32BE(cursor+4),blockFlags=info.readUInt16BE(cursor+8);cursor+=10;
  chunks.push(decompress(source.subarray(dataCursor,dataCursor+packed),size,blockFlags));dataCursor+=packed;
}
const data=Buffer.concat(chunks),count=info.readUInt32BE(cursor);cursor+=4;const files=[];
for(let n=0;n<count;n++){
  const offset=Number(info.readBigUInt64BE(cursor)),size=Number(info.readBigUInt64BE(cursor+8));cursor+=20;
  files.push({offset,size,name:cstring(info)});
}
mkdirSync(folder+'hdr-lightmaps',{recursive:true});
for(const [n,key] of resources.lightmaps.entries()){
  if(!key)continue;
  const texture=resources.textures.find(t=>t.key===key),number=Number(texture.file.match(/texture-(\d+)/)[1]);
  const metadata=JSON.parse(readFileSync(folder+'textures/texture-'+number+'.json','utf8'));
  const name=metadata.m_StreamData.m_Path.split('/').at(-1),entry=files.find(f=>f.name===name);
  if(!entry)throw new Error('Missing scene resource: '+name);
  const offset=entry.offset+metadata.m_StreamData.m_Offset,size=metadata.m_StreamData.m_Size;
  if(metadata.m_Format!==24||offset+size>entry.offset+entry.size)throw new Error('Unexpected lightmap format or extent');
  const header=Buffer.alloc(148);header.write('DDS ');header.writeUInt32LE(124,4);header.writeUInt32LE(0xA1007,8);
  header.writeUInt32LE(metadata.m_Height,12);header.writeUInt32LE(metadata.m_Width,16);
  header.writeUInt32LE(metadata.m_Width*metadata.m_Height,20);header.writeUInt32LE(metadata.m_MipCount,28);
  header.writeUInt32LE(32,76);header.writeUInt32LE(4,80);header.write('DX10',84);header.writeUInt32LE(0x401008,108);
  header.writeUInt32LE(95,128);header.writeUInt32LE(3,132);header.writeUInt32LE(1,140);
  const file=folder+'hdr-lightmaps/lightmap-'+n+'.dds';writeFileSync(file,Buffer.concat([header,data.subarray(offset,offset+size)]));
  console.log({file,width:metadata.m_Width,height:metadata.m_Height,bytes:size});
}
