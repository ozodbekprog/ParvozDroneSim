/** A pending scene owns its resources; only the latest complete scene may commit. */
export class SceneTransition {
  request(key,create){
    if(this.pending?.key===key)return this.pending.promise;
    this.cancel();
    const value=create(),entry={key,value};this.pending=entry;
    entry.promise=Promise.resolve(value.ready).then(()=>{
      if(this.pending!==entry)return false;
      value.commit();this.pending=null;return true;
    }).catch(error=>{
      if(this.pending!==entry)return false;
      this.pending=null;value.dispose();throw error;
    });
    return entry.promise;
  }
  cancel(){const entry=this.pending;if(!entry)return;this.pending=null;entry.value.dispose();}
}
