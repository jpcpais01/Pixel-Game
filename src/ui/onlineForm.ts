// The "Play online" panel on the arena select: open a room in the picked
// arena (co-op, or a duel on the duelling ring) or join a friend's by its
// code. An HTML panel over the canvas like the account form, so phones get
// their own keyboard for the code.

import { account } from '../game/cloud';
import { characterById } from '../game/characters';
import type { ArenaDef } from '../world/arenas';
import { session, type Joined } from '../net/session';

const CSS = `
#online { position: fixed; inset: 0; z-index: 4; display: flex; align-items: center; justify-content: center; background: rgba(11, 8, 24, 0.6); padding: 12px; }
#online .box { width: min(320px, 100%); display: flex; flex-direction: column; gap: 9px; padding: 16px; background: linear-gradient(#2a2150, #140f2a); box-shadow: inset 2px 2px 0 #6b5aa6, inset -2px -2px 0 #43356e, 0 0 0 2px #0b0818; }
#online h2 { margin: 0 0 2px; font-size: 15px; letter-spacing: 1px; text-align: center; color: #f4cf6a; text-transform: uppercase; }
#online h3 { margin: 4px 0 0; font-size: 11px; letter-spacing: 1px; color: #9a90c8; text-transform: uppercase; font-weight: normal; }
#online p { margin: 0; font-size: 12px; color: #cdd2ff; }
#online button { padding: 7px 10px; border: 0; border-radius: 0; cursor: pointer; font: inherit; text-transform: uppercase; background: #2e2658; color: #cdd2ff; box-shadow: inset 2px 2px 0 #8a78c8, inset -2px -2px 0 #191434, 0 0 0 2px #0b0818; }
#online button.go { background: #5a50c8; color: #fff4d6; box-shadow: inset 2px 2px 0 #ffe89a, inset -2px -2px 0 #c07f30, 0 0 0 2px #120e1f; }
#online button:active { box-shadow: inset 2px 2px 0 #191434, inset -2px -2px 0 #8a78c8, 0 0 0 2px #0b0818; }
#online button:disabled { opacity: 0.6; cursor: default; }
#online input { flex: 1; min-width: 0; font: 17px/1.3 ui-monospace, Menlo, monospace; letter-spacing: 4px; text-transform: uppercase; padding: 5px 8px; border: 0; border-radius: 0; outline: none; color: #fff4d6; background: #0f0b22; box-shadow: inset 2px 2px 0 #0b0818, 0 0 0 2px #43356e; -webkit-user-select: text; user-select: text; }
#online input:focus { box-shadow: inset 2px 2px 0 #0b0818, 0 0 0 2px #d69a3a; }
#online .row { display: flex; gap: 8px; }
#online .msg { min-height: 16px; font-size: 12px; color: #ffcf8a; }
#online .msg.err { color: #ff8a8a; }
#online .sep { height: 2px; background: #2a2150; margin: 2px 0; }
`;

/**
 * Show the panel. `character` is the class picked on the hero select;
 * `onStart` gets the room's arena once in a room (a friend's may differ from
 * the one picked here).
 */
export function openOnlineForm(arena: ArenaDef, character: string, onStart: (room: Joined) => void, onClose: () => void): void {
  if (document.getElementById('online')) return;
  if (!document.getElementById('online-css')) {
    const style = document.createElement('style');
    style.id = 'online-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const ch = characterById(character);
  const duel = !!arena.duel;
  const root = document.createElement('div');
  root.id = 'online';
  root.className = 'chrome';
  root.innerHTML = `
    <div class="box">
      <h2>Play online</h2>
      <h3>New room</h3>
      <p>${duel ? `A 1v1 duel on the ${arena.name}.` : `Co-op in the ${arena.name}, up to 4 heroes.`} You'll get a code to send your friends.</p>
      <button type="button" class="go" data-create>Create room</button>
      <div class="sep"></div>
      <h3>Join a friend</h3>
      <div class="row"><input maxlength="4" placeholder="CODE" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false"><button type="button" class="go" data-join>Join</button></div>
      <div class="msg"></div>
      <button type="button" data-close>Back</button>
    </div>`;
  document.body.append(root);

  const msg = root.querySelector('.msg') as HTMLElement;
  const input = root.querySelector('input') as HTMLInputElement;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-create], [data-join]')];
  let busy = false;

  // Typing mustn't reach the game's own keys (Space and Enter start it).
  for (const t of ['keydown', 'keyup', 'keypress']) root.addEventListener(t, (e) => e.stopPropagation());

  const say = (text: string, err = false) => {
    msg.textContent = text;
    msg.classList.toggle('err', err);
  };
  const setBusy = (b: boolean) => {
    busy = b;
    buttons.forEach((btn) => (btn.disabled = b || !session.configured));
  };
  setBusy(false);
  if (!session.configured) say("Online play needs the game server, which isn't set up yet.", true);

  const close = () => {
    root.remove();
    session.close();
    onClose();
  };
  root.querySelector('[data-close]')!.addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) close();
  });

  const me = { name: account()?.username ?? ch.name, hero: ch.id, look: ch.look };
  const go = async (req: Parameters<typeof session.open>[0]) => {
    if (busy) return;
    setBusy(true);
    say('Connecting... the server may take a moment to wake up.');
    try {
      const room = await session.open(req, me);
      root.remove();
      onStart(room);
    } catch (ex) {
      say(ex instanceof Error ? ex.message : 'Something went wrong. Try again.', true);
      setBusy(false);
    }
  };
  root.querySelector('[data-create]')!.addEventListener('click', () => go({ t: 'create', mode: duel ? 'duel' : 'coop', arena: arena.id }));
  const join = () => {
    const code = input.value.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) {
      say('Room codes are 4 letters.', true);
      return;
    }
    go({ t: 'join', code });
  };
  root.querySelector('[data-join]')!.addEventListener('click', join);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
}
