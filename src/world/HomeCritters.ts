import Phaser from 'phaser';
import { CRITTER_H, CRITTER_OX, CRITTER_OY, CRITTER_W } from '../art/critters';
import { thingFoot } from '../art/homeArt';
import { sound } from '../audio';
import { critterById, type CritterDef } from '../game/critters';
import { snap } from '../game/display';
import type { WorldScene } from '../scenes/WorldScene';
import { homeWalkable } from './homeGround';
import { CELL, COLS, PLOT_X, PLOT_Y, cellIndex, inPlot, type HomeLayout, type Thing } from './homeLayout';
import { partById } from './homeParts';

// The critters the player has let out in their Home (the build tray's
// Critters tab). Each is kept in the layout as a thing at the spot it was let
// go, so it's saved with the home and visitors see it too; here it lives
// round that spot in its own way. Fireflies come out three together and blink
// over the grass; moths find a lamp and circle it; butterflies and ladybirds
// visit the flowers; the dragonfly, the frog and the Glowlotl keep to the
// pond; the Candle Mouse, the Salamander and the Ember Beetle curl up by the
// fire. The rest potter about. They keep their hours: a day critter hides at
// night and a night one by day. A hero who runs through them scatters them
// for a moment; walked past gently, they carry on.
//
// A critter stays on its own side of a house's walls (in the room it was let
// out in, or out of doors). Like the wild ones (game/CritterField.ts), they
// have no lights of their own, just a soft halo, and stop animating off screen.

/** How far round its spot it wanders, and how far it goes to a favourite place (flowers, the pond, a lamp, the fire). */
const ROAM = 44;
const REACH = 112;
/** Fading in and out, as it wakes and hides, ms. */
const FADE = 900;
/** Fireflies are let out a few at once. */
const SWARM = 3;
/** When day and night critters are out, by the daylight (as for the wild ones, see critterPool). */
const DAY = 0.6;
const NIGHT = 0.55;
/** A hero moving faster than this (px/s) this close scatters it, for this long. */
const STARTLE_SPEED = 55;
const STARTLE_R = 22;
const FLEE_MS = 700;
/** Flyers flutter this high; a butterfly settles this high on a flower. */
const HOVER = 11;
const PERCH = 7;
/** A moth circles a lamp this wide, for a spell of this long (ms), before it drifts off a while. */
const ORBIT_R = 11;
const ORBIT_MS = [7000, 15000];
const AWAY_MS = [3000, 7000];
/** Kept updating this far outside the camera's view. */
const VIEW_PAD = 40;
/** Moving speeds (px/s) by gait, going about and scattering; calmer than out in the wild. */
const SPEED: Record<CritterDef['gait'], [number, number]> = {
  fly: [16, 60],
  crawl: [6, 20],
  hop: [0, 0],
  walk: [22, 56],
};

type Habit = 'swarm' | 'lamp' | 'flowers' | 'water' | 'fire' | 'roam';
const HABIT: Record<string, Habit> = {
  firefly: 'swarm',
  moonmoth: 'lamp',
  ghostmoth: 'lamp',
  cometmoth: 'lamp',
  bloodmoth: 'lamp',
  butterfly: 'flowers',
  ladybug: 'flowers',
  dragonfly: 'water',
  glowfrog: 'water',
  axolotl: 'water',
  candlemouse: 'fire',
  salamander: 'fire',
  emberbeetle: 'fire',
};

/** What flowers here: where butterflies land and ladybirds climb. */
const FLOWERS = new Set(['tulips', 'lavender', 'sunflowers', 'roses', 'planter', 'blossom', 'cabbages']);

interface Spot {
  x: number;
  y: number;
  house: number;
}

interface Lamp extends Spot {
  /** How high its flame or bulb is over its foot. */
  h: number;
  fire: boolean;
}

interface Bug {
  def: CritterDef;
  /** The release it belongs to: where it lives, and on which side of the walls. */
  kept: Kept;
  habit: Habit;
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Height over the ground now. */
  h: number;
  rest: number;
  /** Settled on a flower (flyers). */
  perch: boolean;
  flee: number;
  fx: number;
  fy: number;
  /** A frog's hop: 0..1 through it, from (x0, y0). */
  hop: number;
  x0: number;
  y0: number;
  /** The lamp it circles, where round it, which way, and how long it stays (or keeps away). */
  lamp: Lamp | null;
  orbit: number;
  spin: number;
  spell: number;
  facing: number;
  t: number;
  seed: number;
  shown: number;
  awake: boolean;
  onScreen: boolean;
  body: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite | null;
  shadow: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image | null;
}

