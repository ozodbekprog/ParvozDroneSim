import { defineConfig } from 'vite';
import { editorApi } from './api.js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { servePublicAsset } from '../server/static-files.js';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const assetsRoot = resolve(root, 'public', 'content', 'assets');

const gamePort = Number(process.env.PORT || 2567);

export default defineConfig({
  root,
  publicDir: false,
  server: {
    host: '127.0.0.1',
    port: 2570,
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${gamePort}`,
      '/socket': { target: `ws://127.0.0.1:${gamePort}`, ws: true }
    }
  },
  plugins: [{ name: 'local-content-editor', configureServer(server) {
    server.middlewares.use('/editor-api', editorApi);
    server.middlewares.use((request,response,next)=>{if(!servePublicAsset(root,request,response,new URL(request.url,'http://localhost').pathname))next();});
    server.middlewares.use('/content/assets', (request,response,next) => {
      const name = decodeURIComponent((request.url || '').split('?')[0]).replace(/^\/+/, '');
      const path = resolve(assetsRoot, name);
      if (!path.startsWith(assetsRoot + sep) || !existsSync(path)) return next();
      response.setHeader('Content-Type', /\.glb$/i.test(path) ? 'model/gltf-binary' : /\.png$/i.test(path) ? 'image/png' : 'image/jpeg');
      response.end(readFileSync(path));
    });
  } }]
});
