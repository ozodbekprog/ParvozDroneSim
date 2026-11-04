import test from 'node:test';import assert from 'node:assert/strict';import {Group} from 'three';
import {indexModelNodes,namedModelNode} from '../src/model-node-index.js';
test('thousands of fragment lookups traverse the loaded scene only once',()=>{
 const scene=new Group();for(let i=0;i<12000;i++){const node=new Group();node.name=`Chunk_${i}`;scene.add(node);}
 let visited=0;const traverse=scene.traverse.bind(scene);scene.traverse=callback=>traverse(object=>{visited++;callback(object);});
 const index=indexModelNodes([scene]);assert.equal(visited,12001);
 for(let i=0;i<12000;i++)assert.equal(namedModelNode(index,`Chunk_${i}`),scene.children[i]);
 assert.equal(visited,12001,'requests cannot rescan the complete GLTF scene');
});
test('ambiguous and missing names remain errors, including duplicates across scenes',()=>{
 const scenes=[new Group(),new Group()];for(const scene of scenes){const node=new Group();node.name='duplicate';scene.add(node);}
 const index=indexModelNodes(scenes);
 assert.throws(()=>namedModelNode(index,'duplicate'),/found 2/);
 assert.throws(()=>namedModelNode(index,'missing'),/found 0/);
 assert.equal(index.has(''),false);
});
