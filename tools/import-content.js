import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inspectGlb } from './glb-content.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2), options = {};
for (let index = 0; index < args.length; index += 2) options[args[index].replace(/^--/, '')] = args[index + 1];
const categories = { map: 'maps', drone: 'drones', part: 'parts' };
try {
  if (!options.file || !categories[options.type] || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(options.id || '')) throw new Error('Usage: npm run content:import -- --type map|drone|part --id my-id --file "C:/Models/scene.glb" [--blender "C:/Blender/blender.exe"] [--category propellers]');
  const input = resolve(options.file), extension = extname(input).toLowerCase();
  if (!existsSync(input) || !['.glb', '.fbx', '.obj'].includes(extension)) throw new Error('Choose an existing GLB, FBX or OBJ file. Keep FBX/OBJ textures beside their source file.');
  mkdirSync(join(root, 'data'), { recursive: true });
  const staging = mkdtempSync(join(root, 'data', 'content-import-')), staged = join(staging, 'model.glb');
  if (extension === '.glb') copyFileSync(input, staged);
  else {
    const blender = options.blender || process.env.BLENDER_PATH || 'blender';
    const conversion = spawnSync(blender, ['--background', '--factory-startup', '--python', join(root, 'tools', 'blender', 'convert_content.py'), '--', input, staged], { windowsHide: true, stdio: 'inherit' });
    if (conversion.error || conversion.status !== 0) throw new Error('Conversion failed. Install Blender and pass --blender ".../blender.exe", or export embedded GLB from your modelling program. Source content has not been replaced.');
  }
  const analysis = inspectGlb(readFileSync(staged));
  if (options['dry-run'] === 'true') {
    console.log(JSON.stringify({model:staged,bounds:analysis.bounds,collisionShapes:analysis.colliders.length,gates:analysis.gates.length,warnings:analysis.warnings},null,2));
    process.exit(0);
  }
  const folder = join(root, 'content', categories[options.type], options.id), definition = join(folder, `${options.type}.json`);
  const item = existsSync(definition) ? JSON.parse(readFileSync(definition, 'utf8')) : { id: options.id, name: options.id.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ') };
  if (options.type === 'part') {
    item.category ||= options.category;
    if (!['frame','motors','propellers','battery','camera'].includes(item.category)) throw new Error('A new part requires --category frame|motors|propellers|battery|camera.');
  }
  if (existsSync(folder)) {
    const backup = join(staging, 'previous'); mkdirSync(backup);
    for (const name of ['model.glb', `${options.type}.json`]) if (existsSync(join(folder, name))) copyFileSync(join(folder, name), join(backup, name));
    console.log(`Previous model/definition backup: ${backup}`);
  }
  mkdirSync(folder, { recursive: true });
  copyFileSync(staged, join(folder, 'model.glb')); item.model = 'model.glb';
  if (options.type === 'map') { item.colliders = []; delete item.collisionFile; }
  writeFileSync(definition, JSON.stringify(item, null, 2));
  console.log(`Imported into ${folder}. Existing ID, races, hints, materials and aircraft settings are preserved.`);
  if (options.type === 'map' && existsSync(join(folder, 'collision.json'))) console.log('Existing collision.json takes priority over model proxies. Check it matches the replacement model.');
  for (const warning of analysis.warnings) console.warn(warning);
  console.log('Run npm run content:sync (the running developer server also watches content/). For custom map cards, add thumbnail.jpg.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
