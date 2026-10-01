// Fishing in the Home or the Everwood: walk up to a rod standing in its pail within three
// squares of water and press E (or the touch button, which shows a rod) to
// take it out. The hero casts, the float bobs, a fish nibbles, then bites:
// press to hook it, then hold to lift the reel's green zone and keep the fish
// inside it until the line is full. Landing it saves it to the collection.
// The overlay drawing the gauge and the cards is scenes/FishScene.ts; the
// fish themselves are in game/fish.ts and art/fish.ts.

import Phaser from 'phaser';
import { warmFish } from '../art/fish';
import { sound } from '../audio';
import { build } from '../game/build';
import type { Aim } from '../game/characters';
import { collection } from '../game/collection';
import { controls } from '../game/controls';
import { daynight } from '../game/daynight';
import { fishById, fishHud, fishSay, fishTier, rollFish, type FishDef, type FishPhase } from '../game/fish';
import type { WorldScene } from '../scenes/WorldScene';
import type { RodSpot } from './Home';

/** Where the rods stand: the Home, or the Everwood. */
export interface RodHost {
  rods(): RodSpot[];
  /** Take a rod out of its pail for fishing, or stand it back in. */
  holdRod(key: string, out: boolean): void;
}

/** How close to a pail's foot the hero must stand to take its rod, px. */
const REACH = 20;
/** The cast: the rod swings back over the shoulder, then forward, letting the float fly. */
const SWING_MS = 220;
const FLIGHT_MS = 520;
const ARC = 26;
/** How long the float sits before a bite, and how much longer when the hero strikes too soon. */
const WAIT_MIN = 2400;
const WAIT_MAX = 7000;
const EARLY_MIN = 1300;
const EARLY_MAX = 2400;
/** How long a bite lasts to be hooked: shorter for a harder fish. */
const BITE_MS = 1000;
const BITE_HARD_MS = 650;
/** A landed fish is shown this long (a press after LANDED_MIN moves on); a lost one this long. */
const LANDED_MS = 3200;
const LANDED_MIN = 800;
const LOST_MS = 1200;
/** The reel, in gauge heights per second (per second squared for the pushes). */
const LIFT = 2.8;
const FALL = 2.3;
const MAX_V = 1.4;
const BOUNCE = 0.3;
/** The line's fill: where it starts, and how fast it fills in the zone and drains out of it. */
const START = 0.32;
const FILL = 0.3;
const DRAIN = 0.2;
/** The zone's height for the easiest fish and the hardest. */
const ZONE_EASY = 0.34;
const ZONE_HARD = 0.19;
/** The held rod: its length and where the hand holds it. */
const ROD_LEN = 19;
const HAND_Y = 12;
/** How often the reel clicks while it's winding in. */
const TICK_MS = 95;

interface Ring {
  x: number;
  y: number;
  r: number;
  grow: number;
  life: number;
  max: number;
}

/** A colour darkened for the time of day: cool and dim at night. */
function dusk(col: number, d: number): number {
  const k = 0.42 + 0.58 * d;
  const r = ((col >> 16) & 255) * k;
  const g = ((col >> 8) & 255) * k;
  const b = (col & 255) * (k + (1 - k) * 0.35);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.min(255, Math.round(b));
}

export class Fishing {
  private spot: RodSpot | null = null;
  /** Where the float lands, and where it is now. */
  private target = { x: 0, y: 0 };
  private float = { x: 0, y: 0 };
  private from = { x: 0, y: 0 };
  private side = 1;
  private waitT = 0;
  private nibbles: number[] = [];
  private dipT = 0;
  private fish: FishDef | null = null;
  // The reel.
  private zoneV = 0;
  private fishTo = 0.5;
  private moveT = 0;
  private tickT = 0;
  private ringT = 0;
  private bend = 0;
  private rings: Ring[] = [];
  private hero = { x: 0, y: 0 };
  private daylight = 1;
  private rod: Phaser.GameObjects.Graphics;
  private water: Phaser.GameObjects.Graphics;
  private bob: Phaser.GameObjects.Image;
  private splash: Phaser.GameObjects.Particles.ParticleEmitter;
  private leap: Phaser.GameObjects.Sprite;
  private leapGlow: Phaser.GameObjects.Sprite;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private label: Phaser.GameObjects.BitmapText;
  private labelFor = '';

