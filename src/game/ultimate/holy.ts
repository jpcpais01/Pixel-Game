import type Phaser from 'phaser';
import { sound } from '../../audio';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { clamp01, column, dither, easeOut, flare, Fx, GROUND, hash, pool, ring, rune, star, stroke, strikeGround, type Ink, type Pal } from './ink';
import type { Cast } from './types';

// The Paladin's Specials, and the ray both the Crusader's sun and the Blood
// mage's moon strike with.

const RINGS = [260, 660, 1060];

/** The Templar's Heaven's Light: a pillar of light falls on the paladin, healing and shielding him, and three rings of holy fire roll out. */
export class HeavensLight extends Fx {
  private back: Ink;
  private front: Ink;
  private ground: Ink;
  private lamp: Phaser.GameObjects.Light;
  private next = 0;
  private healed = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 2300);
    this.back = this.ink(40, 170);
    this.front = this.ink(40, 170);
    this.ground = this.ink(200, 120);
    this.lamp = this.light(c.x, c.y - 20, 150, c.pal.light, 0);
    world.evade(1500);
    sound.hallow();
  }

  protected step(): void {
    const { c, t, world } = this;
    const p = c.pal;
    const { x, y } = c;
    if (!this.healed && t >= 240) {
      this.healed = true;
      const v = c.hero.vitals;
      const got = v.heal(Math.round(v.max * 0.35));
      world.popNumber(Math.round(c.hero.x), Math.round(c.hero.y) - 38, `+${got}`, 0x9dff9a);
      world.debris([0xffffff, p.hot, p.mid], x, y - 14, 20, y + 20, 'spores');
      flare(world, x, y - 30, 200, p.light, 4, 900);
      sound.heal(world.pan(x));
    }
    while (this.next < RINGS.length && t >= RINGS[this.next]) {
      this.next++;
      strikeGround(world, x, y, 80, { damage: 26, heavy: true, knock: 120, fromX: x, fromY: y });
      sound.smite(world.pan(x), true);
      world.cameras.main.shake(120, 0.0015);
    }

    // The pillar: it comes down from the sky, stands, and thins away.
    const drop = easeOut(t / 240);
    const thin = 1 - clamp01((t - 1500) / 600);
    const bottom = y - 170 * (1 - drop);
    const w = 10 * thin * (1 + 0.08 * Math.sin(t * 0.02));
    const b = this.back.begin(x, y + 2, y - 0.5, 0.5, 1);
    const f = this.front.begin(x, y + 2, y + 30, 0.5, 1);
    if (w > 0.5) {
      column(b, x, bottom, 168 - (y - bottom), w, p, 0.9, t);
      // In front of him only a veil: the edges and motes, so he can still be seen inside.
      for (let dy = 0; dy < 160 - (y - bottom); dy += 1) {
        const yy = Math.round(bottom - dy);
        for (const side of [-1, 1]) {
          const xx = Math.round(x + side * w);
          if (dither(xx, yy) < 0.6 * thin) f.put(xx, yy, p.hot);
        }
      }
      for (let i = 0; i < 10; i++) {
        const s = hash(i, 11);
        const yy = bottom - ((s * 150 + t * 0.06 * (0.5 + s)) % 150);
        f.put(x + (hash(i, 12) - 0.5) * w * 2, yy, i % 3 ? p.hot : p.core, thin);
      }
    }
    b.end();
    f.end();

    // The ground: a turning rune under his feet and the rings of holy fire.
    const g = this.ground.begin(x, y, 2.5);
    const open = easeOut(t / 300) * thin;
    rune(g, x, y, 28 * open, t * 0.002, p, open);
    pool(g, x, y, 22 * open, p.hot, p.mid, 0.5 * open, GROUND, 0.5);
    for (const at of RINGS) {
      const k = (t - at) / 560;
      if (k < 0 || k > 1) continue;
      ring(g, x, y, 6 + 76 * easeOut(k), 3.5 * (1 - k) + 1, p, 1 - k);
    }
    g.end();
    this.lamp.intensity = 3 * drop * thin;
  }
}

/**
 * A ray from the sky: from (sx, sy) to the spot (gx, gy) on the ground.
 * 'beam' strikes at once and fades; 'lance' is a short bolt that falls
 * along the line and strikes where it lands.
 */
export class Ray extends Fx {
  private pix: Ink;
  private struck = false;

  constructor(
    world: WorldScene,
    private sx: number,
    private sy: number,
    private gx: number,
    private gy: number,
    private p: Pal,
    private mode: 'beam' | 'lance',
    private onLand: (x: number, y: number) => void,
  ) {
    super(world, mode === 'beam' ? 380 : 470);
    const w = Math.ceil(Math.abs(gx - sx) + 44);
    const h = Math.ceil(Math.abs(gy - sy) + 44);
    this.pix = this.ink(w, h);
  }

