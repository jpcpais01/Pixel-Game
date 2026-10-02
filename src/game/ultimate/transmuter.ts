import type Phaser from 'phaser';
import { sound } from '../../audio';
import { TRANS_HAND_Y } from '../../art/transmuter';
import type { Hurtbox } from '../combat';
import { onGround } from '../Toxins';
import { bindFoe } from '../Strings';
import { turnToMetal } from '../TransmuterFx';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, circle, clamp01, column, easeIn, easeOut, flare, Fx, GROUND, line, ring, star, strikeGround, type Ink } from './ink';
import type { Cast } from './types';

// The Transmuter's Special, the Magnum Opus: the Great Work done in a breath.
// A vast golden array blooms on the ground round her (two rings, a
// seven-pointed star, the seven planets' marks, a pillar of light on each
// point) and every foe in it is gilded: turned to a gold statue, held where it
// stands. Then the array turns and closes in on her, and as it shuts the
// statues shatter in a burst of gold flakes.

const R = 72;
/** The array blooms out over this long; the foes in it are gilded as it finishes. */
const BLOOM = 650;
/** Then it closes, and at this moment the statues shatter. */
const SHATTER = 1500;
const FADE = 520;
const GILD_DAMAGE = 6;
const SHATTER_DAMAGE = 60;
const SHATTER_KNOCK = 160;
/** Foes the array missed but standing near her at the end still catch the shards. */
const SHARD_R = 30;
const SHARD_DAMAGE = 20;
const PILLAR_H = 26;
const W = R * 2 + 24;
const H = Math.ceil(R * GROUND * 2) + 24;

/** The seven planets' marks, five by five: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn. */
const PLANETS = [
  ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
  ['.##..', '#....', '#....', '#....', '.##..'],
  ['#...#', '.###.', '#...#', '.###.', '..#..'],
  ['.###.', '#...#', '.###.', '..#..', '.###.'],
  ['..###', '...##', '.##.#', '#..#.', '.##..'],
  ['#..#.', '.#.#.', '..###', '...#.', '...#.'],
  ['.#...', '###..', '.#.#.', '.##.#', '.#..#'],
];

