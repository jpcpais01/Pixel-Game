// An Auto Battle player's side of the match: health, gold, level, the shop,
// the bench and the board, with the rules that tie them together (buying,
// selling, three of a kind starring up, levels, income). The same class plays
// for the practice opponent, steered by `aiPlan`.

import { COLS, HALF, ROWS, type Placed } from './sim';
import { traitCounts, unitDef, UNIT_KEYS, UNITS, type TraitId } from './units';
import { heroStats } from '../stats';

export const START_HP = 100;
export const SHOP_SIZE = 5;
export const BENCH_SIZE = 8;
export const MAX_LEVEL = 6;
export const START_LEVEL = 2;
export const REROLL_COST = 2;
export const XP_COST = 4;
export const XP_BUY = 4;
/** XP to go from each level to the next (index = level). */
export const XP_NEXT = [0, 2, 4, 10, 18, 28, 0];
/** Shop odds by level, for costs 1..5 (percent). */
export const ODDS: number[][] = [
  [],
  [100, 0, 0, 0, 0],
  [75, 25, 0, 0, 0],
  [55, 35, 10, 0, 0],
  [40, 35, 20, 5, 0],
  [25, 33, 28, 11, 3],
  [15, 25, 32, 20, 8],
];
/** Copies of each hero in a player's pool, by cost. */
const POOL = [0, 15, 12, 10, 8, 6];
/** Gold each round, before interest and streaks. */
const INCOME = 5;
/** One gold of interest for each this much banked, up to a cap. */
const INTEREST_STEP = 10;
const INTEREST_MAX = 3;
/** Planning time, first round and later ones (s). */
export const PLAN_SECONDS = [25, 30];

let nextId = 1;

export interface Piece {
  id: number;
  key: string;
  star: number;
  look: string;
}

/** A board cell, in the player's own frame (rows HALF..ROWS-1). */
export interface Spot {
  c: number;
  r: number;
}

export const cellKey = (c: number, r: number): number => r * COLS + c;

/** Damage a loss deals: grows with the round, plus each surviving foe by its stars. */
export function lossDamage(round: number, survivorStars: number[]): number {
  return Math.min(14, 2 + round) + survivorStars.reduce((a, s) => a + s, 0);
}

/** What a piece sells for: its cost for every copy in it (less one for starred ones). */
export function sellValue(p: Piece): number {
  const cost = unitDef(p.key).cost;
  const copies = p.star === 3 ? 9 : p.star === 2 ? 3 : 1;
  return cost * copies - (p.star > 1 ? 1 : 0);
}

export class AutoPlayer {
  hp = START_HP;
  gold = 0;
  level = START_LEVEL;
  xp = 0;
  streak = 0;
  shop: (string | null)[] = new Array(SHOP_SIZE).fill(null);
  /** The shop is frozen: the next rounds keep these cards (bought ones stay gone) until it's thawed or rolled. */
  frozen = false;
  bench: (Piece | null)[] = new Array(BENCH_SIZE).fill(null);
  board = new Map<number, Piece>();
  /** Copies left in this player's pool, by key. */
  private pool = new Map<string, number>();
  /** The look each of this player's heroes wears (another player's are sent to us). */
  lookOf: (key: string) => string = (key) => unitDef(key).type;

  constructor(
    public name: string,
    private rand: () => number = Math.random,
  ) {
    for (const k of UNIT_KEYS) this.pool.set(k, POOL[UNITS[k].cost]);
  }

