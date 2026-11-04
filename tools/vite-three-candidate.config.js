import {defineConfig} from 'vite';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {servePublicAsset,streamFile} from '../server/static-files.js';

// Isolated renderer comparison. It never changes the production Three version,
// generated content, decoder files, or the ordinary Vite dependency cache.
const candidate=resolve('data/browser-readiness-20261025/three-candidate/node_modules/three');
if(!existsSync(resolve(candidate,'package.json')))throw Error('Install the documented isolated Three candidate first');
export default defineConfig({
 publicDir:false,cacheDir:'data/browser-readiness-20261025/three-candidate-vite-cache',
 resolve:{alias:[
  {find:'three/addons',replacement:resolve(candidate,'examples/jsm')},
  {find:'three/examples',replacement:resolve(candidate,'examples')},
  {find:'three/src',replacement:resolve(candidate,'src')},
  {find:'three/webgpu',replacement:resolve(candidate,'build/three.webgpu.js')},
  {find:'three/tsl',replacement:resolve(candidate,'build/three.tsl.js')},
  {find:/^three$/,replacement:resolve(candidate,'build/three.module.js')}
 ]},
 plugins:[{name:'candidate-content',configureServer(server){server.middlewares.use((request,response,next)=>{
  const path=new URL(request.url,'http://localhost').pathname;
  if(/^\/runtime\/basis\/basis_transcoder\.(js|wasm)$/.test(path)){streamFile(request,response,resolve(candidate,'examples/jsm/libs/basis',path.split('/').at(-1)));return;}
  if(!servePublicAsset(process.cwd(),request,response,path))next();
 });}}],
 server:{host:'127.0.0.1',port:2599,strictPort:true,proxy:{'/api':'http://localhost:2567','/socket':{target:'ws://localhost:2567',ws:true}}}
});
