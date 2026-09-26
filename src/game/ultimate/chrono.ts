import Phaser from 'phaser';
import { sound } from '../../audio';
import { snap } from '../display';
import { dirOf } from '../Wizard';
import { onGround } from '../Toxins';
import { clockFace, TimeBolt, type BoltKind } from '../Chronos';
import { CHRONO_H, CHRONO_ORIGIN_X, CHRONO_ORIGIN_Y, CHRONO_W } from '../../art/chrono';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, circle, clamp01, easeOut, flare, Fx, ring, strikeGround, type Ink } from './ink';
import type { Cast } from './types';

// The Chronomancer's Specials: the timekeeper's time stop, a great clock
// laid over the ground round him under which everything stands frozen until
// its hour strikes; and the paradox's legion of echoes, four of himself from
// other moments who fight at his side.

const STOP_TIME = 4000;
const STOP_R = 118;

/** The Timekeeper's Time Stop: everything round him frozen still under a great clock until its hand comes round, then struck all at once. */
export class TimeStop extends Fx {
  private face: Ink;
  private holdT = 0;
  private struck = false;
  private caught = new Set<Hurtbox>();

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, STOP_TIME + 520);
    this.face = this.ink(STOP_R * 2 + 16, Math.ceil(STOP_R * 2 * 0.58) + 16);
    sound.timeStop(world.pan(c.x));
    // Dust hangs in the air, stopped where it was.
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * STOP_R * 0.9;
      world.debris(c.pal.tints, snap(c.x + Math.cos(a) * r), snap(c.y + Math.sin(a) * r * 0.58) - 6 - Math.random() * 20, 2, c.y + 40, 'gather');
    }
  }

  protected step(dt: number): void {
    const { c, t } = this;
    const g = this.face.begin(c.x, c.y, 2.5);
    if (t < STOP_TIME) {
      const open = easeOut(t / 420);
      const fade = t > STOP_TIME - 200 ? 0.7 + 0.3 * Math.sin(t * 0.08) : 1;
      // The minute hand ticks round once, a notch at a time; the hour hand creeps.
      clockFace(g, c.x, c.y, STOP_R * open, c.pal, open * fade, Math.floor((t / STOP_TIME) * 12) / 12, t / STOP_TIME / 12);
      circle(g, c.x, c.y, STOP_R * open * 0.5, c.pal.deep, open * 0.6);
      // Everything under it stands frozen, the hold renewed so newcomers freeze too.
      this.holdT -= dt;
      if (this.holdT <= 0) {
        this.holdT = 160;
        for (const h of this.world.hurtboxesWhere((h) => h.alive && onGround(h, c.x, c.y, STOP_R))) {
          h.slow?.(0, Math.min(500, STOP_TIME - t + 120), c.pal.hot);
          this.caught.add(h);
        }
      }
    } else {
      if (!this.struck) this.strike();
      const k = (t - STOP_TIME) / 520;
      ring(g, c.x, c.y, STOP_R * (0.95 + 0.25 * easeOut(k)), 3 * (1 - k) + 0.6, c.pal, 1 - k);
      circle(g, c.x, c.y, STOP_R * 0.6 * (1 - easeOut(k)), c.pal.core, 1 - k);
    }
    g.end();
  }

  /** Time starts again, and every blow it held back lands at once. */
  private strike(): void {
    this.struck = true;
    const { c, world } = this;
    const hit = strikeGround(world, c.x, c.y, STOP_R, { damage: 30, heavy: true, knock: 170, fromX: c.x, fromY: c.y - 4 });
    for (const h of hit) {
      world.debris(c.pal.tints, snap(h.x), snap(h.y - h.bodyY), 8, h.y + 20);
      bloom(world, h.x, h.y - h.bodyY, c.pal.hot, 0.9, 260, h.y + 20, 0.8);
    }
    sound.hourStrike(world.pan(c.x));
    world.cameras.main.shake(180, 0.003);
    flare(world, c.x, c.y - 10, STOP_R * 1.2, c.pal.light, 3.5, 700);
    world.debris(c.pal.tints, snap(c.x), snap(c.y) - 8, 24, c.y + 20, 'burst');
  }
}

const LEGION_TIME = 6000;
const LEGION_N = 4;
/** Each echo throws at the nearest foe this close to it, this often. */
const LEGION_REACH = 165;
const LEGION_EVERY = 720;