  constructor(
    private scene: WorldScene,
    private home: RodHost,
  ) {
    warmFish(scene);
    const add = scene.add;
    this.rod = add.graphics().setDepth(0);
    this.water = add.graphics().setDepth(1.7);
    this.bob = add.image(0, 0, 'home', 'bobber').setOrigin(0.5, 5.5 / 8).setPipeline('Lit').setVisible(false);
    this.splash = add.particles(0, 0, 'spark', {
      speed: { min: 25, max: 70 },
      angle: { min: 220, max: 320 },
      gravityY: 260,
      lifespan: { min: 280, max: 520 },
      scale: { start: 1, end: 0.2 },
      tint: [0xf0fbff, 0xb8e4f4, 0x8ac8e0],
      emitting: false,
    }).setDepth(1.8);
    this.leap = add.sprite(0, 0, 'fish', 'minnow_0').setPipeline('Lit').setVisible(false);
    this.leapGlow = add.sprite(0, 0, 'fish_e', 'minnow_0').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.sparks = add.particles(0, 0, 'spark', {
      speed: { min: 15, max: 55 },
      lifespan: { min: 400, max: 800 },
      scale: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(20001);
    this.label = add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1).setOrigin(0.5, 1).setDepth(10002).setVisible(false);
    this.reset();
  }

  get active(): boolean {
    return fishHud.active;
  }

  /** E, or the touch button: take up the rod in reach, if it can reach water. True when it did. */
  tap(): boolean {
    if (fishHud.active || build.on) return false;
    const s = this.nearRod();
    if (!s || !s.water.length) return false;
    this.start(s);
    return true;
  }

  /** Which way the hero faces while fishing: at the float. */
  aim(): Aim | null {
    if (!fishHud.active) return null;
    const dx = this.target.x - this.hero.x;
    const dy = this.target.y - (this.hero.y - HAND_Y);
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l, look: true };
  }

  /** Put the rod back in its pail. */
  stop(): void {
    if (!fishHud.active) return;
    if (this.spot) this.home.holdRod(this.spot.key, false);
    this.spot = null;
    this.fish = null;
    this.bob.setVisible(false);
    this.leap.setVisible(false);
    this.leapGlow.setVisible(false);
    this.rod.clear();
    this.reset();
  }

  private reset(): void {
    Object.assign(fishHud, { active: false, phase: 'idle', t: 0, hold: false, press: false, stop: false, landed: null, message: '', messageT: 0, progress: START });
  }

