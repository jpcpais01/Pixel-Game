import type Phaser from 'phaser';
import { sound } from '../../audio';
import { Venom, type ToxStyle } from '../Toxins';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, bump, clamp01, column, drag, easeOut, flare, Fx, GROUND, hash, pool, ring, rune, star, strikeGround, type Ink, type Pal } from './ink';
import type { Cast } from './types';

// The wizard's Specials: the Arcanist tears open a singularity that drags
// foes in and bursts; the Pyromancer sends a tide of eruptions marching out.

/** The Arcanist's Singularity: a rune, a black star that swallows light and foes, then a nova. */
export class Singularity extends Fx {
  private ground: Ink;
  private air: Ink;
  private glow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private tick = 0;
  private burst = false;
  private readonly R = 46;
  private static readonly COLLAPSE = 2000;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
  ) {
    super(world, 2700);
    this.ground = this.ink(150, 96);
    this.air = this.ink(112, 84);
    this.glow = this.halo(p.mid, 1, y + 21);
    this.lamp = this.light(x, y - 14, 110, p.light, 0);
    sound.gravityWell(1.9);
  }

  protected step(dt: number): void {
    const { x, y, p, R, t } = this;
    const C = Singularity.COLLAPSE;
    const open = easeOut(t / 300);
    const oy = y - 16;

    // The pull and the grind while it holds open.
    if (t < C) {
      for (const h of this.world.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - x, (b.y - y) / GROUND) < R + 24)) drag(h, x, y, 42, dt);
      this.tick -= dt;
      if (this.tick <= 0 && t > 250) {
        this.tick = 220;
        strikeGround(this.world, x, y, R, { damage: 5, knock: 0 });
      }
    } else if (!this.burst) {
      this.burst = true;
      strikeGround(this.world, x, y, 64, { damage: 58, heavy: true, knock: 180, fromX: x, fromY: y - 6 });
      this.world.cameras.main.shake(260, 0.004);
      this.world.debris(p.tints, x, oy, 34, y + 30, 'burst');
      this.world.debris([p.core, p.hot], x, y - 2, 16, y + 30, 'spores');
      flare(this.world, x, y - 10, 240, p.light, 5, 800);
      bloom(this.world, x, oy, p.hot, 5, 500, y + 40);
      sound.nova();
    }

    // The ground: a turning rune and a dark stain under the hole; after the burst, the nova ring.
    const g = this.ground.begin(x, y, 2.5);
    const fade = t < C + 150 ? 1 : 1 - clamp01((t - C - 150) / 500);
    rune(g, x, y, R * open, t * 0.0025, p, 0.9 * fade);
    if (t < C) pool(g, x, y, R * 0.6 * open, 0x0a0616, p.deep, 0.8, GROUND, 0.55);
    if (t >= C) {
      const k = (t - C) / 520;
      ring(g, x, y, 4 + 66 * easeOut(k), 4 * (1 - k) + 1, p, 1 - k);
      ring(g, x, y, 2 + 40 * easeOut(k * 1.3), 2, p, 0.7 * (1 - k), GROUND, 0.4, 7);
    }
    g.end();

    // The air: three arms of light spiralling in and up into the black star.
    const a = this.air.begin(x, oy + 4, y + 20);
    const grow = t < C ? easeOut(t / 900) : 1 - clamp01((t - C) / 150);
    const orb = 2 + 7 * grow;
    if (t < C + 150) {
      const spin = t * 0.004;
      for (let arm = 0; arm < 3; arm++) {
        for (let k = 0; k < 24; k++) {
          const f = k / 24;
          const rho = R * (1 - f) * open;
          const th = spin + (arm * Math.PI * 2) / 3 + f * 3.4;
          const px = x + Math.cos(th) * rho;
          const py = y + Math.sin(th) * rho * GROUND - f * 16;
          const c = f > 0.8 ? p.core : f > 0.55 ? p.hot : f > 0.3 ? p.mid : p.deep;
          a.put(px, py, c, grow);
          if (f > 0.4) a.put(px + 1, py, p.deep, grow * 0.7);
        }
      }
      // The black star: a bright rim round a heart of nothing, circled by a tilted disc.
      for (let dy = -Math.ceil(orb) - 1; dy <= orb + 1; dy++) {
        for (let dx = -Math.ceil(orb) - 1; dx <= orb + 1; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > orb + 1) continue;
          a.put(x + dx, oy + dy, d < orb - 1.2 ? 0x07040f : d < orb ? p.core : p.mid, 1);
        }
      }
      const disc = orb * 2.1;
      for (let i = 0; i < 64; i++) {
        const th = (i / 64) * Math.PI * 2 + t * 0.006;
        const px = x + Math.cos(th) * disc;
        const py = oy + Math.sin(th) * disc * 0.3;
        // The far half of the disc hides behind the star.
        if (Math.sin(th) < 0 && Math.abs(px - x) < orb) continue;
        a.put(px, py, hash(i, 3) > 0.5 ? p.hot : p.mid, 0.95);
      }
    }
    a.end();

    this.glow.setPosition(x, oy).setScale(0.6 + grow * 1.2).setAlpha(t < C ? 0.35 + 0.15 * Math.sin(t * 0.01) : 0);
    this.lamp.intensity = t < C ? 2.2 * open : 0;
  }
}

