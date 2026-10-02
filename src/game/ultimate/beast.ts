import type Phaser from 'phaser';
import { sound } from '../../audio';
import { BEAST_MOUTH_Y } from '../../art/beast';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, dither, easeIn, easeOut, flare, Fx, ring, strikeGround, type Ink } from './ink';
import type { Cast } from './types';

// The Beastkin's Specials.
//  - Sky Sovereign (the Eagle): a giant spirit eagle stoops out of the sky
//    behind him and swoops low the way he aims, talons raking everything
//    under it, then wheels round and swoops back. Benfica's is Flight of
//    Victory, in red, white and gold.
//  - King's Roar (the Lion): three roars, each wider than the last, a great
//    spirit lion's head roaring in the air over him; the last one throws
//    foes far. Sporting's is Roar of Alvalade, in green and white.
//  - Wrath of the Wyrm (the Dragon): a serpent of living flame pours from
//    his jaws, coils round the spot he aims at, raking what it passes, then
//    dives into it in a blast. Porto's is Fury of the Invicta, burning blue.
//  The creatures of myth wear them in their own colours: the Phoenix's in
//  crimson and gold flame, the Nemean lion's in bronze and gold, the Jade
//  Serpent's in pale jade and gold.

// ---------------------------------------------------------------------------
// Sky Sovereign

const SWOOP = 170;
const PASS_MS = 460;
const TURN_MS = 320;
const EAGLE_Z = 14;
const RAKE_R = 18;
const RAKE_DAMAGE = 30;
/** Half the spirit eagle's wingspan, in pixels. */
const SPAN = 19;

