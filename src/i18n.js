import {UI_MESSAGES} from './locales/ui.js';
import {LESSON_MESSAGES} from './locales/lessons.js';
import {DETAIL_MESSAGES} from './locales/details.js';
import {REMAINING_MESSAGES} from './locales/remaining.js';
import {BROWSER_MESSAGES} from './locales/browser-fixes.js';
import {PRACTICE_MESSAGES} from './locales/practice.js';
import {CLASSROOM_MESSAGES} from './locales/classroom.js';
import {REPAIR_MESSAGES} from './locales/ui-repair.js';
import {PRODUCT_MESSAGES} from './locales/product.js';
import {GUIDE_MESSAGES} from './tuning-guide-content.js';
import {MENU_REVIEW_MESSAGES} from './locales/menu-review.js';
export const LOCALES=[{id:'uz',name:'O‘zbekcha'},{id:'ru',name:'Русский'},{id:'en',name:'English'}];
export const LANGUAGE_KEY='parvoz-language-v1';
const valid=id=>LOCALES.some(locale=>locale.id===id);
export function savedLanguage(storage=globalThis.localStorage){try{const value=storage.getItem(LANGUAGE_KEY);return valid(value)?value:null;}catch{return null;}}
let language=savedLanguage()||'en';
let hasTranslated=language!=='en';
export const currentLanguage=()=>language;
const messages=new Map([...UI_MESSAGES,...LESSON_MESSAGES,...DETAIL_MESSAGES,...REMAINING_MESSAGES,...BROWSER_MESSAGES,...PRACTICE_MESSAGES,...CLASSROOM_MESSAGES,...REPAIR_MESSAGES,...PRODUCT_MESSAGES,...GUIDE_MESSAGES,...MENU_REVIEW_MESSAGES].map(([en,ru,uz])=>[en,{ru,uz,en}]));
const patterns=[...messages].filter(([key])=>key.includes('{')).map(([pattern,values])=>{
 const keys=[],expression=pattern.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{(\w+)\}/g,(_,key)=>{keys.push(key);return key==='count'?'(\\d+)':'(.+?)';});return {keys,expression:new RegExp('^'+expression+'$'),values};
});
export function translate(source,locale=language){
 if(locale==='en'||!source)return source;
 const trimmed=source.trim(),direct=messages.get(trimmed)?.[locale]||(trimmed===trimmed.toUpperCase()?messages.get(trimmed.charAt(0)+trimmed.slice(1).toLowerCase())?.[locale]:null);
 if(direct)return source.replace(trimmed,()=>direct);
 for(const {keys,expression,values} of patterns){
  const match=trimmed.match(expression);if(!match)continue;
  const result=values[locale].replace(/\{(\w+)\}/g,(_,key)=>{const value=match[keys.indexOf(key)+1];return ['mode','camera','progress'].includes(key)?translate(value,locale):value;});return source.replace(trimmed,()=>result);
 }
 return source;
}
const original=new WeakMap(),attributes=new WeakMap(),controllers=new Set();
const excluded='[translate="no"],script,style,svg,kbd,textarea,[data-chat-log],#performance,#hud-speed,#hud-main,#hud-remaining,#hud-altitude,#hud-battery,#hud-stick-left,#hud-stick-right,#hud-attitude output,.pilot-avatar,.loading-metrics';
function localizeTextNode(node){
 if(node.parentElement?.closest(excluded)||!node.data.trim())return;
 const previous=original.get(node),source=previous&&node.data===previous.output?previous.source:node.data;
 const output=translate(source);original.set(node,{source,output});if(node.data!==output)node.data=output;
}
function localizeElementAttrs(node){
 if(node.closest(excluded))return;
 let stored=attributes.get(node);if(!stored){stored={};attributes.set(node,stored);}
 for(const key of ['aria-label','title','placeholder'])if(node.hasAttribute(key)){
  const value=node.getAttribute(key),previous=stored[key],source=previous&&previous.output===value?previous.source:value,output=translate(source);
  stored[key]={source,output};if(output!==value)node.setAttribute(key,output);
 }
}
/** Translate only authored text/accessible labels. Form values, IDs, names and
 * user content stay untouched. Original strings survive reversible switches. */
export function localizeUI(root=document.body){
 if(!root)return;
 if(root.nodeType===3){localizeTextNode(root);return;}
 if(root.nodeType!==1)return;
 localizeElementAttrs(root);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode()))node.nodeType===3?localizeTextNode(node):localizeElementAttrs(node);
}
export function localizedText(element,source){
 const output=translate(source);if(element.textContent!==output)element.textContent=output;
 if(element.firstChild?.nodeType===3)original.set(element.firstChild,{source,output});
}
export function observeLanguage(root=document.body){
 const observer=new MutationObserver(records=>{
  if(language==='en'&&!hasTranslated)return;
  observer.disconnect();
  for(const record of records){
   if(record.type==='childList')for(const node of record.addedNodes)localizeUI(node);
   else if(record.type==='attributes'){if(record.target.nodeType===1)localizeElementAttrs(record.target);}
   else localizeUI(record.target);
  }
  watch();
 });
 const watch=()=>observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});
 const refresh=()=>{observer.disconnect();if(language!=='en'||hasTranslated)localizeUI(root);watch();};
 controllers.add(refresh);refresh();return()=>{observer.disconnect();controllers.delete(refresh);};
}
export function setLanguage(id,storage=globalThis.localStorage){
 if(!valid(id))throw new Error('Unsupported language');language=id;if(id!=='en')hasTranslated=true;
 try{storage.setItem(LANGUAGE_KEY,id);}catch{/* The session still works with private storage. */}
 if(globalThis.document)document.documentElement.lang=id;for(const refresh of controllers)refresh();
}
export function chooseInitialLanguage(root=document.querySelector('#app')){
 const saved=savedLanguage();if(saved){setLanguage(saved);return Promise.resolve(saved);}
 return new Promise(resolve=>{
  const section=document.createElement('section');section.className='language-welcome';section.setAttribute('aria-labelledby','language-title');
  section.innerHTML='<div class="game-panel"><div class="language-brand">PARVOZ</div><h1 id="language-title" translate="no">Tilni tanlang<br>Выберите язык<br>Choose your language</h1><div class="language-options">'+LOCALES.map(locale=>`<button class="button" data-locale="${locale.id}" translate="no" lang="${locale.id}">${locale.name}</button>`).join('')+'</div></div>';
  root.append(section);section.querySelector('button').focus();section.onclick=event=>{const button=event.target.closest('[data-locale]');if(!button)return;setLanguage(button.dataset.locale);section.remove();resolve(button.dataset.locale);};
 });
}
