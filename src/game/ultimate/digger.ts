import Phaser from 'phaser';
import { sound } from '../../audio';
import { STONE_CRUMBLE, STONE_FRAME, STONE_KINDS, STONE_RISE } from '../../art/diggerFx';
import type { Hurtbox } from '../combat';
import { Clods, GRAVE_SOIL, MOSS_SOIL } from '../Graves';
import { snap } from '../display';
import { clamp01, dither, easeOut, flare, Fx, GROUND, hash, strikeGround, type Ink } from './ink';
import type { Cast, IconPainter } from './types';
import type { WorldScene } from '../../scenes/WorldScene';

// The Gravedigger's Special, Graveyard: headstones burst up out of the earth
// in a ring round him, throwing back everything they come up under. For a
// few seconds the ring stands, and from every stone a ghost tears loose,
// streaking for the nearest foe, then another, then another; at the last the
// stones crack and crumble back into the ground. Mossgrave's are mossy
// standing stones, and what leaves them are wisps.

/** The ring: how many stones, how far out, and how long they stand. */
const STONES = 6;
const RING = 30;
const LIFE = 4800;
/** Each stone rises this long after the last, over this long. */
const STAGGER = 45;
const RISE_MS = 180;
/** They crack and fall apart from here, over this long, then sink away. */
const CRUMBLE_AT = 4100;
const CRUMBLE_MS = 420;
/** The blow of a stone bursting up: how wide, how hard. */
const BURST = { radius: 13, damage: 14, knock: 150 };
/** When each wave of ghosts leaves the stones. */
const WAVES = [450, 1650, 2850];
/** The ghosts: how far they look for a foe, their speed and turn, their blow, how long they last. */
const GHOST = { sight: 150, speed: 150, turn: 7, damage: 10, knock: 60, life: 1400 };

interface Stone {
  x: number;
  y: number;
  kind: number;
  /** When it starts coming up. */
  at: number;
  risen: boolean;
  cracked: boolean;
  body: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
}

interface Ghost {
  x: number;
  y: number;
  /** Height above the ground. */
  z: number;
  vx: number;
  vy: number;
  target: Hurtbox | null;
  t: number;
  done: boolean;
  /** The last few places it was, for its tail. */
  trail: { x: number; y: number }[];
  seed: number;
}

