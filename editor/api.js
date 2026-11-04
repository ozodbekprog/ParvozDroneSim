import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID,createHash } from 'node:crypto';
import { validateCatalog as validateCustomContent } from '../shared/catalog-schema.js';
import { writeSources,syncContent } from '../tools/content-packages.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const draftFile = join(root, 'editor', 'draft.json');
const statusFile = join(root, 'editor', 'publish-status.json');
const manifestFile = join(root, 'public', 'content', 'catalog.json');
const assetsDir = join(root, 'public', 'content', 'assets');
const blank = { version: 1, maps: [], drones: [], parts: [], challenges: [] };
const reply = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };

async function body(request, maxBytes) {
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > maxBytes) throw new Error('Upload is too large.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}

function verifyAssets(content) {
  const files = new Set();
  for (const item of [...content.maps, ...content.drones, ...content.parts, ...content.challenges, ...content.tutorials]) {
    if (item.model) files.add(item.model);
    for (const object of item.objects || []) { if (object.model) files.add(object.model); for (const material of object.materials || []) { if (material.baseTexture) files.add(material.baseTexture); if (material.normalTexture) files.add(material.normalTexture); } }
    for (const material of item.materials || []) {
      if (material.baseTexture) files.add(material.baseTexture);
      if (material.normalTexture) files.add(material.normalTexture);
    }
  }
  for (const file of files) if (!existsSync(join(root, 'public', file.slice(1)))) throw new Error(`Missing asset: ${file}`);
}

export async function editorApi(request, response) {
  try {
    const address = request.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return reply(response, 403, { error: 'Local editor only.' });
    const origin = request.headers.origin;
    if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost):2570$/.test(origin)) return reply(response, 403, { error: 'Invalid editor origin.' });
    const url = new URL(request.url, 'http://127.0.0.1:2570');
    if (url.pathname === '/status' && request.method === 'GET') return reply(response, 200, existsSync(statusFile) ? JSON.parse(readFileSync(statusFile,'utf8')) : { published: false });
    if(url.pathname==='/catalog'&&request.method==='GET')return reply(response,200,JSON.parse(readFileSync(manifestFile,'utf8')));
    if(url.pathname==='/export-model'&&request.method==='POST') {
      const kind=url.searchParams.get('kind'),id=url.searchParams.get('id');
      if(!['maps','drones','parts'].includes(kind)||!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id||''))throw new Error('Invalid export target.');
      const content=JSON.parse(readFileSync(manifestFile,'utf8')),original=content[kind].find(item=>item.id===id);if(!original)throw new Error('Unknown export item.');
      const bytes=await body(request,250_000_000);if(bytes.toString('ascii',0,4)!=='glTF')throw new Error('Expected GLB export.');
      const directory=join(root,'export/editable',kind,kind==='parts'?`${original.category}-${id}`:id);mkdirSync(directory,{recursive:true});writeFileSync(join(directory,'model.glb'),bytes);
      const definition=structuredClone(original);definition.model='model.glb';definition.materials=[];delete definition.modelTransform;delete definition.collisionFile;delete definition.preparedCollisionFile;delete definition.thumbnail;
      if(kind==='maps') {
        definition.colliders=[];
        for(const track of definition.tracks){const directory=join(root,'export/editable/races',track.id);mkdirSync(directory,{recursive:true});writeFileSync(join(directory,'race.json'),JSON.stringify({...track,map:id},null,2));}
        delete definition.tracks;
      }
      writeFileSync(join(directory,`${{maps:'map',drones:'drone',parts:'part'}[kind]}.json`),JSON.stringify(definition,null,2));return reply(response,200,{folder:directory});
    }
    if(url.pathname==='/export-thumbnail'&&request.method==='POST'){
      const id=url.searchParams.get('id');if(!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id||''))throw new Error('Invalid map ID.');
      const bytes=await body(request,5_000_000);if(bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error('Expected JPEG.');
      const directory=join(root,'export/editable/maps',id);mkdirSync(directory,{recursive:true});writeFileSync(join(directory,'thumbnail.jpg'),bytes);return reply(response,200,{saved:true});
    }
    if (url.pathname === '/draft' && request.method === 'GET') { const saved = existsSync(draftFile) && statSync(draftFile).mtimeMs>=statSync(manifestFile).mtimeMs ? JSON.parse(readFileSync(draftFile, 'utf8')) : null; return reply(response, 200, saved?.version === 2 ? saved : JSON.parse(readFileSync(manifestFile, 'utf8'))); }
    if (url.pathname === '/draft' && request.method === 'POST') {
      const content = JSON.parse((await body(request, 20_000_000)).toString());
      if (content.version !== 2 || ['maps', 'drones', 'parts', 'challenges', 'tutorials'].some(key => !Array.isArray(content[key]))) throw new Error('Invalid draft structure.');
      writeFileSync(draftFile, JSON.stringify(content, null, 2));
      return reply(response, 200, { saved: true });
    }
    if (url.pathname === '/publish' && request.method === 'POST') {
      const saved = existsSync(draftFile) ? JSON.parse(readFileSync(draftFile, 'utf8')) : null;
      const content = validateCustomContent(saved?.version === 2 ? saved : JSON.parse(readFileSync(manifestFile, 'utf8')));
      verifyAssets(content);
      const pending = `${manifestFile}.${randomUUID()}.tmp`;
      writeFileSync(pending, JSON.stringify(content, null, 2));
      if (existsSync(manifestFile)) copyFileSync(manifestFile, `${manifestFile}.bak`);
      renameSync(pending, manifestFile);
      writeSources(root,content); syncContent(root);
      const result = { published: true, at: new Date().toISOString(), counts: Object.fromEntries(['maps', 'drones', 'parts', 'challenges', 'tutorials'].map(key => [key, content[key].length])) };
      writeFileSync(statusFile, JSON.stringify(result));
      return reply(response, 200, result);
    }
    if (url.pathname === '/asset' && request.method === 'POST') {
      const original = String(url.searchParams.get('name') || '');
      const extension = original.split('.').at(-1)?.toLowerCase();
      if (!['glb', 'png', 'jpg', 'jpeg'].includes(extension)) throw new Error('Upload GLB, PNG, or JPEG files only.');
      const bytes = await body(request, 250_000_000);
      const valid = extension === 'glb' ? bytes.toString('ascii', 0, 4) === 'glTF' : extension === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 0xff && bytes[1] === 0xd8;
      if (!valid) throw new Error('File contents do not match the selected format.');
      const id=randomUUID(),name=`${id}.${extension}`,hash=createHash('sha256').update(bytes).digest('hex').slice(0,16),output=`${id}-${hash}.${extension}`;
      mkdirSync(join(root,'content/shared-assets/imported'),{recursive:true});writeFileSync(join(root,'content/shared-assets/imported',name),bytes,{flag:'wx'});
      mkdirSync(join(assetsDir,'imported'),{recursive:true});writeFileSync(join(assetsDir,'imported',output),bytes,{flag:'wx'});
      return reply(response, 200, { path: `/content/assets/imported/${output}` });
    }
    reply(response, 404, { error: 'Unknown editor action.' });
  } catch (error) { reply(response, 400, { error: error.message }); }
}
