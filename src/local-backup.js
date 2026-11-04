import { listReplays, importReplays } from './replay-store.js';

export const LOCAL_SETTINGS = [
  'liftoff-flight-profiles-v1', 'liftoff-profiles', 'liftoff-device',
  'liftoff-graphics-v1', 'liftoff-fpv-camera-v1', 'liftoff-flight-mode',
  'liftoff-camera-mode', 'liftoff-performance', 'liftoff-controls-seen',
  'liftoff-drone-fleet-v1', 'liftoff-fullscreen-v1'
];

export function validateLocalBackup(value) {
  if (!value || value.format !== 'drone-liftoff-local' || value.version !== 1 || !value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings) || !Array.isArray(value.replays) || value.replays.length > 100) throw new Error('This is not a supported game data backup.');
  const settings = {};
  for (const key of LOCAL_SETTINGS) {
    const saved = value.settings[key];
    if (saved === undefined) continue;
    if (typeof saved !== 'string' || saved.length > 100_000) throw new Error(`Invalid setting: ${key}`);
    settings[key] = saved;
  }
  const replays = value.replays.map(record => {
    if (!record || !/^[a-z0-9-]{16,80}$/i.test(record.id) || typeof record.name !== 'string' || typeof record.map !== 'string' || typeof record.track !== 'string' || !Number.isFinite(record.duration) || !Array.isArray(record.frames) || !record.frames.length || record.frames.length > 36_000) throw new Error('Backup contains an invalid replay.');
    return { ...record, name: record.name.slice(0, 80) };
  });
  return { settings, replays };
}

export async function createLocalBackup() {
  const settings = {};
  for (const key of LOCAL_SETTINGS) {
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  }
  return { format: 'drone-liftoff-local', version: 1, exportedAt: new Date().toISOString(), settings, replays: await listReplays() };
}

export async function restoreLocalBackup(value) {
  const backup = validateLocalBackup(value);
  await importReplays(backup.replays);
  for (const [key, saved] of Object.entries(backup.settings)) localStorage.setItem(key, saved);
  return backup.replays.length;
}
