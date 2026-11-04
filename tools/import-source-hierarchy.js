import {Matrix4,Vector3,Quaternion,Euler} from 'three';

/** Source IDs are strings: Unity path IDs exceed JavaScript's integer range. */
export function sourceHierarchy(records){
  const transforms=new Map(Object.values(records).filter(r=>r.type==='Transform').map(r=>[r.data.m_GameObject.m_PathID,r.data]));
  const parents=new Map(),matrices=new Map();
  for(const [go,t] of transforms)parents.set(go,t.m_Father.m_PathID==='0'?null:records[t.m_Father.m_PathID]?.data.m_GameObject.m_PathID);
  const ancestors=go=>{
    const result=[],seen=new Set();
    while(go){if(seen.has(go))throw Error('Cyclic source hierarchy: '+go);seen.add(go);result.unshift(go);go=parents.get(go);}
    return result;
  };
  const excluded=(go,prefixes)=>ancestors(go).some(id=>prefixes.some(p=>(records[id]?.name||'').toLowerCase().startsWith(p.toLowerCase())));
  const vector=v=>new Vector3(v.m_X,v.m_Y,v.m_Z);
  const world=go=>{
    if(matrices.has(go))return matrices.get(go);
    let matrix=new Matrix4();
    for(const id of ancestors(go)){
      const t=transforms.get(id);if(!t)throw Error('Missing source transform: '+id);
      const q=t.m_LocalRotation;
      matrix.multiply(new Matrix4().compose(vector(t.m_LocalPosition),new Quaternion(q.m_X,q.m_Y,q.m_Z,q.m_W),vector(t.m_LocalScale)));
    }
    matrices.set(go,matrix);return matrix;
  };
  return {ancestors,excluded,world,path:go=>ancestors(go).map(id=>records[id]?.name||id).join('/'),active:go=>ancestors(go).every(id=>records[id]?.data.m_IsActive!==false)};
}

export function sourceBoxCollider(data,matrix){
  const reflection=new Matrix4().makeScale(-1,1,1),game=reflection.clone().multiply(matrix).multiply(reflection);
  const position=new Vector3(data.m_Center.m_X,data.m_Center.m_Y,data.m_Center.m_Z).applyMatrix4(reflection).applyMatrix4(game);
  const scale=new Vector3(),rotation=new Quaternion();game.decompose(new Vector3(),rotation,scale);
  const angles=new Euler().setFromQuaternion(rotation,'XYZ');
  return {position:position.toArray(),size:[data.m_Size.m_X,data.m_Size.m_Y,data.m_Size.m_Z].map((v,i)=>Math.max(.01,Math.abs(v*scale.getComponent(i)))),rotation:[angles.x,angles.y,angles.z]};
}

export function sameBox(a,b,tolerance=1e-4){
  if(a.type&&a.type!=='box'||!a.position||!a.size)return false;
  if(['position','size'].some(key=>a[key].some((v,i)=>Math.abs(v-b[key][i])>tolerance)))return false;
  const rotation=value=>new Quaternion().setFromEuler(new Euler(...(value.rotation||[0,0,0])));
  return 1-Math.abs(rotation(a).dot(rotation(b)))<tolerance;
}
