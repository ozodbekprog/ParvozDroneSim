/** Secrets live only in the open dialog, never in browser storage or URLs. */
export function accountAccessDialog(parent, api, { recover = false, username = '' } = {}) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'flow-dialog';
    dialog.setAttribute('aria-label', recover ? 'Recover pilot account' : 'Account recovery code');
    dialog.innerHTML = `<form><h2>${recover ? 'Recover pilot account' : 'Keep access to your account'}</h2>
      <p>${recover ? 'Enter your callsign, saved recovery code and a new password. All previous sign-ins will end.' : 'Save a recovery code somewhere private. It can reset your password once. Creating a new code replaces the previous one.'}</p>
      ${recover ? '<label>Callsign<input name="username" autocomplete="username" pattern="[a-zA-Z0-9_]{3,20}" required maxlength="20"></label><label>Recovery code<input name="code" autocomplete="off" spellcheck="false" required maxlength="80"></label>' : ''}
      <label>${recover ? 'New password' : 'Current password'}<input name="password" type="password" autocomplete="${recover ? 'new-password' : 'current-password'}" minlength="8" maxlength="128" required></label>
      <p role="alert" id="account-error"></p><div class="panel-actions"><button type="button" class="button ghost" id="account-cancel">Cancel</button><button type="submit" class="button primary">${recover ? 'Reset password' : 'Create recovery code'}</button></div></form>`;
    parent.appendChild(dialog);
    if (recover) dialog.querySelector('[name="username"]').value = username;
    let busy = false, changed = false;
    const close = () => { if (busy) return; dialog.close(); dialog.remove(); resolve(changed); };
    dialog.querySelector('#account-cancel').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return;
      busy = true;
      const submit = dialog.querySelector('[type="submit"]'); submit.disabled = true;
      const error = dialog.querySelector('#account-error'); error.textContent = '';
      const password = dialog.querySelector('[name="password"]');
      try {
        const result = await api(recover ? '/account/recover' : '/account/recovery-code', 'POST', recover
          ? { username: dialog.querySelector('[name="username"]').value.trim(), code: dialog.querySelector('[name="code"]').value.trim(), newPassword: password.value }
          : { password: password.value });
        password.value = ''; changed = true;
        if (recover) { busy = false; close(); return; }
        dialog.innerHTML = '<h2>Save your recovery code</h2><p>This code is shown only now. Keep it private, outside this browser. It replaces your previous code.</p><label>Recovery code<textarea id="recovery-secret" rows="3" readonly spellcheck="false" style="width:100%;user-select:text;overflow-wrap:anywhere"></textarea></label><div class="panel-actions"><button type="button" class="button primary" id="recovery-done">I saved my code</button></div>';
        const field = dialog.querySelector('#recovery-secret'); field.value = result.code;
        dialog.querySelector('#recovery-done').addEventListener('click', close);
        field.focus(); field.select();
      } catch (failure) { error.textContent = failure.message; password.value = ''; submit.disabled = false; }
      finally { busy = false; }
    });
    dialog.showModal(); dialog.querySelector('input')?.focus();
  });
}
