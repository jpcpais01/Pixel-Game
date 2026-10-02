import type Phaser from 'phaser';
import { sound } from '../../audio';
import type { Lightwright } from '../Lightwright';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, dither, easeOut, flare, Fx, GROUND, hash, segDist, shade, strikeGround, type Ink, type Pal } from './ink';
import type { Cast } from './types';

// The Lightwright's Special, the Burning Mirror (Archimedes' heat ray): a
// great concave mirror on a brass mast unfolds behind him, petal by petal;
// a shaft of sunlight falls into it, and it gathers that into a beam that
// narrows to a blazing point on the ground. For a few seconds he braces
// behind it and steers: the mirror turns after his aim (heavily, a mirror
// that size doesn't spin), the focus slides out and in after the mouse, and
// everything the beam crosses burns, the focus worst of all, leaving a trail
// of scorched, smouldering ground. The Stargazer's mirror is moon-silver and
// its beam starlight.

const UNFOLD = 450;
/** How long the beam pours, ms. */
export const MIRROR_MS = 4000;
const FOLD = 350;
/** Radians a second the mirror turns after the aim. */
const TURN = 2.4;
/** The focus: how far out it can be steered, and where it sits with nothing aimed. */
const FOCUS_MIN = 45;
const FOCUS_MAX = 115;
const FOCUS_REST = 95;
/** The dish: its radius, its depth, and how high its middle stands on the mast. */
const DISH_R = 12;
const DISH_DEPTH = 3;
const DISH_H = 22;
/** How far behind him the mast stands. */
const MAST_BACK = 9;
/** The beam's half width where it leaves the dish. */
const BEAM_W = 5;
const TICK = 150;
const BEAM_DAMAGE = 4;
const BEAM_REACH = 5;
const FOCUS_R = 16;
const FOCUS_DAMAGE = 6;
const SCORCH_EVERY = 45;
const SCORCH_MS = 1600;
const SCORCH_R = 6;
const SCORCH_TICK = 300;
const SCORCH_DAMAGE = 2;
const MAX_SCORCH = 60;

/** The mirror's metal, brightest first. */
const BRASS_MIRROR = [0xfff0b0, 0xdcae4a, 0xa8742a, 0x6a4418];
const SILVER_MIRROR = [0xf4f6ff, 0xc4cadf, 0x858ca8, 0x4b5068];

interface Scorch {
  x: number;
  y: number;
  age: number;
  seed: number;
}

