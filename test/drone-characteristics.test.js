import test from 'node:test';import assert from 'node:assert/strict';
import {defaultBuild,resolveBuild,PARTS} from '../shared/physics.js';
import {buildCharacteristics,characteristicsHTML,partSpecifications} from '../src/drone-characteristics.js';
test('characteristic scales use flight values and do not invent battery energy for legacy aircraft',()=>{
  for(const id of ['kestrel','luma-5','armattan-gecko']){
    const build=defaultBuild(id),spec=resolveBuild(build),rows=buildCharacteristics(build);
    assert.equal(rows.find(r=>r.id==='mass').value,spec.mass*1000);assert.equal(rows.find(r=>r.id==='response').value,spec.motorTau*1000);
    assert.equal(rows.find(r=>r.id==='energy').value,spec.nativePower?.energyWh??null);
  }
  assert.match(characteristicsHTML(defaultBuild('kestrel')),/Data unavailable/);
});
test('part comparisons recompute all coupled effects without changing either build',()=>{
  const before=defaultBuild('luma-5'),after={...before,motors:'lf-hypetrain-vanover2207motor01'};
  const snapshot=structuredClone([before,after]);const rows=buildCharacteristics(after,before);
  assert.equal(rows.find(r=>r.id==='thrust').delta,resolveBuild(after).thrustToWeight-resolveBuild(before).thrustToWeight);
  assert.notEqual(rows.find(r=>r.id==='thrust').delta,0);assert.notEqual(rows.find(r=>r.id==='mass').delta,0);
  assert.deepEqual([before,after],snapshot);
  assert.match(characteristicsHTML(after,{baseline:before,comparisonLabel:'<before>'}),/&lt;before&gt;/);
});
test('native specifications distinguish each motor and a complete four-motor set',()=>{
  const part=PARTS.motors.find(p=>p.sourceSpecs);assert.ok(part);
  const rows=partSpecifications(part,'motors');assert.equal(rows.find(r=>r.label==='Weight per item').value,(part.sourceSpecs.weight*1000).toFixed(1)+' g');
  assert.equal(rows.find(r=>r.label==='Set of four').value,(part.sourceSpecs.weight*4000).toFixed(1)+' g');
});
