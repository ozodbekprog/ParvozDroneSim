import test from 'node:test';
import assert from 'node:assert/strict';
import {bindAuthPanel} from '../src/auth-panel.js';

class Control extends EventTarget {
  constructor(properties={}) {super();Object.assign(this,{attributes:{},disabled:false,hidden:false,value:'',...properties});}
  setAttribute(name,value){this.attributes[name]=String(value);}
  removeAttribute(name){delete this.attributes[name];}
  focus(){this.focused=true;}
  click(){this.dispatchEvent(new Event('click'));}
  key(key){const event=new Event('keydown',{cancelable:true});event.key=key;this.dispatchEvent(event);return event;}
}
function formFixture(){
  const form=new Control(),username=new Control({value:'Pilot'}),password=new Control({value:'private-example-password'});
  const submit=new Control(),recovery=new Control(),error=new Control(),status=new Control();
  const tabs=['login','register'].map(mode=>new Control({id:`auth-${mode}-tab`,dataset:{authMode:mode}}));
  const hints=[new Control({hidden:true}),new Control({hidden:true})];
  const elements={'#auth-form':form,'#auth-name':username,'#auth-password':password,'.auth-submit':submit,
    '[data-action="recover-account"]':recovery,'#auth-error':error,'#auth-status':status};
  const root={querySelector:key=>elements[key],querySelectorAll:key=>key==='[data-auth-mode]'?tabs:hints};
  const actions=[];bindAuthPanel(root,action=>actions.push(action));
  return {form,username,password,submit,recovery,error,status,tabs,hints,actions,send:()=>form.dispatchEvent(new Event('submit',{cancelable:true}))};
}

test('form submission uses the selected account action and preserves entered credentials across tabs',()=>{
  const f=formFixture();f.send();assert.deepEqual(f.actions,['login']);
  f.tabs[1].click();f.send();assert.deepEqual(f.actions,['login','register']);
  assert.equal(f.username.value,'Pilot');assert.equal(f.password.value,'private-example-password');
  assert.equal(f.password.autocomplete,'new-password');assert.equal(f.submit.textContent,'Create account');
  assert.ok(f.hints.every(h=>!h.hidden));assert.equal(f.recovery.hidden,true);
  assert.equal(f.password.attributes['aria-describedby'],'auth-password-hint');
  f.tabs[0].click();f.send();assert.equal(f.actions.at(-1),'login');
  assert.equal(f.password.autocomplete,'current-password');assert.equal(f.recovery.hidden,false);
  assert.ok(f.hints.every(h=>h.hidden));assert.equal(f.password.attributes['aria-describedby'],undefined);
});

test('account tabs support arrow navigation, wrapping and accessible selected state',()=>{
  const f=formFixture();const event=f.tabs[0].key('ArrowRight');assert.equal(event.defaultPrevented,true);
  assert.equal(f.tabs[1].focused,true);assert.equal(f.tabs[1].tabIndex,0);assert.equal(f.tabs[0].tabIndex,-1);
  assert.equal(f.tabs[1].attributes['aria-selected'],'true');assert.equal(f.form.attributes['aria-labelledby'],'auth-register-tab');
  f.tabs[1].key('ArrowRight');f.send();assert.equal(f.actions.at(-1),'login');
  f.tabs[0].key('End');f.send();assert.equal(f.actions.at(-1),'register');
  f.tabs[1].key('Home');f.send();assert.equal(f.actions.at(-1),'login');
});

test('busy controls cannot switch account actions or submit again; switching clears stale errors',()=>{
  const f=formFixture();f.tabs[1].disabled=true;f.tabs[1].click();f.tabs[1].key('ArrowLeft');
  f.send();assert.deepEqual(f.actions,['login']);
  f.submit.disabled=true;f.send();assert.deepEqual(f.actions,['login']);
  f.submit.disabled=false;f.tabs[1].disabled=false;f.error.hidden=false;f.status.textContent='Signing in';
  f.tabs[1].click();assert.equal(f.error.hidden,true);assert.equal(f.status.textContent,'');
  f.send();assert.deepEqual(f.actions,['login','register']);
});
