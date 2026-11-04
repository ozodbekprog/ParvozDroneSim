import {GAMEPLAY_OBSTACLES} from '../shared/content.js';
import {validateColliders} from '../shared/catalog-schema.js';
import {prepareCollisionsAsync} from '../shared/collision.js';
import {loadPreparedCollisions} from './collision-preparation.js';
import {collisionFileFor} from '../shared/collision-binary.js';

const prepared=new WeakMap();

/** Retiring a map releases decoded physics; encoded downloads remain reusable. */
export function releaseMapCollisions(map,obstacles=GAMEPLAY_OBSTACLES){
 if(!map)return;
 const entry=prepared.get(map);
 if(entry?.store===obstacles&&obstacles[map.id]===entry.result)obstacles[map.id]=map.colliders||[];
 prepared.delete(map);
}

/** Presentation scenes need visuals only. Flight must await the full authored
 * collision data even when it reuses an environment first opened in Hangar. */
export function prepareMapCollisions(map,presentation,{load,prepare=loadPreparedCollisions,signal,obstacles=GAMEPLAY_OBSTACLES}={}){
 const file=collisionFileFor(map);
 if(presentation!=='flight'||!file)return Promise.resolve();
 const current=prepared.get(map);
 if(current?.file===file&&(current.result||!current.signal?.aborted)&&current.store===obstacles&&(current.result||current.input)===obstacles[map.id])return current.promise;
 const entry={file,store:obstacles,input:obstacles[map.id],signal};
 entry.promise=Promise.resolve().then(()=>load?load(entry.file):prepare(entry.file,{signal})).then(async data=>{
  signal?.throwIfAborted();
  if(prepared.get(map)!==entry||collisionFileFor(map)!==entry.file)throw new DOMException('Map changed during collision preparation','AbortError');
  const colliders=map.colliders?.length?[...map.colliders,...(load?validateColliders(data):data)]:(load?validateColliders(data):data);
  await prepareCollisionsAsync(colliders,{signal});signal?.throwIfAborted();
  if(prepared.get(map)!==entry||collisionFileFor(map)!==entry.file)throw new DOMException('Map changed during collision preparation','AbortError');
  obstacles[map.id]=entry.result=colliders;
 }).catch(error=>{if(prepared.get(map)===entry)prepared.delete(map);throw error;});
 prepared.set(map,entry);return entry.promise;
}
