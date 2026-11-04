import { backup, DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const source = process.argv[2] && resolve(process.argv[2]);
const allowReplace = process.argv.includes('--replace');
if (!source || !existsSync(source)) throw new Error('Usage: node tools/import-db.js <backup.sqlite> [--replace]');
const target = join(process.env.DATA_DIR || 'data', 'liftoff.sqlite');
if (source === resolve(target)) throw new Error('Source and destination are the same database.');
const imported = new DatabaseSync(source, { readOnly: true });
try {
  if (Object.values(imported.prepare('PRAGMA integrity_check').get())[0] !== 'ok') throw new Error('Import failed SQLite integrity check.');
  imported.prepare('SELECT id,username FROM users LIMIT 1').get();
} finally { imported.close(); }

if (existsSync(target)) {
  const old = new DatabaseSync(target, { readOnly: true });
  try {
    const existingUsers = old.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    if (existingUsers && !allowReplace) throw new Error('Destination has accounts. Pass --replace only after backing it up and stopping the game.');
    const before = join(process.env.DATA_DIR || 'data', `pre-import-${Date.now()}.sqlite`);
    await backup(old, before);
    console.log(`Previous database backed up to ${before}`);
  } finally { old.close(); }
}

const incoming = `${target}.incoming`;
copyFileSync(source, incoming);
for (const suffix of ['-wal', '-shm']) rmSync(`${target}${suffix}`, { force: true });
renameSync(incoming, target);
console.log(`Imported SQLite database into ${target}`);
