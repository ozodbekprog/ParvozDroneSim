import { backup, DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(process.env.DATA_DIR || join(root, 'data'), 'liftoff.sqlite');
const destination = process.argv[2];
if (!destination) throw new Error('Usage: node tools/backup-db.js <destination.sqlite>');
const target = resolve(destination);
if (target === resolve(source)) throw new Error('Backup destination must differ from the live database.');
mkdirSync(dirname(target), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, target);
  console.log(`SQLite backup created: ${target}`);
} finally { db.close(); }
