// A new, ephemeral loopback origin isolates HTTP/CacheStorage/localStorage without
// deleting an existing browser profile. All files still come from the live host.
// This measures a cold content cache, not a cold driver shader cache or target PC.
import http from 'node:http';
import https from 'node:https';
import {appendFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';

const target=new URL(process.argv[2]||'');
const report=process.argv[3];
if(!['http:','https:'].includes(target.protocol)||!report)throw Error('Usage: node tools/qa-cold-start-proxy.js https://GAME-HOST data/cold-start.jsonl');
writeFileSync(report,'',{flag:'wx'}); // Preserve earlier measurements.
const log=row=>appendFileSync(report,JSON.stringify({...row,at:new Date().toISOString()})+'\n');
const transport=target.protocol==='https:'?https:http;
const server=http.createServer((request,response)=>{
  const incoming=new URL(request.url,'http://localhost');
  const upstreamURL=new URL(target.origin);upstreamURL.pathname=incoming.pathname;upstreamURL.search=incoming.search;
  const started=performance.now(),path=incoming.pathname;
  let bytes=0,firstByteMs,status,encoding,recorded=false;
  const record=(complete,error)=>{
    if(recorded)return;recorded=true;
    log({path,status,encoding,bytes,firstByteMs,totalMs:Math.round(performance.now()-started),complete,...(error?{error}:{} )});
  };
  const upstream=transport.request(upstreamURL,{
    method:request.method,headers:{...request.headers,host:target.host},
  },result=>{
    status=result.statusCode;encoding=result.headers['content-encoding']||'identity';
    firstByteMs=Math.round(performance.now()-started);
    response.writeHead(status,result.headers);
    result.on('data',chunk=>{bytes+=chunk.length;});
    result.on('error',()=>{record(false,'upstream stream failed');response.destroy();});
    result.pipe(response);
    response.on('finish',()=>record(true));
  });
  upstream.on('error',()=>{
    record(false,'upstream connection failed');
    if(!response.headersSent)response.writeHead(502,{'Content-Type':'text/plain'});
    response.end('The game server could not be reached.');
  });
  response.on('close',()=>{if(!response.writableFinished){record(false,'browser canceled');upstream.destroy();}});
  request.pipe(upstream);
});
server.listen(0,'127.0.0.1',()=>{
  const origin=`http://127.0.0.1:${server.address().port}`;
  log({event:'start',origin,target:target.origin});
  console.log(JSON.stringify({origin,target:target.origin,report,scope:'cold startup and menus; no multiplayer socket proxy'}));
});
