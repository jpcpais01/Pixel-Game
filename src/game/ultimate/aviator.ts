import Phaser from 'phaser';
import { sound } from '../../audio';
import { AVI_HAND_Y, BOMB_FRAMES, PLANE_HEADINGS } from '../../art/aviator';
import { snap } from '../display';
import { bloom, clamp01, dither, easeIn, easeOut, flare, Fx, hash, ring, strikeGround, type Ink, type Pal } from './ink';
import type { Cast } from './types';

// The Aviator's Special, Bombing Run: she fires a signal flare straight up,
// and her little biplane answers it, roaring in low from behind her along
// the aim, its shadow racing over the ground, its propeller a blur, and lays
// a line of bombs ahead of her that whistle down and go off one after
// another, the last one biggest. The Flying Ace's plane is red, and so is
// its fire.

/** The plane's speed, its height over the ground (drawn that much higher) and where it starts and ends along the aim. */
const PLANE_SPEED = 270;
const PLANE_ALT = 46;
const START = -230;
const END = 330;
/** The signal flare goes up first; the plane comes this long after the cast. */
const SIGNAL_MS = 450;
/** The bombs: where along the aim each lands, how long it falls, how far it carries forward as it falls. */
const BOMBS = 8;
const FIRST_BOMB = 26;
const BOMB_GAP = 20;
const FALL_MS = 420;
const CARRY = 60;
const BOMB_DAMAGE = 22;
const BOMB_R = 20;
const LAST_DAMAGE = 34;
const LAST_R = 32;

const LIFE = SIGNAL_MS + ((END - START) / PLANE_SPEED) * 1000 + 600;

interface Bomb {
  /** Where it lands, how far along, and when it leaves the plane. */
  x: number;
  y: number;
  at: number;
  drop: number;
  last: boolean;
  /** Its sprite while it falls; then gone. */
  sprite: Phaser.GameObjects.Sprite | null;
  whistled: boolean;
  boomed: number;
}

export class BombingRun extends Fx {
  private plane: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private shade: Phaser.GameObjects.Sprite;
  private g: Ink;
  private bombs: Bomb[] = [];
  private heading: number;
  private planeKey: string;
  private bombKey: string;
  private droned = false;
  private sx: number;
  private sy: number;