export class SkySovereign extends Fx {
  private g: Ink;
  private lamp: Phaser.GameObjects.Light;
  private struck: Set<Hurtbox>[] = [new Set(), new Set()];
  private trail: { x: number; y: number; a: number }[] = [];
  private readonly ox: number;
  private readonly oy: number;
  private screeched = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, PASS_MS * 2 + TURN_MS + 300);
    // The line it flies: from just behind him out along the aim.
    this.ox = c.x - c.dx * 20;
    this.oy = c.y - c.dy * 16;
    this.g = this.ink(Math.ceil(Math.abs(c.dx) * SWOOP + 170), Math.ceil(Math.abs(c.dy) * SWOOP + 170));
    this.lamp = this.light(c.x, c.y, 90, c.pal.light, 0);
    flare(world, c.x, c.y - 20, 110, c.pal.light, 2.4, 500);
  }

  /** Where the eagle is at time t: its ground point, height and heading. */
  private at(t: number): { x: number; y: number; z: number; a: number; pass: number } {
    const { dx, dy } = this.c;
    const a = Math.atan2(dy, dx);
    const far = { x: this.ox + dx * SWOOP, y: this.oy + dy * SWOOP };
    if (t < PASS_MS) {
      // Stooping in from on high, levelling out low over the ground.
      const k = t / PASS_MS;
      const e = easeOut(k * 1.1);
      return { x: this.ox + dx * SWOOP * e, y: this.oy + dy * SWOOP * e, z: EAGLE_Z + 40 * Math.pow(1 - k, 2), a, pass: 0 };
    }
    if (t < PASS_MS + TURN_MS) {
      // Wheeling round at the far end, rising a little as it banks.
      const k = (t - PASS_MS) / TURN_MS;
      const turn = k * Math.PI;
      const r = 16;
      const cx = far.x - dy * r;
      const cy = far.y + dx * r;
      const ang = a - Math.PI / 2 + turn;
      return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, z: EAGLE_Z + Math.sin(turn) * 10, a: a + turn, pass: -1 };
    }
    const k = clamp01((t - PASS_MS - TURN_MS) / PASS_MS);
    const e = easeIn(k);
    const back = { x: far.x - dy * 32, y: far.y + dx * 32 };
    const tx = this.ox - dy * 32 * (1 - k);
    const ty = this.oy + dx * 32 * (1 - k);
    return { x: back.x + (tx - back.x) * e, y: back.y + (ty - back.y) * e, z: EAGLE_Z + 30 * k * k, a: a + Math.PI, pass: 1 };
  }

  protected step(): void {
    const w = this.world;
    const p = this.c.pal;
    const t = Math.min(this.t, PASS_MS * 2 + TURN_MS);
    const e = this.at(t);
    if (!this.screeched && this.t > 120) {
      this.screeched = true;
      sound.screech(w.pan(e.x));
    }
    // Talons rake whatever it passes over, once a pass.
    if (e.pass >= 0 && e.z < EAGLE_Z + 20) {
      const seen = this.struck[e.pass];
      const hit = strikeGround(w, e.x, e.y, RAKE_R, { damage: RAKE_DAMAGE, heavy: true, knock: 160, fromX: e.x - Math.cos(e.a) * 10, fromY: e.y - Math.sin(e.a) * 10 }, seen);
      for (const h of hit) {
        seen.add(h);
        w.debris(p.tints, h.x, h.y - h.bodyY, 8, h.y + 14, 'burst');
        sound.rake(w.pan(h.x), true);
      }
      if (hit.length) w.cameras.main.shake(90, 0.0005);
    }
    const cx = this.ox + (this.c.dx * SWOOP) / 2;
    const cy = this.oy + (this.c.dy * SWOOP) / 2;
    const g = this.g.begin(cx, cy - 10, Math.max(this.c.y, e.y) + 30);
    const fade = 1 - clamp01((this.t - (PASS_MS * 2 + TURN_MS)) / 300);
    // The afterimage it leaves: faint wingbeats of light.
    this.trail.push({ x: e.x, y: e.y - e.z, a: e.a });
    if (this.trail.length > 10) this.trail.shift();
    this.trail.forEach((q, i) => {
      if (i % 3 !== 0 || i === this.trail.length - 1) return;
      this.eagle(g, q.x, q.y, q.a, 0.6, 0.18 * (i / this.trail.length) * fade, true);
    });
    // Its shadow sweeping over the ground.
    const sh = 1 - clamp01((e.z - EAGLE_Z) / 40);
    for (let y = -4; y <= 4; y++) for (let x = -14; x <= 14; x++) if ((x * x) / 196 + (y * y) / 16 <= 1 && dither(x & 3, y & 3) < 0.5) g.put(e.x + x, e.y + y, 0x10141c, 0.35 * sh * fade);
    const flap = Math.sin(this.t * 0.028);
    this.eagle(g, e.x, e.y - e.z, e.a, 0.55 + 0.45 * Math.abs(flap), fade, false);
    g.end();
    this.lamp.setPosition(e.x, e.y - e.z);
    this.lamp.intensity = 2.2 * fade;
    if (Math.random() < 0.3) w.debris([p.core, p.hot], e.x, e.y - e.z, 1, e.y + 10, 'trail');
  }

  /**
   * The spirit eagle seen from above, heading `a`: head and hooked beak, a
   * body, a fanned tail, and wings whose span beats with `open`, the
   * primaries parting at the tips. Pale at the heart, deep at the edges.
   */
  private eagle(g: Ink, x: number, y: number, a: number, open: number, alpha: number, ghost: boolean): void {
    if (alpha <= 0) return;
    const p = this.c.pal;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const span = SPAN * open + 4;
    const R = SPAN + 15;
    for (let py = -R; py <= R; py++) {
      for (let px = -R; px <= R; px++) {
        // Into the bird's frame: u along its heading, v across it.
        const u = px * ca + (py / 0.8) * sa;
        const v = -px * sa + (py / 0.8) * ca;
        const av = Math.abs(v);
        let inside = false;
        let heart = 0;
        if ((u * u) / 81 + (v * v) / 7 <= 1) {
          inside = true;
          heart = 1 - Math.abs(u) / 9;
        } else if ((u - 9.5) ** 2 + v * v <= 6.5) {
          inside = true;
          heart = 0.9;
        } else if (u > 11 && u < 14 && av <= 1.3 - (u - 11) * 0.4) {
          inside = true;
          heart = 1.1;
        } else if (u < -7 && u > -15 && av <= 1.4 + (-7 - u) * 0.6) {
          inside = true;
          heart = 0.2;
        } else if (av > 2 && av <= span) {
          const q = av / span;
          const lead = 3.4 - q * 3.2;
          let trail = -3.2 - q * 3.4;
          // The primaries: fingers of feather at the tip.
          if (q > 0.62) trail += Math.floor(av) % 3 === 0 ? 2.4 : 0;
          const tipCut = q > 0.9 ? (q - 0.9) * 40 : 0;
          if (u <= lead - tipCut * 0.2 && u >= trail + tipCut) {
            inside = true;
            heart = 0.75 - q * 0.75;
          }
        }
        if (!inside) continue;
        const c = ghost ? p.mid : heart > 0.95 ? p.core : heart > 0.55 ? p.hot : heart > 0.2 ? p.mid : p.deep;
        g.put(x + px, y + py, c, alpha);
      }
    }
    if (!ghost) {
      // The eye.
      const ex = x + ca * 10 - sa * 1.2;
      const ey = y + (sa * 10 + ca * 1.2) * 0.8;
      g.put(ex, ey, p.core, alpha);
    }
  }
}

