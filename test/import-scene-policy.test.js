import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3,Euler} from 'three';
import {sourceHierarchy,sourceBoxCollider,sameBox} from '../tools/import-source-hierarchy.js';

const vec=(x=0,y=0,z=0)=>({m_X:x,m_Y:y,m_Z:z});
function fixture(){
  const records={};
  const add=(id,name,parent,position=vec(),rotation={...vec(),m_W:1},scale=vec(1,1,1))=>{
    records[id]={type:'GameObject',name,data:{m_IsActive:true}};
    records['t'+id]={type:'Transform',data:{m_GameObject:{m_PathID:id},m_Father:{m_PathID:parent?'t'+parent:'0'},m_LocalPosition:position,m_LocalRotation:rotation,m_LocalScale:scale}};
  };
  add('1','LevelWalls');add('2','LevelWall','1',vec(0,50,0));add('3','Warehouse');add('4','ConcreteWall','3');
  return {records,add};
}
test('collision exclusions follow source ancestry without excluding ordinary physical walls',()=>{
  const {records}=fixture(),h=sourceHierarchy(records);
  assert.equal(h.excluded('2',['LevelWalls']),true);
  assert.equal(h.excluded('4',['LevelWalls']),false);
  assert.equal(h.path('2'),'LevelWalls/LevelWall');
  records['1'].data.m_IsActive=false;assert.equal(h.active('2'),false);assert.equal(h.active('4'),true);
});
test('source collider conversion preserves rotated, nonuniform parent transforms and reflection',()=>{
  const {records,add}=fixture();const q=new Quaternion().setFromEuler(new Euler(.2,.7,-.1));
  add('5','Structure',null,vec(8,4,-7),{m_X:q.x,m_Y:q.y,m_Z:q.z,m_W:q.w},vec(2,3,4));
  add('6','Collider','5',vec(2,1,-1));
  const matrix=sourceHierarchy(records).world('6'),data={m_Center:vec(.5,.2,-.3),m_Size:vec(2,4,3)};
  const box=sourceBoxCollider(data,matrix),rotation=new Quaternion().setFromEuler(new Euler(...box.rotation));
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
    const local=new Vector3(.5+x,.2+y*2,-.3+z*1.5).applyMatrix4(matrix);local.x*=-1;
    const candidates=[];
    for(const a of [-1,1])for(const b of [-1,1])for(const c of [-1,1])candidates.push(new Vector3(a*box.size[0]/2,b*box.size[1]/2,c*box.size[2]/2).applyQuaternion(rotation).add(new Vector3(...box.position)));
    assert.ok(candidates.some(v=>v.distanceTo(local)<1e-8));
  }
  assert.equal(sameBox(box,{...box,rotation:box.rotation.map((v,i)=>v+(i===0?Math.PI*2:0))}),true);
  assert.equal(sameBox({...box,position:[99,0,0]},box),false);
});