export class MagnumOpus extends Fx {
  private ground: Ink;
  private air: Ink;
  private lamp: Phaser.GameObjects.Light;
  private gilded: Hurtbox[] = [];
  private gildedYet = false;
  private shattered = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, SHATTER + FADE);
    this.ground = this.ink(W, H);
    this.air = this.ink(W, H + PILLAR_H + 20);
    this.lamp = this.light(c.x, c.y, 120, c.pal.light, 0.6);
    flare(world, c.x, c.y - TRANS_HAND_Y, 100, c.pal.light, 2.2, 450);
    sound.gild(world.pan(c.x), false);
  }

  protected step(): void {
    const { x, y, pal: p } = this.c;
    if (!this.gildedYet && this.t >= BLOOM) this.gild();
    if (!this.shattered && this.t >= SHATTER) this.shatter();
    const g = this.ground.begin(x, y, 3);
    const air = this.air.begin(x, y - PILLAR_H / 2, y + R * GROUND + 4);

    // How wide the array stands: blooming out, then closing in on her.
    const open = this.t < BLOOM ? easeOut(this.t / BLOOM) : 1 - 0.75 * easeIn((this.t - BLOOM) / (SHATTER - BLOOM));
    const r = R * open;
    const spin = this.t < BLOOM ? 0 : (this.t - BLOOM) * 0.0035 * (1 + (this.t - BLOOM) / 400);
    const fade = this.shattered ? 1 - clamp01((this.t - SHATTER) / FADE) : 1;
    const bright = this.t < BLOOM ? 0.75 : 0.85 + 0.15 * Math.sin(this.t * 0.03);

    if (!this.shattered) {
      // Two rings and the band between them.
      ring(g, x, y, r, 1.2, p, bright);
      circle(g, x, y, r * 0.86, p.mid, bright);
      // The seven-pointed star, each point joined to the third along.
      const pts: [number, number][] = [];
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + spin + (i * Math.PI * 2) / 7;
        pts.push([x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86 * GROUND]);
      }
      const drawn = clamp01(this.t / (BLOOM * 0.8)) * 7;
      for (let i = 0; i < 7; i++) {
        const f = clamp01(drawn - i);
        if (f <= 0) continue;
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 3) % 7];
        line(g, x0, y0, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, p.hot, bright);
      }
      circle(g, x, y, r * 0.4, p.hot, bright);
      circle(g, x, y, r * 0.32, p.deep, bright * 0.8);
      // The planets' marks round the band, and a pillar of light on each point.
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + spin + ((i + 0.5) * Math.PI * 2) / 7;
        const mx = x + Math.cos(a) * r * 0.93;
        const my = y + Math.sin(a) * r * 0.93 * GROUND;
        if (r > 24) PLANETS[i].forEach((row, ry) => [...row].forEach((on, rx) => on === '#' && g.put(mx - 2 + rx, my - 2 + ry, p.core, bright)));
        const [px, py] = pts[i];
        const rise = this.t < BLOOM ? easeOut((this.t - i * 50) / 300) : 1;
        if (rise > 0) column(air, px, py, PILLAR_H * rise * (0.7 + 0.3 * open), 1.6, p, 0.75 * bright, this.t + i * 40);
      }
      // Gilded foes catch the light: a glint runs over each statue now and then.
      for (const h of this.gilded) {
        if (!h.alive) continue;
        if (Math.floor((this.t + h.x * 7) / 120) % 4 === 0) star(air, h.x + ((h.x * 3) % 5) - 2, h.y - h.bodyY - 3, 2, p, 0.9);
      }
    } else {
      // Spent: rings of light ripple out over the ground and fade.
      const b = clamp01((this.t - SHATTER) / FADE);
      ring(g, x, y, R * 0.25 + R * 0.9 * easeOut(b), 2.4 * (1 - b) + 0.4, p, fade);
      ring(g, x, y, R * 0.2 + R * 0.55 * easeOut(b), 1.2 * (1 - b) + 0.3, p, fade * 0.7, GROUND, 0.4, 7);
    }
    g.end();
    air.end();
    this.lamp.setPosition(x, y - 8);
    this.lamp.intensity = (this.shattered ? 3 * fade : 0.6 + 1.6 * (this.t / SHATTER)) * bright;
  }

  /** The array is whole: every foe on it turns to gold and is held there. */
  private gild(): void {
    this.gildedYet = true;
    const w = this.world;
    const { x, y, pal: p } = this.c;
    const hold = SHATTER - BLOOM + 120;
    this.gilded = w.hurtboxesWhere((h) => h.alive && onGround(h, x, y, R));
    for (const h of this.gilded) {
      h.hurt({ damage: GILD_DAMAGE, heavy: false, knock: 0, fromX: x, fromY: y });
      // A boss is too great to hold: it is gilded, but only slowed to a crawl.
      if (!bindFoe(h, hold)) h.slow?.(0.25, hold, p.hot);
      turnToMetal(h, 1, hold, p.hot);
      w.debris([p.core, p.hot], h.x, h.y - h.bodyY, 5, h.y + 4, 'burst');
    }
    bloom(w, x, y, p.hot, 4, 500, y + 2, 0.55);
    sound.gild(w.pan(x), true);
  }

  /** The array shuts: the statues shatter, and the shards fly. */
  private shatter(): void {
    this.shattered = true;
    const w = this.world;
    const { x, y, pal: p } = this.c;
    const struck = new Set<Hurtbox>();
    for (const h of this.gilded) {
      if (!h.alive) continue;
      struck.add(h);
      h.hurt({ damage: SHATTER_DAMAGE, heavy: true, knock: SHATTER_KNOCK, fromX: x, fromY: y });
      // Gold flakes burst off the statue.
      w.debris(p.tints, h.x, h.y - h.bodyY, 14, h.y + 6, 'burst');
      bloom(w, h.x, h.y - h.bodyY, p.hot, 1.4, 320, h.y + 8, 0.7);
    }
    strikeGround(w, x, y, SHARD_R, { damage: SHARD_DAMAGE, heavy: true, knock: SHATTER_KNOCK }, struck);
    bloom(w, x, y - 6, p.core, 3.5, 600, y + 40);
    flare(w, x, y - 10, 220, p.light, 3.5, 650);
    w.debris(p.tints, x, y - 10, 22, y + 30, 'burst');
    w.cameras.main.shake(260, 0.001);
    sound.opusShatter(w.pan(x));
  }
}

export function magnumOpus(c: Cast): void {
  c.world.addEffect(new MagnumOpus(c.world, c));
}
