// The connection to the online play server and the room this player is in.
// It outlives scenes: the arena select opens it (creating or joining a room),
// the world plays in it (see NetPlay), and leaving the world closes it.

import { MP_SERVER } from './config';

export type Mode = 'coop' | 'duel';

/** A player in the room: their name and the hero they play (class id and look id). */
export interface PeerInfo {
  id: number;
  name: string;
  hero: string;
  look: string;
}

/** Any message; `t` is its type and `f` the id of the player who sent it. */
export interface Msg {
  t: string;
  f?: number;
  [key: string]: unknown;
}

export interface Joined {
  code: string;
  you: number;
  host: number;
  mode: Mode;
  arena: string;
  players: PeerInfo[];
}

/** How long to wait for the server, which may be waking up from sleep. */
const CONNECT_TIMEOUT = 70000;

class Session {
  private ws: WebSocket | null = null;
  private handlers = new Set<(m: Msg) => void>();
  /** The room, once in one. */
  room: Joined | null = null;
  /** Everyone else in the room, by id. */
  peers = new Map<number, PeerInfo>();
  /** Set when the connection dropped mid-game, for the world to say so once. */
  lost = false;
  /** The pause menu is open: online the world keeps going, but the hero stands still. */
  paused = false;

  get configured(): boolean {
    return !!MP_SERVER;
  }

  get active(): boolean {
    return !!this.room && this.ws?.readyState === WebSocket.OPEN;
  }

  get isHost(): boolean {
    return !!this.room && this.room.host === this.room.you;
  }

  get you(): number {
    return this.room?.you ?? 0;
  }

  /** Create a room in `arena` (co-op, or a duel), or join one by its code. */
  open(req: { t: 'create'; mode: Mode; arena: string } | { t: 'join'; code: string }, me: { name: string; hero: string; look: string }): Promise<Joined> {
    this.close();
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        this.close();
        reject(new Error(msg));
      };
      const timer = setTimeout(() => fail("Couldn't reach the server. Try again in a moment."), CONNECT_TIMEOUT);
      let ws: WebSocket;
      try {
        ws = new WebSocket(MP_SERVER);
      } catch {
        clearTimeout(timer);
        fail("Couldn't reach the server.");
        return;
      }
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ ...req, ...me }));
      ws.onmessage = (ev) => {
        let m: Msg;
        try {
          m = JSON.parse(String(ev.data)) as Msg;
        } catch {
          return;
        }
        if (!settled) {
          if (m.t === 'error') {
            clearTimeout(timer);
            fail(String(m.msg ?? 'Something went wrong.'));
          } else if (m.t === 'joined') {
            clearTimeout(timer);
            settled = true;
            const j = m as unknown as Joined;
            this.room = j;
            this.lost = false;
            this.peers = new Map(j.players.filter((p) => p.id !== j.you).map((p) => [p.id, p]));
            resolve(j);
          }
          return;
        }
        this.receive(m);
      };
      ws.onclose = () => {
        clearTimeout(timer);
        if (!settled) fail("Couldn't reach the server.");
        else if (this.ws === ws) {
          this.lost = !!this.room;
          this.ws = null;
          this.room = null;
          this.peers.clear();
          this.emit({ t: 'closed' });
        }
      };
    });
  }

  /** Keep the room's own bookkeeping, then hand the message on. */
  private receive(m: Msg): void {
    const room = this.room;
    if (!room) return;
    if (m.t === 'peer+') {
      const p = m.p as PeerInfo;
      this.peers.set(p.id, p);
    } else if (m.t === 'peer-') this.peers.delete(m.id as number);
    else if (m.t === 'host') room.host = m.id as number;
    this.emit(m);
  }

  private emit(m: Msg): void {
    for (const h of this.handlers) h(m);
  }

  /** Listen to the room; returns the way to stop. */
  on(fn: (m: Msg) => void): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  /** To everyone else in the room, or to one player. */
  send(m: Msg, to?: number): void {
    if (!this.active) return;
    this.ws!.send(JSON.stringify(to === undefined ? m : { ...m, to }));
  }

  /** Leave the room and hang up. */
  close(): void {
    const ws = this.ws;
    this.ws = null;
    this.room = null;
    this.peers.clear();
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'leave' }));
        ws.close();
      } catch {
        // Already gone.
      }
    }
  }
}

export const session = new Session();