interface Kept {
  thing: Thing;
  /** Its spot, moved to the nearest open ground if something was built on it. */
  home: { x: number; y: number };
  house: number;
  bugs: Bug[];
}

const keyOf = (t: Thing): string => `${t.id}@${t.x},${t.y}`;
const between = ([a, b]: number[]): number => a + Math.random() * (b - a);

export class HomeCritters {
  private released = new Map<string, Kept>();
  private layout!: HomeLayout;
  private houseAt!: Int16Array;
  private lamps: Lamp[] = [];
  private flowers: Spot[] = [];
  private water: Spot[] = [];
  private lastX = 0;
  private lastY = 0;
  private heroSpeed = 0;
  /** Dark enough for the moths to go to the lamps. */
  private dark = false;

  constructor(private scene: WorldScene) {}

  /** Bring the critters up to date with the layout; `loud`, new ones are let out with a sparkle and gone ones leave in a puff. */
  sync(layout: HomeLayout, houseAt: Int16Array, loud: boolean): void {
    this.layout = layout;
    this.houseAt = houseAt;
    this.findPlaces();
    // Moths keep to their lamp if it's still there.
    for (const c of this.released.values()) for (const b of c.bugs) if (b.lamp) b.lamp = this.lamps.find((p) => p.x === b.lamp!.x && p.y === b.lamp!.y) ?? null;
    const want = new Map<string, Thing>();
    for (const t of layout.things) if (partById(t.id)?.critter) want.set(keyOf(t), t);
    for (const [k, c] of this.released) {
      if (want.has(k)) continue;
      for (const b of c.bugs) {
        if (loud && b.shown > 0.2) this.scene.debris([0xffffff, b.def.tint], snap(b.x), snap(b.y - b.h - 4), 6, b.y + 20, 'spores');
        this.remove(b);
      }
      this.released.delete(k);
    }
    for (const [k, t] of want) {
      const old = this.released.get(k);
      if (old) {
        // A wall or the pond may have come over its spot; walls may have made it a room.
        this.settle(old);
        continue;
      }
      const def = critterById(partById(t.id)!.critter!);
      if (!def) continue;
      const foot = thingFoot(t);
      const c: Kept = { thing: t, home: { x: foot.x, y: foot.y - 5 }, house: -1, bugs: [] };
      this.settle(c);
      const n = HABIT[def.id] === 'swarm' ? SWARM : 1;
      for (let i = 0; i < n; i++) c.bugs.push(this.make(def, c, i > 0));
      this.released.set(k, c);
      if (loud) {
        this.scene.debris([0xffffff, def.tint, 0xfff4c0], snap(c.home.x), snap(c.home.y) - 8, 14, c.home.y + 20, 'spores');
        sound.critterRelease();
      }
    }
  }

  /** Its house, and a spot it can stand on. */
  private settle(c: Kept): void {
    const cx = c.thing.x;
    const cy = c.thing.y;
    c.house = inPlot(cx, cy) ? this.houseAt[cellIndex(cx, cy)] : -1;
    const def = critterById(partById(c.thing.id)?.critter ?? '');
    if (!def) return;
    if (this.ok(def, c.house, c.home.x, c.home.y)) return;
    for (let r = 4; r < 64; r += 4) {
      for (let a = 0; a < 12; a++) {
        const x = c.home.x + Math.cos((a / 12) * Math.PI * 2) * r;
        const y = c.home.y + Math.sin((a / 12) * Math.PI * 2) * r;
        if (this.ok(def, c.house, x, y)) {
          c.home = { x, y };
          return;
        }
      }
    }
  }

