// Preserve a control during a menu rerender; focus the heading on navigation.
// Native modal dialogs retain their own focus behavior.
export function captureMenuFocus(menu) {
  const active=menu.ownerDocument.activeElement;
  if(!menu.contains(active))return null;
  if(active.tagName==='H1')return {heading:true};
  if(active.id)return {name:'id',value:active.id};
  const attribute=[...active.attributes].find(a=>a.name.startsWith('data-'));
  return attribute?{name:attribute.name,value:attribute.value}:null;
}

export function restoreMenuFocus(menu,key,sameScreen) {
  const document=menu.ownerDocument;
  if(!menu.isConnected||document.querySelector('dialog[open]'))return;
  if(menu.contains(document.activeElement))return;
  const match=sameScreen&&key?.name?[...menu.querySelectorAll(`[${key.name}]`)].find(e=>e.getAttribute(key.name)===key.value&&!e.disabled):null;
  const target=match||(!sameScreen||key?.heading?menu.querySelector('h1'):null);
  if(!target)return;
  if(!match)target.tabIndex=-1;
  target.focus({preventScroll:true});
}
