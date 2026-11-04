import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2);
const flags = new Set(['--all','--markers','--refresh-colliders','--publish']);
const values = new Set(['--map','--source','--blender']);
const options = {}, forwarded = [];
const usage = 'npm run content:blender -- --map harborworks --markers|--publish [--blender "D:/Programs/Blender Foundation/Blender 5.1/blender.exe"]\nUse --all instead of --map to process every saved map. --markers refreshes course guides and seeds missing collision proxies; --refresh-colliders explicitly replaces edited proxies.';

try {
  if (argv.includes('--help') || !argv.length) { console.log(usage); process.exit(0); }
  for (let index=0; index<argv.length; index++) {
    const flag = argv[index];
    if (flags.has(flag)) { options[flag.slice(2)] = true; forwarded.push(flag); }
    else if (values.has(flag) && argv[index+1] && !argv[index+1].startsWith('--')) {
      const value = argv[++index]; options[flag.slice(2)] = value;
      if (flag !== '--blender') forwarded.push(flag, flag === '--source' ? resolve(value) : value);
    } else throw new Error('Unknown or missing argument: '+flag+'\n'+usage);
  }
  if (Boolean(options.all) === Boolean(options.map) || !(options.markers || options.publish)) throw new Error(usage);
  if (options.map && !/^[a-z0-9][a-z0-9-]{1,63}$/.test(options.map)) throw new Error('Map IDs use lowercase letters, digits and hyphens.');
  const localBlender = 'D:/Programs/Blender Foundation/Blender 5.1/blender.exe';
  const blender = options.blender || process.env.BLENDER_PATH || (existsSync(localBlender) ? localBlender : 'blender');
  const run = spawnSync(blender,['--background','--factory-startup','--python-exit-code','1','--python',join(root,'tools/blender/export_package.py'),'--',...forwarded],{cwd:root,windowsHide:true,stdio:'inherit'});
  if (run.error || run.status !== 0) throw new Error('Blender command failed: '+(run.error?.message || 'exit '+run.status));
  if (options.publish) {
    for (const script of ['tools/sync-content.js','tools/validate-content.js']) {
      const checked = spawnSync(process.execPath,[join(root,script)],{cwd:root,windowsHide:true,stdio:'inherit'});
      if (checked.error || checked.status !== 0) throw new Error('Published files need correction; '+script+' failed. Previous files are in data/blender-backups/.');
    }
  }
} catch (error) { console.error(error.message); process.exitCode=1; }
