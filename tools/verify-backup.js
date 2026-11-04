import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyBackup(source) {
  const directory = mkdtempSync(join(tmpdir(), 'liftoff-restore-'));
  let db;
  try {
    const restored = join(directory, 'restored.sqlite'); copyFileSync(source, restored);
    db = new DatabaseSync(restored);
    if (Object.values(db.prepare('PRAGMA integrity_check').get())[0] !== 'ok') throw new Error('Backup integrity check failed.');
    const tables = ['users', 'records', 'career', 'sessions', 'achievements', 'owned_parts'];
    if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='drone_fleets'").get())tables.push('drone_fleets');
    const rows = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count]));
    db.exec('BEGIN; CREATE TABLE restore_probe (id INTEGER); INSERT INTO restore_probe VALUES (1); ROLLBACK;');
    return { restored: true, rows };
  } finally {
    db?.close();
    if (!resolve(directory).startsWith(resolve(tmpdir()) + requireSeparator())) throw new Error('Unsafe verification directory');
    rmSync(directory, { recursive: true, force: true });
  }
}
function requireSeparator() { return process.platform === 'win32' ? '\\' : '/'; }
if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { if (!process.argv[2]) throw new Error('Usage: node tools/verify-backup.js backup.sqlite'); console.log(JSON.stringify(verifyBackup(process.argv[2]))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
