import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT || 2567);
const node = process.execPath;
const run = (args, extra = {}) => spawn(node, args, { cwd: root, stdio: 'inherit', windowsHide: true, ...extra });
// Always build source so npm start cannot silently serve an older dist directory.
const content=run(['tools/sync-content.js']);const contentResult=await new Promise(resolve=>content.once('exit',resolve));if(contentResult!==0)process.exit(contentResult||1);
const build = run([resolve(root, 'node_modules/vite/bin/vite.js'), 'build']);
const result = await new Promise(resolve => build.once('exit', resolve));
if (result !== 0) process.exit(result || 1);
try {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1200) });
  if (response.ok) { console.error(`A game server is already running on port ${port}. Stop its terminal with Ctrl+C, then run npm start again to load the new server code.`); process.exit(1); }
} catch { /* No server yet. */ }
const server = run(['server/index.js'], { env: { ...process.env, HOST: process.env.HOST || '0.0.0.0' } });
let editor;
try {
  const response = await fetch('http://127.0.0.1:2570/editor/', { signal: AbortSignal.timeout(1000) });
  if (!response.ok) throw new Error('not running');
} catch { editor = run([resolve(root, 'node_modules/vite/bin/vite.js'), '--config', 'editor/vite.config.js']); }
console.log(`\nPlay (singleplayer and multiplayer): http://localhost:${port}\nDeveloper editor on this PC: http://127.0.0.1:2570/editor/\nKeep this window open. Ctrl+C stops both.\n`);
const stop = () => { server.kill(); editor?.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
server.once('exit', code => { editor?.kill(); process.exitCode = code || 0; });
