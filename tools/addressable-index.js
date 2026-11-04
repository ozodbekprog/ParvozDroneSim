import{readFileSync}from'node:fs';
import{join,basename}from'node:path';
export function addressableIndex(source,catalogPath,bundlesPath){
 const catalog=JSON.parse(readFileSync(join(source,catalogPath))),b=Buffer.from(catalog.m_BucketDataString,'base64'),k=Buffer.from(catalog.m_KeyDataString,'base64'),e=Buffer.from(catalog.m_EntryDataString,'base64'),keys=[],buckets=[];
 for(let i=0,p=4;i<b.readInt32LE(0);i++){const o=b.readInt32LE(p),n=b.readInt32LE(p+4);keys.push(k[o]===0?k.toString('utf8',o+5,o+5+k.readInt32LE(o+1)):null);buckets.push(Array.from({length:n},(_,j)=>b.readInt32LE(p+8+4*j)));p+=8+n*4;}
 return{keys,bundlesFor(roots){const visited=new Set(),files=new Set();function visit(n){if(visited.has(n))return;visited.add(n);const p=4+n*28,id=catalog.m_InternalIds[e.readInt32LE(p)],d=e.readInt32LE(p+8);if(id.endsWith('.bundle'))files.add(join(source,bundlesPath,basename(id.replaceAll('\\','/'))));if(d>=0)for(const v of buckets[d])visit(v);}for(const root of roots){const i=keys.indexOf(root);if(i<0)throw new Error('Missing catalog asset '+root);for(const n of buckets[i])visit(n);}return[...files];}};
}
