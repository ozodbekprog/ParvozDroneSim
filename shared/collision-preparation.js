import {validateColliders} from './catalog-schema.js';
import {buildPackedCollisionTree} from './packed-collision-tree.js';
import {isCollisionBinary,decodeCollisionBinary} from './collision-binary.js';
import {installCollisionTree} from './collision.js';

/** Synchronous server path; the browser installs the same trees from its worker. */
export function hydrateCollisionPayload(bytes){
 const {payload}=prepareCollisionPayload(bytes);
 for(const {index,tree}of payload.trees)installCollisionTree(payload.colliders[index],tree);
 return payload.colliders;
}

/** Runs in the collision worker. Authored JSON is validated before conversion. */
export function prepareCollisionPayload(bytes){
 const start=performance.now();
 if(isCollisionBinary(bytes)){
  const result=decodeCollisionBinary(bytes),transfer=new Set();
  for(const {tree}of result.trees)for(const array of Object.values(tree))transfer.add(array.buffer);
  return {payload:{...result,timing:{format:'pcol-v1',parseValidateMs:performance.now()-start,buildMs:0,inputBytes:bytes.byteLength}},transfer:[...transfer]};
 }
 const colliders=validateColliders(JSON.parse(new TextDecoder().decode(bytes)));
 const parsed=performance.now(),trees=[],transfer=new Set();
 for(let i=0;i<colliders.length;i++){
  const collider=colliders[i];if(collider.type!=='mesh')continue;
  const tree=buildPackedCollisionTree(collider.vertices);
  collider.vertices=tree.vertices;trees.push({index:i,tree});
  for(const value of Object.values(tree))transfer.add(value.buffer);
 }
 return {payload:{colliders,trees,timing:{format:'json',parseValidateMs:parsed-start,buildMs:performance.now()-parsed,inputBytes:bytes.byteLength}},transfer:[...transfer]};
}
