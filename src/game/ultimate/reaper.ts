import type Phaser from 'phaser';
import { sound } from '../../audio';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { ReapSoul } from '../Reaping';
import { bloom, clamp01, dither, drag, easeOut, flare, Fx, GROUND, hash, pool, ring, rune, type Ink, type Pal } from './ink';
import type { Cast, IconPainter } from './types';

// The Reaper's Special, Harvest: a huge spectral scythe, a ghost of his own,
// sweeps flat round him twice at chest height, its blade leaving a crescent
// of soul-light, and draws every foe near him inwards as it comes round,
// cutting each it passes. Then it rises and reaps them all at once: a foe
// already near its end (under a quarter of its health) is executed with a
// far heavier blow, and souls burst from every foe struck and fly back into
// him, healing him. It follows him as he walks. The Catrina reaps in
// marigold and rose, her souls flying as petals.

/** The great scythe's reach round him, and how far out it starts drawing foes in. */
const R = 50;
const PULL_R = R + 26;
/** It draws them in at this pace (px/s) while it turns. */
const PULL = 38;
/** Two whole turns over this long. */
const TURNS = 2;
const SWEEP_MS = 1250;
/** Each pass of the blade cuts a foe for this (a foe is cut once a pass). */
const PASS_DAMAGE = 16;
/** The last reap: its blow on everything in reach, and the execution of the nearly dead. */
const REAP_AT = 1420;
const REAP_DAMAGE = 14;
const EXECUTE_BELOW = 0.25;
const EXECUTE_DAMAGE = 48;
/** Souls burst from every foe the last reap strikes, each healing this, no more than `cap` in all. */
const SOUL_HEAL = 2;
const SOUL_CAP = 12;
const LIFE = 2100;
/** The pool under him opens over this long. */
const OPEN = 260;
/** The scythe sweeps at about chest height. */
const CHEST = 12;
/** The blade: how far it runs on round the circle (radians), and how far it curls in. */
const BLADE_ARC = 0.62;
const BLADE_CURL = 16;

const TAU = Math.PI * 2;

/** A foe's health as a share of its whole, where it can be read (monsters); 1 otherwise. */
function lifeLeft(h: Hurtbox): number {
  const m = h as Hurtbox & { hp?: number; maxHp?: number };
  return typeof m.hp === 'number' && typeof m.maxHp === 'number' && m.maxHp > 0 ? m.hp / m.maxHp : 1;
}

