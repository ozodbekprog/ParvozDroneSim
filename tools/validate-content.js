import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateCatalog } from '../shared/catalog-schema.js';

const catalog = validateCatalog(JSON.parse(readFileSync(resolve('public/content/catalog.json'), 'utf8')));
let assets = 0;
const checkVisual = item => {
  for (const asset of [item.model,...(item.modelLods || []).map(level => level.model),item.thumbnail,item.collisionFile,item.preparedCollisionFile,item.groundTexture, ...(item.materials || []).flatMap(m=>[m.baseTexture,m.normalTexture,m.roughnessTexture,m.metalnessTexture,m.occlusionTexture,m.emissiveTexture])]) {
    if (!asset) continue;
    if (!existsSync(resolve('public', asset.slice(1)))) throw new Error(`Missing asset ${asset}`);
    assets++;
  }
  for (const object of item.objects || []) checkVisual(object);
  if(item.visualDetails)checkVisual(item.visualDetails);
  for(const accessory of Object.values(item.accessories||{}))checkVisual(accessory);
  for (const track of item.tracks || []) {checkVisual(track);for(const gate of track.gates)checkVisual(gate);}
};
for (const kind of ['maps','drones','parts','challenges','tutorials']) for (const item of catalog[kind]) checkVisual(item);
console.log(`Content valid: ${catalog.maps.length} maps, ${catalog.maps.reduce((n,m)=>n+m.tracks.length,0)} races, ${catalog.drones.length} drones, ${catalog.parts.length} parts, ${catalog.challenges.length} missions, ${catalog.tutorials.length} tutorials, ${assets} asset references.`);
