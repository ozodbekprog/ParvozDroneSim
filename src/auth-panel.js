export function authPanelHTML() {
  return `<section class="auth-panel" aria-label="Pilot account">
    <div class="auth-tabs" role="tablist" aria-label="Account">
      <button type="button" id="auth-login-tab" role="tab" aria-controls="auth-form" aria-selected="true" data-auth-mode="login">Sign in</button>
      <button type="button" id="auth-register-tab" role="tab" aria-controls="auth-form" aria-selected="false" tabindex="-1" data-auth-mode="register">Register</button>
    </div>
    <form id="auth-form" class="auth-form" role="tabpanel" aria-labelledby="auth-login-tab" novalidate>
      <label for="auth-name">Username</label>
      <input id="auth-name" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]{3,20}" title="Use 3–20 letters, numbers or underscores; no spaces." required />
      <small id="auth-name-hint" data-register-hint hidden>3–20 letters, numbers or underscores.</small>
      <div class="auth-password-label"><label for="auth-password">Password</label><button type="button" class="auth-link" data-action="recover-account">Forgot password?</button></div>
      <input id="auth-password" name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required />
      <small id="auth-password-hint" data-register-hint hidden>8–128 characters.</small>
      <p id="auth-status" role="status" aria-live="polite"></p>
      <p id="auth-error" class="form-error" role="alert" hidden></p>
      <button type="submit" class="auth-submit">Sign in</button>
    </form>
    <div class="auth-secondary"><button type="button" class="auth-link" data-action="guest">Play as guest</button></div>
  </section>`;
}

/** Switch modes in place: autofilled credentials survive tab changes. */
export function bindAuthPanel(root, onAction) {
  const form = root.querySelector('#auth-form');
  const tabs = [...root.querySelectorAll('[data-auth-mode]')];
  const password = root.querySelector('#auth-password');
  const username = root.querySelector('#auth-name');
  const submit = root.querySelector('.auth-submit');
  const recovery = root.querySelector('[data-action="recover-account"]');
  let mode = 'login';
  function select(tab) {
    if (tab.disabled) return;
    mode = tab.dataset.authMode;
    const register = mode === 'register';
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    }
    form.setAttribute('aria-labelledby', tab.id);
    password.autocomplete = register ? 'new-password' : 'current-password';
    for (const hint of root.querySelectorAll('[data-register-hint]')) hint.hidden = !register;
    for (const [field, hint] of [[username, 'auth-name-hint'], [password, 'auth-password-hint']]) {
      if (register) field.setAttribute('aria-describedby', hint);
      else field.removeAttribute('aria-describedby');
    }
    recovery.hidden = register;
    submit.textContent = register ? 'Create account' : 'Sign in';
    root.querySelector('#auth-error').hidden = true;
    root.querySelector('#auth-status').textContent = '';
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || tab.disabled) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      select(tabs[index]); tabs[index].focus();
    });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!submit.disabled) onAction(mode);
  });
}