export class BurningMirror extends Fx {
  private dishInk: Ink;
  private beamInk: Ink;
  private groundInk: Ink;
  private hero: Lightwright | null;
  private metal: number[];
  private ang: number;
  private focus = FOCUS_REST;
  private tickT = 0;
  private scorchTickT = SCORCH_TICK;
  private scorchT = 0;
  private roarT = 0;
  private scorches: Scorch[] = [];
  private lit = false;
  private ended = -1;
  private sun: Phaser.GameObjects.Light;
  private hotspot: Phaser.GameObjects.Light;
  /** Where he stood as it was cast: the canvases stay put, as he does. */
  private ox: number;
  private oy: number;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, UNFOLD + MIRROR_MS + FOLD);
    this.hero = 'braceMirror' in c.hero ? (c.hero as Lightwright) : null;
    this.hero?.braceMirror(UNFOLD + MIRROR_MS);
    this.metal = c.look === 'stargazer' ? SILVER_MIRROR : BRASS_MIRROR;
    this.ang = Math.atan2(c.dy, c.dx);
    this.ox = c.x;
    this.oy = c.y;
    this.dishInk = this.ink(90, 120);
    this.beamInk = this.ink(FOCUS_MAX * 2 + 60, FOCUS_MAX * 2 + 70);
    this.groundInk = this.ink(FOCUS_MAX * 2 + 40, Math.ceil(FOCUS_MAX * 2 + 40));
    this.sun = this.light(c.x, c.y - DISH_H, 90, c.pal.light, 0);
    this.hotspot = this.light(c.x, c.y, 80, c.pal.light, 0);
    sound.burningMirror(world.pan(c.x), false);
  }

  /** The burn left, for the HUD's timer. */
  timeLeft(): { left: number; total: number } | null {
    if (this.dead || this.ended >= 0) return null;
    return { left: UNFOLD + MIRROR_MS - this.t, total: UNFOLD + MIRROR_MS };
  }

  protected step(dt: number): void {
    const w = this.world;
    const p = this.c.pal;
    const hx = this.hero?.x ?? this.ox;
    const hy = this.hero?.y ?? this.oy;
    // He fell, or the beam is spent: it folds away.
    if (this.ended < 0 && (this.t >= UNFOLD + MIRROR_MS || (this.t > UNFOLD && this.hero && !this.hero.bracing))) {
      this.ended = this.t;
      this.hero?.releaseMirror();
    }
    const unfold = easeOut(this.t / UNFOLD);
    const fold = this.ended >= 0 ? clamp01((this.t - this.ended) / FOLD) : 0;
    if (this.ended >= 0 && fold >= 1) {
      this.destroy();
      return;
    }
    const burning = this.t >= UNFOLD && this.ended < 0;

    // Steering: the mirror turns after the aim, the focus slides after the mouse.
    const s = this.hero?.steer();
    if (s && burning) {
      const want = Math.atan2(s.y, s.x);
      let d = want - this.ang;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const turn = (TURN * dt) / 1000;
      this.ang += Math.max(-turn, Math.min(turn, d));
      const fd = s.dist === undefined ? FOCUS_REST : Math.max(FOCUS_MIN, Math.min(FOCUS_MAX, s.dist));
      this.focus += (fd - this.focus) * Math.min(1, dt / 160);
    }
    const ux = Math.cos(this.ang);
    const uy = Math.sin(this.ang);
    const mx = hx - ux * MAST_BACK;
    const my = hy - uy * MAST_BACK * 0.6;
    const dx = mx;
    const dy = my - DISH_H;
    const fx = hx + ux * this.focus;
    const fy = hy + uy * this.focus;

    if (burning && !this.lit) {
      this.lit = true;
      flare(w, fx, fy, 140, p.light, 3, 500);
      bloom(w, dx, dy, p.core, 2.2, 400, hy + 30);
      w.cameras.main.shake(160, 0.0012);
      sound.burningMirror(w.pan(fx), true);
    }

    // --- The mirror, its mast, the sunlight falling into it (behind him).
    const dg = this.dishInk.begin(hx, hy - 40, hy - 0.5);
    const size = DISH_R * unfold * (1 - fold);
    this.mast(dg, mx, my, dy, 1 - fold);
    if (size > 1) this.dish(dg, dx, dy, ux, uy, size, unfold, burning);
    if (burning) {
      // The shaft of light from the sky.
      for (let y = 4; y < 46; y++) {
        const a = 1 - y / 46;
        const half = 1.6 + y * 0.05;
        for (let x = -Math.ceil(half); x <= Math.ceil(half); x++) {
          const yy = Math.round(dy - y);
          if (dither(dx + x, yy) >= a * (Math.abs(x) <= half * 0.5 ? 1 : 0.6)) continue;
          dg.put(dx + x, yy, Math.abs(x) <= half * 0.4 ? p.core : p.hot, 0.8);
        }
      }
    }

    // --- The beam, from the dish down to the focus, narrowing to a point.
    const bg = this.beamInk.begin(this.ox, this.oy, this.oy + 400);
    const gg = this.groundInk.begin(this.ox, this.oy, 2.2);
    for (const sc of this.scorches) sc.age += dt;
    this.scorches = this.scorches.filter((sc) => sc.age < SCORCH_MS);
    for (const sc of this.scorches) this.scorch(gg, sc, p);
    if (burning) {
      const len = Math.hypot(fx - dx, fy - dy) || 1;
      const bx = (fx - dx) / len;
      const by = (fy - dy) / len;
      const n = Math.ceil(len + 14);
      const flicker = 0.85 + 0.15 * Math.sin(this.t * 0.05);
      for (let i = 0; i <= n; i++) {
        const past = i > len;
        const f = Math.min(1, i / len);
        // Wide at the dish, a thread at the focus, flaring a little past it.
        const half = past ? (i - len) * 0.25 : BEAM_W * (1 - f) + 0.6;
        const cx = dx + bx * i;
        const cy = dy + by * i;
        // The part still behind him goes on the mirror's canvas, so he stands in front of it.
        const ink = Math.hypot(cx - dx, (cy - dy) * 1.4) < MAST_BACK + 5 ? dg : bg;
        const steps = Math.ceil(half * 2);
        for (let j = -steps; j <= steps; j++) {
          const o = (j / Math.max(1, steps)) * half;
          const x = cx - by * o;
          const y = cy + bx * o;
          const u = Math.abs(o) / (half || 1);
          if (past && dither(Math.round(x), Math.round(y)) > 1 - (i - len) / 14) continue;
          // Heat shimmering down its length.
          const ripple = (i + Math.floor(this.t / 30)) % 9 === 0 && u < 0.6;
          ink.put(x, y, ripple ? p.core : shade(p, u * (0.6 + 0.4 * f)), (past ? 0.7 : 1) * flicker);
        }
      }
      // The focus: a white-hot spot on the ground, a ring of heat round it.
      for (let r = 0; r < 4; r++) {
        for (let a = 0; a < 12; a++) {
          const th = (a / 12) * Math.PI * 2 + this.t * 0.01;
          bg.put(fx + Math.cos(th) * r, fy + Math.sin(th) * r * GROUND, r < 2 ? p.core : p.hot);
        }
      }
      const pulse = FOCUS_R * (0.75 + 0.25 * Math.sin(this.t * 0.03));
      for (let a = 0; a < 40; a++) {
        const th = (a / 40) * Math.PI * 2;
        if (hash(a, Math.floor(this.t / 80)) < 0.3) continue;
        gg.put(fx + Math.cos(th) * pulse, fy + Math.sin(th) * pulse * GROUND, a % 2 ? p.mid : p.hot, 0.8);
      }
      this.burn(dt, hx, hy, fx, fy);
      this.sun.setPosition(dx, dy);
      this.sun.intensity = 1.6 * flicker;
      this.hotspot.setPosition(fx, fy);
      this.hotspot.intensity = 2.6 * flicker;
      this.roarT -= dt;
      if (this.roarT <= 0) {
        this.roarT = 280;
        sound.flame(w.pan(fx));
      }
      if (Math.random() < dt / 50) w.debris(p.tints, fx, fy - 2, 1, fy + 10, 'spores');
    } else {
      this.sun.intensity = Math.max(0, this.sun.intensity - dt / 200);
      this.hotspot.intensity = Math.max(0, this.hotspot.intensity - dt / 200);
    }
    dg.end();
    bg.end();
    gg.end();
  }

  /** The mast and its three feet, the dish's hub on top. */
  private mast(g: Ink, mx: number, my: number, top: number, a: number): void {
    const [, hi, mid, dk] = this.metal;
    for (let y = Math.round(top); y <= my; y++) {
      g.put(mx, y, mid, a);
      g.put(mx + 1, y, dk, a);
    }
    for (const [lx, ly] of [[-4, 1], [4, 1], [0, -2]] as const) {
      const n = 6;
      for (let i = 0; i <= n; i++) g.put(mx + (lx * i) / n, my - 4 + ((4 + ly) * i) / n, i < 3 ? hi : dk, a);
    }
  }

  /**
   * The dish: a bowl of metal facing along (ux, uy), its rim a circle stood
   * upright. Facing us, its mirrored face shows, brightest in the middle
   * where the light gathers; facing away, its ribbed back. It opens from the
   * hub in eight petals as it unfolds.
   */
  private dish(g: Ink, cx: number, cy: number, ux: number, uy: number, R: number, unfold: number, burning: boolean): void {
    const [core, hi, mid, dk] = this.metal;
    const p = this.c.pal;
    // The rim's sideways axis on screen, and the bowl's depth drawn back along the aim.
    const px = -uy;
    const py = ux * GROUND;
    const bx = -ux;
    const by = -uy * GROUND;
    const face = uy > -0.25;
    const petals = Math.ceil(unfold * 8);
    const n = Math.ceil(R * 2.2);
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const s = i / n;
        const t = j / n;
        const d2 = s * s + t * t;
        if (d2 > 1) continue;
        const th = Math.atan2(t, s) + Math.PI;
        const petal = Math.floor((th / (Math.PI * 2)) * 8);
        if (petal >= petals) continue;
        const x = cx + R * s * px + (1 - d2) * DISH_DEPTH * bx;
        const y = cy + R * s * py - R * t + (1 - d2) * DISH_DEPTH * by;
        const rim = d2 > 0.8;
        // The seams between petals.
        const seam = Math.abs(((th / (Math.PI * 2)) * 8) % 1) < 0.08 && d2 > 0.1;
        let c: number;
        if (rim) c = d2 > 0.92 ? dk : mid;
        else if (face) {
          // The mirror's face: lit from the light pouring in, brightest at the heart; a sheen across it.
          const glow = burning ? 1 - Math.sqrt(d2) : 0.3 * (1 - d2);
          c = seam ? mid : glow > 0.7 ? p.core : glow > 0.45 ? core : t - s * 0.5 > 0.2 ? hi : glow > 0.2 ? hi : mid;
        } else c = seam ? hi : (Math.round(t * 6) & 1) === 0 ? mid : dk;
        g.put(x, y, c);
      }
    }
    // The hub.
    g.put(cx, cy, face && burning ? p.core : hi);
  }

  /** A patch of scorched ground, embers winking out in it as it cools. */
  private scorch(g: Ink, sc: Scorch, p: Pal): void {
    const k = sc.age / SCORCH_MS;
    const r = SCORCH_R * (0.6 + 0.4 * Math.min(1, sc.age / 200));
    const ry = Math.ceil(r * GROUND);
    for (let y = -ry; y <= ry; y++) {
      for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
        const d = Math.hypot(x, y / GROUND) / r;
        if (d > 1) continue;
        const X = Math.round(sc.x + x);
        const Y = Math.round(sc.y + y);
        if (dither(X, Y) >= (1 - k) * (1 - d * d)) continue;
        const ember = hash(X, Y, sc.seed) > 0.86 && k < 0.7;
        g.put(X, Y, ember ? (k < 0.3 ? p.hot : p.mid) : d < 0.5 ? 0x1a0e08 : 0x3a2414, ember ? 1 : 0.75);
      }
    }
  }

  /** The beam's bite: everything it crosses, the focus hardest, and whoever stands on the scorched ground. */
  private burn(dt: number, hx: number, hy: number, fx: number, fy: number): void {
    const w = this.world;
    this.scorchT -= dt;
    if (this.scorchT <= 0) {
      this.scorchT = SCORCH_EVERY;
      const last = this.scorches[this.scorches.length - 1];
      if (!last || Math.hypot(last.x - fx, last.y - fy) > 2.5) {
        this.scorches.push({ x: fx, y: fy, age: 0, seed: Math.floor(Math.random() * 1000) });
        if (this.scorches.length > MAX_SCORCH) this.scorches.shift();
      }
    }
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = TICK;
      const struck = new Set<Hurtbox>();
      for (const h of w.hurtboxesWhere((b) => b.alive && segDist(b.x, b.y, hx, hy, fx, fy) <= b.radius + BEAM_REACH)) {
        struck.add(h);
        h.hurt({ damage: BEAM_DAMAGE, heavy: false, knock: 30, fromX: hx, fromY: hy });
      }
      const hot = strikeGround(w, fx, fy, FOCUS_R, { damage: FOCUS_DAMAGE, knock: 20, fromX: hx, fromY: hy });
      for (const h of hot) struck.add(h);
      if (struck.size) sound.sizzle(w.pan(fx));
    }
    this.scorchTickT -= dt;
    if (this.scorchTickT <= 0) {
      this.scorchTickT = SCORCH_TICK;
      for (const h of w.hurtboxesWhere((b) => b.alive && this.scorches.some((sc) => Math.hypot(b.x - sc.x, (b.y - sc.y) / GROUND) <= SCORCH_R + b.radius * 0.5))) {
        h.hurt({ damage: SCORCH_DAMAGE, heavy: false, knock: 0, fromX: h.x, fromY: h.y - 1 });
      }
    }
  }
}

export function burningMirror(c: Cast): void {
  c.world.addEffect(new BurningMirror(c.world, c));
}