/** The Paradox's Legion of Echoes: four of himself from other moments step out round him and throw shards at every foe near, then fold back into him in a burst. */
export class Legion extends Fx {
  private echoes: { s: Phaser.GameObjects.Sprite; next: number; castT: number }[] = [];
  private bolt: BoltKind;
  private key: string;
  private burst = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, LEGION_TIME);
    this.key = c.hero.sprite.texture.key;
    this.bolt = { key: this.key, rift: true, pal: c.pal, damage: 8, speed: 250, range: 175, slow: 1, slowFloor: 1, slowMs: 0, lit: false };
    for (let i = 0; i < LEGION_N; i++) {
      const s = this.own(
        world.add
          .sprite(c.x, c.y, this.key, 'idle_down_0')
          .setOrigin(CHRONO_ORIGIN_X / CHRONO_W, CHRONO_ORIGIN_Y / CHRONO_H)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(c.pal.hot)
          .setAlpha(0),
      );
      s.play({ key: `${this.key}_idle_down`, startFrame: i % 3 });
      this.echoes.push({ s, next: 380 + i * (LEGION_EVERY / LEGION_N), castT: 0 });
      const a = (i / LEGION_N) * Math.PI * 2;
      bloom(world, c.x + Math.cos(a) * 24, c.y + Math.sin(a) * 14 - 12, c.pal.hot, 1, 320, c.y + 20, 0.7);
    }
    sound.echoes(world.pan(c.x));
    flare(world, c.x, c.y - 12, 120, c.pal.light, 2.6, 800);
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const h = c.hero;
    const open = easeOut(t / 350);
    const fold = clamp01((t - (LEGION_TIME - 450)) / 450);
    this.echoes.forEach((e, i) => {
      // They stand round him in a slowly turning ring, drawn in as it ends.
      const a = t * 0.0009 + (i / LEGION_N) * Math.PI * 2;
      const r = 24 * open * (1 - easeOut(fold));
      const x = h.x + Math.cos(a) * r;
      const y = h.y + Math.sin(a) * r * 0.6;
      e.s.setPosition(snap(x), snap(y)).setDepth(y - 0.2).setAlpha((0.55 + 0.1 * Math.sin(t * 0.006 + i)) * open * (1 - fold) * h.alpha);
      // Each throws at the nearest foe in turn.
      e.castT -= dt;
      if (e.castT <= 0 && !e.s.anims.currentAnim?.key.includes('_idle_')) e.s.play(`${this.key}_idle_down`);
      if (fold === 0 && t >= e.next) {
        e.next += LEGION_EVERY;
        const foe = this.nearest(x, y);
        if (!foe) return;
        let dx = foe.x - x;
        let dy = foe.y - y;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l;
        dy /= l;
        e.s.play(`${this.key}_cast_${dirOf(dx, dy)}`);
        e.castT = 330;
        world.time.delayedCall(120, () => {
          if (this.dead) return;
          world.addEffect(new TimeBolt(world, e.s.x + dx * 7, e.s.y + dy * 3 + 1, dx, dy, this.bolt, 0.9));
          sound.chronoCast(world.pan(e.s.x), true);
        });
      }
    });
    if (fold >= 1 && !this.burst) this.foldIn();
  }

  /** The echoes fold back into him and burst out as one. */
  private foldIn(): void {
    this.burst = true;
    const { c, world } = this;
    const h = c.hero;
    const hit = strikeGround(world, h.x, h.y, 52, { damage: 24, heavy: true, knock: 220, fromX: h.x, fromY: h.y - 4 });
    for (const f of hit) world.debris(c.pal.tints, snap(f.x), snap(f.y - f.bodyY), 6, f.y + 20);
    sound.rewind(world.pan(h.x));
    bloom(world, h.x, h.y - 12, c.pal.hot, 2.4, 420, h.y + 30, 0.9);
    flare(world, h.x, h.y - 12, 110, c.pal.light, 3, 600);
    world.debris(c.pal.tints, snap(h.x), snap(h.y) - 12, 20, h.y + 20, 'burst');
  }

  private nearest(x: number, y: number): Hurtbox | null {
    let best = LEGION_REACH;
    let pick: Hurtbox | null = null;
    for (const f of this.world.hurtboxesWhere((f) => f.alive)) {
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < best) {
        best = d;
        pick = f;
      }
    }
    return pick;
  }
}