export class Harvest extends Fx {
  private ground: Ink;
  private back: Ink;
  private front: Ink;
  private lamp: Phaser.GameObjects.Light;
  /** When each foe was last cut by a pass. */
  private cutAt = new Map<Hurtbox, number>();
  private start: number;
  private prevA: number;
  private reaped = false;
  private turnsHeard = 0;
  private petals: boolean;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, LIFE);
    const w = R * 2 + 40;
    const h = Math.ceil(R * 2 * GROUND) + 60;
    this.ground = this.ink(w, Math.ceil(R * 2 * GROUND) + 24);
    this.back = this.ink(w, h);
    this.front = this.ink(w, h);
    this.lamp = this.light(c.hero.x, c.hero.y - CHEST, 130, c.pal.light, 0);
    this.petals = c.look === 'catrina';
    // It comes round from behind him, so its first pass sweeps out ahead.
    this.start = Math.atan2(c.dy, c.dx) + Math.PI;
    this.prevA = this.start;
    sound.reapHarvest(world.pan(c.hero.x), 0);
  }

  /** The blade's angle round him at time t. */
  private angle(t: number): number {
    // It gathers speed, then holds it: a heavy thing set turning.
    const k = clamp01(t / SWEEP_MS);
    const s = k < 0.25 ? 2 * k * k : k - 0.125;
    return this.start + (TAU * TURNS * s) / 0.875;
  }

  protected step(dt: number): void {
    const { t, c } = this;
    const hx = c.hero.x;
    const hy = c.hero.y;
    const a = this.angle(t);
    if (t < SWEEP_MS) {
      for (const h of this.world.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - hx, (b.y - hy) / GROUND) <= PULL_R + b.radius)) drag(h, hx, hy, PULL, dt);
      this.passes(this.prevA, a);
      const turn = Math.floor((a - this.start) / TAU) + 1;
      if (turn > this.turnsHeard && turn <= TURNS) {
        this.turnsHeard = turn;
        sound.reapHarvest(this.world.pan(hx), turn);
      }
    }
    this.prevA = a;
    if (!this.reaped && t >= REAP_AT) this.reap();
    this.draw(a);
    const glow = t < REAP_AT ? 1.2 + 0.4 * Math.sin(t * 0.02) : 2.8 * (1 - clamp01((t - REAP_AT) / 600));
    this.lamp.setPosition(hx, hy - CHEST);
    this.lamp.intensity = glow * clamp01(t / OPEN);
  }

  /** The blade swept from angle a0 to a1: every foe it passed over within reach is cut, once a pass. */
  private passes(a0: number, a1: number): void {
    const { c, t } = this;
    const hx = c.hero.x;
    const hy = c.hero.y;
    for (const h of this.world.hurtboxesWhere((b) => b.alive)) {
      const dx = h.x - hx;
      const dy = (h.y - hy) / GROUND;
      const d = Math.hypot(dx, dy);
      if (d > R + h.radius + 2) continue;
      const last = this.cutAt.get(h);
      if (last !== undefined && t - last < (SWEEP_MS / TURNS) * 0.6) continue;
      // Up close the blade's sweep is too narrow to miss them.
      const phi = Math.atan2(dy, dx);
      const from = ((a0 - phi) % TAU + TAU) % TAU;
      const span = a1 - a0;
      const behind = TAU - from;
      if (d > 8 && !(behind <= span + 0.2 || from < 0.25)) continue;
      this.cutAt.set(h, t);
      // Struck from outside, so the blow throws it in towards him.
      h.hurt({ damage: PASS_DAMAGE, heavy: false, knock: 40, fromX: h.x + dx * 0.5, fromY: h.y - h.bodyY + dy * 0.3 });
      const p = c.pal;
      this.world.debris([p.core, p.hot, p.mid], h.x, h.y - h.bodyY, 5, h.y + 20, 'burst');
      sound.reapHit(this.world.pan(h.x), false);
    }
  }

  /** The great scythe rises and comes down through them all: the nearly dead are executed, and their souls fly to him. */
  private reap(): void {
    this.reaped = true;
    const { c, world } = this;
    const p = c.pal;
    const hx = c.hero.x;
    const hy = c.hero.y;
    const foes = world.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - hx, (b.y - hy) / GROUND) <= R + b.radius + 4);
    let souls = Math.floor(SOUL_CAP / SOUL_HEAL);
    for (const h of foes) {
      const doomed = lifeLeft(h) < EXECUTE_BELOW;
      h.hurt({ damage: REAP_DAMAGE + (doomed ? EXECUTE_DAMAGE : 0), heavy: true, knock: 90, fromX: hx, fromY: hy - CHEST });
      world.debris([p.core, p.hot, p.mid, p.deep], h.x, h.y - h.bodyY, doomed ? 14 : 7, h.y + 20, 'burst');
      if (doomed) {
        bloom(world, h.x, h.y - h.bodyY, p.hot, 1.4, 360, h.y + 22);
        world.popNumber(Math.round(h.x), Math.round(h.y - h.bodyY * 2) - 8, 'REAPED', p.hot);
      }
      // A soul from each (two from the executed), while there are souls to give.
      for (let k = 0; k < (doomed ? 2 : 1) && souls > 0; k++, souls--) {
        world.addEffect(
          new ReapSoul(world, h.x + (k ? 3 : 0), h.y - h.bodyY - (k ? 3 : 0), c.hero, p, this.petals, () => {
            const v = c.hero.vitals;
            if (v.hp < v.max) v.heal(SOUL_HEAL);
          }),
        );
      }
    }
    sound.reapHarvest(world.pan(hx), 3);
    world.cameras.main.shake(260, 0.003);
    flare(world, hx, hy - CHEST, 170, p.light, 3.2, 600);
    bloom(world, hx, hy - CHEST, p.hot, 2.6, 420, hy + 30);
    world.debris([p.hot, p.mid, p.deep], hx, hy - 4, 20, hy + 10, 'burst');
  }

  private draw(a: number): void {
    const { c, t } = this;
    const p = c.pal;
    const hx = c.hero.x;
    const hy = c.hero.y;
    const open = easeOut(t / OPEN);
    const fade = t < REAP_AT ? 1 : 1 - clamp01((t - REAP_AT - 150) / (LIFE - REAP_AT - 150));

    // On the ground: a pool of dusk under him, a rune turning in it, and the ring the blade keeps to.
    const g = this.ground.begin(hx, hy, 2.5);
    pool(g, hx, hy, R * open, p.deep, p.deep, 0.55 * fade, GROUND, 0.55);
    rune(g, hx, hy, R * 0.55 * open, -t * 0.003, p, 0.7 * fade);
    ring(g, hx, hy, R * open, 0.9, p, 0.6 * fade, GROUND, 0.35, 7);
    if (this.reaped) {
      const k = clamp01((t - REAP_AT) / 450);
      if (k < 1) ring(g, hx, hy, R * (0.3 + 0.9 * easeOut(k)), 3.4 * (1 - k) + 0.8, p, 1 - k);
    }
    g.end();

    const cy = hy - CHEST;
    const bk = this.back.begin(hx, cy, hy - 1);
    const fr = this.front.begin(hx, cy, hy + 30);
    // Split round him: what is north of his chest is behind him.
    const put = (x: number, y: number, col: number, al = 1) => (y < cy ? bk : fr).put(x, y, col, al);
    const at = (ang: number, r: number): [number, number] => [hx + Math.cos(ang) * r, cy + Math.sin(ang) * r * GROUND];

    if (t < SWEEP_MS + 120) {
      const k = clamp01(t / 160) * (t > SWEEP_MS ? 1 - (t - SWEEP_MS) / 120 : 1);
      // Its wake: a crescent of soul-light swept behind the blade, thinning back.
      const wake = 1.5;
      for (let i = 0; i < 40; i++) {
        const u = i / 40;
        const ang = a - u * wake;
        for (let r = R - 13 + u * 6; r <= R + 1; r += 1) {
          const [x, y] = at(ang, r);
          const fall = 1 - u;
          if (dither(Math.round(x), Math.round(y)) > fall * 0.9 * k) continue;
          put(x, y, u < 0.15 ? p.hot : u < 0.45 ? p.mid : p.deep, 0.9);
        }
      }
      this.scythe(put, at, a, k, false);
    } else if (!this.reaped || t < REAP_AT + 220) {
      // It rises: the ghost scythe lifted up over him, then brought down through the ring.
      const k = clamp01((t - SWEEP_MS) / (REAP_AT - SWEEP_MS));
      const down = this.reaped ? clamp01((t - REAP_AT) / 220) : 0;
      const lift = 34 * easeOut(k) * (1 - down);
      const ang = this.angle(SWEEP_MS);
      this.scythe((x, y, col, al) => put(x, y - lift, col, al), at, ang, 1 - down, true);
    }
    bk.end();
    fr.end();
  }

  /**
   * The ghost scythe at angle `a`: a dim snath from near him out to the blade,
   * and the blade running on round the circle and curling in, its edge (the
   * inner side) white-hot. `rise` draws it standing taller (lifted to reap).
   */
  private scythe(put: (x: number, y: number, c: number, a?: number) => void, at: (ang: number, r: number) => [number, number], a: number, k: number, rise: boolean): void {
    if (k <= 0) return;
    const p = this.c.pal;
    const f = Math.floor(this.t / 50);
    for (let r = 7; r <= R; r += 0.7) {
      const [x, y] = at(a, r);
      if (hash(Math.round(r), f, 3) < 0.25) continue;
      put(x, y, p.deep, 0.8 * k);
      put(x, y - 1, p.mid, 0.6 * k);
    }
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      const ang = a + s * BLADE_ARC;
      const r = R - BLADE_CURL * Math.pow(s, 1.6);
      const w = 3.2 * (1 - s) + 0.6;
      for (let o = 0; o <= w; o += 0.6) {
        // Out from the edge: the edge on the inside, the spine on the outside.
        const [x, y] = at(ang, r + o);
        const col = o < 0.8 ? p.core : o < w * 0.55 ? p.hot : p.mid;
        put(x, y + (rise ? -o * 0.6 : 0), col, k);
      }
    }
    // The ring binding the blade to the snath.
    const [bx, by] = at(a, R);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) put(bx + dx, by + dy, dx || dy ? p.mid : p.core, k);
  }
}

