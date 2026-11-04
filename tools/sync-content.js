import { fileURLToPath } from 'node:url';
import { syncContent } from './content-packages.js';
import { cpSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const {catalog,warnings}=syncContent(fileURLToPath(new URL('..',import.meta.url)));
for(const warning of warnings) console.warn(warning);
console.log(`Folder content ready: ${catalog.maps.length} maps, ${catalog.drones.length} drones, ${catalog.parts.length} parts. Revision ${catalog.revision}`);
for(const name of ['draco','basis']){mkdirSync(resolve('public/runtime',name),{recursive:true});cpSync(resolve('node_modules/three/examples/jsm/libs',name),resolve('public/runtime',name),{recursive:true});}
