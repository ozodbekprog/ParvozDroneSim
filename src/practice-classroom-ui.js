import {CLASSROOM_LIMIT, REPORT_MAX_BYTES, classroomTimeZone} from './practice-classroom.js';

const html = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function removalControls(code) {
  return `<button class="button" data-classroom-remove="${html(code)}"><span>Remove learner</span> <span translate="no">${html(code)}</span></button><span class="classroom-confirm" data-classroom-confirmation="${html(code)}" hidden><span>Remove this learner and their imported reports?</span><button class="button" data-classroom-confirm="${html(code)}"><span>Confirm removal</span> <span translate="no">${html(code)}</span></button><button class="button" data-classroom-cancel="${html(code)}">Keep learner</button></span>`;
}
export function classroomLayout(classroom, lessonId) {
  const rows = classroom.rows(lessonId);
  return `<section class="practice-classroom" data-classroom-lesson="${html(lessonId)}" aria-labelledby="classroom-title">
    <header class="practice-heading"><h2 id="classroom-title">Group report</h2><span>${rows.length} / ${CLASSROOM_LIMIT}</span></header>
    <p>Use learner codes, not names. Ask each learner for their instructor report (JSON), then import it in their row.</p>
    <div class="classroom-toolbar"><form id="classroom-add"><label for="classroom-code">Learner code</label><div><input id="classroom-code" name="code" maxlength="16" required pattern="[A-Za-z0-9_-]{1,16}" placeholder="P01" autocomplete="off" aria-describedby="classroom-code-help" ${rows.length>=CLASSROOM_LIMIT?'disabled':''}/><button class="button" type="submit" ${rows.length>=CLASSROOM_LIMIT?'disabled':''}>Add learner</button></div></form>
    <div><label for="classroom-date">Practice date</label><input id="classroom-date" type="date" required value="${html(classroom.date)}"/><small><span>Time zone</span>: <span translate="no">${html(classroomTimeZone())}</span></small></div>
    <button class="button" data-classroom-export ${rows.length?'':'disabled'}>Download group report (CSV)</button></div>
    <p id="classroom-code-help" class="practice-note">Codes use 1–16 letters A–Z, digits, hyphens or underscores.</p>
    <p role="status" aria-live="polite" id="classroom-status"></p>
    ${rows.length?`<div class="classroom-table-scroll" role="region" aria-label="Group results" tabindex="0"><table class="classroom-table"><caption><span>Selected exercise</span>: <span>${html(classroom.lessons.find(lesson=>lesson.id===lessonId)?.name)}</span></caption><thead><tr><th scope="col">Learner code</th><th scope="col">Report status</th><th scope="col">Completions</th><th scope="col">Last duration (s)</th><th scope="col">Last resets</th><th scope="col">Report actions</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row" translate="no">${html(row.code)}</th><td>${row.status}</td><td>${row.completions}</td><td>${row.durationMs===null?'—':(row.durationMs/1000).toFixed(1)}</td><td>${row.resets??'—'}</td><td><div class="classroom-row-actions"><button class="button" data-classroom-import="${html(row.code)}"><span>Import report</span> <span translate="no">${html(row.code)}</span></button>${removalControls(row.code)}</div></td></tr>`).join('')}</tbody></table></div>`:'<p>Add learner codes to collect reports for this exercise.</p>'}
    <p class="practice-note">The date uses this computer’s time zone. Only completed attempts are recorded; no completions does not mean no practice.</p>
    <p class="practice-note">Imported reports can be edited by learners. They are not verified scores. The latest 200 attempts per learner are kept.</p>
    <p class="practice-note">${classroom.persistent?'This group is saved for this pilot in this browser. Keep the original learner files to restore it elsewhere.':'Group storage is unavailable or unreadable. This group is in memory only; keep the learner files before leaving.'}</p>
  </section>`;
}

export function bindClassroom(root, {classroom, refresh, isCurrent, download, translate = text => text}) {
  const show = message => { const status=root.querySelector('#classroom-status'); if(status) status.textContent=translate(message); };
  root.querySelector('#classroom-add')?.addEventListener('submit', event => {
    event.preventDefault();
    try { classroom.add(root.querySelector('#classroom-code').value); refresh(); show('Learner added.'); root.querySelector('#classroom-code')?.focus(); }
    catch(error) { show(error.message); }
  });
  root.querySelector('#classroom-date')?.addEventListener('change', event => {
    try { classroom.setDate(event.target.value); refresh(); root.querySelector('#classroom-date')?.focus(); }
    catch(error) { event.target.value=classroom.date; show(error.message); }
  });
  root.querySelector('[data-classroom-export]')?.addEventListener('click', download);
  root.querySelectorAll('[data-classroom-remove]').forEach(button => button.addEventListener('click', () => {
    button.hidden=true;
    root.querySelector(`[data-classroom-confirmation="${button.dataset.classroomRemove}"]`).hidden=false;
    root.querySelector(`[data-classroom-cancel="${button.dataset.classroomRemove}"]`)?.focus();
  }));
  root.querySelectorAll('[data-classroom-cancel]').forEach(button => button.addEventListener('click', () => {
    root.querySelector(`[data-classroom-confirmation="${button.dataset.classroomCancel}"]`).hidden=true;
    const remove=root.querySelector(`[data-classroom-remove="${button.dataset.classroomCancel}"]`);
    remove.hidden=false;remove.focus();
  }));
  root.querySelectorAll('[data-classroom-confirm]').forEach(button => button.addEventListener('click', () => {
    classroom.remove(button.dataset.classroomConfirm); refresh(); show('Learner removed.'); root.querySelector('#classroom-code')?.focus();
  }));
  root.querySelectorAll('[data-classroom-import]').forEach(button => button.addEventListener('click', () => {
    const code = button.dataset.classroomImport;
    const participant = classroom.participants.find(item => item.code === code);
    const picker = document.createElement('input');
    picker.type='file'; picker.accept='.json,application/json'; picker.hidden=true;
    document.body.appendChild(picker);
    picker.addEventListener('cancel',()=>picker.remove(),{once:true});
    picker.addEventListener('change', async () => {
      try {
        const file=picker.files?.[0]; if(!file) return;
        if(file.size>REPORT_MAX_BYTES) throw new Error('Practice report is larger than 128 KiB.');
        const text=await file.text();
        // Do not apply a delayed import to a changed profile, view or recreated learner.
        if(!isCurrent() || !classroom.participants.includes(participant)) return;
        classroom.importReport(code,text); refresh(); show('Learner report imported.');
        root.querySelector(`[data-classroom-import="${code}"]`)?.focus({preventScroll:true});
      } catch(error) { if(isCurrent()) show(error.message); }
      finally { picker.remove(); }
    },{once:true});
    picker.click();
  }));
}