export function skySovereign(c: Cast): void {
  c.world.addEffect(new SkySovereign(c.world, c));
}

// ---------------------------------------------------------------------------
// King's Roar

const ROARS = [
  { at: 0, r: 58, damage: 20, knock: 170 },
  { at: 420, r: 70, damage: 20, knock: 170 },
  { at: 900, r: 92, damage: 40, knock: 280 },
];
const COW = 0.45;
const COW_MS = 2400;
const HEAD_Y = 34;

export class KingsRoar extends Fx {
  private g: Ink;
  private lamp: Phaser.GameObjects.Light;
  private next = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 1700);
    this.g = this.ink(200, 150);
    this.lamp = this.light(c.x, c.y - HEAD_Y, 110, c.pal.light, 0);
  }

  protected step(): void {
    const w = this.world;
    const { x, y, pal: p } = this.c;
    while (this.next < ROARS.length && this.t >= ROARS[this.next].at) {
      const r = ROARS[this.next];
      const big = this.next === ROARS.length - 1;
      for (const h of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - x, (b.y - y) / 0.75) <= r.r + b.radius)) {
        h.hurt({ damage: r.damage, heavy: true, knock: r.knock, fromX: x, fromY: y });
        h.slow?.(COW, COW_MS, p.mid);
      }
      w.debris([0xa4703c, 0x7a4c26, 0xd8c8a0, p.hot], x, y, big ? 26 : 14, y + 10, 'burst');
      w.cameras.main.shake(big ? 420 : 240, big ? 0.0016 : 0.0009);
      flare(w, x, y - HEAD_Y, r.r * 2, p.light, big ? 3.2 : 2, 420);
      sound.roar(w.pan(x), big);
      if (big) bloom(w, x, y - HEAD_Y, p.core, 3.2, 600, y + 50);
      this.next++;
    }
    const g = this.g.begin(x, y - 30, y + 40);
    // Each roar rolls out as broken rings of sound over the ground.
    ROARS.forEach((r, n) => {
      const k = clamp01((this.t - r.at) / 520);
      if (k <= 0 || k >= 1) return;
      const rr = 8 + (r.r - 8) * easeOut(k);
      ring(g, x, y, rr, n === 2 ? 3 : 2, p, 1 - k, 0.72, 0.25, n);
      ring(g, x, y, rr * 0.7, 1, p, (1 - k) * 0.6, 0.72, 0.5, n + 5);
    });
    // The spirit lion's head, roaring in the air over him.
    const since = ROARS.reduce((m, r) => (this.t >= r.at ? this.t - r.at : m), 999);
    const pulse = 1 + 0.18 * Math.max(0, 1 - since / 220);
    const alpha = clamp01(this.t / 150) * (1 - clamp01((this.t - 1300) / 400));
    this.lionHead(g, x, y - HEAD_Y, pulse, alpha, 0.6 + 0.4 * Math.max(0, 1 - since / 380));
    g.end();
    this.lamp.intensity = 2.4 * alpha * pulse;
  }

  /** A lion's head in light: a flaring mane of flame-like locks, the face, eyes, and jaws open wide. */
  private lionHead(g: Ink, x: number, y: number, s: number, a: number, open: number): void {
    if (a <= 0) return;
    const p = this.c.pal;
    const R = 16 * s;
    for (let py = -Math.ceil(R + 4); py <= R + 4; py++) {
      for (let px = -Math.ceil(R + 4); px <= R + 4; px++) {
        const d = Math.hypot(px, py * 1.05);
        const ang = Math.atan2(py, px);
        // Ragged locks round the rim, stirring.
        const rim = R + 2.4 * Math.sin(ang * 9 + this.t * 0.01) + 1.2 * Math.sin(ang * 5 - this.t * 0.013);
        if (d > rim) continue;
        const face = Math.hypot(px / 8.5, (py - 1) / 9) <= s;
        if (face) {
          // The jaws: a dark gape with white fangs at its corners.
          const jaw = py > 3 * s && py < (3 + 6 * open) * s && Math.abs(px) < (3.6 - (py - 3 * s) * 0.2) * s;
          if (jaw) {
            const fang = Math.abs(px) > 2.2 * s && py < 5 * s;
            g.put(x + px, y + py, fang ? p.core : 0x1a0808, a * (fang ? 1 : 0.85));
            continue;
          }
          const eye = Math.abs(Math.abs(px) - 3.4 * s) < 1 && Math.abs(py + 2 * s) < 0.8;
          const nose = Math.abs(px) < 1.6 * s && py > 0.5 * s && py < 2.4 * s;
          g.put(x + px, y + py, eye ? p.core : nose ? p.deep : Math.hypot(px, py) < 5 * s ? p.hot : p.core, a);
        } else {
          const u = (d - 8 * s) / Math.max(1, rim - 8 * s);
          g.put(x + px, y + py, u < 0.45 ? p.mid : u < 0.8 ? p.deep : p.mid, a * (u > 0.85 && dither(px & 3, py & 3) > 0.6 ? 0.5 : 0.9));
        }
      }
    }
  }
}

