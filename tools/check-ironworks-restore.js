import{cpSync,mkdirSync,existsSync,writeFileSync}from'node:fs';import{resolve,join}from'node:path';import assert from'node:assert/strict';import{syncContent}from'./content-packages.js';import{validateCatalog}from'../shared/catalog-schema.js';
const root=resolve(import.meta.dirname,'..'),stage=join(root,'data/ironworks-restore-check-20261013');
if(existsSync(join(stage,'RESTORE-CHECK.json')))throw Error('Restoration already checked; reuse the saved report.');
const target=join(stage,'content/maps/ironworks-v2');mkdirSync(resolve(target,'..'),{recursive:true});cpSync(join(root,'content/archived-maps/ironworks-v2'),target,{recursive:true});
mkdirSync(join(stage,'public/content'),{recursive:true});writeFileSync(join(stage,'public/content/catalog.json'),JSON.stringify({version:1,maps:[],drones:[],parts:[],challenges:[],tutorials:[],assets:[]}));
for(const kind of ['races','challenges','tutorials','drones','parts'])mkdirSync(join(stage,'content',kind),{recursive:true});
// Scaffolding represents the existing game into which a user drops the map.
cpSync(join(root,'content/drones/kestrel'),join(stage,'content/drones/kestrel'),{recursive:true,filter:p=>!p.endsWith('.blend')&&!p.endsWith('.blend1')});
cpSync(join(root,'content/parts'),join(stage,'content/parts'),{recursive:true});
const{catalog}=syncContent(stage);validateCatalog(catalog);
const map=catalog.maps.find(m=>m.id==='ironworks-v2');assert.equal(catalog.maps.length,1);assert.equal(map.tracks.length,2);assert.equal(catalog.challenges.length,2);assert.ok(map.garage.model.includes('assets/maps/ironworks-v2/'));
const report={verified:true,maps:1,races:map.tracks.length,missions:catalog.challenges.length,assetReferences:catalog.assets.length,isolatedStage:stage,restore:'Extract the ZIP map folder into content/maps; build. No player database is included.'};writeFileSync(join(stage,'RESTORE-CHECK.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
