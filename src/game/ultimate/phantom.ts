import Phaser from 'phaser';
import { sound } from '../../audio';
import type { HauntKind } from '../../art/poltergeist';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, drag, easeOut, flare, Fx, GROUND, line, ring, type Ink } from './ink';
import type { Cast } from './types';

// The Phantom's Specials.
//  - Haunted House (the Poltergeist): a spectral house rises over the spot it
//    aims at, doors banging and windows lit, and everything inside is caught
//    in a whirlwind of flying furniture, dragged round and battered, until the
//    house falls in and flings it all out. The Tea Party lays an endless tea
//    table in a ring instead, the tea set whirling round it.
//  - Dead of Night (the Lantern Wraith): the world goes dark but for its
//    lantern. Every foe out in the dark near it is frozen with fear, the dread
//    gnawing at it, until the lantern flares and burns everything in its
//    light. The Calavera's night is a candlelit procession: warm dusk, a ring
//    of candles floating round her and marigold petals falling.

const HOUSE_MS = 4000;
const HOUSE_R = 46;
const HOUSE_TICK = 300;
const HOUSE_DAMAGE = 6;
const HOUSE_PULL = 50;
const HOUSE_END = 15;

const NIGHT_MS = 4200;
const NIGHT_R = 150;
const NIGHT_TICK = 500;
const NIGHT_DAMAGE = 4;
const NIGHT_FLARE_R = 120;
const NIGHT_FLARE_DAMAGE = 24;
/** How big the dark's hole of lantern light is drawn. */
const NIGHT_SCALE = 3.8;

const inside = (h: Hurtbox, x: number, y: number, r: number): boolean => {
  const dx = (h.x - x) / (r + h.radius);
  const dy = (h.y - y) / ((r + h.radius) * GROUND);
  return dx * dx + dy * dy <= 1;
};

