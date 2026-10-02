import type Phaser from 'phaser';
import { sound } from '../../audio';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, bump, clamp01, dither, easeOut, flare, Fx, GROUND, line, ring, stroke, strikeGround, type Ink, type Pal } from './ink';
import type { Cast, IconPainter } from './types';

// The Inquisitor's Special, Purge: he flings his ring saber out into a
// widening spiral round himself. It orbits him faster and faster, out to a
// wide reach and back in, carving everything it passes, a trail of red
// afterimages wheeling behind it; then it snaps home to his hand with a
// burst of red light that throws back whatever stands close. The spiral
// follows him as he walks. The Voidhunter casts it in violet.
//
// Also here: how a flying ring saber is drawn (his thrown attack uses it
// too), and the Special's icon.

/** How long it whirls, ms. */
const LIFE = 2500;
/** The spiral's reach: from close in, out to the widest, and back. */
const R_MIN = 9;
const R_MAX = 62;
/** Whole turns round him over its life. */
const TURNS = 6;
/** Height of the ring over the ground as it flies. */
const FLY_Z = 11;
/** It cuts what comes within this of it, a foe at most once every so often. */
const CUT_R = 15;
const CUT_EVERY = 260;
const CUT_DAMAGE = 12;
/** Afterimages trailing it, and how far back in time each lags. */
const GHOSTS = 6;
const GHOST_LAG = 26;
/** The burst as it comes home. */
const BURST_R = 40;
const BURST_DAMAGE = 18;

/** The ring hilt's chrome, lit side and far side. */
const CHROME = 0xd2d7e6;
const CHROME_DARK = 0x585d70;

/**
 * A ring saber in flight at (x, y), its blades turned to `ang`: a chrome ring
 * seen at a tilt, a blade of light along its edge from either side.
 */
export function flyingRing(g: Ink, x: number, y: number, ang: number, p: Pal, a = 1, tilt = 0.55, ghost = false): void {
  const R = 3.5;
  const L = 9;
  for (const off of [0, Math.PI]) {
    const t = ang + off;
    const ex = x + Math.cos(t) * R;
    const ey = y + Math.sin(t) * R * tilt;
    const vx = -Math.sin(t) * L;
    const vy = Math.cos(t) * L * tilt;
    if (ghost) {
      for (let i = 0; i <= L; i++) {
        const px = ex + (vx * i) / L;
        const py = ey + (vy * i) / L;
        if (dither(Math.round(px), Math.round(py)) < a) g.put(px, py, i > L * 0.6 ? p.mid : p.deep, 0.9);
      }
      continue;
    }
    stroke(g, ex, ey, ex + vx, ey + vy, 1, p, a);
    line(g, ex, ey, ex + vx, ey + vy, p.core, a);
  }
  if (ghost) return;
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    g.put(x + Math.cos(t) * R, y + Math.sin(t) * R * tilt, Math.sin(t) < 0 || Math.cos(t) < -0.5 ? CHROME : CHROME_DARK, a);
  }
}