  /** The lamps, flowers and water in the home, where critters like to go. */
  private findPlaces(): void {
    const l = this.layout;
    const houseOf = (x: number, y: number) => {
      const cx = Math.floor((x - PLOT_X) / CELL);
      const cy = Math.floor((y - PLOT_Y) / CELL);
      return inPlot(cx, cy) ? this.houseAt[cellIndex(cx, cy)] : -1;
    };
    this.lamps = [];
    this.flowers = [];
    this.water = [];
    for (const t of l.things) {
      const p = partById(t.id);
      if (!p || p.critter) continue;
      const f = thingFoot(t);
      if (p.light && !p.wall) this.lamps.push({ x: f.x, y: f.y, house: houseOf(f.x, f.y - 2), h: p.light.y, fire: !!p.light.flicker });
      if (FLOWERS.has(t.id)) this.flowers.push({ x: f.x, y: f.y - 2, house: houseOf(f.x, f.y - 2) });
    }
    for (let i = 0; i < l.floor.length; i++) {
      const cx = i % COLS;
      const cy = (i - cx) / COLS;
      if (!l.isWater(cx, cy)) continue;
      this.water.push({ x: PLOT_X + (cx + 0.5) * CELL, y: PLOT_Y + (cy + 0.5) * CELL, house: this.houseAt[i] });
    }
  }

