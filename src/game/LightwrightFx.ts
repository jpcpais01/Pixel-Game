import Phaser from 'phaser';
import { inFlight, type Hurtbox } from './combat';
import { HitSpark } from './Slash';
import { bloom, clamp01, flare, Fx, GROUND, hash, segDist, type Ink, type Pal } from './ultimate/ink';
import { PRISM_FRAMES } from '../art/lightwright';
import { sound } from '../audio';
import type { WorldScene } from '../scenes/WorldScene';

// The Lightwright's light, drawn pixel by pixel like the Specials (see
// ultimate/ink.ts):
//  - FocusRay: the basic attack, an instant line of sunlight from the lens to
//    the first foe in its way (or out to its full reach), there and gone in
//    a blink: a white-hot core, the warm colours either side, a burst where
//    it sears.
//  - Prism: the ability, a crystal hanging over a spot that splits the light
//    into spectrum beams sweeping round it, burning what they cross, then
//    flares and shatters.

/** Colours of one look's light: the ray's palette and the prism's spectrum, edge to edge. */
export interface LightStyle {
  /** The look's key: its prism texture is `lw_prism_<key>`. */
  key: string;
  pal: Pal;
  spectrum: number[];
}

// ---------------------------------------------------------------------------
// The focus ray

/** How long the ray hangs in the air, ms. */
const RAY_LIFE = 150;

/** Walk a ray from (x, y) along (ux, uy) at `fly` px up, to the first body it meets within `reach`. */
export function traceRay(world: WorldScene, x: number, y: number, ux: number, uy: number, fly: number, reach: number): { hit: Hurtbox | null; dist: number } {
  for (let d = 4; d <= reach; d += 2) {
    const gx = x + ux * d;
    const gy = y + uy * d;
    const h = world.firstHurtbox((b) => b.alive && inFlight(b, gx, gy, fly, 1));
    if (h) return { hit: h, dist: d };
  }
  return { hit: null, dist: reach };
}

/**
 * The ray itself: from the lens (x0, y0) to (x1, y1) on screen, three pixels
 * wide at its brightest, narrowing to a thread as it fades; a flare at the
 * lens and, where it struck, a burst.
 */
export class FocusRay extends Fx {
  private g: Ink;
  private cx: number;
  private cy: number;

  constructor(
    world: WorldScene,
    private x0: number,
    private y0: number,
    private x1: number,
    private y1: number,
    private p: Pal,
    private depth: number,
    struck: boolean,
  ) {
    super(world, RAY_LIFE);
    this.cx = (x0 + x1) / 2;
    this.cy = (y0 + y1) / 2;
    this.g = this.ink(Math.ceil(Math.abs(x1 - x0)) + 16, Math.ceil(Math.abs(y1 - y0)) + 16);
    flare(world, x0, y0, 50, p.light, 1.2, 160);
    if (struck) {
      bloom(world, x1, y1, p.hot, 0.8, 220, depth + 1);
      world.addEffect(new HitSpark(world, x1, y1, p, depth + 1, false));
    }
  }

  protected step(): void {
    const k = this.t / this.life;
    const { x0, y0, x1, y1, p } = this;
    const g = this.g.begin(this.cx, this.cy, this.depth);
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    // Thinner as it fades: three bands, then one.
    const w = k < 0.35 ? 1 : k < 0.7 ? 0.5 : 0;
    const n = Math.ceil(len);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ux * i;
      const y = y0 + uy * i;
      // A shimmer travelling along it, like heat.
      const hot = (i + Math.floor(this.t / 25)) % 7 === 0;
      g.put(x, y, hot || k < 0.4 ? p.core : p.hot, 1 - k * 0.5);
      if (w > 0) {
        g.put(x - uy, y + ux, p.hot, 1 - k);
        g.put(x + uy, y - ux, p.mid, 1 - k);
      }
      if (w > 0.75 && i % 2 === 0) {
        g.put(x - uy * 2, y + ux * 2, p.mid, 0.6);
        g.put(x + uy * 2, y - ux * 2, p.deep, 0.5);
      }
    }
    // The flare at the lens: a little star.
    const s = k < 0.5 ? 3 : 1;
    for (let i = -s; i <= s; i++) {
      g.put(x0 + i, y0, Math.abs(i) < 2 ? p.core : p.hot, 1 - k);
      g.put(x0, y0 + i, Math.abs(i) < 2 ? p.core : p.mid, 1 - k);
    }
    g.end();
  }
}

// ---------------------------------------------------------------------------
// The prism

