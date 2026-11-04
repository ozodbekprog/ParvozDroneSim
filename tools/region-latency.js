import { performance } from 'node:perf_hooks';

const regions = {
  dubai: 'https://iaas.me-dubai-1.oraclecloud.com/',
  frankfurt: 'https://iaas.eu-frankfurt-1.oraclecloud.com/'
};
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
for (const [region, url] of Object.entries(regions)) {
  const samples = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const started = performance.now();
    try {
      // Any HTTP status proves that DNS, TCP and TLS reached the regional endpoint.
      await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(5000) });
      samples.push(Math.round(performance.now() - started));
    } catch (error) { console.warn(`${region}: request ${attempt + 1} failed: ${error.message}`); }
  }
  console.log(`${region}: ${samples.length ? `median HTTPS ${median(samples)} ms (${samples.join(', ')} ms)` : 'unreachable'}`);
}
console.log('These HTTPS timings include connection setup. After deployment, measure WebSocket RTT in the game region too.');
