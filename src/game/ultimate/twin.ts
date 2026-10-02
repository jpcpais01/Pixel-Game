import Phaser from 'phaser';
import { sound } from '../../audio';
import { dirOf } from '../Wizard';
import { HitSpark } from '../Slash';
import { CrossFlash, isTwin, nearestFoes } from '../Twin';
import { TWIN_CHEST_Y, TWIN_H, TWIN_ORIGIN_X, TWIN_ORIGIN_Y, TWIN_W } from '../../art/twin';
import type { Hurtbox } from '../combat';
import type { Hero } from '../characters';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, dither, flare, Fx, pal, type Ink, type Pal } from './ink';
import type { Cast, IconPainter } from './types';

// The Twin Blade's Special, Thousand Cuts: he bows his head and is gone. A
// line of light flicks from foe to foe round him, and at each he is there
// for a heartbeat, an afterimage in his blades' colours caught mid-cut,
// leaving a cross of light scored across it, and gone again to the next.
// With fewer foes than cuts he goes round them again. Then he is back where
// he started, both blades flung wide, and every cross he left bursts at once
// in a last crossing flash. The long blade's light is the Special's palette;
// the shoto's is its deepest colour, so a skin's recolour carries both.

/** How far round him he finds foes to blink to. */
const REACH = 96;
/** Cuts in all, shared round the foes nearest-first. */
const CUTS = 6;
/** The first blink after he vanishes, then one every GAP. */
const FIRST = 140;
const GAP = 115;
const CUT_DAMAGE = 9;
/** Each foe cut is held a moment, as if time slowed round the blade. */
const HOLD = { k: 0.15, ms: 260 };
/** He's back this long after the last cut, and the crosses burst this long after that. */
const BACK = 200;
const BURST = 140;
const FINAL_DAMAGE = 24;
/** How long the streaks between blinks, the crosses and the afterimages last. */
const STREAK_MS = 260;
const MARK_MS = 520;
const GHOST_MS = 300;

