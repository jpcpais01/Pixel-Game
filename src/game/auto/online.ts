// Auto Battle online: a room on the play server (a 'coop' room in the 'auto'
// arena, so up to four people; the relay needs nothing new). The host seats
// the people who came and any bots it adds, keeps the clock and referees: it
// starts each round's planning, asks for everyone's boards when time is up,
// plays its bots, works out every bout of the round (see table.ts), and
// sends them, so each screen plays its own player's fight and all agree on
// who lost what. Each player runs their own shop and gold.
//
//   host -> all:   ag { seats }               the match starts: who sits where (SeatInfo[])
//                  ap { round, sec }          planning starts
//                  al { round }               planning is over: send your board
//                  af { round, bouts, hp, lv, place }   the round (a RoundResult)
//                  ah { hp, place }           someone left: their seat is out
//                  ax { to }                  sorry, the match has begun
//   guest -> host: ab { round, b, lv, bn }    my board, level and boons
//   anyone:        ar { round, on }           ready (or not) to fight early

import { COLS, HALF, ROWS, type Placed } from './sim';
import { UNITS } from './units';
import { MAX_SEATS, type Bout, type RoundResult, type SeatInfo } from './table';
import { cleanBoons } from './boons';

export const AUTO_ARENA = 'auto';

/** How long the host waits for the others' boards before fighting their last ones. */
export const BOARD_WAIT_MS = 4000;

const num = (v: unknown, d = 0): number => (Number.isFinite(Number(v)) ? Number(v) : d);
const nums = (v: unknown, n: number, d: number): number[] => Array.from({ length: n }, (_, i) => num(Array.isArray(v) ? v[i] : undefined, d));

/** The seats as the host sent them. */
export function cleanSeats(raw: unknown): SeatInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_SEATS).map((s) => {
    const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    return { name: String(o.name ?? 'Rival').slice(0, 16), bot: !!o.bot, peer: Math.floor(num(o.peer, -1)) };
  });
}

/** A round as the host sent it, for a table of `n` seats. */
export function cleanRound(m: Record<string, unknown>, n: number): RoundResult {
  const seat = (v: unknown) => Math.max(0, Math.min(n - 1, Math.floor(num(v))));
  const bouts: Bout[] = (Array.isArray(m.bouts) ? m.bouts : []).slice(0, MAX_SEATS).map((b: unknown) => {
    const o = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
    const boards = Array.isArray(o.boards) ? o.boards : [];
    const dmg = nums(o.dmg, 2, 0);
    return {
      a: seat(o.a),
      b: seat(o.b),
      ghost: !!o.ghost,
      seed: num(o.seed) | 0,
      boards: [cleanBoard(boards[0]), cleanBoard(boards[1])],
      boons: [cleanBoons(Array.isArray(o.boons) ? o.boons[0] : []), cleanBoons(Array.isArray(o.boons) ? o.boons[1] : [])],
      win: Math.max(-1, Math.min(1, Math.floor(num(o.win, -1)))),
      dmg: [dmg[0], dmg[1]],
      ticks: num(o.ticks),
    };
  });
  return { round: num(m.round), bouts, hp: nums(m.hp, n, 0), lv: nums(m.lv, n, 1), place: nums(m.place, n, 0) };
}

/** A board as sent: only real heroes, on the sender's own half, at most `max` (the top level, and a boon's one more), stars 1 to 3. */
export function cleanBoard(raw: unknown, max = 7): Placed[] {
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
