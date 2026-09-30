// An Auto Battle fight, worked out tick by tick with no input: two boards go
// in, a winner comes out. Online, both players run it from the same boards and
// seed and see the same fight, so it keeps to sums, products and square roots
// (the same on every machine), a seeded random, a fixed tick and a fixed
// order for everything. The scene reads the heroes' places each frame and the
// events each tick, and draws them; the sim never touches Phaser.

import { defenseFactor, heroStats } from '../stats';
import { traitCounts, unitDef, type Spell, type TraitId, type UnitDef } from './units';

export const COLS = 7;
export const ROWS = 8;
/** Side 0 holds rows 4..7 (the bottom), side 1 rows 0..3. */
export const HALF = 4;
export const TICK = 0.05;
/** Longest a fight runs before it's called a draw. */
export const FIGHT_SECONDS = 32;

/** HP and damage lifts: a hero's stats x these, then x its cost's and star's lift. */
export const HP_MUL = 6;
export const DPS_MUL = 1.5;
/** Each gold of cost past 1 makes a hero this much stronger. */
export const COST_LIFT = 0.12;
export const STAR_LIFT = [0, 1, 1.8, 3.2];
/** Attacks a second, from the type's own rate (a flurry of light blows is drawn as fewer, heavier ones). */
const APS = { scale: 0.42, min: 0.55, max: 1.4 };
/** Seconds of wind-up before a blow in reach lands, and missile speed in cells a second. */
const SWING = 0.22;
const MISSILE_SPEED = 9;
/** Mana for each attack made and each blow taken (Guardians take more from blows). */
const MANA_ATTACK = 10;
const MANA_STRUCK = 3;
const MANA_STRUCK_TANK = 6;
/** How long a cast holds the caster, and when in it the spell goes off. */
const CAST_LOCK = 0.75;
const CAST_AT = 0.4;
const SKILL_LOCK = 0.5;
const SKILL_AT = 0.28;
const CRIT = 1.75;
const SLOW = 1.4;
const BURN_SECONDS = 3;

export interface Placed {
  key: string;
  look: string;
  star: number;
  /** Cell, in side 0's frame (rows 4..7). */
  c: number;
  r: number;
}

export type SimEvent =
  | { t: 'attack'; u: number; to: number; anim: string; missile: boolean; land: number }
  | { t: 'hit'; u: number; by: number; amt: number; crit: boolean; spell: boolean }
  | { t: 'miss'; u: number }
  | { t: 'heal'; u: number; amt: number }
  | { t: 'shield'; u: number; amt: number }
  | { t: 'cast'; u: number; ult: boolean; spell: Spell; x: number; y: number; to: number; land: number }
  | { t: 'spell'; u: number; ult: boolean; spell: Spell; x: number; y: number; hits: number[]; path?: number[] }
  | { t: 'leap'; u: number; fc: number; fr: number }
  | { t: 'knock'; u: number }
  | { t: 'stun'; u: number; sec: number }
  | { t: 'die'; u: number };

export interface SimUnit {
  uid: number;
  side: 0 | 1;
  def: UnitDef;
  look: string;
  star: number;
  c: number;
  r: number;
  /** Where a step began, and how far through it (0..1) the hero is. */
  fc: number;
  fr: number;
  step: number;
  stepDur: number;
  hp: number;
  maxHp: number;
  shield: number;
  dmg: number;
  aps: number;
  armor: number;
  mana: number;
  maxMana: number;
  alive: boolean;
  target: number;
  atkT: number;
  skillT: number;
  lockT: number;
  stunT: number;
  slowT: number;
  dodgeT: number;
  hasteT: number;
  haste: number;
  burnT: number;
  burnDps: number;
  burnBy: number;
  crit: number;
  twice: number;
  steal: number;
  spellMul: number;
  atkMul: number;
  regen: number;
  swing: number;
  /** Which way it last looked, in cells. */
  lookC: number;
  lookR: number;
  /** Damage dealt this fight, for the tally. */
  dealt: number;
}

interface Pending {
  at: number;
  seq: number;
  run: () => void;
}

/** A small seeded random (mulberry32): the same numbers everywhere from the same seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const secs = (s: number) => Math.max(1, Math.round(s / TICK));

/** A board's cell in the other side's frame. */
export const mirror = (c: number, r: number): [number, number] => [COLS - 1 - c, ROWS - 1 - r];