  /** The rod the hero stands by, if any. */
  private nearRod(): RodSpot | null {
    let best: RodSpot | null = null;
    let bestD = REACH;
    for (const s of this.home.rods()) {
      const d = Math.hypot(s.x - this.hero.x, (s.y - this.hero.y) * 1.3);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private start(s: RodSpot): void {
    this.spot = s;
    this.home.holdRod(s.key, true);
    Object.assign(fishHud, { active: true, hold: false, press: false, stop: false, landed: null });
    this.cast();
  }

  /** Pick a spot on the water, near the hero and out from the bank, and cast to it. */
  private cast(): void {
    const s = this.spot!;
    let best = s.water[0];
    let bestScore = Infinity;
    for (const w of s.water) {
      const d = Math.hypot(w.x - this.hero.x, w.y - this.hero.y);
      // Out in open water, not too close to the feet: the float wants room round it.
      const score = d + (w.open ? -14 : 0) + (d < 18 ? 30 : 0) + Math.random() * 10;
      if (score < bestScore) {
        bestScore = score;
        best = w;
      }
    }
    this.target = { x: Math.round(best.x + (Math.random() - 0.5) * 6), y: Math.round(best.y + (Math.random() - 0.5) * 4) };
    this.side = this.target.x >= this.hero.x ? 1 : -1;
    this.fish = null;
    this.go('cast');
    sound.fishCast();
  }

  private go(p: FishPhase): void {
    fishHud.phase = p;
    fishHud.t = 0;
  }

  // ---------------------------------------------------------------- Each frame

  update(dt: number, heroX: number, heroY: number, daylight: number): void {
    this.hero.x = heroX;
    this.hero.y = heroY;
    this.daylight = daylight;
    fishHud.messageT = Math.max(0, fishHud.messageT - dt);

    if (!fishHud.active) {
      const s = build.on ? null : this.nearRod();
      fishHud.near = !!s && s.water.length > 0;
      this.showLabel(s);
      this.drawWater(dt);
      return;
    }
    fishHud.near = false;
    this.showLabel(null);
    // Building, the rod gone from the layout, or asked to stop: put it away.
    if (fishHud.stop || build.on || !this.spot || !this.home.rods().some((r) => r.key === this.spot!.key)) {
      this.stop();
      this.drawWater(dt);
      return;
    }
    fishHud.t += dt;
    const press = fishHud.press;
    fishHud.press = false;
    switch (fishHud.phase) {
      case 'cast':
        this.stepCast();
        break;
      case 'wait':
        this.stepWait(dt, press);
        break;
      case 'bite':
        this.stepBite(press);
        break;
      case 'reel':
        this.stepReel(dt);
        break;
      case 'landed':
        this.stepLanded(press);
        break;
      case 'lost':
        if (fishHud.t > LOST_MS) this.go('ready');
        break;
      case 'ready':
        if (press) this.cast();
        break;
    }
    this.drawRod();
    this.drawWater(dt);
  }

  /** Over a pail in reach: "E: fish" with a keyboard, or why it can't be used. */
  private showLabel(s: RodSpot | null): void {
    const text = !s ? '' : !s.water.length ? 'NEEDS WATER NEARBY' : controls.mouse ? 'E: FISH' : '';
    if (text !== this.labelFor) {
      this.labelFor = text;
      this.label.setText(text).setTint(s?.water.length ? 0xffe08a : 0xb8a8d0);
    }
    this.label.setVisible(!!text);
    if (s && text) this.label.setPosition(Math.round(s.x), Math.round(s.y - 40 + Math.sin(this.scene.time.now * 0.004) * 1.5));
  }

  private stepCast(): void {
    const t = fishHud.t;
    const hand = this.hand();
    if (t < SWING_MS) {
      this.bend = 0;
      this.bob.setVisible(false);
      this.from = this.tip(hand, 1);
      return;
    }
    const k = Math.min(1, (t - SWING_MS) / FLIGHT_MS);
    const e = Phaser.Math.Easing.Sine.Out(k);
    this.float.x = this.from.x + (this.target.x - this.from.x) * e;
    this.float.y = this.from.y + (this.target.y - this.from.y) * e - Math.sin(Math.PI * k) * ARC;
    this.bob.setVisible(true).setCrop().setPosition(this.float.x, this.float.y).setDepth(this.float.y + 20);
    if (k < 1) return;
    // Plop: rings spread from where it lands.
    this.float = { ...this.target };
    this.ring(this.target.x, this.target.y, 2, 9, 700);
    this.ring(this.target.x, this.target.y, 1, 5, 500);
    this.splash.explode(4, this.target.x, this.target.y);
    sound.fishPlop(this.scene.pan(this.target.x));
    this.waitT = WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN);
    // A nibble or three before the bite, to build it up.
    const n = Math.floor(Math.random() * 3.4);
    this.nibbles = Array.from({ length: n }, () => this.waitT * (0.3 + Math.random() * 0.6)).sort((a, b) => b - a);
    this.go('wait');
  }

  private stepWait(dt: number, press: boolean): void {
    this.bend = 0.05;
    this.waitT -= dt;
    this.dipT = Math.max(0, this.dipT - dt);
    // Too soon: whatever was nosing the bait swims off, and it's a while longer.
    if (press && fishHud.t > 250) {
      this.waitT += EARLY_MIN + Math.random() * (EARLY_MAX - EARLY_MIN);
      this.dipT = 140;
      fishSay('Too soon... wait for the float to dip');
      this.ring(this.target.x, this.target.y, 1, 5, 400);
    }
    if (this.nibbles.length && this.waitT < this.nibbles[0]) {
      this.nibbles.shift();
      this.dipT = 170;
      this.ring(this.target.x, this.target.y, 1, 6, 450);
      sound.fishNibble(this.scene.pan(this.target.x));
    }
    this.ringT -= dt;
    if (this.ringT <= 0) {
      this.ringT = 1600 + Math.random() * 1200;
      this.ring(this.target.x, this.target.y, 2, 7, 900, 0.35);
    }
    const t = this.scene.time.now;
    this.float.x = this.target.x;
    this.float.y = this.target.y + Math.sin(t * 0.0035) * 0.6 + (this.dipT > 0 ? 1.5 : 0);
    this.placeBob(this.dipT > 0 ? 1 : 0);
    if (this.waitT > 0) return;
    // A bite: the float goes under.
    this.fish = rollFish(daynight.phase);
    fishHud.big = this.fish.rarity === 'legendary';
    this.ring(this.target.x, this.target.y, 2, 12, 700);
    this.ring(this.target.x, this.target.y, 1, 7, 500);
    this.splash.explode(8, this.target.x, this.target.y);
    sound.fishBite(this.scene.pan(this.target.x));
    this.go('bite');
  }

  private stepBite(press: boolean): void {
    this.bend = 0.55;
    const f = this.fish!;
    const t = this.scene.time.now;
    this.float.x = this.target.x + Math.sin(t * 0.05) * 0.8;
    this.float.y = this.target.y + 2.5;
    this.placeBob(3);
    if (press) {
      // Hooked: the reel begins with the fish low and the zone round it.
      fishHud.fish = 0.3;
      fishHud.zoneH = ZONE_EASY + (ZONE_HARD - ZONE_EASY) * f.pull;
      fishHud.zone = Math.max(0, fishHud.fish - fishHud.zoneH / 2);
      fishHud.progress = START;
      this.zoneV = 0;
      this.fishTo = 0.5;
      this.moveT = 500;
      this.go('reel');
      return;
    }
    if (fishHud.t > BITE_MS + (BITE_HARD_MS - BITE_MS) * f.pull) {
      fishSay('It got away...');
      sound.fishLost();
      this.go('lost');
    }
  }

  private stepReel(dt: number): void {
    const f = this.fish!;
    const s = dt / 1000;
    const h = fishHud;
    // The zone: held, it's pushed up; let go, it sinks, bouncing off the bottom.
    this.zoneV = Phaser.Math.Clamp(this.zoneV + (h.hold ? LIFT : -FALL) * s, -MAX_V, MAX_V);
    h.zone += this.zoneV * s;
    if (h.zone < 0) {
      h.zone = 0;
      this.zoneV = -this.zoneV * BOUNCE;
    } else if (h.zone > 1 - h.zoneH) {
      h.zone = 1 - h.zoneH;
      this.zoneV = 0;
    }
    // The fish darts about: harder fish more often, further and faster; the legend now and then bolts.
    this.moveT -= dt;
    if (this.moveT <= 0) {
      const bolt = Math.random() < f.pull * 0.22;
      const reach = bolt ? 0.7 : 0.25 + f.pull * 0.55;
      this.fishTo = Phaser.Math.Clamp(h.fish + (Math.random() - 0.5) * 2 * reach, 0.04, 0.96);
      this.moveT = (1400 - f.pull * 900) * (0.55 + Math.random() * 0.9) * (bolt ? 0.6 : 1);
    }
    const speed = 1.1 + f.pull * 3.2;
    const was = h.fish;
    h.fish += (this.fishTo - h.fish) * Math.min(1, s * speed) + Math.sin(this.scene.time.now * 0.013) * 0.0015 * (1 + f.pull * 2);
    h.fish = Phaser.Math.Clamp(h.fish, 0, 1);
    h.rising = h.fish > was;
    const inZone = h.fish >= h.zone && h.fish <= h.zone + h.zoneH;
    h.progress += inZone ? FILL * (1 - f.pull * 0.25) * s : -DRAIN * (0.8 + f.pull * 0.5) * s;
    this.bend = inZone ? 0.55 + (h.hold ? 0.3 : 0.1) : 0.9;

    // The reel clicks as it winds, and the float thrashes where the fish pulls.
    if (inZone) {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = TICK_MS;
        sound.reelTick();
      }
    }
    const t = this.scene.time.now;
    this.float.x = this.target.x + (h.fish - 0.5) * 12 + Math.sin(t * 0.031) * 1.2;
    this.float.y = this.target.y + 2 + Math.sin(t * 0.023) * 1;
    this.placeBob(4);
    this.ringT -= dt;
    if (this.ringT <= 0) {
      this.ringT = 260 + Math.random() * 260;
      this.ring(this.float.x, this.target.y, 1, 6 + f.pull * 4, 450);
      if (Math.random() < 0.35 + f.pull * 0.4) this.splash.explode(2 + Math.round(f.pull * 3), this.float.x, this.target.y);
    }

    if (h.progress >= 1) this.land(f);
    else if (h.progress <= 0) {
      fishSay('The line went slack...');
      sound.fishLost();
      this.go('lost');
    }
  }

