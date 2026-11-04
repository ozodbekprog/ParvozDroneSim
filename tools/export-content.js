import { mkdirSync, writeFileSync,cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAP_LIST, CAREER, GAMEPLAY_OBSTACLES } from '../shared/content.js';
import { DRONES, PARTS } from '../shared/physics.js';
import './validate-content.js';
import catalog from '../public/content/catalog.json' with { type: 'json' };

const directory = resolve('export');
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'liftoff-content.json'), JSON.stringify(catalog, null, 2));
cpSync(resolve('content'),resolve(directory,'sources'),{recursive:true});
console.log('Editable definitions copied to export/sources/. Export actual GLB models at http://127.0.0.1:2570/editor/export.html');
console.log(`Exported neutral content data to ${resolve(directory, 'liftoff-content.json')}`);
