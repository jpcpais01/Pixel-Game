// The log in / create account form. Phaser has no text fields, so this is a
// small HTML panel over the canvas, styled like the game's pixel buttons,
// which gives phones their own keyboard and password managers something to
// fill.

import { CloudError, logIn, MIN_PASSWORD } from '../game/cloud';

const CSS = `
#account { position: fixed; inset: 0; z-index: 4; display: flex; align-items: center; justify-content: center; background: rgba(11, 8, 24, 0.6); padding: 12px; }
#account form { width: min(300px, 100%); display: flex; flex-direction: column; gap: 9px; padding: 16px; background: linear-gradient(#2a2150, #140f2a); box-shadow: inset 2px 2px 0 #6b5aa6, inset -2px -2px 0 #43356e, 0 0 0 2px #0b0818; }
#account h2 { margin: 0 0 2px; font-size: 15px; letter-spacing: 1px; text-align: center; color: #f4cf6a; text-transform: uppercase; }
#account .tabs { display: flex; gap: 6px; }
#account .tabs button { flex: 1; }
#account button { padding: 7px 10px; border: 0; border-radius: 0; cursor: pointer; font: inherit; text-transform: uppercase; background: #2e2658; color: #cdd2ff; box-shadow: inset 2px 2px 0 #8a78c8, inset -2px -2px 0 #191434, 0 0 0 2px #0b0818; }
#account button.on, #account button.go { background: #5a50c8; color: #fff4d6; box-shadow: inset 2px 2px 0 #ffe89a, inset -2px -2px 0 #c07f30, 0 0 0 2px #120e1f; }
#account button:active { box-shadow: inset 2px 2px 0 #191434, inset -2px -2px 0 #8a78c8, 0 0 0 2px #0b0818; }
#account button:disabled { opacity: 0.6; cursor: default; }
#account label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: #9a90c8; text-transform: uppercase; }
#account input { font: 15px/1.3 ui-monospace, Menlo, monospace; padding: 6px 8px; border: 0; border-radius: 0; outline: none; color: #fff4d6; background: #0f0b22; box-shadow: inset 2px 2px 0 #0b0818, 0 0 0 2px #43356e; -webkit-user-select: text; user-select: text; }
#account input:focus { box-shadow: inset 2px 2px 0 #0b0818, 0 0 0 2px #d69a3a; }
#account .err { min-height: 16px; font-size: 12px; color: #ff8a8a; }
#account .note { font-size: 11px; color: #7c82b8; }
#account .row { display: flex; gap: 8px; }
#account .row button { flex: 1; }
`;

/** Show the form; `onDone(true)` once logged in, `onDone(false)` if closed. */
export function openAccountForm(onDone: (loggedIn: boolean) => void): void {
  if (document.getElementById('account')) return;
  if (!document.getElementById('account-css')) {
    const style = document.createElement('style');
    style.id = 'account-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const root = document.createElement('div');
  root.id = 'account';
  root.className = 'chrome';
  root.innerHTML = `
    <form novalidate autocomplete="on">
      <h2>Account</h2>
      <div class="tabs"><button type="button" data-mode="login" class="on">Log in</button><button type="button" data-mode="create">Create</button></div>
      <label>Username<input name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="16" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" maxlength="64" required></label>
      <div class="note" hidden>3 to 16 letters, numbers or _. Password at least ${MIN_PASSWORD} characters. There's no email, so keep your password safe.</div>
      <div class="err"></div>
      <div class="row"><button type="button" data-close>Back</button><button type="submit" class="go">Log in</button></div>
    </form>`;
  document.body.append(root);

  const form = root.querySelector('form')!;
  const [name, pass] = [...form.querySelectorAll('input')] as HTMLInputElement[];
  const err = form.querySelector('.err') as HTMLElement;
  const note = form.querySelector('.note') as HTMLElement;
  const go = form.querySelector('.go') as HTMLButtonElement;
  const tabs = [...form.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  let create = false;
  let busy = false;

  // Typing mustn't reach the game's own keys (Space and Enter start it).
  for (const t of ['keydown', 'keyup', 'keypress']) root.addEventListener(t, (e) => e.stopPropagation());

  const setMode = (c: boolean) => {
    create = c;
    tabs.forEach((t) => t.classList.toggle('on', (t.dataset.mode === 'create') === c));
    go.textContent = c ? 'Create' : 'Log in';
    pass.autocomplete = c ? 'new-password' : 'current-password';
    note.hidden = !c;
    err.textContent = '';
  };
  tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode === 'create')));

  const close = (ok: boolean) => {
    root.remove();
    onDone(ok);
  };
  form.querySelector('[data-close]')!.addEventListener('click', () => !busy && close(false));
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root && !busy) close(false);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    go.disabled = true;
    err.textContent = '';
    go.textContent = '...';
    try {
      await logIn(name.value.trim(), pass.value, create);
      close(true);
    } catch (ex) {
      err.textContent = ex instanceof CloudError ? ex.message : 'Something went wrong. Try again.';
      busy = false;
      go.disabled = false;
      go.textContent = create ? 'Create' : 'Log in';
    }
  });
  name.focus();
}
