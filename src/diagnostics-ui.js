import {translate,localizedText} from './i18n.js';

const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(value,digits=1)=>Number.isFinite(value)?value.toFixed(digits):'—';

export function latestCapture(current,low) {
  return [current,low].filter(c=>c?.report).sort((a,b)=>(b.finishedAt??0)-(a.finishedAt??0))[0]??null;
}

export function diagnosticSummary(report) {
  if(!report)return `<p>${translate('No recording yet.')}</p>`;
  const current=report.type==='current-settings-stutter';
  const summary=current?report.gameplaySummary:report.summary;
  const t=value=>html(translate(value));
  return `<h3>${t('Latest recording')}</h3><p>${t(current?'Current graphics settings':'Low 1280×720 control test')}</p>
    ${summary?.frames?`<dl class="diagnostic-metrics">${[
      ['Comparable frames',number(summary.frames,0)],['Median frame time',number(summary.medianMs)+' ms'],
      ['99th percentile frame time',number(summary.p99Ms)+' ms'],['1% low',number(summary.onePercentLow)+' FPS'],
      ['Longest frame',number(summary.maxFrameMs)+' ms'],['Frames over 50 ms',number(summary.framesOver50Ms,0)]
    ].map(([label,value])=>`<div><dt>${t(label)}</dt><dd translate="no">${html(value)}</dd></div>`).join('')}</dl>`:`<p>${t('No comparable flight frames. Record while flying with this tab focused.')}</p>`}
    <p>${t(current?'Pauses, focus loss and changed conditions are excluded from the comparable summary; raw frames stay in the file.':report.valid?'Control-test conditions passed; target hardware still needs confirmation.':'Control-test conditions were interrupted. Use this file for diagnosis only.')}</p>
    <p>${t('GPU time is not measured. This report does not certify target-hardware performance.')}</p>`;
}

/** The dialog observes bounded capture state; it never changes graphics or uploads reports. */
export function showDiagnostics({root,current,low,canRecord,onRecord}) {
  if(root.querySelector('dialog[open]'))return;
  const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='flow-dialog diagnostics-dialog';dialog.setAttribute('aria-labelledby','diagnostics-title');
  const t=value=>html(translate(value));
  dialog.innerHTML=`<header class="product-dialog-heading"><div><h2 id="diagnostics-title">${t('Performance diagnostics')}</h2><p>${t('Record the stutter at your current graphics settings.')}</p></div><button class="button" data-diagnostic="close">${t('Close')}</button></header>
    <section class="diagnostic-record"><h3>${t('Current-settings recording')}</h3><p>${t('Records up to 60 seconds. F8 marks a stutter; F7 stops; F6 downloads the latest report.')}</p>
    <p data-capture-state role="status"></p><div class="diagnostic-actions"><button class="button primary" data-diagnostic="start">${t('Record and return to flight')}</button><button class="button" data-diagnostic="stop">${t('Stop recording')}</button><button class="button" data-diagnostic="download">${t('Download latest report')}</button></div><p data-capture-reason></p></section>
    <section class="diagnostic-result"></section><footer><p>${t('The file stays on this device. Share it manually when asking for help.')}</p><p>${t('For a separate Low 1280×720 control test: fly, press F4, complete 30 seconds of warmup and 3 minutes of recording, then press F6.')}</p></footer>`;
  const controls=Object.fromEntries([...dialog.querySelectorAll('[data-diagnostic]')].map(el=>[el.dataset.diagnostic,el]));
  let shownReport,shownLanguage;
  const refresh=()=>{
    const c=current(),l=low(),run=c?.run,latest=latestCapture(c,l),allowed=canRecord()&&!l?.run;
    controls.start.hidden=!!run;controls.start.disabled=!allowed;
    controls.stop.hidden=!run;controls.download.disabled=!latest;
    localizedText(dialog.querySelector('[data-capture-state]'),run?`Recording: ${Math.min(60,Math.floor((run.last?.now-run.started||0)/1000))} / 60 seconds`:l?.run?'Low control test is recording.':'Ready to record');
    localizedText(dialog.querySelector('[data-capture-reason]'),run?'F8 marks the moment you notice a stutter.':l?.run?'Stop the Low capture with F4 first.':!allowed?'Start a flight, then open Flight menu → Performance diagnostics.':'Starting returns you to flight. Your graphics settings stay unchanged.');
    const language=document.documentElement.lang;
    if(shownReport!==latest?.report||shownLanguage!==language){shownReport=latest?.report;shownLanguage=language;dialog.querySelector('.diagnostic-result').innerHTML=diagnosticSummary(shownReport);}
  };
  controls.close.onclick=()=>dialog.close();
  controls.start.onclick=async()=>{if(canRecord()&&!low()?.run){dialog.close();await onRecord();}};
  controls.stop.onclick=()=>{current()?.finish();refresh();};
  controls.download.onclick=()=>latestCapture(current(),low())?.download();
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{clearInterval(timer);dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});
  root.append(dialog);refresh();const timer=setInterval(refresh,500);dialog.showModal();controls.close.focus();
}