export class HauntedHouse extends Fx {
  private g: Ink;
  private things: Phaser.GameObjects.Image[] = [];
  private tickT = 0;
  private tea: boolean;
  private x: number;
  private y: number;
  private ended = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, HOUSE_MS);
    this.tea = c.look === 'tea';
    this.x = c.tx;
    this.y = c.ty;
    this.g = this.ink(HOUSE_R * 2 + 30, HOUSE_R * 2 + 70);
    const kinds: HauntKind[] = this.tea ? ['cup', 'saucer', 'jug', 'teapot', 'cup', 'saucer', 'cup', 'jug'] : ['chair', 'book', 'candle', 'pot', 'trunk', 'chair', 'book', 'candle'];
    for (const k of kinds) this.things.push(this.own(world.add.image(this.x, this.y, 'haunt', k).setPipeline('Lit').setAlpha(0)));
    bloom(world, this.x, this.y - 10, c.pal.mid, 3, 500, this.y + 40);
    world.debris(c.pal.tints, this.x, this.y, 24, this.y + 20, 'burst');
    sound.creak(world.pan(this.x));
    sound.wail(world.pan(this.x));
  }

  protected step(dt: number): void {
    const w = this.world;
    const { x, y } = this;
    const p = this.c.pal;
    const rise = easeOut(this.t / 450);
    const out = this.t > HOUSE_MS - 350;
    const fade = out ? clamp01((HOUSE_MS - this.t) / 350) : 1;

    // The house (or the table), drawn in flickering ghost-light.
    const g = this.g.begin(x, y + HOUSE_R * GROUND + 6, y + HOUSE_R * GROUND + 4, 0.5, 1);
    const a = fade * (0.7 + 0.3 * Math.sin(this.t * 0.02));
    ring(g, x, y, HOUSE_R * rise, 1, p, a * 0.8);
    if (this.tea) this.table(g, rise, a);
    else this.house(g, rise, a);
    g.end();

    // Everything inside caught in the whirl of furniture.
    this.things.forEach((o, i) => {
      const n = this.things.length;
      if (out) {
        // The house falls in: everything flies out and away.
        const q = (i / n) * Math.PI * 2 + this.t * 0.003;
        const k = 1 - fade;
        o.setPosition(x + Math.cos(q) * (30 + k * 60), y - 16 + Math.sin(q) * (14 + k * 30) - k * 10).setAlpha(fade).setRotation(this.t * 0.02 + i);
        return;
      }
      const q = (i / n) * Math.PI * 2 + this.t * 0.0035 * (i % 2 ? 1 : 1.25);
      const r = (18 + (i % 3) * 8) * rise;
      const ox = Math.cos(q) * r;
      const oy = Math.sin(q) * r * GROUND;
      const lift = 10 + (i % 4) * 5 + Math.sin(this.t * 0.005 + i) * 3;
      o.setPosition(Math.round(x + ox), Math.round(y + oy - lift)).setDepth(y + oy + 1).setAlpha(rise).setRotation(this.t * 0.008 * (i % 2 ? 1 : -1) + i);
    });

    if (out) {
      if (!this.ended) {
        this.ended = true;
        for (const h of w.hurtboxesWhere((b) => b.alive && inside(b, x, y, HOUSE_R))) {
          h.hurt({ damage: HOUSE_END, heavy: true, knock: 170, fromX: x, fromY: y });
          w.debris(p.tints, h.x, h.y - h.bodyY, 6, h.y + 10, 'burst');
        }
        w.debris([0xffffff, ...p.tints], x, y - 12, 34, y + 20, 'burst');
        w.cameras.main.shake(220, 0.0012);
        flare(w, x, y - 20, 140, p.light, 3, 400);
        sound.shatter(w.pan(x), true);
        sound.slam(w.pan(x));
      }
      return;
    }
    if (rise < 1) return;
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = HOUSE_TICK;
    const caught = w.hurtboxesWhere((b) => b.alive && inside(b, x, y, HOUSE_R));
    for (const h of caught) {
      h.hurt({ damage: HOUSE_DAMAGE, heavy: false, knock: 20, fromX: h.x + (Math.random() - 0.5) * 20, fromY: h.y - 20 });
      drag(h, x, y, HOUSE_PULL, HOUSE_TICK);
    }
    if (caught.length) sound.creak(w.pan(x));
  }

  /** A spectral house: walls and a gabled roof behind the ring, a door banging, windows lit. */
  private house(g: Ink, rise: number, a: number): void {
    const p = this.c.pal;
    const { x, y } = this;
    const base = y - HOUSE_R * GROUND * 0.6;
    const hw = HOUSE_R * 0.9;
    const wall = 36 * rise;
    const top = base - wall;
    // Walls, drawn dotted so they read as spectral.
    const dotted = (x0: number, y0: number, x1: number, y1: number, c: number) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let i = 0; i <= n; i++) if ((i + Math.floor(this.t / 80)) % 4 !== 0) g.put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a);
    };
    dotted(x - hw, base, x - hw, top, p.hot);
    dotted(x + hw, base, x + hw, top, p.hot);
    dotted(x - hw, top, x + hw, top, p.mid);
    // The gable.
    const peak = top - 22 * rise;
    dotted(x - hw - 4, top, x, peak, p.hot);
    dotted(x + hw + 4, top, x, peak, p.hot);
    // The chimney.
    dotted(x + hw * 0.5, top - 6 * rise, x + hw * 0.5, top - 16 * rise, p.mid);
    // The door, swinging open and shut.
    const dw = 7;
    const open = Math.abs(Math.sin(this.t * 0.006));
    line(g, x - dw, base, x - dw, base - 14 * rise, p.mid, a);
    line(g, x + dw, base, x + dw, base - 14 * rise, p.mid, a);
    line(g, x - dw, base - 14 * rise, x + dw, base - 14 * rise, p.mid, a);
    line(g, x - dw, base, x - dw + dw * 2 * (1 - open), base - 14 * rise + open * 2, p.core, a);
    // Two windows, lit and flickering.
    for (const s of [-1, 1]) {
      const wx = x + s * hw * 0.55;
      const wy = top + wall * 0.35;
      const lit = (Math.floor(this.t / 150) + (s > 0 ? 1 : 0)) % 3 !== 0;
      for (let yy = -3; yy <= 3; yy++) for (let xx = -4; xx <= 4; xx++) {
        const edge = Math.abs(yy) === 3 || Math.abs(xx) === 4 || xx === 0 || yy === 0;
        if (edge) g.put(wx + xx, wy + yy, p.mid, a);
        else if (lit) g.put(wx + xx, wy + yy, p.hot, a * 0.55);
      }
    }
  }

  /** The endless tea table: a ring of table round them, its cloth scalloped, cups set along it. */
  private table(g: Ink, rise: number, a: number): void {
    const p = this.c.pal;
    const { x, y } = this;
    const r = (HOUSE_R - 6) * rise;
    ring(g, x, y - 8, r, 2.2, p, a * 0.9);
    ring(g, x, y - 8, r + 4, 0.6, p, a * 0.6);
    for (let i = 0; i < 24; i++) {
      const q = (i / 24) * Math.PI * 2 + this.t * 0.0006;
      const cx = x + Math.cos(q) * (r + 4);
      const cy = y - 8 + Math.sin(q) * (r + 4) * GROUND;
      // The cloth's scallops hanging over the edge.
      g.put(cx, cy + 1, p.core, a * 0.8);
      g.put(cx, cy + 2, p.hot, a * 0.5);
      if (i % 3 === 0) {
        // A cup set on the table, steam curling off it.
        const tx = x + Math.cos(q) * r;
        const ty = y - 8 + Math.sin(q) * r * GROUND;
        g.put(tx, ty - 1, 0xffffff, a);
        g.put(tx + 1, ty - 1, 0xf0f4ff, a);
        if ((Math.floor(this.t / 120) + i) % 2) g.put(tx, ty - 3, p.core, a * 0.5);
      }
    }
  }
}

