import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function assessCapacity(report, metrics) {
  const failures = [];
  const start = Date.parse(report.startedAt), end = Date.parse(report.endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 3600_000 || report.requestedSeconds < 3600) failures.push('A measured hour is required.');
  if (report.clients !== 100 || report.pilots?.length !== 100) failures.push('100 individually measured clients are required.');
  if (!report.clientChecksPassed || report.errors || report.disconnects || report.failures?.length) failures.push('Client checks failed.');
  if (new Set(report.maps).size < 2) failures.push('Use at least two real maps.');
  if (!report.coldAssets?.requested || report.coldAssets.completed !== 100) failures.push('100 complete cold asset downloads are required.');
  for (const pilot of report.pilots || []) {
    if (pilot.sent < report.requestedSeconds * 50 || pilot.acknowledged < pilot.sent * .9 || pilot.movingSnapshots < report.requestedSeconds || pilot.maxAckGapMs > 5000 || !Number.isFinite(pilot.pingP95Ms)) {
      failures.push(`Client ${pilot.client} did not sustain active flight/acknowledgements.`);
    }
  }
  const samples = metrics.filter(sample => sample.type === 'server-metrics' && Date.parse(sample.at) >= start && Date.parse(sample.at) <= end);
  if (samples.length < 230 || Date.parse(samples[0]?.at) - start > 30000 || end - Date.parse(samples.at(-1)?.at) > 30000) failures.push('Missing server metrics covering the measured hour.');
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample.players !== 100 || !Number.isFinite(sample.tickP95Ms) || sample.tickP95Ms >= 16.7 || sample.serverErrors) failures.push('Server player count, tick time or error gate failed.');
    if (i && (Date.parse(sample.at) - Date.parse(samples[i - 1].at) > 30000 || sample.serverTick <= samples[i - 1].serverTick)) failures.push('Server metrics have a gap or simulation did not advance.');
  }
  const droppedMs = samples.length ? samples.at(-1).simulationDroppedMs - samples[0].simulationDroppedMs : null;
  if (!Number.isFinite(droppedMs) || droppedMs > 16.7 || droppedMs < 0) failures.push('Simulation lost time or restarted during the run.');
  return { automatedChecksPassed: failures.length === 0, capacityVerified: false,
    note: 'Also require both room sizes, real regional play, persistence checks and target laptop verification. This report alone is not release acceptance.',
    roomSize: report.roomSize, serverSamples: samples.length, simulationDroppedMs: droppedMs,
    maxTickP95Ms: samples.length ? Math.max(...samples.map(sample => sample.tickP95Ms)) : null,
    failures: [...new Set(failures)] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node tools/check-capacity.js client-report.json server-metrics.jsonl');
    const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const metrics = readFileSync(process.argv[3], 'utf8').split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const result = assessCapacity(report, metrics);
    console.log(JSON.stringify(result, null, 2)); if (!result.automatedChecksPassed) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
