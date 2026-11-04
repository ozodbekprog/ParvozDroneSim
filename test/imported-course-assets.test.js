import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {MAPS} from '../shared/content.js';

test('practice routes share the complete collision data of the native props they display',()=>{
  let practices=0;
  for(const map of Object.values(MAPS))for(const track of map.tracks){
    if(!/first-flight|stock-practice/.test(track.id))continue;
    const file=resolve('content/races',track.id,'race.json'),race=JSON.parse(readFileSync(file));
    const owners=new Set(race.objects.filter(o=>o.model.endsWith('props.glb')).map(o=>dirname(resolve(dirname(file),o.model))));
    assert.equal(owners.size,1);
    const original=JSON.parse(readFileSync(resolve([...owners][0],'race.json')));
    assert.deepEqual(race.colliders,original.colliders,track.id+': visible gate frames and rounded props must retain all source collision');practices++;
  }
  assert.equal(practices,5);
});

test('every recovered source ribbon belongs to its selected course and has an editable Blender source',()=>{
  let courses=0,ribbons=0;
  for(const map of Object.values(MAPS))for(const track of map.tracks){
    if(!/-liftoff-\d+$/.test(track.id))continue;
    const base='content/races/'+track.id+'/',file=base+'ribbon-source.json';if(!existsSync(file))continue;
    const source=JSON.parse(readFileSync(file)),race=JSON.parse(readFileSync(base+'race.json')),inventory=JSON.parse(readFileSync(base+'track-import.json'));
    const models=race.objects.filter(o=>o.model==='ribbons.glb');assert.equal(models.length,1,track.id);
    assert.equal(models[0].modelNode,undefined,'the complete ribbon scene must load without an unsanitized Blender-name lookup');
    assert.equal(source.race,track.id);assert.ok(existsSync(base+'ribbons.blend'));assert.ok(existsSync(base+'ribbons.glb'));
    for(const ribbon of source.ribbons){
      assert.ok(ribbon.width>0&&ribbon.attachments.length>=2);
      const item=inventory.inventory[ribbon.blueprintIndex];assert.equal(item.prefab,ribbon.prefab);assert.equal(item.sourceRibbon,true);assert.ok(item.meshes>0);
    }
    ribbons+=source.ribbons.length;courses++;
  }
  assert.equal(courses,17);assert.ok(ribbons>400);
});
