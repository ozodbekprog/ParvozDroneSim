import test from 'node:test';
import assert from 'node:assert/strict';
import {tutorialStepMet} from '../shared/tutorial-objectives.js';
import {createDroneState} from '../shared/physics.js';
import {validateCatalog} from '../shared/catalog-schema.js';
import catalog from '../public/content/catalog.json' with {type:'json'};

const context=()=>({state:createDroneState([0,3,0]),previous:[0,3,0],map:{floorY:0},track:{gates:[]},flightMode:'angle'});
const hold={objective:'reach',target:0,position:[0,3,0],radius:1,maxSpeed:.8,airborne:true};

test('a hover target rejects a fast fly-through and drift outside its volume',()=>{
 const c=context();assert.equal(tutorialStepMet(hold,c),true);
 c.state.grounded=true;assert.equal(tutorialStepMet(hold,c),false);c.state.grounded=false;
 c.state.velocity=[1,0,0];assert.equal(tutorialStepMet(hold,c),false);
 c.state.velocity=[0,0,0];c.state.position=[0,4.1,0];assert.equal(tutorialStepMet(hold,c),false);
});
test('heading practice handles the wrap at north and rejects vertical or wrong-facing poses',()=>{
 const c=context(),step={...hold,heading:Math.PI-.04,headingTolerance:.1};
 c.state.rotation=createDroneState([0,3,0],-Math.PI+.04).rotation;assert.equal(tutorialStepMet(step,c),true);
 c.state.rotation=createDroneState([0,3,0],0).rotation;assert.equal(tutorialStepMet(step,c),false);
 c.state.rotation=[Math.sin(Math.PI/4),0,0,Math.cos(Math.PI/4)];assert.equal(tutorialStepMet(step,c),false);
});
test('landing must be grounded at the marked site and a mode lesson requires its named mode',()=>{
 const c=context(),step={...hold,objective:'land',flightMode:'acro',airborne:false};
 c.state.grounded=true;assert.equal(tutorialStepMet(step,c),false);
 c.flightMode='acro';assert.equal(tutorialStepMet(step,c),true);
 c.state.position=[2,3,0];assert.equal(tutorialStepMet(step,c),false);
 c.state.position=[0,3,0];c.state.grounded=false;assert.equal(tutorialStepMet(step,c),false);
});
test('content validation rejects malformed lesson constraints before publishing',()=>{
 for(const patch of [{maxSpeed:-1},{flightMode:'auto'},{airborne:'yes'},{heading:0},{headingTolerance:.2},{position:[0,3],radius:1}]){
  const c=structuredClone(catalog);Object.assign(c.tutorials[0].steps[0],patch);assert.throws(()=>validateCatalog(c),/lesson|target|heading/);
 }
 const c=structuredClone(catalog);Object.assign(c.tutorials[0].steps[0],hold,{heading:0,headingTolerance:.2,flightMode:'acro'});assert.equal(validateCatalog(c),c);
});