export class Graveyard extends Fx {
  private stones: Stone[] = [];
  private ghosts: Ghost[] = [];
  private air: Ink;
  private wave = 0;
  private readonly key: string;
  private readonly moss: boolean;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, LIFE);
    this.moss = c.look === 'mossgrave';
    this.key = this.moss ? 'headstones_moss' : 'headstones';
    this.air = this.ink(380, 280);
    const ox = STONE_FRAME.ox / STONE_FRAME.w;
    const oy = STONE_FRAME.oy / STONE_FRAME.h;
    const seed = Math.floor(Math.random() * 1000);
    for (let i = 0; i < STONES; i++) {
      const a = (i / STONES) * Math.PI * 2 + Math.PI / 2 + (hash(seed, i) - 0.5) * 0.3;
      const r = RING * (0.9 + hash(seed, i, 1) * 0.2);
      const x = snap(c.x + Math.cos(a) * r);
      const y = snap(c.y + Math.sin(a) * r * GROUND * 1.3);
      const kind = (i + seed) % STONE_KINDS;
      const frame = `s${kind}_r0_${x < c.x ? 'l' : 'r'}`;
      const body = this.own(world.add.sprite(x, y, this.key, frame).setOrigin(ox, oy).setPipeline('Lit').setDepth(y).setVisible(false));
      const glow = this.own(world.add.sprite(x, y, `${this.key}_e`, frame).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).setVisible(false));
      const shadow = this.own(world.add.image(x, y, 'shadow').setDepth(1).setScale(0.9, 0.7).setAlpha(0));
      this.stones.push({ x, y, kind, at: i * STAGGER, risen: false, cracked: false, body, glow, shadow });
    }
    // A glow of corpse-light over the whole yard while it stands.
    const lamp = this.light(c.x, c.y - 6, RING * 3, c.pal.light, 0);
    world.tweens.add({ targets: lamp, intensity: 1.1, duration: 300, yoyo: true, hold: LIFE - 900, ease: 'Sine.easeInOut' });
    sound.tombRise(world.pan(c.x));
    world.cameras.main.shake(260, 0.0014);
  }

  protected step(dt: number): void {
    const { t, world, c } = this;
    for (const s of this.stones) this.stand(s);
    if (this.wave < WAVES.length && t >= WAVES[this.wave]) {
      this.wave++;
      for (const s of this.stones) if (s.risen) this.loose(s);
      sound.soulCast(world.pan(c.x));
    }
    this.fly(dt);
  }

  /** A stone's frame for now: rising, standing, cracking, gone; its blow as it breaks the ground. */
  private stand(s: Stone): void {
    const t = this.t - s.at;
    if (t < 0) return;
    const side = s.x < this.c.x ? 'l' : 'r';
    let frame: string;
    let alpha = 1;
    if (t < RISE_MS) frame = `s${s.kind}_r${Math.min(STONE_RISE - 1, Math.floor((t / RISE_MS) * STONE_RISE))}`;
    else if (this.t < CRUMBLE_AT + s.at) frame = `s${s.kind}_st`;
    else {
      const k = (this.t - CRUMBLE_AT - s.at) / CRUMBLE_MS;
      frame = `s${s.kind}_c${Math.min(STONE_CRUMBLE - 1, Math.floor(k * STONE_CRUMBLE))}`;
      alpha = 1 - clamp01((k - 1) * 2.5);
    }
    s.body.setVisible(true).setFrame(`${frame}_${side}`).setAlpha(alpha);
    s.glow.setVisible(true).setFrame(`${frame}_${side}`).setAlpha(alpha * (0.7 + 0.3 * Math.sin(this.t * 0.01 + s.kind)));
    s.shadow.setAlpha(0.5 * alpha * clamp01(t / RISE_MS));
    if (!s.risen && t >= RISE_MS * 0.5) {
      s.risen = true;
      // It bursts up out of the earth: anything standing over it is thrown back from him.
      const soil = this.moss ? MOSS_SOIL : GRAVE_SOIL;
      this.world.addEffect(new Clods(this.world, s.x, s.y, 8, soil, { speed: 34, up: 80 }));
      this.world.debris([soil.dust, soil.earth[0], this.c.pal.mid], s.x, s.y - 4, 6, s.y + 4, 'burst');
      strikeGround(this.world, s.x, s.y, BURST.radius, { damage: BURST.damage, heavy: true, knock: BURST.knock, fromX: this.c.x, fromY: this.c.y });
    }
    if (!s.cracked && this.t >= CRUMBLE_AT + s.at) {
      s.cracked = true;
      this.world.debris([0x8a8c90, 0x5a5c62, this.c.pal.mid], s.x, s.y - 8, 6, s.y + 4, 'burst');
    }
  }

  /** A ghost tears loose from the stone and goes for the nearest foe it can see. */
  private loose(s: Stone): void {
    const target = this.nearest(s.x, s.y, null);
    const a = target ? Math.atan2(target.y - s.y, target.x - s.x) : -Math.PI / 2;
    this.ghosts.push({
      x: s.x,
      y: s.y,
      z: 12,
      vx: Math.cos(a) * 40,
      vy: Math.sin(a) * 40 - 20,
      target,
      t: 0,
      done: false,
      trail: [],
      seed: Math.floor(Math.random() * 100),
    });
  }

  private nearest(x: number, y: number, not: Hurtbox | null): Hurtbox | null {
    let best: Hurtbox | null = null;
    let bd = GHOST.sight;
    for (const h of this.world.hurtboxesWhere((b) => b.alive && b !== not)) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  private fly(dt: number): void {
    const s = dt / 1000;
    const p = this.c.pal;
    const ink = this.air.begin(this.c.x, this.c.y - 20, this.c.y + 40);
    for (const g of this.ghosts) {
      if (g.done) continue;
      g.t += dt;
      if (g.target && !g.target.alive) g.target = this.nearest(g.x, g.y, g.target);
      if (g.target) {
        // Home in: steer the velocity round toward the foe's body.
        const tx = g.target.x - g.x;
        const ty = g.target.y - g.target.bodyY - (g.y - g.z);
        const d = Math.hypot(tx, ty) || 1;
        const k = Math.min(1, GHOST.turn * s);
        g.vx += ((tx / d) * GHOST.speed - g.vx) * k;
        g.vy += ((ty / d) * GHOST.speed - g.vy) * k;
        if (d < g.target.radius + 4) {
          const h = g.target;
          h.hurt({ damage: GHOST.damage, heavy: false, knock: GHOST.knock, fromX: g.x, fromY: g.y });
          this.world.debris([p.core, p.hot, p.mid], snap(h.x), snap(h.y - h.bodyY), 6, h.y + 14, 'spores');
          sound.boneHit(this.world.pan(h.x));
          g.done = true;
          continue;
        }
      } else {
        // Nothing to haunt: it rises and fades.
        g.vy -= 60 * s;
      }
      g.x += g.vx * s;
      g.y += g.vy * s;
      g.trail.unshift({ x: g.x, y: g.y - g.z });
      if (g.trail.length > 7) g.trail.pop();
      if (g.t > GHOST.life) g.done = true;
      this.drawGhost(ink, g);
    }
    ink.end();
  }

  private drawGhost(ink: Ink, g: Ghost): void {
    const p = this.c.pal;
    const fade = g.target ? 1 : 1 - clamp01((g.t - 500) / 700);
    const born = easeOut(g.t / 160);
    const a = fade * born;
    // The tail: fading, thinning back along where it flew.
    g.trail.forEach((q, i) => {
      if (i === 0) return;
      const k = i / g.trail.length;
      if (dither(Math.round(q.x), Math.round(q.y)) > a * (1 - k)) return;
      ink.put(q.x, q.y, k < 0.4 ? p.hot : k < 0.75 ? p.mid : p.deep, 1);
      if (!this.moss && k < 0.5) ink.put(q.x + 1, q.y, p.mid, 0.8);
    });
    const x = Math.round(g.x);
    const y = Math.round(g.y - g.z);
    if (this.moss) {
      // A wisp: a bright mote in a ring of soft light, with a spark winking off it.
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > 2.3) continue;
          ink.put(x + dx, y + dy, d < 0.8 ? p.core : d < 1.6 ? p.hot : p.mid, d < 1.6 ? a : a * 0.6);
        }
      if (Math.sin(g.t * 0.03 + g.seed) > 0.4) ink.put(x + (g.seed % 2 ? 3 : -3), y - 2, p.core, a);
      return;
    }
    // A ghost: a hooded wail, hollow eyes and an open mouth, its hem ragged.
    const GHOST_ART = ['.hhh.', 'hcccc', 'cecec', 'ccccm', 'ccecm', 'hcccm', 'm.m.m'];
    const flip = g.vx < 0;
    GHOST_ART.forEach((row, dy) => {
      for (let i = 0; i < 5; i++) {
        const ch = row[flip ? 4 - i : i];
        if (ch === '.') continue;
        const wob = dy === 6 && Math.sin(g.t * 0.04 + i) > 0 ? -1 : 0;
        ink.put(x + i - 2, y + dy - 4 + wob, ch === 'c' ? p.core : ch === 'h' ? p.hot : ch === 'm' ? p.mid : p.deep, a);
      }
    });
  }

  destroy(): void {
    if (this.dead) return;
    // A last puff of light as the yard goes back to earth.
    if (this.t >= LIFE) flare(this.world, this.c.x, this.c.y - 6, RING * 2, this.c.pal.light, 0.8, 400);
    super.destroy();
  }
}

