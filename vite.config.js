import { defineConfig } from 'vite';
import { servePublicAsset } from './server/static-files.js';

export default defineConfig({
  publicDir:false,
  plugins:[{name:'content-assets',configureServer(server){server.middlewares.use((request,response,next)=>{if(!servePublicAsset(process.cwd(),request,response,new URL(request.url,'http://localhost').pathname))next();});}}],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:2567',
      '/socket': { target: 'ws://localhost:2567', ws: true }
    }
  }
});
