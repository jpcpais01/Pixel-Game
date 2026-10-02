import type Phaser from 'phaser';
import { sound } from '../../audio';
import { BEAR_MOUTH_Y } from '../../art/bear';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, dither, easeOut, flare, Fx, ring, type Ink, type Pal } from './ink';
import type { Cast } from './types';
import type { Bear } from '../Bear';

// The Bear's Special, Ursine Wrath: he roars, a great spirit bear's head
// roaring over him, and the rage takes him (Bear.enrage): bigger, blazing,
// shrugging off blows, every maul sending a shockwave on ahead. The Panda's
// burns jade.

const HEAD_Y = 40;
const ROAR_MS = 1000;
/** The roar's ring throws foes near him back with a cuff (the wrath is the weapon). */
const SHOVE_DAMAGE = 8;
const SHOVE_R = 40;
const SHOVE_KNOCK = 200;

class WrathRoar extends Fx {
  private g: Ink;
  private lamp: Phaser.GameObjects.Light;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, ROAR_MS);
    this.g = this.ink(150, 120);
    this.lamp = this.light(c.x, c.y - HEAD_Y, 110, c.pal.light, 0);
    const { x, y, pal: p } = c;
    for (const h of world.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - x, (b.y - y) / 0.75) <= SHOVE_R + b.radius)) {
      h.hurt({ damage: SHOVE_DAMAGE, heavy: true, knock: SHOVE_KNOCK, fromX: x, fromY: y });
    }
    flare(world, x, y - HEAD_Y, 140, p.light, 3, 600);
    bloom(world, x, y - 20, p.hot, 2.6, 500, y + 40);
    world.debris([0x8a6440, 0x5a3e26, p.hot, p.mid], x, y, 20, y + 10, 'burst');
    world.cameras.main.shake(380, 0.0016);
    sound.bearGrowl(world.pan(x), true);
  }

  protected step(): void {
    const { x, y, pal: p } = this.c;
    const k = this.t / ROAR_MS;
    const g = this.g.begin(x, y - 40, y + 40);
    // Rings of the roar rolling out over the ground.
    for (let n = 0; n < 3; n++) {
      const q = clamp01((this.t - n * 140) / 500);
      if (q <= 0 || q >= 1) continue;
      ring(g, x, y, 8 + (SHOVE_R + 10 - 8) * easeOut(q), n === 0 ? 2 : 1, p, 1 - q, 0.62, 0.3, n);
    }
    // The spirit bear's head over him, swelling as it roars, then fading.
    const alpha = clamp01(this.t / 120) * (1 - clamp01((k - 0.6) / 0.4));
    const s = 0.8 + 0.25 * easeOut(Math.min(1, this.t / 260));
    this.head(g, x, y - HEAD_Y - BEAR_MOUTH_Y * 0.2, 14 * s, alpha, p);
    g.end();
    this.lamp.intensity = 2.6 * alpha;
  }

  /** A bear's head in light: round, two round ears, a broad muzzle, blazing eyes and jaws wide in a roar. */
  private head(g: Ink, x: number, y: number, R: number, a: number, p: Pal): void {
    if (a <= 0) return;
    const E = Math.ceil(R * 1.5);
    for (let py = -E; py <= E; py++) {
      for (let px = -E; px <= E; px++) {
        const fx = px / R;
        const fy = py / R;
        const skull = Math.hypot(fx, fy * 1.08) <= 1;
        const ear = Math.hypot(Math.abs(fx) - 0.78, fy + 0.78) <= 0.32;
        if (!skull && !ear) continue;
        let c: number;
        if (ear) c = Math.hypot(Math.abs(fx) - 0.78, fy + 0.78) < 0.16 ? p.deep : p.mid;
        else {
          const muzzle = Math.hypot(fx / 0.48, (fy - 0.32) / 0.4) <= 1;
          const jaw = fy > 0.36 && fy < 0.78 && Math.abs(fx) < 0.3 - (fy - 0.36) * 0.2;
          const eye = Math.abs(Math.abs(fx) - 0.42) < 0.1 && Math.abs(fy + 0.12 - (Math.abs(fx) - 0.42) * 0.5) < 0.07;
          const nose = fy > 0.1 && fy < 0.3 && Math.abs(fx) < 0.18 - (fy - 0.1) * 0.4;
          const rim = Math.hypot(fx, fy * 1.08) > 0.86;
          if (jaw) c = Math.abs(fx) > 0.18 && fy < 0.5 ? 0xffffff : 0x1a0808;
          else if (eye) c = 0xffffff;
          else if (nose) c = p.deep;
          else if (muzzle) c = p.core;
          else c = rim ? p.deep : fy < -0.4 ? p.mid : p.hot;
        }
        const X = Math.round(x + px);
        const Y = Math.round(y + py);
        if (a < 1 && dither(X & 3, Y & 3) >= a) continue;
        g.put(X, Y, c, 1);
      }
    }
  }
}

export function ursineWrath(c: Cast): void {
  c.world.addEffect(new WrathRoar(c.world, c));
  (c.hero as Partial<Bear>).enrage?.();
}