const PRISM_FLY = 280;
/** How long it splits the light after landing, ms. */
export const PRISM_SHINE = 3000;
const PRISM_FADE = 380;
/** Hover height over its spot. */
const PRISM_H = 11;
const BEAMS = 3;
const BEAM_LEN = 46;
/** Radians a second the beams sweep round. */
const SWEEP = 1.35;
/** A foe takes a beam's burn at most this often, ms. */
const BURN_EVERY = 220;
const BURN_DAMAGE = 4;
const BURN_REACH = 4;
/** The shattering at the end. */
const SHATTER_R = 26;
const SHATTER_DAMAGE = 9;

/**
 * The prism: tossed in an arc, it hangs turning over the spot, and white
 * light pouring down into it leaves as three spectrum beams that sweep round
 * and round, burning each foe they cross. At the end it flares and shatters
 * in a ring of glints that strikes everything near.
 */
export class Prism extends Fx {
  private g: Ink;
  private crystal: Phaser.GameObjects.Sprite;
  private shine: Phaser.GameObjects.Sprite;
  private shade: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private burnt = new Map<Hurtbox, number>();
  private landed = false;
  private shattered = false;
  private hueT = 0;
  private humT = 0;

  constructor(
    world: WorldScene,
    private x0: number,
    private y0: number,
    private tx: number,
    private ty: number,
    private st: LightStyle,
  ) {
    super(world, PRISM_FLY + PRISM_SHINE + PRISM_FADE);
    this.g = this.ink(BEAM_LEN * 2 + 16, Math.ceil(BEAM_LEN * GROUND * 2) + PRISM_H + 24);
    const key = `lw_prism_${st.key}`;
    this.crystal = this.own(world.add.sprite(x0, y0, key, 'p0').setPipeline('Lit'));
    this.shine = this.own(world.add.sprite(x0, y0, `${key}_e`, 'p0').setBlendMode(Phaser.BlendModes.ADD));
    this.shade = this.own(world.add.image(tx, ty, 'shadow').setDepth(1).setScale(0.45, 0.35).setAlpha(0));
    this.lamp = this.light(x0, y0, 70, st.pal.light, 0.6);
  }

  /** The time it still has to burn, for the HUD's timer. */
  timeLeft(): { left: number; total: number } | null {
    if (this.dead || this.shattered) return null;
    return { left: PRISM_FLY + PRISM_SHINE - this.t, total: PRISM_FLY + PRISM_SHINE };
  }