const mix = (a: number, b: number, k: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** The shoto's palette, grown from the Special's deepest colour. */
export const shotoPal = (p: Pal): Pal => pal(mix(p.deep, 0xffffff, 0.88), mix(p.deep, 0xffffff, 0.45), p.deep, mix(p.deep, 0x000000, 0.45), p.deep);

/** The long blade's: the palette with its own darker edge in place of the shoto's colour. */
const mainPal = (p: Pal): Pal => pal(p.core, p.hot, p.mid, mix(p.mid, 0x000000, 0.45), p.light);

/** Thousand Cuts needs someone to cut. */
export function cutsGate(world: WorldScene, hero: Hero): string | null {
  return nearestFoes(world, hero.x, hero.y, REACH).length ? null : 'NO FOE NEAR';
}

interface Streak {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  p: Pal;
}

interface Mark {
  h: Hurtbox;
  t: number;
}

export class ThousandCuts extends Fx {
  private paint: Ink;
  private main: Pal;
  private shoto: Pal;
  /** Every cut's foe, in the order he takes them. */
  private plan: Hurtbox[] = [];
  private done = 0;
  private from: { x: number; y: number };
  private streaks: Streak[] = [];
  private marks: Mark[] = [];
  private cut = new Set<Hurtbox>();
  private back = false;
  private burst = false;
  private readonly cutsEnd: number;
  private readonly key: string;
  private lamp: Phaser.GameObjects.Light;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 0);
    this.main = mainPal(c.pal);
    this.shoto = shotoPal(c.pal);
    this.key = c.hero.sprite.texture.key;
    this.paint = this.ink(REACH * 2 + 80, REACH * 2 + 60);
    this.lamp = this.light(c.x, c.y - 12, 120, c.pal.light, 0);
    // Nearest first, then from each foe on to the nearest one not yet cut; round again if there are cuts to spare.
    const foes = nearestFoes(world, c.x, c.y, REACH);
    let at = { x: c.x, y: c.y };
    let left = [...foes];
    while (foes.length && this.plan.length < CUTS) {
      if (!left.length) left = [...foes];
      left.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
      const h = left.shift()!;
      // Not the same foe twice in a row unless it's the only one.
      if (this.plan[this.plan.length - 1] === h && left.length) left.push(h);
      else {
        this.plan.push(h);
        at = h;
      }
    }
    this.cutsEnd = FIRST + Math.max(0, this.plan.length - 1) * GAP;
    this.life = this.cutsEnd + BACK + BURST + MARK_MS + 100;
    this.from = { x: c.x, y: c.y - TWIN_CHEST_Y };

    // Gone: a puff of both blades' light where he stood.
    if (isTwin(c.hero)) c.hero.vanish(true);
    world.debris([...this.main.tints.slice(0, 3), this.shoto.hot], c.x, c.y - 12, 12, c.y + 10, 'burst');
    bloom(world, c.x, c.y - 12, c.pal.hot, 1.4, 280, c.y + 20);
    sound.vanish(world.pan(c.x));
  }

  protected step(): void {
    const { t, world, c } = this;
    while (this.done < this.plan.length && t >= FIRST + this.done * GAP) this.blink(this.done++);
    if (!this.back && t >= this.cutsEnd + BACK) {
      this.back = true;
      // Back where he started, and the line of light from the last foe to him.
      this.streaks.push({ x0: this.from.x, y0: this.from.y, x1: c.x, y1: c.y - TWIN_CHEST_Y, t, p: this.main });
      if (isTwin(c.hero)) c.hero.vanish(false);
      bloom(world, c.x, c.y - 12, c.pal.hot, 1.2, 260, c.y + 20);
      sound.blink(world.pan(c.x));
    }
    if (!this.burst && t >= this.cutsEnd + BACK + BURST) {
      this.burst = true;
      this.crossAll();
    }
    this.draw();
    const lit = this.burst ? 3 * (1 - clamp01((t - this.cutsEnd - BACK - BURST) / 400)) : 1.2;
    this.lamp.setPosition(this.from.x, this.from.y);
    this.lamp.intensity = lit;
  }

  /** He's at the `i`th foe for a heartbeat: an afterimage mid-cut, a cross scored across it. */
  private blink(i: number): void {
    const { world } = this;
    const h = this.plan[i];
    if (!h.alive) return;
    const body = { x: h.x, y: h.y - h.bodyY };
    // He lands on the far side of the foe, having passed through it.
    const dx = body.x - this.from.x;
    const dy = body.y - this.from.y;
    const d = Math.hypot(dx, dy) || 1;
    const land = { x: body.x + (dx / d) * (h.radius + 7), y: body.y + (dy / d) * (h.radius + 5) };
    const p = i % 2 ? this.shoto : this.main;
    this.streaks.push({ x0: this.from.x, y0: this.from.y, x1: land.x, y1: land.y, t: this.t, p });
    this.marks.push({ h, t: this.t });
    this.cut.add(h);
    this.ghost(land.x, land.y + TWIN_CHEST_Y, dirOf(-dx, -dy), i);
    h.hurt({ damage: CUT_DAMAGE, heavy: false, knock: 0, fromX: this.from.x, fromY: this.from.y });
    if (h.alive) h.slow?.(HOLD.k, HOLD.ms);
    world.addEffect(new HitSpark(world, body.x, body.y, p, h.y + 13, i === this.plan.length - 1));
    world.debris(p.tints, body.x, body.y, 4, h.y + 6, 'burst');
    sound.saberHit(world.pan(body.x), false);
    if (i % 2 === 0) sound.blink(world.pan(land.x));
    world.cameras.main.shake(50, 0.0004);
    this.from = land;
  }

  /** His afterimage where he lands: the body flat in one blade's light, the blades burning on it, fading. */
  private ghost(x: number, y: number, dir: string, i: number): void {
    const frames = ['cut1', 'cut2', 'cut3'];
    const last = i === this.plan.length - 1;
    const frame = last ? `xcut_${dir}_2` : `${frames[i % 3]}_${dir}_1`;
    const tex = this.world.textures;
    if (!tex.exists(this.key) || !tex.get(this.key).has(frame)) return;
    const ox = TWIN_ORIGIN_X / TWIN_W;
    const oy = TWIN_ORIGIN_Y / TWIN_H;
    const rx = Math.round(x);
    const ry = Math.round(y);
    const tint = i % 2 ? this.shoto.hot : this.main.hot;
    const shape = this.own(this.world.add.sprite(rx, ry, this.key, frame).setOrigin(ox, oy).setTintFill(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7).setDepth(ry + 0.2));
    const glow = this.own(this.world.add.sprite(rx, ry, `${this.key}_e`, frame).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(ry + 0.3));
    this.world.tweens.add({ targets: [shape, glow], alpha: 0, duration: GHOST_MS, ease: 'Quad.easeIn' });
  }

  /** The last crossing flash: every cross he left bursts at once, the hardest blow of all. */
  private crossAll(): void {
    const { world, c } = this;
    let n = 0;
    for (const h of this.cut) {
      if (!h.alive) continue;
      const by = h.y - h.bodyY;
      h.hurt({ damage: FINAL_DAMAGE, heavy: true, knock: 90, fromX: c.x, fromY: c.y - TWIN_CHEST_Y });
      world.addEffect(new CrossFlash(world, Math.round(h.x), Math.round(by), this.main, this.shoto, h.y + 14, 13, n < 3));
      world.debris([0xffffff, this.main.hot, this.shoto.hot, this.shoto.mid], h.x, by, 8, h.y + 6, 'burst');
      n++;
    }
    sound.saberCross(world.pan(c.x));
    world.cameras.main.shake(220, 0.0026);
    flare(world, c.x, c.y - 12, 150, c.pal.light, 3, 480);
  }

  private draw(): void {
    const { t, c } = this;
    const g = this.paint.begin(c.x, c.y - 10, c.y + 400);
    // The lines of light he leaves blinking from one to the next: thin, hot, eaten from the tail.
    for (const s of this.streaks) {
      const k = (t - s.t) / STREAK_MS;
      if (k >= 1) continue;
      const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      const n = Math.max(1, Math.ceil(len));
      const ux = (s.x1 - s.x0) / (len || 1);
      const uy = (s.y1 - s.y0) / (len || 1);
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        if (u < k * 1.2) continue;
        const x = s.x0 + (s.x1 - s.x0) * u;
        const y = s.y0 + (s.y1 - s.y0) * u;
        const a = 1 - k;
        if (u < k * 1.2 + 0.25 && dither(Math.round(x), Math.round(y)) > a) continue;
        g.put(x, y, s.p.core, a);
        g.put(x - uy, y + ux, s.p.mid, a * 0.8);
        g.put(x + uy, y - ux, s.p.hot, a * 0.8);
      }
    }
    // The crosses scored across each foe cut, following it, glowing until the burst takes them.
    for (const m of this.marks) {
      const age = t - m.t;
      const open = clamp01(age / 60);
      const k = this.burst ? clamp01((t - this.cutsEnd - BACK - BURST) / 200) : 0;
      if (k >= 1 || !m.h.alive) continue;
      const bx = m.h.x;
      const by = m.h.y - m.h.bodyY;
      const r = 5 * open;
      const a = (1 - k) * (age < 120 ? 1 : 0.6 + 0.2 * Math.sin(age * 0.03));
      for (let i = -r; i <= r; i += 0.5) {
        g.put(bx + i, by - i * 0.85, Math.abs(i) < 2 ? this.main.core : this.main.hot, a);
        g.put(bx + i, by + i * 0.85, Math.abs(i) < 2 ? this.shoto.core : this.shoto.hot, a);
      }
    }
    g.end();
  }
}

/** The Special's button: blinks of light zigzagging between marks, crossed in both blades' colours. */
export const thousandCutsIcon: IconPainter = (put, p) => {
  const s = shotoPal(p);
  const seg = (x0: number, y0: number, x1: number, y1: number, col: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) put(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col);
  };
  // The path: a zigzag of thin lines between four marks.
  const pts: [number, number][] = [[2, 13], [6, 3], [10, 12], [14, 4]];
  for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i % 2 ? s.mid : p.mid);
  // A cross at each mark, one stroke of each blade.
  for (const [i, [x, y]] of pts.entries()) {
    const r = i === pts.length - 1 ? 2 : 1;
    seg(x - r, y - r, x + r, y + r, p.hot);
    seg(x - r, y + r, x + r, y - r, s.hot);
    put(x, y, p.core);
  }
};
