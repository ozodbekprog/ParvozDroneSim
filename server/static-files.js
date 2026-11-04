import { createReadStream,statSync,existsSync } from 'node:fs';
import { resolve,sep,extname } from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.glb':'model/gltf-binary','.wasm':'application/wasm','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'};
export function streamFile(request,response,file) {
  const stat=statSync(file),extension=extname(file),etag=`"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const immutable=/-[a-f0-9]{16}\./.test(file) || /[\\/]dist[\\/]assets[\\/]/.test(file);
  const headers={'Content-Type':types[extension]||'application/octet-stream','ETag':etag,'Cache-Control':extension==='.html'?'no-store':immutable?'public, max-age=31536000, immutable':'no-cache','Accept-Ranges':'bytes','Vary':'Accept-Encoding'};
  if(request.headers['if-none-match']===etag) {response.writeHead(304,headers);response.end();return;}
  let start=0,end=stat.size-1,status=200;
  if(request.headers.range) {
    const range=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if(!range) {response.writeHead(416,{'Content-Range':`bytes */${stat.size}`});response.end();return;}
    if(!range[1]) start=Math.max(0,stat.size-Number(range[2]));else start=Number(range[1]);
    if(range[1]&&range[2]) end=Math.min(end,Number(range[2]));
    if(start>end || start>=stat.size) {response.writeHead(416,{'Content-Range':`bytes */${stat.size}`});response.end();return;}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
  }
  const gzip=status===200 && /\.(json|pcol|js|css|html|svg)$/.test(file) && /\bgzip\b/.test(request.headers['accept-encoding']||'');
  if(gzip) headers['Content-Encoding']='gzip';else headers['Content-Length']=Math.max(0,end-start+1);
  response.writeHead(status,headers);if(request.method==='HEAD'){response.end();return;}
  const input=createReadStream(file,{start,end});
  if(gzip) pipeline(input,createGzip(),response,()=>{});else pipeline(input,response,()=>{});
}
export function servePublicAsset(root,request,response,path) {
  if(!path.startsWith('/content/assets/')&&!path.startsWith('/runtime/')) return false;
  const base=resolve(root,'public'),file=resolve(base,'.'+decodeURIComponent(path));
  if(!file.startsWith(base+sep)||!existsSync(file)||!statSync(file).isFile()) {response.writeHead(404);response.end();return true;}
  streamFile(request,response,file);return true;
}
