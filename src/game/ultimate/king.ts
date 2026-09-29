import type Phaser from 'phaser';
import { sound } from '../../audio';
import { bindFoe } from '../Strings';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, column, dither, easeIn, easeOut, flare, Fx, GROUND, ring, strikeGround, type Ink, type Pal } from './ink';

// The King's Special, the Crown of Kings: a great crown of light comes down
// out of the sky onto the spot, ringing everything under it, and lands with a
// blow. A moment later a pillar of light bursts up from each of its points
// and every foe within reach is struck again and forced to kneel. Afonso
// Henriques casts it as the Miracle of Ourique, in white and blue.

const APPEAR = 220;
const FALL = 240;
/** The crown's radius on the ground; the first blow lands inside it. */
const CROWN_R = 40;
const CROWN_DAMAGE = 70;
/** How high its band stands, and its points above that. */
const BAND = 6;
const POINT = 12;
const POINTS = 8;
/** The pillars burst this long after it lands, striking further out. */
const PILLARS_AT = 520;
const PILLAR_R = 58;
const PILLAR_DAMAGE = 24;
const KNEEL_MS = 1600;
const LIFE = 2300;
const DROP = 150;
const PILLAR_H = 40;

export class KingsCrown extends Fx {
  private back: Ink;
  private front: Ink;
  private ground: Ink;
  private glow: Phaser.GameObjects.Image;
  private landed = false;
  private burst = false;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
  ) {
    super(world, LIFE);
    const w = CROWN_R * 2 + 12;
    const h = Math.ceil(CROWN_R * 2 * GROUND) + BAND + POINT + PILLAR_H + 14;
    this.back = this.ink(w, h);
    this.front = this.ink(w, h);
    this.ground = this.ink(PILLAR_R * 2 + 16, Math.ceil(PILLAR_R * 2 * GROUND + 16));
    this.glow = this.halo(p.hot, 1.6, y + 3);
    sound.starcall(world.pan(x));
  }

  protected step(): void {
    const { x, y, p, t } = this;
    const hit = APPEAR + FALL;
    if (!this.landed && t >= hit) this.land();
    if (this.landed && !this.burst && t >= hit + PILLARS_AT) this.pillars();

    const drop = t < APPEAR ? DROP : t < hit ? DROP * (1 - easeIn((t - APPEAR) / FALL)) : 0;
    const a = t < APPEAR ? t / APPEAR : 1 - clamp01((t - 1700) / 600);
    const spin = t * 0.0006;
    const gy = y - drop;
    // The half of the crown beyond the spot stands behind whoever is inside it, the near half in front.
    const foot = gy + CROWN_R * GROUND + 6;
    const b = this.back.begin(x, foot, y - CROWN_R * GROUND, 0.5, 1);
    const f = this.front.begin(x, foot, y + CROWN_R * GROUND + 2, 0.5, 1);
    if (a > 0) this.crown(b, f, gy, spin, a);
    if (this.burst) this.drawPillars(b, f, spin);
    b.end();
    f.end();
    this.glow.setPosition(x, gy - BAND - 4).setAlpha(0.6 * Math.max(0, a));

    const g = this.ground.begin(x, y, 2.5);
    if (this.landed) {
      const since = t - hit;
      const k = since / 420;
      if (k < 1) ring(g, x, y, CROWN_R * (0.6 + 0.4 * easeOut(k)), 3 * (1 - k) + 0.8, p, 1 - k);
      if (this.burst) {
        const q = (since - PILLARS_AT) / 450;
        if (q < 1) ring(g, x, y, CROWN_R + (PILLAR_R - CROWN_R) * easeOut(q), 2.4 * (1 - q) + 0.6, p, 1 - q);
      }
    }
    g.end();
  }

  /** The crown on the ground round (x, gy): its band and points, back half and front half on their own layers. */
  private crown(b: Ink, f: Ink, gy: number, spin: number, a: number): void {
    const { x, p } = this;
    const steps = Math.ceil(CROWN_R * 2 * Math.PI * 0.8);
    const put = (ink: Ink, px: number, py: number, c: number) => {
      if (a < 1 && dither(Math.round(px), Math.round(py)) >= a) return;
      ink.put(px, py, c);
    };
    for (const near of [false, true]) {
      const ink = near ? f : b;
      for (let i = 0; i < steps; i++) {
        const th = (i / steps) * Math.PI * 2;
        const s = Math.sin(th);
        if (near !== s > 0) continue;
        const bx = x + Math.cos(th) * CROWN_R;
        const by = gy + s * CROWN_R * GROUND;
        // The band: bright rims top and bottom, its face lit on the near side and in shade beyond.
        for (let h = 0; h < BAND; h++) {
          const rim = h === 0 || h === BAND - 1;
          put(ink, bx, by - h, near ? (rim ? p.core : h === 2 ? p.hot : p.mid) : rim ? p.mid : p.deep);
        }
      }
      // The points, each a tapering spike ending in a pearl of light, and a gem on the band beneath.
      for (let i = 0; i < POINTS; i++) {
        const th = spin + (i / POINTS) * Math.PI * 2;
        const s = Math.sin(th);
        if (near !== s > 0) continue;
        const bx = x + Math.cos(th) * CROWN_R;
        const by = gy + s * CROWN_R * GROUND - BAND;
        for (let h = 0; h < POINT; h++) {
          const hw = Math.round(2.5 * (1 - h / POINT));
          for (let dx = -hw; dx <= hw; dx++) put(ink, bx + dx, by - h, near ? (dx === -hw ? p.core : dx === hw ? p.mid : p.hot) : dx === -hw ? p.mid : p.deep);
        }
        for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1]]) put(ink, bx - 0.5 + dx, by - POINT - 1 + dy, p.core);
        if (near) for (const [dx, dy] of [[0, 0], [1, 0]]) put(ink, bx - 0.5 + dx, by + BAND / 2 + dy, p.core);
      }
    }
  }

  /** Pillars of light rising from each point of the crown, fading as they go. */
  private drawPillars(b: Ink, f: Ink, spin: number): void {
    const { x, y, p, t } = this;
    const since = t - APPEAR - FALL - PILLARS_AT;
    const a = 1 - clamp01(since / 700);
    if (a <= 0) return;
    const rise = easeOut(since / 220);
    for (let i = 0; i < POINTS; i++) {
      const th = spin + (i / POINTS) * Math.PI * 2;
      const px = x + Math.cos(th) * CROWN_R;
      const py = y + Math.sin(th) * CROWN_R * GROUND - BAND - POINT;
      column(Math.sin(th) > 0 ? f : b, px, py, Math.round(PILLAR_H * rise), 2.2, p, a, t);
    }
  }

  private land(): void {
    this.landed = true;
    const { world, x, y, p } = this;
    strikeGround(world, x, y, CROWN_R, { damage: CROWN_DAMAGE, heavy: true, knock: 60, fromX: x, fromY: y - 4 });
    world.cameras.main.shake(260, 0.004);
    world.debris(p.tints, x, y - 4, 26, y + 20, 'burst');
    world.debris([0xb8a890, 0x7a6a58, p.mid], x, y - 2, 12, y + 20, 'spores');
    flare(world, x, y - 20, 220, p.light, 4.5, 700);
    bloom(world, x, y - 10, p.hot, 4, 420, y + 30);
    sound.slam(world.pan(x));
    sound.starImpact(world.pan(x));
  }

  /** Light bursts up from every point: a second blow further out, and all it reaches kneel. */
  private pillars(): void {
    this.burst = true;
    const { world, x, y, p } = this;
    for (const h of strikeGround(world, x, y, PILLAR_R, { damage: PILLAR_DAMAGE, heavy: true, knock: 40, fromX: x, fromY: y - 4 })) bindFoe(h, KNEEL_MS);
    world.cameras.main.shake(160, 0.0018);
    world.debris(p.tints, x, y - 20, 22, y + 20, 'burst');
    flare(world, x, y - 30, 200, p.light, 3, 500);
    sound.decree(world.pan(x));
  }
}
