import {openSync,readSync,closeSync,fstatSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
// Read one verified archive member without restoring or reactivating the retired map.
export function archivedIronworks(path){
  const file=openSync(new URL('../../backups/ironworks-v2-20261013.zip',import.meta.url));
  const read=(position,size)=>{const data=Buffer.alloc(size);if(readSync(file,data,0,size,position)!==size)throw Error('Truncated archive');return data;};
  try{
    const size=fstatSync(file).size,tail=read(Math.max(0,size-65557),Math.min(size,65557));let end=tail.length-22;
    while(end>=0&&tail.readUInt32LE(end)!==0x06054b50)end--;
    if(end<0)throw Error('Invalid ZIP directory');
    const directory=read(tail.readUInt32LE(end+16),tail.readUInt32LE(end+12));
    const target=path.replace('content/archived-maps/','');
    for(let offset=0;offset<directory.length;){
      if(directory.readUInt32LE(offset)!==0x02014b50)throw Error('Invalid ZIP member');
      const nameLength=directory.readUInt16LE(offset+28),extra=directory.readUInt16LE(offset+30),comment=directory.readUInt16LE(offset+32);
      const name=directory.subarray(offset+46,offset+46+nameLength).toString('utf8');
      if(name===target){
        const method=directory.readUInt16LE(offset+10),packed=directory.readUInt32LE(offset+20),unpacked=directory.readUInt32LE(offset+24),position=directory.readUInt32LE(offset+42);
        const header=read(position,30),bytes=read(position+30+header.readUInt16LE(26)+header.readUInt16LE(28),packed);
        const result=method===0?bytes:method===8?inflateRawSync(bytes):null;
        if(!result||result.length!==unpacked)throw Error('Invalid archived content');return result;
      }
      offset+=46+nameLength+extra+comment;
    }
    throw Error('Missing archived member '+target);
  }finally{closeSync(file);}
}