/** The Special's icon: a round-topped headstone, a ghost rising off it. */
export const graveyardIcon: IconPainter = (put, p) => {
  // The stone.
  for (let y = 7; y <= 14; y++)
    for (let x = 2; x <= 9; x++) {
      const top = y === 7 ? x >= 4 && x <= 7 : y === 8 ? x >= 3 && x <= 8 : true;
      if (!top) continue;
      put(x, y, x <= 3 ? p.mid : x >= 8 ? p.deep : p.hot);
    }
  // A cross cut in it.
  for (let y = 9; y <= 12; y++) put(5, y, p.deep);
  put(6, 9, p.deep);
  put(4, 10, p.deep);
  put(6, 10, p.deep);
  // The ghost rising off it to the right, its tail curling down to the stone.
  for (const [x, y] of [[9, 7], [10, 6], [11, 6], [12, 5]] as const) put(x, y, p.mid);
  for (let y = 1; y <= 5; y++)
    for (let x = 11; x <= 14; x++) {
      if ((y === 1 && (x === 11 || x === 14)) || (y === 5 && x % 2 === 0)) continue;
      put(x, y, p.core);
    }
  put(12, 2, 0);
  put(13, 2, 0);
  put(12, 4, 0);
  // Earth at its foot.
  for (let x = 1; x <= 11; x++) put(x, 15, p.deep);
};