  private get fall(): number {
    return this.mode === 'lance' ? 110 : 0;
  }

  protected step(): void {
    const { sx, sy, gx, gy, p, t } = this;
    if (!this.struck && t >= this.fall) {
      this.struck = true;
      this.onLand(gx, gy);
    }
    const g = this.pix.begin((sx + gx) / 2, (sy + gy) / 2, gy + 6);
    if (this.mode === 'beam') {
      const k = t / 380;
      stroke(g, sx, sy, gx, gy, 2.8 * (1 - k) + 0.4, p, 1);
    } else if (t < this.fall) {
      const k = t / this.fall;
      const hx = sx + (gx - sx) * k;
      const hy = sy + (gy - sy) * k;
      const tail = Math.max(0, k - 0.35);
      stroke(g, sx + (gx - sx) * tail, sy + (gy - sy) * tail, hx, hy, 1.4, p);
    }
    const a = t - this.fall;
    if (a >= 0) {
      const k = a / (this.life - this.fall);
      ring(g, gx, gy, 3 + 14 * easeOut(k), 2 * (1 - k) + 0.8, p, 1 - k);
      if (k < 0.35) star(g, gx, gy - 2, Math.round(6 * (1 - k / 0.35)), p);
    }
    g.end();
  }
}

/** Where a volley of rays should fall: on the foes nearest (x, y) first, round and round, then on the ground about. */
export function pickSpots(world: WorldScene, x: number, y: number, reach: number, n: number, spread: number): { x: number; y: number; foe: Hurtbox | null }[] {
  const foes = world.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - x, (h.y - y) / GROUND) < reach).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  const out: { x: number; y: number; foe: Hurtbox | null }[] = [];
  for (let i = 0; i < n; i++) {
    if (foes.length) out.push({ x: 0, y: 0, foe: foes[i % foes.length] });
    else {
      const a = i * 2.4 + hash(i, 9);
      const r = spread * (0.35 + 0.65 * hash(i, 8));
      out.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * GROUND, foe: null });
    }
  }
  return out;
}

const SUN_RAYS = 10;
const RAY_EVERY = 135;
const SUN_H = 62;

/** The Crusader's Wrath of the Sun: a small sun kindles over his head and hurls rays of fire at every foe around. */
export class SunWrath extends Fx {
  private pix: Ink;
  private glow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private spots: ReturnType<typeof pickSpots>;
  private next = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 300 + SUN_RAYS * RAY_EVERY + 600);
    this.pix = this.ink(44, 44);
    this.glow = this.halo(c.pal.mid, 1.5, c.y + 40);
    this.lamp = this.light(c.x, c.y - SUN_H, 160, c.pal.light, 0);
    this.spots = pickSpots(world, c.x, c.y, 115, SUN_RAYS, 80);
    sound.ignite();
  }

  protected step(): void {
    const { c, t, world } = this;
    const p = c.pal;
    const sx = c.hero.x;
    const sy = c.hero.y - SUN_H;
    const end = 300 + SUN_RAYS * RAY_EVERY;
    const size = easeOut(t / 280) * (1 - clamp01((t - end) / 400));

    while (this.next < SUN_RAYS && t >= 300 + this.next * RAY_EVERY) {
      const s = this.spots[this.next++];
      const gx = s.foe ? s.foe.x : s.x;
      const gy = s.foe ? s.foe.y : s.y;
      world.addEffect(
        new Ray(world, sx, sy + 4, gx, gy, p, 'beam', (x, y) => {
          strikeGround(world, x, y, 15, { damage: 34, heavy: true, knock: 90, fromX: x, fromY: y - 20 });
          world.debris(p.tints, x, y - 3, 8, y + 20, 'burst');
          flare(world, x, y - 8, 80, p.light, 2.2, 300);
          sound.smite(world.pan(x), true);
        }),
      );
    }

    // The sun: a white heart, a hot disc and a crown of turning rays.
    const g = this.pix.begin(sx, sy, c.hero.y + 40);
    const r = 7 * size;
    if (r > 0.5) {
      for (let dy = -9; dy <= 9; dy++) {
        for (let dx = -9; dx <= 9; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          g.put(sx + dx, sy + dy, d < r * 0.45 ? p.core : d < r * 0.75 ? p.hot : p.mid);
        }
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.002;
        const len = (i % 2 ? 4 : 7) * size * (0.85 + 0.15 * Math.sin(t * 0.02 + i));
        for (let k = 1; k <= len; k++) g.put(sx + Math.cos(a) * (r + k), sy + Math.sin(a) * (r + k), k < len * 0.5 ? p.hot : p.deep);
      }
    }
    g.end();
    this.glow.setPosition(sx, sy).setAlpha(0.6 * size).setScale(1.2 + size * 0.8);
    this.lamp.setPosition(sx, sy + 20);
    this.lamp.intensity = 2.6 * size;
  }
}