export class Purge extends Fx {
  private air: Ink;
  private ground: Ink;
  private shadow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  /** When each foe was last cut. */
  private cutAt = new Map<Hurtbox, number>();
  private hum = 0;
  private home = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, LIFE);
    this.air = this.ink(R_MAX * 2 + 40, Math.ceil(R_MAX * 2 * GROUND) + 60);
    this.ground = this.ink(R_MAX * 2 + 24, Math.ceil(R_MAX * 2 * GROUND) + 24);
    this.shadow = this.own(world.add.image(0, 0, 'shadow').setDepth(1.5).setAlpha(0.45));
    this.lamp = this.light(c.x, c.y, 80, c.pal.light, 1.8);
    // The ring leaves his hand: he's drawn empty-handed and can't strike until it's back.
    c.hero.holdSaber?.(true);
    sound.ringSaber(world.pan(c.x));
  }

  /** The spiral's radius and angle `t` ms in: out to the widest by halfway, back in by the end, turning faster as it widens. */
  private at(t: number): { r: number; a: number } {
    const k = clamp01(t / LIFE);
    const r = R_MIN + (R_MAX - R_MIN) * Math.pow(bump(k), 0.8);
    const a = Math.atan2(this.c.dy, this.c.dx) + k * TURNS * Math.PI * 2;
    return { r, a };
  }

  private spot(t: number): { x: number; y: number } {
    const { r, a } = this.at(t);
    const h = this.c.hero;
    return { x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r * GROUND };
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const p = c.pal;
    const h = c.hero;
    const s = this.spot(t);

    // Carve whatever it passes.
    for (const f of world.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - s.x, (b.y - s.y) / GROUND) <= CUT_R + b.radius)) {
      const last = this.cutAt.get(f) ?? -Infinity;
      if (t - last < CUT_EVERY) continue;
      this.cutAt.set(f, t);
      f.hurt({ damage: CUT_DAMAGE, heavy: false, knock: 70, fromX: h.x, fromY: h.y });
      world.debris(p.tints, f.x, f.y - f.bodyY, 4, f.y + 12, 'burst');
      sound.saberHit(world.pan(f.x));
    }
    this.hum -= dt;
    if (this.hum <= 0) {
      this.hum = 170;
      sound.saberSwing(1 + (Math.floor(t / 170) % 3), world.pan(s.x));
    }

    // The spiral's path on the ground, faint, and the ring with its afterimages in the air.
    const g = this.ground.begin(h.x, h.y, 2.6);
    const { r } = this.at(t);
    const fade = 1 - clamp01((t - LIFE + 300) / 300);
    ring(g, h.x, h.y, r, 1, p, 0.35 * fade, GROUND, 0.55, Math.floor(t / 80));
    g.end();
    const air = this.air.begin(h.x, h.y - FLY_Z, h.y + R_MAX * GROUND + 8);
    for (let i = GHOSTS; i >= 1; i--) {
      const tt = Math.max(0, t - i * GHOST_LAG);
      const q = this.spot(tt);
      flyingRing(air, q.x, q.y - FLY_Z, tt * 0.05, p, 0.75 - i * 0.1, 0.55, true);
    }
    flyingRing(air, s.x, s.y - FLY_Z, t * 0.05, p, 1);
    air.end();
    this.shadow.setPosition(Math.round(s.x), Math.round(s.y)).setScale(1.1, 0.7);
    this.lamp.setPosition(s.x, s.y - FLY_Z);
    this.lamp.intensity = 1.4 + 0.6 * easeOut(clamp01(t / 200));
  }

  destroy(): void {
    if (this.dead) return;
    if (!this.home) this.comeHome();
    super.destroy();
  }

  /** Back in his hand: a burst of red light that throws back everything close. */
  private comeHome(): void {
    this.home = true;
    const { c, world } = this;
    const p = c.pal;
    const h = c.hero;
    c.hero.holdSaber?.(false);
    strikeGround(world, h.x, h.y, BURST_R, { damage: BURST_DAMAGE, heavy: true, knock: 170, fromX: h.x, fromY: h.y });
    world.addEffect(new HomeBurst(world, h.x, h.y, p));
    flare(world, h.x, h.y - 10, 120, p.light, 2.6, 420);
    bloom(world, h.x, h.y - 12, p.hot, 2, 320, h.y + 20);
    world.debris(p.tints, h.x, h.y - 12, 16, h.y + 20, 'burst');
    world.cameras.main.shake(180, 0.0012);
    sound.forcePush(world.pan(h.x), true);
  }
}

/** The ring of light rolling out over the ground as the ring saber comes home. */
class HomeBurst extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
  ) {
    super(world, 360);
    this.g = this.ink(BURST_R * 2 + 16, Math.ceil(BURST_R * 2 * GROUND) + 16);
  }

  protected step(): void {
    const k = this.t / this.life;
    const g = this.g.begin(this.x, this.y, 2.7);
    ring(g, this.x, this.y, 6 + BURST_R * easeOut(k * 1.2), 2.6 * (1 - k) + 0.6, this.p, 1 - k);
    ring(g, this.x, this.y, 3 + BURST_R * 0.6 * easeOut(k), 1, this.p, 0.6 * (1 - k), GROUND, 0.5, 3);
    g.end();
  }
}

/** The Special's icon: the ring saber wheeling out of a spiral of its own red afterimages. */
export const purgeIcon: IconPainter = (raw, p) => {
  const put = (x: number, y: number, c: number) => raw(Math.round(x), Math.round(y), c);
  // The spiral, fading towards its heart.
  for (let i = 0; i < 70; i++) {
    const u = i / 70;
    const a = u * Math.PI * 3.2;
    const r = 1 + u * 5.6;
    put(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, u > 0.7 ? p.hot : u > 0.4 ? p.mid : p.deep);
  }
  // Ghost rings along it.
  for (const [x, y] of [[3, 9], [6, 3]] as const) {
    put(x, y, p.deep);
    put(x + 1, y, p.mid);
    put(x, y + 1, p.mid);
    put(x + 1, y + 1, p.deep);
  }
  // The ring at the head of the spiral, its blades along its edge.
  const cx = 12;
  const cy = 11;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    put(cx + Math.cos(a) * 1.8, cy + Math.sin(a) * 1.8, Math.sin(a) < 0 ? 0xd2d7e6 : 0x7a8096);
  }
  for (let i = 1; i <= 3; i++) {
    put(cx + 2, cy - i, i === 1 ? p.core : p.hot);
    put(cx - 2, cy + i, i === 1 ? p.core : p.hot);
  }
  put(cx, cy, p.core);
};