/** Burning, for the Inferno: stacks and ticks like poison, in fire colours. */
const BURN: ToxStyle = {
  core: 0xfff8e0,
  hot: 0xffd66b,
  mid: 0xff9a2e,
  deep: 0xd9432b,
  murk: 0x3a1410,
  tints: [0xfff0b0, 0xffb040, 0xff6a24],
  light: 0xff8a30,
  numbers: 0xffa040,
  suffix: '_pyro',
};

const ERUPTIONS = 7;
const ERUPT_EVERY = 110;

/** The Pyromancer's Inferno: pillars of fire bursting from the ground one after another along the aim, the last the greatest. */
export class Inferno extends Fx {
  private burn: Venom;
  private next = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, ERUPTIONS * ERUPT_EVERY + 4200);
    this.burn = new Venom(world, BURN, 4);
    sound.ignite();
  }

  protected step(dt: number): void {
    const { c } = this;
    while (this.next < ERUPTIONS && this.t >= this.next * ERUPT_EVERY) {
      const i = this.next++;
      const d = 22 + i * 21;
      const x = c.x + c.dx * d;
      const y = c.y + c.dy * d;
      if (!this.world.walkable(x, y)) {
        this.next = ERUPTIONS;
        break;
      }
      const big = i === ERUPTIONS - 1;
      this.world.addEffect(new Eruption(this.world, x, y, c.pal, big ? 1.5 : 1, (hit) => hit.forEach((h) => this.burn.dose(h, 3000, big ? 2 : 1))));
      if (i % 2 === 0 || big) sound.starImpact(this.world.pan(x));
    }
    this.burn.update(dt);
  }
}

/** One pillar of the Inferno: a flash of fire from a ring on the ground, leaving a scorch. */
class Eruption extends Fx {
  private pix: Ink;
  private struck = false;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    private k: number,
    private onHit: (hit: Hurtbox[]) => void,
  ) {
    super(world, 700);
    this.pix = this.ink(Math.round(64 * k), Math.round(80 * k));
  }

  protected step(): void {
    const { x, y, p, k, t } = this;
    if (!this.struck && t >= 40) {
      this.struck = true;
      this.onHit(strikeGround(this.world, x, y, 17 * k, { damage: Math.round(26 * k), heavy: true, knock: 80 * k, fromX: x, fromY: y + 4 }));
      this.world.debris(p.tints, x, y - 6, Math.round(10 * k), y + 20, 'burst');
      this.world.debris([p.hot, p.mid, 0x5a3a2a], x, y - 4, Math.round(5 * k), y + 20, 'spores');
      flare(this.world, x, y - 12, 90 * k, p.light, 2.4 * k, 450);
      if (k > 1) this.world.cameras.main.shake(180, 0.0025);
    }
    const f = t / 700;
    const g = this.pix.begin(x, y + 8 * k, y + 2, 0.5, 1);
    pool(g, x, y, 14 * k * easeOut(f * 3), 0x2a1410, 0x4a2014, 1 - clamp01((f - 0.5) * 2), GROUND, 0.7);
    ring(g, x, y, (3 + 16 * easeOut(f * 2)) * k, 2 * k, p, 1 - f);
    const h = 44 * k * Math.pow(bump(Math.min(1, f * 1.4)), 0.6);
    column(g, x, y, h, (1.5 + 4 * (1 - f)) * k, p, 1 - f * 0.6, t + x);
    // Tongues of flame licking off the pillar's top.
    for (let i = 0; i < 6; i++) {
      const s = hash(i, Math.floor(t / 70), Math.round(x));
      g.put(x + (s - 0.5) * 8 * k, y - h * (0.7 + s * 0.35), s > 0.5 ? p.hot : p.mid, 1 - f);
    }
    if (f < 0.3) star(g, x, y - 2, Math.round(5 * k * (1 - f / 0.3)), p);
    g.end();
  }
}
