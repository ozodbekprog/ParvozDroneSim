import { Matrix4, Vector3, Quaternion, Euler, Box3 } from 'three';

// Reads geometry and authoring markers without decoding textures or creating a GPU context.
export function inspectGlb(bytes,transform={}, { skipCollision = false } = {}) {
  if(bytes.length<20 || bytes.toString('ascii',0,4)!=='glTF' || bytes.readUInt32LE(4)!==2 || bytes.readUInt32LE(8)!==bytes.length) throw new Error('Expected a complete glTF 2.0 GLB.');
  let data, binary;
  for(let offset=12;offset<bytes.length;) {
    if(offset+8>bytes.length)throw new Error('Truncated GLB chunk header.');
    const size=bytes.readUInt32LE(offset), type=bytes.readUInt32LE(offset+4);if(size%4 || offset+8+size>bytes.length)throw new Error('Invalid GLB chunk size.');
    if(type===0x4e4f534a) data=JSON.parse(bytes.subarray(offset+8,offset+8+size).toString().trim());
    if(type===0x004e4942) binary=bytes.subarray(offset+8,offset+8+size);
    offset+=8+size;
  }
  if(!data) throw new Error('GLB has no JSON chunk.');
  const matrices=new Map(), bounds=new Box3(), meshes=[], gates=[]; let spawn;
  const visit=(index,parent)=>{
    const node=data.nodes[index], local=new Matrix4();
    if(node.matrix) local.fromArray(node.matrix);
    else local.compose(new Vector3().fromArray(node.translation||[0,0,0]),new Quaternion().fromArray(node.rotation||[0,0,0,1]),new Vector3().fromArray(node.scale||[1,1,1]));
    const world=parent.clone().multiply(local); matrices.set(index,world);
    const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3(); world.decompose(position,rotation,scale);
    const yaw=new Euler().setFromQuaternion(rotation,'YXZ').y;
    if(/^SPAWN$/i.test(node.name) || node.extras?.flightSpawn) spawn={position:position.toArray(),yaw};
    if(/^GATE[_-]\d+$/i.test(node.name) || node.extras?.flightGate) gates.push({order:node.extras?.order ?? Number(node.name?.match(/\d+/)?.[0]||0),track:node.extras?.track,position:position.toArray(),yaw,width:node.extras?.width ?? Math.abs(scale.x)*6,height:node.extras?.height ?? Math.abs(scale.y)*5,...(node.extras?.gateClass?{gateClass:node.extras.gateClass}:{}),...(node.extras?.frameThickness!==undefined?{frameThickness:node.extras.frameThickness}:{}),...(node.extras?.support?{support:node.extras.support}:{})});
    if(node.mesh!==undefined && !/^(GATE[_-]|SPAWN)/i.test(node.name||'')) for(const primitive of data.meshes[node.mesh].primitives) {
      if(primitive.mode!==undefined && primitive.mode!==4) continue;
      const a=data.accessors[primitive.attributes.POSITION]; if(!a) continue;
      // Quantized accessor bounds are stored as integers, just like vertex data.
      // Normalize them before applying the node's decode transform.
      const divisor=a.normalized?{5120:127,5121:255,5122:32767,5123:65535}[a.componentType]:1;
      const normalize=values=>values.map(v=>Math.max(-1,v/divisor));
      const meshBounds=a.min && a.max ? new Box3(new Vector3().fromArray(a.normalized?normalize(a.min):a.min),new Vector3().fromArray(a.normalized?normalize(a.max):a.max)).applyMatrix4(world):new Box3();
      bounds.union(meshBounds);
      meshes.push({primitive,world,bounds:meshBounds,collider:/^COLLIDER[_-]/i.test(node.name||'') || node.extras?.collider});
    }
    for(const child of node.children||[]) visit(child,world);
  };
  const root=new Matrix4().compose(new Vector3().fromArray(transform.position||[0,0,0]),new Quaternion().setFromEuler(new Euler(...(transform.rotation||[0,0,0]))),new Vector3().setScalar(transform.scale||1));
  for(const node of data.scenes?.[data.scene||0]?.nodes||[]) visit(node,root);
  const accessor=index=>{
    const a=data.accessors[index],view=data.bufferViews?.[a.bufferView];
    if(!view || !binary || a.sparse || view.extensions?.EXT_meshopt_compression || view.extensions?.KHR_meshopt_compression || (view.buffer ?? 0) !== 0) throw new Error('Compressed/sparse geometry needs a collision.json or named uncompressed COLLIDER meshes.');
    const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],width={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a.componentType];
    const read={5120:'readInt8',5121:'readUInt8',5122:'readInt16LE',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];
    const start=(view.byteOffset||0)+(a.byteOffset||0),stride=view.byteStride||width*components;
    return {count:a.count,at:(n,c=0)=>{
      let value=binary[read](start+n*stride+c*width);
      if(a.normalized) { const divisor={5120:127,5121:255,5122:32767,5123:65535}[a.componentType]; value=Math.max(-1,value/divisor); }
      return value;
    }};
  };
  const selected=meshes.some(m=>m.collider)?meshes.filter(m=>m.collider):meshes;
  let vertices=[],warnings=[];
  try {
    for(const mesh of skipCollision ? [] : selected) {
      if(mesh.primitive.extensions?.KHR_draco_mesh_compression) throw new Error('Compressed geometry needs a collision.json or named uncompressed COLLIDER meshes.');
      const positions=accessor(mesh.primitive.attributes.POSITION),indices=mesh.primitive.indices===undefined?null:accessor(mesh.primitive.indices);
      const count=indices?.count||positions.count;
      if(vertices.length+count*3>900000) throw new Error('Collision exceeds 100,000 triangles; using mesh bounds. Add low-poly COLLIDER meshes or collision.json.');
      for(let n=0;n<count;n++) { const i=indices?indices.at(n):n; const p=new Vector3(positions.at(i,0),positions.at(i,1),positions.at(i,2)).applyMatrix4(mesh.world); vertices.push(...p.toArray()); }
    }
  } catch(error) { vertices=[];warnings.push(error.message); }
  const colliders=skipCollision?[]:vertices.length?[{type:'mesh',vertices}]:selected.filter(m=>!m.bounds.isEmpty()).map(m=>({position:m.bounds.getCenter(new Vector3()).toArray(),size:m.bounds.getSize(new Vector3()).toArray().map(x=>Math.max(.02,x)),visible:false}));
  const orders=new Set();for(const gate of gates){const key=`${gate.track||''}:${gate.order}`;if(orders.has(key))throw new Error('Duplicate gate order in GLB: '+key);orders.add(key);}
  return {colliders,gates:gates.sort((a,b)=>a.order-b.order).map(({order,...gate})=>gate),spawn,bounds:bounds.isEmpty()?null:{min:bounds.min.toArray(),max:bounds.max.toArray()},warnings};
}
