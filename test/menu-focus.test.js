import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMenuFocus,restoreMenuFocus} from '../src/menu-focus.js';

function fixture() {
  const document={activeElement:null,modal:false,querySelector:()=>document.modal?{}:null};
  const controls=[];
  const control=(attributes={})=>{
    const element={id:attributes.id||'',disabled:false,attributes:Object.entries(attributes).map(([name,value])=>({name,value})),getAttribute:name=>attributes[name]??null,focus(){document.activeElement=this;}};
    controls.push(element);return element;
  };
  const heading=control();
  heading.tagName='H1';
  const menu={isConnected:true,ownerDocument:document,contains:e=>controls.includes(e),querySelector:()=>controls.find(e=>e.tagName==='H1'),querySelectorAll:selector=>controls.filter(e=>e.getAttribute(selector.slice(1,-1))!==null)};
  return {document,controls,control,heading,menu};
}

test('navigation moves focus to the new screen heading instead of the removed button',()=>{
  const {document,control,controls,heading,menu}=fixture();
  const previous=control({'data-action':'graphics'});previous.focus();
  const key=captureMenuFocus(menu);controls.splice(controls.indexOf(previous),1);
  restoreMenuFocus(menu,key,false);
  assert.equal(document.activeElement,heading);
  assert.equal(heading.tabIndex,-1);
});

test('rerender restores the same setting control, but never a disabled replacement',()=>{
  const {document,control,controls,menu}=fixture();
  const previous=control({id:'camera-mode'});previous.focus();
  const key=captureMenuFocus(menu);controls.splice(controls.indexOf(previous),1);
  const replacement=control({id:'camera-mode'});
  restoreMenuFocus(menu,key,true);assert.equal(document.activeElement,replacement);
  document.activeElement=null;replacement.disabled=true;
  restoreMenuFocus(menu,key,true);assert.equal(document.activeElement,null);
});

test('asynchronous loading replacement retains heading focus on the same screen',()=>{
  const {document,controls,control,heading,menu}=fixture();heading.focus();
  const key=captureMenuFocus(menu);controls.splice(controls.indexOf(heading),1);
  const replacement=control();replacement.tagName='H1';
  restoreMenuFocus(menu,key,true);
  assert.equal(document.activeElement,replacement);assert.equal(replacement.tabIndex,-1);
});

test('retained roster focus, explicit input focus and native modal focus win',()=>{
  const {document,control,heading,menu}=fixture();
  const retained=control({'data-fleet-drone':'modified:one'});retained.focus();
  restoreMenuFocus(menu,null,true);assert.equal(document.activeElement,retained);
  const input=control({id:'username'});input.focus();
  restoreMenuFocus(menu,null,false);assert.equal(document.activeElement,input);
  document.activeElement={};document.modal=true;
  restoreMenuFocus(menu,null,false);assert.notEqual(document.activeElement,heading);
});

test('unrelated page focus is not captured and detached menus do not take focus',()=>{
  const {document,heading,menu}=fixture();
  const outside={};document.activeElement=outside;
  assert.equal(captureMenuFocus(menu),null);
  menu.isConnected=false;restoreMenuFocus(menu,null,false);
  assert.equal(document.activeElement,outside);assert.notEqual(document.activeElement,heading);
});
