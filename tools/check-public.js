import WebSocket from 'ws';

const argument = process.argv.find(value => value.startsWith('--url='));
const base = new URL(argument?.slice(6) || process.env.BASE_URL || 'http://127.0.0.1:2567');
if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Use an HTTP or HTTPS game URL.');
if (base.protocol !== 'https:' && !['127.0.0.1', 'localhost', '::1'].includes(base.hostname)) throw new Error('Public checks require HTTPS.');

async function request(path, options) {
  const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}

const health = await (await request('/api/health')).json();
if (health.status !== 'ok') throw new Error('Health response is not ready.');
const catalog = await (await request('/api/catalog')).json();
if (!Array.isArray(catalog.maps) || !catalog.maps.length) throw new Error('The content catalog is empty.');
const asset = catalog.assets?.find(item => item.url?.endsWith('.glb')) || catalog.assets?.[0];
if (asset) {
  const head = await request(asset.url, { method: 'HEAD', headers: { 'Accept-Encoding': 'identity' } });
  if (Number(head.headers.get('content-length')) !== asset.bytes) throw new Error('Asset size differs from catalog.');
  if (!head.headers.get('cache-control')?.includes('immutable')) throw new Error('Hashed asset cache header is missing.');
  const range = await request(asset.url, { headers: { Range: 'bytes=0-15', 'Accept-Encoding': 'identity' } });
  if (range.status !== 206 || !range.headers.get('content-range')?.startsWith('bytes 0-')) throw new Error('Asset byte ranges are unavailable.');
  await range.arrayBuffer();
}

const socketUrl = new URL('/socket', base);
socketUrl.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
await new Promise((resolve, reject) => {
  const socket = new WebSocket(socketUrl);
  const timeout = setTimeout(() => { socket.terminate(); reject(new Error('WebSocket upgrade timed out.')); }, 10_000);
  socket.once('open', () => { clearTimeout(timeout); socket.close(); resolve(); });
  socket.once('error', error => { clearTimeout(timeout); reject(error); });
});

console.log(`Public check passed: ${catalog.maps.length} maps, HTTPS/HTTP API, WebSocket${asset ? ', asset HEAD/range/cache' : ''}.`);
