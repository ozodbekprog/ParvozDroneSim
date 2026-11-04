import test from 'node:test';import assert from 'node:assert/strict';import {readdirSync,readFileSync} from 'node:fs';
import {translate,savedLanguage,setLanguage,currentLanguage,LANGUAGE_KEY,localizeUI,localizedText} from '../src/i18n.js';
import {UI_MESSAGES} from '../src/locales/ui.js';import {LESSON_MESSAGES} from '../src/locales/lessons.js';import {DETAIL_MESSAGES} from '../src/locales/details.js';
import {REMAINING_MESSAGES} from '../src/locales/remaining.js';
import {BROWSER_MESSAGES} from '../src/locales/browser-fixes.js';
import {REPAIR_MESSAGES} from '../src/locales/ui-repair.js';
import {PRODUCT_MESSAGES} from '../src/locales/product.js';
import {GUIDE_MESSAGES} from '../src/tuning-guide-content.js';
import {PRACTICE_MESSAGES} from '../src/locales/practice.js';
import {CLASSROOM_MESSAGES} from '../src/locales/classroom.js';
import {MENU_REVIEW_MESSAGES} from '../src/locales/menu-review.js';
test('three languages preserve English copy and safely interpolate values',()=>{
 assert.equal(translate('Back','en'),'Back');assert.equal(translate(' Back ','ru'),' Назад ');assert.equal(translate('12 guided lessons','uz'),'12 ta yo‘riqli dars');
 assert.equal(translate('Download $&Drone','ru'),'Загрузить $&Drone');assert.equal(translate('C++ (Pilot)','ru'),'C++ (Pilot)');assert.equal(translate('SHADOWS','ru'),'Тени');
 assert.equal(translate('Position 2/4 · Lap 1 / 3 · Gate 2 / 10','ru'),'Место 2/4 · Круг 1 / 3 · Ворота 2 / 10');
});
test('catalogs have unique keys, complete translations and matching placeholders',()=>{
 const seen=new Set();for(const [en,ru,uz] of [...UI_MESSAGES,...LESSON_MESSAGES,...DETAIL_MESSAGES,...REMAINING_MESSAGES,...BROWSER_MESSAGES,...REPAIR_MESSAGES,...PRODUCT_MESSAGES,...GUIDE_MESSAGES,...PRACTICE_MESSAGES,...CLASSROOM_MESSAGES,...MENU_REVIEW_MESSAGES]){
  assert.ok(!seen.has(en),'Duplicate '+en);seen.add(en);assert.ok(ru&&uz,en);
  const placeholders=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();assert.deepEqual(placeholders(ru),placeholders(en),en);assert.deepEqual(placeholders(uz),placeholders(en),en);
 }
});
test('numeric count interpolation cannot consume an entire map label',()=>{
 assert.equal(translate('3 steps','ru'),'Шагов: 3');
 assert.ok(!translate('Hangar C03 · 3 steps','ru').startsWith('Шагов: Hangar'));
 assert.equal(translate('Download: Hangar C03','ru'),'Загрузить: Hangar C03');
});
test('every authored lesson title, description, topic and instruction is translated',()=>{
 for(const directory of readdirSync('content/tutorials')){const lesson=JSON.parse(readFileSync('content/tutorials/'+directory+'/tutorial.json'));
  for(const value of [lesson.name,lesson.description,lesson.topic,...lesson.steps.flatMap(s=>[s.title,s.text])].filter(Boolean))for(const locale of ['ru','uz'])assert.notEqual(translate(value,locale),value,locale+': '+value);
 }
});
test('language persists independently of flight and account save keys, tolerates private storage',()=>{
 const data=new Map([['liftoff-token','private'],['liftoff-graphics-v1','original']]),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 assert.equal(savedLanguage(storage),null);setLanguage('uz',storage);assert.equal(savedLanguage(storage),'uz');assert.equal(currentLanguage(),'uz');assert.equal(data.get('liftoff-token'),'private');assert.equal(data.get('liftoff-graphics-v1'),'original');assert.equal(data.get(LANGUAGE_KEY),'uz');
 assert.throws(()=>setLanguage('de',storage));assert.equal(savedLanguage({getItem(){throw new Error();}}),null);setLanguage('ru',{setItem(){throw new Error();}});assert.equal(currentLanguage(),'ru');setLanguage('en',storage);
});
test('text switches reversibly and protected user content is left untouched',()=>{
 const parent={closest:()=>null},node={nodeType:3,data:'Back',parentElement:parent};setLanguage('ru');localizeUI(node);assert.equal(node.data,'Назад');setLanguage('uz');localizeUI(node);assert.equal(node.data,'Orqaga');setLanguage('en');localizeUI(node);assert.equal(node.data,'Back');
 node.parentElement={closest:()=>({})};setLanguage('ru');localizeUI(node);assert.equal(node.data,'Back');setLanguage('en');
});
test('localized dynamic text updates only when its visible value changes',()=>{
 let writes=0,value='';const element={get textContent(){return value;},set textContent(v){writes++;value=v;},firstChild:null};setLanguage('ru');localizedText(element,'Throttle 50%');localizedText(element,'Throttle 50%');assert.equal(value,'Газ 50%');assert.equal(writes,1);setLanguage('en');
});
