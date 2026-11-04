/** A failed GPU disposal must not strand the remaining resources or scene transition. */
export function releaseResources(resources,releases=[]){
  const errors=[];
  for(const resource of resources)try{resource.dispose?.();}catch(error){errors.push(error);}
  for(const release of releases)try{release();}catch(error){errors.push(error);}
  return errors;
}
