// Configure only the task-owned recovery service, without saving user settings.
const base=process.argv[2]||'http://127.0.0.1:2578';
const html=await(await fetch(base+'/Settings/Edit')).text(),body=new URLSearchParams();
for(const match of html.matchAll(/<input[^>]+>/g)){
  const tag=match[0],name=tag.match(/name="([^"]+)"/)?.[1];
  if(!name||name==='SaveSettingsToDisk')continue;
  if(tag.includes('type="checkbox"')){if(tag.includes('checked'))body.set(name,'true');}
  else body.set(name,tag.match(/value="([^"]*)"/)?.[1]||'');
}
for(const match of html.matchAll(/<select[^>]+name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
  const option=match[2].match(/<option[^>]+selected[^>]*>/)?.[0]||match[2].match(/<option[^>]*>/)?.[0];
  body.set(match[1],option.match(/value="([^"]+)"/)?.[1]||'');
}
body.set('DefaultVersion','2022.3.62f3');
const response=await fetch(base+'/Settings/Update',{method:'POST',body});if(!response.ok)throw new Error('Ripper settings failed');
await response.arrayBuffer(); // Finish the redirected response so this CLI exits.
console.log('Task recovery version configured: 2022.3.62f3');
