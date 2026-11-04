import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, statSync, readdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const backupName = /^liftoff-\d{4}-\d{2}-\d{2}\.sqlite$/;
export function backupRetention(objects, name, bytes, maxBytes = 9_000_000_000) {
  if (!backupName.test(name) || !Number.isSafeInteger(bytes) || bytes <= 0) throw new Error('Invalid backup file.');
  // Account-wide free storage includes other buckets. Use a dedicated backup bucket and reserve space.
  const currentBytes = objects.reduce((sum, object) => {
    if (!Number.isSafeInteger(object.size) || object.size < 0) throw new Error('Unknown object size.');
    return sum + object.size;
  }, 0);
  if (currentBytes + bytes > maxBytes) throw new Error('Backup would exceed its storage budget. No objects were deleted.');
  const names = [...new Set([...objects.map(object => object.name).filter(item => backupName.test(item)), name])].sort().reverse();
  return names.slice(7);
}
export async function uploadBackup(file) {
  const namespace = process.env.OCI_NAMESPACE, bucket = process.env.OCI_BACKUP_BUCKET;
  if (!namespace || !bucket || !file) throw new Error('Set OCI_NAMESPACE, OCI_BACKUP_BUCKET and a backup file.');
  const args = ['--namespace-name', namespace, '--bucket-name', bucket];
  const oci = (...command) => {
    const result = spawnSync('oci', command, { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error(`OCI ${command.slice(0, 3).join(' ')} failed. Check your CLI access and quota.`);
    return result.stdout.trim() ? JSON.parse(result.stdout) : null;
  };
  const config = oci('os', 'bucket', 'get', ...args).data;
  if (config['public-access-type'] !== 'NoPublicAccess') throw new Error('Backup bucket must be private.');
  if (config.versioning && config.versioning !== 'Disabled') throw new Error('Use a dedicated bucket with versioning disabled so retention bounds storage.');
  const objects = oci('os', 'object', 'list', ...args, '--all').data || [];
  const name = basename(file), bytes = statSync(file).size;
  const maxBytes = Number(process.env.BACKUP_MAX_BYTES || 9_000_000_000);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 9_000_000_000) throw new Error('BACKUP_MAX_BYTES must be within 1–9000000000.');
  const stale = backupRetention(objects, name, bytes, maxBytes);
  const md5 = createHash('md5'); for await (const chunk of createReadStream(file)) md5.update(chunk);
  oci('os', 'object', 'put', ...args, '--name', name, '--file', file, '--no-multipart', '--content-md5', md5.digest('base64'), '--verify-checksum', '--force');
  // Only prune our exact dated names after a checksum-verified upload succeeds.
  for (const old of stale) oci('os', 'object', 'delete', ...args, '--object-name', old, '--force');
  const local = readdirSync(dirname(file)).filter(item => backupName.test(item)).sort().reverse();
  for (const old of local.slice(7)) unlinkSync(join(dirname(file), old));
  console.log(JSON.stringify({ type: 'backup-complete', name, bytes, retained: Math.min(7, objects.filter(object => backupName.test(object.name)).length + 1) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await uploadBackup(process.argv[2]); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
