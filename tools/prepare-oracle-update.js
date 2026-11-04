// Stage an isolated release. Imported content needs explicit online-test scope.
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { syncContent } from './content-packages.js';
import { NETWORK_PROTOCOL } from '../shared/network-flight.js';

const root = resolve(import.meta.dirname, '..');
const release = process.argv[2];
const onlineTest = process.argv.includes('--include-local-imports-for-online-test');
if (!/^\d{8}-[a-z0-9-]+$/.test(release || '')) throw new Error('Provide a dated release ID.');
const snapshotFile=process.argv.find(value=>value.startsWith('--previous-catalog='))?.slice('--previous-catalog='.length)||'data/oracle-catalog-before-20261013.json';
const snapshot = JSON.parse(readFileSync(join(root, snapshotFile), 'utf8').replace(/^\uFEFF/, ''));
const baseline = onlineTest ? JSON.parse(readFileSync(join(root, 'public/content/catalog.json'))) : snapshot.customContent;
const target = join(root, 'data', 'oracle-release-' + release);
if (existsSync(target)) throw new Error('Release stage already exists; do not overwrite it.');
const filter = file => !/\.blend\d*$|\.sqlite(?:-wal|-shm)?$|\.db$|\.env$/.test(file)
  && !file.endsWith('.prepared.glb') && !file.split(sep).includes('.archive-content') && !file.split(sep).includes('.ktx-temp') && !file.endsWith('previous-release.txt');
const copy = (from, to = from) => {
  const destination = resolve(target, to);
  if (!destination.startsWith(target + sep)) throw new Error('Invalid stage destination.');
  mkdirSync(resolve(destination, '..'), { recursive: true });
  cpSync(join(root, from), destination, { recursive: true, dereference: true, filter });
};
for (const file of ['package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'Dockerfile', 'compose.production.yaml', '.dockerignore']) copy(file);
for (const folder of ['src', 'shared', 'server', 'deploy', 'public/runtime']) copy(folder);
for (const file of ['start.js', 'sync-content.js', 'content-packages.js', 'glb-content.js', 'content-worker.js', 'validate-content.js', 'backup-db.js', 'import-db.js', 'verify-backup.js', 'backup-remote.js', 'check-public.js', 'stage-oracle-delta.js']) copy('tools/' + file);
copy('public/content/recipes.js');
mkdirSync(join(target, 'public/content'), { recursive: true });
writeFileSync(join(target, 'public/content/catalog.json'), JSON.stringify(baseline));
for (const kind of ['maps', 'races', 'challenges', 'tutorials', 'drones', 'parts', 'shared-assets']) mkdirSync(join(target, 'content', kind), { recursive: true });
const maps = baseline.maps.map(map => map.id);
for (const id of maps) {
  if (id === 'ironworks-v2') throw new Error('Retired map cannot ship.');
  if (onlineTest) {
    if (!['minus-two-demo', 'hangar-c03-demo', 'liftoff-arena-demo', 'liftoff-pine-valley-demo', 'liftoff-the-green-demo'].includes(id)) throw new Error('Unexpected online-test map.');
    copy('content/maps/' + id);
  } else {
    if (/liftoff|minus-two/.test(id)) throw new Error('Imported map needs online-test authorization.');
    copy('content/archived-maps/' + id, 'content/maps/' + id);
  }
}
if (onlineTest) {
  for (const [kind, singular] of [['races', 'race'], ['challenges', 'challenge'], ['tutorials', 'tutorial']]) {
    for (const id of readdirSync(join(root, 'content', kind))) {
      const folder = join(root, 'content', kind, id), definition = join(folder, singular + '.json');
      if (!existsSync(definition) || existsSync(join(folder, '.disabled'))) continue;
      const item = JSON.parse(readFileSync(definition));
      if (maps.includes(item.map)) copy('content/' + kind + '/' + id);
    }
  }
  copy('content/shared-assets/liftoff-workbench');
  if(existsSync(join(root,'content/shared-assets/liftoff-drone-parts')))copy('content/shared-assets/liftoff-drone-parts');
  if(existsSync(join(root,'content/shared-assets/drone-details')))copy('content/shared-assets/drone-details');
}
const drones = [];
for (const id of readdirSync(join(root, 'content/drones'))) {
  const folder = join(root, 'content/drones', id);
  if (!statSync(folder).isDirectory()) continue;
  if(existsSync(join(folder,'.disabled')))continue;
  const source = join(folder, 'SOURCE.json');
  if (!onlineTest && existsSync(source) && JSON.parse(readFileSync(source)).permissionConfirmed === false) continue;
  copy('content/drones/' + id);
  if(!onlineTest){
    const file=join(target,'content/drones',id,'drone.json'),definition=JSON.parse(readFileSync(file));
    if(definition.visualDetails?.localOnly)delete definition.visualDetails;
    if(definition.accessories){
      definition.accessories=Object.fromEntries(Object.entries(definition.accessories).filter(([,entry])=>!entry.localOnly));
      if(!Object.keys(definition.accessories).length)delete definition.accessories;
    }
    writeFileSync(file,JSON.stringify(definition,null,2)+'\n');
  }
  drones.push(id);
}
copy('content/parts');
for (const file of ['forest-floor.png', 'canyon-floor.png', 'concrete-floor.png']) {
  if (existsSync(join(root, 'content/shared-assets', file))) copy('content/shared-assets/' + file);
}
const { catalog, warnings } = syncContent(target);
if (JSON.stringify(catalog.maps.map(map => map.id).sort()) !== JSON.stringify([...maps].sort())) throw new Error('Public map IDs changed.');
if (catalog.drones.some(drone => !drones.includes(drone.id))) throw new Error('Unlicensed drone staged.');
const inventory = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else {
      if (/\.sqlite(?:-wal|-shm)?$|\.db$|\.env$|\.blend\d*$/.test(file)) throw new Error('Private/source file staged: ' + file);
      inventory.push({ file: relative(target, file).split(sep).join('/'), bytes: statSync(file).size,
        sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
    }
  }
}
walk(target);
writeFileSync(join(target, 'RELEASE.json'), JSON.stringify({ release, date: `${release.slice(0,4)}-${release.slice(4,6)}-${release.slice(6,8)}`, status: 'staged-not-deployed',
  contentChoicePending: !onlineTest, previousRevision: snapshot.revision, revision: catalog.revision, protocol: NETWORK_PROTOCOL,
  scope: onlineTest ? 'User-authorized online multiplayer test including Pine Valley, The Green, Gecko, Dquad and native component variants; redistribution license not asserted' : 'Licensed content only',
  maps, drones, excluded: [...(onlineTest ? [] : ['Imported Liftoff maps/drones/workshop']), 'retired Ironworks v2', 'player databases', 'env files', 'Blender sources'],
  buildVerified: false, contentVerified: false, browserVerified: false, targetHardwareVerified: false, inventory }, null, 2) + '\n');
console.log(JSON.stringify({ stage: target, maps, drones, warnings, revision: catalog.revision,
  MiB: (inventory.reduce((sum, file) => sum + file.bytes, 0) / 1048576).toFixed(1) }));