  get cap(): number {
    return this.level;
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  boardPieces(): { spot: Spot; piece: Piece }[] {
    return [...this.board.entries()].map(([k, piece]) => ({ spot: { c: k % COLS, r: Math.floor(k / COLS) }, piece }));
  }

  /** The board as the fight takes it. */
  placed(): Placed[] {
    return this.boardPieces().map(({ spot, piece }) => ({ key: piece.key, look: piece.look, star: piece.star, c: spot.c, r: spot.r }));
  }

  traits(): { id: TraitId; count: number; level: number }[] {
    return traitCounts([...this.board.values()].map((p) => p.key));
  }

  all(): Piece[] {
    return [...this.bench.filter((p): p is Piece => !!p), ...this.board.values()];
  }

  /** Fill the shop anew from the pool, by this level's odds. */
  roll(): void {
    for (const k of this.shop) if (k) this.pool.set(k, (this.pool.get(k) ?? 0) + 1);
    for (let i = 0; i < SHOP_SIZE; i++) this.shop[i] = this.draw();
  }

  private draw(): string | null {
    const odds = ODDS[this.level];
    let roll = this.rand() * 100;
    let cost = 1;
    for (let c = 0; c < odds.length; c++) {
      roll -= odds[c];
      if (roll < 0) {
        cost = c + 1;
        break;
      }
    }
    // Step down a cost when that tier's pool has run dry.
    for (let c = cost; c >= 1; c--) {
      const keys = UNIT_KEYS.filter((k) => UNITS[k].cost === c && (this.pool.get(k) ?? 0) > 0);
      const total = keys.reduce((a, k) => a + this.pool.get(k)!, 0);
      if (!total) continue;
      let pick = this.rand() * total;
      for (const k of keys) {
        pick -= this.pool.get(k)!;
        if (pick < 0) {
          this.pool.set(k, this.pool.get(k)! - 1);
          return k;
        }
      }
    }
    return null;
  }

  reroll(): boolean {
    if (this.gold < REROLL_COST) return false;
    this.gold -= REROLL_COST;
    // Rolling by hand means new cards are wanted: the freeze is let go.
    this.frozen = false;
    this.roll();
    return true;
  }

  buyXp(): boolean {
    if (this.gold < XP_COST || this.level >= MAX_LEVEL) return false;
    this.gold -= XP_COST;
    this.gainXp(XP_BUY);
    return true;
  }

  gainXp(n: number): void {
    this.xp += n;
    while (this.level < MAX_LEVEL && this.xp >= XP_NEXT[this.level]) {
      this.xp -= XP_NEXT[this.level];
      this.level++;
    }
    if (this.level >= MAX_LEVEL) this.xp = 0;
  }

  /** Would buying shop slot `i` make a third copy (so it fits even with a full bench)? */
  private completes(key: string, fighting: boolean): boolean {
    const ones = this.all().filter((p) => p.key === key && p.star === 1 && (!fighting || this.bench.includes(p))).length;
    return ones >= 2;
  }

  /** Buy shop slot `i`. `fighting`: the board is locked, so only the bench may combine. Returns the new or starred piece. */
  buy(i: number, fighting: boolean): Piece | null {
    const key = this.shop[i];
    if (!key) return null;
    const cost = unitDef(key).cost;
    if (this.gold < cost) return null;
    const slot = this.bench.indexOf(null);
    if (slot < 0 && !this.completes(key, fighting)) return null;
    this.gold -= cost;
    this.shop[i] = null;
    const piece: Piece = { id: nextId++, key, star: 1, look: this.lookOf(key) };
    if (slot >= 0) this.bench[slot] = piece;
    else this.bench.push(piece);
    const merged = this.combine(fighting);
    this.bench.length = BENCH_SIZE;
    for (let b = 0; b < BENCH_SIZE; b++) if (this.bench[b] === undefined) this.bench[b] = null;
    return merged ?? piece;
  }

  /**
   * Three of a kind at one star become one at the next, where the board copy
   * stood (else the first bench copy's slot); a new trio of the result goes on.
   */
  combine(fighting: boolean): Piece | null {
    let last: Piece | null = null;
    for (;;) {
      let trio: Piece[] | null = null;
      for (const star of [1, 2]) {
        const groups = new Map<string, Piece[]>();
        for (const p of this.all()) {
          if (p.star !== star || (fighting && !this.bench.includes(p))) continue;
          groups.set(p.key, [...(groups.get(p.key) ?? []), p]);
        }
        for (const list of groups.values()) if (!trio && list.length >= 3) trio = list.slice(0, 3);
        if (trio) break;
      }
      if (!trio) return last;
      const onBoard = trio.find((p) => 'cell' in (this.where(p) ?? {}));
      const spot = this.where(onBoard ?? trio[0]);
      const up: Piece = { id: nextId++, key: trio[0].key, star: trio[0].star + 1, look: (onBoard ?? trio[0]).look };
      for (const p of trio) this.remove(p);
      if (spot && 'cell' in spot) this.board.set(spot.cell, up);
      else this.bench[spot && 'bench' in spot ? spot.bench : this.bench.indexOf(null)] = up;
      last = up;
    }
  }

  /** Take a piece off the board or bench (it goes nowhere). */
  private remove(p: Piece): void {
    const b = this.bench.indexOf(p);
    if (b >= 0) this.bench[b] = null;
    for (const [k, v] of this.board) if (v === p) this.board.delete(k);
  }

  /** Sell a piece: its gold back, its copies back to the pool. */
  sell(p: Piece): number {
    const value = sellValue(p);
    const copies = p.star === 3 ? 9 : p.star === 2 ? 3 : 1;
    this.pool.set(p.key, (this.pool.get(p.key) ?? 0) + copies);
    this.remove(p);
    this.gold += value;
    return value;
  }

  where(p: Piece): { bench: number } | { cell: number } | null {
    const b = this.bench.indexOf(p);
    if (b >= 0) return { bench: b };
    for (const [k, v] of this.board) if (v === p) return { cell: k };
    return null;
  }

  /** Move a piece to a bench slot or a board cell, swapping with whatever is there. False if the board is full. */
  move(p: Piece, to: { bench: number } | { cell: number }): boolean {
    const from = this.where(p);
    if (!from) return false;
    const other = 'bench' in to ? this.bench[to.bench] : (this.board.get(to.cell) ?? null);
    if (other === p) return true;
    // Onto the board from the bench, into an empty cell, needs room under the cap.
    if ('cell' in to && 'bench' in from && !other && this.board.size >= this.cap) return false;
    this.remove(p);
    if (other) this.remove(other);
    const put = (q: Piece, at: { bench: number } | { cell: number }) => {
      if ('bench' in at) this.bench[at.bench] = q;
      else this.board.set(at.cell, q);
    };
    put(p, to);
    if (other) put(other, from);
    return true;
  }

  /** Round income: base, interest, and a streak's bonus. */
  income(): number {
    const interest = Math.min(INTEREST_MAX, Math.floor(this.gold / INTEREST_STEP));
    const s = Math.abs(this.streak);
    const streak = s >= 5 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0;
    return INCOME + interest + streak;
  }

  /** A fight's result for this player: streaks, gold, the win's extra gold, and damage taken. */
  settle(won: boolean | null, damage: number): void {
    if (won === true) this.streak = this.streak > 0 ? this.streak + 1 : 1;
    else if (won === false) this.streak = this.streak < 0 ? this.streak - 1 : -1;
    this.hp = Math.max(0, this.hp - damage);
  }

  /** Before a round's planning: gold in, xp, a fresh shop (unless it's frozen). */
  startRound(round: number, wonLast: boolean): void {
    this.gold += round === 1 ? 5 : this.income() + (wonLast ? 1 : 0);
    if (round > 1) this.gainXp(2);
    if (!this.frozen || round === 1) this.roll();
  }

  /**
   * Fill empty places on the board from the bench, best first, when the
   * player left room: nobody fights a round short by forgetting a hero.
   */
  autoFill(): void {
    while (this.board.size < this.cap) {
      const best = this.bench
        .map((p, i) => ({ p, i }))
        .filter((x): x is { p: Piece; i: number } => !!x.p)
        .sort((a, b) => power(b.p) - power(a.p))[0];
      if (!best) return;
      const cell = freeCell(this, unitDef(best.p.key).range > 1);
      if (cell === null) return;
      this.bench[best.i] = null;
      this.board.set(cell, best.p);
    }
  }
}

/** A rough worth of a piece, for choosing (the AI, and filling an empty board). */
export function power(p: Piece): number {
  const d = unitDef(p.key);
  return d.cost * (p.star === 3 ? 9 : p.star === 2 ? 3 : 1);
}

/** A free cell: the front rows for fighters, the back for ranged heroes, from the middle out. */
function freeCell(pl: AutoPlayer, back: boolean): number | null {
  const front = Array.from({ length: ROWS - HALF }, (_, i) => HALF + i);
  const rows = back ? front.reverse() : front;
  const mid = (COLS - 1) / 2;
  const cols = Array.from({ length: COLS }, (_, i) => i).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  for (const r of rows) for (const c of cols) if (!pl.board.has(cellKey(c, r))) return cellKey(c, r);
  return null;
}

/**
 * The practice opponent's turn: buy toward a star-up or its strongest
 * traits, level up on a schedule and when rich, keep its interest, then set
 * out its best pieces (fighters in front, ranged behind).
 */
export function aiPlan(pl: AutoPlayer, round: number): void {
  const want = (key: string): number => {
    const d = unitDef(key);
    const owned = pl.all().filter((p) => p.key === key).length;
    const traits = pl.traits();
    const synergy = traits.filter((t) => t.id === d.origin || t.id === d.role).reduce((a, t) => a + t.count, 0);
    return owned * 4 + synergy * 1.5 + d.cost * 0.8;
  };
  // Level on a schedule, and with spare gold later.
  const levelAt = [0, 0, 3, 5, 8, 12, 16];
  while (pl.level < MAX_LEVEL && round >= levelAt[pl.level + 1] && pl.gold >= 4 + 10 && pl.buyXp()) {
    /* keep levelling */
  }
  for (let pass = 0; pass < 6; pass++) {
    const picks = pl.shop
      .map((k, i) => ({ k, i }))
      .filter((x): x is { k: string; i: number } => !!x.k && unitDef(x.k).cost <= pl.gold)
      .sort((a, b) => want(b.k) - want(a.k));
    const pick = picks[0];
    if (!pick) break;
    // Keep ten gold for interest once past the opening, unless it stars a hero up.
    const pair = pl.all().filter((p) => p.key === pick.k && p.star === 1).length >= 2;
    if (round > 3 && pl.gold - unitDef(pick.k).cost < 10 && !pair && pl.board.size >= pl.cap) break;
    if (!pl.buy(pick.i, false)) {
      // Bench full: sell its weakest spare.
      const spare = pl.bench.filter((p): p is Piece => !!p).sort((a, b) => power(a) - power(b))[0];
      if (!spare || power(spare) >= unitDef(pick.k).cost * 2) break;
      pl.sell(spare);
    }
  }
  // Late on, spend down on rerolls when well off.
  if (round > 6 && pl.gold >= 30 && pl.reroll()) aiPlan(pl, round);
  arrange(pl);
}

/** Put the best pieces on the board, fighters in front and ranged ones behind. */
function arrange(pl: AutoPlayer): void {
  const everyone = pl.all().sort((a, b) => power(b) - power(a));
  const keep = everyone.slice(0, pl.cap);
  const rest = everyone.slice(pl.cap);
  pl.board.clear();
  pl.bench = new Array(BENCH_SIZE).fill(null);
  rest.slice(0, BENCH_SIZE).forEach((p, i) => (pl.bench[i] = p));
  for (const p of keep) {
    const back = unitDef(p.key).range > 1 && heroStats(unitDef(p.key).cls, unitDef(p.key).type).role !== 'tank';
    const cell = freeCell(pl, back);
    if (cell !== null) pl.board.set(cell, p);
  }
}