  constructor(private c: Cast) {
    super(c.world, LIFE);
    const w = c.world;
    this.planeKey = c.look === 'ace' ? 'plane_aviator_ace' : 'plane_aviator';
    this.bombKey = c.look === 'ace' ? 'bomb_aviator_ace' : 'bomb_aviator';
    const a = Math.atan2(c.dy, c.dx);
    this.heading = ((Math.round((a / (Math.PI * 2)) * PLANE_HEADINGS) % PLANE_HEADINGS) + PLANE_HEADINGS) % PLANE_HEADINGS;
    this.sx = c.x;
    this.sy = c.y;
    // The shadow on the ground (its silhouette, dark and soft), the plane and its glow above it.
    this.shade = this.own(w.add.sprite(0, 0, `${this.planeKey}_s`, `p${this.heading}_0`).setTint(0x000000).setAlpha(0).setDepth(1.6));
    this.plane = this.own(w.add.sprite(0, 0, this.planeKey, `p${this.heading}_0`).setPipeline('Lit').setVisible(false));
    this.glow = this.own(w.add.sprite(0, 0, `${this.planeKey}_e`, `p${this.heading}_0`).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    this.g = this.ink(420, 420);
    for (let i = 0; i < BOMBS; i++) {
      const d = FIRST_BOMB + i * BOMB_GAP;
      this.bombs.push({
        x: c.x + c.dx * d,
        y: c.y + c.dy * d,
        at: d,
        drop: SIGNAL_MS + ((d - CARRY - START) / PLANE_SPEED) * 1000,
        last: i === BOMBS - 1,
        sprite: null,
        whistled: false,
        boomed: -1,
      });
    }
    sound.flareShot(w.pan(c.x), true);
  }

  /** The plane's spot on the ground, `t` ms in. */
  private along(t: number): number {
    return START + (PLANE_SPEED * (t - SIGNAL_MS)) / 1000;
  }

  protected step(): void {
    const { c, t } = this;
    const w = this.world;
    const p = c.pal;
    const g = this.g.begin(this.sx, this.sy, this.sy + 400);

    // The signal flare, shooting up from her pistol and bursting high over her.
    if (t < SIGNAL_MS + 500) this.signal(g, p, t);

    // The plane: in from behind her, over her head, on along the aim and away.
    const d = this.along(t);
    const flying = t >= SIGNAL_MS && d <= END;
    if (flying) {
      if (!this.droned) {
        this.droned = true;
        sound.biplane(w.pan(c.x));
      }
      const gx = c.x + c.dx * d;
      const gy = c.y + c.dy * d;
      const frame = `p${this.heading}_${Math.floor(t / 40) % 2}`;
      // It dips in and climbs away at the ends of the run.
      const swoop = Math.min(clamp01((d - START) / 80), clamp01((END - d) / 80));
      const alt = PLANE_ALT * (1.6 - 0.6 * easeOut(swoop));
      this.plane.setVisible(true).setFrame(frame).setPosition(snap(gx), snap(gy - alt)).setDepth(gy + 200).setAlpha(swoop);
      this.glow.setVisible(true).setFrame(frame).setPosition(snap(gx), snap(gy - alt)).setDepth(gy + 200.1).setAlpha(swoop);
      // The shadow falls off to one side with the sun, a little softer the higher it flies.
      this.shade.setFrame(frame).setPosition(snap(gx + alt * 0.25), snap(gy + 2)).setAlpha(0.32 * swoop).setScale(1, 1);
      // A streamer of exhaust from the cowling.
      for (let i = 1; i < 6; i++) {
        const k = i / 6;
        const ex = gx - c.dx * (14 + i * 4);
        const ey = gy - alt - c.dy * (14 + i * 4) * 0.72;
        if (dither(Math.round(ex), Math.round(ey)) < 0.7 * (1 - k)) g.put(ex, ey - k * 3, k < 0.3 ? 0xc8c4cc : 0x8a8692, 0.8);
      }
    } else {
      this.plane.setVisible(false);
      this.glow.setVisible(false);
      this.shade.setAlpha(0);
    }

    for (const b of this.bombs) this.bomb(b, g, p, t);
    g.end();
  }

  /** The signal flare: a streak up from her hand, a burst of light, sparks drifting down. */
  private signal(g: Ink, p: Pal, t: number): void {
    const { c } = this;
    const x = c.x;
    const y0 = c.y - AVI_HAND_Y - 8;
    const up = 70;
    const k = clamp01(t / 300);
    const hy = y0 - up * easeOut(k);
    if (t < 300) {
      for (let i = 0; i < 10; i++) {
        const yy = hy + i * 2;
        if (yy > y0) break;
        g.put(x + (i % 3 === 2 ? (i & 4 ? 1 : -1) : 0), yy, i < 2 ? p.core : i < 5 ? p.hot : p.mid, 1 - i / 12);
      }
      g.put(x, hy, p.core);
    } else {
      const b = clamp01((t - 300) / 600);
      if (b < 0.25) {
        g.put(x, hy, p.core);
        for (let i = 1; i <= 4; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.put(x + dx * i, hy + dy * i, i < 2 ? p.core : p.hot, 1 - b * 4);
      }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = 4 + 10 * easeOut(b);
        const sx = x + Math.cos(a) * r;
        const sy = hy + Math.sin(a) * r * 0.8 + b * b * 14;
        if (dither(Math.round(sx), Math.round(sy)) < 1 - b) g.put(sx, sy, i % 2 ? p.hot : p.mid);
      }
      if (t - this.dtPrev < 300 && t >= 300) {
        flare(this.world, x, hy, 120, p.light, 2.4, 500);
        bloom(this.world, x, hy, p.hot, 1.4, 400, c.y + 40);
      }
    }
    this.dtPrev = t;
  }

  private dtPrev = 0;

  /** A bomb: off the plane, whistling down nose first and carried forward, then the blast. */
  private bomb(b: Bomb, g: Ink, p: Pal, t: number): void {
    const { c } = this;
    const w = this.world;
    if (t < b.drop) return;
    const f = (t - b.drop) / FALL_MS;
    if (f < 1) {
      if (!b.sprite) {
        b.sprite = w.add.sprite(0, 0, this.bombKey, 'b0').setPipeline('Lit').setOrigin(0.5, 1);
        if (!b.whistled) {
          b.whistled = true;
          sound.bombWhistle(w.pan(b.x));
        }
      }
      const along = -CARRY * (1 - f);
      const gx = b.x + c.dx * along;
      const gy = b.y + c.dy * along;
      const alt = PLANE_ALT * (1 - easeIn(f));
      b.sprite.setFrame(`b${Math.floor(t / 70) % BOMB_FRAMES}`).setPosition(snap(gx), snap(gy - alt + 4)).setDepth(gy + 1);
      // Its shadow, closing in under it as it falls.
      const r = 1.5 + 2.5 * f;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -4; dx <= 4; dx++) if (Math.hypot(dx / r, dy / (r * 0.55)) <= 1 && dither(Math.round(gx + dx), Math.round(gy + dy)) < 0.3 + 0.4 * f) g.put(gx + dx, gy + dy, 0x0b0818, 0.5);
      return;
    }
    if (b.sprite) {
      b.sprite.destroy();
      b.sprite = null;
    }
    if (b.boomed < 0) {
      b.boomed = t;
      const r = b.last ? LAST_R : BOMB_R;
      strikeGround(w, b.x, b.y, r, { damage: b.last ? LAST_DAMAGE : BOMB_DAMAGE, heavy: true, knock: b.last ? 200 : 130, fromX: b.x, fromY: b.y - 4 });
      bloom(w, b.x, b.y - 8, p.hot, b.last ? 2.4 : 1.5, 380, b.y + 20);
      flare(w, b.x, b.y - 8, b.last ? 140 : 90, p.light, b.last ? 3 : 2, 380);
      w.debris(p.tints, b.x, b.y - 6, b.last ? 18 : 10, b.y + 16, 'burst');
      w.debris([0x5e5a66, 0x8a8692, 0x3a3640], b.x, b.y - 4, 8, b.y + 12, 'burst');
      w.cameras.main.shake(b.last ? 260 : 120, b.last ? 0.0022 : 0.0011);
      sound.blast(w.pan(b.x));
    }
    this.blast(g, p, b, t - b.boomed);
  }

