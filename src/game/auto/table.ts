// An Auto Battle table of two to eight players (people and bots). Each round
// the players still in are paired at random; with an odd number, the one
// left over fights a ghost: a copy of another player's board. Beating the
// ghost wins back the health a loss would have cost, losing to it costs
// health as usual, and the player whose board it copied neither gains nor
// loses by it. The host works every bout out at once (the fights are seeded,
// so each player's screen can then play its own) and sends the round.

import { Battle, type Placed } from './sim';
import { lossDamage, START_HP } from './match';

/** Most bots a table takes, and most players in all (people and bots). */
export const MAX_BOTS = 4;
export const MAX_SEATS = 8;

/** Who sits at a seat: a name, a bot or a person, and the person's id in the online room (-1 offline). */
export interface SeatInfo {
  name: string;
  bot: boolean;
  peer: number;
}

/** One fight of a round: seat `a` (the bottom side) against seat `b`, or against a ghost of `b`'s board. */
export interface Bout {
  a: number;
  b: number;
  ghost: boolean;
  seed: number;
  boards: [Placed[], Placed[]];
  /** 0: `a` won, 1: `b` (or its ghost) won, -1: a draw. */
  win: number;
  /** Health lost by [a, b]; a negative number is health won back (from a ghost). A ghost's owner loses nothing. */
  dmg: [number, number];
  /** How long it runs, in sim ticks. */
  ticks: number;
}

/** A round, as worked out by the host: its bouts, and every seat's health, level and finishing place after. */
export interface RoundResult {
  round: number;
  bouts: Bout[];
  hp: number[];
  lv: number[];
  /** Where each seat finished (1 = won), or 0 while still in. */
  place: number[];
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Fight one bout to its end and reckon its damage. */
function fightBout(round: number, a: number, b: number, ghost: boolean, boards: Placed[][], rand: () => number): Bout {
  const pair: [Placed[], Placed[]] = [boards[a] ?? [], boards[b] ?? []];
  const seed = (rand() * 2 ** 31) | 0;
  const battle = new Battle(pair, seed);
  battle.runToEnd();
  const stars = battle.survivors().map((u) => u.star);
  const dmg: [number, number] = [0, 0];
  if (ghost) {
    // Only the player facing the ghost has anything riding on it.
    if (battle.winner === 0) dmg[0] = -lossDamage(round, stars);
    else if (battle.winner === 1) dmg[0] = lossDamage(round, stars);
  } else if (battle.winner === 0) dmg[1] = lossDamage(round, stars);
  else if (battle.winner === 1) dmg[0] = lossDamage(round, stars);
  else dmg[0] = dmg[1] = lossDamage(round, []);
  return { a, b, ghost, seed, boards: pair, win: battle.winner, dmg, ticks: battle.tick };
}

/**
 * A round's bouts: the seats in `alive` paired at random, and the odd one
 * out (if any) against a ghost of another seat's board, one still in if any
 * has a board, else any that ever set one out.
 */
export function drawBouts(round: number, alive: number[], boards: Placed[][], rand: () => number): Bout[] {
  const order = shuffle(alive, rand);
  const bouts: Bout[] = [];
  for (let i = 0; i + 1 < order.length; i += 2) bouts.push(fightBout(round, order[i], order[i + 1], false, boards, rand));
  if (order.length % 2 === 1) {
    const odd = order[order.length - 1];
    const others = boards.map((_, i) => i).filter((i) => i !== odd && (boards[i]?.length ?? 0) > 0);
    const living = others.filter((i) => alive.includes(i));
    const pool = living.length ? living : others;
    if (pool.length) bouts.push(fightBout(round, odd, pool[Math.floor(rand() * pool.length)], true, boards, rand));
  }
  return bouts;
}

/** Health after a round's bouts (kept between 0 and the start). */
export function healthAfter(hp: number[], bouts: Bout[]): number[] {
  const out = [...hp];
  const hit = (i: number, d: number) => (out[i] = Math.max(0, Math.min(START_HP, out[i] - d)));
  for (const b of bouts) {
    hit(b.a, b.dmg[0]);
    if (!b.ghost) hit(b.b, b.dmg[1]);
  }
  return out;
}

/** Places after a round: those who fell in it share the place under everyone still in; the last one in is 1st. */
export function placesAfter(before: number[], after: number[], place: number[]): number[] {
  const out = [...place];
  const left = after.filter((h) => h > 0).length;
  after.forEach((h, i) => {
    if (h <= 0 && before[i] > 0) out[i] = left + 1;
  });
  if (left === 1) out[after.findIndex((h) => h > 0)] = 1;
  return out;
}

/** "1st", "2nd", "3rd"... */
export const ordinal = (n: number): string => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