/** Trait levels for a board (by different heroes). */
function traitLevels(board: Placed[]): Map<TraitId, number> {
  return new Map(traitCounts(board.map((p) => p.key)).map((t) => [t.id, t.level]));
}

export class Battle {
  readonly units: SimUnit[] = [];
  tick = 0;
  over = false;
  /** 0 or 1, or -1 for a draw. */
  winner = -1;
  private readonly rand: () => number;
  private queue: Pending[] = [];
  private seq = 0;
  private cells: (SimUnit | null)[] = new Array(COLS * ROWS).fill(null);
  private events: SimEvent[] = [];
  private regenT = 0;

  /** `boards[0]` fights from the bottom, `boards[1]` from the top; both are given in their own (bottom) frame. */
  constructor(boards: [Placed[], Placed[]], seed: number) {
    this.rand = rng(seed);
    boards.forEach((board, side) => {
      const traits = traitLevels(board);
      const lvl = (t: TraitId) => traits.get(t) ?? 0;
      // Placing order is by cell, so both players build the same list.
      const sorted = [...board].sort((a, b) => a.r - b.r || a.c - b.c);
      for (const p of sorted) {
        const [c, r] = side === 0 ? [p.c, p.r] : mirror(p.c, p.r);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS || this.at(c, r)) continue;
        const u = this.make(p, side as 0 | 1, c, r, lvl);
        this.units.push(u);
        this.cells[r * COLS + c] = u;
      }
    });
    this.checkEnd();
  }

  private make(p: Placed, side: 0 | 1, c: number, r: number, lvl: (t: TraitId) => number): SimUnit {
    const def = unitDef(p.key);
    const s = heroStats(def.cls, def.type);
    const star = Math.max(1, Math.min(3, p.star | 0));
    const lift = (1 + COST_LIFT * (def.cost - 1)) * STAR_LIFT[star];
    const has = (t: TraitId) => def.origin === t || def.role === t;
    const pick = (t: TraitId, a: number, b: number) => (has(t) ? [0, a, b][lvl(t)] : 0);
    const team = (t: TraitId, a: number, b: number) => [0, a, b][lvl(t)];
    const maxHp = Math.round(s.hp * HP_MUL * lift * (1 + pick('tank', 0.25, 0.6)));
    const aps = Math.min(APS.max, Math.max(APS.min, s.rate * APS.scale)) * (1 + pick('wild', 0.2, 0.45));
    const dps = s.damage * s.rate * DPS_MUL * lift;
    return {
      uid: this.units.length,
      side,
      def,
      look: p.look,
      star,
      c,
      r,
      fc: c,
      fr: r,
      step: 1,
      stepDur: 1,
      hp: maxHp,
      maxHp,
      shield: Math.round(maxHp * pick('order', 0.2, 0.45)),
      dmg: dps,
      aps,
      armor: s.defense + pick('forged', 30, 70),
      mana: team('caster', 20, 45),
      maxMana: def.mana,
      alive: true,
      target: -1,
      // Heroes spread their first blows a little, so a board doesn't strike as one.
      atkT: secs(0.25 + (c % 3) * 0.08),
      skillT: secs(def.skill.cd * 0.45),
      lockT: 0,
      stunT: 0,
      slowT: 0,
      dodgeT: 0,
      hasteT: 0,
      haste: 0,
      burnT: 0,
      burnDps: 0,
      burnBy: -1,
      crit: pick('shadow', 0.25, 0.45),
      twice: pick('blade', 0.25, 0.5),
      steal: pick('melee', 0.15, 0.3),
      spellMul: 1 + pick('arcane', 0.25, 0.6),
      atkMul: 1 + pick('ranged', 0.2, 0.5),
      regen: team('show', 0.015, 0.03),
      swing: 0,
      lookC: 0,
      lookR: side === 0 ? -1 : 1,
      dealt: 0,
    };
  }

  private at(c: number, r: number): SimUnit | null {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return this.cells[r * COLS + c];
  }

  private free(c: number, r: number): boolean {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && !this.cells[r * COLS + c];
  }

  private moveTo(u: SimUnit, c: number, r: number, dur: number): void {
    this.cells[u.r * COLS + u.c] = null;
    u.fc = u.c;
    u.fr = u.r;
    u.c = c;
    u.r = r;
    u.step = 0;
    u.stepDur = dur;
    this.cells[r * COLS + c] = u;
  }

  /** The hero's drawn place, in cells (partway through a step). */
  static pos(u: SimUnit, sub = 0): { x: number; y: number } {
    const k = u.stepDur > 0 ? Math.min(1, (u.step + sub) / u.stepDur) : 1;
    return { x: u.fc + (u.c - u.fc) * k, y: u.fr + (u.r - u.fr) * k };
  }

  private later(delay: number, run: () => void): void {
    this.queue.push({ at: this.tick + Math.max(1, delay), seq: this.seq++, run });
  }

  private emit(e: SimEvent): void {
    this.events.push(e);
  }

  /** Run one tick; returns what happened in it. */
  step(): SimEvent[] {
    this.events = [];
    if (this.over) return this.events;
    this.tick++;
    // Delayed blows land first, in the order they were thrown.
    if (this.queue.length) {
      const due = this.queue.filter((p) => p.at <= this.tick).sort((a, b) => a.at - b.at || a.seq - b.seq);
      if (due.length) {
        this.queue = this.queue.filter((p) => p.at > this.tick);
        for (const p of due) p.run();
      }
    }
    this.regenT++;
    const regen = this.regenT % secs(1) === 0;
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.step < u.stepDur) u.step++;
      if (u.burnT > 0) {
        u.burnT--;
        if (u.burnT % secs(0.5) === 0) this.damage(this.units[u.burnBy], u, u.burnDps * 0.5, 'dot');
        if (!u.alive) continue;
      }
      if (regen && u.regen > 0 && u.hp < u.maxHp) this.heal(u, u.maxHp * u.regen, false);
      if (u.slowT > 0) u.slowT--;
      if (u.dodgeT > 0) u.dodgeT--;
      if (u.hasteT > 0 && --u.hasteT === 0) u.haste = 0;
      if (u.skillT > 0) u.skillT--;
      if (u.atkT > 0) u.atkT--;
      if (u.stunT > 0) {
        u.stunT--;
        continue;
      }
      if (u.lockT > 0) {
        u.lockT--;
        continue;
      }
      if (u.step < u.stepDur) continue;
      this.think(u);
    }
    this.checkEnd();
    if (!this.over && this.tick >= secs(FIGHT_SECONDS)) {
      this.over = true;
      this.winner = -1;
    }
    return this.events;
  }

  private checkEnd(): void {
    const alive = [0, 0];
    for (const u of this.units) if (u.alive) alive[u.side]++;
    if (alive[0] && alive[1]) return;
    this.over = true;
    this.winner = alive[0] ? 0 : alive[1] ? 1 : -1;
  }

  private dist(a: { c: number; r: number }, b: { c: number; r: number }): number {
    return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
  }

  private d2(a: { c: number; r: number }, x: number, y: number): number {
    return (a.c - x) * (a.c - x) + (a.r - y) * (a.r - y);
  }

  private foes(u: SimUnit): SimUnit[] {
    return this.units.filter((o) => o.alive && o.side !== u.side);
  }

  private nearest(u: SimUnit): SimUnit | null {
    let best: SimUnit | null = null;
    let bd = 1e9;
    for (const o of this.foes(u)) {
      const d = this.dist(u, o) * 100 + this.d2(u, o.c, o.r);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  private think(u: SimUnit): void {
    let t = u.target >= 0 ? this.units[u.target] : null;
    if (!t || !t.alive) t = null;
    // Stick with a target in reach; otherwise go for whoever is nearest now.
    if (!t || this.dist(u, t) > u.def.range) {
      const n = this.nearest(u);
      if (n && (!t || this.dist(u, n) < this.dist(u, t))) t = n;
    }
    if (!t) return;
    u.target = t.uid;
    const d = this.dist(u, t);
    if (d <= u.def.range) {
      u.lookC = t.c - u.c;
      u.lookR = t.r - u.r;
      if (u.mana >= u.maxMana) return this.cast(u, u.def.ult, true, t);
      if (u.skillT <= 0 && this.skillReady(u, t)) return this.cast(u, u.def.skill, false, t);
      if (u.atkT <= 0) this.attack(u, t);
      return;
    }
    this.walk(u, t);
  }

  /** A self-centred skill waits until a foe is close enough to be caught in it. */
  private skillReady(u: SimUnit, t: SimUnit): boolean {
    const s = u.def.skill;
    if (s.kind === 'nova') return this.foes(u).some((o) => this.d2(u, o.c, o.r) <= (s.r ?? 1) * (s.r ?? 1));
    if (s.kind === 'mend') return u.hp < u.maxHp * 0.85 || !!s.haste || this.dist(u, t) <= u.def.range;
    return true;
  }

  /**
   * One step along the shortest way (round others, over free cells) to a cell
   * in reach of a foe: `t` when it can be reached as soon as any, else
   * whichever foe the way reaches first.
   */
  private walk(u: SimUnit, t: SimUnit): void {
    const foes = this.foes(u);
    const inReach = (c: number, r: number): SimUnit | null => {
      if (Math.max(Math.abs(c - t.c), Math.abs(r - t.r)) <= u.def.range) return t;
      for (const o of foes) if (Math.max(Math.abs(c - o.c), Math.abs(r - o.r)) <= u.def.range) return o;
      return null;
    };
    const n = COLS * ROWS;
    const prev = new Int16Array(n).fill(-1);
    const start = u.r * COLS + u.c;
    prev[start] = start;
    const queue = [start];
    let goal = -1;
    let reached: SimUnit | null = null;
    for (let qi = 0; qi < queue.length && goal < 0; qi++) {
      const cur = queue[qi];
      const cc = cur % COLS;
      const cr = (cur - cc) / COLS;
      // Straight steps before diagonal ones, so paths look purposeful.
      for (const [dc, dr] of NEIGHBOURS) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (!this.free(nc, nr)) continue;
        const k = nr * COLS + nc;
        if (prev[k] >= 0) continue;
        prev[k] = cur;
        reached = inReach(nc, nr);
        if (reached) {
          goal = k;
          break;
        }
        queue.push(k);
      }
    }
    // Boxed in: wait for the way to open.
    if (goal < 0 || !reached) return;
    u.target = reached.uid;
    let k = goal;
    while (prev[k] !== start) k = prev[k];
    const nc = k % COLS;
    const nr = (k - nc) / COLS;
    const s = heroStats(u.def.cls, u.def.type);
    const diag = nc !== u.c && nr !== u.r ? 1.3 : 1;
    const dur = secs(Math.min(0.7, Math.max(0.34, 26 / s.speed)) * diag);
    u.lookC = nc - u.c;
    u.lookR = nr - u.r;
    this.moveTo(u, nc, nr, dur);
  }

  private interval(u: SimUnit): number {
    const aps = u.aps * (1 + u.haste);
    return secs((u.slowT > 0 ? SLOW : 1) / aps);
  }

  private attack(u: SimUnit, t: SimUnit): void {
    const anims = u.def.attack;
    const anim = anims[u.swing++ % anims.length];
    u.atkT = this.interval(u);
    u.lockT = Math.min(u.atkT - 1, secs(0.2));
    u.mana = Math.min(u.maxMana, u.mana + MANA_ATTACK);
    const far = !!u.def.missile;
    const land = far ? secs(SWING * 0.6 + Math.sqrt(this.d2(u, t.c, t.r)) / MISSILE_SPEED) : secs(SWING);
    this.emit({ t: 'attack', u: u.uid, to: t.uid, anim, missile: far, land });
    const hit = u.dmg / u.aps;
    const strike = () => {
      if (!u.alive || !t.alive) return;
      this.damage(u, t, hit * u.atkMul, 'atk');
    };
    this.later(land, strike);
    if (u.twice > 0 && this.rand() < u.twice) this.later(land + secs(0.15), strike);
  }

  /** Where a spell goes: a spot (in cells) and the foe or ally it's for. */
  private aim(u: SimUnit, s: Spell, t: SimUnit): { x: number; y: number; to: SimUnit | null } {
    const foes = this.foes(u);
    switch (s.aim) {
      case 'self':
        return { x: u.c, y: u.r, to: null };
      case 'weak': {
        const w = foes.reduce<SimUnit | null>((b, o) => (!b || o.hp < b.hp - 1e-6 ? o : b), null) ?? t;
        return { x: w.c, y: w.r, to: w };
      }
      case 'far': {
        const f = foes.reduce<SimUnit | null>((b, o) => (!b || this.d2(u, o.c, o.r) > this.d2(u, b.c, b.r) ? o : b), null) ?? t;
        return { x: f.c, y: f.r, to: f };
      }
      case 'ally': {
        const a = this.units.filter((o) => o.alive && o.side === u.side).reduce((b, o) => (o.hp / o.maxHp < b.hp / b.maxHp ? o : b), u);
        return { x: a.c, y: a.r, to: a };
      }
      case 'crowd': {
        // The foe with the most others round it (within the spell's reach), nearer ones first on a tie.
        const r2 = (s.r ?? 1.5) * (s.r ?? 1.5);
        let best = t;
        let score = -1;
        for (const o of foes) {
          let n = 0;
          for (const p of foes) if (this.d2(o, p.c, p.r) <= r2) n++;
          const sc = n * 1000 - this.d2(u, o.c, o.r);
          if (sc > score) {
            score = sc;
            best = o;
          }
        }
        return { x: best.c, y: best.r, to: best };
      }
      default:
        return { x: t.c, y: t.r, to: t };
    }
  }

  private cast(u: SimUnit, s: Spell, ult: boolean, t: SimUnit): void {
    const a = this.aim(u, s, t);
    if (ult) u.mana = 0;
    else u.skillT = secs((s as Spell & { cd: number }).cd ?? 6);
    u.lockT = secs(ult ? CAST_LOCK : SKILL_LOCK);
    const at = secs(ult ? CAST_AT : SKILL_AT);
    const land = at + (s.delay && s.kind === 'blast' ? secs(s.delay) : 0);
    if (a.to) {
      u.lookC = a.to.c - u.c;
      u.lookR = a.to.r - u.r;
    }
    this.emit({ t: 'cast', u: u.uid, ult, spell: s, x: a.x, y: a.y, to: a.to?.uid ?? -1, land });
    this.later(land, () => {
      if (u.alive) this.resolve(u, s, ult, a.x, a.y, a.to);
    });
  }

  /** A spell's damage to one foe. */
  private spellHit(u: SimUnit, s: Spell, ult: boolean): number {
    return u.dmg * s.dmg * (ult ? u.spellMul : 1);
  }

  private resolve(u: SimUnit, s: Spell, ult: boolean, x: number, y: number, to: SimUnit | null): void {
    const hits: SimUnit[] = [];
    const foes = this.foes(u);
    const within = (cx: number, cy: number, r: number) => foes.filter((o) => this.d2(o, cx, cy) <= r * r + 0.01);
    let path: number[] | undefined;
    switch (s.kind) {
      case 'bolt':
        if (to?.alive) hits.push(to);
        break;
      case 'nova':
        hits.push(...within(u.c, u.r, s.r ?? 1.5));
        break;
      case 'blast':
        hits.push(...within(x, y, s.r ?? 1));
        break;
      case 'beam': {
        // Everything within a cell of the line from the caster through the spot, `r` long.
        const dx = x - u.c;
        const dy = y - u.r;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const L = s.r ?? 4;
        for (const o of foes) {
          const px = o.c - u.c;
          const py = o.r - u.r;
          const along = px * ux + py * uy;
          if (along < 0.2 || along > L + 0.5) continue;
          const off = Math.abs(px * uy - py * ux);
          if (off <= 0.75) hits.push(o);
        }
        x = u.c + ux * L;
        y = u.r + uy * L;
        break;
      }
      case 'leap':
      case 'dash': {
        const goal = to?.alive ? to : this.nearest(u);
        if (!goal) break;
        const spot = this.landing(u, goal, s.kind === 'dash');
        if (spot) {
          const fc = u.c;
          const fr = u.r;
          this.moveTo(u, spot[0], spot[1], secs(0.18));
          u.fc = fc;
          u.fr = fr;
          this.emit({ t: 'leap', u: u.uid, fc, fr });
          if (s.kind === 'dash') {
            // Cut through everyone crossed on the way.
            const dx = u.c - fc;
            const dy = u.r - fr;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            for (const o of foes) {
              if (o === goal) continue;
              const px = o.c - fc;
              const py = o.r - fr;
              const along = (px * dx + py * dy) / len;
              if (along > 0 && along < len && Math.abs(px * dy - py * dx) / len <= 0.75) hits.push(o);
            }
          }
        }
        if (s.kind === 'dash') hits.push(goal);
        else hits.push(...within(u.c, u.r, s.r ?? 1.2));
        x = goal.c;
        y = goal.r;
        u.target = goal.uid;
        break;
      }
      case 'chain': {
        let cur = to?.alive ? to : this.nearest(u);
        const n = (s.n ?? 3) + 1;
        path = [];
        while (cur && hits.length < n) {
          hits.push(cur);
          path.push(cur.uid);
          const from: SimUnit = cur;
          cur = foes.filter((o) => !hits.includes(o) && this.d2(from, o.c, o.r) <= 2.5 * 2.5).sort((a, b) => this.d2(from, a.c, a.r) - this.d2(from, b.c, b.r) || a.uid - b.uid)[0] ?? null;
        }
        break;
      }
      case 'rain': {
        const pool = s.r ? within(x, y, s.r) : foes;
        const list = pool.length ? pool : foes;
        const n = s.n ?? 6;
        const each = this.spellHit(u, s, ult) / n;
        const span = s.delay ?? 1.2;
        path = [];
        for (let i = 0; i < n && list.length; i++) {
          const o = list[Math.floor(this.rand() * list.length)];
          path.push(o.uid);
          this.later(secs((span * i) / n), () => {
            if (!u.alive || !o.alive) return;
            const dealt = this.damage(u, o, each, 'spell');
            if (s.drain) this.heal(u, dealt * s.drain, true);
            this.effects(u, s, o, ult);
          });
        }
        this.emit({ t: 'spell', u: u.uid, ult, spell: s, x, y, hits: [], path });
        return;
      }
      case 'mend': {
        const r = s.r ?? 0;
        const allies = this.units.filter((o) => o.alive && o.side === u.side && (o === u || (r > 0 && this.d2(o, u.c, u.r) <= r * r + 0.01)));
        for (const o of allies) {
          if (s.heal) this.heal(o, o.maxHp * s.heal * (ult ? u.spellMul : 1), true);
          if (s.shield) this.barrier(o, u.maxHp * s.shield);
          if (s.haste) {
            o.haste = Math.max(o.haste, s.haste);
            o.hasteT = Math.max(o.hasteT, secs(s.dur ?? 4));
          }
        }
        this.emit({ t: 'spell', u: u.uid, ult, spell: s, x, y, hits: allies.map((o) => o.uid) });
        return;
      }
    }
    this.emit({ t: 'spell', u: u.uid, ult, spell: s, x, y, hits: hits.map((o) => o.uid), path });
    // A chain weakens a little with each jump.
    let amt = this.spellHit(u, s, ult);
    let drained = 0;
    for (const o of hits) {
      drained += this.damage(u, o, amt, 'spell');
      this.effects(u, s, o, ult);
      if (s.kind === 'chain') amt *= 0.85;
    }
    if (s.drain && drained > 0) this.heal(u, drained * s.drain, true);
    if (s.shield) this.barrier(u, u.maxHp * s.shield);
    if (s.dodge) u.dodgeT = Math.max(u.dodgeT, secs(s.dodge));
    if (s.haste) {
      u.haste = Math.max(u.haste, s.haste);
      u.hasteT = Math.max(u.hasteT, secs(s.dur ?? 4));
    }
  }

  /** A spell's lasting touches on one foe: stun, slow, burn, a shove. */
  private effects(u: SimUnit, s: Spell, o: SimUnit, ult: boolean): void {
    if (!o.alive) return;
    if (s.stun) {
      o.stunT = Math.max(o.stunT, secs(s.stun));
      this.emit({ t: 'stun', u: o.uid, sec: s.stun });
    }
    if (s.slow) o.slowT = Math.max(o.slowT, secs(s.slow));
    if (s.burn) {
      const dps = (u.dmg * s.burn * (ult ? u.spellMul : 1)) / BURN_SECONDS;
      if (dps >= o.burnDps || o.burnT <= 0) {
        o.burnDps = dps;
        o.burnBy = u.uid;
      }
      o.burnT = secs(BURN_SECONDS);
    }
    if (s.knock) this.shove(u, o, s.knock);
  }

  /** Throw `o` straight away from `u`, a cell at a time while the way is free. */
  private shove(u: SimUnit, o: SimUnit, cells: number): void {
    const sc = Math.sign(o.c - u.c);
    const sr = Math.sign(o.r - u.r) || (o.side === 0 ? 1 : -1);
    let moved = false;
    for (let i = 0; i < cells; i++) {
      const nc = o.c + sc;
      const nr = o.r + sr;
      if (!this.free(nc, nr)) break;
      const fc = moved ? o.fc : o.c;
      const fr = moved ? o.fr : o.r;
      this.moveTo(o, nc, nr, secs(0.2));
      o.fc = fc;
      o.fr = fr;
      moved = true;
    }
    if (moved) this.emit({ t: 'knock', u: o.uid });
  }

  /** A free cell beside `goal` (behind it for a dash), nearest the caster's way in. */
  private landing(u: SimUnit, goal: SimUnit, behind: boolean): [number, number] | null {
    let best: [number, number] | null = null;
    let bs = 1e9;
    const bx = goal.c + Math.sign(goal.c - u.c);
    const by = goal.r + Math.sign(goal.r - u.r);
    for (const [dc, dr] of NEIGHBOURS) {
      const c = goal.c + dc;
      const r = goal.r + dr;
      if (!this.free(c, r) && !(c === u.c && r === u.r)) continue;
      const score = behind ? (c - bx) * (c - bx) + (r - by) * (r - by) : this.d2(u, c, r);
      if (score < bs) {
        bs = score;
        best = [c, r];
      }
    }
    return best;
  }

  /** Deal a blow; returns what got through Defense. */
  private damage(src: SimUnit | undefined, dst: SimUnit, amount: number, kind: 'atk' | 'spell' | 'dot'): number {
    if (!dst.alive) return 0;
    if (dst.dodgeT > 0 && kind !== 'dot') {
      this.emit({ t: 'miss', u: dst.uid });
      return 0;
    }
    let crit = false;
    if (src && kind !== 'dot' && src.crit > 0 && this.rand() < src.crit) {
      crit = true;
      amount *= CRIT;
    }
    amount *= defenseFactor(dst.armor);
    let left = amount;
    if (dst.shield > 0) {
      const take = Math.min(dst.shield, left);
      dst.shield -= take;
      left -= take;
    }
    dst.hp -= left;
    if (src) src.dealt += amount;
    if (kind !== 'dot') dst.mana = Math.min(dst.maxMana, dst.mana + (dst.def.role === 'tank' ? MANA_STRUCK_TANK : MANA_STRUCK));
    this.emit({ t: 'hit', u: dst.uid, by: src?.uid ?? -1, amt: Math.max(1, Math.round(amount)), crit, spell: kind !== 'atk' });
    // Fighters mend from their blows (half as much from spells).
    if (src?.alive && src.steal > 0 && kind !== 'dot') this.heal(src, amount * (kind === 'atk' ? src.steal : src.steal * 0.5), false);
    if (dst.hp <= 0) {
      dst.hp = 0;
      dst.alive = false;
      this.cells[dst.r * COLS + dst.c] = null;
      this.emit({ t: 'die', u: dst.uid });
    }
    return amount;
  }

  private heal(u: SimUnit, amt: number, show: boolean): void {
    if (!u.alive || amt <= 0) return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amt);
    if (show && u.hp - before >= 1) this.emit({ t: 'heal', u: u.uid, amt: Math.round(u.hp - before) });
  }

  private barrier(u: SimUnit, amt: number): void {
    if (!u.alive) return;
    u.shield += amt;
    this.emit({ t: 'shield', u: u.uid, amt: Math.round(amt) });
  }

  /** Run to the end (the host's own reckoning, or a fight nobody watches). */
  runToEnd(): void {
    while (!this.over) this.step();
  }

  /** The winners still standing, for the loser's damage. */
  survivors(): SimUnit[] {
    return this.units.filter((u) => u.alive && u.side === this.winner);
  }
}

const NEIGHBOURS: [number, number][] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
