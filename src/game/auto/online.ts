// Auto Battle online: a 1v1 room on the play server (a 'duel' room in the
// 'auto' arena, so the relay needs nothing new). The host keeps the clock and
// referees: it starts each round's planning, asks for the guest's board when
// time is up, works out the fight, and sends both boards, the seed and the
// result, so both screens play the same fight and agree on who lost what.
// Each player runs their own shop and gold.
//
//   host -> guest: ag (go: the match starts)
//                  ap { round, sec }          planning starts
//                  al { round }               planning is over: send your board
//                  af { round, seed, a, b, win, dmg, hp, lv }   the fight (a: host's board, b: guest's)
//   guest -> host: ab { round, b, lv }        my board
//   either:        ar { round, on }           ready (or not) to fight early

import { COLS, HALF, ROWS, type Placed } from './sim';
import { UNITS } from './units';

export const AUTO_ARENA = 'auto';

/** How long the host waits for the guest's board before fighting its last one. */
export const BOARD_WAIT_MS = 4000;

export interface FightMsg {
  round: number;
  seed: number;
  a: Placed[];
  b: Placed[];
  /** 0 host, 1 guest, -1 a draw. */
  win: number;
  /** Damage dealt to [host, guest]. */
  dmg: [number, number];
  /** Health after, [host, guest]. */
  hp: [number, number];
  lv: [number, number];
}

/** A board as sent: only real heroes, on the sender's own half, at most `max`, stars 1 to 3. */
export function cleanBoard(raw: unknown, max = 6): Placed[] {
  if (!Array.isArray(raw)) return [];
  const out: Placed[] = [];
  const taken = new Set<number>();
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const key = String(o.key ?? '');
    if (!UNITS[key]) continue;
    const c = Math.floor(Number(o.c));
    const r = Math.floor(Number(o.r));
    if (!(c >= 0 && c < COLS && r >= HALF && r < ROWS) || taken.has(r * COLS + c)) continue;
    taken.add(r * COLS + c);
    out.push({ key, look: String(o.look ?? '').slice(0, 24), star: Math.max(1, Math.min(3, Math.floor(Number(o.star)) || 1)), c, r });
    if (out.length >= max) break;
  }
  return out;
}
