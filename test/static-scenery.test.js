import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,PerspectiveCamera} from 'three';
import {freezeScenery} from '../src/static-scenery.js';
import {updateVisualLODs} from '../src/visual-lod.js';

test('warm map LOD update skips immutable model subtrees and retains authored transforms',()=>{
  const scene=new Group(),root=new Group(),lod=new Group(),camera=new PerspectiveCamera();
  root.position.set(4,2,10);scene.add(root);root.add(lod);
  lod.userData.visualLod={distances:[0,20],minimumLow:1,active:-1};
  for(let i=0;i<2;i++){const level=new Group();lod.add(level);for(let j=0;j<1000;j++)level.add(new Group());}
  freezeScenery(root);
  const matrix=lod.matrixWorld.clone();let visits=0;
  root.traverse(object=>{const original=object.updateWorldMatrix;object.updateWorldMatrix=function(...args){visits++;return original.apply(this,args);};});
  updateVisualLODs(scene,camera,{low:true});
  assert.equal(lod.children[1].visible,true);assert.deepEqual(lod.matrixWorld,matrix);
  assert.ok(visits<10,`visited ${visits} immutable nodes`);
  updateVisualLODs(scene,camera,{preview:true});assert.equal(lod.children[0].visible,true);
  const moving=new Group();scene.add(moving);moving.position.set(7,8,9);
  scene.updateMatrixWorld();assert.equal(moving.matrixWorld.elements[12],7);
});