export class DeadOfNight extends Fx {
  private dark: Phaser.GameObjects.Image;
  private rim: Phaser.GameObjects.Graphics;
  private lamp: Phaser.GameObjects.Light;
  private candles: Ink | null = null;
  private tickT = 0;
  private cala: boolean;
  private flared = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, NIGHT_MS + 500);
    this.cala = c.look === 'cala';
    const tint = this.cala ? 0x3a1420 : 0x000000;
    this.dark = this.own(world.add.image(c.hero.x, c.hero.y, 'night_hole').setScale(NIGHT_SCALE).setDepth(9500).setTint(tint).setAlpha(0));
    this.rim = this.own(world.add.graphics().setDepth(9500));
    this.lamp = this.light(c.hero.x, c.hero.y, 110, c.pal.light, 0);
    if (this.cala) this.candles = this.ink(150, 110);
    sound.wail(world.pan(c.hero.x));
  }

  protected step(dt: number): void {
    const w = this.world;
    const h = this.c.hero;
    const p = this.c.pal;
    const x = h.x;
    const y = h.y - 12;
    const on = this.t < NIGHT_MS;
    const k = on ? clamp01(this.t / 450) : 1 - clamp01((this.t - NIGHT_MS) / 450);
    const depth = this.cala ? 0.45 : 0.8;
    this.dark.setPosition(Math.round(x), Math.round(y)).setAlpha(k * depth);
    // Past the image's edges the dark carries on, to cover the whole view.
    const half = (128 * NIGHT_SCALE) / 2;
    const cam = w.cameras.main.worldView;
    const g = this.rim.clear();
    g.fillStyle(this.cala ? 0x3a1420 : 0x000000, k * depth);
    const l = x - half;
    const r = x + half;
    const t = y - half;
    const b = y + half;
    g.fillRect(cam.x - 20, cam.y - 20, cam.width + 40, Math.max(0, t - cam.y + 20));
    g.fillRect(cam.x - 20, b, cam.width + 40, Math.max(0, cam.bottom - b + 20));
    g.fillRect(cam.x - 20, t, Math.max(0, l - cam.x + 20), b - t);
    g.fillRect(r, t, Math.max(0, cam.right - r + 20), b - t);
    this.lamp.setPosition(x, y);
    this.lamp.intensity = 1.6 * k;

    if (this.candles) {
      // A ring of candles floating round her.
      const cg = this.candles.begin(x, y + 12, y + 60);
      for (let i = 0; i < 10; i++) {
        const q = (i / 10) * Math.PI * 2 + this.t * 0.0008;
        const cx = x + Math.cos(q) * 58;
        const cy = y + 12 + Math.sin(q) * 58 * GROUND - 8 + Math.sin(this.t * 0.004 + i) * 2;
        for (let d = 0; d < 3; d++) cg.put(cx, cy + d, 0xfff4e0, k);
        cg.put(cx, cy - 1, (Math.floor(this.t / 90) + i) % 2 ? p.hot : p.core, k);
        cg.put(cx, cy - 2, p.mid, k * 0.6);
      }
      cg.end();
      if (Math.floor(this.t / 140) !== Math.floor((this.t - dt) / 140) && on) w.debris([0xffb030, 0xf07a14, 0xffe070], x + (Math.random() - 0.5) * 160, y - 40, 1, y + 40, 'spores');
    }

    if (on) {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = NIGHT_TICK;
        // Out in the dark, fear: frozen still, the dread gnawing.
        for (const f of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - h.x, b.y - h.y) <= NIGHT_R)) {
          const held = (f as Hurtbox & { bind?(ms: number, lift: number): boolean }).bind?.(NIGHT_TICK + 150, 0);
          if (!held) f.slow?.(0.3, NIGHT_TICK + 150, p.mid);
          f.hurt({ damage: NIGHT_DAMAGE, heavy: false, knock: 0, fromX: h.x, fromY: h.y, poison: p.hot });
        }
      }
    } else if (!this.flared) {
      // The lantern flares, and everything in its light burns.
      this.flared = true;
      for (const f of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - h.x, b.y - h.y) <= NIGHT_FLARE_R)) {
        f.hurt({ damage: NIGHT_FLARE_DAMAGE, heavy: true, knock: 150, fromX: h.x, fromY: h.y });
        w.debris(p.tints, f.x, f.y - f.bodyY, 6, f.y + 10, 'burst');
      }
      flare(w, x, y, 220, p.light, 4, 600);
      bloom(w, x, y, p.hot, 4, 500, h.y + 60);
      w.debris([0xffffff, ...p.tints], x, y, 40, h.y + 30, 'burst');
      w.cameras.main.shake(260, 0.0014);
      sound.starImpact(w.pan(x));
    }
  }
}
