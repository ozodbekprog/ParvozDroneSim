import {Matrix4,Quaternion,Vector3} from 'three';
const vector=(value,keys)=>keys.split('').map(key=>value?.[key]??value?.['m_'+key.toUpperCase()]??(key==='w'?1:0));
/** PartSlot.Awake uses the child SnapPoint; absent child means identity. */
export function nativeSlotTransform(records,rootId,slotId){
 const byId=new Map(records.map(r=>[r.id,r])),transforms=new Map(records.filter(r=>r.type==='Transform').map(r=>[r.data.m_GameObject.m_PathID,r]));
 const local=data=>new Matrix4().compose(new Vector3(...vector(data.m_LocalPosition,'xyz')),new Quaternion(...vector(data.m_LocalRotation,'xyzw')).normalize(),new Vector3(...vector(data.m_LocalScale,'xyz')));
 const world=id=>{const t=transforms.get(id)?.data;if(!t)throw Error('Missing native transform '+id);const m=local(t),parent=t.m_Father.m_PathID;return parent==='0'?m:world(byId.get(parent).data.m_GameObject.m_PathID).multiply(m);};
 const transform=transforms.get(slotId),snap=(transform.data.m_Children||[]).map(p=>byId.get(p.m_PathID)).find(r=>byId.get(r.data.m_GameObject.m_PathID)?.data.m_Name==='SnapPoint');
 const matrix=world(rootId).invert().multiply(world(slotId));if(snap)matrix.multiply(local(snap.data));
 const mirror=new Matrix4().makeScale(-1,1,1);
 return mirror.clone().multiply(matrix).multiply(mirror).toArray();
}
