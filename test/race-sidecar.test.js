import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {syncContent,writeSources} from '../tools/content-packages.js';
import {DRONES,PARTS} from '../shared/catalog.js';
import {decodeCollisionBinary} from '../shared/collision-binary.js';
test('race collision leaves startup catalog and survives editor source round-trip',()=>{
  const root=mkdtempSync(join(tmpdir(),'race-sidecar-'));
  const write=(path,value)=>{mkdirSync(join(root,path,'..'),{recursive:true});writeFileSync(join(root,path),JSON.stringify(value));};
  try{
    write('public/content/catalog.json',{version:2,maps:[],drones:[],parts:[],challenges:[],tutorials:[]});
    writeSources(root,{maps:[],drones:[],parts:[],challenges:[],tutorials:[]});
    const physical=Object.fromEntries(['id','name','class','mass','arm','thrustToWeight','motorTau','drag','angularDrag','batterySeconds','color','unlock'].map(key=>[key,DRONES.kestrel[key]]));
    write('content/drones/kestrel/drone.json',physical);
    for(const category of Object.keys(PARTS)){const part=PARTS[category].find(part=>!part.model);write('content/parts/'+category+'-'+part.id+'/part.json',part);}
    write('content/maps/test-yard/map.json',{id:'test-yard',name:'Test yard'});
    const colliders=[{position:[4,1,0],size:[2,2,2]}];
    write('content/races/test-route/race.json',{id:'test-route',name:'Test route',map:'test-yard',laps:1,spawn:{position:[0,1.4,-12],yaw:0},colliders,gates:[{position:[0,3,10],width:8,height:6,yaw:0}]});
    const catalog=syncContent(root).catalog,track=catalog.maps[0].tracks[0];
    assert.deepEqual(track.colliders,[]);assert.match(track.collisionFile,/^\/content\/assets\/races\/test-route\/collision-/);
    assert.deepEqual(JSON.parse(readFileSync(join(root,'public',track.collisionFile.slice(1)))),colliders);
    assert.deepEqual(decodeCollisionBinary(readFileSync(join(root,'public',track.preparedCollisionFile.slice(1)))).colliders,colliders);
    writeSources(root,catalog);
    const saved=JSON.parse(readFileSync(join(root,'content/races/test-route/race.json')));
    assert.deepEqual(saved.colliders,colliders);assert.equal(saved.collisionFile,undefined);
    assert.equal(saved.preparedCollisionFile,undefined);
    assert.equal(syncContent(root).catalog.maps[0].tracks[0].collisionFile,track.collisionFile);
  }finally{rmSync(root,{recursive:true,force:true});}
});
