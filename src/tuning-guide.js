import {TUNING_GUIDE} from './tuning-guide-content.js';
import {translate} from './i18n.js';
const html=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function tuningTopicHTML(id){
  const topic=TUNING_GUIDE.find(item=>item.id===id)||TUNING_GUIDE[0];
  return topic.sections.map(section=>`<section><h3>${html(translate(section.title[0]))}</h3><p>${html(translate(section.text[0]))}</p></section>`).join('');
}
export function showTuningGuide({root,initialTopic='parts'}){
  if(root.querySelector('dialog[open]'))return;
  const previous=document.activeElement,dialog=document.createElement('dialog'),t=value=>html(translate(value));
  dialog.className='flow-dialog tuning-guide';dialog.setAttribute('aria-labelledby','tuning-guide-title');
  dialog.innerHTML=`<header class="product-dialog-heading"><div><h2 id="tuning-guide-title">${t('Drone setup guide')}</h2><p>${t('Understand a change, then test it in flight.')}</p></div><button class="button" data-guide-close>${t('Close')}</button></header><nav class="guide-tabs" role="tablist" aria-label="Drone setup topics">${TUNING_GUIDE.map(topic=>`<button role="tab" id="guide-${topic.id}" aria-controls="guide-topic" data-guide-topic="${topic.id}">${t(topic.label[0])}</button>`).join('')}</nav><div id="guide-topic" role="tabpanel" tabindex="0"></div><footer><p>${t('This reference describes the current simulator. It does not change your build or award lesson progress.')}</p></footer>`;
  const tabs=[...dialog.querySelectorAll('[data-guide-topic]')],panel=dialog.querySelector('[role=tabpanel]');
  const select=id=>{
    const chosen=TUNING_GUIDE.some(topic=>topic.id===id)?id:'parts';
    for(const button of tabs){const active=button.dataset.guideTopic===chosen;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
    panel.setAttribute('aria-labelledby','guide-'+chosen);panel.innerHTML=tuningTopicHTML(chosen);panel.scrollTop=0;
  };
  tabs.forEach((button,index)=>{button.onclick=()=>select(button.dataset.guideTopic);button.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    select(tabs[next].dataset.guideTopic);tabs[next].focus();
  };});
  dialog.querySelector('[data-guide-close]').onclick=()=>dialog.close();
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});
  root.append(dialog);select(initialTopic);dialog.showModal();tabs.find(button=>button.getAttribute('aria-selected')==='true').focus();
}
