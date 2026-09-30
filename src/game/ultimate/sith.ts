import type Phaser from 'phaser';
import { sound } from '../../audio';
import { bindFoe } from '../Strings';
import { onGround } from '../Toxins';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, bolt, clamp01, dither, drag, easeIn, easeOut, flare, Fx, GROUND, hash, pal, pool, ring, rune, type Ink, type Pal } from './ink';
import type { Cast } from './types';

// The Sith's Special, Dark Dominion: he closes his raised hand, and every foe
// on the spot is seized by the Force. A pit of darkness opens under them, a
// sigil turning in it; they are hoisted off their feet in bands of dark
// light, held by tendrils from the pit, squeezed again and again while their
// life streams back to him along the air, and dragged together into the
// middle. Then the fist clenches and they are crushed down into the ground.
// Bosses are too strong to lift, but the grip still squeezes and crushes them.
// The Warlord casts it as the Blood Dominion, in ember and old blood.

/** The grip's reach on the ground. */
const R = 46;
/** New foes stepping in are seized until this long in. */
const SEIZE_UNTIL = 1100;
/** Foes are held this far off the ground. */
const LIFT = 10;
/** The squeeze: every TICK, a blow to each foe held, and a little of it back to him. */
const TICK = 220;
const TICK_DAMAGE = 6;
const HEAL_PER_FOE = 1;
const HEAL_CAP = 4;
/** They are dragged together into the middle at this pace (px/s). */
const PULL = 16;
/** Then crushed. */
const CRUSH_AT = 1750;
const CRUSH_DAMAGE = 40;
const LIFE = 2500;
/** The pit opens over this long, and fades over the last of the Special. */
const OPEN = 300;

/** The darkest shade of the pit: near black, tinted by the palette. */
const PIT = 0x0a0206;

interface Held {
  /** Lifted off its feet (bosses aren't). */
  lifted: boolean;
  since: number;
}

