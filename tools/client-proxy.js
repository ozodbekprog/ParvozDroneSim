import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

const target = new URL(process.argv[2] || '');
if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Usage: node tools/client-proxy.js http://LAN-SERVER-IP:2567');
const localPort = Number(process.env.CLIENT_PORT || 2568);
const upstreamPort = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
const requestModule = target.protocol === 'https:' ? https : http;

const proxy = http.createServer((request, response) => {
  const upstream = requestModule.request({
    hostname: target.hostname, port: upstreamPort, method: request.method, path: request.url,
    headers: { ...request.headers, host: target.host }
  }, result => {
    response.writeHead(result.statusCode || 502, result.headers);
    result.pipe(response);
  });
  upstream.on('error', error => { response.writeHead(502); response.end(`LAN server unavailable: ${error.message}`); });
  request.pipe(upstream);
});

proxy.on('upgrade', (request, client, head) => {
  const remote = target.protocol === 'https:'
    ? tls.connect({ host: target.hostname, port: upstreamPort, servername: target.hostname })
    : net.connect({ host: target.hostname, port: upstreamPort });
  const connected = target.protocol === 'https:' ? 'secureConnect' : 'connect';
  remote.once(connected, () => {
    const headers = { ...request.headers, host: target.host };
    remote.write(`${request.method} ${request.url} HTTP/1.1\r\n${Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n`);
    if (head.length) remote.write(head);
    client.pipe(remote).pipe(client);
  });
  remote.on('error', () => client.destroy());
  client.on('error', () => remote.destroy());
});

proxy.listen(localPort, '127.0.0.1', () => console.log(`Open http://localhost:${localPort} to play on ${target.origin} with browser radio APIs.`));
