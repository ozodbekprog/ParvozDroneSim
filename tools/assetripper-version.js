// Call before loading source files; never persist changes to the user's settings.
export async function configureRipperVersion(base,version){
 const h=await(await fetch(base+'/Settings/Edit')).text();
 if(!h.includes('name="DefaultVersion"'))throw new Error('Configure the extractor before loading files');
 const form=new URLSearchParams();
 for(const m of h.matchAll(/<input\b([^>]+)>/g)){
  const a=m[1],name=a.match(/name="([^"]+)"/)?.[1];if(!name||/disabled=/.test(a))continue;
  if(/type="checkbox"/.test(a)){if(/checked=/.test(a))form.set(name,'on');}else form.set(name,a.match(/value="([^"]*)"/)?.[1]||'');
 }
 for(const m of h.matchAll(/<select[^>]*name="([^"]+)"[^>]*>(.*?)<\/select>/gs)){
  const opts=[...m[2].matchAll(/<option([^>]*)>(.*?)<\/option>/gs)],opt=opts.find(v=>/selected/.test(v[1]))||opts[0];if(opt)form.set(m[1],opt[1].match(/value="([^"]+)"/)?.[1]||opt[2]);
 }
 form.set('DefaultVersion',version);form.delete('SaveSettingsToDisk');
 const r=await fetch(base+'/Settings/Update',{method:'POST',body:form});if(!r.ok)throw new Error('Extractor version setting failed');await r.text();
}