  /** A blast on the ground: a fireball swelling and rolling up into smoke, a ring of force, a scorch left behind. */
  private blast(g: Ink, p: Pal, b: Bomb, ms: number): void {
    const R = b.last ? LAST_R : BOMB_R;
    const k = ms / 700;
    if (k >= 1) return;
    // The scorch, fading.
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy / 0.58) / (R * 0.7);
        if (d > 1) continue;
        const x = Math.round(b.x + dx);
        const y = Math.round(b.y + dy);
        if (dither(x, y) >= (1 - k) * (1 - d * d) * 0.9) continue;
        g.put(x, y, 0x241e1c, 0.6);
      }
    if (k < 0.35) ring(g, b.x, b.y, R * easeOut(k / 0.35), 2, p, 1 - k / 0.35);
    // The fireball: a hot heart, the palette out to its edge, lifting into smoke as it goes.
    const fr = (b.last ? 13 : 9) * (0.5 + 0.7 * easeOut(k * 2));
    const lift = k * (b.last ? 22 : 16);
    for (let dy = -Math.ceil(fr); dy <= fr; dy++)
      for (let dx = -Math.ceil(fr); dx <= fr; dx++) {
        const d = Math.hypot(dx, dy) / fr;
        if (d > 1) continue;
        const x = Math.round(b.x + dx);
        const y = Math.round(b.y - fr * 0.6 - lift + dy);
        const n = hash(x, y, Math.floor(ms / 60));
        if (dither(x, y) >= (1 - k) * 1.2 - d * 0.3 + n * 0.2) continue;
        const heat = k * 1.6 + d * 0.8;
        const col = heat < 0.4 ? p.core : heat < 0.75 ? p.hot : heat < 1.05 ? p.mid : heat < 1.3 ? p.deep : dy < 0 ? 0x8a8692 : 0x4a4652;
        g.put(x, y, col);
      }
  }

  destroy(): void {
    for (const b of this.bombs) b.sprite?.destroy();
    super.destroy();
  }
}

export function bombingRun(c: Cast): void {
  c.world.addEffect(new BombingRun(c));
}