export function kingsRoar(c: Cast): void {
  c.world.addEffect(new KingsRoar(c.world, c));
}

// ---------------------------------------------------------------------------
// Wrath of the Wyrm

const RISE_MS = 520;
const COIL_MS = 1400;
const DIVE_MS = 260;
const BLAST_MS = 520;
const COIL_R = 34;
const SEGMENTS = 16;
const SEG_LAG = 38;
const COIL_DAMAGE = 6;
const COIL_HIT_R = 15;
const COIL_REHIT = 320;
const BLAST_R = 54;
const BLAST_DAMAGE = 40;

export class WyrmWrath extends Fx {
  private g: Ink;
  private lamp: Phaser.GameObjects.Light;
  private lastHit = new Map<Hurtbox, number>();
  private blasted = false;
  private readonly sx: number;
  private readonly sy: number;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, RISE_MS + COIL_MS + DIVE_MS + BLAST_MS);
    this.sx = c.x + c.dx * 7;
    this.sy = c.y + c.dy * 4;
    const w = Math.ceil(Math.abs(c.tx - c.x) + COIL_R * 2 + 70);
    const h = Math.ceil(Math.abs(c.ty - c.y) + COIL_R * 2 + 110);
    this.g = this.ink(w, h);
    this.lamp = this.light(c.x, c.y, 100, c.pal.light, 2);
    flare(world, c.x, c.y - BEAST_MOUTH_Y, 100, c.pal.light, 2.6, 450);
    sound.flame(world.pan(c.x));
    sound.fireball(world.pan(c.x));
  }

  /** The serpent's head at time t: its ground point and height. */
  private path(t: number): { x: number; y: number; z: number } {
    const { tx, ty } = this.c;
    // It enters the coil on the side facing him.
    const a0 = Math.atan2(this.sy - ty, this.sx - tx);
    const coil = (k: number) => {
      const ang = a0 - k * Math.PI * 3;
      return { x: tx + Math.cos(ang) * COIL_R, y: ty + Math.sin(ang) * COIL_R * 0.6 };
    };
    if (t <= 0) return { x: this.sx, y: this.sy, z: BEAST_MOUTH_Y };
    if (t < RISE_MS) {
      const k = t / RISE_MS;
      const e = coil(0);
      const q = easeOut(k);
      return { x: this.sx + (e.x - this.sx) * q, y: this.sy + (e.y - this.sy) * q, z: BEAST_MOUTH_Y + Math.sin(k * Math.PI) * 30 + (14 - BEAST_MOUTH_Y) * k };
    }
    if (t < RISE_MS + COIL_MS) {
      const k = (t - RISE_MS) / COIL_MS;
      const e = coil(k);
      return { ...e, z: 14 + Math.sin(k * Math.PI * 6) * 3 };
    }
    const k = clamp01((t - RISE_MS - COIL_MS) / DIVE_MS);
    const e = coil(1);
    const q = easeIn(k);
    return { x: e.x + (tx - e.x) * q, y: e.y + (ty - e.y) * q, z: 14 + 26 * Math.sin(k * Math.PI * 0.5) * (1 - k) * 2 - 14 * q };
  }

  protected step(): void {
    const w = this.world;
    const { tx, ty, pal: p } = this.c;
    const t = this.t;
    const end = RISE_MS + COIL_MS + DIVE_MS;
    const head = this.path(Math.min(t, end));

    // Raking what it passes as it coils.
    if (t >= RISE_MS && t < end) {
      for (const h of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - head.x, (b.y - head.y) / 0.7) <= COIL_HIT_R + b.radius)) {
        if (t - (this.lastHit.get(h) ?? -9999) < COIL_REHIT) continue;
        this.lastHit.set(h, t);
        h.hurt({ damage: COIL_DAMAGE, heavy: false, knock: 60, fromX: tx, fromY: ty });
      }
    }
    if (!this.blasted && t >= end) {
      this.blasted = true;
      strikeGround(w, tx, ty, BLAST_R, { damage: BLAST_DAMAGE, heavy: true, knock: 230 });
      bloom(w, tx, ty - 8, p.core, 4, 600, ty + 50);
      flare(w, tx, ty - 8, 220, p.light, 4, 650);
      w.debris(p.tints, tx, ty - 6, 30, ty + 30, 'burst');
      w.cameras.main.shake(340, 0.0014);
      sound.blast(w.pan(tx));
      sound.slam(w.pan(tx));
    }

    const cx = (this.c.x + tx) / 2;
    const cy = (this.c.y + ty) / 2 - 20;
    const g = this.g.begin(cx, cy, Math.max(ty, this.c.y) + 40);
    // The ring of fire it lays under the coil.
    if (t >= RISE_MS * 0.6 && t < end) {
      const k = clamp01((t - RISE_MS * 0.6) / 300);
      ring(g, tx, ty, COIL_R * (0.6 + 0.4 * k), 1.6, p, 0.5 * k, 0.6, 0.3, Math.floor(t / 90));
    }
    if (t < end) {
      // The body, tail first so the head lies over it: each segment where the head was a moment ago.
      for (let i = SEGMENTS; i >= 0; i--) {
        const q = this.path(t - i * SEG_LAG);
        if (t - i * SEG_LAG <= 0) continue;
        const f = i / SEGMENTS;
        const r = i === 0 ? 3.6 : 3.1 - f * 2.2;
        const sx = q.x;
        const sy = q.y - q.z;
        for (let y = -Math.ceil(r); y <= r; y++) {
          for (let x = -Math.ceil(r); x <= r; x++) {
            const d = Math.hypot(x, y) / r;
            if (d > 1) continue;
            g.put(sx + x, sy + y, d < 0.35 ? p.core : d < 0.7 ? p.hot : f > 0.7 ? p.deep : p.mid, 1 - f * 0.25);
          }
        }
        // Flames licking up off its back.
        if (i % 3 === 1) {
          const lick = (t * 0.02 + i) % 3;
          g.put(sx, sy - r - 1 - lick, p.mid, 0.8);
          g.put(sx, sy - r - 2 - lick, p.deep, 0.5);
        }
        // Its shadow on the ground.
        if (i % 2 === 0) g.put(q.x, q.y, 0x14100c, 0.25);
      }
      // The head: a blunt snout the way it goes, horns swept back, eyes white-hot.
      const ahead = this.path(t + 30);
      const hx = head.x;
      const hy = head.y - head.z;
      const dx = ahead.x - head.x;
      const dy = ahead.y - ahead.z - hy;
      const l = Math.hypot(dx, dy) || 1;
      const ux = dx / l;
      const uy = dy / l;
      for (let s = 0; s <= 5; s++) {
        const r = 2.6 - s * 0.35;
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= r * r) g.put(hx + ux * s + x, hy + uy * s + y, s > 3 ? p.hot : p.core);
      }
      for (const k of [-1, 1]) {
        for (let s = 1; s <= 5; s++) g.put(hx - ux * s - uy * k * (2 + s * 0.4), hy - uy * s + ux * k * (2 + s * 0.4) - s * 0.3, s > 3 ? p.deep : p.mid);
        g.put(hx + ux * 2 - uy * k * 1.6, hy + uy * 2 + ux * k * 1.6, 0xffffff);
      }
    } else {
      // The blast: a flash, and a ring of fire racing out over the ground.
      const b = clamp01((t - end) / BLAST_MS);
      ring(g, tx, ty, BLAST_R * easeOut(b), 4 * (1 - b) + 0.8, p, 1 - b);
      ring(g, tx, ty, BLAST_R * 0.55 * easeOut(b), 2 * (1 - b) + 0.4, p, 0.7 * (1 - b), undefined, 0.35, 4);
      if (b < 0.3) {
        const fr = 10 + b * 50;
        for (let y = -fr; y <= fr; y++) for (let x = -fr; x <= fr; x++) if (x * x + y * y * 1.8 <= fr * fr && dither(x & 3, y & 3) < 1 - b * 3) g.put(tx + x, ty - 6 + y, p.core, 1 - b * 3);
      }
    }
    g.end();
    this.lamp.setPosition(head.x, head.y - head.z);
    this.lamp.intensity = t < end ? 2.4 : 3 * (1 - clamp01((t - end) / BLAST_MS));
  }
}

export function wyrmWrath(c: Cast): void {
  c.world.addEffect(new WyrmWrath(c.world, c));
}