  /** Landed: it leaps out of the water, over the hero's head, and into the collection. */
  private land(f: FishDef): void {
    const first = collection.catchFish(f.id);
    fishHud.landed = { id: f.id, first };
    fishHud.progress = 1;
    this.go('landed');
    this.bob.setVisible(false);
    this.splash.explode(14, this.float.x, this.target.y);
    this.ring(this.float.x, this.target.y, 2, 14, 800);
    this.ring(this.float.x, this.target.y, 1, 9, 600);
    sound.fishLanded(fishTier(f));
    this.leap.setTexture('fish', `${f.id}_0`).play(`fish_${f.id}`).setVisible(true).setFlipX(this.side < 0);
    this.leapGlow.setVisible(!!f.glow).setFlipX(this.side < 0);
    this.sparks.setParticleTint(f.tint);
  }

  private stepLanded(press: boolean): void {
    const t = fishHud.t;
    const f = fishById(fishHud.landed?.id ?? '');
    // The leap: an arc from the water to over the hero's head, turning level as it comes.
    const k = Math.min(1, t / 620);
    const e = Phaser.Math.Easing.Sine.Out(k);
    const hx = this.hero.x;
    const hy = this.hero.y - 40;
    const x = this.float.x + (hx - this.float.x) * e;
    const y = this.target.y + (hy - this.target.y) * e - Math.sin(Math.PI * k) * 22;
    const wiggle = k < 1 ? 0 : Math.sin(t * 0.02) * 6;
    const angle = (1 - e) * -50 * this.side + wiggle;
    const fade = t > LANDED_MS - 400 ? Math.max(0, (LANDED_MS - t) / 400) : 1;
    this.leap.setPosition(Math.round(x), Math.round(y)).setAngle(angle).setDepth(this.hero.y + 30).setAlpha(fade);
    this.leapGlow.setFrame(this.leap.frame.name).setPosition(this.leap.x, this.leap.y).setAngle(angle).setDepth(this.hero.y + 30.1).setAlpha(fade * 0.9);
    if (k >= 1 && f && Math.random() < (f.rarity === 'common' ? 0.08 : 0.25)) this.sparks.explode(1, x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 10);
    this.bend = 0.1;
    if (t > LANDED_MS || (press && t > LANDED_MIN)) {
      this.leap.setVisible(false);
      this.leapGlow.setVisible(false);
      fishHud.landed = null;
      this.go('ready');
      if (press) this.cast();
    }
  }

