/** A matching revision already has the full, installed catalog in the client. */
export async function loadStartupCatalog(request, installed) {
  const suffix=installed.revision?'?knownRevision='+encodeURIComponent(installed.revision):'';
  const result=await request('/catalog'+suffix);
  if(!result.contentUnchanged)return result; // Older servers and changed content.
  if(!installed.revision || result.revision!==installed.revision)throw new Error('Content changed. Please reload the game.');
  return {...result,maps:installed.maps,assets:installed.assets};
}
