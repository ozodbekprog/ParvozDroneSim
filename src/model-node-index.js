/** GLTF fragments share one name index; large maps must not scan per chunk. */
export function indexModelNodes(scenes){
  const index=new Map();
  for(const scene of scenes)scene.traverse(object=>{
    if(!object.name)return;
    const matches=index.get(object.name)||[];matches.push(object);index.set(object.name,matches);
  });
  return index;
}
export function namedModelNode(index,name){
  const matches=index.get(name)||[];
  if(matches.length!==1)throw new Error(`Expected one asset node ${name}, found ${matches.length}`);
  return matches[0];
}