  // ---------------------------------------------------------------- Drawing

  private placeBob(sunk: number): void {
    this.bob.setVisible(true).setPosition(Math.round(this.float.x), Math.round(this.float.y)).setDepth(this.float.y - 2);
    // Sunk rows are cut off the bottom: at the most, only its tip shows.
    if (sunk > 0) this.bob.setCrop(0, 0, 7, 8 - sunk - 1);
    else this.bob.setCrop();
  }

  private hand(): { x: number; y: number } {
    return { x: this.hero.x + this.side * 4, y: this.hero.y - HAND_Y };
  }

  /** The rod's tip, from the hand, for a swing from back over the shoulder (0) to out over the water (1), bent by the fish. */
  private tip(hand: { x: number; y: number }, swing: number): { x: number; y: number } {
    const d = this.rodDir(swing);
    return { x: hand.x + d.x * ROD_LEN + this.side * this.bend * 3, y: hand.y + d.y * ROD_LEN + this.bend * 7 };
  }

  private rodDir(swing: number): { x: number; y: number } {
    const dx = this.target.x - this.hero.x;
    const dy = this.target.y - this.hero.y;
    const l = Math.hypot(dx, dy) || 1;
    // Out toward the water and up; swung back, up and behind.
    const fx = dx / l;
    const fy = (dy / l) * 0.45 - 1.05;
    const bx = -this.side * 0.45;
    const by = -1.1;
    const x = bx + (fx - bx) * swing;
    const y = by + (fy - by) * swing;
    const n = Math.hypot(x, y) || 1;
    return { x: x / n, y: y / n };
  }