export const harvest = (c: Cast): void => c.world.addEffect(new Harvest(c.world, c));

/** Harvest: a great scythe's blade sweeping a ring round a skull, the ring's wake bright behind it. */
export const harvestIcon: IconPainter = (put, p: Pal) => {
  // The ring of its sweep, brightening towards the blade.
  for (let i = 0; i < 40; i++) {
    const q = (i / 40) * Math.PI * 1.7 + Math.PI * 0.55;
    const k = i / 40;
    put(Math.round(8 + Math.cos(q) * 6.6 - 0.5), Math.round(8.5 + Math.sin(q) * 5.6 - 0.5), k > 0.75 ? p.hot : k > 0.4 ? p.mid : p.deep);
  }
  // The blade at the ring's head, curling in.
  const blade: [number, number][] = [[11, 2], [12, 2], [13, 3], [14, 4], [14, 5], [14, 6], [13, 7]];
  for (const [x, y] of blade) put(x, y, p.core);
  for (const [x, y] of [[11, 3], [12, 3], [13, 4], [13, 5]]) put(x, y, p.hot);
  // The skull at the heart of it.
  for (let y = 6; y <= 10; y++) for (let x = 6; x <= 10; x++) if ((x - 8) ** 2 / 6.5 + (y - 8) ** 2 / 6 <= 1) put(x, y, p.hot);
  put(7, 8, 0x000000);
  put(9, 8, 0x000000);
  put(7, 11, p.mid);
  put(9, 11, p.mid);
  put(8, 9, p.deep);
};