export class DarkDominion extends Fx {
  private ground: Ink;
  private air: Ink;
  private drain: Ink;
  private seized = new Map<Hurtbox, Held>();
  private tickT = TICK;
  private crushed = false;
  private lamp: Phaser.GameObjects.Light;
  private dark: Pal;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, LIFE);
    const p = c.pal;
    this.ground = this.ink(R * 2 + 24, Math.ceil(R * 2 * GROUND) + 24);
    this.air = this.ink(R * 2 + 64, 150);
    this.drain = this.ink(320, 240);
    this.lamp = this.light(c.tx, c.ty - 10, 110, p.light, 0);
    // The tendrils and bands are drawn dark: the palette pushed down a step, with black at the bottom.
    this.dark = pal(p.hot, p.mid, p.deep, PIT, p.light);
    sound.forceGrip(world.pan(c.tx));
    this.seize();
  }

  /** Take hold of every foe on the spot not already held. */
  private seize(): void {
    const { tx, ty } = this.c;
    for (const h of this.world.hurtboxesWhere((b) => b.alive && !this.seized.has(b) && onGround(b, tx, ty, R))) {
      const lifted = bindFoe(h, CRUSH_AT - this.t + 60, LIFT);
      this.seized.set(h, { lifted, since: this.t });
      this.world.debris([this.c.pal.hot, this.c.pal.mid, PIT], h.x, h.y - h.bodyY, 5, h.y + 4, 'burst');
    }
  }

  protected step(dt: number): void {
    const { c, t } = this;
    const { tx, ty } = c;
    if (!this.crushed) {
      if (t < SEIZE_UNTIL) this.seize();
      for (const h of this.seized.keys()) if (h.alive) drag(h, tx, ty, PULL, dt);
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT += TICK;
        this.squeeze();
      }
      if (t >= CRUSH_AT) this.crush();
    }
    this.draw();
    const glow = t < CRUSH_AT ? 1.2 + 0.4 * Math.sin(t * 0.02) : 2.6 * (1 - clamp01((t - CRUSH_AT) / 500));
    this.lamp.intensity = glow * clamp01(t / OPEN);
  }

  /** Squeeze every foe held: a blow each, and a little life back to the Sith for each. */
  private squeeze(): void {
    const { tx, ty } = this.c;
    let healed = 0;
    for (const [h] of this.seized) {
      if (!h.alive) continue;
      h.hurt({ damage: TICK_DAMAGE, heavy: false, knock: 0, fromX: tx, fromY: ty });
      healed += HEAL_PER_FOE;
    }
    if (healed) this.c.hero.vitals.heal(Math.min(HEAL_CAP, healed));
  }

  /** The fist closes: everything held is slammed down into the ground. */
  private crush(): void {
    this.crushed = true;
    const { c, world } = this;
    const { tx, ty } = c;
    const p = c.pal;
    for (const [h] of this.seized) {
      if (!h.alive) continue;
      h.hurt({ damage: CRUSH_DAMAGE, heavy: true, knock: 60, fromX: tx, fromY: ty - 6 });
      // Dropped at once, and held a moment longer, flat on the ground.
      bindFoe(h, 350, 0);
      world.debris([p.core, p.hot, p.mid, PIT], h.x, h.y, 9, h.y + 6, 'burst');
    }
    sound.forceCrush(world.pan(tx));
    world.cameras.main.shake(240, 0.003);
    flare(world, tx, ty - 6, 150, p.light, 3.2, 520);
    bloom(world, tx, ty - 4, p.hot, 2.4, 380, ty + 20);
    world.debris([p.hot, p.mid, PIT], tx, ty, 18, ty + 10, 'burst');
  }

  private draw(): void {
    const { c, t } = this;
    const { tx, ty } = c;
    const p = c.pal;
    const open = easeOut(t / OPEN);
    const fade = t < CRUSH_AT ? 1 : 1 - clamp01((t - CRUSH_AT - 200) / (LIFE - CRUSH_AT - 200));

    // The pit, the sigil turning in it, and cracks down which the stolen life runs to its heart.
    const g = this.ground.begin(tx, ty, 2.5);
    pool(g, tx, ty, R * open, PIT, p.deep, fade, GROUND, 0.9);
    rune(g, tx, ty, R * 0.86 * open, -t * 0.0022, p, 0.85 * fade);
    for (let i = 0; i < 9; i++) {
      const a0 = (i / 9) * Math.PI * 2 + 0.3;
      // Each crack a few jagged steps from the rim towards the middle.
      let x = tx + Math.cos(a0) * R * 0.95 * open;
      let y = ty + Math.sin(a0) * R * 0.95 * open * GROUND;
      const pulse = 1 - ((t * 0.0016 + i * 0.137) % 1);
      for (let s = 0; s < 6; s++) {
        const u = s / 6;
        const nx = tx + (x - tx) * 0.78 + (hash(i, s, 3) - 0.5) * 3;
        const ny = ty + (y - ty) * 0.78 + (hash(i, s, 4) - 0.5) * 2;
        const hot = Math.abs(u - pulse) < 0.12 && t < CRUSH_AT;
        const n = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y)));
        for (let k = 0; k <= n; k++) {
          const px = x + ((nx - x) * k) / n;
          const py = y + ((ny - y) * k) / n;
          if (!hot && dither(Math.round(px), Math.round(py)) > 0.7 * fade) continue;
          g.put(px, py, hot ? p.core : s < 3 ? p.mid : p.deep, fade);
        }
        x = nx;
        y = ny;
      }
    }
    if (this.crushed) {
      // The crush's shockwave rolling out over the ground.
      const k = clamp01((t - CRUSH_AT) / 420);
      if (k < 1) ring(g, tx, ty, R * (0.25 + 0.95 * easeOut(k)), 3.2 * (1 - k) + 0.8, p, 1 - k);
    }
    g.end();

    // Those held: a band of dark light round each, throbbing tighter, held up by tendrils from the pit.
    const a = this.air.begin(tx, ty - 40, ty + R * GROUND + 6);
    const d = this.drain.begin((tx + c.hero.x) / 2, (ty + c.hero.y) / 2 - 20, 9400);
    if (!this.crushed) {
      for (const [h, held] of this.seized) {
        if (!h.alive) continue;
        const since = t - held.since;
        const grip = easeOut(since / 260);
        const bx = h.x;
        const by = h.y - h.bodyY;
        const tight = 1 - 0.3 * clamp01(since / (CRUSH_AT - held.since));
        const rr = (h.radius + 3.5) * tight + Math.sin(t * 0.025 + h.x) * 0.6 + (1 - grip) * 6;
        ring(a, bx, by, rr, 0.9, this.dark, grip, 0.42);
        // Crackles of light caught in the band.
        for (let k = 0; k < 3; k++) {
          const ang = hash(Math.floor(t / 50), k, Math.round(h.x)) * Math.PI * 2;
          a.put(bx + Math.cos(ang) * rr, by + Math.sin(ang) * rr * 0.42, k ? p.hot : p.core, grip);
        }
        if (held.lifted) {
          // Three tendrils rise from its shadow on the ground to the band.
          for (let k = -1; k <= 1; k++) {
            const ex = bx + k * rr * 0.8;
            const ey = by + rr * 0.42 * (k ? 0.6 : 1);
            bolt(a, h.x + k * 5, h.y, ex, ey, this.dark, Math.floor(t / 70) + k * 17, 0.8 * grip, 0.35);
          }
        }
        // Its life running to him: motes along a curve from it to his chest.
        const hx = c.hero.x;
        const hy = c.hero.y - 14;
        const mx = (bx + hx) / 2;
        const my = Math.min(by, hy) - 18;
        for (let k = 0; k < 4; k++) {
          const u = (t * 0.0011 + k / 4 + (h.x % 7) * 0.05) % 1;
          const v = 1 - u;
          const x = v * v * bx + 2 * v * u * mx + u * u * hx;
          const y = v * v * by + 2 * v * u * my + u * u * hy;
          const k2 = grip * (u < 0.15 ? u / 0.15 : 1);
          d.put(x, y, p.core, k2);
          d.put(x + 1, y, p.hot, k2 * 0.8);
          d.put(x - 1, y, p.hot, k2 * 0.8);
          d.put(x, y - 1, p.mid, k2 * 0.6);
          d.put(x, y + 1, p.mid, k2 * 0.6);
        }
      }
    } else {
      // Where each was slammed down: a flash in the pit fading fast.
      const k = clamp01((t - CRUSH_AT) / 260);
      if (k < 1) for (const [h] of this.seized) ring(a, h.x, h.y, 4 + 8 * easeIn(k), 1.2, p, 1 - k);
    }
    a.end();
    d.end();
  }
}