  /** The rod in the hands, bending to the fish, and its line out to the float: drawn pixel by pixel, lit by the day. */
  private drawRod(): void {
    const g = this.rod.clear();
    const d = this.daylight;
    const hand = this.hand();
    const phase = fishHud.phase;
    const swing = phase === 'cast' ? Phaser.Math.Easing.Back.Out(Math.min(1, Math.max(0, (fishHud.t - 60) / (SWING_MS - 60)))) * (fishHud.t < 60 ? 0 : 1) : 1;
    const dir = this.rodDir(swing);
    const tip = this.tip(hand, swing);
    const butt = { x: hand.x - dir.x * 4, y: hand.y - dir.y * 4 };
    const ctrl = { x: hand.x + dir.x * ROD_LEN * 0.55, y: hand.y + dir.y * ROD_LEN * 0.55 };
    // Behind the hero when the water is behind them.
    const north = this.target.y < this.hero.y - 10;
    g.setDepth(this.hero.y + (north ? -0.5 : 0.5));
    const seen = new Set<number>();
    const dot = (x: number, y: number, col: number, a = 1) => {
      const px = Math.round(x);
      const py = Math.round(y);
      const k = px * 4096 + py;
      if (seen.has(k)) return;
      seen.add(k);
      g.fillStyle(dusk(col, d), a).fillRect(px, py, 1, 1);
    };
    const quad = (a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, s: number) => ({
      x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * c.x + s * s * b.x,
      y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * c.y + s * s * b.y,
    });

    // The line first, so the rod sits over it: from the tip to the float, sagging when slack.
    if (phase !== 'landed') {
      const end = phase === 'ready' || phase === 'lost' || (phase === 'cast' && fishHud.t < SWING_MS) ? { x: tip.x, y: tip.y + 9 + Math.sin(this.scene.time.now * 0.004) } : this.float;
      const taut = phase === 'reel' || phase === 'bite' ? 1 : phase === 'cast' ? 0.6 : 0;
      const sag = 2 + (1 - taut) * 9;
      const mid = { x: (tip.x + end.x) / 2, y: (tip.y + end.y) / 2 + sag };
      const n = Math.max(6, Math.ceil(Math.hypot(end.x - tip.x, end.y - tip.y) * 1.2));
      for (let i = 1; i < n; i++) {
        const p = quad(tip, mid, end, i / n);
        dot(p.x, p.y, 0xe8f0ff, 0.55);
      }
      // Dangling: the float hangs at the line's end.
      if (end !== this.float) this.bob.setVisible(true).setCrop().setPosition(Math.round(end.x), Math.round(end.y) + 3).setDepth(g.depth + 0.1);
    }
    // The rod: cork grip, brass reel, then the shaft tapering to its tip.
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const p = s < 0.2 ? { x: butt.x + (hand.x - butt.x) * (s / 0.2), y: butt.y + (hand.y - butt.y) * (s / 0.2) } : quad(hand, ctrl, tip, (s - 0.2) / 0.8);
      const col = s < 0.22 ? 0xb08a58 : s < 0.9 ? 0x6a4122 : 0x3a2414;
      dot(p.x, p.y, col);
    }
    // A highlight along the lit side of the grip, and the reel.
    dot(hand.x - 1, hand.y - 1, 0xdcbc82);
    const r = { x: hand.x - dir.x * 1.5 - this.side, y: hand.y - dir.y * 1.5 + 1 };
    dot(r.x, r.y, 0xe2b84e);
    dot(r.x - this.side, r.y, 0x84581a);
    dot(r.x, r.y + 1, 0xa87624);
  }

  private ring(x: number, y: number, r: number, max: number, life: number, alpha = 0.7): void {
    this.rings.push({ x, y, r, grow: (max - r) / life, life: life * alpha, max: life });
  }

  /** Rings spreading on the water: pixel ellipses fading as they grow. */
  private drawWater(dt: number): void {
    const g = this.water.clear();
    if (!this.rings.length) return;
    const d = this.daylight;
    for (const w of this.rings) {
      w.r += w.grow * dt;
      w.life -= dt;
      const a = Math.max(0, w.life / w.max) * (0.45 + 0.4 * d);
      if (a <= 0) continue;
      g.fillStyle(dusk(0xe4f6ff, d), a);
      const n = Math.max(10, Math.round(w.r * 5));
      const seen = new Set<number>();
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const px = Math.round(w.x + Math.cos(t) * w.r);
        const py = Math.round(w.y + Math.sin(t) * w.r * 0.42);
        const k = px * 4096 + py;
        if (seen.has(k)) continue;
        seen.add(k);
        // The far side of a ring is fainter, as it is on real water.
        if (Math.sin(t) < 0 && (i & 1)) continue;
        g.fillRect(px, py, 1, 1);
      }
    }
    this.rings = this.rings.filter((w) => w.life > 0);
  }

  destroy(): void {
    this.stop();
    fishHud.near = false;
    for (const o of [this.rod, this.water, this.bob, this.splash, this.leap, this.leapGlow, this.sparks, this.label]) o.destroy();
  }
}
