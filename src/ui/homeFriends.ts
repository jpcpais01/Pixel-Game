// The Home's friends panel: open the Home to friends with a room code, visit
// a friend's Home by theirs, or leave and go back to your own. Rooms are the
// online co-op rooms (see net/session.ts); a Home's room is in the 'home'
// arena, and its host is the one whose Home it is (see world/Home.ts).

import { account } from '../game/cloud';
import { characterById } from '../game/characters';
import { session } from '../net/session';
import { cozy } from '../game/cozy';
import { onlineStyles } from './onlineForm';

export interface FriendsOptions {
  /** In the player's own Home (else visiting a friend's). */
  owner: boolean;
  /** The room this world is playing in, if any. */
  code: string | null;
  character: string | undefined;
  /** Leave the room the world is in, before opening another. */
  leave(): void;
  /** Start the world again in this arena (in whatever room is now open). */
  start(arena: string): void;
}

export function openHomeFriends(o: FriendsOptions): void {
  if (document.getElementById('online')) return;
  onlineStyles();
  const root = document.createElement('div');
  root.id = 'online';
  root.className = 'chrome';
  const inRoom = !!o.code;
  root.innerHTML = inRoom
    ? `
    <div class="box">
      <h2>${o.owner ? 'Your home is open' : 'Visiting a friend'}</h2>
      <p>Room code</p>
      <p style="font: 28px/1.2 ui-monospace, Menlo, monospace; letter-spacing: 8px; color: #fff4d6; text-align: center">${o.code}</p>
      <p>${o.owner ? 'Friends type this code under Friends in their own Home, or Start Game, then Online, then Join.' : 'The day and night here are shared with everyone in the room.'}</p>
      <div class="msg"></div>
      <button type="button" class="go" data-leave>${o.owner ? 'Close to visitors' : 'Back to my home'}</button>
      <button type="button" data-close>Back</button>
    </div>`
    : `
    <div class="box">
      <h2>Friends</h2>
      <h3>Invite friends</h3>
      <p>Open your home to up to 3 friends. You'll get a code to send them.</p>
      <button type="button" class="go" data-create>Invite friends</button>
      <div class="sep"></div>
      <h3>Visit a friend</h3>
      <div class="row"><input maxlength="4" placeholder="CODE" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false"><button type="button" class="go" data-join>Visit</button></div>
      <div class="msg"></div>
      <button type="button" data-close>Back</button>
    </div>`;
  document.body.append(root);

  const msg = root.querySelector('.msg') as HTMLElement;
  const input = root.querySelector('input') as HTMLInputElement | null;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-create], [data-join]')];
  let busy = false;
  // Typing mustn't reach the game's own keys.
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
  if (!inRoom && !session.configured) say("Online play needs the game server, which isn't set up yet.", true);

  const close = () => root.remove();
  root.querySelector('[data-close]')!.addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root && !busy) close();
  });

  root.querySelector('[data-leave]')?.addEventListener('click', () => {
    close();
    o.leave();
    session.close();
    o.start('home');
  });

  const ch = characterById(o.character);
  const me = cozy.on && cozy.me ? cozy.me() : { name: account()?.username ?? ch.name, hero: ch.id, look: ch.look };
  const go = async (req: Parameters<typeof session.open>[0]) => {
    if (busy) return;
    setBusy(true);
    say('Connecting... the server may take a moment to wake up.');
    o.leave();
    try {
      const room = await session.open(req, me);
      if (room.arena === 'auto') {
        // An Auto Battle room is joined from Auto Battle, not a Home.
        session.close();
        say("That code is an Auto Battle room: join it from Auto Battle.", true);
        setBusy(false);
        return;
      }
      root.remove();
      o.start(room.arena);
    } catch (ex) {
      say(ex instanceof Error ? ex.message : 'Something went wrong. Try again.', true);
      setBusy(false);
    }
  };
  root.querySelector('[data-create]')?.addEventListener('click', () => go({ t: 'create', mode: 'coop', arena: 'home' }));
  const join = () => {
    const code = (input?.value ?? '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) {
      say('Room codes are 4 letters.', true);
      return;
    }
    go({ t: 'join', code });
  };
  root.querySelector('[data-join]')?.addEventListener('click', join);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
}