  protected step(dt: number): void {
    const w = this.world;
    const { tx, ty, st } = this;
    const p = st.pal;
    let ox = tx;
    let oy = ty - PRISM_H;
    const frame = `p${Math.floor(this.t / 70) % PRISM_FRAMES}`;
    if (this.t < PRISM_FLY) {
      const k = this.t / PRISM_FLY;
      ox = this.x0 + (tx - this.x0) * k;
      oy = this.y0 + (ty - PRISM_H - this.y0) * k - Math.sin(k * Math.PI) * 14;
      this.shade.setAlpha(0.3 * k);
    } else if (!this.landed) {
      this.landed = true;
      flare(w, tx, ty - PRISM_H, 80, p.light, 1.8, 300);
      bloom(w, tx, ty - PRISM_H, p.hot, 1.2, 300, ty + 20);
      sound.prism(w.pan(tx));
    }
    const shining = this.t >= PRISM_FLY && this.t < PRISM_FLY + PRISM_SHINE;
    if (this.landed) oy += Math.round(Math.sin(this.t * 0.006) * 1);
    this.crystal.setPosition(Math.round(ox), Math.round(oy)).setDepth(ty + 0.5).setFrame(frame).setVisible(!this.shattered);
    this.shine.setPosition(Math.round(ox), Math.round(oy)).setDepth(ty + 0.6).setFrame(frame).setVisible(!this.shattered);
    this.lamp.setPosition(ox, oy);

    const g = this.g.begin(tx, ty - PRISM_H / 2, ty + 1);
    if (shining) {
      const s = this.t - PRISM_FLY;
      const open = clamp01(s / 220);
      const len = BEAM_LEN * open;
      const rot = s * 0.001 * SWEEP;
      // The white light falling into it from above.
      for (let y = 1; y < 14; y++) if (hash(y, Math.floor(this.t / 60)) > 0.25) g.put(ox, oy - 3 - y, y < 5 ? p.core : p.hot, 1 - y / 14);
      // The beams: each a fan of spectrum bands, the colours side by side, sweeping round on the ground's plane.
      const sp = st.spectrum;
      for (let b = 0; b < BEAMS; b++) {
        const a = rot + (b / BEAMS) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const steps = Math.ceil(len * 1.2);
        for (let i = 2; i <= steps; i++) {
          const r = (i / steps) * len;
          const f = r / BEAM_LEN;
          // The spread widens out from the crystal.
          const half = 0.5 + f * 2.2;
          const bands = sp.length;
          for (let j = 0; j < bands; j++) {
            const off = ((j + 0.5) / bands - 0.5) * 2 * half;
            const x = ox + ca * r - sa * off;
            const y = oy + sa * r * GROUND + ca * off * GROUND + f * PRISM_H * 0.8;
            g.put(x, y, f < 0.15 ? p.core : sp[j], f > 0.85 ? 0.6 : 1);
          }
        }
        // Where the beam meets the ground at its end, a small burning spot.
        const ex = tx + ca * len;
        const ey = ty + sa * len * GROUND;
        g.put(ex, ey, p.core, 0.9);
        g.put(ex + 1, ey, p.hot, 0.7);
        g.put(ex - 1, ey, p.hot, 0.7);
      }
      this.burn(dt, rot, len);
      // The light round it shifts through the spectrum as it turns.
      this.hueT += dt;
      this.lamp.setIntensity(1.2 + 0.25 * Math.sin(this.t * 0.01));
      this.lamp.setColor(st.spectrum[Math.floor(this.hueT / 160) % st.spectrum.length]);
      this.humT -= dt;
      if (this.humT <= 0) {
        this.humT = 600;
        sound.prism(w.pan(tx), true);
      }
    } else if (this.t >= PRISM_FLY + PRISM_SHINE) {
      if (!this.shattered) this.shatter();
      const k = clamp01((this.t - PRISM_FLY - PRISM_SHINE) / PRISM_FADE);
      // Glints thrown out in a ring, falling as they go.
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + hash(i, 5) * 0.3;
        const r = SHATTER_R * (0.2 + 0.9 * k) * (0.7 + 0.3 * hash(i, 9));
        const c = i % 3 === 0 ? p.core : st.spectrum[i % st.spectrum.length];
        g.put(tx + Math.cos(a) * r, oy + Math.sin(a) * r * GROUND + k * k * PRISM_H, c, 1 - k);
      }
      this.lamp.setIntensity(2.4 * (1 - k));
      this.shade.setAlpha(0.3 * (1 - k));
    }
    g.end();
  }

  /** Burn each foe a beam crosses (on its feet's plane), each no more often than BURN_EVERY. */
  private burn(dt: number, rot: number, len: number): void {
    const w = this.world;
    const { tx, ty, st } = this;
    for (const [h, left] of this.burnt) this.burnt.set(h, left - dt);
    const foes = w.hurtboxesWhere((h) => h.alive && (this.burnt.get(h) ?? 0) <= 0 && Math.hypot(h.x - tx, (h.y - ty) / GROUND) <= len + h.radius);
    for (const h of foes) {
      for (let b = 0; b < BEAMS; b++) {
        const a = rot + (b / BEAMS) * Math.PI * 2;
        const ex = tx + Math.cos(a) * len;
        const ey = ty + Math.sin(a) * len * GROUND;
        if (segDist(h.x, h.y, tx, ty, ex, ey) > h.radius + BURN_REACH) continue;
        this.burnt.set(h, BURN_EVERY);
        h.hurt({ damage: BURN_DAMAGE, heavy: false, knock: 10, fromX: tx, fromY: ty });
        w.debris([st.pal.core, ...st.spectrum.slice(0, 3)], h.x, h.y - h.bodyY, 3, h.y + 10, 'burst');
        break;
      }
    }
  }

  private shatter(): void {
    this.shattered = true;
    const w = this.world;
    const { tx, ty, st } = this;
    const p = st.pal;
    const hits = w.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - tx, (h.y - ty) / GROUND) <= SHATTER_R + h.radius);
    for (const h of hits) h.hurt({ damage: SHATTER_DAMAGE, heavy: true, knock: 110, fromX: tx, fromY: ty });
    bloom(w, tx, ty - PRISM_H, p.core, 1.8, 380, ty + 20);
    flare(w, tx, ty - PRISM_H, 110, p.light, 2.4, 380);
    w.debris([p.core, ...st.spectrum], tx, ty - PRISM_H, 14, ty + 12, 'burst');
    sound.prism(w.pan(tx), false, true);
  }
}