  private make(def: CritterDef, c: Kept, late: boolean): Bug {
    const add = this.scene.add;
    const ox = CRITTER_OX / CRITTER_W;
    const oy = CRITTER_OY / CRITTER_H;
    const f0 = `${def.id}_0`;
    const x = c.home.x + (late ? (Math.random() - 0.5) * 20 : 0);
    const y = c.home.y + (late ? (Math.random() - 0.5) * 14 : 0);
    const shadow = add.image(x, y, 'shadow').setDepth(1).setScale(def.gait === 'fly' ? 0.35 : 0.5, 0.5).setAlpha(0);
    const halo = def.glow ? add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(def.tint).setAlpha(0).setScale(HABIT[def.id] === 'swarm' ? 0.55 : 0.8) : null;
    const body = add.sprite(x, y, 'critters', f0).setOrigin(ox, oy).setPipeline('Lit').setAlpha(0);
    body.play({ key: `critter_${def.id}`, startFrame: Math.floor(Math.random() * 4) });
    const glow = def.glow ? add.sprite(x, y, 'critters_e', f0).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0) : null;
    const b: Bug = {
      def,
      kept: c,
      habit: HABIT[def.id] ?? 'roam',
      x,
      y,
      tx: x,
      ty: y,
      h: 0,
      rest: 400 + Math.random() * 1200,
      perch: false,
      flee: 0,
      fx: 0,
      fy: 0,
      hop: 0,
      x0: x,
      y0: y,
      lamp: null,
      orbit: Math.random() * Math.PI * 2,
      spin: Math.random() < 0.5 ? -1 : 1,
      spell: between(AWAY_MS) * 0.3,
      facing: Math.random() < 0.5 ? -1 : 1,
      t: Math.random() * 10000,
      seed: Math.random(),
      shown: 0,
      awake: false,
      onScreen: true,
      body,
      glow,
      shadow,
      halo,
    };
    return b;
  }

  private remove(b: Bug): void {
    for (const o of [b.body, b.glow, b.shadow, b.halo]) o?.destroy();
  }

  /** Can it be at (x, y)? On its own side of the walls; flyers anywhere off a wall, frogs and the Glowlotl on the pond too. */
  private ok(def: CritterDef, house: number, x: number, y: number): boolean {
    const cx = Math.floor((x - PLOT_X) / CELL);
    const cy = Math.floor((y - PLOT_Y) / CELL);
    if (!inPlot(cx, cy) || this.houseAt[cellIndex(cx, cy)] !== house) return false;
    const l = this.layout;
    if (def.gait === 'fly') return !l.wallAt(cx, cy);
    if (homeWalkable(x, y)) return true;
    return (def.gait === 'hop' || def.id === 'axolotl') && l.isWater(cx, cy) && !l.wallAt(cx, cy);
  }

  private fits(b: Bug, x: number, y: number): boolean {
    return this.ok(b.def, b.kept.house, x, y);
  }

  /** The critter (as its thing) drawn nearest (x, y), within r: what the eraser takes. */
  at(x: number, y: number, r: number): Thing | null {
    let best: Thing | null = null;
    let bestD = r;
    for (const c of this.released.values()) {
      for (const b of c.bugs) {
        if (b.shown < 0.3) continue;
        const d = Math.hypot(b.x - x, b.y - b.h * 0.5 - y);
        if (d < bestD) {
          bestD = d;
          best = c.thing;
        }
      }
    }
    return best;
  }

  update(dt: number, heroX: number, heroY: number, daylight: number, view: Phaser.Geom.Rectangle): void {
    const s = dt / 1000;
    const moved = Math.hypot(heroX - this.lastX, heroY - this.lastY);
    this.heroSpeed += ((moved > 40 ? 0 : moved / Math.max(s, 0.001)) - this.heroSpeed) * Math.min(1, s * 10);
    this.lastX = heroX;
    this.lastY = heroY;
    this.dark = daylight < NIGHT;
    for (const c of this.released.values()) for (const b of c.bugs) this.live(b, c, dt, heroX, heroY, daylight, view);
  }

  private isAwake(def: CritterDef, d: number, was: boolean): boolean {
    // A little overlap, so one doesn't blink in and out at the edge of its hours.
    if (def.when === 'day') return was ? d > DAY - 0.04 : d > DAY;
    if (def.when === 'night') return was ? d < NIGHT + 0.04 : d < NIGHT;
    return true;
  }

  private live(b: Bug, c: Kept, dt: number, heroX: number, heroY: number, d: number, view: Phaser.Geom.Rectangle): void {
    const s = dt / 1000;
    b.t += dt;
    const awake = this.isAwake(b.def, d, b.awake);
    if (awake !== b.awake) {
      b.awake = awake;
      // Out of hiding where it lives, if it had quite gone.
      if (awake && b.shown <= 0) {
        b.x = b.tx = b.x0 = c.home.x + (Math.random() - 0.5) * 16;
        b.y = b.ty = b.y0 = c.home.y + (Math.random() - 0.5) * 10;
        if (!this.fits(b, b.x, b.y)) {
          b.x = b.tx = c.home.x;
          b.y = b.ty = c.home.y;
        }
        b.lamp = null;
        b.perch = false;
        b.h = 0;
      }
    }
    b.shown = Phaser.Math.Clamp(b.shown + (awake ? dt : -dt) / FADE, 0, 1);
    const on = b.shown > 0 && b.x > view.x - VIEW_PAD && b.x < view.right + VIEW_PAD && b.y > view.y - VIEW_PAD && b.y < view.bottom + VIEW_PAD + HOVER;
    if (on !== b.onScreen) {
      b.onScreen = on;
      for (const o of [b.body, b.glow, b.shadow, b.halo]) o?.setVisible(on);
      if (on) b.body.anims.resume();
      else b.body.anims.pause();
    }
    if (b.shown <= 0) return;

    if (this.heroSpeed > STARTLE_SPEED && b.flee <= 0 && Math.hypot(b.x - heroX, (b.y - heroY) * 1.3) < STARTLE_R) this.startle(b, heroX, heroY);
    this.move(b, c, dt, s);
    if (!on) return;

    const rx = snap(b.x);
    const ry = snap(b.y);
    const hy = snap(ry - b.h);
    const flip = b.facing < 0;
    const a = b.shown;
    b.body.setPosition(rx, hy).setDepth(ry).setFlipX(flip).setAlpha(a);
    // Fireflies blink: dark most of the time, lit in slow soft pulses, each on its own beat.
    const blink = b.habit === 'swarm' ? this.blink(b) : 1;
    b.glow?.setPosition(rx, hy).setDepth(ry + 0.1).setFrame(b.body.frame.name).setFlipX(flip).setAlpha(a * (b.habit === 'swarm' ? 0.25 + 0.75 * blink : 1));
    const lift = Math.min(1, b.h / 16);
    b.shadow.setPosition(rx, ry).setAlpha(a * (0.5 - lift * 0.28));
    const dark = 1 - d;
    const halo = b.habit === 'swarm' ? (0.05 + 0.55 * dark) * blink : (0.1 + 0.32 * dark) * (0.85 + 0.15 * Math.sin(b.t * 0.006 + b.seed * 9));
    b.halo?.setPosition(rx, hy - 6).setDepth(ry + 0.2).setAlpha(a * halo);
  }

  private blink(b: Bug): number {
    const period = 2600 + b.seed * 2200;
    const ph = ((b.t / period + b.seed * 7) % 1 + 1) % 1;
    return ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI) ** 2 : 0;
  }

  private startle(b: Bug, x: number, y: number): void {
    const dx = b.x - x;
    const dy = b.y - y;
    const l = Math.hypot(dx, dy) || 1;
    b.flee = FLEE_MS * (0.8 + Math.random() * 0.4);
    b.fx = dx / l;
    b.fy = dy / l;
    b.lamp = null;
    b.spell = between(AWAY_MS);
    b.perch = false;
    if (b.def.gait === 'hop' && b.hop === 0) this.startHop(b, b.x + b.fx * 24, b.y + b.fy * 18);
  }

  private startHop(b: Bug, tx: number, ty: number): boolean {
    if (!this.fits(b, tx, ty)) return false;
    b.hop = 0.001;
    b.x0 = b.x;
    b.y0 = b.y;
    b.tx = tx;
    b.ty = ty;
    if (Math.abs(tx - b.x) > 1) b.facing = Math.sign(tx - b.x);
    return true;
  }

  /** Move by (dx, dy) if it may go there; false when it can't. */
  private step(b: Bug, dx: number, dy: number): boolean {
    if (Math.abs(dx) > 0.05) b.facing = Math.sign(dx);
    if (!this.fits(b, b.x + dx, b.y + dy)) {
      b.flee = 0;
      return false;
    }
    b.x += dx;
    b.y += dy;
    return true;
  }

  /** Somewhere to go next: one of its favourite places now and then, else a spot round home. */
  private pickTarget(b: Bug, c: Kept): void {
    b.perch = false;
    const near = <T extends Spot>(list: T[]): T[] => list.filter((p) => p.house === c.house && Math.hypot(p.x - c.home.x, p.y - c.home.y) < REACH);
    let goal: Spot | null = null;
    let spread = 0;
    const r = Math.random();
    if (b.habit === 'flowers' && r < 0.65) {
      const l = near(this.flowers);
      goal = l[Math.floor(Math.random() * l.length)] ?? null;
      spread = 3;
    } else if (b.habit === 'water' && r < 0.7) {
      const l = near(this.water);
      goal = l[Math.floor(Math.random() * l.length)] ?? null;
      spread = 5;
    } else if (b.habit === 'fire' && r < 0.7) {
      const l = near(this.lamps).filter((p) => p.fire);
      const f = l.sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
      // Curled up just in front of the fire, a little to one side.
      if (f) goal = { x: f.x + (Math.random() - 0.5) * 22, y: f.y + 6 + Math.random() * 10, house: f.house };
      spread = 2;
    }
    for (let tries = 0; tries < 6; tries++) {
      let x: number;
      let y: number;
      if (goal) {
        x = goal.x + (Math.random() - 0.5) * spread * 2;
        y = goal.y + (Math.random() - 0.5) * spread * 2;
      } else {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * ROAM * (b.habit === 'swarm' ? 0.8 : 1);
        x = c.home.x + Math.cos(a) * d;
        y = c.home.y + Math.sin(a) * d * 0.7;
      }
      if (this.fits(b, x, y)) {
        b.tx = x;
        b.ty = y;
        b.perch = !!goal && b.habit === 'flowers' && b.def.gait === 'fly';
        return;
      }
      // Round the stem or trunk, then, and failing that just somewhere near home.
      spread += 4;
      if (tries >= 2) goal = null;
    }
    b.tx = b.x;
    b.ty = b.y;
  }

  private move(b: Bug, c: Kept, dt: number, s: number): void {
    const [walk, run] = SPEED[b.def.gait];
    let want = 0;
    const bob = Math.sin(b.t * 0.004 + b.seed * 6) * 2.5 + Math.sin(b.t * 0.011 + b.seed * 3);

    // A moth by night: off to the nearest lamp on its side of the walls, round it for a spell, then away a while.
    if (b.habit === 'lamp' && b.lamp && !this.dark) b.spell = 0;
    if (b.habit === 'lamp' && b.flee <= 0) {
      b.spell -= dt;
      if (!b.lamp && b.spell <= 0 && this.dark) {
        const lit = this.lamps
          .map((p) => ({ p, d: Math.hypot(p.x - c.home.x, p.y - c.home.y) }))
          .filter((o) => o.p.house === c.house && o.d < REACH * 1.4)
          .sort((p, q) => p.d - q.d)[0];
        if (lit) {
          b.lamp = lit.p;
          b.spell = between(ORBIT_MS);
        } else b.spell = between(AWAY_MS);
      } else if (b.lamp && b.spell <= 0) {
        b.lamp = null;
        b.spell = between(AWAY_MS);
        this.pickTarget(b, c);
      }
    }
    const lamp = b.lamp;

    if (lamp) {
      // Round and round, a little unevenly, in front of the lamp and then behind it.
      b.orbit += (dt / 1000) * (2.2 + Math.sin(b.t * 0.0017 + b.seed * 5) * 0.8) * b.spin;
      const r = ORBIT_R * (0.8 + 0.3 * Math.sin(b.t * 0.0023 + b.seed));
      const gx = lamp.x + Math.cos(b.orbit) * r;
      const gy = lamp.y + Math.sin(b.orbit) * r * 0.45 + 1;
      const k = Math.min(1, dt / 260);
      const dx = (gx - b.x) * k;
      if (Math.abs(dx) > 0.05) b.facing = Math.sign(dx);
      b.x += dx;
      b.y += (gy - b.y) * k;
      want = lamp.h + 2 + bob;
    } else if (b.def.gait === 'hop') {
      if (b.hop > 0) {
        b.hop = Math.min(1, b.hop + dt / (b.flee > 0 ? 320 : 440));
        b.x = b.x0 + (b.tx - b.x0) * b.hop;
        b.y = b.y0 + (b.ty - b.y0) * b.hop;
        if (b.hop >= 1) {
          b.hop = 0;
          b.rest = 1600 + Math.random() * 3200;
        }
      } else if ((b.rest -= dt) <= 0) {
        // Hop by hop towards where it's going; once there, pick somewhere else.
        if (Math.hypot(b.tx - b.x, b.ty - b.y) < 4) this.pickTarget(b, c);
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const dd = Math.hypot(dx, dy);
        const k = dd > 0 ? Math.min(dd, 16 + Math.random() * 4) / dd : 0;
        if (!this.startHop(b, b.x + dx * k, b.y + dy * k)) {
          b.tx = b.x;
          b.ty = b.y;
          b.rest = 500;
        }
      }
      want = b.hop > 0 ? Math.sin(b.hop * Math.PI) * 7 : 0;
    } else if (b.flee > 0) {
      this.step(b, b.fx * run * s, b.fy * run * s);
    } else if (b.rest > 0) {
      b.rest -= dt;
      // Flyers never quite settle, unless on a flower; fireflies drift the whole time.
      if (b.def.gait === 'fly' && !b.perch) this.step(b, Math.sin(b.t * 0.003 + b.seed * 4) * 6 * s, Math.cos(b.t * 0.0023 + b.seed * 2) * 4 * s);
    } else {
      const dx = b.tx - b.x;
      const dy = b.ty - b.y;
      const dd = Math.hypot(dx, dy);
      if (dd < 2) {
        b.rest =
          b.perch ? 2500 + Math.random() * 4000
          : b.def.gait === 'fly' ? 300 + Math.random() * 1100
          : b.habit === 'fire' && !this.near(b) ? 800 + Math.random() * 1500
          : b.habit === 'fire' ? 5000 + Math.random() * 8000
          : 1200 + Math.random() * 3200;
        if (!b.perch) this.pickTarget(b, c);
        else b.tx = b.x;
      } else {
        const weave = b.def.gait === 'fly' ? Math.sin(b.t * (b.habit === 'swarm' ? 0.004 : 0.008) + b.seed * 8) * 0.6 : 0;
        const ux = dx / dd - (dy / dd) * weave;
        const uy = dy / dd + (dx / dd) * weave;
        const pace = b.habit === 'swarm' ? 0.55 : b.def.id === 'sporepuff' ? 0.5 : b.def.id === 'dragonfly' ? 1.6 : 1;
        const st = Math.min(dd, walk * pace * s);
        if (!this.step(b, ux * st, uy * st)) this.pickTarget(b, c);
      }
    }
    if (b.flee > 0) b.flee -= dt;
    // Perched flyers wait out their rest, then take off somewhere new.
    if (b.perch && b.rest <= 0 && Math.hypot(b.tx - b.x, b.ty - b.y) < 2) this.pickTarget(b, c);

    if (!lamp && b.def.gait === 'fly') want = b.perch && b.rest > 0 ? PERCH : (b.habit === 'swarm' ? HOVER + 3 : HOVER) + bob;
    // Rising and settling ease; a hop's arc is exact.
    b.h = b.def.gait === 'hop' ? want : b.h + (want - b.h) * Math.min(1, dt / 280);
  }

  /** Is a fire-lover by a fire now? */
  private near(b: Bug): boolean {
    return this.lamps.some((p) => p.fire && Math.hypot(p.x - b.x, p.y - b.y) < 30);
  }

  destroy(): void {
    for (const c of this.released.values()) for (const b of c.bugs) this.remove(b);
    this.released.clear();
  }
}
