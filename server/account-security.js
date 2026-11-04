import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
export const validPassword = value => typeof value === 'string' && value.length >= 8 && value.length <= 128;
export async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${(await derive(password, salt, 64)).toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, digest] = String(stored).split(':');
  if (!salt || !/^[0-9a-f]{128}$/i.test(digest || '')) return false;
  return timingSafeEqual(await derive(password, salt, 64), Buffer.from(digest, 'hex'));
}
export function migrateAccountRecovery(db) {
  if (!db.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'recovery_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN recovery_hash TEXT');
  }
}
const digestCode = code => createHash('sha256').update(code).digest('hex');
export async function issueRecoveryCode(db, userId, password) {
  const user = db.prepare('SELECT password FROM users WHERE id=?').get(userId);
  if (!user || !await verifyPassword(password, user.password)) return null;
  const code = randomBytes(32).toString('hex').match(/.{8}/g).join('-');
  // A concurrent password reset must not authorize a new code with the old password.
  const changed = db.prepare('UPDATE users SET recovery_hash=? WHERE id=? AND password=?')
    .run(digestCode(code.replaceAll('-', '')), userId, user.password);
  return changed.changes === 1 ? code : null;
}
export async function recoverAccount(db, username, code, password) {
  if (!validPassword(password) || typeof code !== 'string' || code.length > 80) return null;
  const normalized = code.trim().toLowerCase().replaceAll('-', '');
  if (!/^[0-9a-f]{64}$/.test(normalized)) return null;
  const user = db.prepare('SELECT id,recovery_hash FROM users WHERE username=?').get(username);
  const hash = digestCode(normalized);
  if (!user?.recovery_hash || !timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.recovery_hash, 'hex'))) return null;
  const nextPassword = await passwordHash(password);
  db.exec('BEGIN IMMEDIATE');
  try {
    // Compare-and-consume prevents two concurrent requests from using the same code.
    const changed = db.prepare('UPDATE users SET password=?, recovery_hash=NULL WHERE id=? AND recovery_hash=?')
      .run(nextPassword, user.id, hash);
    if (changed.changes !== 1) { db.exec('ROLLBACK'); return null; }
    db.prepare("DELETE FROM sessions WHERE json_extract(player, '$.id')=?").run(user.id);
    db.exec('COMMIT');
    return user.id;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
